import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildingHeight, geographyBounds, geographyQuery, loadGeography, parseGeography, parseMeters} from './mapGeography';
import {createRouteProjection3D, projectLatLngTo3D} from './geoTo3D';
import {createGeographicCity} from '../three/geographicCity';
import type {ComputedRouteData} from '../types/delivery';

const outer = [{lat: 6.36, lng: 2.42}, {lat: 6.36, lng: 2.421}, {lat: 6.361, lng: 2.421}, {lat: 6.361, lng: 2.42}, {lat: 6.36, lng: 2.42}];
const inner = [{lat: 6.3603, lng: 2.4203}, {lat: 6.3603, lng: 2.4207}, {lat: 6.3607, lng: 2.4207}, {lat: 6.3607, lng: 2.4203}, {lat: 6.3603, lng: 2.4203}];
const route: ComputedRouteData = {orderId: 'test', path: outer.slice(0, 3), originPoint: outer[0], destinationPoint: outer[2], distanceMeters: 200, durationMillis: 60000, steps: []};
const osmPoints = (points: typeof outer) => points.map(({lat, lng}) => ({lat, lon: lng}));
const fixture = {elements: [
  {type: 'relation', id: 10, tags: {type: 'multipolygon', building: 'yes', height: '12', min_height: '3'}, members: [
    {type: 'way', ref: 11, role: 'outer', geometry: osmPoints(outer)},
    {type: 'way', ref: 12, role: 'inner', geometry: osmPoints(inner)},
  ]},
  {type: 'way', id: 20, tags: {highway: 'residential'}, geometry: osmPoints([outer[0], outer[1]])},
]};

describe('geographic reconstruction', () => {
  it('uses metric heights, explicit feet, levels and a deterministic estimated fallback', () => {
    assert.equal(parseMeters('12.5 m'), 12.5);
    assert.equal(parseMeters('10 ft'), 3.048);
    assert.equal(parseMeters('inconnu'), undefined);
    assert.equal(buildingHeight({height: '12', 'building:levels': '8'}).height, 12);
    assert.equal(buildingHeight({height: '12'}).estimated, false);
    assert.equal(buildingHeight({'building:levels': '4'}).height, 12);
    assert.equal(buildingHeight({'building:levels': '4'}).estimated, true);
    assert.equal(buildingHeight({}).height, 6);
  });

  it('preserves actual building rings and courtyard holes instead of placing boxes', () => {
    const data = parseGeography(fixture);
    assert.equal(data.buildingCount, 1);
    assert.equal(data.estimatedBuildings, 0);
    assert.equal(data.polygons[0].rings.length, 2);
    assert.equal(data.lines.length, 1);
    const projection = createRouteProjection3D(route.path, route.originPoint, route.destinationPoint);
    const group = createGeographicCity(data, projection);
    const building = group.getObjectByName('building') as THREE.Mesh;
    building.geometry.computeBoundingBox();
    const bounds = building.geometry.boundingBox!;
    const anchor = projectLatLngTo3D(outer[0], projection);
    assert.ok(Math.abs(bounds.min.x - anchor.x) < 1e-5);
    assert.ok(Math.abs(bounds.max.z - anchor.z) < 1e-5);
    assert.ok(Math.abs(bounds.min.y - (3 * projection.scaleToScene + 0.025)) < 1e-5);
    assert.ok(Math.abs(bounds.max.y - (12 * projection.scaleToScene + 0.025)) < 1e-5);
    group.updateMatrixWorld(true);
    const courtyard = projectLatLngTo3D({lat: 6.3605, lng: 2.4205}, projection);
    const ray = new THREE.Raycaster(new THREE.Vector3(courtyard.x, 20, courtyard.z), new THREE.Vector3(0, -1, 0));
    assert.equal(ray.intersectObject(building).length, 0, 'Courtyard must remain empty');
    group.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
  });

  it('does not fabricate geometry when OSM has no data or a partial response', () => {
    assert.equal(parseGeography({elements: []}).polygons.length, 0);
    assert.throws(() => parseGeography({elements: [], remark: 'runtime error: timed out'}), /incomplète/);
    const open = {elements: [{type: 'way', id: 1, tags: {building: 'yes'}, geometry: osmPoints(outer.slice(0, 3))}]};
    assert.equal(parseGeography(open).buildingCount, 0);
  });

  it('queries the entire route and delivery stops with a margin, rejects unbounded requests', () => {
    const bounds = geographyBounds(route).split(',').map(Number);
    assert.ok(bounds[0] < 6.36 && bounds[1] < 2.42 && bounds[2] > 6.361 && bounds[3] > 2.421);
    assert.match(geographyQuery(bounds.join(',')), /out geom/);
    assert.throws(() => geographyBounds({...route, destinationPoint: {lat: 50, lng: 2}}), /étendu/);
  });

  it('reports failed requests, retries and caches successful data only', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls <= 2 ? new Response('', {status: 503}) : Response.json(fixture);
    };
    try {
      await assert.rejects(loadGeography(route, new AbortController().signal), /indisponible/);
      const first = await loadGeography(route, new AbortController().signal);
      const second = await loadGeography(route, new AbortController().signal);
      assert.equal(first, second);
      assert.equal(calls, 3);
    } finally { globalThis.fetch = original; }
  });

  it('does not retry or cache an aborted request after switching routes', async () => {
    const original = globalThis.fetch;
    const controller = new AbortController();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    };
    try {
      await assert.rejects(loadGeography({...route, destinationPoint: {lat: 6.362, lng: 2.422}}, controller.signal), {name: 'AbortError'});
      assert.equal(calls, 1);
    } finally { globalThis.fetch = original; }
  });
});
