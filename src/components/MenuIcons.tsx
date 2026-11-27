import React, { useId } from 'react';

interface IconProps {
  className?: string;
}

export const AdminAvatarIcon: React.FC<IconProps> = ({
  className = 'w-11 h-11',
}) => {
  const uid = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E6F2FF" />
          <stop offset="1" stopColor="#BDD7FA" />
        </linearGradient>
        <linearGradient id={`${uid}-suit`} x1="20" y1="40" x2="44" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B4C7E" />
          <stop offset="1" stopColor="#162E54" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${uid}-bg)`} stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M14 55C16.2 44.5 23.2 39.8 32 39.8C40.8 39.8 47.8 44.5 50 55" fill={`url(#${uid}-suit)`} />
      <path d="M26.5 39.8L32 49.5L37.5 39.8H26.5Z" fill="#FFFFFF" />
      <path d="M30.4 43.2L32 52L33.6 43.2L32 40.8L30.4 43.2Z" fill="#E11D48" />
      <rect x="28.5" y="33.5" width="7" height="7" rx="3.5" fill="#F2BFA0" />
      <circle cx="32" cy="25.5" r="9.6" fill="#F7CEB2" />
      <path
        d="M22.2 24.8C22.4 18.2 26.8 14 32 14C37.2 14 41.6 18.2 41.8 24.8C40.2 21 36.8 19.2 32 19.2C27.2 19.2 23.8 21 22.2 24.8Z"
        fill="#1E293B"
      />
      <circle cx="28.6" cy="25.5" r="1.2" fill="#1E293B" />
      <circle cx="35.4" cy="25.5" r="1.2" fill="#1E293B" />
      <path d="M29.4 29.6C30.4 30.8 33.6 30.8 34.6 29.6" stroke="#B45309" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};

export const PengaturanIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-gear`} x1="18" y1="12" x2="60" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#D9F4FC" />
          <stop offset="1" stopColor="#8ECAE6" />
        </linearGradient>
        <linearGradient id={`${uid}-ring`} x1="28" y1="24" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22B8CF" />
          <stop offset="1" stopColor="#0C7490" />
        </linearGradient>
        <linearGradient id={`${uid}-wrench`} x1="42" y1="18" x2="66" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
        <linearGradient id={`${uid}-handle`} x1="48" y1="42" x2="68" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="69" rx="22" ry="4.5" fill="#083344" fillOpacity="0.16" />
      {/* 3D Gear */}
      <path
        d="M44.5 14L46.4 19.6C48.2 20.2 49.9 21.1 51.4 22.3L57 20.3L62.2 25.5L60.2 31.1C61.4 32.6 62.3 34.3 62.9 36.1L68.5 38V45.4L62.9 47.3C62.3 49.1 61.4 50.8 60.2 52.3L62.2 57.9L57 63.1L51.4 61.1C49.9 62.3 48.2 63.2 46.4 63.8L44.5 69.4H37.1L35.2 63.8C33.4 63.2 31.7 62.3 30.2 61.1L24.6 63.1L19.4 57.9L21.4 52.3C20.2 50.8 19.3 49.1 18.7 47.3L13.1 45.4V38L18.7 36.1C19.3 34.3 20.2 32.6 21.4 31.1L19.4 25.5L24.6 20.3L30.2 22.3C31.7 21.1 33.4 20.2 35.2 19.6L37.1 14H44.5Z"
        fill={`url(#${uid}-gear)`}
        stroke="#0E7490"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="40.8" cy="41.7" r="13.5" fill={`url(#${uid}-ring)`} stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="40.8" cy="41.7" r="6.4" fill="#E0F7FA" />
      {/* Screwdriver / Tool Overlay */}
      <g transform="rotate(-12 56 46)">
        <rect x="52" y="18" width="4.5" height="24" rx="2" fill={`url(#${uid}-wrench)`} stroke="#475569" strokeWidth="1.2" />
        <rect x="49.5" y="40" width="9.5" height="22" rx="4.5" fill={`url(#${uid}-handle)`} stroke="#075985" strokeWidth="1.3" />
        <line x1="52.5" y1="44" x2="52.5" y2="58" stroke="#BAE6FD" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
};

