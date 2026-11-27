import React, { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2, X, CheckCircle2, Clock } from 'lucide-react';
import type { SchoolFileSlot, StoredFileMeta } from '../types/settings';
import { validateImageFile } from '../lib/settingsStorage';
import { resolveAssetUrl } from '../lib/authApi';

export interface PendingFileState {
  file: File;
  previewUrl: string;
}

interface FileUploadCardProps {
  slot: SchoolFileSlot;
  title: string;
  description?: string;
  uploadLabel: string;
  replaceLabel: string;
  deleteLabel: string;
  cancelLabel: string;
  previewVariant: 'square' | 'banner' | 'transparent';
  savedFile: StoredFileMeta | null;
  pendingFile: PendingFileState | null;
  isBusy?: boolean;
  embedded?: boolean;
  onSelectPending: (slot: SchoolFileSlot, file: File) => void;
  onCancelPending: (slot: SchoolFileSlot) => void;
  onRequestDelete: (slot: SchoolFileSlot, title: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FileUploadCard: React.FC<FileUploadCardProps> = ({
  slot,
  title,
  description,
  uploadLabel,
  replaceLabel,
  deleteLabel,
  cancelLabel,
  previewVariant,
  savedFile,
  pendingFile,
  isBusy = false,
  embedded = false,
  onSelectPending,
  onCancelPending,
  onRequestDelete,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePreviewUrl =
    pendingFile?.previewUrl || resolveAssetUrl(savedFile?.url) || null;
  const activeFilename = pendingFile?.file.name || savedFile?.originalName || null;
  const activeFileSize = pendingFile?.file.size || savedFile?.size || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so picking the same file again after Batal still triggers onChange
    e.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setErrorMsg(null);
    onSelectPending(slot, file);
  };

  const triggerPicker = () => {
    setErrorMsg(null);
    inputRef.current?.click();
  };

  const previewContainerClass =
    previewVariant === 'banner'
      ? 'w-full min-h-[120px] sm:min-h-[150px] p-3 bg-slate-50/90'
      : previewVariant === 'transparent'
      ? 'w-full h-36 sm:h-40 p-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50'
      : 'w-28 h-28 sm:w-32 sm:h-32 p-2.5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px] bg-slate-50 shrink-0';

  const previewImageClass =
    previewVariant === 'banner'
      ? 'w-full h-auto max-h-[210px] object-contain mx-auto'
      : 'w-full h-full object-contain';

  const content = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] sm:text-base font-bold text-slate-900">{title}</h3>

        {/* Status Penyimpanan */}
        {pendingFile ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Preview Belum Disimpan
          </span>
        ) : savedFile ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Tersimpan
          </span>
        ) : null}
      </div>

      {/* Hidden Input File */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
        aria-label={uploadLabel}
      />

      {/* Area Preview */}
      <div
        className={
          previewVariant === 'square'
            ? 'flex flex-col sm:flex-row sm:items-center gap-4'
            : 'flex flex-col gap-3'
        }
      >
        <div
          className={`rounded-xl border border-slate-200/90 flex items-center justify-center overflow-hidden ${previewContainerClass}`}
        >
          {activePreviewUrl ? (
            <img
              src={activePreviewUrl}
              alt={`Preview ${title}`}
              className={previewImageClass}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-3 py-4 text-slate-400">
              <ImagePlus className="w-7 h-7 mb-1.5 text-slate-300" aria-hidden="true" />
              <span className="text-xs font-medium text-slate-500">
                Belum ada file dipilih
              </span>
              <span className="mt-0.5 text-[11px] text-slate-400">
                PNG, JPG, JPEG
              </span>
            </div>
          )}
        </div>

        {/* Informasi File & Tombol Aksi */}
        <div className="flex-1 min-w-0 space-y-3">
          {activeFilename && (
            <div className="text-xs text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-800 truncate" title={activeFilename}>
                {activeFilename}
              </p>
              {activeFileSize !== null && (
                <p className="text-slate-500 tabular-nums">{formatBytes(activeFileSize)}</p>
              )}
              {pendingFile && savedFile && (
                <p className="text-amber-700 pt-0.5 leading-snug">
                  File lama masih tersimpan aman hingga Anda menekan Simpan Perubahan.
                </p>
              )}
            </div>
          )}

          {/* Tombol Upload / Ganti / Hapus / Batal */}
          <div className="flex flex-wrap items-center gap-2">
            {!activePreviewUrl ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={triggerPicker}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D63D8] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#1854B8] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <ImagePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                {uploadLabel}
              </button>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={triggerPicker}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-blue-700 hover:bg-blue-100 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                {replaceLabel}
              </button>
            )}

            {pendingFile && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setErrorMsg(null);
                  onCancelPending(slot);
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                {cancelLabel}
              </button>
            )}

            {savedFile && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setErrorMsg(null);
                  onRequestDelete(slot, title);
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-rose-700 hover:bg-rose-100 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                {deleteLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {errorMsg}
        </p>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <section
      aria-label={title}
      className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] p-3.5 sm:p-4"
    >
      {content}
    </section>
  );
};
