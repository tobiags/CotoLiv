import {useEffect, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Bike,
  Compass,
  Crosshair,
  Flag,
  Map as MapIcon,
  Maximize2,
  Package,
  Pause,
  Play,
  RotateCcw,
  Truck,
} from 'lucide-react';
import type {
  ComputedRouteData,
  DelayIncident,
  DeliveryOrder,
  InterpolatedCourierState,
  LatLngPoint,
  MapViewMode,
  ThemeMode,
} from '../types/delivery';
import {
  formatDistanceFr,
  formatDurationFr,
  getPhaseLabelFr,
} from '../utils/routeTracking';
import {cn} from '../utils/cn';

const COTONOU_DEFAULT_CENTER: LatLngPoint = {
  lat: 6.3654,
  lng: 2.4183,
};

interface DualRoutePolylinesProps {
  traveledPath: LatLngPoint[];
  remainingPath: LatLngPoint[];
  theme: ThemeMode;
}

/**
 * Renders two distinct polylines on the Google Map:
 * - Solid forest emerald for the path already covered ("D'où il vient avec son colis")
 * - Warm gold dashed line for the remaining itinerary toward the recipient
 */
function DualRoutePolylines({
  traveledPath,
  remainingPath,
  theme,
}: DualRoutePolylinesProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  const baseShadowRef = useRef<google.maps.Polyline | null>(null);
  const traveledLineRef = useRef<google.maps.Polyline | null>(null);
  const remainingLineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    const isDark = theme === 'dark';

    const baseShadow = new mapsLib.Polyline({
      map,
      strokeColor: isDark ? '#34D399' : '#0F3D2E',
      strokeOpacity: isDark ? 0.22 : 0.16,
      strokeWeight: 10,
      zIndex: 1,
      clickable: false,
    });

    const traveledLine = new mapsLib.Polyline({
      map,
      strokeColor: isDark ? '#10B981' : '#0F6B4B',
      strokeOpacity: 1,
      strokeWeight: 5.5,
      zIndex: 3,
      clickable: false,
    });

    const remainingLine = new mapsLib.Polyline({
      map,
      strokeColor: isDark ? '#F2B94B' : '#C48B28',
      strokeOpacity: 0,
      strokeWeight: 4.5,
      zIndex: 2,
      clickable: false,
      icons: [
        {
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.95,
            strokeColor: isDark ? '#F5C45E' : '#B87D1B',
            scale: 3.2,
          },
          offset: '0',
          repeat: '14px',
        },
      ],
    });

    baseShadowRef.current = baseShadow;
    traveledLineRef.current = traveledLine;
    remainingLineRef.current = remainingLine;

    return () => {
      baseShadow.setMap(null);
      traveledLine.setMap(null);
      remainingLine.setMap(null);
      baseShadowRef.current = null;
      traveledLineRef.current = null;
      remainingLineRef.current = null;
    };
  }, [map, mapsLib, theme]);

  useEffect(() => {
    if (baseShadowRef.current) {
      baseShadowRef.current.setPath(traveledPath);
    }
    if (traveledLineRef.current) {
      traveledLineRef.current.setPath(traveledPath);
    }
  }, [traveledPath, theme]);

  useEffect(() => {
    if (remainingLineRef.current) {
      remainingLineRef.current.setPath(remainingPath);
    }
  }, [remainingPath, theme]);

  return null;
}

interface GeofenceCircleOverlayProps {
  center: LatLngPoint;
  radiusMeters: number;
  isWithinProximity: boolean;
}

/**
 * Renders the live proximity notification geofence circle around the destination.
 */
function GeofenceCircleOverlay({
  center,
  radiusMeters,
  isWithinProximity,
}: GeofenceCircleOverlayProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;
    const circle = new mapsLib.Circle({
      map,
      center,
      radius: radiusMeters,
      strokeColor: isWithinProximity ? '#10B981' : '#C48B28',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: isWithinProximity ? '#10B981' : '#C48B28',
      fillOpacity: isWithinProximity ? 0.16 : 0.08,
      clickable: false,
      zIndex: 1,
    });
    circleRef.current = circle;

    return () => {
      circle.setMap(null);
      circleRef.current = null;
    };
  }, [map, mapsLib]);

  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setCenter(center);
    circleRef.current.setRadius(radiusMeters);
    circleRef.current.setOptions({
      strokeColor: isWithinProximity ? '#10B981' : '#C48B28',
      fillColor: isWithinProximity ? '#10B981' : '#C48B28',
      fillOpacity: isWithinProximity ? 0.16 : 0.08,
    });
  }, [center, radiusMeters, isWithinProximity]);

  return null;
}

