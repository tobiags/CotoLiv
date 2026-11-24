import type {LatLngPoint} from '../types/delivery';

export interface Point3D {
  x: number;
  z: number;
}

export interface RouteProjection3D {
  center: LatLngPoint;
  metersPerUnit: number;
  scaleToScene: number;
  sceneRadius: number;
  metersPerDegLat: number;
  metersPerDegLng: number;
  path3D: Point3D[];
  origin3D: Point3D;
  destination3D: Point3D;
  waypoint3D?: Point3D;
}

export interface UrbanBuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotationY: number;
  toneIndex: number;
  hasRoofUnit: boolean;
}

export interface PalmTreeSpec {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

const METERS_PER_DEG_LAT = 111_320;

/**
 * Deterministic PRNG (Mulberry32) so Cotonou's 3D urban blocks stay consistent
 * across re-renders for a given delivery route.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Projects real Google Maps Lat/Lng points from Cotonou into a centered Three.js
 * XZ plane (East = +X, South = +Z, North = -Z) fitted cleanly within targetRadius.
 */
export function createRouteProjection3D(
  path: LatLngPoint[],
  originPoint: LatLngPoint,
  destinationPoint: LatLngPoint,
  waypointPoint?: LatLngPoint,
  targetRadius = 38
): RouteProjection3D {
  const safePath =
    path.length > 0 ? path : [originPoint, destinationPoint];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const pt of safePath) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  const center: LatLngPoint = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const metersPerDegLng =
    METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);

  const spanMetersX = Math.max(400, (maxLng - minLng) * metersPerDegLng);
  const spanMetersZ = Math.max(400, (maxLat - minLat) * METERS_PER_DEG_LAT);
  const maxHalfSpanMeters = Math.max(spanMetersX, spanMetersZ) / 2;

  // Map the route so its largest half-extent fits targetRadius scene units
  const metersPerUnit = Math.max(12, maxHalfSpanMeters / targetRadius);
  const scaleToScene = 1 / metersPerUnit;

  const project = (pt: LatLngPoint): Point3D => ({
    x: (pt.lng - center.lng) * metersPerDegLng * scaleToScene,
    z: -(pt.lat - center.lat) * METERS_PER_DEG_LAT * scaleToScene,
  });

  const path3D = safePath.map(project);

  return {
    center,
    metersPerUnit,
    scaleToScene,
    sceneRadius: targetRadius,
    metersPerDegLat: METERS_PER_DEG_LAT,
    metersPerDegLng,
    path3D,
    origin3D: project(originPoint),
    destination3D: project(destinationPoint),
    waypoint3D: waypointPoint ? project(waypointPoint) : undefined,
  };
}

export function projectLatLngTo3D(
  pt: LatLngPoint,
  projection: RouteProjection3D
): Point3D {
  return {
    x: (pt.lng - projection.center.lng) * projection.metersPerDegLng * projection.scaleToScene,
    z: -(pt.lat - projection.center.lat) * projection.metersPerDegLat * projection.scaleToScene,
  };
}

export function metersToSceneUnits(
  meters: number,
  projection: RouteProjection3D
): number {
  return Math.max(0.5, meters * projection.scaleToScene);
}

/**
 * Shortest squared distance from point (px, pz) to segment AB on XZ plane.
 */
export function pointToSegmentDistSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) {
    const ox = px - ax;
    const oz = pz - az;
    return ox * ox + oz * oz;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const projX = ax + t * dx;
  const projZ = az + t * dz;
  const rx = px - projX;
  const rz = pz - projZ;
  return rx * rx + rz * rz;
}

export function minDistanceToPolyline(
  px: number,
  pz: number,
  polyline: Point3D[]
): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return Math.hypot(px - polyline[0].x, pz - polyline[0].z);
  }
  let bestSq = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dSq = pointToSegmentDistSq(
      px,
      pz,
      polyline[i].x,
      polyline[i].z,
      polyline[i + 1].x,
      polyline[i + 1].z
    );
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
}

/**
 * Generates procedural Cotonou urban architecture blocks and coastal palm trees
 * strictly outside the active road corridor and landmark footprints so nothing
 * ever clips through the route, courier, or origin/destination structures.
 */
