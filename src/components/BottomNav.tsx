import React from 'react';
import { Home, User } from 'lucide-react';

export type NavTabId = 'beranda' | 'profil';

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    fill?: string;
  }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'profil', label: 'Profil', icon: User },
];

interface BottomNavProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav
      aria-label="Navigasi Utama"
      className="print-hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(15,35,66,0.08)] pb-[env(safe-area-inset-bottom)] md:max-w-xs md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-2xl md:border md:border-white/90 md:shadow-[0_12px_32px_rgba(15,35,66,0.12)] md:pb-0"
    >
      <div className="grid grid-cols-2 items-stretch">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center min-h-[56px] px-3 py-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-[#1D63D8]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9]"
                />
              )}

              <IconComponent
                className="w-[21px] h-[21px] shrink-0"
                strokeWidth={isActive ? 2.2 : 1.8}
                fill={isActive && item.id === 'beranda' ? 'currentColor' : 'none'}
              />
              <span
                className={`mt-1 text-[11px] leading-none whitespace-nowrap ${
                  isActive
                    ? 'font-bold text-[#1D63D8]'
                    : 'font-medium text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