export const SuratIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-folder`} x1="14" y1="16" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF7ED" />
          <stop offset="1" stopColor="#FDE6C4" />
        </linearGradient>
        <linearGradient id={`${uid}-env`} x1="16" y1="26" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD29D" />
          <stop offset="1" stopColor="#EE9B43" />
        </linearGradient>
        <linearGradient id={`${uid}-lens`} x1="46" y1="24" x2="68" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0F2FE" stopOpacity="0.92" />
          <stop offset="1" stopColor="#7DD3FC" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="24" ry="4.5" fill="#431407" fillOpacity="0.18" />
      {/* Back Folder */}
      <path
        d="M16 20C16 17.8 17.8 16 20 16H33L37 21H57C59.2 21 61 22.8 61 25V54C61 56.2 59.2 58 57 58H20C17.8 58 16 56.2 16 54V20Z"
        fill="#D97706"
        stroke="#78350F"
        strokeWidth="1.4"
      />
      {/* Paper Sheet */}
      <rect x="21" y="19" width="35" height="28" rx="3" fill={`url(#${uid}-folder)`} stroke="#B45309" strokeWidth="1.2" />
      <line x1="27" y1="26" x2="49" y2="26" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.45" />
      <line x1="27" y1="31.5" x2="45" y2="31.5" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />
      {/* Envelope Front */}
      <path
        d="M14 31C14 28.8 15.8 27 18 27H54C56.2 27 58 28.8 58 31V57C58 59.2 56.2 61 54 61H18C15.8 61 14 59.2 14 57V31Z"
        fill={`url(#${uid}-env)`}
        stroke="#78350F"
        strokeWidth="1.5"
      />
      <path d="M15 29L36 45L57 29" stroke="#78350F" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Wax Seal */}
      <circle cx="36" cy="45" r="5.5" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.4" />
      <circle cx="36" cy="45" r="2.2" fill="#FCA5A5" />
      {/* Magnifier */}
      <line x1="62" y1="45" x2="70" y2="57" stroke="#64748B" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="56" cy="36" r="10.5" fill={`url(#${uid}-lens)`} stroke="#E2E8F0" strokeWidth="3" />
      <circle cx="56" cy="36" r="10.5" stroke="#475569" strokeWidth="1.1" />
      <path d="M51 31.5C52.5 29.8 55 29.2 57.5 29.6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

export const SiswaIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-shirt`} x1="20" y1="44" x2="60" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DBEAFE" />
        </linearGradient>
        <linearGradient id={`${uid}-hijab`} x1="32" y1="15" x2="48" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="26" ry="4.5" fill="#0C244E" fillOpacity="0.22" />
      {/* Left Boy */}
      <path d="M9 62C10 51.5 14.5 47 21 47C27.5 47 32 51.5 33 62Z" fill={`url(#${uid}-shirt)`} stroke="#1E3A8A" strokeWidth="1.3" />
      <path d="M18.5 47L21 53.5L23.5 47" fill="#DC2626" />
      <circle cx="21" cy="34.5" r="9.2" fill="#F6C8A8" stroke="#1E3A8A" strokeWidth="1.3" />
      <path d="M11.8 33.5C12.2 27.2 16 23.8 21 23.8C26 23.8 29.8 27.2 30.2 33.5C27.8 29.5 24.5 28.5 21 28.5C17.5 28.5 14.2 29.5 11.8 33.5Z" fill="#1E293B" />
      <rect x="14.2" y="32.8" width="5.4" height="4" rx="1.2" stroke="#1E293B" strokeWidth="1.2" fill="#FFFFFF" fillOpacity="0.35" />
      <rect x="22.4" y="32.8" width="5.4" height="4" rx="1.2" stroke="#1E293B" strokeWidth="1.2" fill="#FFFFFF" fillOpacity="0.35" />
      <line x1="19.6" y1="34.8" x2="22.4" y2="34.8" stroke="#1E293B" strokeWidth="1.2" />

      {/* Right Boy */}
      <path d="M47 62C48 51.5 52.5 47 59 47C65.5 47 70 51.5 71 62Z" fill={`url(#${uid}-shirt)`} stroke="#1E3A8A" strokeWidth="1.3" />
      <path d="M56.5 47L59 53.5L61.5 47" fill="#DC2626" />
      <circle cx="59" cy="34.5" r="9.2" fill="#F6C8A8" stroke="#1E3A8A" strokeWidth="1.3" />
      <path d="M49.8 33.5C50.2 27.2 54 23.8 59 23.8C64 23.8 67.8 27.2 68.2 33.5C65.8 29.5 62.5 28.5 59 28.5C55.5 28.5 52.2 29.5 49.8 33.5Z" fill="#334155" />
      <circle cx="55.8" cy="34.8" r="1.1" fill="#1E293B" />
      <circle cx="62.2" cy="34.8" r="1.1" fill="#1E293B" />
      <path d="M56.8 38.6C57.8 39.8 60.2 39.8 61.2 38.6" stroke="#B45309" strokeWidth="1.2" strokeLinecap="round" />

      {/* Center Girl with Hijab */}
      <path d="M26 64C27.2 52 32.5 47 40 47C47.5 47 52.8 52 54 64Z" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="1.5" />
      <path d="M37 47L40 54.5L43 47" fill="#DC2626" />
      <path d="M29 33C29 24.5 33.6 19.5 40 19.5C46.4 19.5 51 24.5 51 33V45.5C51 47.5 46.5 49 40 49C33.5 49 29 47.5 29 45.5V33Z" fill={`url(#${uid}-hijab)`} stroke="#1E3A8A" strokeWidth="1.4" />
      <circle cx="40" cy="34.2" r="8.4" fill="#F8CEB0" stroke="#9A3412" strokeWidth="0.8" />
      <circle cx="36.8" cy="33.8" r="1.2" fill="#1E293B" />
      <circle cx="43.2" cy="33.8" r="1.2" fill="#1E293B" />
      <path d="M37.5 37.8C38.8 39.2 41.2 39.2 42.5 37.8" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
};

