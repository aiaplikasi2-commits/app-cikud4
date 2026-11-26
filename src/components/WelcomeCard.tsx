import React from 'react';
import { Bell, CalendarCheck2 } from 'lucide-react';
import { AdminAvatarIcon } from './MenuIcons';

interface WelcomeCardProps {
  onNotificationClick: () => void;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({ onNotificationClick }) => {
  return (
    <section
      aria-label="Sambutan Administrator"
      className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] px-4 py-3.5 sm:px-5 sm:py-4"
    >
      {/* Baris Profil Administrator & Notifikasi */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
          <AdminAvatarIcon className="w-11 h-11 sm:w-12 sm:h-12 shrink-0" />

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] sm:text-base font-bold text-slate-900 whitespace-nowrap">
                Selamat Datang,
              </span>
              <span
                aria-label="Area nama administrator"
                className="inline-block h-4 w-24 sm:w-36 rounded-md bg-slate-100 border border-slate-200/70"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-[13px] font-medium text-slate-500 whitespace-nowrap">
                NIP.
              </span>
              <span
                aria-label="Area NIP administrator"
                className="inline-block h-3.5 w-32 sm:w-44 rounded-md bg-slate-100 border border-slate-200/70"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNotificationClick}
          aria-label="Notifikasi"
          className="min-w-[44px] min-h-[44px] shrink-0 rounded-xl flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/70 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Bell className="w-5 h-5" strokeWidth={1.9} />
        </button>
      </div>

      {/* Garis Pemisah */}
      <div className="my-3 border-t border-slate-100" />

      {/* Ringkasan Kehadiran Siswa Hari Ini */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <CalendarCheck2
          className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-[#3B6EA5] shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">
          Kehadiran Siswa Hari Ini:
        </span>
        <span
          aria-label="Area ringkasan kehadiran siswa hari ini"
          className="inline-block h-4 w-28 sm:w-36 rounded-md bg-slate-100 border border-slate-200/70"
        />
      </div>
    </section>
  );
};
