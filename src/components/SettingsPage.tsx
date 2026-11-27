import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  Save,
  UserCheck,
  UserCog,
  WifiOff,
  X,
  AlertCircle,
} from 'lucide-react';
import type {
  OfficialPerson,
  SchoolFileSlot,
  SchoolIdentity,
  SchoolSettings,
} from '../types/settings';
import {
  deleteSchoolFile,
  loadSchoolSettings,
  saveSchoolTextSettings,
  uploadSchoolFile,
} from '../lib/settingsStorage';
import { buildAuthHeaders } from '../lib/authApi';
import {
  signInWithGoogleForCloudSync,
  signOutFromCloudSync,
  type FirebaseUser,
} from '../lib/firebase';
import { runFullCloudSync } from '../lib/firestoreSync';
import { FileUploadCard, PendingFileState } from './FileUploadCard';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { PengaturanIcon } from './MenuIcons';
import { TeacherAccountManagement } from './TeacherAccountManagement';

interface SettingsPageProps {
  settings: SchoolSettings;
  onSettingsChange: (updated: SchoolSettings) => void;
  onBack: () => void;
  cloudUser?: FirebaseUser | null;
}

type PendingFilesMap = Record<SchoolFileSlot, PendingFileState | null>;

const EMPTY_PENDING_FILES: PendingFilesMap = {
  logo: null,
  kop: null,
  ttd: null,
  stempel: null,
};

function isEqualIdentity(a: SchoolIdentity, b: SchoolIdentity): boolean {
  return (
    a.schoolName === b.schoolName &&
    a.city === b.city &&
    a.department === b.department &&
    a.academicYear === b.academicYear
  );
}

