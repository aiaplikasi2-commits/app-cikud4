import React from 'react';
import {
  PengaturanIcon,
  SuratIcon,
  SiswaIcon,
  GuruIcon,
  TendikIcon,
  AbsenSiswaIcon,
  ManajemenAkunIcon,
  AgendaHarianIcon,
} from './MenuIcons';

export interface MenuItem {
  id: string;
  title: string;
  description: string;
  cardClass: string;
  titleClass: string;
  descClass: string;
  accentColor: string;
  icon: React.ReactNode;
}

export const BASE_MENU_ITEMS: MenuItem[] = [
  {
    id: 'pengaturan',
    title: 'Pengaturan',
    description: 'Identitas & Kop',
    cardClass:
      'bg-gradient-to-br from-[#8CF4FC] via-[#41D8EA] to-[#1EBED4] border-[#5BE7F5]/90 shadow-[0_10px_24px_-6px_rgba(30,190,212,0.45)] hover:shadow-[0_16px_32px_-6px_rgba(30,190,212,0.58)]',
    titleClass: 'text-[#072636]',
    descClass: 'text-[#0D3D54] font-semibold',
    accentColor: 'rgba(255,255,255,0.42)',
    icon: <PengaturanIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
  {
    id: 'surat',
    title: 'Surat',
    description: 'Persuratan & Arsip',
    cardClass:
      'bg-gradient-to-br from-[#FFE3B3] via-[#F7BE72] to-[#E59337] border-[#FFD38C]/90 shadow-[0_10px_24px_-6px_rgba(229,147,55,0.45)] hover:shadow-[0_16px_32px_-6px_rgba(229,147,55,0.58)]',
    titleClass: 'text-[#2D1804]',
    descClass: 'text-[#4F2D0A] font-semibold',
    accentColor: 'rgba(255,255,255,0.42)',
    icon: <SuratIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
  {
    id: 'siswa',
    title: 'Siswa',
    description: 'Data Siswa',
    cardClass:
      'bg-gradient-to-br from-[#4BB4FF] via-[#1E7CEB] to-[#0F53BD] border-[#78C7FF]/75 shadow-[0_10px_24px_-6px_rgba(15,83,189,0.45)] hover:shadow-[0_16px_32px_-6px_rgba(15,83,189,0.6)]',
    titleClass: 'text-white drop-shadow-[0_1px_2px_rgba(7,25,65,0.4)]',
    descClass: 'text-blue-50 font-medium',
    accentColor: 'rgba(255,255,255,0.22)',
    icon: <SiswaIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
  {
    id: 'guru',
    title: 'Guru',
    description: 'Data Guru',
    cardClass:
      'bg-gradient-to-br from-[#35D57C] via-[#11A353] to-[#087338] border-[#6DE7A3]/75 shadow-[0_10px_24px_-6px_rgba(8,115,56,0.44)] hover:shadow-[0_16px_32px_-6px_rgba(8,115,56,0.58)]',
    titleClass: 'text-white drop-shadow-[0_1px_2px_rgba(3,42,20,0.4)]',
    descClass: 'text-emerald-50 font-medium',
    accentColor: 'rgba(255,255,255,0.22)',
    icon: <GuruIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
  {
    id: 'tendik',
    title: 'Tendik',
    description: 'Data Tendik',
    cardClass:
      'bg-gradient-to-br from-[#B188FC] via-[#7E46DC] to-[#5B27B5] border-[#CFAFFF]/75 shadow-[0_10px_24px_-6px_rgba(91,39,181,0.44)] hover:shadow-[0_16px_32px_-6px_rgba(91,39,181,0.58)]',
    titleClass: 'text-white drop-shadow-[0_1px_2px_rgba(32,10,70,0.4)]',
    descClass: 'text-purple-50 font-medium',
    accentColor: 'rgba(255,255,255,0.22)',
    icon: <TendikIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
  {
    id: 'absen-siswa',
    title: 'Absen Siswa',
    description: 'Daftar Hadir',
    cardClass:
      'bg-gradient-to-br from-[#FF867E] via-[#EF4E47] to-[#CC2B25] border-[#FFB0AA]/75 shadow-[0_10px_24px_-6px_rgba(204,43,37,0.44)] hover:shadow-[0_16px_32px_-6px_rgba(204,43,37,0.58)]',
    titleClass: 'text-white drop-shadow-[0_1px_2px_rgba(70,10,10,0.4)]',
    descClass: 'text-rose-50 font-medium',
    accentColor: 'rgba(255,255,255,0.22)',
    icon: <AbsenSiswaIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
  {
    id: 'agenda-harian',
    title: 'Agenda Harian',
    description: 'Jadwal & Kegiatan',
    cardClass:
      'bg-gradient-to-br from-[#2EE6CE] via-[#0EA89B] to-[#087770] border-[#79F4E3]/80 shadow-[0_10px_24px_-6px_rgba(8,119,112,0.44)] hover:shadow-[0_16px_32px_-6px_rgba(8,119,112,0.58)]',
    titleClass: 'text-white drop-shadow-[0_1px_2px_rgba(4,47,46,0.42)]',
    descClass: 'text-teal-50 font-medium',
    accentColor: 'rgba(255,255,255,0.24)',
    icon: <AgendaHarianIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
];

export const OPERATOR_MENU_ITEMS: MenuItem[] = [
  ...BASE_MENU_ITEMS,
  {
    id: 'manajemen-akun-guru',
    title: 'Akun Guru',
    description: 'Kelola Akun',
    cardClass:
      'bg-gradient-to-br from-[#A1B6FF] via-[#6882F5] to-[#445AD4] border-[#C4D1FF]/80 shadow-[0_10px_24px_-6px_rgba(68,90,212,0.44)] hover:shadow-[0_16px_32px_-6px_rgba(68,90,212,0.58)]',
    titleClass: 'text-white drop-shadow-[0_1px_2px_rgba(20,28,85,0.4)]',
    descClass: 'text-indigo-50 font-medium',
    accentColor: 'rgba(255,255,255,0.24)',
    icon: <ManajemenAkunIcon className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />,
  },
];

export const GURU_MENU_ITEMS: MenuItem[] = BASE_MENU_ITEMS.filter((item) =>
  ['siswa', 'guru', 'absen-siswa', 'agenda-harian'].includes(item.id)
);

interface MenuGridProps {
  selectedMenuId: string | null;
  onSelectMenu: (menu: MenuItem) => void;
  items?: MenuItem[];
}

export const MenuGrid: React.FC<MenuGridProps> = ({
  selectedMenuId,
  onSelectMenu,
  items = OPERATOR_MENU_ITEMS,
}) => {
  return (
    <section aria-label="Menu Utama" className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4.5">
        {items.map((item) => {
          const isSelected = selectedMenuId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMenu(item)}
              aria-pressed={isSelected}
              className={`group relative overflow-hidden flex flex-col items-center justify-center text-center rounded-[22px] border px-3 py-4 sm:px-5 sm:py-5 min-h-[150px] sm:min-h-[170px] ring-1 ring-inset ring-white/45 transition-all duration-200 ease-out hover:-translate-y-1 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer ${
                item.cardClass
              } ${isSelected ? 'ring-2 ring-[#17325C]' : ''}`}
            >
              {/* Soft inner luminous radial glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 w-36 h-24 rounded-full blur-2xl opacity-75 transition-opacity duration-200 group-hover:opacity-100"
                style={{ backgroundColor: item.accentColor }}
              />

              {/* Subtle corner concentric rings */}
              <svg
                aria-hidden="true"
                viewBox="0 0 120 120"
                className="pointer-events-none absolute -top-5 -right-5 w-24 h-24 opacity-20 text-white"
                fill="none"
              >
                <circle cx="80" cy="40" r="36" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="80" cy="40" r="24" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="80" cy="40" r="12" stroke="currentColor" strokeWidth="1.4" />
              </svg>

              {/* Subtle bottom-left geometric lines */}
              <svg
                aria-hidden="true"
                viewBox="0 0 80 80"
                className="pointer-events-none absolute -bottom-3 -left-3 w-16 h-16 opacity-20 text-white"
                fill="none"
              >
                <path
                  d="M0 70L35 35M0 56L28 28M0 42L21 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              {/* Subtle glossy sheen on hover */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/15 to-white/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />

              <div className="relative z-10 mb-2 sm:mb-2.5 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-translate-y-0.5">
                {item.icon}
              </div>
              <span
                className={`relative z-10 text-[15px] sm:text-[17px] font-extrabold tracking-tight leading-snug ${item.titleClass}`}
              >
                {item.title}
              </span>
              <span
                className={`relative z-10 mt-0.5 text-[11px] sm:text-xs leading-tight ${item.descClass}`}
              >
                {item.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
