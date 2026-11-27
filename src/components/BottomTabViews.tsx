import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BookOpen,
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  History,
  KeyRound,
  LogOut,
  QrCode,
  RefreshCw,
  Search,
  User,
  Users,
} from 'lucide-react';
import type { AuthUser, ClassOptionItem, PublicSchoolInfo } from '../types/auth';
import type { SchoolSettings } from '../types/settings';
import type { StudentListItem } from '../types/student';
import type { TeacherListItem } from '../types/teacher';
import type { LetterRecord } from '../types/letter';
import type { AttendanceSheetResponse } from '../types/attendance';
import {
  changeOwnPassword,
  fetchClassOptions,
  updateMyAssignedClass,
} from '../lib/authApi';
import { listStudents } from '../lib/studentApi';
import { listTeachers } from '../lib/teacherApi';
import { getAttendanceSheet } from '../lib/attendanceApi';
import { listLetters } from '../lib/letterApi';

export type BottomTabId = 'riwayat' | 'scan-qr' | 'notifikasi' | 'profil';
export type AppNavigationTarget =
  | 'pengaturan'
  | 'manajemen-akun-guru'
  | 'siswa'
  | 'absen-siswa'
  | 'guru'
  | 'tendik'
  | 'surat'
  | 'agenda-harian'
  | 'profil';

interface BottomTabViewsProps {
  tab: BottomTabId;
  user: AuthUser;
  school: PublicSchoolInfo;
  settings: SchoolSettings;
  onBackHome: () => void;
  onNavigate: (target: AppNavigationTarget) => void;
  onPasswordChanged: (updatedUser: AuthUser) => void;
  onUserUpdated?: (updatedUser: AuthUser) => void;
  onLogout: () => void;
  loggingOut?: boolean;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

function formatDateShort(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const BottomTabViews: React.FC<BottomTabViewsProps> = ({
  tab,
  user,
  school,
  settings,
  onBackHome,
  onNavigate,
  onPasswordChanged,
  onUserUpdated,
  onLogout,
  loggingOut = false,
}) => {
  const isOperator = user.role === 'OPERATOR';

  // Shared live server data for Riwayat, Scan QR, Notifikasi
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [letters, setLetters] = useState<LetterRecord[]>([]);
  const [attendanceInfo, setAttendanceInfo] =
    useState<AttendanceSheetResponse | null>(null);
  const [selectedRombel, setSelectedRombel] = useState('');

  // Scan QR & ID Lookup state
  const [qrQuery, setQrQuery] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Profil Guru Assigned Class state
  const [classOptions, setClassOptions] = useState<ClassOptionItem[]>([]);
  const [classOptionsLoading, setClassOptionsLoading] = useState(false);
  const [selectedAssignedClass, setSelectedAssignedClass] = useState(
    user.assignedClass || ''
  );
  const [classSubmitting, setClassSubmitting] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [classSuccess, setClassSuccess] = useState<string | null>(null);

  // Profil Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAssignedClass(user.assignedClass || '');
  }, [user.assignedClass]);

  const loadClassOptions = useCallback(async () => {
    if (isOperator) return;
    setClassOptionsLoading(true);
    try {
      const options = await fetchClassOptions();
      setClassOptions(options);
    } catch {
      // Keep current options on transient failure
    } finally {
      setClassOptionsLoading(false);
    }
  }, [isOperator]);

  useEffect(() => {
    if (tab === 'profil' && !isOperator) {
      loadClassOptions();
    }
  }, [tab, isOperator, loadClassOptions]);

  const loadTabData = useCallback(
    async (rombelOverride?: string) => {
      setLoadingData(true);
      setDataError(null);
      try {
        const [studentRes, teacherRes, attendanceRes, letterRes] =
          await Promise.all([
            listStudents(),
            listTeachers(),
            getAttendanceSheet({ rombel: rombelOverride || undefined }),
            isOperator ? listLetters() : Promise.resolve(null),
          ]);
        setStudents(studentRes.students);
        setTeachers(teacherRes.teachers);
        setAttendanceInfo(attendanceRes);
        if (!rombelOverride && attendanceRes.selectedRombel) {
          setSelectedRombel(attendanceRes.selectedRombel);
        }
        if (letterRes) {
          setLetters(letterRes.letters);
        } else {
          setLetters([]);
        }
      } catch (err) {
        setDataError(
          err instanceof Error ? err.message : 'Gagal memuat data server.'
        );
      } finally {
        setLoadingData(false);
      }
    },
    [isOperator]
  );

