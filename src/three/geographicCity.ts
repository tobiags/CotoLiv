import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {MapGeography} from '../utils/mapGeography';
import {projectLatLngTo3D, type RouteProjection3D} from '../utils/geoTo3D';

/** Coordinates and heights use the same metric scale as the route; holes remain empty. */
export function createGeographicCity(data: MapGeography, projection: RouteProjection3D): THREE.Group {
  const group = new THREE.Group();
  const buckets: Record<string, THREE.BufferGeometry[]> = {building: [], estimated: [], water: [], green: [], road: [], shore: []};
  for (const polygon of data.polygons) {
    const rings = polygon.rings.map(ring => ring.map(point => {
      const {x, z} = projectLatLngTo3D(point, projection);
      return new THREE.Vector2(x, -z);
    }));
    const shape = new THREE.Shape(rings[0]);
    shape.holes = rings.slice(1).map(ring => new THREE.Path(ring));
    const isBuilding = polygon.kind === 'building';
    const geometry = isBuilding
      ? new THREE.ExtrudeGeometry(shape, {depth: (polygon.height - polygon.minHeight) * projection.scaleToScene, bevelEnabled: false, steps: 1, curveSegments: 1})
      : new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, isBuilding ? polygon.minHeight * projection.scaleToScene + 0.025 : 0.02, 0);
    // Normalize attributes for batching indexed flat surfaces with extruded solids.
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    buckets[isBuilding && polygon.estimated ? 'estimated' : polygon.kind].push(flat);
  }
  for (const line of data.lines) {
    const points = line.points.map(p => projectLatLngTo3D(p, projection));
    const vertices: number[] = [];
    const halfWidth = line.width * projection.scaleToScene / 2;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (!length) continue;
      const nx = -(b.z - a.z) / length * halfWidth;
      const nz = (b.x - a.x) / length * halfWidth;
      vertices.push(a.x - nx, 0.035, a.z - nz, a.x + nx, 0.035, a.z + nz, b.x - nx, 0.035, b.z - nz,
        a.x + nx, 0.035, a.z + nz, b.x + nx, 0.035, b.z + nz, b.x - nx, 0.035, b.z - nz);
    }
    if (!vertices.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
    buckets[line.kind].push(geometry);
  }
  const colors: Record<string, number> = {building: 0xb7a78d, estimated: 0x82919c, water: 0x337f98, green: 0x75976c, road: 0x626970, shore: 0x337f98};
  for (const [kind, geometries] of Object.entries(buckets)) {
    if (!geometries.length) continue;
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({color: colors[kind], roughness: 0.9, side: THREE.DoubleSide}));
    mesh.name = kind;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
