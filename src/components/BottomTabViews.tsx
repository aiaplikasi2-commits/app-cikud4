import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  PencilLine,
  Save,
  User,
  Users,
} from 'lucide-react';
import type { AuthUser, ClassOptionItem, PublicSchoolInfo } from '../types/auth';
import type { SchoolSettings } from '../types/settings';
import type { TeacherInputPayload, TeacherRecord } from '../types/teacher';
import {
  changeOwnPassword,
  fetchClassOptions,
  fetchMyProfile,
  updateMyAssignedClass,
  updateMyProfile,
} from '../lib/authApi';

export type BottomTabId = 'profil';
export type AppNavigationTarget =
  | 'pengaturan'
  | 'manajemen-akun-guru'
  | 'siswa'
  | 'absen-siswa'
  | 'guru'
  | 'tendik'
  | 'surat'
  | 'agenda-harian'
  | 'notifikasi-admin'
  | 'profil';

interface BottomTabViewsProps {
  tab: BottomTabId;
  user: AuthUser;
  school: PublicSchoolInfo;
  settings?: SchoolSettings;
  onBackHome: () => void;
  onNavigate?: (target: AppNavigationTarget) => void;
  onPasswordChanged: (updatedUser: AuthUser) => void;
  onUserUpdated?: (updatedUser: AuthUser) => void;
  onLogout: () => void;
  loggingOut?: boolean;
}

interface TeacherSelfBioForm {
  nuptk: string;
  jk: string;
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  alamatJalan: string;
  rt: string;
  rw: string;
  namaDusun: string;
  desaKelurahan: string;
  kecamatan: string;
  kodePos: string;
  telepon: string;
  hp: string;
  namaIbuKandung: string;
  statusPerkawinan: string;
  namaSuamiIstri: string;
  pekerjaanSuamiIstri: string;
  kewarganegaraan: string;
  bank: string;
  rekeningAtasNama: string;
  namaWajibPajak: string;
}

function createEmptyBioForm(record?: TeacherRecord | null): TeacherSelfBioForm {
  return {
    nuptk: record?.nuptk || '',
    jk: record?.jk || '',
    tempatLahir: record?.tempatLahir || '',
    tanggalLahir: record?.tanggalLahir || '',
    agama: record?.agama || '',
    alamatJalan: record?.alamatJalan || '',
    rt: record?.rt || '',
    rw: record?.rw || '',
    namaDusun: record?.namaDusun || '',
    desaKelurahan: record?.desaKelurahan || '',
    kecamatan: record?.kecamatan || '',
    kodePos: record?.kodePos || '',
    telepon: record?.telepon || '',
    hp: record?.hp || '',
    namaIbuKandung: record?.namaIbuKandung || '',
    statusPerkawinan: record?.statusPerkawinan || '',
    namaSuamiIstri: record?.namaSuamiIstri || '',
    pekerjaanSuamiIstri: record?.pekerjaanSuamiIstri || '',
    kewarganegaraan: record?.kewarganegaraan || '',
    bank: record?.bank || '',
    rekeningAtasNama: record?.rekeningAtasNama || '',
    namaWajibPajak: record?.namaWajibPajak || '',
  };
}

function isMaskedValue(val?: string): boolean {
  return Boolean(val && val.includes('•'));
}