  useEffect(() => {
    if (tab !== 'profil') {
      loadTabData(selectedRombel || undefined);
    }
  }, [tab, loadTabData, selectedRombel]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (tab !== 'scan-qr') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [tab, stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError('Kamera tidak tersedia. Gunakan pencarian manual.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError('Izin kamera ditolak atau kamera tidak ditemukan.');
      stopCamera();
    }
  };

  useEffect(() => {
    if (!cameraActive || tab !== 'scan-qr') return;

    const DetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;

    if (!DetectorCtor) {
      setCameraError(
        'Browser belum mendukung pemindaian QR otomatis. Ketik kode di kolom cari.'
      );
      return;
    }

    const detector = new DetectorCtor({ formats: ['qr_code', 'code_128'] });
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        const raw = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
        if (raw) {
          setQrQuery(raw);
          stopCamera();
        }
      } catch {
        // Ignore single frame detection error
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cameraActive, tab, stopCamera]);

  const scanMatches = useMemo(() => {
    const q = qrQuery.trim().toLowerCase();
    if (!q) {
      return {
        students: [] as StudentListItem[],
        teachers: [] as TeacherListItem[],
        letters: [] as LetterRecord[],
      };
    }
    return {
      students: students
        .filter(
          (s) =>
            s.nama.toLowerCase().includes(q) ||
            s.nisn.toLowerCase().includes(q) ||
            s.nipd.toLowerCase().includes(q) ||
            s.rombelSaatIni.toLowerCase().includes(q)
        )
        .slice(0, 8),
      teachers: teachers
        .filter(
          (t) =>
            t.nama.toLowerCase().includes(q) ||
            t.nip.toLowerCase().includes(q) ||
            t.nuptk.toLowerCase().includes(q) ||
            t.jenisPtk.toLowerCase().includes(q)
        )
        .slice(0, 8),
      letters: isOperator
        ? letters
            .filter(
              (l) =>
                l.letterNumber.toLowerCase().includes(q) ||
                l.recipientName.toLowerCase().includes(q) ||
                l.title.toLowerCase().includes(q)
            )
            .slice(0, 8)
        : [],
    };
  }, [qrQuery, students, teachers, letters, isOperator]);

  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      actionLabel: string;
      target: AppNavigationTarget;
      tone: 'amber' | 'blue';
    }> = [];

    if (!isOperator && !(user.assignedClass || '').trim()) {
      items.push({
        id: 'guru-no-class',
        title: 'Kelas yang Dipegang Belum Dipilih',
        detail: 'Pilih kelas di Profil agar data siswa dan absen kelas tampil.',
        actionLabel: 'Buka Profil',
        target: 'profil',
        tone: 'amber',
      });
    }

    if (isOperator) {
      const missingSettings: string[] = [];
      if (!settings.identity.schoolName.trim()) missingSettings.push('Nama Sekolah');
      if (!settings.identity.city.trim()) missingSettings.push('Kota');
      if (!settings.principal.name.trim()) missingSettings.push('Kepala Sekolah');
      if (!settings.principal.nip.trim()) missingSettings.push('NIP Kepala Sekolah');
      if (missingSettings.length > 0) {
        items.push({
          id: 'settings-incomplete',
          title: 'Pengaturan Belum Lengkap',
          detail: `Lengkapi: ${missingSettings.join(', ')}`,
          actionLabel: 'Pengaturan',
          target: 'pengaturan',
          tone: 'amber',
        });
      }
    }

    const studentsToCheck = students.filter(
      (s) => s.statusData === 'PERLU_PERIKSA'
    ).length;
    if (studentsToCheck > 0) {
      items.push({
        id: 'students-check',
        title: `${studentsToCheck} Data Siswa Perlu Periksa`,
        detail: 'Lengkapi NISN, NIPD, atau rombel.',
        actionLabel: 'Cek Siswa',
        target: 'siswa',
        tone: 'amber',
      });
    }