export function generateCotonouUrbanLayout(
  projection: RouteProjection3D,
  seedKey: string
): {
  buildings: UrbanBuildingSpec[];
  palms: PalmTreeSpec[];
  oceanZ: number;
  lagoonZ: number;
} {
  const rng = mulberry32(hashStringToSeed(seedKey));
  const buildings: UrbanBuildingSpec[] = [];
  const palms: PalmTreeSpec[] = [];

  // Cotonou sits between Lake Nokoué (North -> negative Z) and the Atlantic Ocean (South -> positive Z)
  const oceanZ = projection.sceneRadius + 24;
  const lagoonZ = -(projection.sceneRadius + 26);

  // Sample route points to keep distance checks fast
  const sampledPath: Point3D[] = [];
  const step = Math.max(1, Math.floor(projection.path3D.length / 80));
  for (let i = 0; i < projection.path3D.length; i += step) {
    sampledPath.push(projection.path3D[i]);
  }
  if (projection.path3D.length > 0) {
    sampledPath.push(projection.path3D[projection.path3D.length - 1]);
  }

  const landmarks: Point3D[] = [projection.origin3D, projection.destination3D];
  if (projection.waypoint3D) landmarks.push(projection.waypoint3D);

  const roadClearance = 4.6;
  const landmarkClearance = 7.2;

  const isClearForBuilding = (x: number, z: number, halfFootprint: number): boolean => {
    // Keep away from the Atlantic coastline and northern lagoon
    if (z > oceanZ - 7.5 || z < lagoonZ + 7.5) return false;
    for (const lm of landmarks) {
      if (Math.hypot(x - lm.x, z - lm.z) < landmarkClearance + halfFootprint) {
        return false;
      }
    }
    const roadDist = minDistanceToPolyline(x, z, sampledPath);
    if (roadDist < roadClearance + halfFootprint) return false;
    return true;
  };

  // Structured urban grid blocks around the Cotonou corridor (like Haie Vive / Ganhi / Cadjèhoun)
  const gridRange = projection.sceneRadius + 16;
  const cellSize = 6.2;

  for (let gx = -gridRange; gx <= gridRange; gx += cellSize) {
    for (let gz = lagoonZ + 10; gz <= oceanZ - 10; gz += cellSize) {
      // Leave natural avenues every 4 cells
      const ix = Math.round(gx / cellSize);
      const iz = Math.round(gz / cellSize);
      if (Math.abs(ix) % 5 === 0 || Math.abs(iz) % 5 === 0) continue;

      const jitterX = (rng() - 0.5) * 1.4;
      const jitterZ = (rng() - 0.5) * 1.4;
      const x = gx + jitterX;
      const z = gz + jitterZ;

      // Taper density softly at outer perimeter
      const radialDist = Math.hypot(x, z);
      if (radialDist > gridRange + 8) continue;
      if (rng() < 0.28) continue;

      const width = 2.0 + rng() * 2.4;
      const depth = 2.0 + rng() * 2.4;
      const halfFootprint = Math.hypot(width, depth) * 0.5;

      if (!isClearForBuilding(x, z, halfFootprint)) continue;

      // Taller modern commercial buildings near Ganhi/center, lower residential villas near the coast
      const centerWeight = Math.max(0, 1 - radialDist / (projection.sceneRadius + 12));
      const baseHeight = 1.6 + rng() * 3.8 + centerWeight * rng() * 5.2;
      const height = z > oceanZ - 16 ? Math.min(baseHeight, 3.6) : baseHeight;

      buildings.push({
        x,
        z,
        width,
        depth,
        height,
        rotationY: (Math.floor(rng() * 4) * Math.PI) / 2 + (rng() - 0.5) * 0.08,
        toneIndex: Math.floor(rng() * 5),
        hasRoofUnit: height > 4.2 && rng() > 0.45,
      });
    }
  }

  // Coastal & boulevard tropical palm trees (Fidjrossè / Boulevard de la Marina aesthetic)
  for (let i = 0; i < 130; i++) {
    const isCoastal = i < 55;
    const x = (rng() - 0.5) * (gridRange * 2.1);
    const z = isCoastal
      ? oceanZ - 5.8 + (rng() - 0.5) * 3.4
      : lagoonZ + 10 + rng() * (oceanZ - lagoonZ - 18);

    const roadDist = minDistanceToPolyline(x, z, sampledPath);
    if (roadDist < 2.8) continue;
    if (!isCoastal && roadDist > 11 && rng() > 0.35) continue;

    let overlapsLandmark = false;
    for (const lm of landmarks) {
      if (Math.hypot(x - lm.x, z - lm.z) < 5.5) {
        overlapsLandmark = true;
        break;
      }
    }
    if (overlapsLandmark) continue;

    let overlapsBuilding = false;
    for (const b of buildings) {
      if (Math.abs(x - b.x) < b.width * 0.65 + 0.9 && Math.abs(z - b.z) < b.depth * 0.65 + 0.9) {
        overlapsBuilding = true;
        break;
      }
    }
    if (overlapsBuilding) continue;

    palms.push({
      x,
      z,
      scale: 0.78 + rng() * 0.52,
      rotationY: rng() * Math.PI * 2,
    });
  }

  return {buildings, palms, oceanZ, lagoonZ};
}

