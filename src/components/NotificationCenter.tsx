import {useEffect} from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';
import type {
  DelayIncident,
  DeliveryNotification,
  NotificationPreferences,
} from '../types/delivery';
import {cn} from '../utils/cn';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: DeliveryNotification[];
  preferences: NotificationPreferences;
  onChangeRadius: (radius: 500 | 1000 | 2000) => void;
  onToggleBrowserNotifications: () => void;
  browserPermission: NotificationPermission | 'unsupported';
  onMarkAllRead: () => void;
  onClearAll: () => void;
  activeDelay: DelayIncident | null;
  onToggleSimulateDelay: () => void;
  onSelectOrderFromNotification: (orderId: string) => void;
}

const RADIUS_OPTIONS: {value: 500 | 1000 | 2000; label: string}[] = [
  {value: 500, label: '500 m'},
  {value: 1000, label: '1 km'},
  {value: 2000, label: '2 km'},
];

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  preferences,
  onChangeRadius,
  onToggleBrowserNotifications,
  browserPermission,
  onMarkAllRead,
  onClearAll,
  activeDelay,
  onToggleSimulateDelay,
  onSelectOrderFromNotification,
}: NotificationCenterProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-drawer-title"
      className="fixed inset-0 z-50 bg-[#08120E]/45 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white dark:bg-[#111916] border-l border-[#DFE4E0] dark:border-[#24322C] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7EBE8] dark:border-[#22302A] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2
              id="notifications-drawer-title"
              className="text-base font-bold text-[#111815] dark:text-[#EEF2F0]"
            >
              Alertes de livraison
            </h2>
            <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes les alertes sont à jour'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau des notifications"
            className="w-8 h-8 rounded-lg text-[#5A6760] dark:text-[#96A59E] hover:bg-[#F3F5F3] dark:hover:bg-[#1B2823] hover:text-[#111815] dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Alert Preferences */}
        <div className="px-5 py-4 border-b border-[#E7EBE8] dark:border-[#22302A] space-y-3.5 shrink-0 bg-[#F9FAF9] dark:bg-[#0D1512]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#2B3731] dark:text-[#D7E0DC]">
                Rayon d’alerte de proximité
              </span>
              <span className="text-xs font-mono tabular-nums text-[#0F6B4B] dark:text-[#34D399]">
                {preferences.radiusMeters >= 1000
                  ? `${preferences.radiusMeters / 1000} km`
                  : `${preferences.radiusMeters} m`}
              </span>
            </div>
            <div
              role="group"
              aria-label="Rayon d'alerte autour de la destination"
              className="grid grid-cols-3 gap-1.5"
            >
              {RADIUS_OPTIONS.map((opt) => {
                const active = preferences.radiusMeters === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeRadius(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      'h-8 rounded-lg text-xs font-mono tabular-nums font-medium border transition-colors cursor-pointer',
                      active
                        ? 'bg-[#0F3D2E] text-white border-[#0F3D2E] dark:bg-[#10B981] dark:text-[#071510] dark:border-[#10B981]'
                        : 'bg-white dark:bg-[#141F1B] text-[#2B3731] dark:text-[#CBD5CE] border-[#D8DFDA] dark:border-[#26362F] hover:bg-[#F3F5F3] dark:hover:bg-[#1B2A24]'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#111815] dark:text-[#EEF2F0]">
                Notifications navigateur
              </p>
              <p className="text-[11px] text-[#5A6760] dark:text-[#96A59E]">
                {browserPermission === 'unsupported'
                  ? 'Non pris en charge dans cet environnement'
                  : browserPermission === 'denied'
                    ? 'Autorisation refusée dans le navigateur'
                    : preferences.browserNotificationsEnabled
                      ? 'Actives pour proximité, retards et livraisons'
                      : 'Alertes affichées uniquement dans l’application'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.browserNotificationsEnabled}
              disabled={
                browserPermission === 'unsupported' ||
                browserPermission === 'denied'
              }
              onClick={onToggleBrowserNotifications}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                preferences.browserNotificationsEnabled
                  ? 'bg-[#0F6B4B] dark:bg-[#10B981]'
                  : 'bg-[#CBD3CE] dark:bg-[#2A3A33]'
              )}
            >
              <span
                className={cn(
                  'block w-4 h-4 rounded-full bg-white shadow-xs transition-transform',
                  preferences.browserNotificationsEnabled
                    ? 'translate-x-5'
                    : 'translate-x-1'
                )}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleSimulateDelay}
            className={cn(
              'w-full h-9 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-colors cursor-pointer',
              activeDelay
                ? 'bg-[#FEF3C7] dark:bg-[#3A280A] text-[#92400E] dark:text-[#FCD34D] border-[#F59E0B]/50'
                : 'bg-white dark:bg-[#141F1B] text-[#2B3731] dark:text-[#D7E0DC] border-[#D8DFDA] dark:border-[#26362F] hover:bg-[#F3F5F3] dark:hover:bg-[#1B2A24]'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {activeDelay
                ? `Lever le retard simulé (+${activeDelay.extraMinutes} min)`
                : 'Tester une alerte de retard sur cette tournée'}
            </span>
          </button>
        </div>

        {/* Actions Bar */}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 border-b border-[#EEF1EF] dark:border-[#1E2B26] flex items-center justify-between text-xs shrink-0">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="flex items-center gap-1.5 text-[#0F6B4B] dark:text-[#34D399] hover:underline font-medium cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tout marquer comme lu</span>
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 text-[#5A6760] dark:text-[#96A59E] hover:text-[#111815] dark:hover:text-white cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Effacer</span>
            </button>
          </div>
        )}

        {/* Notification History List */}
        <div className="flex-1 overflow-y-auto cotoliv-scroll">
          {notifications.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Bell
                className="w-8 h-8 text-[#9CA7A1] dark:text-[#4B5E56] mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0]">
                Aucune alerte pour le moment
              </p>
              <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-1.5 leading-relaxed">
                Vous serez averti dès que le livreur entre dans le rayon défini
                autour de la destination, en cas de retard important ou lors de
                la remise du colis.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF1EF] dark:divide-[#1E2B26]">
              {notifications.map((notif) => {
                const Icon =
                  notif.type === 'delivered'
                    ? CheckCircle2
                    : notif.type === 'delay'
                      ? AlertTriangle
                      : MapPin;

                const typeLabel =
                  notif.type === 'delivered'
                    ? 'Livraison effectuée'
                    : notif.type === 'delay'
                      ? 'Retard trafic'
                      : 'Proximité destination';

                const accentClass =
                  notif.type === 'delivered'
                    ? 'text-[#0F6B4B] dark:text-[#34D399]'
                    : notif.type === 'delay'
                      ? 'text-[#B45309] dark:text-[#FBBF24]'
                      : 'text-[#0F3D2E] dark:text-[#6EE7B7]';

                return (
                  <li key={notif.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOrderFromNotification(notif.orderId);
                        onClose();
                      }}
                      className={cn(
                        'w-full text-left px-5 py-3.5 transition-colors cursor-pointer hover:bg-[#F6F8F7] dark:hover:bg-[#16221E]',
                        !notif.read && 'bg-[#F1F7F4] dark:bg-[#13221C]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={cn(
                            'font-semibold flex items-center gap-1.5',
                            accentClass
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{typeLabel}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[#64726B] dark:text-[#8A9992]">
                          {notif.timestampLabel}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mt-1">
                        {notif.title}
                      </p>
                      <p className="text-xs text-[#4C5952] dark:text-[#B4C0BA] mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-[#64726B] dark:text-[#8A9992] mt-1.5">
                        Colis {notif.trackingCode}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
