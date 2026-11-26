import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import type { AuthUser, PublicSchoolInfo } from '../types/auth';
import { changeOwnPassword } from '../lib/authApi';

interface ForcePasswordChangeScreenProps {
  user: AuthUser;
  school: PublicSchoolInfo;
  onPasswordChanged: (updatedUser: AuthUser) => void;
  onLogout: () => void;
  loggingOut: boolean;
}

export const ForcePasswordChangeScreen: React.FC<
  ForcePasswordChangeScreenProps
> = ({ user, school, onPasswordChanged, onLogout, loggingOut }) => {
  const [logoError, setLogoError] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveLogoSrc = school.logoUrl || '/assets/aistudio/logo_1128ead8.png';
  const schoolTitle = school.schoolName?.trim() || 'Sistem Administrasi Sekolah';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg(
        'Password sementara, password baru, dan konfirmasi password wajib diisi.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Password baru dan konfirmasi password tidak sama.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await changeOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      onPasswordChanged(result.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui password akun Anda.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F4F7FC] flex flex-col justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_12px_36px_rgba(23,50,92,0.08)] overflow-hidden">
          <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-[#EDF4FF] to-white border-b border-slate-100 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200/80 shadow-xs p-2 flex items-center justify-center">
              {!logoError ? (
                <img
                  src={effectiveLogoSrc}
                  alt="Logo Sekolah"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-7 h-7 text-[#17325C]" />
              )}
            </div>
            <h1 className="mt-3 text-base sm:text-lg font-extrabold text-[#17325C]">
              {schoolTitle}
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-blue-700">
              Pembaruan Password Wajib
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Halo, {user.fullName}</p>
                <p className="mt-0.5 leading-relaxed">
                  Password akun Anda baru saja diatur ulang menggunakan password
                  sementara. Demi keamanan, Anda wajib membuat password pribadi
                  yang baru sebelum melanjutkan ke dashboard.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700 font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              <div>
                <label
                  htmlFor="force-current-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Password Sementara / Saat Ini{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="force-current-password"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password sementara dari Operator"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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

              <div>
                <label
                  htmlFor="force-new-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Password Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="force-new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 karakter (huruf & angka)"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((p) => !p)}
                    aria-label={
                      showNew
                        ? 'Sembunyikan password baru'
                        : 'Tampilkan password baru'
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
                  htmlFor="force-confirm-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Konfirmasi Password Baru{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="force-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                {submitting
                  ? 'Menyimpan Password...'
                  : 'Simpan Password & Masuk'}
              </button>
            </form>

            <button
              type="button"
              disabled={loggingOut}
              onClick={onLogout}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 py-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Keluar...' : 'Keluar Akun'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
