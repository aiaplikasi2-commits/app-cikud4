import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { TeacherAccount, UserRole } from '../types/auth';
import type { TeacherListItem, TeacherRecord } from '../types/teacher';
import { listTeacherAccounts } from '../lib/authApi';
import {
  deleteTeacher,
  downloadTeacherTemplate,
  exportTeachersExcel,
  getTeacherDetail,
  linkTeacherAccount,
  listTeachers,
} from '../lib/teacherApi';
import { TeacherDetailModal } from './TeacherDetailModal';
import { TeacherFormModal } from './TeacherFormModal';
import { TeacherImportModal } from './TeacherImportModal';
import { GuruIcon, TendikIcon } from './MenuIcons';

interface TeacherDataPageProps {
  userRole: UserRole;
  mode?: 'guru' | 'tendik';
  onBack: () => void;
}

function isTendikRecord(jenisPtk: string): boolean {
  const clean = (jenisPtk || '').trim().toLowerCase();
  if (!clean) return false;
  return !clean.includes('guru');
}

export const TeacherDataPage: React.FC<TeacherDataPageProps> = ({
  userRole,
  mode = 'guru',
  onBack,
}) => {
  const isOperator = userRole === 'OPERATOR';
  const isTendikMode = mode === 'tendik';
  const roleTitle = isTendikMode ? 'Data Tendik' : 'Data Guru';

  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [employmentStatuses, setEmploymentStatuses] = useState<string[]>([]);
  const [ptkTypes, setPtkTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState('');
  const [selectedPtkType, setSelectedPtkType] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [detailTeacher, setDetailTeacher] = useState<TeacherRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Link Login Account modal state (OPERATOR only)
  const [linkTarget, setLinkTarget] = useState<{
    id: string;
    nama: string;
    nip: string;
    linkedAccountId: string | null;
  } | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<TeacherAccount[]>([]);
  const [selectedLinkAccountId, setSelectedLinkAccountId] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listTeachers({
        search: searchQuery,
        statusKepegawaian: selectedEmploymentStatus,
        jenisPtk: selectedPtkType,
      });
      const rawTeachers = Array.isArray(res.teachers) ? res.teachers : [];
      const scopedTeachers = isTendikMode
        ? rawTeachers.filter((t) => isTendikRecord(t.jenisPtk))
        : rawTeachers;
      setTeachers(scopedTeachers);
      setTotalAll(
        isTendikMode
          ? scopedTeachers.length
          : typeof res.totalAll === 'number'
            ? res.totalAll
            : 0
      );
      setEmploymentStatuses(
        Array.isArray(res.employmentStatuses) ? res.employmentStatuses : []
      );
      setPtkTypes(Array.isArray(res.ptkTypes) ? res.ptkTypes : []);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat daftar data guru.'
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedEmploymentStatus, selectedPtkType, isTendikMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchList();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [fetchList]);

  const handleOpenDetail = async (id: string) => {
    setErrorMsg(null);
    try {
      const detail = await getTeacherDetail(id);
      setDetailTeacher(detail);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat detail profil guru.'
      );
    }
  };

  const handleOpenEdit = async (id: string) => {
    setErrorMsg(null);
    try {
      const detail = await getTeacherDetail(id);
      setDetailTeacher(null);
      setEditingTeacher(detail);
      setFormOpen(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat data guru untuk diedit.'
      );
    }
  };

  const handleOpenLinkModal = async (target: {
    id: string;
    nama: string;
    nip: string;
    linkedAccountId: string | null;
  }) => {
    setErrorMsg(null);
    setDetailTeacher(null);
    setLinkTarget(target);
    setSelectedLinkAccountId(target.linkedAccountId || '');
    setLoadingAccounts(true);
    try {
      const accounts = await listTeacherAccounts();
      setAvailableAccounts(accounts);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memuat daftar akun login guru.'
      );
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleConfirmLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTarget) return;
    setLinkingAccount(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await linkTeacherAccount(
        linkTarget.id,
        selectedLinkAccountId ? selectedLinkAccountId : null
      );
      setSuccessMsg(
        selectedLinkAccountId
          ? `Akun login berhasil dihubungkan dengan Data Guru "${linkTarget.nama}".`
          : `Tautan akun login untuk "${linkTarget.nama}" berhasil dilepas.`
      );
      setLinkTarget(null);
      fetchList();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal menghubungkan akun login guru.'
      );
    } finally {
      setLinkingAccount(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteTeacher(deleteTarget.id);
      setSuccessMsg(`Data guru "${deleteTarget.nama}" berhasil dihapus.`);
      setDeleteTarget(null);
      fetchList();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghapus data guru.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setErrorMsg(null);
    setDownloadingTemplate(true);
    try {
      await downloadTeacherTemplate();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal mengunduh template Excel Data Guru.'
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExportExcel = async () => {
    setErrorMsg(null);
    setExportingExcel(true);
    try {
      await exportTeachersExcel();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal mengekspor data guru ke Excel.'
      );
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="pt-4 sm:pt-6 space-y-4">
      {/* Header Data Guru / Tendik */}
      <div
        className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
          isTendikMode
            ? 'bg-gradient-to-br from-[#B188FC] via-[#7E46DC] to-[#5B27B5] border-[#CFAFFF]/75 shadow-[0_10px_24px_-6px_rgba(91,39,181,0.4)]'
            : 'bg-gradient-to-br from-[#35D57C] via-[#11A353] to-[#087338] border-[#6DE7A3]/75 shadow-[0_10px_24px_-6px_rgba(8,115,56,0.4)]'
        }`}
      >
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/92 hover:bg-white text-slate-800 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {isTendikMode ? (
            <TendikIcon className="w-11 h-11 shrink-0 hidden sm:block drop-shadow-xs" />
          ) : (
            <GuruIcon className="w-11 h-11 shrink-0 hidden sm:block drop-shadow-xs" />
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(10,20,30,0.35)] leading-tight truncate">
              {roleTitle}
            </h1>
            <p className="text-xs text-white/90 mt-0.5 flex items-center gap-1.5 font-medium">
              <Users className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="tabular-nums">
                Total: <strong className="text-white">{totalAll}</strong>{' '}
                {isTendikMode ? 'tendik' : 'guru'}
              </span>
            </p>
          </div>
        </div>

        {isOperator && (
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 px-3 py-2 text-xs sm:text-sm font-bold text-[#17325C] shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Import Excel
            </button>
            <button
              type="button"
              disabled={downloadingTemplate}
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/92 hover:bg-white disabled:opacity-60 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <FileDown className="w-4 h-4 text-emerald-700" />
              {downloadingTemplate ? 'Mengunduh...' : 'Template Excel'}
            </button>
            <button
              type="button"
              disabled={exportingExcel || totalAll === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/92 hover:bg-white disabled:opacity-50 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-[#1D63D8]" />
              {exportingExcel ? 'Mengekspor...' : 'Export Excel'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTeacher(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F2A4D] hover:bg-[#17325C] border border-white/20 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </div>
        )}
      </div>

      {/* Notifikasi */}
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

      {/* Kolom Pencarian & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama guru, NIP, NUPTK, atau email..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <select
          value={selectedEmploymentStatus}
          onChange={(e) => setSelectedEmploymentStatus(e.target.value)}
          aria-label="Filter Status Kepegawaian"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        >
          <option value="">Semua Status Kepegawaian</option>
          {employmentStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={selectedPtkType}
          onChange={(e) => setSelectedPtkType(e.target.value)}
          aria-label="Filter Jenis PTK"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        >
          <option value="">Semua Jenis PTK</option>
          {ptkTypes.map((ptk) => (
            <option key={ptk} value={ptk}>
              {ptk}
            </option>
          ))}
        </select>
      </div>

      {/* Daftar Guru */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data guru dari server...
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {totalAll === 0
              ? isTendikMode
                ? 'Belum ada data Tendik.'
                : 'Belum ada data guru.'
              : 'Tidak ada data yang sesuai.'}
          </p>
        </div>
      ) : (
        <>
          {/* Tabel Web / Tablet */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">Nama Guru</th>
                    <th className="px-4 py-3">NIP &amp; NUPTK</th>
                    <th className="px-4 py-3">JK</th>
                    <th className="px-4 py-3">Kepegawaian &amp; PTK</th>
                    <th className="px-4 py-3">Email &amp; Akun</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {teachers.map((t, index) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {t.no || index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{t.nama}</div>
                        {t.tugasTambahan && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {t.tugasTambahan}
                          </div>
                        )}
                        {t.assignedClass && (
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1D63D8]">
                              Kelas {t.assignedClass}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        <div>NIP: {t.nip || '-'}</div>
                        <div className="text-slate-500 mt-0.5">
                          NUPTK: {t.nuptk || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.jk || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#17325C]">
                          {t.statusKepegawaian || '-'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {t.jenisPtk || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-700">
                          {t.email || '-'}
                        </div>
                        <div className="mt-1">
                          {t.linkedAccountId ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              <UserCheck className="w-3 h-3" />
                              {t.linkedAccountUsername || 'Akun Terhubung'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              Belum ada akun
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(t.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>
                          {isOperator && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenLinkModal({
                                    id: t.id,
                                    nama: t.nama,
                                    nip: t.nip,
                                    linkedAccountId: t.linkedAccountId,
                                  })
                                }
                                title="Hubungkan dengan Akun Login Guru"
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                Akun
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(t.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(t)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                                aria-label={`Hapus ${t.nama}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kartu Android / Mobile */}
          <div className="md:hidden space-y-3">
            {teachers.map((t, index) => (
              <article
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-slate-400">
                      No. {t.no || index + 1}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {t.nama}
                    </h2>
                    <p className="text-xs font-semibold text-[#1D63D8] mt-0.5">
                      {t.jenisPtk || 'PTK'} · {t.statusKepegawaian || '-'}
                    </p>
                    {t.assignedClass && (
                      <span className="mt-1 inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1D63D8]">
                        Kelas {t.assignedClass}
                      </span>
                    )}
                  </div>
                  {t.linkedAccountId ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <UserCheck className="w-3 h-3" />
                      {t.linkedAccountUsername || 'Terhubung'}
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Belum ada akun
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div>
                    <span className="text-slate-500 block">NIP</span>
                    <span className="font-mono font-semibold text-slate-800 break-all">
                      {t.nip || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">NUPTK</span>
                    <span className="font-mono font-semibold text-slate-800 break-all">
                      {t.nuptk || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">JK</span>
                    <span className="font-semibold text-slate-800">
                      {t.jk === 'L' ? 'Laki-laki' : t.jk === 'P' ? 'Perempuan' : t.jk || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email</span>
                    <span className="font-medium text-slate-800 break-all">
                      {t.email || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(t.id)}
                    className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Detail
                  </button>
                  {isOperator && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenLinkModal({
                            id: t.id,
                            nama: t.nama,
                            nip: t.nip,
                            linkedAccountId: t.linkedAccountId,
                          })
                        }
                        className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Akun
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(t.id)}
                        className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(t)}
                        className="min-h-[38px] inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                        aria-label={`Hapus ${t.nama}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Modal Import Excel Data Guru */}
      {importOpen && isOperator && (
        <TeacherImportModal
          onClose={() => setImportOpen(false)}
          onImportCompleted={() => {
            setImportOpen(false);
            setSuccessMsg('Import Data Guru dari file Excel berhasil diselesaikan.');
            fetchList();
          }}
        />
      )}

      {/* Modal Tambah / Edit Data Guru */}
      {formOpen && isOperator && (
        <TeacherFormModal
          existingTeacher={editingTeacher}
          onClose={() => {
            setFormOpen(false);
            setEditingTeacher(null);
          }}
          onSaved={(saved) => {
            setFormOpen(false);
            setEditingTeacher(null);
            setSuccessMsg(`Data guru "${saved.nama}" berhasil disimpan.`);
            fetchList();
          }}
        />
      )}

      {/* Modal Detail Data Guru */}
      {detailTeacher && (
        <TeacherDetailModal
          teacher={detailTeacher}
          userRole={userRole}
          onClose={() => setDetailTeacher(null)}
          onEdit={
            isOperator
              ? () => {
                  const target = detailTeacher;
                  setDetailTeacher(null);
                  setEditingTeacher(target);
                  setFormOpen(true);
                }
              : undefined
          }
          onOpenLinkModal={
            isOperator
              ? () =>
                  handleOpenLinkModal({
                    id: detailTeacher.id,
                    nama: detailTeacher.nama,
                    nip: detailTeacher.nip,
                    linkedAccountId: detailTeacher.linkedAccountId,
                  })
              : undefined
          }
        />
      )}

      {/* Modal Hubungkan Akun Login Guru */}
      {linkTarget && isOperator && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-link-teacher-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="modal-link-teacher-account-title"
                  className="text-base font-extrabold text-[#17325C]"
                >
                  Hubungkan Akun Login Guru
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Guru: <strong>{linkTarget.nama}</strong> · NIP:{' '}
                  <strong>{linkTarget.nip || '—'}</strong>
                </p>
              </div>
              <button
                type="button"
                disabled={linkingAccount}
                onClick={() => setLinkTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmLinkAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Akun Login Guru
                </label>
                {loadingAccounts ? (
                  <p className="text-xs text-slate-500 py-2">
                    Memuat daftar akun guru...
                  </p>
                ) : (
                  <select
                    value={selectedLinkAccountId}
                    onChange={(e) => setSelectedLinkAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="">-- Tidak Dihubungkan / Lepas Tautan --</option>
                    {availableAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.fullName} (@{acc.username})
                        {acc.nip ? ` · NIP: ${acc.nip}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                Sistem memvalidasi kecocokan NIP jika Data Guru dan Akun Login sama-sama
                memiliki NIP. Jika guru belum memiliki akun, buat terlebih dahulu melalui{' '}
                <strong>Pengaturan → Manajemen Akun Guru → Tambah Akun Guru</strong>.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={linkingAccount}
                  onClick={() => setLinkTarget(null)}
                  className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={linkingAccount || loadingAccounts}
                  className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
                >
                  {linkingAccount ? 'Menyimpan...' : 'Simpan Tautan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Data Guru */}
      {deleteTarget && isOperator && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-teacher-record-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="modal-delete-teacher-record-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Hapus Data Guru
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  Hapus data <strong>{deleteTarget.nama}</strong>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
