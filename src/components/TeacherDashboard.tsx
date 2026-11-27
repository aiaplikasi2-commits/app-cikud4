import React from 'react';
import { AlertCircle, LogOut } from 'lucide-react';
import type { AuthUser, PublicSchoolInfo } from '../types/auth';
import { SchoolHeader } from './SchoolHeader';
import { GURU_MENU_ITEMS, MenuGrid, MenuItem } from './MenuGrid';
import { AdminAvatarIcon } from './MenuIcons';

interface TeacherDashboardProps {
  user: AuthUser;
  school: PublicSchoolInfo;
  selectedMenuId: string | null;
  onSelectMenu: (menu: MenuItem) => void;
  onOpenProfil?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  user,
  school,
  selectedMenuId,
  onSelectMenu,
  onOpenProfil,
  onLogout,
  loggingOut = false,
}) => {
  const assignedClass = (user.assignedClass || '').trim();

  return (
    <div className="space-y-4 sm:space-y-5">
      <SchoolHeader
        identity={{
          schoolName: school.schoolName,
          city: school.city,
          department: school.department,
          academicYear: '',
        }}
        logoUrl={school.logoUrl}
      />

      {/* Bilah Identitas Guru */}
      <section
        aria-label="Informasi Akun Guru"
        className="rounded-2xl bg-white/92 backdrop-blur-md border border-white/90 shadow-[0_6px_24px_rgba(15,35,66,0.06)] p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AdminAvatarIcon className="w-11 h-11 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-sm sm:text-base font-extrabold text-[#17325C] truncate">
                  {user.fullName}
                </h2>
                <span aria-hidden="true" className="text-slate-300 text-xs">
                  ·
                </span>
                <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                  Guru
                </span>
                <span aria-hidden="true" className="text-slate-300 text-xs">
                  ·
                </span>
                <span
                  className={`text-xs font-bold whitespace-nowrap ${
                    assignedClass ? 'text-[#1D63D8]' : 'text-amber-700'
                  }`}
                >
                  {assignedClass
                    ? `Kelas ${assignedClass}`
                    : 'Kelas Belum Dipilih'}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-600 tabular-nums">
                <span>NIP: {user.nip || '-'}</span>
                <span aria-hidden="true">·</span>
                <span>{user.username}</span>
                {user.email && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{user.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="self-start sm:self-center inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#FF5B4D] to-[#DC3026] hover:brightness-105 disabled:opacity-60 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_14px_rgba(220,48,38,0.28)] active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap min-h-[40px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Keluar...' : 'Logout'}
          </button>
        </div>

        {!assignedClass && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Pilih kelas yang Anda pegang di Profil agar data siswa &amp;
                absen kelas tampil.
              </span>
            </div>
            {onOpenProfil && (
              <button
                type="button"
                onClick={onOpenProfil}
                className="rounded-lg border border-amber-300 bg-white hover:bg-amber-100 px-3 py-1.5 font-bold text-amber-900 cursor-pointer whitespace-nowrap min-h-[36px]"
              >
                Pilih Kelas
              </button>
            )}
          </div>
        )}
      </section>

      {/* Menu Khusus Guru */}
      <MenuGrid
        items={GURU_MENU_ITEMS}
        selectedMenuId={selectedMenuId}
        onSelectMenu={onSelectMenu}
      />
    </div>
  );
};
