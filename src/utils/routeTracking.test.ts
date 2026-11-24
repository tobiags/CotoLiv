import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBearing,
  clampProgress,
  formatDistanceFr,
  formatDurationFr,
  getDeliveryPhase,
  haversineDistanceMeters,
  interpolateCourierState,
  isGmpQuotaError,
} from './routeTracking';

const SAMPLE_PATH = [
  {lat: 6.370, lng: 2.430},
  {lat: 6.370, lng: 2.420},
  {lat: 6.360, lng: 2.420},
];

test('haversineDistanceMeters returns zero for identical coordinates and realistic meters for separated points', () => {
  assert.equal(haversineDistanceMeters(SAMPLE_PATH[0], SAMPLE_PATH[0]), 0);
  const dist = haversineDistanceMeters(SAMPLE_PATH[0], SAMPLE_PATH[1]);
  assert.ok(dist > 1050 && dist < 1150, `Expected ~1105m, got ${dist}`);
});

test('calculateBearing computes cardinal directions accurately', () => {
  const west = calculateBearing(SAMPLE_PATH[0], SAMPLE_PATH[1]);
  assert.ok(Math.abs(west - 270) < 1, `Expected ~270 deg, got ${west}`);

  const south = calculateBearing(SAMPLE_PATH[1], SAMPLE_PATH[2]);
  assert.ok(Math.abs(south - 180) < 1, `Expected ~180 deg, got ${south}`);
});

test('interpolateCourierState splits traveled and remaining paths seamlessly at midpoint', () => {
  const state = interpolateCourierState(SAMPLE_PATH, 0.5, 2200, 600_000);
  assert.ok(state);
  assert.equal(state.phase, 'en_route');
  assert.equal(state.traveledMeters, 1100);
  assert.equal(state.remainingMeters, 1100);
  assert.equal(state.remainingMillis, 300_000);

  // Last point of traveledPath must match first point of remainingPath (exact courier position)
  const lastTraveled = state.traveledPath[state.traveledPath.length - 1];
  const firstRemaining = state.remainingPath[0];
  assert.deepEqual(lastTraveled, state.position);
  assert.deepEqual(firstRemaining, state.position);
});

test('interpolateCourierState handles boundary values 0 and 1 cleanly', () => {
  const start = interpolateCourierState(SAMPLE_PATH, 0, 2200, 600_000);
  assert.ok(start);
  assert.deepEqual(start.position, SAMPLE_PATH[0]);
  assert.equal(start.traveledMeters, 0);
  assert.equal(start.remainingMeters, 2200);
  assert.equal(start.phase, 'departed');

  const end = interpolateCourierState(SAMPLE_PATH, 1, 2200, 600_000);
  assert.ok(end);
  assert.deepEqual(end.position, SAMPLE_PATH[2]);
  assert.equal(end.traveledMeters, 2200);
  assert.equal(end.remainingMeters, 0);
  assert.equal(end.remainingMillis, 0);
  assert.equal(end.phase, 'delivered');
});

test('clampProgress and getDeliveryPhase guard out-of-range inputs', () => {
  assert.equal(clampProgress(-0.5), 0);
  assert.equal(clampProgress(1.8), 1);
  assert.equal(clampProgress(Number.NaN), 0);
  assert.equal(getDeliveryPhase(0.02), 'departed');
  assert.equal(getDeliveryPhase(0.5), 'en_route');
  assert.equal(getDeliveryPhase(0.9), 'arriving');
  assert.equal(getDeliveryPhase(1), 'delivered');
});

test('French formatters display meters, kilometers, and minutes cleanly', () => {
  assert.equal(formatDistanceFr(640), '640 m');
  assert.equal(formatDistanceFr(3450), '3,5 km');
  assert.equal(formatDurationFr(0), 'Arrivé');
  assert.equal(formatDurationFr(840_000), '14 min');
  assert.equal(formatDurationFr(4_080_000), '1 h 08');
});

test('isGmpQuotaError detects quota errors without false positives', () => {
  assert.equal(isGmpQuotaError(new Error('RESOURCE_EXHAUSTED: quota exceeded')), true);
  assert.equal(isGmpQuotaError(new Error('OVER_QUERY_LIMIT')), true);
  assert.equal(isGmpQuotaError(new Error('ZERO_RESULTS')), false);
  assert.equal(isGmpQuotaError(new Error('Network offline')), false);
});