export const GuruIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-board`} x1="28" y1="16" x2="70" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#ECFDF5" />
        </linearGradient>
        <linearGradient id={`${uid}-blazer`} x1="12" y1="42" x2="40" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="25" ry="4.5" fill="#022C22" fillOpacity="0.24" />
      {/* Whiteboard */}
      <rect x="28" y="16" width="41" height="31" rx="4" fill={`url(#${uid}-board)`} stroke="#D1FAE5" strokeWidth="3" />
      <rect x="28" y="16" width="41" height="31" rx="4" stroke="#065F46" strokeWidth="1.2" />
      {/* Book graphic inside board */}
      <path d="M39 24C42 22.5 46 22.5 48.5 24.5C51 22.5 55 22.5 58 24V38C55 36.8 51 36.8 48.5 38.5C46 36.8 42 36.8 39 38V24Z" fill="#A7F3D0" stroke="#059669" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="48.5" y1="24.5" x2="48.5" y2="38.5" stroke="#059669" strokeWidth="1.4" />
      {/* Teacher figure */}
      <path d="M11 63C12.2 50 17.5 44.5 26 44.5C34.5 44.5 39.8 50 41 63Z" fill={`url(#${uid}-blazer)`} stroke="#064E3B" strokeWidth="1.5" />
      <path d="M22.5 44.5L26 52.5L29.5 44.5H22.5Z" fill="#FFFFFF" />
      <circle cx="26" cy="31" r="9.4" fill="#F6C8A8" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M16.5 30.2C16.8 23.2 21 19.5 26 19.5C31 19.5 35.2 23.2 35.5 30.2C33 26.2 29.8 25 26 25C22.2 25 19 26.2 16.5 30.2Z" fill="#1E293B" />
      <circle cx="22.8" cy="31" r="1.2" fill="#1E293B" />
      <circle cx="29.2" cy="31" r="1.2" fill="#1E293B" />
      <path d="M23.5 35C24.8 36.3 27.2 36.3 28.5 35" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round" />
      {/* Pointer stick */}
      <line x1="36" y1="53" x2="54" y2="34" stroke="#FEF08A" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="36" y1="53" x2="54" y2="34" stroke="#B45309" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
};

