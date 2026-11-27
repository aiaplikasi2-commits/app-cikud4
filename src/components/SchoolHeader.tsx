import React, { useEffect, useState } from 'react';
import { Building2, Landmark } from 'lucide-react';
import type { SchoolIdentity } from '../types/settings';
import { resolveAssetUrl } from '../lib/authApi';

interface SchoolHeaderProps {
  identity?: SchoolIdentity;
  logoUrl?: string | null;
}

export const SchoolHeader: React.FC<SchoolHeaderProps> = ({
  identity,
  logoUrl,
}) => {
  const [schoolLogoError, setSchoolLogoError] = useState(false);
  const [regionLogoError, setRegionLogoError] = useState(false);

  const effectiveLogoSrc = resolveAssetUrl(logoUrl) || '/assets/aistudio/logo_1128ead8.png';

  useEffect(() => {
    setSchoolLogoError(false);
  }, [effectiveLogoSrc]);

  const schoolTitle = identity?.schoolName?.trim() || 'Nama Sekolah';
  const cityPart = identity?.city?.trim();
  const deptPart = identity?.department?.trim();
  const subtitle =
    cityPart || deptPart
      ? [cityPart, deptPart].filter(Boolean).join(' · ')
      : 'Kota/Kabupaten · Dinas Pendidikan';

  return (
    <header className="w-full pt-4 pb-1 sm:pt-6 sm:pb-2">
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        {/* Logo Pemerintah Daerah / Kota (Kiri) */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center rounded-2xl">
          {!regionLogoError ? (
            <img
              src="/assets/aistudio/LOGO_KOTA_44c6ccf7.png"
              alt="Logo Pemerintah Daerah"
              referrerPolicy="no-referrer"
              onError={() => setRegionLogoError(true)}
              className="w-full h-full object-contain drop-shadow-[0_3px_8px_rgba(15,23,42,0.12)]"
            />
          ) : (
            <div
              className="w-full h-full rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700"
              aria-label="Logo Pemerintah Daerah"
            >
              <Landmark className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          )}
        </div>

        {/* Identitas Sekolah (Tengah) */}
        <div className="flex-1 min-w-0 text-center px-1">
          <h1 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-[#122B52] leading-snug line-clamp-2 sm:truncate">
            {schoolTitle}
          </h1>
          <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-600 tracking-wide truncate">
            {subtitle}
          </p>
        </div>

        {/* Logo Sekolah (Kanan) */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center rounded-2xl">
          {!schoolLogoError ? (
            <img
              src={effectiveLogoSrc}
              alt="Logo Sekolah"
              referrerPolicy="no-referrer"
              onError={() => setSchoolLogoError(true)}
              className="w-full h-full object-contain drop-shadow-[0_3px_8px_rgba(15,23,42,0.12)]"
            />
          ) : (
            <div
              className="w-full h-full rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700"
              aria-label="Logo Sekolah"
            >
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