function isEqualPerson(a: OfficialPerson, b: OfficialPerson): boolean {
  return a.name === b.name && a.position === b.position && a.nip === b.nip;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSettingsChange,
  onBack,
  cloudUser = null,
}) => {
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [identityForm, setIdentityForm] = useState<SchoolIdentity>(settings.identity);
  const [principalForm, setPrincipalForm] = useState<OfficialPerson>(settings.principal);
  const [operatorForm, setOperatorForm] = useState<OfficialPerson>(settings.operator);

  const [pendingFiles, setPendingFiles] = useState<PendingFilesMap>(EMPTY_PENDING_FILES);
  const pendingFilesRef = useRef<PendingFilesMap>(pendingFiles);
  pendingFilesRef.current = pendingFiles;

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [cloudFeedback, setCloudFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    slot: SchoolFileSlot;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Sync local form state when saved settings update externally
  useEffect(() => {
    setIdentityForm(settings.identity);
  }, [settings.identity]);

  useEffect(() => {
    setPrincipalForm(settings.principal);
  }, [settings.principal]);

  useEffect(() => {
    setOperatorForm(settings.operator);
  }, [settings.operator]);

  // Revoke any remaining object URLs on unmount
  useEffect(() => {
    return () => {
      const current = pendingFilesRef.current;
      (Object.keys(current) as SchoolFileSlot[]).forEach((slot) => {
        const item = current[slot];
        if (item?.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const isIdentityDirty = useMemo(
    () => !isEqualIdentity(identityForm, settings.identity),
    [identityForm, settings.identity]
  );

  const isPrincipalDirty = useMemo(
    () => !isEqualPerson(principalForm, settings.principal),
    [principalForm, settings.principal]
  );

  const isOperatorDirty = useMemo(
    () => !isEqualPerson(operatorForm, settings.operator),
    [operatorForm, settings.operator]
  );

  const hasPendingFiles = useMemo(
    () => Object.values(pendingFiles).some((item) => item !== null),
    [pendingFiles]
  );

  const hasAnyUnsavedChanges =
    isIdentityDirty || isPrincipalDirty || isOperatorDirty || hasPendingFiles;

  const handleSelectPendingFile = (slot: SchoolFileSlot, file: File) => {
    setFeedback(null);
    setPendingFiles((prev) => {
      const existing = prev[slot];
      if (existing?.previewUrl) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      return {
        ...prev,
        [slot]: {
          file,
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
  };

  const handleCancelPendingFile = (slot: SchoolFileSlot) => {
    setPendingFiles((prev) => {
      const existing = prev[slot];
      if (existing?.previewUrl) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      return {
        ...prev,
        [slot]: null,
      };
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const updated = await deleteSchoolFile(deleteTarget.slot);
      onSettingsChange(updated);
      handleCancelPendingFile(deleteTarget.slot);
      setFeedback({
        type: 'success',
        message: `${deleteTarget.title} berhasil dihapus dari penyimpanan.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menghapus file.',
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      let latest = settings;

      if (isIdentityDirty || isPrincipalDirty || isOperatorDirty) {
        latest = await saveSchoolTextSettings({
          identity: identityForm,
          principal: principalForm,
          operator: operatorForm,
        });
      }

      const slots: SchoolFileSlot[] = ['logo', 'kop', 'ttd', 'stempel'];
      for (const slot of slots) {
        const pending = pendingFiles[slot];
        if (pending) {
          latest = await uploadSchoolFile(slot, pending.file);
          handleCancelPendingFile(slot);
        }
      }

      onSettingsChange(latest);
      setFeedback({
        type: 'success',
        message: 'Seluruh perubahan pengaturan berhasil disimpan permanen.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal menyimpan perubahan pengaturan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAllChanges = () => {
    setIdentityForm(settings.identity);
    setPrincipalForm(settings.principal);
    setOperatorForm(settings.operator);
    (['logo', 'kop', 'ttd', 'stempel'] as SchoolFileSlot[]).forEach((slot) => {
      handleCancelPendingFile(slot);
    });
    setFeedback(null);
  };

  const handleConnectCloudAndSync = async () => {
    setCloudSyncing(true);
    setFeedback(null);
    setCloudFeedback(null);
    try {
      const user = cloudUser || (await signInWithGoogleForCloudSync());
      if (!user.emailVerified) {
        setCloudFeedback({
          type: 'error',
          message: 'Email akun Google belum terverifikasi.',
        });
        return;
      }
      const summary = await runFullCloudSync(buildAuthHeaders(), true);
      const reloaded = await loadSchoolSettings();
      onSettingsChange(reloaded);

      const pushedTotal =
        summary.pushedToCloud.accounts +
        summary.pushedToCloud.students +
        summary.pushedToCloud.teachers +
        summary.pushedToCloud.letters +
        summary.pushedToCloud.attendance +
        summary.pushedToCloud.assets;
      const restoredTotal =
        summary.restoredFromCloud.accounts +
        summary.restoredFromCloud.students +
        summary.restoredFromCloud.teachers +
        summary.restoredFromCloud.letters +
        summary.restoredFromCloud.attendance;

      setCloudFeedback({
        type: 'success',
        message: `Sinkronisasi Database Online (${user.email || 'Google'}) berhasil. ${
          pushedTotal > 0 ? `${pushedTotal} data dikirim ke server online. ` : ''
        }${restoredTotal > 0 ? `${restoredTotal} data dipulihkan dari server online.` : ''}${
          pushedTotal === 0 && restoredTotal === 0
            ? 'Seluruh data sekolah sudah tersinkronisasi.'
            : ''
        }`.trim(),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('popup-closed-by-user') || raw.includes('cancelled-popup-request')) {
        setCloudFeedback({
          type: 'error',
          message: 'Proses masuk Google dibatalkan.',
        });
      } else if (raw.includes('auth/unauthorized-domain')) {
        const currentHost =
          typeof window !== 'undefined' ? window.location.hostname : 'domain ini';
        setCloudFeedback({
          type: 'error',
          message: `Domain "${currentHost}" belum terdaftar di Firebase Authentication -> Settings -> Authorized domains.`,
        });
      } else if (raw.includes('auth/popup-blocked')) {
        setCloudFeedback({
          type: 'error',
          message:
            'Popup login Google diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba lagi.',
        });
      } else {
        let friendly = 'Gagal menyinkronkan data ke Database Online.';
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed?.error?.toLowerCase().includes('permission')) {
            friendly =
              'Akses ke Database Online ditolak. Pastikan Anda menggunakan akun Google yang berwenang.';
          }
        } catch {
          if (raw) friendly = raw;
        }
        setCloudFeedback({ type: 'error', message: friendly });
      }
    } finally {
      setCloudSyncing(false);
    }
  };

  const handleDisconnectCloud = async () => {
    setCloudSyncing(true);
    setFeedback(null);
    setCloudFeedback(null);
    try {
      await signOutFromCloudSync();
      setCloudFeedback({
        type: 'success',
        message: 'Koneksi akun Google untuk sinkronisasi browser telah diputuskan.',
      });
    } catch {
      setCloudFeedback({
        type: 'error',
        message: 'Gagal memutuskan koneksi akun Google.',
      });
    } finally {
      setCloudSyncing(false);
    }
  };

  const isBusy = isSaving || isDeleting || cloudSyncing;

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Header Hero Pengaturan */}
      <header className="pt-3 sm:pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#8CF4FC] via-[#41D8EA] to-[#1EBED4] border border-[#5BE7F5]/90 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(30,190,212,0.38)] flex items-center justify-between gap-3">
          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali ke Beranda"
              className="min-w-[42px] min-h-[42px] inline-flex items-center justify-center rounded-xl bg-white/90 hover:bg-white text-[#072636] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#072636] truncate">
                Pengaturan
              </h1>
              <p className="text-xs font-semibold text-[#0D3D54] truncate">
                Identitas Sekolah, Pejabat &amp; Dokumen Kop
              </p>
            </div>
          </div>
          <PengaturanIcon className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-xs" />
        </div>
      </header>

      {!isOnline && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs sm:text-sm font-medium text-amber-900 shadow-xs"
        >
          <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 shrink-0 mt-0.5" />
          <span>
            Koneksi internet atau server terputus. Perubahan belum tersinkronisasi
            ke server.
          </span>
        </div>
      )}

      {/* Notifikasi Status Simpan / Hapus */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-xs sm:text-sm font-medium shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pemberitahuan"
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Identitas dan Logo Sekolah */}
      <section
        aria-label="Identitas dan Logo Sekolah"
        className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-4"
      >

        {/* Form Identitas Sekolah */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="school-name"
              className="block text-xs sm:text-[13px] font-semibold text-slate-700"
            >
              Nama Sekolah
            </label>
            <input
              id="school-name"
              type="text"
              value={identityForm.schoolName}
              onChange={(e) =>
                setIdentityForm((prev) => ({ ...prev, schoolName: e.target.value }))
              }
              placeholder="Masukkan nama sekolah"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="school-city"
              className="block text-xs sm:text-[13px] font-semibold text-slate-700"
            >
              Kota / Kabupaten
            </label>
            <input
              id="school-city"
              type="text"
              value={identityForm.city}
              onChange={(e) =>
                setIdentityForm((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder="Masukkan kota atau kabupaten"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="school-department"
              className="block text-xs sm:text-[13px] font-semibold text-slate-700"
            >
              Instansi Pendidikan
            </label>
            <input
              id="school-department"
              type="text"
              value={identityForm.department}
              onChange={(e) =>
                setIdentityForm((prev) => ({ ...prev, department: e.target.value }))
              }
              placeholder="Masukkan nama dinas atau instansi"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3.5">
          <FileUploadCard
            slot="logo"
            title="Logo Sekolah"
            uploadLabel="Upload"
            replaceLabel="Ganti"
            deleteLabel="Hapus"
            cancelLabel="Batal"
            previewVariant="square"
            savedFile={settings.files.logo}
            pendingFile={pendingFiles.logo}
            isBusy={isBusy}
            embedded
            onSelectPending={handleSelectPendingFile}
            onCancelPending={handleCancelPendingFile}
            onRequestDelete={(slot, title) => setDeleteTarget({ slot, title })}
          />
        </div>
      </section>

      {/* 3. Upload KOP Surat */}
      <FileUploadCard
        slot="kop"
        title="KOP Surat"
        uploadLabel="Upload"
        replaceLabel="Ganti"
        deleteLabel="Hapus"
        cancelLabel="Batal"
        previewVariant="banner"
        savedFile={settings.files.kop}
        pendingFile={pendingFiles.kop}
        isBusy={isBusy}
        onSelectPending={handleSelectPendingFile}
        onCancelPending={handleCancelPendingFile}
        onRequestDelete={(slot, title) => setDeleteTarget({ slot, title })}
      />

      {/* 4. Upload Tanda Tangan & 5. Upload Stempel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        <FileUploadCard
          slot="ttd"
          title="Tanda Tangan"
          uploadLabel="Upload"
          replaceLabel="Ganti"
          deleteLabel="Hapus"
          cancelLabel="Batal"
          previewVariant="transparent"
          savedFile={settings.files.ttd}
          pendingFile={pendingFiles.ttd}
          isBusy={isBusy}
          onSelectPending={handleSelectPendingFile}
          onCancelPending={handleCancelPendingFile}
          onRequestDelete={(slot, title) => setDeleteTarget({ slot, title })}
        />

        <FileUploadCard
          slot="stempel"
          title="Stempel"
          uploadLabel="Upload"
          replaceLabel="Ganti"
          deleteLabel="Hapus"
          cancelLabel="Batal"
          previewVariant="transparent"
          savedFile={settings.files.stempel}
          pendingFile={pendingFiles.stempel}
          isBusy={isBusy}
          onSelectPending={handleSelectPendingFile}
          onCancelPending={handleCancelPendingFile}
          onRequestDelete={(slot, title) => setDeleteTarget({ slot, title })}
        />
      </div>

      {/* 6. Data Kepala Sekolah & 7. Data Operator Sekolah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Data Kepala Sekolah */}
        <section
          aria-label="Data Kepala Sekolah"
          className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-3.5"
        >
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <h2 className="text-[15px] sm:text-base font-bold text-slate-900">
              Data Kepala Sekolah
            </h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="principal-name"
                className="block text-xs sm:text-[13px] font-semibold text-slate-700"
              >
                Nama Kepala Sekolah
              </label>
              <input
                id="principal-name"
                type="text"
                value={principalForm.name}
                onChange={(e) =>
                  setPrincipalForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Masukkan nama kepala sekolah"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="principal-position"
                className="block text-xs sm:text-[13px] font-semibold text-slate-700"
              >
                Jabatan
              </label>
              <input
                id="principal-position"
                type="text"
                value={principalForm.position}
                onChange={(e) =>
                  setPrincipalForm((prev) => ({ ...prev, position: e.target.value }))
                }
                placeholder="Masukkan jabatan"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="principal-nip"
                className="block text-xs sm:text-[13px] font-semibold text-slate-700"
              >
                NIP
              </label>
              <input
                id="principal-nip"
                type="text"
                inputMode="numeric"
                value={principalForm.nip}
                onChange={(e) =>
                  setPrincipalForm((prev) => ({ ...prev, nip: e.target.value }))
                }
                placeholder="Masukkan NIP"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>
          </div>
        </section>

        {/* Data Operator Sekolah */}
        <section
          aria-label="Data Operator Sekolah"
          className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-3.5"
        >
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
              <UserCog className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <h2 className="text-[15px] sm:text-base font-bold text-slate-900">
              Data Operator Sekolah
            </h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="operator-name"
                className="block text-xs sm:text-[13px] font-semibold text-slate-700"
              >
                Nama Operator
              </label>
              <input
                id="operator-name"
                type="text"
                value={operatorForm.name}
                onChange={(e) =>
                  setOperatorForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Masukkan nama operator sekolah"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="operator-position"
                className="block text-xs sm:text-[13px] font-semibold text-slate-700"
              >
                Jabatan
              </label>
              <input
                id="operator-position"
                type="text"
                value={operatorForm.position}
                onChange={(e) =>
                  setOperatorForm((prev) => ({ ...prev, position: e.target.value }))
                }
                placeholder="Masukkan jabatan"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="operator-nip"
                className="block text-xs sm:text-[13px] font-semibold text-slate-700"
              >
                NIP
              </label>
              <input
                id="operator-nip"
                type="text"
                inputMode="numeric"
                value={operatorForm.nip}
                onChange={(e) =>
                  setOperatorForm((prev) => ({ ...prev, nip: e.target.value }))
                }
                placeholder="Masukkan NIP"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>
          </div>
        </section>
      </div>

      {/* 8. Tombol Simpan Perubahan */}
      <section
        aria-label="Simpan Seluruh Perubahan"
        className="w-full flex flex-wrap items-center justify-end gap-2.5 pt-1"
      >
        {hasAnyUnsavedChanges && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleCancelAllChanges}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
        )}
        <button
          type="button"
          disabled={isBusy}
          onClick={handleSaveAllChanges}
          className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D63D8] text-sm font-semibold text-white shadow-sm hover:bg-[#1854B8] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
          {isSaving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </section>

      {/* 9. Database Online (Cloud Firestore) */}
      <section
        aria-label="Database Online Cloud Firestore"
        className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                cloudUser
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {cloudUser ? (
                <Cloud className="w-5 h-5" aria-hidden="true" />
              ) : (
                <CloudOff className="w-5 h-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-[15px] sm:text-base font-bold text-slate-900">
                Database Online
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {cloudUser
                  ? `Terhubung: ${cloudUser.email || 'Akun Google'}`
                  : 'Hubungkan Google untuk simpan otomatis online.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isBusy || !isOnline}
              onClick={handleConnectCloudAndSync}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-4 h-4 ${cloudSyncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {cloudSyncing
                ? 'Sinkron...'
                : cloudUser
                  ? 'Sinkronkan'
                  : 'Hubungkan Google'}
            </button>

            {cloudUser && (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleDisconnectCloud}
                className="min-h-[40px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Putuskan
              </button>
            )}
          </div>
        </div>

        {cloudFeedback && (
          <div
            role={cloudFeedback.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium ${
              cloudFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              {cloudFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="break-words">{cloudFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudFeedback(null)}
              aria-label="Tutup pesan sinkronisasi"
              className="p-0.5 rounded hover:bg-black/5 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* 10. Bagian Manajemen Akun Guru */}
      <TeacherAccountManagement embedded />

      {/* Modal Konfirmasi Hapus File */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        fileTitle={deleteTarget?.title}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