export interface DashSegment3D {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  nx: number;
  nz: number;
}

const DASH_EPS = 1e-4;
const MAX_DASH_SEGMENTS = 12_000;

/**
 * Splits a 3D XZ polyline into dashed ribbon quads with strict floating-point
 * progression guards so sub-ULP remainders or invalid coordinates can never
 * trigger an infinite loop or array length overflow.
 */
export function computeDashedRibbonSegments(
  points: Point3D[],
  dashLength = 1.8,
  gapLength = 1.05
): DashSegment3D[] {
  if (
    points.length < 2 ||
    !Number.isFinite(dashLength) ||
    !Number.isFinite(gapLength) ||
    dashLength <= DASH_EPS ||
    gapLength <= DASH_EPS
  ) {
    return [];
  }

  const cycle = dashLength + gapLength;
  const segments: DashSegment3D[] = [];
  let distAcc = 0;

  for (
    let i = 0;
    i < points.length - 1 && segments.length < MAX_DASH_SEGMENTS;
    i++
  ) {
    const a = points[i];
    const b = points[i + 1];
    if (
      !Number.isFinite(a.x) ||
      !Number.isFinite(a.z) ||
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.z)
    ) {
      continue;
    }

    const segDx = b.x - a.x;
    const segDz = b.z - a.z;
    const segLen = Math.hypot(segDx, segDz);
    if (!Number.isFinite(segLen) || segLen < 0.05) continue;

    const tx = segDx / segLen;
    const tz = segDz / segLen;
    const nx = -tz;
    const nz = tx;

    const minAdvance = Math.max(DASH_EPS, segLen * 1e-6);
    const maxIters = Math.min(
      MAX_DASH_SEGMENTS,
      Math.ceil(segLen / cycle) * 4 + 8
    );

    let walked = 0;
    let iter = 0;
    while (
      walked + DASH_EPS < segLen &&
      iter++ < maxIters &&
      segments.length < MAX_DASH_SEGMENTS
    ) {
      const rawPhase = (distAcc + walked) % cycle;
      const phase = rawPhase < 0 ? rawPhase + cycle : rawPhase;

      if (phase + DASH_EPS < dashLength) {
        const dashRem = dashLength - phase;
        const step = Math.min(dashRem, segLen - walked);
        const nextWalked = Math.min(segLen, walked + Math.max(step, minAdvance));
        if (nextWalked - walked >= DASH_EPS) {
          segments.push({
            startX: a.x + tx * walked,
            startZ: a.z + tz * walked,
            endX: a.x + tx * nextWalked,
            endZ: a.z + tz * nextWalked,
            nx,
            nz,
          });
        }
        walked = nextWalked;
      } else {
        const gapRem = cycle - phase;
        const step = Math.min(gapRem, segLen - walked);
        walked = Math.min(segLen, walked + Math.max(step, minAdvance));
      }
    }

    distAcc += segLen;
  }

  return segments;
}