interface MapCameraControllerProps {
  route: ComputedRouteData | null;
  courierPosition: LatLngPoint | null;
  followCourier: boolean;
  fitRequestId: number;
}

function MapCameraController({
  route,
  courierPosition,
  followCourier,
  fitRequestId,
}: MapCameraControllerProps) {
  const map = useMap();
  const lastFittedOrderRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !route) return;
    if (lastFittedOrderRef.current === route.orderId && fitRequestId === 0) {
      return;
    }

    lastFittedOrderRef.current = route.orderId;

    if (route.viewport) {
      map.fitBounds(route.viewport, {
        top: 72,
        right: 60,
        bottom: 112,
        left: 60,
      });
    } else if (route.path.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      route.path.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, {top: 72, right: 60, bottom: 112, left: 60});
    }
  }, [map, route, fitRequestId]);

  useEffect(() => {
    if (!map || !followCourier || !courierPosition) return;
    map.panTo(courierPosition);
  }, [map, followCourier, courierPosition]);

  return null;
}

interface DeliveryMapProps {
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
  followCourier: boolean;
  onToggleFollowCourier: () => void;
  fitRequestId: number;
  onFitFullRoute: () => void;
  theme: ThemeMode;
  mapMode: MapViewMode;
  onChangeMapMode: (mode: MapViewMode) => void;
  radiusMeters: number;
  isWithinProximity: boolean;
  delayIncident: DelayIncident | null;
  onToggleSimulateDelay: () => void;
}

type ActiveInfoKey = 'origin' | 'waypoint' | 'courier' | 'destination' | null;

