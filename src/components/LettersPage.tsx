import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings as SettingsIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  LETTER_TYPE_REGISTRY,
  type LetterPaperSize,
  type LetterRecord,
  type LetterTypeId,
  type StudentAcceptedLetterData,
} from '../types/letter';
import type { SchoolSettings } from '../types/settings';
import type { StudentListItem, StudentRecord } from '../types/student';
import { getStudentDetail, listStudents } from '../lib/studentApi';
import {
  createLetter,
  deleteLetter,
  listLetters,
  updateLetter,
} from '../lib/letterApi';
import {
  applyStudentToLetterData,
  createDefaultLetterData,
  formatIndonesianFullDate,
  generateDefaultLetterNumber,
} from '../lib/letterHelpers';
import { downloadLetterPdf } from '../lib/letterPdf';
import { SuratKeteranganDiterimaPreview } from './SuratKeteranganDiterimaPreview';
import { SuratPindahSekolahPreview } from './SuratPindahSekolahPreview';
import { SuratIcon } from './MenuIcons';

interface LettersPageProps {
  settings: SchoolSettings;
  initialStudent?: StudentRecord | null;
  onClearInitialStudent?: () => void;
  onBack: () => void;
  onNavigateSettings: () => void;
  onNavigateStudents: () => void;
}

type LettersTab = 'editor' | 'archive';

