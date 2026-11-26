import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import type {
  DapodikImportCommitResult,
  DapodikPreviewResult,
  DapodikPreviewRow,
  ImportConflictMode,
  PreviewRowStatus,
  RowImportDecision,
} from '../types/student';
import {
  commitDapodikImport,
  previewDapodikExcel,
  validateExcelFileSelection,
} from '../lib/studentApi';

interface DapodikImportModalProps {
  onClose: () => void;
  onImportCompleted: () => void;
}

type ImportStep = 'UPLOAD' | 'PREVIEW' | 'RESULT';
type PreviewFilter = 'ALL' | 'VALID' | 'DUPLICATE' | 'ATTENTION';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatBirthDateDisplay(value: string): string {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

function getStatusBadge(status: PreviewRowStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'VALID':
      return {
        label: 'Valid',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'SUDAH_ADA':
      return {
        label: 'Sudah Ada',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'DUPLIKAT_FILE':
      return {
        label: 'Duplikat File',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'TIDAK_LENGKAP':
      return {
        label: 'Tidak Lengkap',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'PERLU_PERIKSA':
      return {
        label: 'Perlu Diperiksa',
        className: 'bg-orange-50 text-orange-800 border-orange-200',
      };
  }
}

export const DapodikImportModal: React.FC<DapodikImportModalProps> = ({
  onClose,
  onImportCompleted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [checking, setChecking] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<DapodikPreviewResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('ALL');
  const [conflictMode, setConflictMode] =
    useState<ImportConflictMode>('INSERT_NEW_ONLY');
  const [perRowDecisions, setPerRowDecisions] = useState<
    Record<number, RowImportDecision>
  >({});

  const [commitResult, setCommitResult] =
    useState<DapodikImportCommitResult | null>(null);

  const handleSelectFile = (file: File | null) => {
    setErrorMsg(null);
    if (!file) return;
    const err = validateExcelFileSelection(file);
    if (err) {
      setErrorMsg(err);
      return;
    }
    setSelectedFile(file);
  };

  const handleInspectFile = async () => {
    if (!selectedFile) {
      setErrorMsg('Silakan pilih file Excel Dapodik terlebih dahulu.');
      return;
    }
    setErrorMsg(null);
    setChecking(true);
    try {
      const result = await previewDapodikExcel(selectedFile);
      setPreviewData(result);
      setPerRowDecisions({});
      setPreviewFilter('ALL');
      setStep('PREVIEW');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memeriksa file Excel Dapodik.'
      );
    } finally {
      setChecking(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewData) return;
    setErrorMsg(null);
    setCommitting(true);
    try {
      const result = await commitDapodikImport({
        previewId: previewData.previewId,
        conflictMode,
        perRowDecisions,
      });
      setCommitResult(result);
      setStep('RESULT');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal melakukan import data siswa.'
      );
    } finally {
      setCommitting(false);
    }
  };

  const filteredPreviewRows = useMemo<DapodikPreviewRow[]>(() => {
    if (!previewData) return [];
    return previewData.rows.filter((row) => {
      if (previewFilter === 'VALID') return row.status === 'VALID';
      if (previewFilter === 'DUPLICATE') {
        return row.status === 'SUDAH_ADA' || row.status === 'DUPLIKAT_FILE';
      }
      if (previewFilter === 'ATTENTION') {
        return row.status === 'TIDAK_LENGKAP' || row.status === 'PERLU_PERIKSA';
      }
      return true;
    });
  }, [previewData, previewFilter]);

  const busy = checking || committing;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dapodik-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5"
    >
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[94dvh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="dapodik-import-title"
                className="text-base sm:text-lg font-extrabold text-[#17325C] truncate"
              >
                Import Data Dapodik
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {step === 'UPLOAD' && 'Unggah file Excel hasil ekspor Dapodik (Sheet1, A–BN)'}
                {step === 'PREVIEW' &&
                  `Preview ${previewData?.filename ?? ''} · Sheet: ${previewData?.sheetName ?? 'Sheet1'}`}
                {step === 'RESULT' && 'Ringkasan Hasil Import Data Siswa'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (step === 'RESULT') {
                onImportCompleted();
              } else {
                onClose();
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            aria-label="Tutup jendela import"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs sm:text-sm text-rose-700 font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* LANGKAH 1: PILIH FILE */}
          {step === 'UPLOAD' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const dropped = e.dataTransfer.files?.[0] || null;
                  handleSelectFile(dropped);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/70'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleSelectFile(file);
                    e.target.value = '';
                  }}
                />

                <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#1D63D8]">
                  <Upload className="w-7 h-7" />
                </div>

                <h3 className="mt-4 text-sm sm:text-base font-bold text-slate-900">
                  Pilih File Excel Ekspor Dapodik
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Format yang didukung: <strong>XLSX</strong> dan <strong>XLS</strong> (maks. 15 MB)
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Pilih File
                </button>
              </div>

              {selectedFile && (
                <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        Ukuran: {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                  >
                    Hapus
                  </button>
                </div>
              )}

              <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 px-4 py-3 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-[#17325C]">Ketentuan Pembacaan Dapodik:</p>
                <p>
                  Sistem membaca <strong>Sheet1</strong> (baris 1–2 sebagai header bertingkat dan baris 3 ke bawah sebagai data siswa pada kolom <strong>A–BN</strong> / 66 kolom) serta melakukan pemeriksaan preview sebelum data disimpan.
                </p>
              </div>
            </div>
          )}

          {/* LANGKAH 2: PREVIEW & VALIDASI */}
          {step === 'PREVIEW' && previewData && (
            <div className="space-y-4">
              {/* Ringkasan Statistik Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Baris Ditemukan
                  </span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {previewData.summary.totalRows}
                  </span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-emerald-700 block">
                    Data Valid (Baru)
                  </span>
                  <span className="text-lg font-extrabold text-emerald-800">
                    {previewData.summary.validCount}
                  </span>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-blue-700 block">
                    Data Duplikat
                  </span>
                  <span className="text-lg font-extrabold text-blue-800">
                    {previewData.summary.duplicateCount}
                  </span>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-rose-700 block">
                    Tidak Lengkap
                  </span>
                  <span className="text-lg font-extrabold text-rose-800">
                    {previewData.summary.incompleteCount}
                  </span>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-semibold text-orange-700 block">
                    Perlu Diperiksa
                  </span>
                  <span className="text-lg font-extrabold text-orange-800">
                    {previewData.summary.reviewCount}
                  </span>
                </div>
              </div>

              {/* Pilihan Penanganan Data Ganda */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-[#17325C]">
                  Aturan Penanganan Data yang Sudah Ada / Duplikat:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'INSERT_NEW_ONLY',
                        title: 'Tambahkan hanya siswa baru',
                        desc: 'Siswa yang sudah ada tidak diubah.',
                      },
                      {
                        id: 'UPDATE_EXISTING',
                        title: 'Perbarui data siswa yang sudah ada',
                        desc: 'Cocokkan NISN/NIPD lalu perbarui.',
                      },
                      {
                        id: 'SKIP_DUPLICATES',
                        title: 'Lewati data duplikat',
                        desc: 'Lewati seluruh data yang cocok/ganda.',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = conflictMode === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                          active
                            ? 'bg-white border-blue-600 ring-1 ring-blue-600/20'
                            : 'bg-white/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="conflict-mode"
                          checked={active}
                          onChange={() => setConflictMode(opt.id)}
                          className="mt-0.5 accent-[#1D63D8]"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block">
                            {opt.title}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {opt.desc}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Filter Baris Preview */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${previewData.rows.length})` },
                    { id: 'VALID', label: `Valid (${previewData.summary.validCount})` },
                    {
                      id: 'DUPLICATE',
                      label: `Duplikat (${previewData.summary.duplicateCount})`,
                    },
                    {
                      id: 'ATTENTION',
                      label: `Periksa (${previewData.summary.incompleteCount + previewData.summary.reviewCount})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      previewFilter === tab.id
                        ? 'bg-[#1D63D8] text-white border-[#1D63D8]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tabel Preview (Web & Tablet) */}
              <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[340px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2.5">Br</th>
                        <th className="px-3 py-2.5">Nama Siswa</th>
                        <th className="px-3 py-2.5">NIPD</th>
                        <th className="px-3 py-2.5">NISN</th>
                        <th className="px-3 py-2.5">JK</th>
                        <th className="px-3 py-2.5">Tanggal Lahir</th>
                        <th className="px-3 py-2.5">Rombel Saat Ini</th>
                        <th className="px-3 py-2.5">Status Validasi</th>
                        <th className="px-3 py-2.5">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewRows.map((row) => {
                        const badge = getStatusBadge(row.status);
                        const decision = perRowDecisions[row.rowNumber] || 'AUTO';
                        return (
                          <tr key={row.rowNumber} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2 text-slate-400 font-mono">
                              {row.rowNumber}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {row.summary.nama || <span className="text-rose-500">(Kosong)</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-700">
                              {row.summary.nipd || '-'}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-700">
                              {row.summary.nisn || '-'}
                            </td>
                            <td className="px-3 py-2">{row.summary.jk || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatBirthDateDisplay(row.summary.tanggalLahir)}
                            </td>
                            <td className="px-3 py-2">
                              {row.summary.rombelSaatIni || '-'}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                              {row.issues.length > 0 && (
                                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                                  {row.issues.join('; ')}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={decision}
                                onChange={(e) =>
                                  setPerRowDecisions((prev) => ({
                                    ...prev,
                                    [row.rowNumber]: e.target.value as RowImportDecision,
                                  }))
                                }
                                aria-label={`Tindakan baris ${row.rowNumber}`}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                              >
                                <option value="AUTO">Ikuti Aturan</option>
                                {row.matchedStudentId && (
                                  <option value="UPDATE">Perbarui</option>
                                )}
                                <option value="SKIP">Lewati</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Kartu Preview (Android / Mobile) */}
              <div className="md:hidden space-y-2.5 max-h-[340px] overflow-y-auto pr-0.5">
                {filteredPreviewRows.map((row) => {
                  const badge = getStatusBadge(row.status);
                  const decision = perRowDecisions[row.rowNumber] || 'AUTO';
                  return (
                    <div
                      key={row.rowNumber}
                      className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400">
                            Baris {row.rowNumber}
                          </span>
                          <p className="font-bold text-slate-900 truncate">
                            {row.summary.nama || '(Nama kosong)'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                        <div>NIPD: {row.summary.nipd || '-'}</div>
                        <div>NISN: {row.summary.nisn || '-'}</div>
                        <div>JK: {row.summary.jk || '-'}</div>
                        <div>
                          Tgl Lahir: {formatBirthDateDisplay(row.summary.tanggalLahir)}
                        </div>
                        <div className="col-span-2">
                          Rombel: <strong>{row.summary.rombelSaatIni || '-'}</strong>
                        </div>
                      </div>

                      {row.issues.length > 0 && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                          {row.issues.join('; ')}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Tindakan:
                        </span>
                        <select
                          value={decision}
                          onChange={(e) =>
                            setPerRowDecisions((prev) => ({
                              ...prev,
                              [row.rowNumber]: e.target.value as RowImportDecision,
                            }))
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          <option value="AUTO">Ikuti Aturan</option>
                          {row.matchedStudentId && (
                            <option value="UPDATE">Perbarui</option>
                          )}
                          <option value="SKIP">Lewati</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {committing && (
                <div className="flex items-center gap-2.5 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs sm:text-sm font-semibold text-blue-800">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Sedang menyimpan data siswa ke database aplikasi...</span>
                </div>
              )}
            </div>
          )}

          {/* LANGKAH 3: HASIL IMPORT */}
          {step === 'RESULT' && commitResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-emerald-900">
                    Proses Import Data Siswa Selesai
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-emerald-800">
                    Total {commitResult.totalProcessed} baris telah diproses dari file Dapodik.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <span className="text-xs font-semibold text-emerald-700 block">
                    Berhasil Ditambahkan
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-900">
                    {commitResult.importedCount}
                  </span>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                  <span className="text-xs font-semibold text-blue-700 block">
                    Berhasil Diperbarui
                  </span>
                  <span className="text-2xl font-extrabold text-blue-900">
                    {commitResult.updatedCount}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Dilewati
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">
                    {commitResult.skippedCount}
                  </span>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                  <span className="text-xs font-semibold text-rose-700 block">
                    Gagal Disimpan
                  </span>
                  <span className="text-2xl font-extrabold text-rose-900">
                    {commitResult.failedCount}
                  </span>
                </div>
              </div>

              {commitResult.failures.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 bg-rose-50 px-4 py-2.5 border-b border-rose-200 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Daftar Baris yang Gagal Disimpan & Penyebabnya</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-rose-100 text-xs">
                    {commitResult.failures.map((f, idx) => (
                      <div key={`${f.rowNumber}-${idx}`} className="px-4 py-2.5">
                        <span className="font-bold text-slate-900">
                          Baris {f.rowNumber} — {f.nama}:
                        </span>{' '}
                        <span className="text-rose-700">{f.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          {step === 'UPLOAD' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!selectedFile || busy}
                onClick={handleInspectFile}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-50 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memeriksa Data...
                  </>
                ) : (
                  'Periksa Data'
                )}
              </button>
            </>
          )}

          {step === 'PREVIEW' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setErrorMsg(null);
                    setStep('UPLOAD');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs sm:text-sm font-semibold text-rose-700 cursor-pointer"
                >
                  Batal Import
                </button>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleCommitImport}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs cursor-pointer"
              >
                {committing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengimpor...
                  </>
                ) : (
                  'Lanjutkan Import'
                )}
              </button>
            </>
          )}

          {step === 'RESULT' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onImportCompleted}
                className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-5 py-2.5 text-xs sm:text-sm font-bold text-white cursor-pointer"
              >
                Selesai & Lihat Data Siswa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
