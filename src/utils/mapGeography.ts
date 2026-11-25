import osmtogeojson from 'osmtogeojson';
import type {ComputedRouteData, LatLngPoint} from '../types/delivery';

export interface MapPolygon {
  rings: LatLngPoint[][];
  kind: 'building' | 'water' | 'green';
  height: number;
  minHeight: number;
  estimated: boolean;
}

export interface MapLine {
  points: LatLngPoint[];
  width: number;
  kind: 'road' | 'shore' | 'water';
}

export interface MapGeography {
  polygons: MapPolygon[];
  lines: MapLine[];
  estimatedBuildings: number;
  buildingCount: number;
}

// OSM heights are metres unless an explicit unit is present.
export function parseMeters(value?: string): number | undefined {
  if (!value) return;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(m|ft|')?$/i);
  if (!match) return;
  const amount = Number(match[1].replace(',', '.'));
  return amount * (match[2]?.toLowerCase() === 'ft' || match[2] === "'" ? 0.3048 : 1);
}

export function buildingHeight(tags: Record<string, string>) {
  const height = parseMeters(tags.height);
  const levels = Number(tags['building:levels']);
  const minHeight = parseMeters(tags.min_height) ?? 0;
  // An absent height is explicitly estimated: 3 m/storey, otherwise 6 m.
  return {
    height: Math.max(minHeight + 0.1, height ?? (levels > 0 && Number.isFinite(levels) ? levels * 3 : 6)),
    minHeight,
    estimated: height === undefined,
  };
}

export function geographyBounds(route: ComputedRouteData): string {
  const points = [...route.path, route.originPoint, route.destinationPoint];
  if (route.waypointPoint) points.push(route.waypointPoint);
  let south = 90, north = -90, west = 180, east = -180;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 85 || Math.abs(p.lng) > 180) {
      throw new Error('Coordonnées hors de la zone prise en charge par la vue 3D.');
    }
    south = Math.min(south, p.lat); north = Math.max(north, p.lat);
    west = Math.min(west, p.lng); east = Math.max(east, p.lng);
  }
  const longitudeMeters = 111320 * Math.cos((south + north) * Math.PI / 360);
  south -= 350 / 111320; north += 350 / 111320;
  west -= 350 / longitudeMeters; east += 350 / longitudeMeters;
  if ((north - south) * 111320 * (east - west) * longitudeMeters > 250_000_000 || east - west > 180) {
    throw new Error('Trajet trop étendu pour charger les bâtiments en 3D. Utilisez Maps 2D.');
  }
  return [south, west, north, east].map(n => n.toFixed(6)).join(',');
}

export function geographyQuery(bounds: string): string {
  return `[out:json][timeout:25][bbox:${bounds}];(
    way[building][building!=no];relation[building][building!=no][type=multipolygon];
    way[highway][area!=yes];way[natural=coastline];way[waterway=river];
    way[natural=water];relation[natural=water][type=multipolygon];
    way[landuse=reservoir];relation[landuse=reservoir][type=multipolygon];
    way[landuse~"^(forest|grass|recreation_ground)$"];
    relation[landuse~"^(forest|grass|recreation_ground)$"][type=multipolygon];
    way[leisure=park];relation[leisure=park][type=multipolygon];
  );out geom;`;
}

export function parseGeography(data: {elements: unknown[]; remark?: string}): MapGeography {
  // Overpass may return HTTP 200 with partial data and an error remark.
  if (data.remark || !Array.isArray(data.elements)) throw new Error('Réponse géographique incomplète. Réessayez.');
  const collection = osmtogeojson(data, {flatProperties: false});
  const result: MapGeography = {polygons: [], lines: [], buildingCount: 0, estimatedBuildings: 0};
  const toPoints = (coordinates: number[][]) => coordinates.map(([lng, lat]) => ({lat, lng}));
  for (const feature of collection.features) {
    if (feature.properties?.tainted) continue; // Never turn an incomplete ring into a fabricated footprint.
    const tags = (feature.properties?.tags ?? {}) as Record<string, string>;
    const geometry = feature.geometry;
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const kind = tags.building && tags.building !== 'no' ? 'building'
        : tags.natural === 'water' || tags.landuse === 'reservoir' ? 'water'
        : tags.leisure === 'park' || ['forest', 'grass', 'recreation_ground'].includes(tags.landuse) ? 'green' : null;
      if (!kind) continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      for (const coordinates of polygons) {
        if (!coordinates.every(r => r.length >= 4 && r.every(p => p.every(Number.isFinite)))) continue;
        const heights = buildingHeight(tags);
        result.polygons.push({rings: coordinates.map(toPoints), kind, ...heights});
        if (kind === 'building') {
          result.buildingCount++;
          if (heights.estimated) result.estimatedBuildings++;
        }
      }
    } else if (geometry.type === 'LineString') {
      const kind = tags.highway ? 'road' : tags.natural === 'coastline' ? 'shore' : tags.waterway === 'river' ? 'water' : null;
      if (!kind || geometry.coordinates.length < 2) continue;
      const roadWidth = ['motorway', 'trunk', 'primary'].includes(tags.highway) ? 12
        : ['secondary', 'tertiary'].includes(tags.highway) ? 8
        : ['footway', 'path', 'steps', 'cycleway'].includes(tags.highway) ? 2 : 5;
      result.lines.push({points: toPoints(geometry.coordinates), kind,
        width: parseMeters(tags.width) ?? (kind === 'road' ? roadWidth : kind === 'water' ? 8 : 2)});
    }
  }
  return result;
}

const cache = new Map<string, MapGeography>();
export async function loadGeography(route: ComputedRouteData, signal: AbortSignal): Promise<MapGeography> {
  const bounds = geographyBounds(route);
  const cached = cache.get(bounds);
  if (cached) return cached;
  for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', body: new URLSearchParams({data: geographyQuery(bounds)}),
        signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]),
      });
      if (!response.ok) continue;
      const data = parseGeography(await response.json());
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (cache.size >= 6) cache.delete(cache.keys().next().value!);
      cache.set(bounds, data);
      return data;
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  throw new Error('Le service géographique est indisponible. Réessayez ou utilisez Maps 2D.');
}