export const LettersPage: React.FC<LettersPageProps> = ({
  settings,
  initialStudent,
  onClearInitialStudent,
  onBack,
  onNavigateSettings,
  onNavigateStudents,
}) => {
  const [activeTab, setActiveTab] = useState<LettersTab>('editor');
  const [selectedType, setSelectedType] = useState<LetterTypeId>(
    'SUKET_SISWA_DITERIMA'
  );

  // Saved letters archive state
  const [letters, setLetters] = useState<LetterRecord[]>([]);
  const [totalLetters, setTotalLetters] = useState(0);
  const [nextSeq, setNextSeq] = useState(1);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [loadingArchive, setLoadingArchive] = useState(true);

  // Linked student directory for auto-fill
  const [studentOptions, setStudentOptions] = useState<StudentListItem[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);

  const filteredStudentOptions = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return studentOptions;
    return studentOptions.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.nipd && s.nipd.toLowerCase().includes(q)) ||
        (s.rombelSaatIni && s.rombelSaatIni.toLowerCase().includes(q))
    );
  }, [studentOptions, studentSearch]);

  // Active editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StudentAcceptedLetterData>(() =>
    createDefaultLetterData(settings, 1)
  );
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LetterRecord | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const missingSettingsFields: string[] = [];
  if (!settings.identity.schoolName?.trim()) missingSettingsFields.push('Nama Sekolah');
  if (!settings.principal.name?.trim()) missingSettingsFields.push('Kepala Sekolah');

  const fetchArchive = useCallback(
    async (searchValue?: string) => {
      setLoadingArchive(true);
      try {
        const res = await listLetters({
          search: searchValue ?? '',
        });
        setLetters(res.letters);
        setTotalLetters(res.totalAll);
        setNextSeq(res.nextSequenceNumber);
        setFormData((prev) => {
          if (editingId) return prev;
          if (
            prev.letterNumber.startsWith('421.2/001/') &&
            res.nextSequenceNumber > 1 &&
            !prev.studentName
          ) {
            return {
              ...prev,
              letterNumber: generateDefaultLetterNumber(
                res.nextSequenceNumber,
                settings.identity.schoolName,
                prev.letterDate
              ),
            };
          }
          return prev;
        });
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Gagal memuat arsip surat.'
        );
      } finally {
        setLoadingArchive(false);
      }
    },
    [editingId, settings.identity.schoolName]
  );

  useEffect(() => {
    fetchArchive('');
  }, [fetchArchive]);

  useEffect(() => {
    let active = true;
    setLoadingStudents(true);
    listStudents()
      .then((res) => {
        if (active) setStudentOptions(res.students);
      })
      .catch(() => {
        // Non-fatal if student directory is empty
      })
      .finally(() => {
        if (active) setLoadingStudents(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchArchive(archiveSearch);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [archiveSearch, fetchArchive]);

  useEffect(() => {
    setFormData((prev) => {
      if (editingId) return prev;
      const nextCity = prev.letterCity || settings.identity.city?.trim() || '';
      const nextLoc =
        prev.schoolLocationLine || settings.identity.city?.trim() || '';
      const shouldUpdateNumber =
        prev.letterNumber.includes('/SEKOLAH/') &&
        Boolean(settings.identity.schoolName?.trim());
      return {
        ...prev,
        letterCity: nextCity,
        schoolLocationLine: nextLoc,
        letterNumber: shouldUpdateNumber
          ? generateDefaultLetterNumber(
              nextSeq,
              settings.identity.schoolName,
              prev.letterDate
            )
          : prev.letterNumber,
      };
    });
  }, [settings, editingId, nextSeq]);

  useEffect(() => {
    if (!initialStudent) return;
    setEditingId(null);
    setSelectedType('SUKET_PINDAH_SEKOLAH');
    setActiveTab('editor');
    setErrorMsg(null);
    setSuccessMsg(`Data "${initialStudent.nama}" dimuat.`);
    setFormData((prev) => applyStudentToLetterData(prev, initialStudent));
    onClearInitialStudent?.();
  }, [initialStudent, onClearInitialStudent]);

  const handleSelectStudentFromDirectory = async (studentId: string) => {
    if (!studentId) {
      setFormData((prev) => ({
        ...prev,
        studentId: null,
      }));
      return;
    }

    setLoadingStudentDetail(true);
    setErrorMsg(null);
    try {
      const detail = await getStudentDetail(studentId);
      setFormData((prev) => applyStudentToLetterData(prev, detail));
      setSuccessMsg(`Data "${detail.nama}" dimuat.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengambil data siswa.'
      );
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  const handleResetNewLetter = () => {
    setEditingId(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setStudentSearch('');
    setFormData(createDefaultLetterData(settings, nextSeq));
  };

  const handleSelectType = (nextType: LetterTypeId) => {
    setSelectedType(nextType);
    if (!editingId && nextType === 'SUKET_SISWA_DITERIMA' && formData.studentId) {
      setStudentSearch('');
      setFormData((prev) => ({
        ...prev,
        studentId: null,
        studentName: '',
        birthPlace: '',
        birthDate: '',
        gender: 'Laki - Laki',
        religion: 'Islam',
        address: '',
        originSchool: '',
        targetClass: '',
      }));
    }
  };

  const handleOpenArchivedLetter = (record: LetterRecord) => {
    setEditingId(record.id);
    setSelectedType(record.type);
    setFormData({
      ...createDefaultLetterData(settings, nextSeq),
      ...record.data,
    });
    setActiveTab('editor');
    setErrorMsg(null);
    setSuccessMsg(`Arsip ${record.letterNumber} dibuka.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (): Promise<LetterRecord | null> => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formData.letterNumber.trim()) {
      setErrorMsg('Nomor surat wajib diisi.');
      return null;
    }
    if (!formData.studentName.trim()) {
      setErrorMsg('Nama siswa wajib diisi.');
      return null;
    }

    setSaving(true);
    try {
      const saved = editingId
        ? await updateLetter(editingId, { type: selectedType, data: formData })
        : await createLetter({ type: selectedType, data: formData });

      setEditingId(saved.id);
      setFormData({ ...saved.data });
      setSuccessMsg(
        editingId
          ? `Surat ${saved.letterNumber} diperbarui.`
          : `Surat ${saved.letterNumber} tersimpan.`
      );
      await fetchArchive(archiveSearch);
      return saved;
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan surat.'
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setErrorMsg(null);
    setDownloadingPdf(true);
    try {
      await downloadLetterPdf(selectedType, formData, settings);
      setSuccessMsg('PDF surat berhasil diunduh.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengunduh PDF surat.'
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteLetter(deleteTarget.id);
      if (editingId === deleteTarget.id) {
        setEditingId(null);
        setFormData(createDefaultLetterData(settings, Math.max(1, nextSeq - 1)));
      }
      setSuccessMsg(`Arsip ${deleteTarget.letterNumber} dihapus.`);
      setDeleteTarget(null);
      await fetchArchive(archiveSearch);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghapus arsip.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const paperLabel =
    selectedType === 'SUKET_PINDAH_SEKOLAH'
      ? formData.paperSize === 'LEGAL'
        ? 'Legal'
        : 'F4'
      : 'A4';

  return (
    <div className="pt-4 sm:pt-6 space-y-4">
      {/* Header Halaman Surat */}
      <div className="print-hidden relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFE3B3] via-[#F7BE72] to-[#E59337] border border-[#FFD38C]/90 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(229,147,55,0.38)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 hover:bg-white text-[#2D1804] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <SuratIcon className="w-11 h-11 shrink-0 hidden sm:block drop-shadow-xs" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-[#2D1804] leading-tight truncate">
              Surat Sekolah
            </h1>
            <p className="text-xs font-semibold text-[#4F2D0A] truncate">
              Persuratan &amp; Arsip Dokumen Resmi
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-1 rounded-xl bg-black/10 p-1 self-start sm:self-auto backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-white text-[#2D1804] shadow-xs'
                : 'text-[#3B2005] hover:bg-white/45'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Buat Surat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer tabular-nums ${
              activeTab === 'archive'
                ? 'bg-white text-[#2D1804] shadow-xs'
                : 'text-[#3B2005] hover:bg-white/45'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Arsip ({totalLetters})
          </button>
        </div>
      </div>

      {/* Ringkasan Sekolah */}
      <div className="print-hidden">
        {missingSettingsFields.length > 0 ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Lengkapi <strong>{missingSettingsFields.join(', ')}</strong> di Pengaturan.
              </span>
            </div>
            <button
              type="button"
              onClick={onNavigateSettings}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              Pengaturan
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
              <strong className="text-[#17325C]">{settings.identity.schoolName}</strong>
              <span>
                Kepsek: <strong className="text-[#17325C]">{settings.principal.name}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onNavigateStudents}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
              >
                <Users className="w-3 h-3 text-blue-600" />
                Siswa
              </button>
              <button
                type="button"
                onClick={onNavigateSettings}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
              >
                <SettingsIcon className="w-3 h-3 text-blue-600" />
                Pengaturan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifikasi */}
      {successMsg && (
        <div
          role="status"
          className="print-hidden flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs sm:text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="print-hidden flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-xs sm:text-sm text-rose-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 text-rose-700 hover:text-rose-900 cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'editor' ? (
        <div className="space-y-4">
          {/* Pemilih Jenis Surat */}
          <section className="print-hidden bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Jenis Surat
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={handleResetNewLetter}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-bold text-[#1D63D8] whitespace-nowrap cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  Surat Baru
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LETTER_TYPE_REGISTRY.map((item) => {
                const isSelected = selectedType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectType(item.id)}
                    className={`text-left rounded-xl border px-3.5 py-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#1D63D8] bg-blue-50/70 ring-2 ring-blue-600/15'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs sm:text-sm font-extrabold text-[#17325C]">
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Formulir Input */}
          <section className="print-hidden bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] space-y-4">
            {/* Ambil Data Siswa (khusus Surat Keterangan Pindah Sekolah; Surat Ket. Diterima diisi manual) */}
            {selectedType === 'SUKET_PINDAH_SEKOLAH' && (
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="letter-student-picker"
                    className="text-xs font-extrabold text-[#17325C] flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4 text-[#1D63D8]" />
                    Data Siswa ({studentOptions.length})
                  </label>
                {formData.studentId && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, studentId: null }))
                    }
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    Lepas Siswa
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="letter-student-search"
                    type="search"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    disabled={loadingStudents}
                    placeholder="Cari nama anak, NISN, atau kelas..."
                    aria-label="Cari nama anak"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => setStudentSearch('')}
                      aria-label="Hapus pencarian"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {studentSearch.trim() !== '' && (
                  <div className="rounded-xl border border-blue-200 bg-white max-h-44 overflow-y-auto divide-y divide-slate-100 shadow-xs">
                    {filteredStudentOptions.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        Tidak ditemukan. Isi manual di bawah.
                      </p>
                    ) : (
                      filteredStudentOptions.slice(0, 25).map((s) => {
                        const isSelected = formData.studentId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={loadingStudentDetail}
                            onClick={() => {
                              handleSelectStudentFromDirectory(s.id);
                              setStudentSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-[#1D63D8] font-bold'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <span className="truncate font-semibold">{s.nama}</span>
                            <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                              {[s.rombelSaatIni, s.nisn ? `NISN ${s.nisn}` : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                <select
                  id="letter-student-picker"
                  value={formData.studentId || ''}
                  disabled={loadingStudents || loadingStudentDetail}
                  onChange={(e) => handleSelectStudentFromDirectory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                >
                  <option value="">
                    {loadingStudents
                      ? 'Memuat siswa...'
                      : '— Pilih Siswa atau Isi Manual —'}
                  </option>
                    {filteredStudentOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama}
                        {s.nisn ? ` · ${s.nisn}` : ''}
                        {s.rombelSaatIni ? ` (${s.rombelSaatIni})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Metadata Surat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor="letter-number"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Nomor Surat *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        letterNumber: generateDefaultLetterNumber(
                          nextSeq,
                          settings.identity.schoolName,
                          prev.letterDate
                        ),
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D63D8] hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Otomatis
                  </button>
                </div>
                <input
                  id="letter-number"
                  type="text"
                  value={formData.letterNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      letterNumber: e.target.value,
                    }))
                  }
                  placeholder="421.2/389/SDN.CU04/IV/2026"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="letter-date"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Tanggal Surat
                </label>
                <input
                  id="letter-date"
                  type="date"
                  value={formData.letterDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      letterDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="letter-city"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Kota / Kabupaten
                </label>
                <input
                  id="letter-city"
                  type="text"
                  value={formData.letterCity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      letterCity: e.target.value,
                    }))
                  }
                  placeholder="Bekasi"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="school-location-line"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Wilayah Sekolah
                </label>
                <input
                  id="school-location-line"
                  type="text"
                  value={formData.schoolLocationLine}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      schoolLocationLine: e.target.value,
                    }))
                  }
                  placeholder="Kecamatan Bantargebang Kota Bekasi"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {selectedType === 'SUKET_PINDAH_SEKOLAH' && (
                <div>
                  <label
                    htmlFor="letter-paper-size"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Ukuran Kertas Cetak
                  </label>
                  <select
                    id="letter-paper-size"
                    value={formData.paperSize}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        paperSize: e.target.value as LetterPaperSize,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="F4">F4 (215 x 330 mm)</option>
                    <option value="LEGAL">Legal (215,9 x 355,6 mm)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Data Siswa & Form Spesifik Jenis Surat */}
            {selectedType === 'SUKET_PINDAH_SEKOLAH' ? (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Data Siswa &amp; Tujuan Pindah
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="student-name"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Nama Siswa *
                    </label>
                    <input
                      id="student-name"
                      type="text"
                      value={formData.studentName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          studentName: e.target.value,
                        }))
                      }
                      placeholder="Nama lengkap siswa"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="student-nipd-nisn"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      No Induk / NISN
                    </label>
                    <input
                      id="student-nipd-nisn"
                      type="text"
                      value={formData.nipdNisn}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          nipdNisn: e.target.value,
                        }))
                      }
                      placeholder="Contoh: 252601129"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="student-gender"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Jenis Kelamin
                    </label>
                    <select
                      id="student-gender"
                      value={formData.gender}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          gender: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value="Laki - Laki">Laki - Laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="student-target-class"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Kelas
                    </label>
                    <input
                      id="student-target-class"
                      type="text"
                      value={formData.targetClass}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          targetClass: e.target.value,
                        }))
                      }
                      placeholder="Contoh: I D"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="parent-name"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Nama Orang Tua / Wali
                    </label>
                    <input
                      id="parent-name"
                      type="text"
                      value={formData.parentName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          parentName: e.target.value,
                        }))
                      }
                      placeholder="Nama orang tua / wali"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="parent-job"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Pekerjaan
                    </label>
                    <input
                      id="parent-job"
                      type="text"
                      value={formData.parentJob}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          parentJob: e.target.value,
                        }))
                      }
                      placeholder="Contoh: Wiraswasta"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="destination-school"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Sekolah Tujuan
                    </label>
                    <input
                      id="destination-school"
                      type="text"
                      value={formData.destinationSchool}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          destinationSchool: e.target.value,
                        }))
                      }
                      placeholder="Contoh: SDN Pasirangin 04"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="transfer-reason"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Alasan Pindah
                    </label>
                    <input
                      id="transfer-reason"
                      type="text"
                      value={formData.transferReason}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          transferReason: e.target.value,
                        }))
                      }
                      placeholder="permintaan orang tua / wali siswa"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Identitas Siswa
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="student-name"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Nama Siswa *
                      </label>
                      <input
                        id="student-name"
                        type="text"
                        value={formData.studentName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            studentName: e.target.value,
                          }))
                        }
                        placeholder="Nama lengkap siswa"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="student-birth-place"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Tempat Lahir
                      </label>
                      <input
                        id="student-birth-place"
                        type="text"
                        value={formData.birthPlace}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            birthPlace: e.target.value,
                          }))
                        }
                        placeholder="Bekasi"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="student-birth-date"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Tanggal Lahir
                      </label>
                      <input
                        id="student-birth-date"
                        type="date"
                        value={
                          /^\d{4}-\d{2}-\d{2}$/.test(formData.birthDate)
                            ? formData.birthDate
                            : ''
                        }
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            birthDate: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="student-gender"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Jenis Kelamin
                      </label>
                      <select
                        id="student-gender"
                        value={formData.gender}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            gender: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      >
                        <option value="Laki - Laki">Laki - Laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="student-religion"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Agama
                      </label>
                      <input
                        id="student-religion"
                        type="text"
                        value={formData.religion}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            religion: e.target.value,
                          }))
                        }
                        placeholder="Islam"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="student-address"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Alamat / Domisili
                      </label>
                      <input
                        id="student-address"
                        type="text"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                        placeholder="Alamat lengkap"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="student-origin-school"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Asal Sekolah
                      </label>
                      <input
                        id="student-origin-school"
                        type="text"
                        value={formData.originSchool}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            originSchool: e.target.value,
                          }))
                        }
                        placeholder="Sekolah asal"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="student-target-class"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Kelas
                      </label>
                      <input
                        id="student-target-class"
                        type="text"
                        list="roman-class-list"
                        value={formData.targetClass}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            targetClass: e.target.value,
                          }))
                        }
                        placeholder="Contoh: IV"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                      <datalist id="roman-class-list">
                        <option value="I" />
                        <option value="II" />
                        <option value="III" />
                        <option value="IV" />
                        <option value="V" />
                        <option value="VI" />
                      </datalist>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-1 gap-3">
                  <div>
                    <label
                      htmlFor="letter-requirement-clause"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Kalimat Ketentuan
                    </label>
                    <input
                      id="letter-requirement-clause"
                      type="text"
                      value={formData.requirementClause}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          requirementClause: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="letter-closing-clause"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Kalimat Penutup
                    </label>
                    <textarea
                      id="letter-closing-clause"
                      rows={2}
                      value={formData.closingClause}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          closingClause: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Opsi Kop & TTD */}
            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showKop}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      showKop: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-slate-300 text-[#1D63D8] focus:ring-blue-600"
                />
                Kop Surat
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showSignatureAssets}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      showSignatureAssets: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-slate-300 text-[#1D63D8] focus:ring-blue-600"
                />
                TTD &amp; Stempel
              </label>
            </div>

            {/* Tombol Aksi Singkat & Berfungsi */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-xs text-slate-500">
                {editingId ? 'Mode Edit' : 'Draft Baru'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void handleSave();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs whitespace-nowrap cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-800 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {downloadingPdf ? 'Mengunduh...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak
                </button>
              </div>
            </div>
          </section>

          {/* Pratinjau Hasil Cetak */}
          <section className="space-y-2.5">
            <div className="print-hidden flex items-center justify-between px-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Pratinjau ({paperLabel})
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D63D8] hover:underline cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:underline cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak
                </button>
              </div>
            </div>

            <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
              {selectedType === 'SUKET_PINDAH_SEKOLAH' ? (
                <SuratPindahSekolahPreview data={formData} settings={settings} />
              ) : (
                <SuratKeteranganDiterimaPreview
                  data={formData}
                  settings={settings}
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        /* Tab Arsip Surat */
        <div className="print-hidden space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="Cari nomor surat atau nama siswa..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                handleResetNewLetter();
                setActiveTab('editor');
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-3.5 py-2 text-xs sm:text-sm font-bold text-white whitespace-nowrap cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              Surat Baru
            </button>
          </div>

          {loadingArchive ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Memuat arsip...
            </div>
          ) : letters.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {totalLetters === 0
                  ? 'Belum ada arsip surat.'
                  : 'Tidak ada arsip yang cocok.'}
              </p>
            </div>
          ) : (
            <>
              {/* Tabel Desktop */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="px-4 py-3">Jenis</th>
                        <th className="px-4 py-3">Nomor Surat</th>
                        <th className="px-4 py-3">Nama Siswa</th>
                        <th className="px-4 py-3">Kelas</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {letters.map((l) => (
                        <tr
                          key={l.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                            {l.type === 'SUKET_PINDAH_SEKOLAH'
                              ? 'Pindah Sekolah'
                              : 'Ket. Diterima'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#17325C]">
                            {l.letterNumber}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {l.recipientName}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {l.data.targetClass || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatIndonesianFullDate(l.letterDate) || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenArchivedLetter(l)}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Buka
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(l)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                                aria-label={`Hapus surat ${l.letterNumber}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Kartu Mobile / Android */}
              <div className="md:hidden space-y-3">
                {letters.map((l) => (
                  <article
                    key={l.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-2.5"
                  >
                    <div>
                      <p className="font-mono text-[11px] font-bold text-[#1D63D8]">
                        {l.letterNumber}
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        {l.recipientName}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">{l.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div>
                        <span className="text-slate-500 block">Kelas</span>
                        <span className="font-semibold text-slate-800">
                          {l.data.targetClass || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tanggal</span>
                        <span className="font-medium text-slate-800">
                          {formatIndonesianFullDate(l.letterDate) || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenArchivedLetter(l)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Buka
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(l)}
                        className="min-h-[38px] inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                        aria-label={`Hapus surat ${l.letterNumber}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-letter-title"
          className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="modal-delete-letter-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Hapus Arsip
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  Hapus surat <strong>{deleteTarget.letterNumber}</strong> (
                  <strong>{deleteTarget.recipientName}</strong>)?
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
