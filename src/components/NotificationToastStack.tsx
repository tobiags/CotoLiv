import {AlertTriangle, CheckCircle2, MapPin, X} from 'lucide-react';
import type {DeliveryNotification} from '../types/delivery';
import {cn} from '../utils/cn';

interface NotificationToastStackProps {
  toasts: DeliveryNotification[];
  onDismiss: (id: string) => void;
  onOpenCenter: () => void;
}

/**
 * Renders live delivery notifications as non-intrusive solid-surface toasts.
 * Uses solid/opaque surfaces (no backdrop-filter) so it never degrades WebGL 3D performance.
 */
export function NotificationToastStack({
  toasts,
  onDismiss,
  onOpenCenter,
}: NotificationToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications de livraison en direct"
      className="fixed top-28 sm:top-[116px] right-3 sm:right-5 z-40 w-[calc(100vw-24px)] max-w-sm space-y-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'delivered'
            ? CheckCircle2
            : toast.type === 'delay'
              ? AlertTriangle
              : MapPin;

        const iconTone =
          toast.type === 'delivered'
            ? 'text-[#0F6B4B] dark:text-[#34D399]'
            : toast.type === 'delay'
              ? 'text-[#B45309] dark:text-[#FBBF24]'
              : 'text-[#0F3D2E] dark:text-[#6EE7B7]';

        const borderTone =
          toast.type === 'delivered'
            ? 'border-[#0F6B4B]/40 dark:border-[#34D399]/40'
            : toast.type === 'delay'
              ? 'border-[#D97706]/45 dark:border-[#F59E0B]/45'
              : 'border-[#0F3D2E]/35 dark:border-[#34D399]/35';

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto bg-white dark:bg-[#121D19] border rounded-xl p-3.5 shadow-lg flex items-start gap-3',
              borderTone
            )}
          >
            <Icon
              className={cn('w-4 h-4 shrink-0 mt-0.5', iconTone)}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-[#111815] dark:text-[#EEF2F0]">
                  {toast.title}
                </p>
                <span className="text-[10px] font-mono tabular-nums text-[#64726B] dark:text-[#8A9992] shrink-0">
                  {toast.timestampLabel}
                </span>
              </div>
              <p className="text-xs text-[#4C5952] dark:text-[#B4C0BA] mt-0.5 leading-snug">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={onOpenCenter}
                className="mt-1.5 text-[11px] font-medium text-[#0F6B4B] dark:text-[#34D399] hover:underline cursor-pointer"
              >
                Voir le centre d’alertes
              </button>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fermer cette notification"
              className="w-6 h-6 rounded-md text-[#64726B] dark:text-[#8A9992] hover:bg-[#F3F5F3] dark:hover:bg-[#1D2B26] hover:text-[#111815] dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
