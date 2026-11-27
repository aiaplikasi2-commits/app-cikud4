import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  UserCheck,
} from 'lucide-react';
import type { AgendaConfig, AgendaSummary } from '../types/agenda';
import { fetchAgendaSummary } from '../lib/agendaApi';
import {
  AGENDA_STATUS_META,
  formatAgendaDateShort,
  formatAgendaTimeRange,
  getCategoryVisual,
} from './agendaStyles';

interface AgendaDashboardWidgetProps {
  onOpenAgenda: (openCreate?: boolean) => void;
  userRole: 'OPERATOR' | 'GURU';
}

const REMINDER_PREF_KEY = 'agenda_harian_reminders_enabled';

export const AgendaDashboardWidget: React.FC<AgendaDashboardWidgetProps> = ({
  onOpenAgenda,
  userRole,
}) => {
  const [summary, setSummary] = useState<AgendaSummary | null>(null);
  const [config, setConfig] = useState<AgendaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(REMINDER_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgendaSummary();
      setSummary(data.summary);
      setConfig(data.config);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat ringkasan Agenda Harian.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const toggleReminders = () => {
    setRemindersEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(REMINDER_PREF_KEY, String(next));
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  };

  const canCreate =
    userRole === 'OPERATOR' || config?.allowGuruCreate !== false;

  const activeTodayAlerts = (summary?.todayAgendas || []).filter(
    (item) =>
      item.status === 'BERLANGSUNG' || item.status === 'DIRENCANAKAN'
  );

  const previewItems =
    (summary?.todayAgendas?.length || 0) > 0
      ? summary!.todayAgendas.slice(0, 3)
      : (summary?.upcomingAgendas || []).slice(0, 3);
  const previewHeading =
    (summary?.todayAgendas?.length || 0) > 0
      ? 'Kegiatan Hari Ini'
      : 'Agenda Mendatang';

  return (
    <section
      aria-label="Ringkasan Agenda Harian"
      className="rounded-2xl bg-white/92 backdrop-blur-md border border-white/90 shadow-[0_6px_24px_rgba(15,35,66,0.06)] p-4 sm:p-5 space-y-3.5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-teal-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold text-[#17325C] truncate">
              Ringkasan Agenda Harian
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {summary
                ? `Tanggal ${formatAgendaDateShort(summary.todayDate)}`
                : 'Memuat jadwal kegiatan sekolah'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleReminders}
            title={
              remindersEnabled
                ? 'Matikan pengingat agenda di beranda'
                : 'Aktifkan pengingat agenda di beranda'
            }
            aria-label={
              remindersEnabled
                ? 'Nonaktifkan pengingat agenda'
                : 'Aktifkan pengingat agenda'
            }
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[38px] ${
              remindersEnabled
                ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {remindersEnabled ? (
              <Bell className="w-3.5 h-3.5 text-teal-700" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline">
              {remindersEnabled ? 'Pengingat Aktif' : 'Pengingat Mati'}
            </span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => onOpenAgenda(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenAgenda(false)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#17325C] px-3 py-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
          >
            <span>Buka Agenda</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-2.5 animate-pulse" aria-hidden="true">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-slate-100 border border-slate-200/70"
              />
            ))}
          </div>
          <div className="h-14 rounded-xl bg-slate-100 border border-slate-200/70" />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadSummary}
            className="font-bold underline hover:text-rose-950 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Populated Live Summary */}
      {!loading && !error && summary && (
        <>
          {/* Compact 4-metric grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-600">
                Agenda Hari Ini
              </p>
              <p className="mt-0.5 text-xl font-extrabold text-[#17325C] tabular-nums">
                {summary.todayCount}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-amber-800">
                Sedang Berlangsung
              </p>
              <p className="mt-0.5 text-xl font-extrabold text-amber-900 tabular-nums">
                {summary.ongoingCount}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-emerald-800">
                Selesai Hari Ini
              </p>
              <p className="mt-0.5 text-xl font-extrabold text-emerald-900 tabular-nums">
                {summary.doneCount}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-sky-800">
                Agenda Mendatang
              </p>
              <p className="mt-0.5 text-xl font-extrabold text-sky-900 tabular-nums">
                {summary.upcomingCount}
              </p>
            </div>
          </div>

          {/* In-App Reminder Banner */}
          {remindersEnabled && activeTodayAlerts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-semibold">
                  Pengingat hari ini: ada{' '}
                  <strong className="tabular-nums">
                    {activeTodayAlerts.length}
                  </strong>{' '}
                  kegiatan aktif ({activeTodayAlerts[0].title}
                  {activeTodayAlerts[0].startTime
                    ? ` · ${activeTodayAlerts[0].startTime} WIB`
                    : ''}
                  ).
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenAgenda(false)}
                className="font-bold text-amber-900 hover:underline cursor-pointer shrink-0"
              >
                Lihat Detail
              </button>
            </div>
          )}

          {/* Compact Preview List or Clean Empty State */}
          {previewItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">
                {previewHeading}
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {previewItems.map((item) => {
                  const statusMeta = AGENDA_STATUS_META[item.status];
                  const catVisual = getCategoryVisual(item.category);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenAgenda(false)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50/90 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: catVisual.dotColor }}
                            aria-hidden="true"
                          />
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.date !== summary.todayDate
                              ? `${formatAgendaDateShort(item.date)} · `
                              : ''}
                            {formatAgendaTimeRange(
                              item.startTime,
                              item.endTime
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            {item.picName}
                          </span>
                          {item.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {item.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${statusMeta.chipClass}`}
                        >
                          {statusMeta.shortLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-3 text-xs text-slate-600">
              <span>
                Belum ada jadwal kegiatan tercatat untuk hari ini maupun waktu
                mendatang.
              </span>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => onOpenAgenda(true)}
                  className="self-start sm:self-auto font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer whitespace-nowrap"
                >
                  + Catat Agenda Pertama
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