export const TendikIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-jacket`} x1="24" y1="42" x2="56" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={`${uid}-clip`} x1="14" y1="36" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#475569" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="24" ry="4.5" fill="#2E1065" fillOpacity="0.24" />
      {/* Chat bubble accent */}
      <rect x="52" y="18" width="16" height="12" rx="3.5" fill="#DDD6FE" stroke="#6D28D9" strokeWidth="1.2" />
      <line x1="56" y1="22.5" x2="64" y2="22.5" stroke="#6D28D9" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="56" y1="26" x2="62" y2="26" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" />
      {/* Staff person */}
      <path d="M24 63C25.2 50 31.2 44.5 40 44.5C48.8 44.5 54.8 50 56 63Z" fill={`url(#${uid}-jacket)`} stroke="#4C1D95" strokeWidth="1.4" />
      <path d="M36 44.5L40 53L44 44.5H36Z" fill="#FFFFFF" />
      <circle cx="40" cy="30.5" r="9.6" fill="#F5C4A2" stroke="#4C1D95" strokeWidth="1.3" />
      <path d="M30 33.5C30 23.5 34 18.5 40 18.5C46 18.5 50 23.5 50 33.5C48 27.5 44.5 25.5 40 25.5C35.5 25.5 32 27.5 30 33.5Z" fill="#1E293B" />
      {/* Clipboard on left */}
      <rect x="13" y="37" width="19" height="24" rx="3" fill={`url(#${uid}-clip)`} stroke="#FFFFFF" strokeWidth="1.5" />
      <rect x="18" y="34" width="9" height="5" rx="1.5" fill="#CBD5E1" stroke="#334155" strokeWidth="1.1" />
      <rect x="16" y="42" width="13" height="15" rx="1.5" fill="#FFFFFF" />
      <line x1="18.5" y1="46" x2="26.5" y2="46" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18.5" y1="50" x2="26.5" y2="50" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18.5" y1="54" x2="23.5" y2="54" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
      {/* Floating Pen */}
      <g transform="rotate(35 64 42)">
        <rect x="61" y="32" width="5" height="19" rx="2.5" fill="#C4B5FD" stroke="#4C1D95" strokeWidth="1.2" />
        <path d="M61.5 50L63.5 55L65.5 50H61.5Z" fill="#FDE047" />
      </g>
    </svg>
  );
};

export const AbsenSiswaIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-cal`} x1="20" y1="18" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1F5F9" />
        </linearGradient>
        <linearGradient id={`${uid}-top`} x1="20" y1="16" x2="60" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB7185" />
          <stop offset="1" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="25" ry="4.5" fill="#4C0519" fillOpacity="0.22" />
      {/* Main Calendar */}
      <rect x="20" y="18" width="40" height="39" rx="5" fill={`url(#${uid}-cal)`} stroke="#475569" strokeWidth="1.4" />
      <path d="M20 23C20 20.2 22.2 18 25 18H55C57.8 18 60 20.2 60 23V29H20V23Z" fill={`url(#${uid}-top)`} />
      <rect x="28" y="14" width="4.5" height="8" rx="2.2" fill="#E2E8F0" stroke="#475569" strokeWidth="1.2" />
      <rect x="47.5" y="14" width="4.5" height="8" rx="2.2" fill="#E2E8F0" stroke="#475569" strokeWidth="1.2" />
      {/* Grid dots */}
      <rect x="26" y="34" width="5.5" height="5" rx="1.2" fill="#CBD5E1" />
      <rect x="34" y="34" width="5.5" height="5" rx="1.2" fill="#CBD5E1" />
      <rect x="42" y="34" width="5.5" height="5" rx="1.2" fill="#CBD5E1" />
      <rect x="50" y="34" width="5.5" height="5" rx="1.2" fill="#CBD5E1" />
      <rect x="26" y="42" width="5.5" height="5" rx="1.2" fill="#CBD5E1" />
      <rect x="34" y="42" width="5.5" height="5" rx="1.2" fill="#16A34A" />
      <rect x="42" y="42" width="5.5" height="5" rx="1.2" fill="#CBD5E1" />
      {/* Checklist Mini Card Left */}
      <rect x="10" y="36" width="18" height="22" rx="3.5" fill="#FFFFFF" stroke="#9F1239" strokeWidth="1.3" />
      <path d="M13.5 43L15.2 44.7L18 41.8" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="20" y1="43.5" x2="25" y2="43.5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.5 50.5L15.2 52.2L18 49.3" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="20" y1="51" x2="25" y2="51" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
      {/* Clock Badge Bottom Right */}
      <circle cx="58" cy="54" r="11" fill="#FFFFFF" stroke="#6366F1" strokeWidth="2.8" />
      <circle cx="58" cy="54" r="8" fill="#EEF2FF" />
      <path d="M58 49.5V54L61.5 56" stroke="#312E81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const ManajemenAkunIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-card`} x1="14" y1="22" x2="58" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="1" stopColor="#DBEAFE" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`${uid}-key`} x1="42" y1="40" x2="66" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="24" ry="4.5" fill="#1E1B4B" fillOpacity="0.22" />
      {/* ID Card */}
      <rect x="14" y="24" width="44" height="32" rx="5" fill={`url(#${uid}-card)`} stroke="#4338CA" strokeWidth="1.5" />
      {/* Avatar in ID card */}
      <rect x="20" y="31" width="15" height="17" rx="3" fill="#C7D2FE" />
      <circle cx="27.5" cy="37" r="3.4" fill="#4338CA" />
      <path d="M22.2 46C22.8 42.8 24.8 41.5 27.5 41.5C30.2 41.5 32.2 42.8 32.8 46" fill="#4338CA" />
      {/* Card Lines */}
      <line x1="39" y1="35" x2="52" y2="35" stroke="#6366F1" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="39" y1="40.5" x2="50" y2="40.5" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" />
      <line x1="39" y1="45.5" x2="47" y2="45.5" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
      {/* Security Shield */}
      <path
        d="M44 12L54 16V24C54 30.2 49.6 35.6 44 37.5C38.4 35.6 34 30.2 34 24V16L44 12Z"
        fill="#3B82F6"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M40.5 24.5L43 27L48 21.8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Golden Key */}
      <g transform="rotate(-32 54 53)">
        <circle cx="47" cy="53" r="6.5" fill={`url(#${uid}-key)`} stroke="#92400E" strokeWidth="1.3" />
        <circle cx="47" cy="53" r="2.2" fill="#FEF9C3" />
        <rect x="53" y="51" width="15" height="4" rx="2" fill={`url(#${uid}-key)`} stroke="#92400E" strokeWidth="1.2" />
        <rect x="61" y="55" width="3" height="3.5" rx="1" fill="#F59E0B" />
        <rect x="65" y="55" width="2.8" height="2.8" rx="0.8" fill="#F59E0B" />
      </g>
    </svg>
  );
};

