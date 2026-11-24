import {useMemo, useState} from 'react';
import {ArrowRight, Plus, Search} from 'lucide-react';
import type {DeliveryOrder} from '../types/delivery';
import {cn} from '../utils/cn';

interface DeliveriesListPanelProps {
  orders: DeliveryOrder[];
  selectedOrderId: string;
  progressByOrderId: Record<string, number>;
  onSelectOrder: (orderId: string) => void;
  onCreateNew: () => void;
}

export function DeliveriesListPanel({
  orders,
  selectedOrderId,
  progressByOrderId,
  onSelectOrder,
  onCreateNew,
}: DeliveriesListPanelProps) {
  const [query, setQuery] = useState('');

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      return (
        order.trackingCode.toLowerCase().includes(q) ||
        order.parcelTitle.toLowerCase().includes(q) ||
        order.origin.label.toLowerCase().includes(q) ||
        order.destination.label.toLowerCase().includes(q) ||
        order.courier.name.toLowerCase().includes(q)
      );
    });
  }, [orders, query]);

  return (
    <div className="p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#111815] dark:text-[#EEF2F0]">
            Tournées actives à Cotonou
          </h1>
          <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-0.5">
            Sélectionnez un colis pour visualiser son itinéraire en direct.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="h-9 px-3 rounded-lg bg-[#EEF3F0] dark:bg-[#1B3128] hover:bg-[#E2EBE6] dark:hover:bg-[#234034] text-[#0F3D2E] dark:text-[#6EE7B7] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Créer</span>
        </button>
      </div>

      {/* Live Filter Input */}
      <div className="relative">
        <Search
          className="w-4 h-4 text-[#74827B] dark:text-[#7E9087] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <label htmlFor="deliveries-filter-input" className="sr-only">
          Filtrer les livraisons par code, quartier ou livreur
        </label>
        <input
          id="deliveries-filter-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par quartier, code ou livreur…"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#D8DFDA] dark:border-[#26362F] bg-white dark:bg-[#141F1B] text-sm text-[#111815] dark:text-[#EEF2F0] placeholder:text-[#7E8B84] dark:placeholder:text-[#6F8179] focus:outline-none focus:border-[#0F3D2E] dark:focus:border-[#34D399] focus:ring-2 focus:ring-[#0F3D2E]/15 dark:focus:ring-[#34D399]/20"
        />
      </div>

      {/* Deliveries List */}
      {filteredOrders.length === 0 ? (
        <div className="py-10 text-center border-t border-[#E7EBE8] dark:border-[#202E28]">
          <p className="text-sm font-medium text-[#111815] dark:text-[#EEF2F0]">
            Aucune tournée ne correspond à « {query} »
          </p>
          <p className="text-xs text-[#5A6760] dark:text-[#96A59E] mt-1">
            Essayez un autre quartier de Cotonou ou créez un nouvel itinéraire.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-3 text-xs font-medium text-[#0F3D2E] dark:text-[#6EE7B7] hover:underline cursor-pointer"
          >
            Réinitialiser le filtre
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7EBE8] dark:divide-[#202E28] border-t border-[#E7EBE8] dark:border-[#202E28]">
          {filteredOrders.map((order) => {
            const isSelected = order.id === selectedOrderId;
            const pct = Math.round(
              (progressByOrderId[order.id] ?? order.initialProgress) * 100
            );

            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onSelectOrder(order.id)}
                  className={cn(
                    'w-full text-left py-4 px-2 -mx-2 rounded-lg transition-colors duration-150 cursor-pointer',
                    isSelected
                      ? 'bg-[#F0F5F2] dark:bg-[#162721]'
                      : 'hover:bg-[#F7F9F8] dark:hover:bg-[#14201C]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono tabular-nums font-semibold text-[#0F3D2E] dark:text-[#6EE7B7]">
                      {order.trackingCode}
                    </span>
                    <span className="font-mono tabular-nums text-[#5A6760] dark:text-[#96A59E]">
                      {pct}% parcouru
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[#111815] dark:text-[#EEF2F0] mt-1">
                    {order.parcelTitle}
                  </p>

                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#4C5952] dark:text-[#A4B3AC]">
                    <span className="truncate">{order.origin.label}</span>
                    <ArrowRight
                      className="w-3 h-3 text-[#8C9891] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium text-[#111815] dark:text-[#EEF2F0]">
                      {order.destination.label}
                    </span>
                  </div>

                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#E3E8E5] dark:bg-[#22312B] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0F6B4B] dark:bg-[#10B981] transition-all duration-200"
                      style={{width: `${pct}%`}}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-[#64726B] dark:text-[#8E9E96]">
                    <span>Livreur : {order.courier.name}</span>
                    <span>Départ {order.dispatchedAtLabel}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
