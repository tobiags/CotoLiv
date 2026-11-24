import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {APIProvider} from '@vis.gl/react-google-maps';
import {INITIAL_COTONOU_DELIVERIES} from './data/deliveries';
import type {
  DelayIncident,
  DeliveryNotification,
  DeliveryOrder,
  MapViewMode,
  NotificationPreferences,
  ThemeMode,
  WorkspaceView,
} from './types/delivery';
import {useCotonouRoute} from './hooks/useCotonouRoute';
import {clampProgress, interpolateCourierState} from './utils/routeTracking';
import {
  createDelayIncidentForOrder,
  evaluateDeliveryNotifications,
} from './utils/deliveryNotifications';
import {TopBar} from './components/TopBar';
import {DeliveryMap} from './components/DeliveryMap';
import {DeliveryMap3D} from './components/DeliveryMap3D';
import {LiveTrackingPanel} from './components/LiveTrackingPanel';
import {DeliveriesListPanel} from './components/DeliveriesListPanel';
import {CustomRoutePanel} from './components/CustomRoutePanel';
import {TrackingLookupModal} from './components/TrackingLookupModal';
import {NotificationCenter} from './components/NotificationCenter';
import {NotificationToastStack} from './components/NotificationToastStack';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined'
    ? __GOOGLE_MAPS_API_KEY__
    : '');

const THEME_STORAGE_KEY = 'cotoliv-theme-mode';

function getInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage access errors in sandboxed iframes
  }
  return 'light';
}

function getBrowserNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

interface DeliveryWorkspaceProps {
  orders: DeliveryOrder[];
  selectedOrder: DeliveryOrder;
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  onSelectOrder: (orderId: string) => void;
  onCreateDelivery: (order: DeliveryOrder) => void;
  theme: ThemeMode;
  mapMode: MapViewMode;
  onChangeMapMode: (mode: MapViewMode) => void;
  notificationPrefs: NotificationPreferences;
  activeDelayByOrder: Record<string, DelayIncident | null>;
  onToggleSimulateDelay: (order: DeliveryOrder) => void;
  onClearDelay: (orderId: string) => void;
  onOpenNotifications: () => void;
  onEmitNotifications: (items: DeliveryNotification[]) => void;
}

