import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan tidak terduga pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary:', error, info);
  }

  private getFriendlyMessage(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('permission')) {
          return 'Akses ke database online ditolak. Pastikan Anda terhubung menggunakan akun Google yang berwenang.';
        }
        return parsed.error;
      }
    } catch {
      // Plain string error
    }
    return raw;
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#F4F7FC] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-white border border-rose-200 p-6 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-base font-extrabold text-slate-900">
                Terjadi Gangguan Aplikasi
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {this.getFriendlyMessage(this.state.message)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-4 py-2.5 text-sm font-bold text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
