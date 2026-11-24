import {Bell, Moon, Sun} from 'lucide-react';
import type {ThemeMode, WorkspaceView} from '../types/delivery';
import {cn} from '../utils/cn';

interface TopBarProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  onOpenLookup: () => void;
  activeCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  unreadNotifications: number;
  onOpenNotifications: () => void;
}

export function TopBar({
  activeView,
  onChangeView,
  onOpenLookup,
  activeCount,
  theme,
  onToggleTheme,
  unreadNotifications,
  onOpenNotifications,
}: TopBarProps) {
  const navItems: {id: WorkspaceView; label: string; mobileLabel: string}[] = [
    {id: 'live', label: 'Suivi en direct', mobileLabel: 'Suivi'},
    {
      id: 'deliveries',
      label: `Tournées (${activeCount})`,
      mobileLabel: `Tournées`,
    },
    {id: 'planner', label: 'Nouveau trajet', mobileLabel: 'Trajet'},
  ];

  const isDark = theme === 'dark';

  return (
    <header className="h-14 shrink-0 bg-white dark:bg-[#101815] border-b border-[#E3E7E4] dark:border-[#22302A] px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-6 z-30">
      {/* Zone 1: Single-line brand wordmark */}
      <button
        type="button"
        onClick={() => onChangeView('live')}
        className="text-base sm:text-lg font-bold tracking-tight text-[#0F3D2E] dark:text-[#6EE7B7] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D2E] dark:focus-visible:outline-[#34D399] rounded"
        style={{fontFamily: 'var(--font-display)'}}
      >
        CotoLiv
      </button>

      {/* Zone 2: Clean single-line navigation links */}
      <nav
        aria-label="Navigation principale"
        className="flex items-center gap-2.5 sm:gap-7"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative py-4 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D2E] dark:focus-visible:outline-[#34D399]',
                isActive
                  ? 'text-[#0F3D2E] dark:text-[#6EE7B7]'
                  : 'text-[#5A6760] dark:text-[#96A59E] hover:text-[#111815] dark:hover:text-[#EEF2F0]'
              )}
            >
              <span className="sm:hidden">{item.mobileLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0F3D2E] dark:bg-[#34D399]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Theme toggle, Alert Bell, and Primary Action */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-pressed={isDark}
          aria-label={
            isDark
              ? 'Passer en thème clair (carte de jour)'
              : 'Passer en thème sombre (carte de nuit à Cotonou)'
          }
          title={isDark ? 'Mode jour' : 'Mode nuit'}
          className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg border border-[#DFE4E0] dark:border-[#26362F] bg-white dark:bg-[#15211D] hover:bg-[#F3F5F3] dark:hover:bg-[#1D2D27] text-[#2B3731] dark:text-[#D7E0DC] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D2E] dark:focus-visible:outline-[#34D399]"
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#FBBF24]" aria-hidden="true" />
              <span className="hidden md:inline">Jour</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#0F3D2E]" aria-hidden="true" />
              <span className="hidden md:inline">Nuit</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={
            unreadNotifications > 0
              ? `Ouvrir les notifications (${unreadNotifications} non lues)`
              : 'Ouvrir les notifications de livraison'
          }
          className="relative h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg border border-[#DFE4E0] dark:border-[#26362F] bg-white dark:bg-[#15211D] hover:bg-[#F3F5F3] dark:hover:bg-[#1D2D27] text-[#2B3731] dark:text-[#D7E0DC] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D2E] dark:focus-visible:outline-[#34D399]"
        >
          <Bell className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">Alertes</span>
          {unreadNotifications > 0 && (
            <span className="font-mono tabular-nums text-[10px] font-semibold px-1 py-0.5 rounded bg-[#0F3D2E] dark:bg-[#10B981] text-white dark:text-[#071510] leading-none">
              {unreadNotifications}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenLookup}
          className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium text-white dark:text-[#071510] bg-[#0F3D2E] hover:bg-[#0B2E22] dark:bg-[#10B981] dark:hover:bg-[#059669] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D2E] dark:focus-visible:outline-[#34D399]"
        >
          <span className="sm:hidden">Colis</span>
          <span className="hidden sm:inline">Suivre un colis</span>
        </button>
      </div>
    </header>
  );
}
