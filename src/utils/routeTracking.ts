import type {
  DeliveryPhase,
  InterpolatedCourierState,
  LatLngPoint,
} from '../types/delivery';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Great-circle distance in meters between two geographic coordinates using the Haversine formula.
 */
export function haversineDistanceMeters(
  a: LatLngPoint,
  b: LatLngPoint
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Forward compass bearing in degrees [0, 360) from point A to point B.
 * Used to rotate the courier marker cleanly along the Cotonou street direction.
 */
export function calculateBearing(a: LatLngPoint, b: LatLngPoint): number {
  if (a.lat === b.lat && a.lng === b.lng) return 0;

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Computes cumulative segment distances (in meters) along a polyline path.
 */
export function computeCumulativeDistances(path: LatLngPoint[]): number[] {
  if (path.length === 0) return [];
  const cumulative = [0];
  let total = 0;

  for (let i = 1; i < path.length; i++) {
    total += haversineDistanceMeters(path[i - 1], path[i]);
    cumulative.push(total);
  }
  return cumulative;
}

/**
 * Clamps progress strictly to [0, 1].
 */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Maps a normalized progress ratio to a human-meaningful delivery phase.
 */
export function getDeliveryPhase(progress: number): DeliveryPhase {
  const p = clampProgress(progress);
  if (p >= 0.995) return 'delivered';
  if (p >= 0.82) return 'arriving';
  if (p <= 0.04) return 'departed';
  return 'en_route';
}

/**
 * Splits a road polyline into "traveled" (where the courier came from) and
 * "remaining" (where the courier is heading), while computing exact interpolated
 * coordinates, street heading, distances, and remaining duration.
 */
export function interpolateCourierState(
  path: LatLngPoint[],
  rawProgress: number,
  totalDistanceMeters: number,
  totalDurationMillis: number
): InterpolatedCourierState | null {
  if (path.length === 0) return null;

  const progress = clampProgress(rawProgress);
  const phase = getDeliveryPhase(progress);

  if (path.length === 1) {
    return {
      position: path[0],
      heading: 0,
      progress,
      traveledPath: [path[0]],
      remainingPath: [path[0]],
      traveledMeters: Math.round(totalDistanceMeters * progress),
      remainingMeters: Math.round(totalDistanceMeters * (1 - progress)),
      remainingMillis: Math.round(totalDurationMillis * (1 - progress)),
      phase,
    };
  }

  const cumulative = computeCumulativeDistances(path);
  const geometricTotal = cumulative[cumulative.length - 1];
  const effectiveDistance =
    totalDistanceMeters > 0 ? totalDistanceMeters : geometricTotal;

  if (progress <= 0 || geometricTotal === 0) {
    return {
      position: path[0],
      heading: calculateBearing(path[0], path[1]),
      progress: 0,
      traveledPath: [path[0]],
      remainingPath: [...path],
      traveledMeters: 0,
      remainingMeters: Math.round(effectiveDistance),
      remainingMillis: Math.round(totalDurationMillis),
      phase,
    };
  }

  if (progress >= 1) {
    const lastIdx = path.length - 1;
    return {
      position: path[lastIdx],
      heading: calculateBearing(path[lastIdx - 1], path[lastIdx]),
      progress: 1,
      traveledPath: [...path],
      remainingPath: [path[lastIdx]],
      traveledMeters: Math.round(effectiveDistance),
      remainingMeters: 0,
      remainingMillis: 0,
      phase,
    };
  }

  const targetDist = geometricTotal * progress;
  let segIndex = 0;

  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i] >= targetDist) {
      segIndex = i - 1;
      break;
    }
  }

  const segStartDist = cumulative[segIndex];
  const segEndDist = cumulative[segIndex + 1];
  const segLen = segEndDist - segStartDist;
  const localRatio = segLen > 0 ? (targetDist - segStartDist) / segLen : 0;

  const startPt = path[segIndex];
  const endPt = path[segIndex + 1];

  const position: LatLngPoint = {
    lat: startPt.lat + (endPt.lat - startPt.lat) * localRatio,
    lng: startPt.lng + (endPt.lng - startPt.lng) * localRatio,
  };

  const heading = calculateBearing(startPt, endPt);
  const traveledPath = [...path.slice(0, segIndex + 1), position];
  const remainingPath = [position, ...path.slice(segIndex + 1)];

  const traveledMeters = Math.round(effectiveDistance * progress);
  const remainingMeters = Math.max(
    0,
    Math.round(effectiveDistance - traveledMeters)
  );
  const remainingMillis = Math.max(
    0,
    Math.round(totalDurationMillis * (1 - progress))
  );

  return {
    position,
    heading,
    progress,
    traveledPath,
    remainingPath,
    traveledMeters,
    remainingMeters,
    remainingMillis,
    phase,
  };
}

/**
 * Formats distances idiomatically in French (e.g., "850 m", "4,2 km").
 */
export function formatDistanceFr(meters: number): string {
  const safeMeters = Math.max(0, Math.round(meters));
  if (safeMeters < 1000) {
    return `${safeMeters} m`;
  }
  const km = (safeMeters / 1000).toFixed(1).replace('.', ',');
  return `${km} km`;
}

/**
 * Formats durations idiomatically in French (e.g., "< 1 min", "14 min", "1 h 08").
 */
export function formatDurationFr(millis: number): string {
  const safeMillis = Math.max(0, millis);
  if (safeMillis === 0) return 'Arrivé';
  const totalMinutes = Math.ceil(safeMillis / 60_000);
  if (totalMinutes < 1) return '< 1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} h ${String(mins).padStart(2, '0')}`;
}

/**
 * Returns French status label for each delivery phase.
 */
export function getPhaseLabelFr(phase: DeliveryPhase): string {
  switch (phase) {
    case 'departed':
      return 'Prise en charge effectuée';
    case 'en_route':
      return 'En cours d’acheminement';
    case 'arriving':
      return 'Approche de la destination';
    case 'delivered':
      return 'Colis livré';
  }
}

/**
 * Detects genuine Google Maps Platform quota exhaustion errors without false positives.
 */
export function isGmpQuotaError(error: unknown): boolean {
  if (!error) return false;
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error);

  const upper = text.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVERQUOTAMAPERROR') ||
    upper.includes('QUOTAEXCEEDED') ||
    upper.includes('STATUS: 429') ||
    upper.includes('HTTP 429')
  );
}
