import {useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {
  ComputedRouteData,
  DeliveryOrder,
  LatLngPoint,
  RouteStepSummary,
} from '../types/delivery';
import {isGmpQuotaError} from '../utils/routeTracking';

type AnyLatLngLike =
  | {lat: number | (() => number); lng: number | (() => number)}
  | {latLng?: {lat: number | (() => number); lng: number | (() => number)}}
  | null
  | undefined;

/**
 * Safely extracts plain {lat, lng} numbers from Google Maps LatLng,
 * LatLngAltitude, or wrapped location objects.
 */
function extractLatLng(raw: AnyLatLngLike): LatLngPoint | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate =
    'latLng' in raw && raw.latLng && typeof raw.latLng === 'object'
      ? raw.latLng
      : (raw as {lat?: number | (() => number); lng?: number | (() => number)});

  const latVal =
    typeof candidate.lat === 'function' ? candidate.lat() : candidate.lat;
  const lngVal =
    typeof candidate.lng === 'function' ? candidate.lng() : candidate.lng;

  if (typeof latVal === 'number' && typeof lngVal === 'number') {
    return {lat: latVal, lng: lngVal};
  }
  return null;
}

interface RawRouteStep {
  instructions?: string;
  navigationInstruction?: {instructions?: string};
  distanceMeters?: number;
  staticDurationMillis?: number;
  durationMillis?: number;
}

interface RawRouteLeg {
  startLocation?: AnyLatLngLike;
  endLocation?: AnyLatLngLike;
  distanceMeters?: number;
  durationMillis?: number;
  steps?: RawRouteStep[];
}

interface RawComputedRoute {
  path?: AnyLatLngLike[];
  distanceMeters?: number;
  durationMillis?: number;
  viewport?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null;
  legs?: RawRouteLeg[];
}

export interface UseCotonouRouteResult {
  route: ComputedRouteData | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Computes and caches real Cotonou road routes using the modern Maps JS SDK
 * `Route.computeRoutes` method (via useMapsLibrary('routes')).
 */
export function useCotonouRoute(order: DeliveryOrder): UseCotonouRouteResult {
  const routesLib = useMapsLibrary('routes');
  const cacheRef = useRef<Record<string, ComputedRouteData>>({});

  const [route, setRoute] = useState<ComputedRouteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  const cacheKey = [
    order.id,
    order.origin.location
      ? `${order.origin.location.lat},${order.origin.location.lng}`
      : order.origin.query,
    order.waypoint
      ? order.waypoint.location
        ? `${order.waypoint.location.lat},${order.waypoint.location.lng}`
        : order.waypoint.query
      : '',
    order.destination.location
      ? `${order.destination.location.lat},${order.destination.location.lng}`
      : order.destination.query,
  ].join('|');

  useEffect(() => {
    const cached = cacheRef.current[cacheKey];
    if (cached) {
      setRoute(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!routesLib) {
      setIsLoading(true);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const request: Record<string, unknown> = {
      origin: order.origin.location ?? order.origin.query,
      destination: order.destination.location ?? order.destination.query,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    };

    if (order.waypoint) {
      request.intermediates = [
        {location: order.waypoint.location ?? order.waypoint.query},
      ];
    }

    const RouteClass = routesLib.Route as unknown as {
      computeRoutes: (
        req: Record<string, unknown>
      ) => Promise<{routes?: RawComputedRoute[]}>;
    };

    RouteClass.computeRoutes(request)
      .then((response) => {
        if (cancelled) return;

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          setRoute(null);
          setError(
            "Aucun itinéraire routier n'a pu être trouvé entre ces deux points à Cotonou."
          );
          setIsLoading(false);
          return;
        }

        const extractedPath = (primaryRoute.path ?? [])
          .map((pt) => extractLatLng(pt))
          .filter((pt): pt is LatLngPoint => pt !== null);

        const legs = primaryRoute.legs ?? [];
        const firstLegStart = extractLatLng(legs[0]?.startLocation);
        const lastLegEnd = extractLatLng(
          legs[legs.length - 1]?.endLocation
        );
        const waypointLoc =
          order.waypoint && legs.length > 1
            ? extractLatLng(legs[0]?.endLocation) ?? undefined
            : undefined;

        const originPoint = firstLegStart ?? extractedPath[0];
        const destinationPoint =
          lastLegEnd ?? extractedPath[extractedPath.length - 1];

        if (!originPoint || !destinationPoint || extractedPath.length < 2) {
          setRoute(null);
          setError(
            "Les coordonnées de l'itinéraire sont incomplètes. Veuillez réessayer."
          );
          setIsLoading(false);
          return;
        }

        const steps: RouteStepSummary[] = [];
        let runningDist = 0;

        legs.forEach((leg, legIdx) => {
          (leg.steps ?? []).forEach((step, stepIdx) => {
            const rawText =
              step.instructions ??
              step.navigationInstruction?.instructions ??
              '';
            const cleanInstruction = rawText
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            const stepDist = step.distanceMeters ?? 0;
            const stepDuration =
              step.durationMillis ?? step.staticDurationMillis ?? 0;

            runningDist += stepDist;

            if (cleanInstruction) {
              steps.push({
                id: `${order.id}-leg${legIdx}-step${stepIdx}`,
                instruction: cleanInstruction,
                distanceMeters: stepDist,
                durationMillis: stepDuration,
                cumulativeDistanceMeters: runningDist,
              });
            }
          });
        });

        const totalDistance =
          primaryRoute.distanceMeters ??
          legs.reduce((sum, leg) => sum + (leg.distanceMeters ?? 0), 0);

        const totalDuration =
          primaryRoute.durationMillis ??
          legs.reduce((sum, leg) => sum + (leg.durationMillis ?? 0), 0);

        const computed: ComputedRouteData = {
          orderId: order.id,
          path: extractedPath,
          originPoint,
          waypointPoint: waypointLoc,
          destinationPoint,
          distanceMeters: totalDistance,
          durationMillis: totalDuration,
          steps,
          viewport: primaryRoute.viewport ?? null,
        };

        cacheRef.current[cacheKey] = computed;
        setRoute(computed);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Route.computeRoutes failed:', err);
        if (isGmpQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setRoute(null);
        setError(
          "Impossible de calculer l'itinéraire sur Google Maps. Vérifiez votre connexion ou réessayez."
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routesLib, cacheKey, order.id, order.origin, order.waypoint, order.destination, retryCounter]);

  const retry = () => {
    delete cacheRef.current[cacheKey];
    setRetryCounter((count) => count + 1);
  };

  return {route, isLoading, error, retry};
}