export const AgendaHarianIcon: React.FC<IconProps> = ({
  className = 'w-16 h-16',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-book`} x1="16" y1="16" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#ECFDF5" />
        </linearGradient>
        <linearGradient id={`${uid}-hdr`} x1="18" y1="14" x2="58" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id={`${uid}-badge`} x1="48" y1="42" x2="68" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="68" rx="25" ry="4.5" fill="#042F2E" fillOpacity="0.24" />
      {/* Back Page */}
      <rect x="20" y="18" width="42" height="42" rx="6" fill="#CCFBF1" stroke="#0F766E" strokeWidth="1.2" />
      {/* Main Calendar/Agenda Card */}
      <rect x="16" y="15" width="42" height="43" rx="6" fill={`url(#${uid}-book)`} stroke="#0F766E" strokeWidth="1.5" />
      {/* Header Band */}
      <path d="M16 21C16 17.7 18.7 15 22 15H52C55.3 15 58 17.7 58 21V28H16V21Z" fill={`url(#${uid}-hdr)`} />
      {/* Spiral Rings */}
      <rect x="24" y="11" width="4.5" height="8" rx="2.2" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
      <rect x="35" y="11" width="4.5" height="8" rx="2.2" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
      <rect x="46" y="11" width="4.5" height="8" rx="2.2" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />
      {/* Agenda Rows */}
      <circle cx="23.5" cy="34.5" r="2.2" fill="#0D9488" />
      <line x1="28.5" y1="34.5" x2="49" y2="34.5" stroke="#0F766E" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="23.5" cy="42.5" r="2.2" fill="#F59E0B" />
      <line x1="28.5" y1="42.5" x2="45" y2="42.5" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23.5" cy="50.5" r="2.2" fill="#3B82F6" />
      <line x1="28.5" y1="50.5" x2="41" y2="50.5" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" />
      {/* Checkmark Floating Badge */}
      <circle cx="57" cy="52" r="11.5" fill={`url(#${uid}-badge)`} stroke="#FFFFFF" strokeWidth="2.4" />
      <path d="M52 52.2L55.5 55.7L62.2 48.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
