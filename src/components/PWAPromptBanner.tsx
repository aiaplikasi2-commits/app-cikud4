import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Share, Smartphone, Sparkles, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const INSTALL_DISMISSED_KEY = 'pwa_install_banner_dismissed';

export const PWAPromptBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [installDismissed, setInstallDismissed] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkUpdate = () => {
        registration.update().catch(() => undefined);
      };
      const intervalId = window.setInterval(checkUpdate, 60 * 60 * 1000);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', checkUpdate);
      return () => {
        window.clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', checkUpdate);
      };
    },
  });

  useEffect(() => {
    if (isInstalled) {
      setShowIOSGuide(false);
    }
  }, [isInstalled]);

  const handleDismissInstall = () => {
    setInstallDismissed(true);
    try {
      window.sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // Ignore storage failures
    }
  };

  const handleInstallClick = async () => {
    if (isIOS && !isInstallable) {
      setShowIOSGuide(true);
      return;
    }
    setInstalling(true);
    try {
      const accepted = await install();
      if (accepted) {
        handleDismissInstall();
      }
    } finally {
      setInstalling(false);
    }
  };

  const showInstallPopup =
    !isInstalled && !installDismissed && (isInstallable || isIOS);

  if (!needRefresh && !showInstallPopup && !showIOSGuide) {
    return null;
  }

  return (
    <div className="print:hidden">
      {/* Popup Notifikasi Pembaruan Aplikasi */}
      {needRefresh && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Pembaruan Aplikasi Tersedia"
          className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[390px] z-50 rounded-2xl border border-blue-200 bg-white/96 backdrop-blur-md p-4 shadow-[0_18px_42px_rgba(15,35,66,0.18)]"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#1D63D8]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[#17325C]">
                  Pembaruan Aplikasi Tersedia
                </h2>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  aria-label="Tutup notifikasi pembaruan"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Versi terbaru aplikasi administrasi sekolah sudah siap. Perbarui
                sekarang agar fitur dan perbaikan terbaru langsung aktif.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void updateServiceWorker(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Perbarui Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Notifikasi Install Aplikasi (muncul jika belum terinstall) */}
      {showInstallPopup && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Install Aplikasi"
          className={`fixed right-4 left-4 sm:left-auto sm:w-[390px] z-40 rounded-2xl border border-slate-200 bg-white/96 backdrop-blur-md p-4 shadow-[0_16px_38px_rgba(15,35,66,0.16)] ${
            needRefresh ? 'bottom-20 sm:bottom-6' : 'bottom-20 sm:bottom-6'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[#17325C]">
                  Install Aplikasi Administrasi
                </h2>
                <button
                  type="button"
                  onClick={handleDismissInstall}
                  aria-label="Tutup notifikasi install"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Pasang aplikasi ke layar utama perangkat Anda agar lebih cepat
                dibuka seperti aplikasi native.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={installing}
                  onClick={handleInstallClick}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {installing ? 'Memasang...' : 'Install Aplikasi'}
                </button>
                <button
                  type="button"
                  onClick={handleDismissInstall}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panduan Install Khusus iOS Safari */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-[#17325C]">
                Install di iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed list-decimal pl-4">
              <li>
                Ketuk tombol{' '}
                <span className="inline-flex items-center gap-1 font-bold text-[#17325C]">
                  <Share className="w-3.5 h-3.5" /> Bagikan (Share)
                </span>{' '}
                pada bilah Safari.
              </li>
              <li>
                Gulir ke bawah lalu pilih{' '}
                <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
              </li>
              <li>
                Ketuk <strong>Tambah</strong> di sudut kanan atas.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] py-2.5 text-xs sm:text-sm font-bold text-white cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