export const BottomTabViews: React.FC<BottomTabViewsProps> = ({
  user,
  school,
  onBackHome,
  onPasswordChanged,
  onUserUpdated,
  onLogout,
  loggingOut = false,
}) => {
  const isOperator = user.role === 'OPERATOR';

  // Profil Account + Linked Teacher Biodata state
  const [profileLoading, setProfileLoading] = useState(true);
  const [linkedTeacher, setLinkedTeacher] = useState<TeacherRecord | null>(null);
  const [fullName, setFullName] = useState(user.fullName || '');
  const [nip, setNip] = useState(user.nip || '');
  const [email, setEmail] = useState(user.email || '');
  const [bioForm, setBioForm] = useState<TeacherSelfBioForm>(() =>
    createEmptyBioForm(null)
  );
  const [showBiodataFields, setShowBiodataFields] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

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
    setFullName(user.fullName || '');
    setNip(user.nip || '');
    setEmail(user.email || '');
  }, [user.assignedClass, user.fullName, user.nip, user.email]);

  const loadDetailedProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetchMyProfile();
      setFullName(res.user.fullName || '');
      setNip(res.user.nip || '');
      setEmail(res.user.email || '');
      setLinkedTeacher(res.teacherProfile);
      setBioForm(createEmptyBioForm(res.teacherProfile));
    } catch {
      // Fall back silently to prop user values if transient error
    } finally {
      setProfileLoading(false);
    }
  }, []);

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
    loadDetailedProfile();
    if (!isOperator) {
      loadClassOptions();
    }
  }, [isOperator, loadDetailedProfile, loadClassOptions]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!fullName.trim()) {
      setProfileError('Nama lengkap wajib diisi.');
      return;
    }

    setProfileSubmitting(true);
    try {
      const teacherPayload: Partial<TeacherInputPayload> | undefined =
        linkedTeacher
          ? {
              nuptk: bioForm.nuptk,
              jk: bioForm.jk,
              tempatLahir: bioForm.tempatLahir,
              tanggalLahir: bioForm.tanggalLahir,
              agama: bioForm.agama,
              alamatJalan: bioForm.alamatJalan,
              rt: bioForm.rt,
              rw: bioForm.rw,
              namaDusun: bioForm.namaDusun,
              desaKelurahan: bioForm.desaKelurahan,
              kecamatan: bioForm.kecamatan,
              kodePos: bioForm.kodePos,
              telepon: bioForm.telepon,
              hp: bioForm.hp,
              namaIbuKandung: bioForm.namaIbuKandung,
              statusPerkawinan: bioForm.statusPerkawinan,
              namaSuamiIstri: bioForm.namaSuamiIstri,
              pekerjaanSuamiIstri: bioForm.pekerjaanSuamiIstri,
              kewarganegaraan: bioForm.kewarganegaraan,
              bank: bioForm.bank,
              rekeningAtasNama: bioForm.rekeningAtasNama,
              namaWajibPajak: bioForm.namaWajibPajak,
            }
          : undefined;

      const res = await updateMyProfile({
        fullName: fullName.trim(),
        nip: nip.trim(),
        email: email.trim(),
        teacherProfile: teacherPayload,
      });

      (onUserUpdated ?? onPasswordChanged)(res.user);
      if (res.teacherProfile) {
        setLinkedTeacher(res.teacherProfile);
        setBioForm(createEmptyBioForm(res.teacherProfile));
      }
      setProfileSuccess(
        res.changedFields && res.changedFields.length > 0
          ? 'Profil berhasil disimpan ke database online.'
          : 'Data profil sudah sesuai dan tersimpan.'
      );
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Gagal memperbarui data profil.'
      );
    } finally {
      setProfileSubmitting(false);
    }
  };

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

  const setBioField = <K extends keyof TeacherSelfBioForm>(
    key: K,
    val: string
  ) => {
    setBioForm((prev) => ({ ...prev, [key]: val }));
    setProfileError(null);
    setProfileSuccess(null);
  };

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
              <User className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(7,25,65,0.35)] truncate">
              Profil Akun
            </h1>
          </div>
        </div>
      </div>

      {/* Ringkasan Identitas */}
      <section className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-[#1D63D8] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#17325C] truncate">
                {user.fullName}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {isOperator ? 'Operator / Admin' : 'Guru'} · {user.username}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-rose-700 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Keluar...' : 'Logout'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2.5 border-t border-slate-100 text-xs">
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
            <span className="text-slate-500 block">
              {!isOperator ? 'Kelas yang Dipegang' : 'Kota'}
            </span>
            {!isOperator ? (
              <span className="font-bold text-[#17325C]">
                {user.assignedClass || 'Belum dipilih'}
              </span>
            ) : (
              <span className="font-semibold text-slate-900">
                {school.city || '-'}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Edit Data Profil Saya */}
      <section className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PencilLine className="w-4 h-4 text-[#1D63D8]" />
            <h2 className="text-sm font-bold text-[#17325C]">
              Edit Data Profil Saya
            </h2>
          </div>
          {!isOperator && (
            <span className="text-[11px] text-slate-500">
              Perubahan otomatis dikirim ke notifikasi Admin
            </span>
          )}
        </div>

        {profileSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="profil-edit-fullname"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input
                id="profil-edit-fullname"
                type="text"
                value={fullName}
                disabled={profileLoading || profileSubmitting}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="profil-edit-nip"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                NIP
              </label>
              <input
                id="profil-edit-nip"
                type="text"
                value={nip}
                disabled={profileLoading || profileSubmitting}
                onChange={(e) => {
                  setNip(e.target.value);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                placeholder="18 digit angka (opsional)"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="profil-edit-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="profil-edit-email"
                type="email"
                value={email}
                disabled={profileLoading || profileSubmitting}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                placeholder="nama@sekolah.sch.id"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          {linkedTeacher && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#17325C]">
                    Biodata Pribadi &amp; Kontak Guru
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Terhubung dengan data {linkedTeacher.jenisPtk || 'Guru'} ·{' '}
                    {linkedTeacher.statusKepegawaian || 'PTK'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBiodataFields((p) => !p)}
                  className="rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-[#1D63D8] cursor-pointer whitespace-nowrap"
                >
                  {showBiodataFields
                    ? 'Sembunyikan Biodata Lengkap'
                    : 'Edit Biodata Lengkap'}
                </button>
              </div>

              {showBiodataFields && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        NUPTK
                      </label>
                      <input
                        type="text"
                        value={bioForm.nuptk}
                        onChange={(e) => setBioField('nuptk', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jenis Kelamin
                      </label>
                      <select
                        value={bioForm.jk}
                        onChange={(e) => setBioField('jk', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      >
                        <option value="">Pilih JK</option>
                        <option value="L">L (Laki-laki)</option>
                        <option value="P">P (Perempuan)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Agama
                      </label>
                      <input
                        type="text"
                        value={bioForm.agama}
                        onChange={(e) => setBioField('agama', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tempat Lahir
                      </label>
                      <input
                        type="text"
                        value={bioForm.tempatLahir}
                        onChange={(e) => setBioField('tempatLahir', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Lahir
                      </label>
                      <input
                        type="date"
                        value={
                          /^\d{4}-\d{2}-\d{2}$/.test(bioForm.tanggalLahir)
                            ? bioForm.tanggalLahir
                            : ''
                        }
                        onChange={(e) => setBioField('tanggalLahir', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        No. HP
                      </label>
                      <input
                        type="text"
                        value={bioForm.hp}
                        onChange={(e) => setBioField('hp', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Telepon
                      </label>
                      <input
                        type="text"
                        value={bioForm.telepon}
                        onChange={(e) => setBioField('telepon', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alamat Jalan
                      </label>
                      <input
                        type="text"
                        value={bioForm.alamatJalan}
                        onChange={(e) => setBioField('alamatJalan', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        RT
                      </label>
                      <input
                        type="text"
                        value={bioForm.rt}
                        onChange={(e) => setBioField('rt', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        RW
                      </label>
                      <input
                        type="text"
                        value={bioForm.rw}
                        onChange={(e) => setBioField('rw', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Dusun
                      </label>
                      <input
                        type="text"
                        value={bioForm.namaDusun}
                        onChange={(e) => setBioField('namaDusun', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Desa / Kelurahan
                      </label>
                      <input
                        type="text"
                        value={bioForm.desaKelurahan}
                        onChange={(e) => setBioField('desaKelurahan', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kecamatan
                      </label>
                      <input
                        type="text"
                        value={bioForm.kecamatan}
                        onChange={(e) => setBioField('kecamatan', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kode Pos
                      </label>
                      <input
                        type="text"
                        value={bioForm.kodePos}
                        onChange={(e) => setBioField('kodePos', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Ibu Kandung
                      </label>
                      <input
                        type="text"
                        value={bioForm.namaIbuKandung}
                        onChange={(e) =>
                          setBioField('namaIbuKandung', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Perkawinan
                      </label>
                      <input
                        type="text"
                        value={bioForm.statusPerkawinan}
                        onChange={(e) =>
                          setBioField('statusPerkawinan', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Suami / Istri
                      </label>
                      <input
                        type="text"
                        value={bioForm.namaSuamiIstri}
                        onChange={(e) =>
                          setBioField('namaSuamiIstri', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pekerjaan Suami / Istri
                      </label>
                      <input
                        type="text"
                        value={bioForm.pekerjaanSuamiIstri}
                        onChange={(e) =>
                          setBioField('pekerjaanSuamiIstri', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kewarganegaraan
                      </label>
                      <input
                        type="text"
                        value={bioForm.kewarganegaraan}
                        onChange={(e) =>
                          setBioField('kewarganegaraan', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Bank
                      </label>
                      <input
                        type="text"
                        value={bioForm.bank}
                        onChange={(e) => setBioField('bank', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Rekening Atas Nama
                      </label>
                      <input
                        type="text"
                        value={bioForm.rekeningAtasNama}
                        onChange={(e) =>
                          setBioField('rekeningAtasNama', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Wajib Pajak
                      </label>
                      <input
                        type="text"
                        value={bioForm.namaWajibPajak}
                        onChange={(e) =>
                          setBioField('namaWajibPajak', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                  </div>

                  {(isMaskedValue(linkedTeacher.nik) ||
                    isMaskedValue(linkedTeacher.noKk) ||
                    isMaskedValue(linkedTeacher.npwp) ||
                    isMaskedValue(linkedTeacher.nomorRekeningBank)) && (
                    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-600">
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>
                        Data sensitif (NIK, No. KK, NPWP, Nomor Rekening, Karpeg)
                        dilindungi dan hanya dapat diubah oleh Operator.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileLoading || profileSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              <Save className="w-4 h-4" />
              {profileSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
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
                Anda dapat melihat, mengedit, dan mengisi absen siswa sesuai kelas ini.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={classSubmitting || classOptionsLoading}
                className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap min-h-[40px]"
              >
                {classSubmitting ? 'Menyimpan...' : 'Simpan Kelas'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Ganti Password */}
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
              className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {pwSubmitting ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
