import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminNotificationRecord,
  AdminNotificationType,
} from '../types/notification';
import {
  clearAdminNotifications,
  deleteAdminNotification,
  listAdminNotifications,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
} from '../lib/notificationApi';

interface AdminNotificationsPageProps {
  onBack: () => void;
  onUnreadCountChange?: (count: number) => void;
  onNavigateTarget?: (target: 'siswa' | 'guru' | 'agenda-harian') => void;
}

type FilterMode = 'ALL' | 'UNREAD' | AdminNotificationType;

function formatTimestampId(iso: string): string {
  if (!iso) return '-';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatDateId(value: string): string {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

function getTypeMeta(type: AdminNotificationType): {
  label: string;
  target: 'siswa' | 'guru' | 'agenda-harian';
  targetLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
} {
  if (type === 'STUDENT_UPDATED') {
    return {
      label: 'Perubahan Data Siswa',
      target: 'siswa',
      targetLabel: 'Buka Data Siswa',
      icon: Users,
      accentClass: 'bg-sky-50 border-sky-200 text-sky-700',
    };
  }
  if (type === 'TEACHER_PROFILE_UPDATED') {
    return {
      label: 'Perubahan Profil Guru',
      target: 'guru',
      targetLabel: 'Buka Data Guru',
      icon: UserCog,
      accentClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    };
  }
  return {
    label: 'Agenda Baru Guru',
    target: 'agenda-harian',
    targetLabel: 'Buka Agenda Harian',
    icon: Calendar,
    accentClass: 'bg-teal-50 border-teal-200 text-teal-700',
  };
}

export const AdminNotificationsPage: React.FC<AdminNotificationsPageProps> = ({
  onBack,
  onUnreadCountChange,
  onNavigateTarget,
}) => {
  const [items, setItems] = useState<AdminNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<
    | { kind: 'single'; item: AdminNotificationRecord }
    | { kind: 'clear-read'; count: number }
    | { kind: 'clear-all'; count: number }
    | null
  >(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listAdminNotifications();
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);
      onUnreadCountChange?.(res.unreadCount);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat pusat notifikasi Admin.'
      );
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const readCount = useMemo(
    () => items.filter((item) => item.readAt !== null).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (filterMode === 'ALL') return items;
    if (filterMode === 'UNREAD') {
      return items.filter((item) => item.readAt === null);
    }
    return items.filter((item) => item.type === filterMode);
  }, [items, filterMode]);

  const handleMarkRead = async (id: string) => {
    setBusyId(id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await markAdminNotificationRead(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? res.notification : item))
      );
      setUnreadCount(res.unreadCount);
      onUnreadCountChange?.(res.unreadCount);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menandai notifikasi dibaca.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setBulkBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await markAllAdminNotificationsRead();
      const nowIso = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) =>
          item.readAt ? item : { ...item, readAt: nowIso }
        )
      );
      setUnreadCount(res.unreadCount);
      onUnreadCountChange?.(res.unreadCount);
      setSuccessMsg('Semua notifikasi telah ditandai sudah dibaca.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menandai semua notifikasi.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleConfirmDeleteAction = async () => {
    if (!confirmAction) return;
    setBulkBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (confirmAction.kind === 'single') {
        const nextUnread = await deleteAdminNotification(confirmAction.item.id);
        setItems((prev) => prev.filter((item) => item.id !== confirmAction.item.id));
        setUnreadCount(nextUnread);
        onUnreadCountChange?.(nextUnread);
        setSuccessMsg('Notifikasi berhasil dihapus.');
      } else if (confirmAction.kind === 'clear-read') {
        const res = await clearAdminNotifications('read');
        setItems((prev) => prev.filter((item) => item.readAt === null));
        setUnreadCount(res.unreadCount);
        onUnreadCountChange?.(res.unreadCount);
        setSuccessMsg(`${res.deletedCount} notifikasi yang sudah dibaca berhasil dihapus.`);
      } else {
        const res = await clearAdminNotifications('all');
        setItems([]);
        setUnreadCount(res.unreadCount);
        onUnreadCountChange?.(res.unreadCount);
        setSuccessMsg('Semua notifikasi berhasil dihapus.');
      }
      setConfirmAction(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghapus notifikasi.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const filterButtons: Array<{ id: FilterMode; label: string }> = [
    { id: 'ALL', label: `Semua (${items.length})` },
    { id: 'UNREAD', label: `Belum Dibaca (${unreadCount})` },
    { id: 'STUDENT_UPDATED', label: 'Data Siswa' },
    { id: 'TEACHER_PROFILE_UPDATED', label: 'Profil Guru' },
    { id: 'AGENDA_CREATED', label: 'Agenda' },
  ];

  return (
    <div className="pt-4 sm:pt-6 space-y-4">
      {/* Header Pusat Notifikasi Admin */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4BAFFF] via-[#1E7CEB] to-[#0F53BD] border border-[#78C7FF]/75 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(15,83,189,0.4)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/92 hover:bg-white text-[#0F357A] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(7,25,65,0.35)] leading-tight truncate">
                Notifikasi Aktivitas Guru
              </h1>
              <p className="text-xs text-blue-50 mt-0.5 font-medium tabular-nums">
                {unreadCount} belum dibaca · {items.length} total pemberitahuan
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadNotifications}
          disabled={loading || bulkBusy}
          className="relative z-10 self-start sm:self-center inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-blue-50 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-[#0F53BD] shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      {/* Feedback messages */}
      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs sm:text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs sm:text-sm text-rose-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 text-rose-700 hover:text-rose-900 cursor-pointer"
            aria-label="Tutup pesan error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Bulk Action Toolbar */}
      <section className="rounded-2xl bg-white border border-slate-200/90 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterButtons.map((btn) => {
              const active = filterMode === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setFilterMode(btn.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
                    active
                      ? 'bg-[#1D63D8] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 px-3 py-1.5 text-xs font-bold text-[#1D63D8] cursor-pointer whitespace-nowrap min-h-[38px]"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tandai Semua Dibaca
              </button>
            )}

            {readCount > 0 && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  setConfirmAction({ kind: 'clear-read', count: readCount })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap min-h-[38px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus yang Dibaca ({readCount})
              </button>
            )}

            {items.length > 0 && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  setConfirmAction({ kind: 'clear-all', count: items.length })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 px-3 py-1.5 text-xs font-bold text-rose-700 cursor-pointer whitespace-nowrap min-h-[38px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Semua
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Menghapus notifikasi hanya membersihkan daftar pemberitahuan ini dan tidak mengubah data siswa, profil guru, maupun agenda yang sudah tersimpan.
        </p>
      </section>

      {/* Daftar Notifikasi */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat notifikasi...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-8 text-center space-y-1.5">
          <Bell className="w-7 h-7 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            {items.length === 0
              ? 'Belum ada notifikasi aktivitas guru.'
              : 'Tidak ada notifikasi pada filter ini.'}
          </p>
          <p className="text-xs text-slate-500">
            Pemberitahuan otomatis muncul saat Guru memperbarui data siswa, profil pribadi, atau menambahkan agenda baru.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const meta = getTypeMeta(item.type);
            const IconComp = meta.icon;
            const isUnread = item.readAt === null;
            const isBusy = busyId === item.id;

            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-colors space-y-3 ${
                  isUnread
                    ? 'bg-white border-blue-300 shadow-[0_4px_16px_rgba(29,99,216,0.08)]'
                    : 'bg-white/85 border-slate-200/90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.accentClass}`}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-bold text-[#1D63D8]">
                          {meta.label}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span
                          className={`font-semibold ${
                            isUnread ? 'text-rose-600' : 'text-slate-500'
                          }`}
                        >
                          {isUnread ? 'Belum dibaca' : 'Sudah dibaca'}
                        </span>
                      </div>

                      <h2 className="text-sm sm:text-base font-extrabold text-[#17325C] leading-snug">
                        {item.title}
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isUnread && (
                      <button
                        type="button"
                        disabled={isBusy || bulkBusy}
                        onClick={() => handleMarkRead(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 px-3 py-1.5 text-xs font-bold text-[#1D63D8] cursor-pointer whitespace-nowrap min-h-[38px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isBusy ? 'Memproses...' : 'Tandai Dibaca'}
                      </button>
                    )}

                    {onNavigateTarget && (
                      <button
                        type="button"
                        onClick={() => onNavigateTarget(meta.target)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap min-h-[38px]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {meta.targetLabel}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isBusy || bulkBusy}
                      onClick={() =>
                        setConfirmAction({ kind: 'single', item })
                      }
                      aria-label={`Hapus notifikasi ${item.title}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer whitespace-nowrap min-h-[38px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Metadata detail & bidang yang diubah */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Guru: <strong className="text-slate-900">{item.actorName}</strong>
                      {item.actorUsername ? ` (${item.actorUsername})` : ''}
                    </span>
                    {item.targetName && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span>
                          Objek: <strong className="text-slate-900">{item.targetName}</strong>
                        </span>
                      </>
                    )}
                    {item.eventDate && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="tabular-nums">
                          Tanggal Agenda:{' '}
                          <strong className="text-slate-900">
                            {formatDateId(item.eventDate)}
                          </strong>
                        </span>
                      </>
                    )}
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-slate-500">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {formatTimestampId(item.createdAt)}
                    </span>
                  </div>

                  {item.changedFields.length > 0 && (
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">
                        Rincian perubahan:{' '}
                      </span>
                      <span>{item.changedFields.join(', ')}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Notifikasi */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-notif-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="modal-delete-notif-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  {confirmAction.kind === 'single'
                    ? 'Hapus Notifikasi'
                    : confirmAction.kind === 'clear-read'
                      ? 'Hapus Notifikasi yang Sudah Dibaca'
                      : 'Hapus Semua Notifikasi'}
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  {confirmAction.kind === 'single'
                    ? `Hapus notifikasi "${confirmAction.item.title}"?`
                    : confirmAction.kind === 'clear-read'
                      ? `Hapus ${confirmAction.count} notifikasi yang sudah dibaca?`
                      : `Hapus seluruh ${confirmAction.count} notifikasi?`}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Penghapusan ini hanya menghapus catatan notifikasi dan tidak menghapus atau membatalkan data siswa, profil guru, maupun agenda.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleConfirmDeleteAction}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer min-h-[40px]"
              >
                {bulkBusy ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
