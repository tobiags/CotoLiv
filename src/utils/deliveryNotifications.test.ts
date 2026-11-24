import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  createDelayIncidentForOrder,
  evaluateDeliveryNotifications,
} from './deliveryNotifications.ts';
import type {DeliveryOrder, InterpolatedCourierState} from '../types/delivery.ts';

const MOCK_ORDER: DeliveryOrder = {
  id: 'del-dantokpa-fidjrosse',
  trackingCode: 'CTL-2026-841',
  parcelTitle: 'Colis textile wax',
  parcelCategory: 'Mode',
  weightLabel: '2,4 kg',
  recipientName: 'Nadine Soglo',
  senderName: 'Atelier Dantokpa',
  dispatchedAtLabel: '14 h 10',
  initialProgress: 0.25,
  origin: {label: 'Marché Dantokpa', query: 'Marché Dantokpa, Cotonou'},
  destination: {label: 'Fidjrossè Plage', query: 'Fidjrossè Plage, Cotonou'},
  courier: {
    name: 'Kossi Mensah',
    vehicle: 'Moto Express 125cc',
    plate: 'BJ · 4821 · LT',
    phoneDisplay: '+229 01 97 42 18 05',
    avatarUrl: '',
    initials: 'KM',
  },
  note: 'Appeler à l’arrivée',
};

function makeState(
  overrides: Partial<InterpolatedCourierState>
): InterpolatedCourierState {
  return {
    position: {lat: 6.36, lng: 2.38},
    heading: 240,
    progress: 0.5,
    traveledPath: [],
    remainingPath: [],
    traveledMeters: 3000,
    remainingMeters: 3000,
    remainingMillis: 600_000,
    phase: 'en_route',
    ...overrides,
  };
}

describe('evaluateDeliveryNotifications', () => {
  it('triggers a proximity alert once when remaining distance enters the configured radius', () => {
    const triggered = new Set<string>();
    const farResult = evaluateDeliveryNotifications({
      order: MOCK_ORDER,
      courierState: makeState({remainingMeters: 1600, progress: 0.72}),
      radiusMeters: 1000,
      delayIncident: null,
      triggeredKeys: triggered,
      nowMs: 1_700_000_000_000,
    });
    assert.equal(farResult.notifications.length, 0);
    assert.equal(farResult.isWithinProximity, false);

    const nearResult = evaluateDeliveryNotifications({
      order: MOCK_ORDER,
      courierState: makeState({remainingMeters: 820, progress: 0.86}),
      radiusMeters: 1000,
      delayIncident: null,
      triggeredKeys: triggered,
      nowMs: 1_700_000_010_000,
    });
    assert.equal(nearResult.isWithinProximity, true);
    assert.equal(nearResult.notifications.length, 1);
    assert.equal(nearResult.notifications[0].type, 'proximity');

    // Deduplicate on subsequent ticks
    nearResult.newTriggeredKeys.forEach((k) => triggered.add(k));
    const repeatResult = evaluateDeliveryNotifications({
      order: MOCK_ORDER,
      courierState: makeState({remainingMeters: 500, progress: 0.91}),
      radiusMeters: 1000,
      delayIncident: null,
      triggeredKeys: triggered,
      nowMs: 1_700_000_020_000,
    });
    assert.equal(repeatResult.notifications.length, 0);
  });

  it('triggers a delivered alert when progress reaches 100%', () => {
    const result = evaluateDeliveryNotifications({
      order: MOCK_ORDER,
      courierState: makeState({
        remainingMeters: 0,
        remainingMillis: 0,
        progress: 1,
        phase: 'delivered',
      }),
      radiusMeters: 1000,
      delayIncident: null,
      triggeredKeys: new Set(),
      nowMs: 1_700_000_050_000,
    });
    assert.equal(result.isWithinProximity, false);
    assert.equal(result.notifications.length, 1);
    assert.equal(result.notifications[0].type, 'delivered');
    assert.match(result.notifications[0].message, /Nadine Soglo/);
  });

  it('triggers a delay alert when an active delay incident is significant', () => {
    const incident = createDelayIncidentForOrder(MOCK_ORDER, 1_700_000_000_000);
    assert.ok(incident.extraMinutes >= 5);

    const result = evaluateDeliveryNotifications({
      order: MOCK_ORDER,
      courierState: makeState({remainingMeters: 2500, remainingMillis: 480_000}),
      radiusMeters: 1000,
      delayIncident: incident,
      triggeredKeys: new Set(),
      nowMs: 1_700_000_000_000,
    });
    assert.equal(result.notifications.length, 1);
    assert.equal(result.notifications[0].type, 'delay');
    assert.match(result.notifications[0].title, /\+9 min/);
  });
});
