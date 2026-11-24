import {type FormEvent, useEffect, useState} from 'react';
import {X} from 'lucide-react';
import type {DeliveryOrder} from '../types/delivery';

interface TrackingLookupModalProps {
  isOpen: boolean;
  orders: DeliveryOrder[];
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export function TrackingLookupModal({
  isOpen,
  orders,
  onClose,
  onSelectOrder,
}: TrackingLookupModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    setError(null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toLowerCase();
    if (!cleaned) {
      setError('Saisissez un numéro de suivi CotoLiv (ex. CTL-2026-841).');
      return;
    }

    const match = orders.find(
      (order) =>
        order.trackingCode.toLowerCase() === cleaned ||
        order.trackingCode.toLowerCase().includes(cleaned)
    );

    if (!match) {
      setError(
        `Aucun colis actif trouvé pour « ${code.trim()} ». Essayez l’un des codes actifs ci-dessous.`
      );
      return;
    }

    onSelectOrder(match.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lookup-modal-title"
      className="fixed inset-0 z-50 bg-[#08120E]/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111916] border border-[#DCE2DE] dark:border-[#24322C] rounded-xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="lookup-modal-title"
              className="text-base font-bold text-[#111815] dark:text-[#EEF2F0]"
            >
              Suivre un colis à Cotonou
            </h2>
            <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-1">
              Entrez votre référence pour localiser le livreur et voir d’où
              vient votre colis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre de suivi"
            className="w-8 h-8 rounded-lg text-[#5A6760] dark:text-[#96A59E] hover:bg-[#F3F5F3] dark:hover:bg-[#1B2823] hover:text-[#111815] dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          <label
            htmlFor="tracking-code-lookup"
            className="block text-xs font-medium text-[#2B3731] dark:text-[#C8D4CE] mb-1.5"
          >
            Numéro de suivi
          </label>
          <div className="flex items-center gap-2">
            <input
              id="tracking-code-lookup"
              type="text"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex. CTL-2026-841"
              className="flex-1 h-10 px-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] text-sm font-mono uppercase text-[#111815] dark:text-[#EEF2F0] placeholder:font-sans placeholder:normal-case placeholder:text-[#7E8B84] dark:placeholder:text-[#6F8179] focus:outline-none focus:border-[#0F3D2E] dark:focus:border-[#34D399] focus:ring-2 focus:ring-[#0F3D2E]/15 dark:focus:ring-[#34D399]/20"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-[#0F3D2E] hover:bg-[#0B2E22] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#071510] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Localiser
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="text-xs text-[#A32222] dark:text-[#FCA5A5] mt-2"
            >
              {error}
            </p>
          )}
        </form>

        <div className="mt-5 pt-4 border-t border-[#E7EBE8] dark:border-[#202E28]">
          <p className="text-xs font-medium text-[#5A6760] dark:text-[#96A59E] mb-2.5">
            Livraisons en cours disponibles
          </p>
          <ul className="divide-y divide-[#EEF1EF] dark:divide-[#1E2B26]">
            {orders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectOrder(order.id);
                    onClose();
                  }}
                  className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:bg-[#F5F7F5] dark:hover:bg-[#16231F] px-2 -mx-2 rounded-md transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-mono tabular-nums font-semibold text-[#0F3D2E] dark:text-[#6EE7B7]">
                      {order.trackingCode}
                    </span>
                    <p className="text-xs text-[#4C5952] dark:text-[#A4B3AC] truncate mt-0.5">
                      {order.origin.label} → {order.destination.label}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#0F3D2E] dark:text-[#6EE7B7] shrink-0">
                    Afficher
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