function DeliveryWorkspace({
  orders,
  selectedOrder,
  activeView,
  onChangeView,
  onSelectOrder,
  onCreateDelivery,
  theme,
  mapMode,
  onChangeMapMode,
  notificationPrefs,
  activeDelayByOrder,
  onToggleSimulateDelay,
  onClearDelay,
  onOpenNotifications,
  onEmitNotifications,
}: DeliveryWorkspaceProps) {
  const {route, isLoading, error, retry} = useCotonouRoute(selectedOrder);

  const [progressByOrderId, setProgressByOrderId] = useState<
    Record<string, number>
  >(() => {
    const map: Record<string, number> = {};
    INITIAL_COTONOU_DELIVERIES.forEach((order) => {
      map[order.id] = order.initialProgress;
    });
    return map;
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2 | 4>(1);
  const [followCourier, setFollowCourier] = useState(false);
  const [fitRequestId, setFitRequestId] = useState(0);
  const [focus3DRequestId, setFocus3DRequestId] = useState(0);

  // Deduplication registry for proximity / delivery / delay triggers
  const triggeredKeysRef = useRef<Set<string>>(new Set());

  const currentProgress =
    progressByOrderId[selectedOrder.id] ?? selectedOrder.initialProgress;
  const activeDelay = activeDelayByOrder[selectedOrder.id] ?? null;

  // Register newly created custom delivery initial progress
  useEffect(() => {
    setProgressByOrderId((prev) => {
      if (prev[selectedOrder.id] !== undefined) return prev;
      return {...prev, [selectedOrder.id]: selectedOrder.initialProgress};
    });
  }, [selectedOrder.id, selectedOrder.initialProgress]);

  // Smooth live courier simulation loop along the real Google Maps road polyline
  useEffect(() => {
    if (!isPlaying || !route) return;

    const tickMs = 400;
    // Slow slightly when a significant Cotonou traffic delay is active
    const delayFactor = activeDelay ? 0.55 : 1;
    const progressPerTick = (tickMs / 95_000) * speedMultiplier * delayFactor;

    const timer = window.setInterval(() => {
      setProgressByOrderId((prev) => {
        const current = prev[selectedOrder.id] ?? selectedOrder.initialProgress;
        if (current >= 1) {
          return prev;
        }
        const next = clampProgress(current + progressPerTick);
        if (next >= 1) {
          setIsPlaying(false);
        }
        return {...prev, [selectedOrder.id]: next};
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [
    isPlaying,
    route,
    speedMultiplier,
    selectedOrder.id,
    selectedOrder.initialProgress,
    activeDelay,
  ]);

  const courierState = useMemo(() => {
    if (!route) return null;
    return interpolateCourierState(
      route.path,
      currentProgress,
      route.distanceMeters,
      route.durationMillis
    );
  }, [route, currentProgress]);

  const isWithinProximity = Boolean(
    courierState &&
      courierState.phase !== 'delivered' &&
      courierState.remainingMeters > 0 &&
      courierState.remainingMeters <= notificationPrefs.radiusMeters
  );

  // Evaluate proximity geofence, delivery completion, and significant delay notifications
  useEffect(() => {
    if (!courierState) return;
    const result = evaluateDeliveryNotifications({
      order: selectedOrder,
      courierState,
      radiusMeters: notificationPrefs.radiusMeters,
      delayIncident: activeDelay,
      triggeredKeys: triggeredKeysRef.current,
    });

    if (result.newTriggeredKeys.length > 0) {
      result.newTriggeredKeys.forEach((k) => triggeredKeysRef.current.add(k));
    }
    if (result.notifications.length > 0) {
      onEmitNotifications(result.notifications);
    }
  }, [
    selectedOrder,
    courierState,
    notificationPrefs.radiusMeters,
    activeDelay,
    onEmitNotifications,
  ]);

  const clearOrderTriggerKeys = useCallback((orderId: string) => {
    for (const key of Array.from(triggeredKeysRef.current)) {
      if (key.includes(`:${orderId}`)) {
        triggeredKeysRef.current.delete(key);
      }
    }
  }, []);

  const handleScrubProgress = useCallback(
    (nextValue: number) => {
      const clamped = clampProgress(nextValue);
      setIsPlaying(false);
      // If user scrubs back toward the start, re-arm proximity/delivery notifications cleanly
      if (clamped < 0.5) {
        for (const key of Array.from(triggeredKeysRef.current)) {
          if (
            key.startsWith(`proximity:${selectedOrder.id}:`) ||
            key === `delivered:${selectedOrder.id}`
          ) {
            triggeredKeysRef.current.delete(key);
          }
        }
      }
      setProgressByOrderId((prev) => ({
        ...prev,
        [selectedOrder.id]: clamped,
      }));
    },
    [selectedOrder.id]
  );

  const handleTogglePlay = useCallback(() => {
    if (currentProgress >= 1) {
      clearOrderTriggerKeys(selectedOrder.id);
      setProgressByOrderId((prev) => ({...prev, [selectedOrder.id]: 0}));
      setIsPlaying(true);
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [currentProgress, selectedOrder.id, clearOrderTriggerKeys]);

  const handleRestart = useCallback(() => {
    clearOrderTriggerKeys(selectedOrder.id);
    setProgressByOrderId((prev) => ({...prev, [selectedOrder.id]: 0}));
    setIsPlaying(true);
  }, [selectedOrder.id, clearOrderTriggerKeys]);

  const handleFocusCourier = useCallback(() => {
    setFollowCourier(true);
    setFocus3DRequestId((id) => id + 1);
  }, []);

  const handleFitFullRoute = useCallback(() => {
    setFollowCourier(false);
    setFitRequestId((id) => id + 1);
  }, []);

  return (
    <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
      {/* Editorial Tracking Sidebar */}
      <aside className="order-2 lg:order-1 flex-1 min-h-0 lg:flex-none w-full lg:w-[410px] xl:w-[430px] shrink-0 bg-white dark:bg-[#111916] border-t lg:border-t-0 lg:border-r border-[#E3E7E4] dark:border-[#22302A] overflow-y-auto cotoliv-scroll">
        {activeView === 'live' && (
          <LiveTrackingPanel
            order={selectedOrder}
            route={route}
            courierState={courierState}
            progress={currentProgress}
            isLoadingRoute={isLoading}
            onScrubProgress={handleScrubProgress}
            onFocusCourier={handleFocusCourier}
            onOpenDeliveries={() => onChangeView('deliveries')}
            theme={theme}
            radiusMeters={notificationPrefs.radiusMeters}
            isWithinProximity={isWithinProximity}
            delayIncident={activeDelay}
            onClearDelay={() => onClearDelay(selectedOrder.id)}
            onOpenNotifications={onOpenNotifications}
          />
        )}

        {activeView === 'deliveries' && (
          <DeliveriesListPanel
            orders={orders}
            selectedOrderId={selectedOrder.id}
            progressByOrderId={progressByOrderId}
            onSelectOrder={(orderId) => {
              onSelectOrder(orderId);
              onChangeView('live');
            }}
            onCreateNew={() => onChangeView('planner')}
          />
        )}

        {activeView === 'planner' && (
          <CustomRoutePanel
            onCreateDelivery={(newOrder) => {
              onCreateDelivery(newOrder);
              onChangeView('live');
            }}
            onCancel={() => onChangeView('live')}
          />
        )}
      </aside>

      {/* Primary Interactive Map Stage (3D Cotonou Three.js Scene OR Google Maps 2D) */}
      <section
        aria-label={
          mapMode === '3d'
            ? 'Carte 3D interactive de Cotonou'
            : 'Carte Google Maps en direct de Cotonou'
        }
        className="order-1 lg:order-2 h-[42vh] min-h-[280px] shrink-0 lg:shrink lg:flex-1 lg:h-full relative overflow-hidden"
      >
        {mapMode === '3d' ? (
          <DeliveryMap3D
            order={selectedOrder}
            route={route}
            courierState={courierState}
            isLoadingRoute={isLoading}
            routeError={error}
            onRetryRoute={retry}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onRestart={handleRestart}
            speedMultiplier={speedMultiplier}
            onChangeSpeed={setSpeedMultiplier}
            theme={theme}
            mapMode={mapMode}
            onChangeMapMode={onChangeMapMode}
            radiusMeters={notificationPrefs.radiusMeters}
            isWithinProximity={isWithinProximity}
            delayIncident={activeDelay}
            onToggleSimulateDelay={() => onToggleSimulateDelay(selectedOrder)}
            focusRequestId={focus3DRequestId}
          />
        ) : (
          <DeliveryMap
            order={selectedOrder}
            route={route}
            courierState={courierState}
            isLoadingRoute={isLoading}
            routeError={error}
            onRetryRoute={retry}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onRestart={handleRestart}
            speedMultiplier={speedMultiplier}
            onChangeSpeed={setSpeedMultiplier}
            followCourier={followCourier}
            onToggleFollowCourier={() => setFollowCourier((prev) => !prev)}
            fitRequestId={fitRequestId}
            onFitFullRoute={handleFitFullRoute}
            theme={theme}
            mapMode={mapMode}
            onChangeMapMode={onChangeMapMode}
            radiusMeters={notificationPrefs.radiusMeters}
            isWithinProximity={isWithinProximity}
            delayIncident={activeDelay}
            onToggleSimulateDelay={() => onToggleSimulateDelay(selectedOrder)}
          />
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [orders, setOrders] = useState<DeliveryOrder[]>(
    INITIAL_COTONOU_DELIVERIES
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    INITIAL_COTONOU_DELIVERIES[0].id
  );
  const [activeView, setActiveView] = useState<WorkspaceView>('live');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Dark / Light theme state synced with Tailwind v4 `.dark` class on <html>
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  // Default to 3D Cotonou Map with one-click toggle to Google Maps 2D
  const [mapMode, setMapMode] = useState<MapViewMode>('3d');

  // Delivery Notification Center & Preferences
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPreferences>({
      radiusMeters: 1000,
      browserNotificationsEnabled: false,
    });
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(getBrowserNotificationPermission);
  const [notifications, setNotifications] = useState<DeliveryNotification[]>(
    []
  );
  const [toasts, setToasts] = useState<DeliveryNotification[]>([]);
  const [activeDelayByOrder, setActiveDelayByOrder] = useState<
    Record<string, DelayIncident | null>
  >({});

  // Sync Tailwind dark mode class & localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  // Top-level quota banner listener
  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? orders[0],
    [orders, selectedOrderId]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
  }, []);

  const handleCreateDelivery = useCallback((newOrder: DeliveryOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrderId(newOrder.id);
  }, []);

  const handleEmitNotifications = useCallback(
    (incoming: DeliveryNotification[]) => {
      if (incoming.length === 0) return;

      setNotifications((prev) => [...incoming, ...prev].slice(0, 30));
      setToasts((prev) => [...incoming, ...prev].slice(0, 3));

      // Auto-dismiss live toasts after 7.5 seconds while keeping full history in NotificationCenter
      incoming.forEach((item) => {
        window.setTimeout(() => {
          setToasts((curr) => curr.filter((t) => t.id !== item.id));
        }, 7500);
      });

      // Dispatch native Browser Web Notification if opted in & granted
      if (
        notificationPrefs.browserNotificationsEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        incoming.forEach((item) => {
          try {
            new window.Notification(`CotoLiv · ${item.title}`, {
              body: item.message,
              tag: item.id,
            });
          } catch {
            // Ignore browser Notification constructor restrictions inside iframes
          }
        });
      }
    },
    [notificationPrefs.browserNotificationsEnabled]
  );

  const handleToggleBrowserNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return;
    }

    if (notificationPrefs.browserNotificationsEnabled) {
      setNotificationPrefs((prev) => ({
        ...prev,
        browserNotificationsEnabled: false,
      }));
      return;
    }

    if (window.Notification.permission === 'granted') {
      setBrowserPermission('granted');
      setNotificationPrefs((prev) => ({
        ...prev,
        browserNotificationsEnabled: true,
      }));
      return;
    }

    try {
      const perm = await window.Notification.requestPermission();
      setBrowserPermission(perm);
      setNotificationPrefs((prev) => ({
        ...prev,
        browserNotificationsEnabled: perm === 'granted',
      }));
    } catch {
      setBrowserPermission('denied');
    }
  }, [notificationPrefs.browserNotificationsEnabled]);

  const handleToggleSimulateDelay = useCallback((order: DeliveryOrder) => {
    setActiveDelayByOrder((prev) => {
      const existing = prev[order.id];
      if (existing) {
        return {...prev, [order.id]: null};
      }
      return {
        ...prev,
        [order.id]: createDelayIncidentForOrder(order),
      };
    });
  }, []);

  const handleClearDelay = useCallback((orderId: string) => {
    setActiveDelayByOrder((prev) => ({...prev, [orderId]: null}));
  }, []);

  const handleOpenNotifications = useCallback(() => {
    setNotificationsOpen(true);
    setToasts([]);
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({...n, read: true})));
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
    setToasts([]);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F6F7F5] dark:bg-[#0B1210] text-[#111815] dark:text-[#EEF2F0]">
      {quotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/90 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 dark:text-amber-50 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <TopBar
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenLookup={() => setLookupOpen(true)}
        activeCount={orders.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        unreadNotifications={unreadCount}
        onOpenNotifications={handleOpenNotifications}
      />

      {GOOGLE_MAPS_API_KEY ? (
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          language="fr"
          region="BJ"
          libraries={['maps', 'marker', 'routes', 'places']}
        >
          <DeliveryWorkspace
            orders={orders}
            selectedOrder={selectedOrder}
            activeView={activeView}
            onChangeView={setActiveView}
            onSelectOrder={handleSelectOrder}
            onCreateDelivery={handleCreateDelivery}
            theme={theme}
            mapMode={mapMode}
            onChangeMapMode={setMapMode}
            notificationPrefs={notificationPrefs}
            activeDelayByOrder={activeDelayByOrder}
            onToggleSimulateDelay={handleToggleSimulateDelay}
            onClearDelay={handleClearDelay}
            onOpenNotifications={handleOpenNotifications}
            onEmitNotifications={handleEmitNotifications}
          />
        </APIProvider>
      ) : (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md bg-white dark:bg-[#111916] border border-[#DCE2DE] dark:border-[#24322C] rounded-xl p-6 text-center shadow-xs">
            <h1 className="text-lg font-bold text-[#111815] dark:text-[#EEF2F0]">
              Configuration Google Maps requise
            </h1>
            <p className="text-sm text-[#5A6760] dark:text-[#96A59E] mt-2 leading-relaxed">
              La clé API Google Maps Platform (
              <code className="font-mono text-xs text-[#0F3D2E] dark:text-[#6EE7B7]">
                VITE_GOOGLE_MAPS_API_KEY
              </code>
              ) n’est pas encore disponible dans l’environnement. Activez Google
              Maps Platform dans les paramètres de l’application puis rechargez.
            </p>
          </div>
        </main>
      )}

      <NotificationToastStack
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }
        onOpenCenter={handleOpenNotifications}
      />

      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        preferences={notificationPrefs}
        onChangeRadius={(radius) =>
          setNotificationPrefs((prev) => ({...prev, radiusMeters: radius}))
        }
        onToggleBrowserNotifications={() => {
          void handleToggleBrowserNotifications();
        }}
        browserPermission={browserPermission}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAllNotifications}
        activeDelay={activeDelayByOrder[selectedOrder.id] ?? null}
        onToggleSimulateDelay={() => handleToggleSimulateDelay(selectedOrder)}
        onSelectOrderFromNotification={(orderId) => {
          handleSelectOrder(orderId);
          setActiveView('live');
        }}
      />

      <TrackingLookupModal
        isOpen={lookupOpen}
        orders={orders}
        onClose={() => setLookupOpen(false)}
        onSelectOrder={(orderId) => {
          handleSelectOrder(orderId);
          setActiveView('live');
        }}
      />
    </div>
  );
}
