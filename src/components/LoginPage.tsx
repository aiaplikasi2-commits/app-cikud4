import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CloudDownload,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { AuthUser, PublicSchoolInfo } from '../types/auth';
import {
  buildAuthHeaders,
  confirmPasswordReset,
  loginUser,
  requestForgotPassword,
  resolveAssetUrl,
  setupInitialOperator,
  validateResetToken,
} from '../lib/authApi';
import { signInWithGoogleForCloudSync } from '../lib/firebase';
import { runFullCloudSync } from '../lib/firestoreSync';

interface LoginPageProps {
  school: PublicSchoolInfo;
  needsInitialSetup: boolean;
  initialNotice?: string | null;
  resetToken?: string | null;
  onClearResetToken?: () => void;
  onAuthenticated: (user: AuthUser) => void;
  onCloudRestored?: () => Promise<void> | void;
}

type AuthScreenMode = 'login' | 'forgot' | 'reset';

export const LoginPage: React.FC<LoginPageProps> = ({
  school,
  needsInitialSetup,
  initialNotice,
  resetToken,
  onClearResetToken,
  onAuthenticated,
  onCloudRestored,
}) => {
  const [logoError, setLogoError] = useState(false);
  const [cloudRestoring, setCloudRestoring] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);

  // Mode: login | forgot | reset
  const [mode, setMode] = useState<AuthScreenMode>(
    resetToken ? 'reset' : 'login'
  );
  const [activeResetToken, setActiveResetToken] = useState<string>(
    resetToken || ''
  );

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Initial Operator setup state
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [previewResetUrl, setPreviewResetUrl] = useState<string | null>(null);

  // Reset password state
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenUserLabel, setTokenUserLabel] = useState<string>('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetDoneMessage, setResetDoneMessage] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveLogoSrc =
    resolveAssetUrl(school.logoUrl) || '/assets/aistudio/logo_1128ead8.png';

  useEffect(() => {
    setLogoError(false);
  }, [effectiveLogoSrc]);

  useEffect(() => {
    if (resetToken) {
      setActiveResetToken(resetToken);
      setMode('reset');
      setErrorMsg(null);
      setResetDoneMessage(null);
    }
  }, [resetToken]);

  useEffect(() => {
    if (mode !== 'reset') return;
    const tokenToCheck = activeResetToken.trim();
    if (!tokenToCheck) {
      setValidatingToken(false);
      setTokenValid(false);
      setErrorMsg('Tautan reset password tidak memiliki token yang valid.');
      return;
    }

    let cancelled = false;
    setValidatingToken(true);
    setErrorMsg(null);
    setTokenValid(false);

    validateResetToken(tokenToCheck)
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          setTokenValid(true);
          setTokenUserLabel(
            res.fullName
              ? `${res.fullName}${res.username ? ` (${res.username})` : ''}`
              : res.username || ''
          );
        } else {
          setTokenValid(false);
          setErrorMsg(
            res.error || 'Tautan reset password tidak valid atau kedaluwarsa.'
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenValid(false);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Tautan reset password tidak valid atau sudah kedaluwarsa.'
        );
      })
      .finally(() => {
        if (!cancelled) setValidatingToken(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, activeResetToken]);

  const schoolTitle = school.schoolName?.trim() || 'Nama Sekolah';
  const schoolSubtitle = [school.city?.trim(), school.department?.trim()]
    .filter(Boolean)
    .join(' · ');

  const goBackToLogin = () => {
    setMode('login');
    setErrorMsg(null);
    setForgotSuccess(null);
    setPreviewResetUrl(null);
    setResetDoneMessage(null);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setActiveResetToken('');
    onClearResetToken?.();
  };

  const handleOpenPreviewResetUrl = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const extracted = parsed.searchParams.get('token') || '';
      if (extracted) {
        window.history.pushState(
          null,
          '',
          `/reset-password?token=${encodeURIComponent(extracted)}`
        );
        setActiveResetToken(extracted);
        setMode('reset');
        setErrorMsg(null);
        setResetDoneMessage(null);
      }
    } catch {
      // Ignore malformed preview URL
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim() || !password) {
      setErrorMsg('Username atau email serta password wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginUser({
        identifier: identifier.trim(),
        password,
      });
      onAuthenticated(result.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Login gagal. Periksa kembali akun Anda.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !fullName.trim() ||
      !username.trim() ||
      !setupPassword ||
      !confirmPassword
    ) {
      setErrorMsg(
        'Nama lengkap, username, password, dan konfirmasi password wajib diisi.'
      );
      return;
    }
    if (setupPassword !== confirmPassword) {
      setErrorMsg('Password dan konfirmasi password tidak sama.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await setupInitialOperator({
        fullName: fullName.trim(),
        nip: nip.trim(),
        username: username.trim(),
        email: email.trim(),
        password: setupPassword,
        confirmPassword,
      });
      onAuthenticated(result.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal membuat akun Operator awal.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    setErrorMsg(null);
    setCloudNotice(null);
    setCloudRestoring(true);
    try {
      const fbUser = await signInWithGoogleForCloudSync();
      if (!fbUser.emailVerified) {
        setErrorMsg('Email akun Google belum terverifikasi.');
        return;
      }
      const summary = await runFullCloudSync(buildAuthHeaders(), false);
      if (summary.restoredFromCloud.hasData) {
        await onCloudRestored?.();
        setCloudNotice(
          `Data sekolah berhasil dipulihkan dari Database Online (${fbUser.email || 'Google'}). Silakan login menggunakan akun Operator atau Guru Anda.`
        );
      } else {
        setCloudNotice(
          `Terhubung ke ${fbUser.email || 'Google'}. Belum ada cadangan data sekolah di database online untuk akun ini. Silakan lengkapi formulir Operator awal di bawah agar data otomatis tersimpan online.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
        setErrorMsg('Proses masuk Google dibatalkan.');
      } else {
        setErrorMsg(
          'Gagal memulihkan data dari Database Online. Pastikan akun Google yang dipilih sama dengan akun yang digunakan saat sinkronisasi.'
        );
      }
    } finally {
      setCloudRestoring(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setForgotSuccess(null);
    setPreviewResetUrl(null);

    const cleanedEmail = forgotEmail.trim();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setErrorMsg('Masukkan alamat email yang valid.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await requestForgotPassword(cleanedEmail);
      setForgotSuccess(res.message);
      if (res.previewResetUrl) {
        setPreviewResetUrl(res.previewResetUrl);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memproses permintaan lupa password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!resetNewPassword || !resetConfirmPassword) {
      setErrorMsg('Password baru dan konfirmasi password wajib diisi.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMsg('Password baru dan konfirmasi password tidak sama.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await confirmPasswordReset({
        token: activeResetToken,
        newPassword: resetNewPassword,
        confirmPassword: resetConfirmPassword,
      });
      setResetDoneMessage(res.message);
      setTokenValid(false);
      setResetNewPassword('');
      setResetConfirmPassword('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memperbarui password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F4F7FC] flex flex-col justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_12px_36px_rgba(23,50,92,0.08)] overflow-hidden">
          {/* Header Identitas Sekolah */}
          <div className="px-6 pt-7 pb-5 bg-gradient-to-b from-[#EDF4FF] to-white border-b border-slate-100 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-white border border-slate-200/80 shadow-xs p-2 flex items-center justify-center">
              {!logoError ? (
                <img
                  src={effectiveLogoSrc}
                  alt="Logo Sekolah"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-9 h-9 text-[#17325C]" />
              )}
            </div>

            <h1 className="mt-3.5 text-lg sm:text-xl font-extrabold text-[#17325C] tracking-tight leading-snug">
              {schoolTitle}
            </h1>
            {schoolSubtitle && (
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {schoolSubtitle}
              </p>
            )}
            <p className="mt-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-700">
              Sistem Administrasi Sekolah
            </p>
          </div>

          <div className="p-6 sm:p-7">
            {initialNotice && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs sm:text-sm text-amber-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{initialNotice}</span>
              </div>
            )}

            {cloudNotice && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-800 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{cloudNotice}</span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700 font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {needsInitialSetup ? (
              <form onSubmit={handleSetupSubmit} className="space-y-3.5" noValidate>
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 px-3.5 py-3 text-xs text-slate-700 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <CloudDownload className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                    <div>
                      <p className="font-bold text-emerald-950">
                        Pulihkan dari Database Online
                      </p>
                      <p className="mt-0.5 text-emerald-900/80">
                        Jika sekolah sudah pernah menyimpan data, hubungkan akun Google untuk memulihkan akun, pengaturan, siswa, dan guru.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreFromCloud}
                    disabled={cloudRestoring || submitting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    {cloudRestoring
                      ? 'Memulihkan Data Sekolah...'
                      : 'Pulihkan Data via Google'}
                  </button>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/80 border border-blue-200 px-3.5 py-3 text-xs text-slate-700">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-700" />
                  <div>
                    <p className="font-bold text-[#17325C]">
                      Pengaturan Administrator Awal (Operator)
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Buat akun Operator pertama untuk mengelola sekolah dan akun
                      guru.
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="setup-fullname"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nama Lengkap Operator <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="setup-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masukkan nama lengkap Operator"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="setup-nip"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      NIP (Opsional)
                    </label>
                    <input
                      id="setup-nip"
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="Masukkan NIP"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="setup-username"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="setup-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Minimal 4 karakter"
                      autoComplete="username"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="setup-email"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Email (Opsional)
                  </label>
                  <input
                    id="setup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@sekolah.sch.id"
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="setup-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="setup-password"
                      type={showSetupPassword ? 'text' : 'password'}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="Min. 8 karakter (huruf & angka)"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword((prev) => !prev)}
                      aria-label={
                        showSetupPassword
                          ? 'Sembunyikan password'
                          : 'Tampilkan password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      {showSetupPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="setup-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Konfirmasi Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="setup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword
                          ? 'Sembunyikan konfirmasi password'
                          : 'Tampilkan konfirmasi password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {submitting
                    ? 'Menyimpan Akun Operator...'
                    : 'Simpan & Masuk sebagai Operator'}
                </button>
              </form>
            ) : mode === 'forgot' ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#17325C]">
                    Lupa Password
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Masukkan alamat email akun Guru atau Operator Anda. Sistem
                    akan menyiapkan tautan reset password satu kali pakai yang
                    berlaku selama 30 menit.
                  </p>
                </div>

                {forgotSuccess && (
                  <div
                    role="status"
                    className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-xs sm:text-sm text-emerald-800 space-y-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{forgotSuccess}</span>
                    </div>

                    {previewResetUrl && (
                      <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          Mode pratinjau tanpa server email aktif — gunakan tautan
                          reset di bawah untuk melanjutkan:
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenPreviewResetUrl(previewResetUrl)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Buka Halaman Reset Password
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Alamat Email Terdaftar
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="nama@sekolah.sch.id"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    {submitting
                      ? 'Mengirim Permintaan...'
                      : 'Kirim Tautan Reset Password'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1D63D8] py-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Kembali ke Halaman Login
                </button>
              </div>
            ) : mode === 'reset' ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#17325C]">
                    Atur Ulang Password
                  </h2>
                  {tokenUserLabel && tokenValid && (
                    <p className="mt-1 text-xs text-slate-600">
                      Akun: <strong>{tokenUserLabel}</strong>
                    </p>
                  )}
                </div>

                {validatingToken ? (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-5 text-center text-xs sm:text-sm text-slate-600">
                    Memvalidasi tautan reset password...
                  </div>
                ) : resetDoneMessage ? (
                  <div className="space-y-4">
                    <div
                      role="status"
                      className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-xs sm:text-sm text-emerald-800 font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{resetDoneMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={goBackToLogin}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-4 py-3 text-sm font-bold text-white shadow-xs cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      Masuk dengan Password Baru
                    </button>
                  </div>
                ) : tokenValid ? (
                  <form
                    onSubmit={handleResetConfirmSubmit}
                    className="space-y-4"
                    noValidate
                  >
                    <div>
                      <label
                        htmlFor="reset-new-password"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Password Baru
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="reset-new-password"
                          type={showResetNew ? 'text' : 'password'}
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="Min. 8 karakter (huruf & angka)"
                          autoComplete="new-password"
                          required
                          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetNew((p) => !p)}
                          aria-label={
                            showResetNew
                              ? 'Sembunyikan password baru'
                              : 'Tampilkan password baru'
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          {showResetNew ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reset-confirm-password"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Konfirmasi Password Baru
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="reset-confirm-password"
                          type={showResetConfirm ? 'text' : 'password'}
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="Ulangi password baru"
                          autoComplete="new-password"
                          required
                          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm((p) => !p)}
                          aria-label={
                            showResetConfirm
                              ? 'Sembunyikan konfirmasi password'
                              : 'Tampilkan konfirmasi password'
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          {showResetConfirm ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      {submitting
                        ? 'Menyimpan Password...'
                        : 'Simpan Password Baru'}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg(null);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white cursor-pointer"
                    >
                      Minta Tautan Reset Baru
                    </button>
                  </div>
                )}

                {!resetDoneMessage && (
                  <button
                    type="button"
                    onClick={goBackToLogin}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1D63D8] py-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Kembali ke Halaman Login
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Username atau Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Masukkan username atau email"
                      autoComplete="username"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg(null);
                        setForgotSuccess(null);
                        setPreviewResetUrl(null);
                      }}
                      className="text-xs font-semibold text-[#1D63D8] hover:text-[#1753B8] hover:underline cursor-pointer"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? 'Sembunyikan password'
                          : 'Tampilkan password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {submitting ? 'Memeriksa Akun...' : 'Login'}
                </button>

                <p className="text-center text-[11px] text-slate-500 pt-1">
                  Akun Guru hanya dibuat dan dikelola oleh Operator sekolah.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
