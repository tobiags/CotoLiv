import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type {
  CameraPreset3D,
  ComputedRouteData,
  DelayIncident,
  DeliveryOrder,
  InterpolatedCourierState,
  MapViewMode,
  ThemeMode,
} from '../types/delivery';
import {formatDistanceFr, formatDurationFr} from '../utils/routeTracking';
import {
  computeDashedRibbonSegments,
  createRouteProjection3D,
  generateCotonouUrbanLayout,
  metersToSceneUnits,
  projectLatLngTo3D,
  type Point3D,
} from '../utils/geoTo3D';
import {createProceduralTextureSet} from '../three/proceduralTextures';
import {
  createCourierMotoGroup,
  createCourierVanGroup,
  createDestinationLandmarkGroup,
  createOriginHubGroup,
  createWaypointPylonGroup,
} from '../three/proceduralModels';
import {cn} from '../utils/cn';

interface DeliveryMap3DProps {
  order: DeliveryOrder;
  route: ComputedRouteData | null;
  courierState: InterpolatedCourierState | null;
  isLoadingRoute: boolean;
  routeError: string | null;
  onRetryRoute: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  speedMultiplier: 1 | 2 | 4;
  onChangeSpeed: (speed: 1 | 2 | 4) => void;
  theme: ThemeMode;
  mapMode: MapViewMode;
  onChangeMapMode: (mode: MapViewMode) => void;
  radiusMeters: number;
  isWithinProximity: boolean;
  delayIncident: DelayIncident | null;
  onToggleSimulateDelay: () => void;
  focusRequestId: number;
}

interface ProjectedLabelPos {
  x: number;
  y: number;
  visible: boolean;
}

interface ProjectedLabelsState {
  origin: ProjectedLabelPos;
  destination: ProjectedLabelPos;
  waypoint: ProjectedLabelPos;
  courier: ProjectedLabelPos;
}

const HIDDEN_LABEL: ProjectedLabelPos = {x: 0, y: 0, visible: false};

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererString = debugExt
    ? String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) ?? '')
    : String(gl.getParameter(gl.RENDERER) ?? '');
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
    rendererString
  );
}

/**
 * Builds a flat ribbon mesh along a 3D XZ polyline at constant elevation `y`.
 */
