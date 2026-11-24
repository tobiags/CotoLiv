import {useState} from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  Phone,
} from 'lucide-react';
import type {
  ComputedRouteData,
  DelayIncident,
  DeliveryOrder,
  InterpolatedCourierState,
  ThemeMode,
} from '../types/delivery';
import {
  formatDistanceFr,
  formatDurationFr,
  getPhaseLabelFr,
} from '../utils/routeTracking';
import {cn} from '../utils/cn';

interface LiveTrackingPanelProps {
  order: DeliveryOrder;
  route: ComputedRouteData | null;
  courierState: InterpolatedCourierState | null;
  progress: number;
  isLoadingRoute: boolean;
  onScrubProgress: (value: number) => void;
  onFocusCourier: () => void;
  onOpenDeliveries: () => void;
  theme: ThemeMode;
  radiusMeters: number;
  isWithinProximity: boolean;
  delayIncident: DelayIncident | null;
  onClearDelay: () => void;
  onOpenNotifications: () => void;
}

export function LiveTrackingPanel({
  order,
  route,
  courierState,
  progress,
  isLoadingRoute,
  onScrubProgress,
  onFocusCourier,
  onOpenDeliveries,
  theme,
  radiusMeters,
  isWithinProximity,
  delayIncident,
  onClearDelay,
  onOpenNotifications,
}: LiveTrackingPanelProps) {
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const percent = Math.round(progress * 100);
  const phaseLabel = courierState
    ? getPhaseLabelFr(courierState.phase)
    : isLoadingRoute
      ? 'Localisation en cours'
      : 'En attente de l’itinéraire';

  const adjustedRemainingMs =
    courierState && courierState.phase !== 'delivered'
      ? courierState.remainingMillis +
        (delayIncident?.extraMinutes ?? 0) * 60_000
      : 0;

  const sliderActiveColor = theme === 'dark' ? '#10B981' : '#0F6B4B';
  const sliderTrackColor = theme === 'dark' ? '#24342E' : '#E2E7E4';

  const handleCopyPhone = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(order.courier.phoneDisplay);
      }
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 2200);
    } catch {
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 2200);
    }
  };

  return (
    <div className="divide-y divide-[#E7EBE8] dark:divide-[#202E28]">
      {/* Section 1: Parcel Summary & Primary ETA */}
      <section className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-[#5A6760] dark:text-[#96A59E]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono tabular-nums font-medium text-[#0F3D2E] dark:text-[#6EE7B7]">
              {order.trackingCode}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{order.parcelCategory}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{order.weightLabel}</span>
          </div>
          <button
            type="button"
            onClick={onOpenDeliveries}
            className="text-xs font-medium text-[#0F3D2E] dark:text-[#6EE7B7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Changer
          </button>
        </div>

        <h1 className="text-lg sm:text-xl font-bold text-[#111815] dark:text-[#EEF2F0] tracking-tight mt-1.5 leading-snug">
          {order.parcelTitle}
        </h1>

        <p className="text-xs sm:text-sm font-medium text-[#0F6B4B] dark:text-[#34D399] mt-0.5">
          {phaseLabel}
          {isWithinProximity && (
            <span className="text-[#111815] dark:text-[#EEF2F0] font-normal">
              {' '}
              · Dans la zone de {formatDistanceFr(radiusMeters)}
            </span>
          )}
        </p>

        {/* Active Delay Notice (only shown when a significant traffic delay is reported) */}
        {delayIncident && (
          <div
            role="status"
            className="mt-3 p-3 rounded-lg bg-[#FFFBEB] dark:bg-[#2E2109] border border-[#F59E0B]/40 flex items-start gap-2.5"
          >
            <AlertTriangle
              className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#92400E] dark:text-[#FCD34D]">
                Retard signalé (+{delayIncident.extraMinutes} min)
              </p>
              <p className="text-xs text-[#78350F] dark:text-[#FDE68A] mt-0.5 leading-snug">
                {delayIncident.reason}
              </p>
              <button
                type="button"
                onClick={onClearDelay}
                className="mt-1.5 text-[11px] font-medium text-[#92400E] dark:text-[#FCD34D] underline cursor-pointer"
              >
                Trafic rétabli
              </button>
            </div>
          </div>
        )}

        {/* Key Numeric Metrics Strip */}
        <div className="mt-4 pt-3.5 border-t border-[#ECEFED] dark:border-[#202E28] grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-[#64726B] dark:text-[#8E9E96]">
              Arrivée estimée
            </p>
            <p
              className={cn(
                'text-base font-semibold font-mono tabular-nums mt-0.5',
                delayIncident
                  ? 'text-[#B45309] dark:text-[#FBBF24]'
                  : 'text-[#111815] dark:text-[#EEF2F0]'
              )}
            >
              {courierState
                ? formatDurationFr(adjustedRemainingMs)
                : isLoadingRoute
                  ? '…'
                  : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64726B] dark:text-[#8E9E96]">
              Déjà parcouru
            </p>
            <p className="text-base font-semibold font-mono tabular-nums text-[#0F6B4B] dark:text-[#34D399] mt-0.5">
              {courierState
                ? formatDistanceFr(courierState.traveledMeters)
                : isLoadingRoute
                  ? '…'
                  : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64726B] dark:text-[#8E9E96]">
              Restant
            </p>
            <p className="text-base font-semibold font-mono tabular-nums text-[#9B6610] dark:text-[#F2B94B] mt-0.5">
              {courierState
                ? formatDistanceFr(courierState.remainingMeters)
                : isLoadingRoute
                  ? '…'
                  : '—'}
            </p>
          </div>
        </div>

        {/* Precision Route Scrubber */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-[#5A6760] dark:text-[#96A59E] mb-1.5">
            <label htmlFor="route-progress-slider" className="font-medium">
              Progression sur l’itinéraire
            </label>
            <span className="font-mono tabular-nums font-semibold text-[#111815] dark:text-[#EEF2F0]">
              {percent}%
            </span>
          </div>
          <input
            id="route-progress-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            disabled={!route}
            onChange={(e) => onScrubProgress(Number(e.target.value) / 100)}
            className="cotoliv-range w-full disabled:opacity-40"
            style={{
              background: `linear-gradient(to right, ${sliderActiveColor} 0%, ${sliderActiveColor} ${percent}%, ${sliderTrackColor} ${percent}%, ${sliderTrackColor} 100%)`,
              height: '6px',
              borderRadius: '9999px',
            }}
          />
          <div className="flex items-center justify-between text-[11px] text-[#6E7B74] dark:text-[#8A9992] mt-1">
            <span>Départ · {order.dispatchedAtLabel}</span>
            <span>
              {route
                ? `Total ${formatDistanceFr(route.distanceMeters)}`
                : 'Cotonou, Bénin'}
            </span>
          </div>
        </div>

        {/* Quiet Proximity Alert Summary Row */}
        <div className="mt-3.5 pt-3 border-t border-[#ECEFED] dark:border-[#202E28] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#5A6760] dark:text-[#96A59E] min-w-0">
            <Bell className="w-3.5 h-3.5 text-[#0F6B4B] dark:text-[#34D399] shrink-0" aria-hidden="true" />
            <span className="truncate">
              Alerte proximité :{' '}
              <strong className="font-mono tabular-nums font-medium text-[#111815] dark:text-[#EEF2F0]">
                {formatDistanceFr(radiusMeters)}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenNotifications}
            className="text-xs font-medium text-[#0F3D2E] dark:text-[#6EE7B7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Configurer
          </button>
        </div>
      </section>

      {/* Section 2: Vertical Itinerary — "D'où il vient -> Position actuelle -> Destination" */}
      <section className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mb-3">
          Trajet du colis à Cotonou
        </h2>

        <ol className="relative space-y-3.5">
          <span
            aria-hidden="true"
            className="absolute left-[9px] top-2.5 bottom-2.5 w-px bg-[#DCE2DE] dark:bg-[#26362F]"
          />

          {/* Step 1: Origin */}
          <li className="relative pl-7">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1 w-5 h-5 rounded-full bg-[#0F3D2E] dark:bg-[#10B981] border-2 border-white dark:border-[#111916] ring-1 ring-[#0F3D2E]/30 dark:ring-[#10B981]/35 flex items-center justify-center"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#071510]" />
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-[#0F6B4B] dark:text-[#34D399]">
                D’où vient le colis
              </p>
              <span className="text-xs font-mono tabular-nums text-[#64726B] dark:text-[#8E9E96]">
                {order.dispatchedAtLabel}
              </span>
            </div>
            <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mt-0.5">
              {order.origin.label}
            </p>
            <p className="text-xs text-[#5A6760] dark:text-[#96A59E]">
              {order.senderName} ·{' '}
              {order.origin.formattedAddress ?? 'Cotonou, Bénin'}
            </p>
          </li>

          {/* Optional Intermediate Stopover */}
          {order.waypoint && (
            <li className="relative pl-7">
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[2px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-[#111916]',
                  progress >= 0.45
                    ? 'bg-[#0F6B4B] dark:bg-[#10B981] ring-1 ring-[#0F6B4B]/40'
                    : 'bg-[#CBD3CE] dark:bg-[#3A4C44]'
                )}
              />
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-[#5A6760] dark:text-[#96A59E]">
                  Point de passage
                </p>
                <span className="text-xs text-[#64726B] dark:text-[#8E9E96]">
                  {progress >= 0.45 ? 'Franchi' : 'Sur l’itinéraire'}
                </span>
              </div>
              <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mt-0.5">
                {order.waypoint.label}
              </p>
            </li>
          )}

          {/* Live Courier Position Node */}
          <li className="relative pl-7">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1 w-5 h-5 rounded-full bg-[#C48B28] dark:bg-[#F2B94B] border-2 border-white dark:border-[#111916] ring-2 ring-[#C48B28]/30 flex items-center justify-center"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#111916]" />
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-[#9B6610] dark:text-[#F2B94B]">
                Position actuelle du livreur
              </p>
              <span className="text-xs font-mono tabular-nums text-[#111815] dark:text-[#EEF2F0] font-medium">
                {percent}% du trajet
              </span>
            </div>
            <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mt-0.5">
              {courierState?.phase === 'delivered'
                ? `Livré à ${order.destination.label}`
                : `${order.courier.name} en route vers ${order.destination.label}`}
            </p>
            {courierState && (
              <p className="text-xs font-mono tabular-nums text-[#5A6760] dark:text-[#96A59E]">
                {courierState.position.lat.toFixed(4)}° N,{' '}
                {courierState.position.lng.toFixed(4)}° E
              </p>
            )}
          </li>

          {/* Step 3: Destination */}
          <li className="relative pl-7">
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#111916] flex items-center justify-center',
                courierState?.phase === 'delivered'
                  ? 'bg-[#0F6B4B] dark:bg-[#10B981] ring-1 ring-[#0F6B4B]/40'
                  : 'bg-[#111815] dark:bg-[#D7E0DC] ring-1 ring-[#111815]/25'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#111916]" />
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-[#5A6760] dark:text-[#96A59E]">
                Destination finale
              </p>
              <span className="text-xs font-mono tabular-nums text-[#5A6760] dark:text-[#96A59E]">
                {courierState ? formatDurationFr(adjustedRemainingMs) : '—'}
              </span>
            </div>
            <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mt-0.5">
              {order.destination.label}
            </p>
            <p className="text-xs text-[#5A6760] dark:text-[#96A59E]">
              Destinataire : {order.recipientName}
            </p>
          </li>
        </ol>
      </section>

      {/* Section 3: Courier Profile */}
      <section className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mb-3">
          Votre livreur
        </h2>

        <div className="flex items-center gap-3">
          {!avatarError ? (
            <img
              src={order.courier.avatarUrl}
              alt={`Portrait du livreur ${order.courier.name}`}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-11 h-11 rounded-full object-cover border border-[#DFE4E0] dark:border-[#26362F] shrink-0"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-11 h-11 rounded-full bg-[#0F3D2E] dark:bg-[#10B981] text-white dark:text-[#071510] font-semibold text-sm flex items-center justify-center shrink-0"
            >
              {order.courier.initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] truncate">
              {order.courier.name}
            </p>
            <p className="text-xs text-[#5A6760] dark:text-[#96A59E] truncate mt-0.5">
              {order.courier.vehicle} ·{' '}
              <span className="font-mono tabular-nums">
                {order.courier.plate}
              </span>
            </p>
          </div>
        </div>

        <p className="text-xs text-[#5A6760] dark:text-[#96A59E] leading-relaxed mt-2.5">
          {order.note}
        </p>

        <div className="mt-3.5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyPhone}
            className="flex-1 h-10 px-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#15211D] hover:bg-[#F5F7F5] dark:hover:bg-[#1C2C26] text-xs font-medium text-[#111815] dark:text-[#EEF2F0] flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer"
          >
            {copiedPhone ? (
              <>
                <Check
                  className="w-3.5 h-3.5 text-[#0F6B4B] dark:text-[#34D399]"
                  aria-hidden="true"
                />
                <span>Numéro copié</span>
              </>
            ) : (
              <>
                <Phone
                  className="w-3.5 h-3.5 text-[#5A6760] dark:text-[#96A59E]"
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums">
                  {order.courier.phoneDisplay}
                </span>
                <Copy
                  className="w-3 h-3 text-[#7D8A83] dark:text-[#7D8F87]"
                  aria-hidden="true"
                />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onFocusCourier}
            aria-label="Centrer la carte sur le livreur"
            className="h-10 px-3.5 rounded-lg bg-[#EEF3F0] dark:bg-[#1B3128] hover:bg-[#E2EBE6] dark:hover:bg-[#234034] text-[#0F3D2E] dark:text-[#6EE7B7] text-xs font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Localiser</span>
          </button>
        </div>
      </section>

      {/* Section 4: Expandable Turn-by-Turn Route Steps from Google Maps */}
      {route && route.steps.length > 0 && (
        <section className="p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setStepsExpanded((prev) => !prev)}
            aria-expanded={stepsExpanded}
            className="w-full flex items-center justify-between text-left cursor-pointer rounded"
          >
            <div>
              <h2 className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0]">
                Feuille de route détaillée
              </h2>
              <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-0.5 font-mono tabular-nums">
                {route.steps.length} segments routiers ·{' '}
                {formatDistanceFr(route.distanceMeters)}
              </p>
            </div>
            {stepsExpanded ? (
              <ChevronUp
                className="w-4 h-4 text-[#5A6760] dark:text-[#96A59E] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="w-4 h-4 text-[#5A6760] dark:text-[#96A59E] shrink-0"
                aria-hidden="true"
              />
            )}
          </button>

          {stepsExpanded && (
            <ol className="mt-4 divide-y divide-[#EEF1EF] dark:divide-[#1E2B26]">
              {route.steps.map((step, index) => {
                const traveledDist = courierState?.traveledMeters ?? 0;
                const isPassed = traveledDist >= step.cumulativeDistanceMeters;
                return (
                  <li
                    key={step.id}
                    className={cn(
                      'py-2.5 flex items-start justify-between gap-3 text-xs',
                      isPassed
                        ? 'text-[#7B8881] dark:text-[#65756E]'
                        : 'text-[#1E2A24] dark:text-[#D7E0DC]'
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono tabular-nums text-[11px] text-[#7B8881] dark:text-[#72847C] shrink-0 mt-0.5">
                        {String(index + 1).padStart(2, '0')}.
                      </span>
                      <span className={cn(isPassed && 'line-through')}>
                        {step.instruction}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-[#5A6760] dark:text-[#8E9E96] whitespace-nowrap shrink-0 mt-0.5">
                      {formatDistanceFr(step.distanceMeters)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
