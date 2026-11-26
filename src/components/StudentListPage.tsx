import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { UserRole } from '../types/auth';
import type { StudentListItem, StudentRecord } from '../types/student';
import {
  deleteStudent,
  getStudentDetail,
  listStudents,
} from '../lib/studentApi';
import { DapodikImportModal } from './DapodikImportModal';
import { StudentDetailModal } from './StudentDetailModal';
import { StudentFormModal } from './StudentFormModal';
import { SiswaIcon } from './MenuIcons';

interface StudentListPageProps {
  userRole: UserRole;
  assignedClass?: string;
  onOpenProfil?: () => void;
  onBack: () => void;
  onCreateLetterForStudent?: (student: StudentRecord) => void;
}

function formatBirthDate(value: string): string {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

export const StudentListPage: React.FC<StudentListPageProps> = ({
  userRole,
  assignedClass = '',
  onOpenProfil,
  onBack,
  onCreateLetterForStudent,
}) => {
  const isOperator = userRole === 'OPERATOR';
  const cleanAssignedClass = assignedClass.trim();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [rombels, setRombels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRombel, setSelectedRombel] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [detailStudent, setDetailStudent] = useState<StudentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listStudents({
        search: searchQuery,
        rombel: selectedRombel,
      });
      setStudents(res.students);
      setTotalAll(res.totalAll);
      setRombels(res.rombels);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat daftar siswa.'
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedRombel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchList();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [fetchList]);

  const handleOpenDetail = async (id: string) => {
    setErrorMsg(null);
    try {
      const detail = await getStudentDetail(id);
      setDetailStudent(detail);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat detail profil siswa.'
      );
    }
  };

  const handleOpenEdit = async (id: string) => {
    setErrorMsg(null);
    try {
      const detail = await getStudentDetail(id);
      setDetailStudent(null);
      setEditingStudent(detail);
      setFormOpen(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat data siswa untuk diedit.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteStudent(deleteTarget.id);
      setSuccessMsg(`Data siswa "${deleteTarget.nama}" berhasil dihapus.`);
      setDeleteTarget(null);
      fetchList();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghapus data siswa.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pt-4 sm:pt-6 space-y-4">
      {/* Header Data Siswa */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4BB4FF] via-[#1E7CEB] to-[#0F53BD] border border-[#78C7FF]/75 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(15,83,189,0.4)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/92 hover:bg-white text-[#0F357A] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <SiswaIcon className="w-11 h-11 shrink-0 hidden sm:block drop-shadow-xs" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(7,25,65,0.35)] leading-tight truncate">
              Data Siswa
            </h1>
            <p className="text-xs text-blue-50 mt-0.5 flex items-center gap-1.5 font-medium">
              <Users className="w-3.5 h-3.5 text-blue-100 shrink-0" />
              <span className="tabular-nums">
                Total: <strong className="text-white">{totalAll}</strong> siswa
              </span>
            </p>
          </div>
        </div>

        {isOperator && (
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 border border-white/25 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import Excel
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingStudent(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-blue-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#0F53BD] shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
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

      {/* Peringatan Guru belum memilih kelas */}
      {!isOperator && !cleanAssignedClass && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-medium">
              Anda belum memilih kelas yang dipegang di menu Profil.
            </span>
          </div>
          {onOpenProfil && (
            <button
              type="button"
              onClick={onOpenProfil}
              className="rounded-xl border border-amber-300 bg-white hover:bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 cursor-pointer whitespace-nowrap"
            >
              Pilih Kelas di Profil
            </button>
          )}
        </div>
      )}

      {/* Kolom Pencarian & Filter Kelas */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, NISN, atau NIPD..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        {isOperator ? (
          <select
            value={selectedRombel}
            onChange={(e) => setSelectedRombel(e.target.value)}
            aria-label="Filter Kelas atau Rombongan Belajar"
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="">Semua Kelas / Rombel</option>
            {rombels.map((rombel) => (
              <option key={rombel} value={rombel}>
                {rombel}
              </option>
            ))}
          </select>
        ) : (
          <div
            aria-label="Kelas yang dipegang"
            className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#17325C] whitespace-nowrap"
          >
            {cleanAssignedClass
              ? `Kelas: ${cleanAssignedClass}`
              : 'Kelas Belum Dipilih'}
          </div>
        )}
      </div>

      {/* Daftar Siswa */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data siswa...
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {!isOperator && !cleanAssignedClass
              ? 'Pilih kelas yang Anda pegang di Profil untuk melihat siswa.'
              : totalAll === 0
                ? 'Belum ada data siswa.'
                : 'Tidak ada siswa yang sesuai.'}
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
                    <th className="px-4 py-3">Nama Siswa</th>
                    <th className="px-4 py-3">NISN</th>
                    <th className="px-4 py-3">NIPD</th>
                    <th className="px-4 py-3">JK</th>
                    <th className="px-4 py-3">Tempat & Tanggal Lahir</th>
                    <th className="px-4 py-3">Kelas / Rombel</th>
                    <th className="px-4 py-3">Status Data</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {students.map((s) => {
                    const ttl = [s.tempatLahir, formatBirthDate(s.tanggalLahir)]
                      .filter((part) => part && part !== '-')
                      .join(', ');
                    const lengkap = s.statusData === 'LENGKAP';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {s.nama}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">
                          {s.nisn || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">
                          {s.nipd || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{s.jk || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{ttl || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-[#17325C]">
                          {s.rombelSaatIni || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                              lengkap
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {lengkap ? 'Lengkap' : 'Perlu Periksa'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(s.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Profil
                            </button>
                            {isOperator && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(s.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(s)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                                  aria-label={`Hapus ${s.nama}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kartu Android / Mobile */}
          <div className="md:hidden space-y-3">
            {students.map((s) => {
              const ttl = [s.tempatLahir, formatBirthDate(s.tanggalLahir)]
                .filter((part) => part && part !== '-')
                .join(', ');
              const lengkap = s.statusData === 'LENGKAP';
              return (
                <article
                  key={s.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {s.nama}
                      </h2>
                      <p className="text-xs font-semibold text-[#1D63D8] mt-0.5">
                        {s.rombelSaatIni || 'Kelas belum diisi'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                        lengkap
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {lengkap ? 'Lengkap' : 'Perlu Periksa'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <div>
                      <span className="text-slate-500 block">NISN</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {s.nisn || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">NIPD</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {s.nipd || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Jenis Kelamin</span>
                      <span className="font-semibold text-slate-800">
                        {s.jk === 'L' ? 'Laki-laki' : s.jk === 'P' ? 'Perempuan' : s.jk || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">TTL</span>
                      <span className="font-medium text-slate-800">{ttl || '-'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(s.id)}
                      className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Profil
                    </button>
                    {isOperator && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s.id)}
                          className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="min-h-[38px] inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                          aria-label={`Hapus ${s.nama}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Import Excel Dapodik */}
      {importOpen && isOperator && (
        <DapodikImportModal
          onClose={() => setImportOpen(false)}
          onImportCompleted={() => {
            setImportOpen(false);
            setSuccessMsg('Import data siswa Dapodik berhasil diselesaikan.');
            fetchList();
          }}
        />
      )}

      {/* Modal Tambah / Edit Siswa */}
      {formOpen && isOperator && (
        <StudentFormModal
          existingStudent={editingStudent}
          onClose={() => {
            setFormOpen(false);
            setEditingStudent(null);
          }}
          onSaved={(saved) => {
            setFormOpen(false);
            setEditingStudent(null);
            setSuccessMsg(`Data siswa "${saved.nama}" berhasil disimpan.`);
            fetchList();
          }}
        />
      )}

      {/* Modal Detail Profil Siswa */}
      {detailStudent && (
        <StudentDetailModal
          student={detailStudent}
          userRole={userRole}
          onClose={() => setDetailStudent(null)}
          onCreateLetter={
            isOperator && onCreateLetterForStudent
              ? () => {
                  const target = detailStudent;
                  setDetailStudent(null);
                  onCreateLetterForStudent(target);
                }
              : undefined
          }
          onEdit={
            isOperator
              ? () => {
                  const target = detailStudent;
                  setDetailStudent(null);
                  setEditingStudent(target);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      )}

      {/* Modal Konfirmasi Hapus Siswa */}
      {deleteTarget && isOperator && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-student-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="modal-delete-student-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Hapus Data Siswa
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  Hapus data siswa <strong>{deleteTarget.nama}</strong>?
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
