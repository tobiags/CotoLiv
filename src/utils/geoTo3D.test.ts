import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashedRibbonSegments,
  createRouteProjection3D,
  metersToSceneUnits,
  projectLatLngTo3D,
} from './geoTo3D.ts';

const SAMPLE_PATH = [
  {lat: 6.3702, lng: 2.4321}, // East/North (Dantokpa area)
  {lat: 6.3651, lng: 2.4112}, // Center (Etoile Rouge area)
  {lat: 6.3518, lng: 2.3714}, // West/South (Fidjrosse area)
];

describe('geoTo3D', () => {
  it('centers route coordinates in XZ space and preserves East=+X, North=-Z orientation', () => {
    const proj = createRouteProjection3D(
      SAMPLE_PATH,
      SAMPLE_PATH[0],
      SAMPLE_PATH[2],
      SAMPLE_PATH[1],
      36
    );
    assert.equal(proj.path3D.length, 3);
    // Dantokpa is East & North of Fidjrosse -> origin.x > dest.x, origin.z < dest.z
    assert.ok(proj.origin3D.x > proj.destination3D.x);
    assert.ok(proj.origin3D.z < proj.destination3D.z);

    // Projecting an arbitrary point matches path endpoints
    const reprojectedOrigin = projectLatLngTo3D(SAMPLE_PATH[0], proj);
    assert.ok(Math.abs(reprojectedOrigin.x - proj.origin3D.x) < 1e-6);
    assert.ok(Math.abs(reprojectedOrigin.z - proj.origin3D.z) < 1e-6);
  });

  it('converts real meters into proportional 3D scene units for geofence rings', () => {
    const proj = createRouteProjection3D(
      SAMPLE_PATH,
      SAMPLE_PATH[0],
      SAMPLE_PATH[2],
      undefined,
      36
    );
    const r500 = metersToSceneUnits(500, proj);
    const r1000 = metersToSceneUnits(1000, proj);
    const r2000 = metersToSceneUnits(2000, proj);
    assert.ok(r500 > 0);
    assert.ok(Math.abs(r1000 - r500 * 2) < 1e-6);
    assert.ok(Math.abs(r2000 - r1000 * 2) < 1e-6);
  });

  it('computes dashed ribbon segments safely across exact float cycle boundaries and invalid points', () => {
    // Adversarial exact multiples of cycle (2.85) and dashLength (1.8) that trigger sub-ULP remainders
    const cycle = 1.8 + 1.05;
    const trickyPath = [
      {x: 0, z: 0},
      {x: 1.8 - 1e-15, z: 0},
      {x: cycle - 1e-15, z: 0},
      {x: cycle * 17, z: 0},
      {x: cycle * 17 + 1.8, z: cycle * 29},
      {x: Number.NaN, z: 5},
      {x: cycle * 17 + 1.8, z: cycle * 29 + 10},
    ];
    const segs = computeDashedRibbonSegments(trickyPath, 1.8, 1.05);
    assert.ok(segs.length > 10 && segs.length < 500);
    for (const s of segs) {
      assert.ok(Number.isFinite(s.startX) && Number.isFinite(s.endZ));
    }
  });
});
