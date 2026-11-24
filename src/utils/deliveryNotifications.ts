import type {
  DelayIncident,
  DeliveryNotification,
  DeliveryOrder,
  InterpolatedCourierState,
} from '../types/delivery';
import {formatDistanceFr, formatDurationFr} from './routeTracking';

export const SIGNIFICANT_DELAY_THRESHOLD_MIN = 5;

export interface NotificationTriggerKeys {
  proximityKey: string;
  deliveredKey: string;
  delayKey: string | null;
}

export interface EvaluateNotificationInput {
  order: DeliveryOrder;
  courierState: InterpolatedCourierState;
  radiusMeters: number;
  delayIncident: DelayIncident | null;
  triggeredKeys: ReadonlySet<string>;
  nowMs?: number;
}

export interface EvaluateNotificationResult {
  notifications: DeliveryNotification[];
  newTriggeredKeys: string[];
  isWithinProximity: boolean;
}

export function formatTimeLabelFr(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh} h ${mm}`;
}

export function buildTriggerKeys(
  orderId: string,
  radiusMeters: number,
  delayIncident: DelayIncident | null
): NotificationTriggerKeys {
  return {
    proximityKey: `proximity:${orderId}:${radiusMeters}`,
    deliveredKey: `delivered:${orderId}`,
    delayKey: delayIncident
      ? `delay:${orderId}:${delayIncident.extraMinutes}:${delayIncident.reason}`
      : null,
  };
}

/**
 * Pure delivery notification evaluator.
 * Checks three domain events:
 * 1. Proximity geofence: courier is within `radiusMeters` of destination (and not yet delivered).
 * 2. Successful delivery: courier reached destination (`phase === 'delivered'` or progress >= 0.995).
 * 3. Significant delay: active delay incident >= SIGNIFICANT_DELAY_THRESHOLD_MIN minutes.
 */
export function evaluateDeliveryNotifications(
  input: EvaluateNotificationInput
): EvaluateNotificationResult {
  const {
    order,
    courierState,
    radiusMeters,
    delayIncident,
    triggeredKeys,
    nowMs = Date.now(),
  } = input;

  const keys = buildTriggerKeys(order.id, radiusMeters, delayIncident);
  const notifications: DeliveryNotification[] = [];
  const newTriggeredKeys: string[] = [];
  const timestampLabel = formatTimeLabelFr(nowMs);

  const isDelivered =
    courierState.phase === 'delivered' || courierState.progress >= 0.995;
  const isWithinProximity =
    !isDelivered &&
    courierState.remainingMeters <= radiusMeters &&
    courierState.remainingMeters > 0;

  // 1. Significant delay alert
  if (
    delayIncident &&
    delayIncident.extraMinutes >= SIGNIFICANT_DELAY_THRESHOLD_MIN &&
    keys.delayKey &&
    !triggeredKeys.has(keys.delayKey)
  ) {
    const adjustedRemainingMs =
      courierState.remainingMillis + delayIncident.extraMinutes * 60_000;
    notifications.push({
      id: `notif-delay-${order.id}-${nowMs}`,
      orderId: order.id,
      trackingCode: order.trackingCode,
      type: 'delay',
      title: `Retard signalé (+${delayIncident.extraMinutes} min)`,
      message: `${delayIncident.reason}. Nouvelle arrivée estimée vers ${order.destination.label} : ${formatDurationFr(adjustedRemainingMs)}.`,
      timestampLabel,
      createdAtMs: nowMs,
      read: false,
    });
    newTriggeredKeys.push(keys.delayKey);
  }

  // 2. Proximity geofence alert
  if (isWithinProximity && !triggeredKeys.has(keys.proximityKey)) {
    const remainingText = formatDistanceFr(courierState.remainingMeters);
    const radiusText = formatDistanceFr(radiusMeters);
    notifications.push({
      id: `notif-proximity-${order.id}-${radiusMeters}-${nowMs}`,
      orderId: order.id,
      trackingCode: order.trackingCode,
      type: 'proximity',
      title: `Livreur à moins de ${radiusText}`,
      message: `${order.courier.name} entre dans le rayon de ${radiusText} autour de ${order.destination.label} (${remainingText} restants).`,
      timestampLabel,
      createdAtMs: nowMs,
      read: false,
    });
    newTriggeredKeys.push(keys.proximityKey);
  }

  // 3. Successful delivery alert
  if (isDelivered && !triggeredKeys.has(keys.deliveredKey)) {
    notifications.push({
      id: `notif-delivered-${order.id}-${nowMs}`,
      orderId: order.id,
      trackingCode: order.trackingCode,
      type: 'delivered',
      title: 'Colis livré avec succès',
      message: `${order.parcelTitle} (${order.trackingCode}) a été remis à ${order.recipientName} à ${order.destination.label}.`,
      timestampLabel,
      createdAtMs: nowMs,
      read: false,
    });
    newTriggeredKeys.push(keys.deliveredKey);
  }

  return {
    notifications,
    newTriggeredKeys,
    isWithinProximity,
  };
}

/**
 * Curated realistic Cotonou traffic incidents for testing & simulating significant delays.
 */
export const COTONOU_DELAY_PRESETS: Record<
  string,
  {extraMinutes: number; reason: string}
> = {
  'del-dantokpa-fidjrosse': {
    extraMinutes: 9,
    reason: 'Trafic dense au carrefour Étoile Rouge (Cotonou)',
  },
  'del-port-haievive': {
    extraMinutes: 7,
    reason: 'Ralentissement poids lourds sur le Boulevard de la Marina',
  },
  'del-akpakpa-cadjehoun': {
    extraMinutes: 11,
    reason: 'Congestion sur l’Ancien Pont vers Ganhi',
  },
};

export function createDelayIncidentForOrder(
  order: DeliveryOrder,
  nowMs = Date.now()
): DelayIncident {
  const preset = COTONOU_DELAY_PRESETS[order.id] ?? {
    extraMinutes: 8,
    reason: `Ralentissement signalé sur l’axe vers ${order.destination.label}`,
  };
  return {
    orderId: order.id,
    extraMinutes: preset.extraMinutes,
    reason: preset.reason,
    reportedAtLabel: formatTimeLabelFr(nowMs),
  };
}