    const teachersToCheck = teachers.filter(
      (t) => t.statusData === 'PERLU_PERIKSA'
    ).length;
    if (teachersToCheck > 0) {
      items.push({
        id: 'teachers-check',
        title: `${teachersToCheck} Data Guru & Tendik Perlu Periksa`,
        detail: 'Periksa kelengkapan NIP/NIK.',
        actionLabel: 'Cek Guru',
        target: 'guru',
        tone: 'amber',
      });
    }

    const today = getTodayIsoDate();
    if (
      attendanceInfo?.selectedRombel &&
      !attendanceInfo.savedDatesForRombel.some((d) => d.date === today)
    ) {
      items.push({
        id: 'attendance-today',
        title: `Absen ${attendanceInfo.selectedRombel} Hari Ini Belum Disimpan`,
        detail: `Tanggal ${formatDateShort(today)}`,
        actionLabel: 'Absen',
        target: 'absen-siswa',
        tone: 'blue',
      });
    }

    return items;
  }, [isOperator, user.assignedClass, settings, students, teachers, attendanceInfo]);

  const handleSaveAssignedClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassError(null);
    setClassSuccess(null);
    setClassSubmitting(true);
    try {
      const updatedUser = await updateMyAssignedClass(selectedAssignedClass.trim());
      (onUserUpdated ?? onPasswordChanged)(updatedUser);
      setSelectedAssignedClass(updatedUser.assignedClass || '');
      setClassSuccess(
        updatedUser.assignedClass
          ? `Kelas "${updatedUser.assignedClass}" berhasil disimpan.`
          : 'Pilihan kelas berhasil dikosongkan.'
      );
      await loadClassOptions();
    } catch (err) {
      setClassError(
        err instanceof Error ? err.message : 'Gagal menyimpan kelas yang dipegang.'
      );
      await loadClassOptions();
    } finally {
      setClassSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('Semua kolom password wajib diisi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Password baru dan konfirmasi tidak sama.');
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await changeOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      onPasswordChanged(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess('Password berhasil diperbarui.');
    } catch (err) {
      setPwError(
        err instanceof Error ? err.message : 'Gagal memperbarui password.'
      );
    } finally {
      setPwSubmitting(false);
    }
  };

  const tabMeta: Record<
    BottomTabId,
    { title: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    riwayat: { title: 'Riwayat', icon: History },
    'scan-qr': { title: 'Scan QR', icon: QrCode },
    notifikasi: { title: 'Notifikasi', icon: Bell },
    profil: { title: 'Profil', icon: User },
  };
  const ActiveIcon = tabMeta[tab].icon;

  return (
    <div className="pt-4 sm:pt-6 space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4BAFFF] via-[#1E7CEB] to-[#0F53BD] border border-[#78C7FF]/75 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(15,83,189,0.4)] flex items-center justify-between gap-3">
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/92 hover:bg-white text-[#0F357A] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <ActiveIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(7,25,65,0.35)] truncate">
              {tabMeta[tab].title}
            </h1>
          </div>
        </div>

        {tab !== 'profil' && (
          <button
            type="button"
            disabled={loadingData}
            onClick={() => loadTabData(selectedRombel || undefined)}
            className="relative z-10 inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-blue-50 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-[#0F53BD] shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`}
            />
            Muat Ulang
          </button>
        )}
      </div>

      {dataError && tab !== 'profil' && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs sm:text-sm text-rose-700 font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{dataError}</span>
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
              <p className="text-xs text-slate-500">Siswa</p>
              <p className="mt-1 text-2xl font-extrabold text-[#17325C] tabular-nums">
                {students.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
              <p className="text-xs text-slate-500">Guru &amp; Tendik</p>
              <p className="mt-1 text-2xl font-extrabold text-[#17325C] tabular-nums">
                {teachers.length}
              </p>
            </div>
            {isOperator && (
              <div className="rounded-2xl bg-white border border-slate-200/90 p-4 col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-500">Arsip Surat</p>
                <p className="mt-1 text-2xl font-extrabold text-[#17325C] tabular-nums">
                  {letters.length}
                </p>
              </div>
            )}
          </div>

          {isOperator && (
            <section className="rounded-2xl bg-white border border-slate-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#17325C]">Surat Terbaru</h2>
                <button
                  type="button"
                  onClick={() => onNavigate('surat')}
                  className="rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                >
                  Menu Surat
                </button>
              </div>
              {loadingData ? (
                <p className="text-xs text-slate-500 py-3">Memuat...</p>
              ) : letters.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  Belum ada surat tersimpan.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {letters.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.recipientName || '-'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {item.title} · {item.letterNumber || '-'} ·{' '}
                          {formatDateShort(item.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('surat')}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Buka
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl bg-white border border-slate-200/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#17325C]">Riwayat Absen</h2>
              <div className="flex items-center gap-2">
                {(attendanceInfo?.rombels.length || 0) > 0 && (
                  <select
                    value={selectedRombel || attendanceInfo?.selectedRombel || ''}
                    onChange={(e) => setSelectedRombel(e.target.value)}
                    aria-label="Pilih Kelas"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {attendanceInfo?.rombels.map((rb) => (
                      <option key={rb} value={rb}>
                        {rb}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('absen-siswa')}
                  className="rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                >
                  Buka Absen
                </button>
              </div>
            </div>

            {loadingData ? (
              <p className="text-xs text-slate-500 py-3">Memuat...</p>
            ) : !attendanceInfo ||
              attendanceInfo.savedDatesForRombel.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Belum ada riwayat absen tersimpan.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {attendanceInfo.savedDatesForRombel.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                        {formatDateShort(entry.date)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {attendanceInfo.selectedRombel} · Diperbarui oleh{' '}
                        {entry.updatedBy || '-'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('absen-siswa')}
                      className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Buka
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'scan-qr' && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white border border-slate-200/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#17325C]">
                Kamera &amp; Cari Cepat
              </h2>
              <button
                type="button"
                onClick={cameraActive ? stopCamera : startCamera}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
                  cameraActive
                    ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'bg-[#1D63D8] text-white hover:bg-[#1753B8]'
                }`}
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    Stop Kamera
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Aktifkan Kamera
                  </>
                )}
              </button>
            </div>

            {cameraActive && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 aspect-video max-h-64 flex items-center justify-center">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {cameraError && (
              <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {cameraError}
              </p>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={qrQuery}
                onChange={(e) => setQrQuery(e.target.value)}
                placeholder="Scan QR atau ketik NISN, NIPD, NIP, Nama, Nomor Surat..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </section>

          {qrQuery.trim() && (
            <section className="rounded-2xl bg-white border border-slate-200/90 p-4 space-y-3">
              <h2 className="text-sm font-bold text-[#17325C]">Hasil</h2>

              {scanMatches.students.length === 0 &&
              scanMatches.teachers.length === 0 &&
              scanMatches.letters.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  Data tidak ditemukan.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {scanMatches.students.map((s) => (
                    <div
                      key={`st-${s.id}`}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {s.nama}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums truncate">
                          Siswa · {s.rombelSaatIni || '-'} · NISN{' '}
                          {s.nisn || '-'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('siswa')}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Siswa
                      </button>
                    </div>
                  ))}
                  {scanMatches.teachers.map((t) => (
                    <div
                      key={`tc-${t.id}`}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {t.nama}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums truncate">
                          {t.jenisPtk || 'PTK'} · NIP {t.nip || '-'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('guru')}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Guru
                      </button>
                    </div>
                  ))}
                  {scanMatches.letters.map((l) => (
                    <div
                      key={`lt-${l.id}`}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {l.letterNumber || '-'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {l.title} · {l.recipientName || '-'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('surat')}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Surat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {tab === 'notifikasi' && (
        <section className="rounded-2xl bg-white border border-slate-200/90 p-4 space-y-3">
          {loadingData ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Memeriksa data...
            </p>
          ) : notifications.length === 0 ? (
            <div className="flex items-center gap-2.5 py-4 justify-center text-emerald-700 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Semua data sudah lengkap.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {item.tone === 'amber' ? (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="w-4 h-4 text-[#1D63D8] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.target)}
                    className="rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'profil' && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-[#1D63D8] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#17325C] truncate">
                    {user.fullName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isOperator ? 'Operator' : 'Guru'} · {user.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-rose-700 cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                {loggingOut ? 'Keluar...' : 'Logout'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-500 block">NIP</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {user.nip || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Email</span>
                <span className="font-semibold text-slate-900 break-all">
                  {user.email || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sekolah</span>
                <span className="font-semibold text-slate-900">
                  {school.schoolName || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Kota</span>
                <span className="font-semibold text-slate-900">
                  {school.city || '-'}
                </span>
              </div>
              {!isOperator && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Kelas yang Dipegang</span>
                  <span className="inline-flex mt-0.5 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-[#17325C]">
                    {user.assignedClass || 'Belum dipilih'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {!isOperator && (
            <section className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1D63D8]" />
                  <h2 className="text-sm font-bold text-[#17325C]">
                    Kelas yang Dipegang
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  1 guru hanya 1 kelas
                </span>
              </div>

              {classSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{classSuccess}</span>
                </div>
              )}

              {classError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{classError}</span>
                </div>
              )}

              <form onSubmit={handleSaveAssignedClass} className="space-y-3">
                <div>
                  <label
                    htmlFor="profil-assigned-class"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Pilih Kelas / Rombel
                  </label>
                  {classOptions.length > 0 ? (
                    <select
                      id="profil-assigned-class"
                      value={selectedAssignedClass}
                      disabled={classOptionsLoading || classSubmitting}
                      onChange={(e) => {
                        setSelectedAssignedClass(e.target.value);
                        setClassError(null);
                        setClassSuccess(null);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value="">-- Belum Memegang Kelas --</option>
                      {selectedAssignedClass &&
                        !classOptions.some(
                          (o) =>
                            o.name.trim().toLowerCase() ===
                            selectedAssignedClass.trim().toLowerCase()
                        ) && (
                          <option value={selectedAssignedClass}>
                            {selectedAssignedClass}
                          </option>
                        )}
                      {classOptions.map((opt) => {
                        const takenByOther =
                          Boolean(opt.occupiedByName) && !opt.isMine;
                        return (
                          <option
                            key={opt.name}
                            value={opt.name}
                            disabled={takenByOther}
                          >
                            {opt.name}
                            {takenByOther
                              ? ` (Sudah dipegang: ${opt.occupiedByName})`
                              : opt.isMine
                                ? ' (Kelas Anda)'
                                : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      id="profil-assigned-class"
                      type="text"
                      value={selectedAssignedClass}
                      disabled={classSubmitting}
                      onChange={(e) => {
                        setSelectedAssignedClass(e.target.value);
                        setClassError(null);
                        setClassSuccess(null);
                      }}
                      placeholder="Contoh: 1A atau IV B (kosongkan jika tidak memegang kelas)"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Anda hanya dapat mengakses data siswa dan absen sesuai kelas ini.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={classSubmitting || classOptionsLoading}
                    className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                  >
                    {classSubmitting ? 'Menyimpan...' : 'Simpan Kelas'}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1D63D8]" />
              <h2 className="text-sm font-bold text-[#17325C]">
                Ganti Password
              </h2>
            </div>

            {pwSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3" noValidate>
              <div>
                <label
                  htmlFor="profil-current-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Password Saat Ini
                </label>
                <div className="relative">
                  <input
                    id="profil-current-password"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((p) => !p)}
                    aria-label={
                      showCurrent ? 'Sembunyikan password' : 'Tampilkan password'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showCurrent ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="profil-new-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      id="profil-new-password"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((p) => !p)}
                      aria-label={
                        showNew ? 'Sembunyikan password baru' : 'Tampilkan password baru'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showNew ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profil-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <input
                      id="profil-confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      aria-label={
                        showConfirm
                          ? 'Sembunyikan konfirmasi password'
                          : 'Tampilkan konfirmasi password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwSubmitting}
                  className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  {pwSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