function buildRibbonGeometry(
  points: Point3D[],
  halfWidth: number,
  y: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (points.length < 2) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    return geometry;
  }

  // Deduplicate adjacent identical points to avoid zero-length tangents
  const clean: Point3D[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = clean[clean.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].z - prev.z) > 0.04) {
      clean.push(points[i]);
    }
  }
  if (clean.length < 2) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    return geometry;
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const prev = clean[Math.max(0, i - 1)];
    const next = clean[Math.min(clean.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;

    // Perpendicular normal on XZ plane
    const nx = -tz;
    const nz = tx;

    positions.push(
      clean[i].x - nx * halfWidth,
      y,
      clean[i].z - nz * halfWidth,
      clean[i].x + nx * halfWidth,
      y,
      clean[i].z + nz * halfWidth
    );
    normals.push(0, 1, 0, 0, 1, 0);

    if (i < clean.length - 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // Counter-clockwise when viewed from +Y so FrontSide faces upward
      indices.push(a, b, c, b, d, c);
    }
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Builds dashed/segmented gold ribbon segments for the remaining route path.
 */
function buildDashedRibbonGeometry(
  points: Point3D[],
  halfWidth: number,
  y: number,
  dashLength = 1.8,
  gapLength = 1.05
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const segments = computeDashedRibbonSegments(points, dashLength, gapLength);
  if (segments.length === 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    return geometry;
  }

  const positions = new Float32Array(segments.length * 12);
  const normals = new Float32Array(segments.length * 12);
  const indices: number[] = new Array(segments.length * 6);

  for (let i = 0; i < segments.length; i++) {
    const {startX, startZ, endX, endZ, nx, nz} = segments[i];
    const pOff = i * 12;
    const vOff = i * 4;
    const iOff = i * 6;

    positions[pOff] = startX - nx * halfWidth;
    positions[pOff + 1] = y;
    positions[pOff + 2] = startZ - nz * halfWidth;

    positions[pOff + 3] = startX + nx * halfWidth;
    positions[pOff + 4] = y;
    positions[pOff + 5] = startZ + nz * halfWidth;

    positions[pOff + 6] = endX - nx * halfWidth;
    positions[pOff + 7] = y;
    positions[pOff + 8] = endZ - nz * halfWidth;

    positions[pOff + 9] = endX + nx * halfWidth;
    positions[pOff + 10] = y;
    positions[pOff + 11] = endZ + nz * halfWidth;

    normals[pOff + 1] = 1;
    normals[pOff + 4] = 1;
    normals[pOff + 7] = 1;
    normals[pOff + 10] = 1;

    // Counter-clockwise when viewed from +Y
    indices[iOff] = vOff;
    indices[iOff + 1] = vOff + 1;
    indices[iOff + 2] = vOff + 2;
    indices[iOff + 3] = vOff + 1;
    indices[iOff + 4] = vOff + 3;
    indices[iOff + 5] = vOff + 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  group.clear();
}

export function DeliveryMap3D({
  order,
  route,
  courierState,
  isLoadingRoute,
  routeError,
  onRetryRoute,
  isPlaying,
  onTogglePlay,
  onRestart,
  speedMultiplier,
  onChangeSpeed,
  theme,
  mapMode,
  onChangeMapMode,
  radiusMeters,
  isWithinProximity,
  delayIncident,
  onToggleSimulateDelay,
  focusRequestId,
}: DeliveryMap3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('overview');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [labels, setLabels] = useState<ProjectedLabelsState>({
    origin: HIDDEN_LABEL,
    destination: HIDDEN_LABEL,
    waypoint: HIDDEN_LABEL,
    courier: HIDDEN_LABEL,
  });

  // Compute normalized 3D projection from real Google Maps route polyline
  const projection = useMemo(() => {
    if (!route) return null;
    return createRouteProjection3D(
      route.path,
      route.originPoint,
      route.destinationPoint,
      route.waypointPoint,
      36
    );
  }, [route]);

  const isVan = order.courier.vehicle.toLowerCase().includes('fourgon');

  // Mutable refs read inside the WebGL loop so React updates NEVER tear down the renderer
  const stateRef = useRef({
    theme,
    projection,
    courierState,
    orderId: order.id,
    isVan,
    radiusMeters,
    isWithinProximity,
    cameraPreset,
    hasDelay: Boolean(delayIncident),
    recenterRequested: false,
  });

  stateRef.current = {
    theme,
    projection,
    courierState,
    orderId: order.id,
    isVan,
    radiusMeters,
    isWithinProximity,
    cameraPreset,
    hasDelay: Boolean(delayIncident),
    recenterRequested: stateRef.current.recenterRequested,
  };

  // Focus camera on courier when user clicks "Localiser" in sidebar
  useEffect(() => {
    if (focusRequestId > 0) {
      setCameraPreset('follow');
      stateRef.current.recenterRequested = true;
    }
  }, [focusRequestId]);

  // Reset camera cleanly to overview when switching delivery orders
  useEffect(() => {
    setCameraPreset('overview');
    stateRef.current.recenterRequested = true;
  }, [order.id]);

  // Initialize Three.js WebGL scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const testCanvas = document.createElement('canvas');
      const testGl =
        testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      const isSw = testGl ? detectSoftwareGl(testGl) : false;

      renderer = new THREE.WebGLRenderer({
        antialias: !isSw,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(isSw ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.shadowMap.enabled = !isSw;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch {
      setWebglError(
        'WebGL est indisponible dans ce navigateur. Basculez vers la vue Google Maps 2D.'
      );
      return;
    }

    const gl = renderer.getContext();
    const isSoftwareGl = detectSoftwareGl(gl);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Soft PBR environment map (works smoothly on both GPU and SwiftShader)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.52;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 480);
    const initialZoomOut = width < 640 ? 1.32 : 1.0;
    camera.position.set(4 * initialZoomOut, 62 * initialZoomOut, 76 * initialZoomOut);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minPolarAngle = 0.22;
    controls.minDistance = 12;
    controls.maxDistance = 165;
    controls.target.set(0, 0, 0);
    controls.update();

    // Procedural texture set
    const textures = createProceduralTextureSet(
      renderer.capabilities.getMaxAnisotropy()
    );

    // Three-point architectural outdoor lighting (Day/Night dynamically updated)
    const hemiLight = new THREE.HemisphereLight(0xeef6f2, 0xb8c2ba, 0.9);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4df, 2.2);
    sunLight.position.set(42, 68, 34);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 200;
      const shadowBound = 62;
      sunLight.shadow.camera.left = -shadowBound;
      sunLight.shadow.camera.right = shadowBound;
      sunLight.shadow.camera.top = shadowBound;
      sunLight.shadow.camera.bottom = -shadowBound;
      sunLight.shadow.bias = -0.0006;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x8bc9b5, 0.55);
    rimLight.position.set(-48, 26, -42);
    scene.add(rimLight);

    // Extended Cotonou Ground Plane
    const groundMat = new THREE.MeshStandardMaterial({
      map: textures.terrainLightMap,
      roughnessMap: textures.terrainRoughnessMap,
      roughness: 0.92,
      metalness: 0.04,
    });
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Atlantic Ocean (South coastline of Cotonou) + Fidjrossè Sand Beach Strip
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xe3d3b1,
      roughness: 0.92,
      metalness: 0.02,
    });
    const beachMesh = new THREE.Mesh(new THREE.PlaneGeometry(340, 12), beachMat);
    beachMesh.rotation.x = -Math.PI / 2;
    beachMesh.position.set(0, 0.015, 58);
    scene.add(beachMesh);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1d6878,
      bumpMap: textures.waterBumpMap,
      bumpScale: 0.14,
      roughness: 0.24,
      metalness: 0.32,
    });
    const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(340, 120), waterMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(0, 0.02, 122);
    scene.add(oceanMesh);

    // Lake Nokoué / Cotonou Lagoon (North)
    const lagoonMesh = new THREE.Mesh(new THREE.PlaneGeometry(340, 90), waterMat);
    lagoonMesh.rotation.x = -Math.PI / 2;
    lagoonMesh.position.set(0, 0.02, -108);
    scene.add(lagoonMesh);

    // Scene containers rebuilt cleanly only when the route changes
    const cityGroup = new THREE.Group();
    scene.add(cityGroup);

    const routeGroup = new THREE.Group();
    scene.add(routeGroup);

    const landmarksGroup = new THREE.Group();
    scene.add(landmarksGroup);

    // Shared materials updated dynamically for Day/Night transitions
    const buildingMat = new THREE.MeshStandardMaterial({
      map: textures.buildingLightMap,
      emissiveMap: textures.buildingEmissiveMap,
      emissive: new THREE.Color(0xffd782),
      emissiveIntensity: 0.0,
      roughness: 0.72,
      metalness: 0.08,
    });
    const roofUnitMat = new THREE.MeshStandardMaterial({
      color: 0x9aa49e,
      roughness: 0.65,
      metalness: 0.35,
    });
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x7c5c3e,
      roughness: 0.88,
      metalness: 0.02,
    });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x246b45,
      roughness: 0.68,
      metalness: 0.05,
    });

    const roadBaseMat = new THREE.MeshStandardMaterial({
      color: 0x2a332f,
      roughness: 0.84,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    const traveledMat = new THREE.MeshStandardMaterial({
      color: 0x10885c,
      emissive: 0x0b6b48,
      emissiveIntensity: 0.35,
      roughness: 0.34,
      metalness: 0.14,
      side: THREE.DoubleSide,
    });
    const remainingMat = new THREE.MeshStandardMaterial({
      color: 0xd99b2c,
      emissive: 0xb87d1b,
      emissiveIntensity: 0.3,
      roughness: 0.36,
      metalness: 0.24,
      side: THREE.DoubleSide,
    });

    // Dynamic road ribbon meshes
    const roadBaseMesh = new THREE.Mesh(new THREE.BufferGeometry(), roadBaseMat);
    const traveledMesh = new THREE.Mesh(new THREE.BufferGeometry(), traveledMat);
    const remainingMesh = new THREE.Mesh(new THREE.BufferGeometry(), remainingMat);
    routeGroup.add(roadBaseMesh, traveledMesh, remainingMesh);

    // Animated 3D Geofence Proximity Ring around Destination
    const geofenceGroup = new THREE.Group();
    const geofenceFillMat = new THREE.MeshBasicMaterial({
      color: 0xd99b2c,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geofenceFill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 56),
      geofenceFillMat
    );
    geofenceFill.rotation.x = -Math.PI / 2;
    geofenceFill.position.y = 0.06;

    const geofenceRingMat = new THREE.MeshBasicMaterial({
      color: 0xd99b2c,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geofenceRing = new THREE.Mesh(
      new THREE.RingGeometry(0.955, 1.0, 56),
      geofenceRingMat
    );
    geofenceRing.rotation.x = -Math.PI / 2;
    geofenceRing.position.y = 0.08;
    geofenceGroup.add(geofenceFill, geofenceRing);
    geofenceGroup.visible = false;
    scene.add(geofenceGroup);

    // Courier composite vehicle models (swap visibility between moto and van)
    const motoGroup = createCourierMotoGroup(textures.contactShadowMap);
    const vanGroup = createCourierVanGroup(textures.contactShadowMap);
    const courierRoot = new THREE.Group();
    courierRoot.add(motoGroup, vanGroup);
    courierRoot.visible = false;

    // Subtle ground beacon ring beneath courier for rapid spatial reading
    const courierRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const courierRing = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.85, 32),
      courierRingMat
    );
    courierRing.rotation.x = -Math.PI / 2;
    courierRing.position.y = 0.11;
    courierRoot.add(courierRing);
    scene.add(courierRoot);

    // Night headlight spotlight attached to courier
    const courierLight = new THREE.PointLight(0xffe19c, 0, 14, 1.8);
    courierLight.position.set(0, 1.8, 1.4);
    courierRoot.add(courierLight);

    // Track last built route & theme to avoid redundant geometry rebuilds
    let appliedTheme: ThemeMode | null = null;
    let builtRouteSignature = '';
    let lastTraveledCount = -1;
    let lastRemainingCount = -1;
    let lastProgressHash = -1;
    let beaconOrbs: THREE.Object3D[] = [];

    const applyThemeToScene = (mode: ThemeMode) => {
      const isDark = mode === 'dark';
      const skyHex = isDark ? 0x091110 : 0xdce7e4;
      scene.background = new THREE.Color(skyHex);
      scene.fog = new THREE.FogExp2(skyHex, isDark ? 0.0054 : 0.0044);

      groundMat.map = isDark ? textures.terrainDarkMap : textures.terrainLightMap;
      groundMat.needsUpdate = true;

      beachMat.color.setHex(isDark ? 0x2d322b : 0xe3d3b1);
      waterMat.color.setHex(isDark ? 0x0b2b36 : 0x1e6f80);
      roadBaseMat.color.setHex(isDark ? 0x18211f : 0x2f3934);

      buildingMat.map = isDark
        ? textures.buildingDarkMap
        : textures.buildingLightMap;
      buildingMat.emissiveIntensity = isDark ? 1.15 : 0.0;
      buildingMat.needsUpdate = true;
      roofUnitMat.color.setHex(isDark ? 0x2b3935 : 0x9aa49e);
      frondMat.color.setHex(isDark ? 0x164a32 : 0x246b45);

      traveledMat.color.setHex(isDark ? 0x10b981 : 0x0f7852);
      traveledMat.emissiveIntensity = isDark ? 0.78 : 0.25;
      remainingMat.color.setHex(isDark ? 0xf2b94b : 0xd09222);
      remainingMat.emissiveIntensity = isDark ? 0.65 : 0.22;

      hemiLight.color.setHex(isDark ? 0x456b7d : 0xf2f8f5);
      hemiLight.groundColor.setHex(isDark ? 0x0b1714 : 0xb7c2b9);
      hemiLight.intensity = isDark ? 0.72 : 0.96;

      sunLight.color.setHex(isDark ? 0x89b4d8 : 0xfff3db);
      sunLight.intensity = isDark ? 1.25 : 2.25;
      rimLight.color.setHex(isDark ? 0x34d399 : 0x8bc9b5);
      rimLight.intensity = isDark ? 0.72 : 0.55;

      scene.environmentIntensity = isDark ? 0.34 : 0.55;
      courierLight.intensity = isDark ? 4.8 : 0.4;
      renderer.toneMappingExposure = isDark ? 1.08 : 1.02;
    };

    const rebuildCityAndLandmarks = () => {
      const proj = stateRef.current.projection;
      if (!proj) return;

      // Clear previous instanced city & landmarks
      disposeGroup(cityGroup);
      disposeGroup(landmarksGroup);
      beaconOrbs = [];

      const layout = generateCotonouUrbanLayout(proj, stateRef.current.orderId);

      // Position coastline and lagoon relative to this route's extent
      beachMesh.position.z = layout.oceanZ - 3;
      oceanMesh.position.z = layout.oceanZ + 62;
      lagoonMesh.position.z = layout.lagoonZ - 42;

      // Build InstancedMesh for Cotonou urban buildings
      const buildings = layout.buildings;
      if (buildings.length > 0) {
        const bGeo = new THREE.BoxGeometry(1, 1, 1);
        bGeo.translate(0, 0.5, 0); // bottom-center pivot
        const bInstanced = new THREE.InstancedMesh(
          bGeo,
          buildingMat,
          buildings.length
        );
        bInstanced.castShadow = !isSoftwareGl;
        bInstanced.receiveShadow = !isSoftwareGl;

        const dayTones = [
          new THREE.Color(0xf2f1eb),
          new THREE.Color(0xe6eae5),
          new THREE.Color(0xefe6d8),
          new THREE.Color(0xdde4e0),
          new THREE.Color(0xe8e3d9),
        ];

        const dummy = new THREE.Object3D();
        const roofSpecs: {x: number; y: number; z: number; sx: number; sz: number}[] = [];

        buildings.forEach((b, idx) => {
          dummy.position.set(b.x, 0, b.z);
          dummy.rotation.set(0, b.rotationY, 0);
          dummy.scale.set(b.width, b.height, b.depth);
          dummy.updateMatrix();
          bInstanced.setMatrixAt(idx, dummy.matrix);
          bInstanced.setColorAt(idx, dayTones[b.toneIndex % dayTones.length]);

          if (b.hasRoofUnit) {
            roofSpecs.push({
              x: b.x,
              y: b.height,
              z: b.z,
              sx: b.width * 0.42,
              sz: b.depth * 0.42,
            });
          }
        });
        bInstanced.instanceMatrix.needsUpdate = true;
        if (bInstanced.instanceColor) bInstanced.instanceColor.needsUpdate = true;
        cityGroup.add(bInstanced);

        if (roofSpecs.length > 0) {
          const rGeo = new THREE.BoxGeometry(1, 0.45, 1);
          rGeo.translate(0, 0.225, 0);
          const rInstanced = new THREE.InstancedMesh(
            rGeo,
            roofUnitMat,
            roofSpecs.length
          );
          roofSpecs.forEach((r, idx) => {
            dummy.position.set(r.x, r.y, r.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(r.sx, 1, r.sz);
            dummy.updateMatrix();
            rInstanced.setMatrixAt(idx, dummy.matrix);
          });
          rInstanced.instanceMatrix.needsUpdate = true;
          cityGroup.add(rInstanced);
        }
      }

      // Build InstancedMesh for Cotonou coastal palm trees (trunk + layered palm crown)
      const palms = layout.palms;
      if (palms.length > 0) {
        const trunkGeo = new THREE.CylinderGeometry(0.11, 0.2, 2.7, 7);
        trunkGeo.translate(0, 1.35, 0);
        const trunkInstanced = new THREE.InstancedMesh(
          trunkGeo,
          trunkMat,
          palms.length
        );

        const crownGeo = new THREE.ConeGeometry(1.3, 1.1, 7);
        crownGeo.translate(0, 2.9, 0);
        const crownInstanced = new THREE.InstancedMesh(
          crownGeo,
          frondMat,
          palms.length
        );

        const crownUpperGeo = new THREE.ConeGeometry(0.92, 0.9, 7);
        crownUpperGeo.translate(0, 3.35, 0);
        const crownUpperInstanced = new THREE.InstancedMesh(
          crownUpperGeo,
          frondMat,
          palms.length
        );

        const dummy = new THREE.Object3D();
        palms.forEach((p, idx) => {
          dummy.position.set(p.x, 0, p.z);
          dummy.rotation.set(0, p.rotationY, 0);
          dummy.scale.set(p.scale, p.scale, p.scale);
          dummy.updateMatrix();
          trunkInstanced.setMatrixAt(idx, dummy.matrix);
          crownInstanced.setMatrixAt(idx, dummy.matrix);
          crownUpperInstanced.setMatrixAt(idx, dummy.matrix);
        });
        trunkInstanced.instanceMatrix.needsUpdate = true;
        crownInstanced.instanceMatrix.needsUpdate = true;
        crownUpperInstanced.instanceMatrix.needsUpdate = true;
        cityGroup.add(trunkInstanced, crownInstanced, crownUpperInstanced);
      }

      // Build full asphalt road bed from real projected Google Maps polyline
      roadBaseMesh.geometry.dispose();
      roadBaseMesh.geometry = buildRibbonGeometry(proj.path3D, 1.65, 0.07);

      // Build Composite 3D Landmarks
      const originHub = createOriginHubGroup(textures.contactShadowMap);
      originHub.position.set(proj.origin3D.x, 0, proj.origin3D.z);
      landmarksGroup.add(originHub);

      const destLandmark = createDestinationLandmarkGroup(
        textures.contactShadowMap
      );
      destLandmark.position.set(proj.destination3D.x, 0, proj.destination3D.z);
      landmarksGroup.add(destLandmark);

      if (proj.waypoint3D) {
        const waypointPylon = createWaypointPylonGroup(
          textures.contactShadowMap
        );
        waypointPylon.position.set(proj.waypoint3D.x, 0, proj.waypoint3D.z);
        landmarksGroup.add(waypointPylon);
      }

      landmarksGroup.traverse((obj) => {
        if (obj.name === 'BeaconOrb') {
          beaconOrbs.push(obj);
        }
      });

      // Reset progress ribbon caches
      lastTraveledCount = -1;
      lastRemainingCount = -1;
      lastProgressHash = -1;
    };

    // Projection scratch vector for HTML labels
    const projVec = new THREE.Vector3();
    const smoothTarget = new THREE.Vector3();
    const desiredCamPos = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();

    const projectWorldToScreen = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number
    ): ProjectedLabelPos => {
      projVec.set(x, y, z).project(camera);
      if (projVec.z > 1 || projVec.z < -1) return HIDDEN_LABEL;
      const sx = (projVec.x * 0.5 + 0.5) * w;
      const sy = (-projVec.y * 0.5 + 0.5) * h;
      const visible = sx >= 16 && sx <= w - 16 && sy >= 16 && sy <= h - 16;
      return {x: Math.round(sx), y: Math.round(sy), visible};
    };

    // Frame pacing helper (fenceSync + afterDraw on SwiftShader CPU WebGL)
    const gl2 = gl instanceof WebGL2RenderingContext ? gl : null;
    const afterDraw = (next: () => void) => {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(next);
        return;
      }
      if (!gl2) {
        timerId = window.setTimeout(next, 90);
        return;
      }
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        timerId = window.setTimeout(next, 90);
        return;
      }
      gl2.flush();
      const poll = () => {
        if (disposed) {
          gl2.deleteSync(sync);
          return;
        }
        if (gl2.clientWaitSync(sync, 0, 0) === gl2.TIMEOUT_EXPIRED) {
          timerId = window.setTimeout(poll, 16);
        } else {
          gl2.deleteSync(sync);
          timerId = window.setTimeout(next, 85);
        }
      };
      timerId = window.setTimeout(poll, 16);
    };

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let prevTime = performance.now();
    let labelUpdateTimer = 0;
    let userDragging = false;

    const handleControlStart = () => {
      userDragging = true;
    };
    const handleControlEnd = () => {
      userDragging = false;
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);

    // ResizeObserver for crisp viewport filling + immediate redraw (prevents blank frame on resize)
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nw = Math.max(1, Math.floor(entry.contentRect.width));
      const nh = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.1, (now - prevTime) / 1000);
      prevTime = now;
      const elapsedSec = now * 0.001;

      const cur = stateRef.current;

      // 1. Apply Day/Night lighting and textures if theme changed
      if (appliedTheme !== cur.theme) {
        applyThemeToScene(cur.theme);
        appliedTheme = cur.theme;
      }

      // 2. Rebuild city + landmarks when route changes
      const proj = cur.projection;
      const routeSig = proj
        ? `${cur.orderId}:${proj.path3D.length}:${proj.origin3D.x.toFixed(2)}`
        : '';
      if (proj && routeSig !== builtRouteSignature) {
        rebuildCityAndLandmarks();
        builtRouteSignature = routeSig;
      }

      // 3. Update dual traveled/remaining route ribbons + courier + geofence ring
      let courier3D: Point3D | null = null;
      if (proj && cur.courierState) {
        const cs = cur.courierState;
        const progressBucket = Math.round(cs.progress * 500);
        if (
          progressBucket !== lastProgressHash ||
          cs.traveledPath.length !== lastTraveledCount ||
          cs.remainingPath.length !== lastRemainingCount
        ) {
          const traveled3D = cs.traveledPath.map((p) =>
            projectLatLngTo3D(p, proj)
          );
          const remaining3D = cs.remainingPath.map((p) =>
            projectLatLngTo3D(p, proj)
          );

          traveledMesh.geometry.dispose();
          traveledMesh.geometry = buildRibbonGeometry(traveled3D, 0.95, 0.16);

          remainingMesh.geometry.dispose();
          remainingMesh.geometry = buildDashedRibbonGeometry(
            remaining3D,
            0.78,
            0.15
          );

          lastProgressHash = progressBucket;
          lastTraveledCount = cs.traveledPath.length;
          lastRemainingCount = cs.remainingPath.length;
        }

        // Courier 3D position & heading rotation
        courier3D = projectLatLngTo3D(cs.position, proj);
        courierRoot.visible = true;
        motoGroup.visible = !cur.isVan;
        vanGroup.visible = cur.isVan;

        const lerpAlpha = 1 - Math.exp(-10 * dt);
        if (courierRoot.position.lengthSq() < 0.0001) {
          courierRoot.position.set(courier3D.x, 0.16, courier3D.z);
        } else {
          courierRoot.position.x = THREE.MathUtils.lerp(
            courierRoot.position.x,
            courier3D.x,
            lerpAlpha
          );
          courierRoot.position.z = THREE.MathUtils.lerp(
            courierRoot.position.z,
            courier3D.z,
            lerpAlpha
          );
          courierRoot.position.y = 0.16;
        }

        // Compass heading (0=North=-Z, 90=East=+X, 180=South=+Z, 270=West=-X)
        const headingRad = (cs.heading * Math.PI) / 180;
        const dx = Math.sin(headingRad);
        const dz = -Math.cos(headingRad);
        const targetYaw = Math.atan2(dx, dz);
        let deltaYaw = targetYaw - courierRoot.rotation.y;
        while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
        while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
        courierRoot.rotation.y += deltaYaw * (1 - Math.exp(-10 * dt));

        // Subtle pulse on courier ground ring & color cue for delay/proximity
        const ringPulse = 1 + Math.sin(elapsedSec * 3.6) * 0.12;
        courierRing.scale.set(ringPulse, ringPulse, 1);
        courierRingMat.color.setHex(
          cur.hasDelay ? 0xf59e0b : cur.isWithinProximity ? 0x34d399 : 0x10b981
        );

        // Update 3D Geofence Proximity Ring around destination
        const geoRadiusUnits = metersToSceneUnits(cur.radiusMeters, proj);
        geofenceGroup.visible = true;
        geofenceGroup.position.set(
          proj.destination3D.x,
          0,
          proj.destination3D.z
        );
        geofenceGroup.scale.set(geoRadiusUnits, 1, geoRadiusUnits);
        const ringHex = cur.isWithinProximity ? 0x10b981 : 0xd99b2c;
        geofenceFillMat.color.setHex(ringHex);
        geofenceRingMat.color.setHex(ringHex);
        geofenceFillMat.opacity = cur.isWithinProximity
          ? 0.16 + Math.sin(elapsedSec * 3.0) * 0.04
          : 0.09;
      } else {
        courierRoot.visible = false;
        geofenceGroup.visible = false;
      }

      // 4. Subtle ambient animation (beacon hover + water drift)
      textures.waterBumpMap.offset.y = (elapsedSec * 0.03) % 1;
      for (const orb of beaconOrbs) {
        orb.rotation.y = elapsedSec * 1.1;
      }

      // 5. Camera presets with smooth exponential damping
      if (proj && !userDragging) {
        const camAlpha = 1 - Math.exp(-4.5 * dt);
        if (cur.cameraPreset === 'follow' && courier3D) {
          desiredTarget.set(courierRoot.position.x, 1.0, courierRoot.position.z);
          desiredCamPos.set(
            courierRoot.position.x + 14,
            18,
            courierRoot.position.z + 20
          );
          controls.target.lerp(desiredTarget, camAlpha);
          camera.position.lerp(desiredCamPos, camAlpha);
        } else if (cur.cameraPreset === 'street' && courier3D) {
          const yaw = courierRoot.rotation.y;
          const backX = -Math.sin(yaw) * 12;
          const backZ = -Math.cos(yaw) * 12;
          desiredTarget.set(
            courierRoot.position.x + Math.sin(yaw) * 6,
            1.4,
            courierRoot.position.z + Math.cos(yaw) * 6
          );
          desiredCamPos.set(
            courierRoot.position.x + backX,
            6.8,
            courierRoot.position.z + backZ
          );
          controls.target.lerp(desiredTarget, camAlpha);
          camera.position.lerp(desiredCamPos, camAlpha);
        } else if (cur.recenterRequested) {
          const aspectScale = camera.aspect < 1.15 ? 1.28 : 1.0;
          smoothTarget.set(0, 0, 0);
          desiredCamPos.set(4 * aspectScale, 62 * aspectScale, 76 * aspectScale);
          controls.target.lerp(smoothTarget, camAlpha * 1.4);
          camera.position.lerp(desiredCamPos, camAlpha * 1.4);
          if (camera.position.distanceTo(desiredCamPos) < 0.8) {
            cur.recenterRequested = false;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      // 6. Throttle projected HTML label updates (~10 Hz to keep React ultra-quiet)
      labelUpdateTimer += dt;
      if (proj && labelUpdateTimer >= 0.1) {
        labelUpdateTimer = 0;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        setLabels({
          origin: projectWorldToScreen(
            proj.origin3D.x,
            6.2,
            proj.origin3D.z,
            cw,
            ch
          ),
          destination: projectWorldToScreen(
            proj.destination3D.x,
            6.8,
            proj.destination3D.z,
            cw,
            ch
          ),
          waypoint: proj.waypoint3D
            ? projectWorldToScreen(
                proj.waypoint3D.x,
                4.2,
                proj.waypoint3D.z,
                cw,
                ch
              )
            : HIDDEN_LABEL,
          courier: courierRoot.visible
            ? projectWorldToScreen(
                courierRoot.position.x,
                3.1,
                courierRoot.position.z,
                cw,
                ch
              )
            : HIDDEN_LABEL,
        });
      }

      afterDraw(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('end', handleControlEnd);
      controls.dispose();

      disposeGroup(cityGroup);
      disposeGroup(landmarksGroup);
      disposeGroup(courierRoot);
      roadBaseMesh.geometry.dispose();
      traveledMesh.geometry.dispose();
      remainingMesh.geometry.dispose();
      groundMesh.geometry.dispose();
      beachMesh.geometry.dispose();
      oceanMesh.geometry.dispose();
      lagoonMesh.geometry.dispose();
      geofenceFill.geometry.dispose();
      geofenceRing.geometry.dispose();

      groundMat.dispose();
      beachMat.dispose();
      waterMat.dispose();
      buildingMat.dispose();
      roofUnitMat.dispose();
      trunkMat.dispose();
      frondMat.dispose();
      roadBaseMat.dispose();
      traveledMat.dispose();
      remainingMat.dispose();
      geofenceFillMat.dispose();
      geofenceRingMat.dispose();
      courierRingMat.dispose();

      textures.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSetCameraPreset = (preset: CameraPreset3D) => {
    setCameraPreset(preset);
    if (preset === 'overview') {
      stateRef.current.recenterRequested = true;
    }
  };

  const adjustedRemainingMs =
    courierState && courierState.phase !== 'delivered'
      ? courierState.remainingMillis +
        (delayIncident?.extraMinutes ?? 0) * 60_000
      : 0;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#DCE7E4] dark:bg-[#091110]"
      data-testid="cotonou-3d-stage"
    >
      {/* Dedicated isolated WebGL canvas container (no sibling React children inside!) */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected 3D Spatial Landmarks Labels (solid/rgba surfaces — zero backdrop-filter over WebGL) */}
      {!webglError && route && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden z-10"
        >
          {labels.origin.visible && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full px-2 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap shadow-md bg-white/95 text-[#0F3D2E] border-[#0F3D2E]/30 dark:bg-[#111E1A]/95 dark:text-[#6EE7B7] dark:border-[#34D399]/35"
              style={{left: `${labels.origin.x}px`, top: `${labels.origin.y}px`}}
            >
              Départ · {order.origin.label}
            </div>
          )}

          {labels.waypoint.visible && order.waypoint && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md border text-[10px] font-medium whitespace-nowrap shadow-sm bg-white/90 text-[#2B3731] border-[#CBD5CF] dark:bg-[#111E1A]/90 dark:text-[#CBD5CE] dark:border-[#2C3E37]"
              style={{
                left: `${labels.waypoint.x}px`,
                top: `${labels.waypoint.y}px`,
              }}
            >
              {order.waypoint.label}
            </div>
          )}

          {labels.destination.visible && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full px-2 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap shadow-md bg-[#111815]/95 text-[#F6E3B6] border-[#C48B28]/60 dark:bg-[#0E1714]/95 dark:text-[#FCD34D] dark:border-[#D99B2C]/60"
              style={{
                left: `${labels.destination.x}px`,
                top: `${labels.destination.y}px`,
              }}
            >
              Livraison · {order.destination.label}
            </div>
          )}

          {labels.courier.visible && courierState && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap shadow-md bg-[#0F3D2E]/95 text-white border-[#34D399]/60"
              style={{
                left: `${labels.courier.x}px`,
                top: `${labels.courier.y}px`,
              }}
            >
              {order.courier.name} ·{' '}
              <span className="font-mono tabular-nums">
                {formatDistanceFr(courierState.remainingMeters)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Top-Left Compact 3D Legend (solid/rgba surface, no backdrop-filter) */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 bg-white/95 dark:bg-[#111916]/95 border border-[#DFE4E0] dark:border-[#25332D] rounded-lg px-2.5 sm:px-3 py-1.5 shadow-sm flex items-center gap-x-3 text-xs text-[#2B3731] dark:text-[#D7E0DC]">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="w-3.5 h-1 rounded-full bg-[#10885C] dark:bg-[#34D399]"
          />
          <span className="sm:hidden">Parcouru</span>
          <span className="hidden sm:inline">Parcouru</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="w-3.5 h-0 border-t-2 border-dashed border-[#C48B28] dark:border-[#F2B94B]"
          />
          <span className="sm:hidden">Restant</span>
          <span className="hidden sm:inline">Restant</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 whitespace-nowrap pl-2 border-l border-[#E3E7E4] dark:border-[#25332D]">
          <span
            aria-hidden="true"
            className={cn(
              'w-2.5 h-2.5 rounded-full border-2',
              isWithinProximity
                ? 'border-[#10B981] bg-[#10B981]/25'
                : 'border-[#C48B28] bg-[#C48B28]/20'
            )}
          />
          <span className="font-mono tabular-nums">
            Zone {formatDistanceFr(radiusMeters)}
          </span>
        </div>
      </div>

      {/* Top-Right View Mode Switcher (3D / Google Maps 2D) */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5">
        <div
          role="group"
          aria-label="Mode d'affichage de la carte"
          className="flex items-center p-0.5 rounded-lg bg-white/95 dark:bg-[#111916]/95 border border-[#DFE4E0] dark:border-[#25332D] shadow-sm"
        >
          <button
            type="button"
            onClick={() => onChangeMapMode('3d')}
            aria-pressed={mapMode === '3d'}
            className={cn(
              'h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
              mapMode === '3d'
                ? 'bg-[#0F3D2E] text-white dark:bg-[#10B981] dark:text-[#071510]'
                : 'text-[#5A6760] dark:text-[#9AA8A1] hover:text-[#111815] dark:hover:text-white'
            )}
          >
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Vue 3D</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMapMode('2d')}
            aria-pressed={mapMode === '2d'}
            className={cn(
              'h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
              mapMode === '2d'
                ? 'bg-[#0F3D2E] text-white dark:bg-[#10B981] dark:text-[#071510]'
                : 'text-[#5A6760] dark:text-[#9AA8A1] hover:text-[#111815] dark:hover:text-white'
            )}
          >
            <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Maps 2D</span>
          </button>
        </div>
      </div>

      {/* Consolidated Collapsible Bottom 3D Dock (<=15% footprint, solid/rgba surface, zero backdrop-filter) */}
      {route && courierState && !webglError && (
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-20 flex flex-col items-center">
          {dockCollapsed ? (
            <button
              type="button"
              onClick={() => setDockCollapsed(false)}
              className="h-9 px-3.5 rounded-lg bg-white/95 dark:bg-[#111916]/95 border border-[#DFE4E0] dark:border-[#25332D] text-xs font-medium text-[#111815] dark:text-[#EEF2F0] shadow-md flex items-center gap-2 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Contrôles 3D</span>
              <span className="font-mono tabular-nums text-[#0F6B4B] dark:text-[#34D399]">
                {Math.round(courierState.progress * 100)}%
              </span>
            </button>
          ) : (
            <div className="w-full sm:w-auto bg-white/96 dark:bg-[#111916]/96 border border-[#DFE4E0] dark:border-[#25332D] rounded-xl px-2.5 sm:px-3 py-2 shadow-lg flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2">
              {/* Playback controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={
                    isPlaying
                      ? 'Mettre en pause le déplacement du livreur'
                      : 'Reprendre le déplacement du livreur'
                  }
                  className="h-8 px-2.5 rounded-lg bg-[#0F3D2E] hover:bg-[#0B2E22] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#071510] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Simuler</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onRestart}
                  aria-label="Revenir au départ"
                  className="h-8 w-8 rounded-lg border border-[#DFE4E0] dark:border-[#25332D] text-[#2B3731] dark:text-[#D7E0DC] hover:bg-[#F3F5F3] dark:hover:bg-[#1A2622] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                <div
                  role="group"
                  aria-label="Vitesse de simulation"
                  className="flex items-center p-0.5 bg-[#F2F4F2] dark:bg-[#1A2521] rounded-lg shrink-0"
                >
                  {([1, 2, 4] as const).map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => onChangeSpeed(speed)}
                      aria-pressed={speedMultiplier === speed}
                      className={cn(
                        'px-2 py-1 text-xs font-mono tabular-nums font-medium rounded-md transition-colors cursor-pointer',
                        speedMultiplier === speed
                          ? 'bg-white dark:bg-[#273832] text-[#0F3D2E] dark:text-[#6EE7B7] shadow-xs'
                          : 'text-[#5A6760] dark:text-[#96A59E] hover:text-[#111815] dark:hover:text-white'
                      )}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera presets */}
              <div
                role="group"
                aria-label="Angles de caméra 3D"
                className="hidden sm:flex items-center gap-1 pl-2 border-l border-[#E3E7E4] dark:border-[#25332D]"
              >
                {(
                  [
                    {id: 'overview', label: 'Global', Icon: Eye},
                    {id: 'follow', label: 'Suivre', Icon: Crosshair},
                    {id: 'street', label: 'Rue', Icon: Compass},
                  ] as const
                ).map(({id, label, Icon}) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSetCameraPreset(id)}
                    aria-pressed={cameraPreset === id}
                    className={cn(
                      'h-8 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap',
                      cameraPreset === id
                        ? 'bg-[#EEF3F0] dark:bg-[#1D322A] text-[#0F3D2E] dark:text-[#6EE7B7]'
                        : 'text-[#5A6760] dark:text-[#9AA8A1] hover:text-[#111815] dark:hover:text-white'
                    )}
                  >
                    <Icon className="w-3 h-3" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Delay simulation trigger & ETA */}
              <div className="flex items-center gap-2 pl-2 border-l border-[#E3E7E4] dark:border-[#25332D]">
                <button
                  type="button"
                  onClick={onToggleSimulateDelay}
                  aria-pressed={Boolean(delayIncident)}
                  className={cn(
                    'h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border',
                    delayIncident
                      ? 'bg-[#FEF3C7] dark:bg-[#3A280A] text-[#92400E] dark:text-[#FCD34D] border-[#F59E0B]/50'
                      : 'bg-white dark:bg-[#17221E] text-[#5A6760] dark:text-[#B4C0BA] border-[#DFE4E0] dark:border-[#25332D] hover:text-[#111815] dark:hover:text-white'
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">
                    {delayIncident
                      ? `Retard +${delayIncident.extraMinutes} min`
                      : 'Simuler retard'}
                  </span>
                  <span className="md:hidden">
                    {delayIncident ? `+${delayIncident.extraMinutes}m` : 'Retard'}
                  </span>
                </button>

                <span className="hidden lg:inline text-xs font-mono tabular-nums text-[#2B3731] dark:text-[#D7E0DC] whitespace-nowrap">
                  {formatDurationFr(adjustedRemainingMs)}
                </span>

                <button
                  type="button"
                  onClick={() => setDockCollapsed(true)}
                  aria-label="Réduire la barre de contrôles 3D"
                  className="h-8 w-7 rounded-md text-[#5A6760] dark:text-[#9AA8A1] hover:bg-[#F2F4F2] dark:hover:bg-[#1C2A25] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Route Overlay */}
      {isLoadingRoute && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-30 bg-[#DCE7E4]/75 dark:bg-[#091110]/75 flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="bg-white dark:bg-[#111916] border border-[#DFE4E0] dark:border-[#25332D] rounded-xl px-5 py-3.5 shadow-sm flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-[#0F3D2E] dark:border-[#34D399] border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-[#111815] dark:text-[#EEF2F0]">
              Génération de la carte 3D de Cotonou…
            </span>
          </div>
        </div>
      )}

      {/* WebGL or Route Error State */}
      {(webglError || (!isLoadingRoute && routeError)) && (
        <div
          role="alert"
          className="absolute inset-x-4 bottom-20 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 max-w-md bg-white dark:bg-[#111916] border border-[#E5C5C5] dark:border-[#5C2B2B] rounded-xl p-4 shadow-md"
        >
          <p className="text-sm font-semibold text-[#8A1F1F] dark:text-[#FCA5A5]">
            {webglError ? 'Vue 3D indisponible' : 'Itinéraire indisponible'}
          </p>
          <p className="text-xs text-[#5A6760] dark:text-[#9AA8A1] mt-1 leading-relaxed">
            {webglError ?? routeError}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {routeError && (
              <button
                type="button"
                onClick={onRetryRoute}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#0F3D2E] hover:bg-[#0B2E22] rounded-lg transition-colors cursor-pointer"
              >
                Réessayer
              </button>
            )}
            <button
              type="button"
              onClick={() => onChangeMapMode('2d')}
              className="px-3.5 py-1.5 text-xs font-medium text-[#111815] dark:text-[#EEF2F0] border border-[#DFE4E0] dark:border-[#25332D] rounded-lg hover:bg-[#F3F5F3] dark:hover:bg-[#1A2622] transition-colors cursor-pointer"
            >
              Passer en Maps 2D
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