export function DeliveryMap({
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
  followCourier,
  onToggleFollowCourier,
  fitRequestId,
  onFitFullRoute,
  theme,
  mapMode,
  onChangeMapMode,
  radiusMeters,
  isWithinProximity,
  delayIncident,
  onToggleSimulateDelay,
}: DeliveryMapProps) {
  const [openInfo, setOpenInfo] = useState<ActiveInfoKey>(null);

  const [originMarkerRef, originMarker] = useAdvancedMarkerRef();
  const [waypointMarkerRef, waypointMarker] = useAdvancedMarkerRef();
  const [courierMarkerRef, courierMarker] = useAdvancedMarkerRef();
  const [destMarkerRef, destMarker] = useAdvancedMarkerRef();

  // Reset open info window when switching deliveries
  useEffect(() => {
    setOpenInfo(null);
  }, [order.id]);

  const isVan = order.courier.vehicle.toLowerCase().includes('fourgon');
  const adjustedRemainingMs =
    courierState && courierState.phase !== 'delivered'
      ? courierState.remainingMillis +
        (delayIncident?.extraMinutes ?? 0) * 60_000
      : 0;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#E8ECE9] dark:bg-[#0D1512]"
      data-testid="cotonou-map-stage"
    >
      <GoogleMap
        key={`gmap-${theme}`}
        mapId="DEMO_MAP_ID"
        colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
        defaultCenter={COTONOU_DEFAULT_CENTER}
        defaultZoom={13}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{width: '100%', height: '100%'}}
      >
        <MapCameraController
          route={route}
          courierPosition={courierState?.position ?? null}
          followCourier={followCourier}
          fitRequestId={fitRequestId}
        />

        {courierState && (
          <DualRoutePolylines
            traveledPath={courierState.traveledPath}
            remainingPath={courierState.remainingPath}
            theme={theme}
          />
        )}

        {route && (
          <GeofenceCircleOverlay
            center={route.destinationPoint}
            radiusMeters={radiusMeters}
            isWithinProximity={isWithinProximity}
          />
        )}

        {/* Origin Marker — "D'où vient le colis" */}
        {route && (
          <>
            <AdvancedMarker
              ref={originMarkerRef}
              position={route.originPoint}
              title={`Départ : ${order.origin.label}`}
              zIndex={20}
              onClick={() => setOpenInfo('origin')}
            >
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 bg-white dark:bg-[#111E1A] text-[#0F3D2E] dark:text-[#6EE7B7] border border-[#0F3D2E]/35 dark:border-[#34D399]/40 rounded-md px-2 py-1 shadow-md">
                  <Package className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {order.origin.label}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 -mt-1 rounded-full bg-[#0F3D2E] dark:bg-[#34D399] border-2 border-white dark:border-[#111E1A] shadow-xs"
                />
              </div>
            </AdvancedMarker>

            {openInfo === 'origin' && originMarker && (
              <InfoWindow
                anchor={originMarker}
                onCloseClick={() => setOpenInfo(null)}
                maxWidth={240}
              >
                <div className="p-1 text-[#111815]">
                  <p className="text-xs font-medium text-[#5A6760]">
                    Point d’origine du colis
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {order.origin.label}
                  </p>
                  <p className="text-xs text-[#5A6760] mt-1">
                    Expéditeur : {order.senderName} · Départ{' '}
                    {order.dispatchedAtLabel}
                  </p>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {/* Intermediate Relay / Waypoint Marker */}
        {route?.waypointPoint && order.waypoint && (
          <>
            <AdvancedMarker
              ref={waypointMarkerRef}
              position={route.waypointPoint}
              title={`Étape : ${order.waypoint.label}`}
              zIndex={18}
              onClick={() => setOpenInfo('waypoint')}
            >
              <div className="group flex flex-col items-center">
                <span className="w-3.5 h-3.5 rounded-full bg-white border-[3px] border-[#0F6B4B] shadow-sm transition-transform group-hover:scale-125" />
              </div>
            </AdvancedMarker>

            {openInfo === 'waypoint' && waypointMarker && (
              <InfoWindow
                anchor={waypointMarker}
                onCloseClick={() => setOpenInfo(null)}
                maxWidth={220}
              >
                <div className="p-1 text-[#111815]">
                  <p className="text-xs font-medium text-[#5A6760]">
                    Point de passage
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {order.waypoint.label}
                  </p>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {/* Destination Marker */}
        {route && (
          <>
            <AdvancedMarker
              ref={destMarkerRef}
              position={route.destinationPoint}
              title={`Destination : ${order.destination.label}`}
              zIndex={22}
              onClick={() => setOpenInfo('destination')}
            >
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 bg-[#111815] text-white border border-[#C48B28]/60 rounded-md px-2 py-1 shadow-md">
                  <Flag
                    className="w-3 h-3 text-[#E4AF4D] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {order.destination.label}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 -mt-1 rounded-full bg-[#C48B28] border-2 border-white shadow-xs"
                />
              </div>
            </AdvancedMarker>

            {openInfo === 'destination' && destMarker && (
              <InfoWindow
                anchor={destMarker}
                onCloseClick={() => setOpenInfo(null)}
                maxWidth={240}
              >
                <div className="p-1 text-[#111815]">
                  <p className="text-xs font-medium text-[#5A6760]">
                    Destination de livraison
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {order.destination.label}
                  </p>
                  <p className="text-xs text-[#5A6760] mt-1">
                    Destinataire : {order.recipientName}
                  </p>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {/* Live Courier Marker */}
        {courierState && (
          <>
            <AdvancedMarker
              ref={courierMarkerRef}
              position={courierState.position}
              title={`Livreur : ${order.courier.name}`}
              zIndex={40}
              onClick={() => setOpenInfo('courier')}
            >
              <div className="relative flex items-center justify-center">
                {courierState.phase !== 'delivered' && (
                  <span
                    aria-hidden="true"
                    className="courier-radar-ring absolute w-11 h-11 rounded-full bg-[#0F6B4B]/30 dark:bg-[#34D399]/35"
                  />
                )}
                <div
                  aria-hidden="true"
                  className="absolute -inset-2 flex items-start justify-center pointer-events-none"
                  style={{
                    transform: `rotate(${Math.round(courierState.heading)}deg)`,
                  }}
                >
                  <span className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-[#0F3D2E] dark:border-b-[#34D399] -mt-1.5" />
                </div>
                <div className="relative w-10 h-10 rounded-full bg-[#0F3D2E] dark:bg-[#10B981] text-white dark:text-[#071510] border-[3px] border-white dark:border-[#101815] shadow-lg flex items-center justify-center">
                  {isVan ? (
                    <Truck className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Bike className="w-4 h-4" aria-hidden="true" />
                  )}
                </div>
              </div>
            </AdvancedMarker>

            {openInfo === 'courier' && courierMarker && (
              <InfoWindow
                anchor={courierMarker}
                onCloseClick={() => setOpenInfo(null)}
                maxWidth={250}
              >
                <div className="p-1 text-[#111815]">
                  <p className="text-xs font-medium text-[#0F6B4B]">
                    {getPhaseLabelFr(courierState.phase)}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {order.courier.name}
                  </p>
                  <p className="text-xs text-[#5A6760] mt-1 font-mono tabular-nums">
                    Parcouru : {formatDistanceFr(courierState.traveledMeters)} ·
                    Restant : {formatDistanceFr(courierState.remainingMeters)}
                  </p>
                  <p className="text-xs text-[#5A6760] mt-0.5">
                    Arrivée estimée : {formatDurationFr(adjustedRemainingMs)}
                  </p>
                </div>
              </InfoWindow>
            )}
          </>
        )}
      </GoogleMap>

      {/* Top-Left Compact Map Legend */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 bg-white/95 dark:bg-[#111916]/95 border border-[#DFE4E0] dark:border-[#25332D] rounded-lg px-2.5 sm:px-3 py-1.5 shadow-sm flex items-center gap-x-3 text-xs text-[#2B3731] dark:text-[#D7E0DC]">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="w-3.5 h-1 rounded-full bg-[#0F6B4B] dark:bg-[#34D399]"
          />
          <span>Parcouru</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="w-3.5 h-0 border-t-2 border-dashed border-[#B87D1B] dark:border-[#F2B94B]"
          />
          <span>Restant</span>
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

      {/* Top-Right View Mode + Camera Controls */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5">
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

        <button
          type="button"
          onClick={onToggleFollowCourier}
          aria-pressed={followCourier}
          aria-label={
            followCourier
              ? 'Désactiver le suivi caméra sur le livreur'
              : 'Centrer et suivre le livreur'
          }
          className={cn(
            'h-9 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer',
            followCourier
              ? 'bg-[#0F3D2E] text-white border-[#0F3D2E] dark:bg-[#10B981] dark:text-[#071510] dark:border-[#10B981]'
              : 'bg-white/95 dark:bg-[#111916]/95 text-[#1E2A24] dark:text-[#D7E0DC] border-[#DFE4E0] dark:border-[#25332D] hover:bg-white dark:hover:bg-[#1A2622]'
          )}
        >
          <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">Suivre</span>
        </button>

        <button
          type="button"
          onClick={onFitFullRoute}
          aria-label="Afficher tout l'itinéraire sur la carte"
          className="h-9 px-2.5 rounded-lg bg-white/95 dark:bg-[#111916]/95 hover:bg-white dark:hover:bg-[#1A2622] text-[#1E2A24] dark:text-[#D7E0DC] border border-[#DFE4E0] dark:border-[#25332D] text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">Global</span>
        </button>
      </div>

      {/* Bottom Floating Live Playback Bar */}
      {route && courierState && (
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-10 bg-white/96 dark:bg-[#111916]/96 border border-[#DFE4E0] dark:border-[#25332D] rounded-xl px-3 py-2 shadow-md flex items-center justify-between sm:justify-start gap-2.5">
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
            aria-label="Revenir au point de départ du livreur"
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
          </button>

          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-[#E3E7E4] dark:border-[#25332D] text-xs font-mono tabular-nums text-[#2B3731] dark:text-[#D7E0DC] whitespace-nowrap">
            <span>{Math.round(courierState.progress * 100)}%</span>
            <span aria-hidden="true" className="text-[#9CA7A1]">
              ·
            </span>
            <span>{formatDurationFr(adjustedRemainingMs)}</span>
          </div>
        </div>
      )}

      {/* Loading Route Overlay */}
      {isLoadingRoute && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-20 bg-white/60 dark:bg-[#0B1210]/70 flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="bg-white dark:bg-[#111916] border border-[#DFE4E0] dark:border-[#25332D] rounded-xl px-5 py-3.5 shadow-sm flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-[#0F3D2E] dark:border-[#34D399] border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-[#111815] dark:text-[#EEF2F0]">
              Calcul de l’itinéraire dans Cotonou…
            </span>
          </div>
        </div>
      )}

      {/* Route Error State */}
      {!isLoadingRoute && routeError && (
        <div
          role="alert"
          className="absolute inset-x-4 bottom-20 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-20 max-w-md bg-white dark:bg-[#111916] border border-[#E5C5C5] dark:border-[#5C2B2B] rounded-xl p-4 shadow-md"
        >
          <p className="text-sm font-semibold text-[#8A1F1F] dark:text-[#FCA5A5]">
            Itinéraire indisponible
          </p>
          <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-1 leading-relaxed">
            {routeError}
          </p>
          <button
            type="button"
            onClick={onRetryRoute}
            className="mt-3 px-3.5 py-1.5 text-xs font-medium text-white bg-[#0F3D2E] hover:bg-[#0B2E22] rounded-lg transition-colors cursor-pointer"
          >
            Réessayer le calcul
          </button>
        </div>
      )}
    </div>
  );
}
