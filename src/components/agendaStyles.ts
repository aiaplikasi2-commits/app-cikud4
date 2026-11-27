import type { AgendaStatus } from '../types/agenda';

export const AGENDA_STATUS_META: Record<
  AgendaStatus,
  {
    label: string;
    shortLabel: string;
    chipClass: string;
    dotClass: string;
  }
> = {
  DIRENCANAKAN: {
    label: 'Direncanakan',
    shortLabel: 'Direncanakan',
    chipClass: 'bg-sky-50 text-sky-800 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  BERLANGSUNG: {
    label: 'Sedang berlangsung',
    shortLabel: 'Berlangsung',
    chipClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500',
  },
  SELESAI: {
    label: 'Selesai',
    shortLabel: 'Selesai',
    chipClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  DIBATALKAN: {
    label: 'Dibatalkan',
    shortLabel: 'Dibatalkan',
    chipClass: 'bg-rose-50 text-rose-800 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

const CATEGORY_COLOR_MAP: Record<
  string,
  { badgeClass: string; dotColor: string }
> = {
  'kegiatan belajar mengajar': {
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    dotColor: '#2563EB',
  },
  'kegiatan kepala sekolah': {
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dotColor: '#4F46E5',
  },
  'kegiatan guru': {
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotColor: '#059669',
  },
  'kegiatan operator sekolah': {
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    dotColor: '#0891B2',
  },
  'kegiatan tata usaha': {
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
    dotColor: '#7C3AED',
  },
  'kegiatan administrasi': {
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    dotColor: '#475569',
  },
  rapat: {
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotColor: '#D97706',
  },
  'kegiatan siswa': {
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    dotColor: '#0D9488',
  },
  'kegiatan upacara': {
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    dotColor: '#E11D48',
  },
  'kegiatan ekstrakurikuler': {
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    dotColor: '#EA580C',
  },
  'kegiatan sekolah': {
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    dotColor: '#0284C7',
  },
  'kegiatan dinas': {
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    dotColor: '#9333EA',
  },
  'kegiatan lainnya': {
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
    dotColor: '#64748B',
  },
};

export function getCategoryVisual(category: string): {
  badgeClass: string;
  dotColor: string;
} {
  const key = (category || '').trim().toLowerCase();
  if (CATEGORY_COLOR_MAP[key]) {
    return CATEGORY_COLOR_MAP[key];
  }
  return {
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    dotColor: '#0D9488',
  };
}

export function getLocalTodayIso(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function formatAgendaDateLong(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatAgendaDateShort(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatAgendaTimeRange(
  startTime?: string,
  endTime?: string
): string {
  const s = (startTime || '').trim();
  const e = (endTime || '').trim();
  if (s && e) return `${s} – ${e} WIB`;
  if (s) return `${s} WIB`;
  if (e) return `s.d. ${e} WIB`;
  return 'Sepanjang hari';
}

export function getMonthLabel(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const y = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  const dt = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return getLocalTodayIso().slice(0, 7);
  const y = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10) - 1;
  const dt = new Date(Date.UTC(y, m + deltaMonths, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getWeekBoundsFromDate(isoDate: string): {
  start: string;
  end: string;
  days: string[];
} {
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? isoDate
    : getLocalTodayIso();
  const [y, m, d] = clean.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0=Sun..6=Sat
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(dt.getTime() + offsetToMonday * 86_400_000);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday.getTime() + i * 86_400_000);
    days.push(cur.toISOString().slice(0, 10));
  }
  return {
    start: days[0],
    end: days[6],
    days,
  };
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? isoDate
    : getLocalTodayIso();
  const [y, m, d] = clean.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d) + deltaDays * 86_400_000);
  return dt.toISOString().slice(0, 10);
}
