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

const METERS_PER_DEG_LAT = 111_320;

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

  for (const pt of [...safePath, originPoint, destinationPoint, ...(waypointPoint ? [waypointPoint] : [])]) {
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

