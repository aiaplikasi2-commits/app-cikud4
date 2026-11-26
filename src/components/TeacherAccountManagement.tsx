import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  UserX,
  WifiOff,
  X,
} from 'lucide-react';
import type { AccountStatus, ClassOptionItem, TeacherAccount } from '../types/auth';
import type { TeacherForAccountOption } from '../types/teacher';
import {
  createTeacherAccount,
  deleteTeacherAccount,
  fetchClassOptions,
  generateAllTeacherAccounts,
  generateTeacherResetLink,
  listTeacherAccounts,
  resetTeacherPassword,
  updateTeacherAccount,
  updateTeacherStatus,
} from '../lib/authApi';
import { listTeachersForAccountCreation } from '../lib/teacherApi';
import { ManajemenAkunIcon } from './MenuIcons';

interface TeacherAccountManagementProps {
  onBack?: () => void;
  embedded?: boolean;
}

type StatusFilter = 'ALL' | AccountStatus;

function formatCreatedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '-';
  }
}

function generateSecureTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (chars: string): string => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return chars[arr[0] % chars.length];
  };
  const chars = [pick(upper), pick(lower), pick(digits), pick(digits)];
  while (chars.length < 10) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const DEFAULT_TEACHER_PASSWORD = '021985Mur';

export const TeacherAccountManagement: React.FC<TeacherAccountManagementProps> = ({
  onBack,
  embedded = false,
}) => {
  const [accounts, setAccounts] = useState<TeacherAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showList, setShowList] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<TeacherForAccountOption[]>([]);
  const [teacherOptionsLoading, setTeacherOptionsLoading] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createNip, setCreateNip] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createStatus, setCreateStatus] = useState<AccountStatus>('ACTIVE');
  const [createAssignedClass, setCreateAssignedClass] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Class Options
  const [classOptions, setClassOptions] = useState<ClassOptionItem[]>([]);

  // Edit Modal State
  const [editTarget, setEditTarget] = useState<TeacherAccount | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<AccountStatus>('ACTIVE');
  const [editAssignedClass, setEditAssignedClass] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Reset Password Modal State
  const [resetTarget, setResetTarget] = useState<TeacherAccount | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetConfirmVal, setResetConfirmVal] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [copiedTempPass, setCopiedTempPass] = useState(false);

  // One-time Reset Link State inside Reset Password Modal
  const [resetLinkLoading, setResetLinkLoading] = useState(false);
  const [generatedResetLink, setGeneratedResetLink] = useState<{
    url: string;
    emailSent: boolean;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Deactivate & Delete Confirmation Modal States
  const [deactivateTarget, setDeactivateTarget] = useState<TeacherAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherAccount | null>(null);
  const [statusSubmittingId, setStatusSubmittingId] = useState<string | null>(null);
  const [deleteSubmittingId, setDeleteSubmittingId] = useState<string | null>(null);

  // Bulk Generate Modal State
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatePassword, setGeneratePassword] = useState(DEFAULT_TEACHER_PASSWORD);
  const [showGeneratePassword, setShowGeneratePassword] = useState(true);
  const [generateSubmitting, setGenerateSubmitting] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

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

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const list = await listTeacherAccounts();
      setAccounts(list);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Gagal memuat daftar akun guru.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClassOptions = useCallback(async () => {
    try {
      const list = await fetchClassOptions();
      setClassOptions(list);
    } catch {
      // Ignore class options error
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    loadClassOptions();
  }, [fetchAccounts, loadClassOptions]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (statusFilter !== 'ALL' && acc.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        acc.fullName.toLowerCase().includes(q) ||
        acc.username.toLowerCase().includes(q) ||
        acc.nip.toLowerCase().includes(q) ||
        (acc.email && acc.email.toLowerCase().includes(q))
      );
    });
  }, [accounts, searchQuery, statusFilter]);

  const activeCount = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE').length,
    [accounts]
  );
  const inactiveCount = accounts.length - activeCount;

  const selectedTeacherObj = useMemo(
    () => teacherOptions.find((t) => t.id === selectedTeacherId) || null,
    [teacherOptions, selectedTeacherId]
  );

  const normalizeClassKey = (val: string) =>
    (val || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const openCreateModal = () => {
    setSelectedTeacherId('');
    setCreateFullName('');
    setCreateNip('');
    setCreateUsername('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateConfirmPassword('');
    setCreateStatus('ACTIVE');
    setCreateAssignedClass('');
    setShowCreatePassword(false);
    setShowCreateConfirm(false);
    setCreateError(null);
    setCreateOpen(true);

    loadClassOptions();
    setTeacherOptionsLoading(true);
    listTeachersForAccountCreation()
      .then((list) => setTeacherOptions(list))
      .catch(() => setTeacherOptions([]))
      .finally(() => setTeacherOptionsLoading(false));
  };

  const handleSelectTeacherOption = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setCreateError(null);
    if (!teacherId) return;

    const picked = teacherOptions.find((t) => t.id === teacherId);
    if (!picked) return;

    const cleanNik = (picked.nik || '').replace(/\s+/g, '').trim();
    const cleanNip = (picked.nip || '').replace(/\s+/g, '').trim();
    const defaultUsername = cleanNik || cleanNip;

    setCreateFullName(picked.nama);
    setCreateNip(picked.nip || '');
    setCreateEmail(picked.email || '');
    setCreateUsername(defaultUsername);
    setCreateAssignedClass(picked.assignedClass || '');

    setCreatePassword(DEFAULT_TEACHER_PASSWORD);
    setCreateConfirmPassword(DEFAULT_TEACHER_PASSWORD);
    setShowCreatePassword(true);
    setShowCreateConfirm(true);
  };

  const openGenerateModal = () => {
    setGeneratePassword(DEFAULT_TEACHER_PASSWORD);
    setShowGeneratePassword(true);
    setGenerateError(null);
    setGenerateOpen(true);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError(null);
    setSuccessMsg(null);
    setGenerateSubmitting(true);
    try {
      const res = await generateAllTeacherAccounts(generatePassword);
      await fetchAccounts();
      setShowList(true);
      setGenerateOpen(false);
      setSuccessMsg(
        `Berhasil membuat ${res.createdCount} akun baru (${res.skippedExistingCount} dilewati karena sudah ada${
          res.skippedNoId.length > 0 ? `, ${res.skippedNoId.length} tanpa NIK/NIP` : ''
        }).`
      );
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : 'Gagal generate akun guru & tendik.'
      );
    } finally {
      setGenerateSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSuccessMsg(null);

    if (createEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createEmail.trim())) {
      setCreateError('Format email guru tidak valid.');
      return;
    }

    if (createPassword !== createConfirmPassword) {
      setCreateError('Password dan konfirmasi password tidak sama.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const created = await createTeacherAccount({
        fullName: createFullName.trim(),
        nip: createNip.trim(),
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
        confirmPassword: createConfirmPassword,
        status: createStatus,
        teacherRecordId: selectedTeacherId || null,
        assignedClass: createAssignedClass.trim(),
      });
      setAccounts((prev) => [created, ...prev]);
      loadClassOptions();
      setCreateOpen(false);
      setShowList(true);
      setSuccessMsg(
        `Akun guru "${created.fullName}" berhasil dibuat dan tersimpan di server.`
      );
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Gagal menambahkan akun guru.'
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEditModal = (account: TeacherAccount) => {
    setEditTarget(account);
    setEditFullName(account.fullName);
    setEditNip(account.nip);
    setEditUsername(account.username);
    setEditEmail(account.email);
    setEditStatus(account.status);
    setEditAssignedClass(account.assignedClass || '');
    setEditError(null);
    loadClassOptions();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    setSuccessMsg(null);
    setEditSubmitting(true);

    try {
      const updated = await updateTeacherAccount(editTarget.id, {
        fullName: editFullName.trim(),
        nip: editNip.trim(),
        username: editUsername.trim(),
        email: editEmail.trim(),
        status: editStatus,
        assignedClass: editAssignedClass.trim(),
      });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      loadClassOptions();
      setEditTarget(null);
      setSuccessMsg(
        `Data akun guru "${updated.fullName}" berhasil diperbarui di server.`
      );
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Gagal memperbarui data akun guru.'
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const openResetModal = (account: TeacherAccount) => {
    setResetTarget(account);
    setResetPasswordVal('');
    setResetConfirmVal('');
    setMustChangePassword(true);
    setShowResetPassword(false);
    setShowResetConfirm(false);
    setResetError(null);
    setCopiedTempPass(false);
    setGeneratedResetLink(null);
    setCopiedLink(false);
  };

  const handleGenerateTempPassword = () => {
    const temp = generateSecureTemporaryPassword();
    setResetPasswordVal(temp);
    setResetConfirmVal(temp);
    setShowResetPassword(true);
    setShowResetConfirm(true);
    setMustChangePassword(true);
    setCopiedTempPass(false);
    setResetError(null);
  };

  const handleCopyTempPassword = async () => {
    if (!resetPasswordVal) return;
    try {
      await navigator.clipboard.writeText(resetPasswordVal);
      setCopiedTempPass(true);
      setTimeout(() => setCopiedTempPass(false), 2000);
    } catch {
      // Clipboard may be restricted
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    setSuccessMsg(null);

    if (resetPasswordVal !== resetConfirmVal) {
      setResetError('Password baru dan konfirmasi password tidak sama.');
      return;
    }

    setResetSubmitting(true);
    try {
      const updated = await resetTeacherPassword(resetTarget.id, {
        password: resetPasswordVal,
        confirmPassword: resetConfirmVal,
        mustChangePassword,
      });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setResetTarget(null);
      setSuccessMsg(
        mustChangePassword
          ? `Password sementara akun guru "${updated.fullName}" disimpan. Guru wajib mengganti password saat login berikutnya.`
          : `Password akun guru "${updated.fullName}" berhasil diatur ulang di server.`
      );
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'Gagal mengatur ulang password guru.'
      );
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleCreateResetLink = async () => {
    if (!resetTarget) return;
    setResetError(null);
    setResetLinkLoading(true);
    setCopiedLink(false);
    try {
      const result = await generateTeacherResetLink(resetTarget.id);
      setGeneratedResetLink({
        url: result.resetUrl,
        emailSent: result.emailSent,
      });
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : 'Gagal membuat tautan reset password.'
      );
    } finally {
      setResetLinkLoading(false);
    }
  };

  const handleCopyResetLink = async () => {
    if (!generatedResetLink?.url) return;
    try {
      await navigator.clipboard.writeText(generatedResetLink.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard may be restricted
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setStatusSubmittingId(deactivateTarget.id);
    setPageError(null);
    setSuccessMsg(null);
    try {
      const updated = await updateTeacherStatus(deactivateTarget.id, 'INACTIVE');
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSuccessMsg(`Akun guru "${updated.fullName}" telah dinonaktifkan.`);
      setDeactivateTarget(null);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Gagal menonaktifkan akun guru.'
      );
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const handleReactivate = async (account: TeacherAccount) => {
    setStatusSubmittingId(account.id);
    setPageError(null);
    setSuccessMsg(null);
    try {
      const updated = await updateTeacherStatus(account.id, 'ACTIVE');
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSuccessMsg(`Akun guru "${updated.fullName}" telah diaktifkan kembali.`);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Gagal mengaktifkan kembali akun guru.'
      );
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmittingId(deleteTarget.id);
    setPageError(null);
    setSuccessMsg(null);
    try {
      await deleteTeacherAccount(deleteTarget.id);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setSuccessMsg(
        `Akun guru "${deleteTarget.fullName}" berhasil dihapus permanen dari server.`
      );
      setDeleteTarget(null);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Gagal menghapus akun guru.'
      );
    } finally {
      setDeleteSubmittingId(null);
    }
  };

  const bodyContent = (
    <div className="space-y-3.5">
      {/* Peringatan Koneksi Offline */}
      {!isOnline && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs sm:text-sm text-amber-900 font-medium"
        >
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            Koneksi internet atau server terputus. Perubahan akun guru tidak dapat
            disimpan sebelum koneksi kembali aktif.
          </span>
        </div>
      )}

      {/* Notifikasi Sukses / Error */}
      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs sm:text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pageError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs sm:text-sm text-rose-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{pageError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageError(null)}
            className="text-rose-700 hover:text-rose-900 p-1 cursor-pointer"
            aria-label="Tutup pesan error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showList && (
        <>
          {/* Pencarian & Filter Status */}
          <div
            className={`${
              embedded
                ? 'rounded-xl border border-slate-200 bg-slate-50/70 p-3'
                : 'bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]'
            } flex flex-col sm:flex-row gap-3 sm:items-center justify-between`}
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama guru, username, atau NIP..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div
                role="group"
                aria-label="Filter Status Akun"
                className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80"
              >
                {(
                  [
                    { id: 'ALL', label: 'Semua' },
                    { id: 'ACTIVE', label: 'Aktif' },
                    { id: 'INACTIVE', label: 'Nonaktif' },
                  ] as const
                ).map((tab) => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-white text-[#17325C] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={fetchAccounts}
                disabled={loading}
                title="Sinkronkan ulang daftar akun dari server"
                aria-label="Sinkronkan ulang daftar akun dari server"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Daftar Akun Guru */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Memuat daftar akun guru dari server...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {accounts.length === 0
                  ? 'Belum ada akun guru terdaftar.'
                  : 'Tidak ada akun guru yang cocok.'}
              </p>
            </div>
          ) : (
            <>
              {/* Tampilan Tabel untuk Web & Tablet */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="px-4 py-3">Nama Guru & NIP</th>
                        <th className="px-4 py-3">Username & Email</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Tanggal Dibuat</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredAccounts.map((acc) => {
                        const isActive = acc.status === 'ACTIVE';
                        const isBusy =
                          statusSubmittingId === acc.id ||
                          deleteSubmittingId === acc.id;
                        return (
                          <tr
                            key={acc.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="px-4 py-3.5 align-middle">
                              <div className="font-bold text-slate-900">
                                {acc.fullName}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                NIP: {acc.nip}
                              </div>
                              {acc.assignedClass && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1D63D8]">
                                    Kelas {acc.assignedClass}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <div className="font-semibold text-slate-800">
                                {acc.username}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {acc.email || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold border ${
                                    isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {isActive ? (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserX className="w-3.5 h-3.5" />
                                  )}
                                  {isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                                {acc.mustChangePassword && (
                                  <span className="text-[11px] font-semibold text-amber-700">
                                    Wajib ganti password
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-middle text-xs text-slate-600 whitespace-nowrap">
                              {formatCreatedDate(acc.createdAt)}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openEditModal(acc)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openResetModal(acc)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  Reset
                                </button>
                                {isActive ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setDeactivateTarget(acc)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 cursor-pointer"
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                    Nonaktifkan
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleReactivate(acc)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 cursor-pointer"
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                    Aktifkan
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setDeleteTarget(acc)}
                                  aria-label={`Hapus akun ${acc.fullName}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tampilan Kartu untuk Android / Layar Kecil */}
              <div className="md:hidden space-y-3">
                {filteredAccounts.map((acc) => {
                  const isActive = acc.status === 'ACTIVE';
                  const isBusy =
                    statusSubmittingId === acc.id ||
                    deleteSubmittingId === acc.id;
                  return (
                    <article
                      key={acc.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {acc.fullName}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            NIP: {acc.nip}
                          </p>
                          {acc.assignedClass && (
                            <span className="mt-1 inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1D63D8]">
                              Kelas {acc.assignedClass}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                          {acc.mustChangePassword && (
                            <span className="text-[10px] font-semibold text-amber-700">
                              Wajib ganti password
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                        <div>
                          <span className="text-slate-500 block">Username</span>
                          <span className="font-semibold text-slate-800 break-all">
                            {acc.username}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Tanggal Dibuat</span>
                          <span className="font-semibold text-slate-800">
                            {formatCreatedDate(acc.createdAt)}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block">Email</span>
                          <span className="font-medium text-slate-800 break-all">
                            {acc.email || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openEditModal(acc)}
                          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openResetModal(acc)}
                          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Reset
                        </button>
                        {isActive ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeactivateTarget(acc)}
                            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-amber-800 cursor-pointer whitespace-nowrap"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Nonaktifkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleReactivate(acc)}
                            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 cursor-pointer whitespace-nowrap"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Aktifkan
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(acc)}
                          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-rose-700 cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={embedded ? '' : 'pt-4 sm:pt-6 space-y-4'}>
      {embedded ? (
        <section
          aria-label="Manajemen Akun Guru"
          className="w-full rounded-2xl bg-white border border-slate-200/75 shadow-[0_4px_20px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#1D63D8] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-[#17325C] uppercase">
                  Akun Guru
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Total {accounts.length} · {activeCount} Aktif · {inactiveCount}{' '}
                  Nonaktif
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowList((prev) => !prev)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ListChecks className="w-4 h-4" />
                {showList ? 'Tutup Daftar' : 'Daftar Akun'}
              </button>
              <button
                type="button"
                onClick={openGenerateModal}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1D63D8] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                Generate Akun
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah Akun
              </button>
            </div>
          </div>

          {bodyContent}
        </section>
      ) : (
        <>
          {/* Header Halaman Standalone */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#A1B6FF] via-[#6882F5] to-[#445AD4] border border-[#C4D1FF]/80 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(68,90,212,0.4)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative z-10 flex items-center gap-3 min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/92 hover:bg-white text-[#25348F] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                  aria-label="Kembali ke Beranda"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <ManajemenAkunIcon className="w-11 h-11 shrink-0 hidden sm:block drop-shadow-xs" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(20,28,85,0.35)] leading-tight truncate">
                  Akun Guru
                </h1>
                <p className="text-xs text-indigo-50 mt-0.5 tabular-nums font-medium">
                  Total {accounts.length} · {activeCount} Aktif · {inactiveCount}{' '}
                  Nonaktif
                </p>
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openGenerateModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-indigo-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#3246B5] shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                Generate Akun
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#102547] hover:bg-[#17325C] border border-white/20 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah Akun
              </button>
            </div>
          </div>

          {bodyContent}
        </>
      )}

      {/* Modal Tambah Akun Guru */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2
                  id="modal-create-title"
                  className="text-base font-extrabold text-[#17325C]"
                >
                  Tambah Akun Guru
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !createSubmitting && setCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="p-5 space-y-3.5 overflow-y-auto"
              noValidate
            >
              {createError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Dropdown Ambil dari Data Guru */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-2">
                <label
                  htmlFor="select-teacher-from-master"
                  className="block text-xs font-bold text-[#17325C]"
                >
                  Ambil dari Data Guru
                </label>
                <select
                  id="select-teacher-from-master"
                  value={selectedTeacherId}
                  disabled={teacherOptionsLoading}
                  onChange={(e) => handleSelectTeacherOption(e.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                >
                  <option value="">
                    {teacherOptionsLoading
                      ? 'Memuat daftar guru...'
                      : teacherOptions.length === 0
                        ? '-- Belum ada Data Guru --'
                        : '-- Pilih Guru (atau isi manual) --'}
                  </option>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama}
                      {t.nip ? ` · NIP: ${t.nip}` : t.nik ? ` · NIK: ${t.nik}` : ''}
                      {t.alreadyHasAccount
                        ? ` (Sudah punya akun: ${t.linkedUsername || 'Aktif'})`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Guru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap guru"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP <span className="text-[11px] font-normal text-slate-500">(opsional jika Honorer)</span>
                  </label>
                  <input
                    type="text"
                    value={createNip}
                    onChange={(e) => setCreateNip(e.target.value)}
                    placeholder="Masukkan NIP guru"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email <span className="text-[11px] font-normal text-slate-500">(opsional)</span>
                  </label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="guru@sekolah.sch.id"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={createStatus}
                    onChange={(e) =>
                      setCreateStatus(e.target.value as AccountStatus)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelas yang Dipegang{' '}
                  <span className="text-[11px] font-normal text-slate-500">
                    (maks. 1 kelas per guru)
                  </span>
                </label>
                {classOptions.length > 0 ? (
                  <select
                    value={createAssignedClass}
                    onChange={(e) => setCreateAssignedClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="">-- Belum memilih kelas --</option>
                    {classOptions.map((opt) => {
                      const heldBySelectedTeacher =
                        Boolean(selectedTeacherObj?.assignedClass) &&
                        normalizeClassKey(opt.name) ===
                          normalizeClassKey(selectedTeacherObj?.assignedClass || '');
                      const occupiedOther =
                        Boolean(opt.occupiedByName) && !heldBySelectedTeacher;
                      return (
                        <option
                          key={opt.name}
                          value={opt.name}
                          disabled={occupiedOther}
                        >
                          {opt.name}
                          {occupiedOther
                            ? ` (Dipegang: ${opt.occupiedByName})`
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={createAssignedClass}
                    onChange={(e) => setCreateAssignedClass(e.target.value)}
                    placeholder="Contoh: 1A (opsional)"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatePassword(DEFAULT_TEACHER_PASSWORD);
                        setCreateConfirmPassword(DEFAULT_TEACHER_PASSWORD);
                        setShowCreatePassword(true);
                        setShowCreateConfirm(true);
                      }}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        createPassword === DEFAULT_TEACHER_PASSWORD
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Default
                    </button>
                    {selectedTeacherObj?.nip && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreatePassword(selectedTeacherObj.nip);
                          setCreateConfirmPassword(selectedTeacherObj.nip);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                          createPassword === selectedTeacherObj.nip
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        NIP
                      </button>
                    )}
                    {selectedTeacherObj?.nik && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreatePassword(selectedTeacherObj.nik);
                          setCreateConfirmPassword(selectedTeacherObj.nik);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                          createPassword === selectedTeacherObj.nik
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        NIK
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Min. 8 karakter (huruf & angka) atau NIP/NIK"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-300 pl-3.5 pr-11 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((p) => !p)}
                    aria-label={
                      showCreatePassword
                        ? 'Sembunyikan password'
                        : 'Tampilkan password'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showCreatePassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konfirmasi Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreateConfirm ? 'text' : 'password'}
                    value={createConfirmPassword}
                    onChange={(e) => setCreateConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-300 pl-3.5 pr-11 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateConfirm((p) => !p)}
                    aria-label={
                      showCreateConfirm
                        ? 'Sembunyikan konfirmasi password'
                        : 'Tampilkan konfirmasi password'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showCreateConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={createSubmitting}
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  {createSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Data Akun Guru */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2
                id="modal-edit-title"
                className="text-base font-extrabold text-[#17325C]"
              >
                Edit Akun Guru
              </h2>
              <button
                type="button"
                onClick={() => !editSubmitting && setEditTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleEditSubmit}
              className="p-5 space-y-3.5 overflow-y-auto"
              noValidate
            >
              {editError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Guru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP
                  </label>
                  <input
                    type="text"
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="guru@sekolah.sch.id"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as AccountStatus)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelas yang Dipegang{' '}
                  <span className="text-[11px] font-normal text-slate-500">
                    (maks. 1 kelas per guru)
                  </span>
                </label>
                {classOptions.length > 0 ? (
                  <select
                    value={editAssignedClass}
                    onChange={(e) => setEditAssignedClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="">-- Tidak memegang kelas --</option>
                    {editTarget.assignedClass &&
                      !classOptions.some(
                        (opt) =>
                          normalizeClassKey(opt.name) ===
                          normalizeClassKey(editTarget.assignedClass || '')
                      ) && (
                        <option value={editTarget.assignedClass}>
                          {editTarget.assignedClass}
                        </option>
                      )}
                    {classOptions.map((opt) => {
                      const heldByCurrentAccount =
                        Boolean(editTarget.assignedClass) &&
                        normalizeClassKey(opt.name) ===
                          normalizeClassKey(editTarget.assignedClass || '');
                      const occupiedOther =
                        Boolean(opt.occupiedByName) && !heldByCurrentAccount;
                      return (
                        <option
                          key={opt.name}
                          value={opt.name}
                          disabled={occupiedOther}
                        >
                          {opt.name}
                          {occupiedOther
                            ? ` (Dipegang: ${opt.occupiedByName})`
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editAssignedClass}
                    onChange={(e) => setEditAssignedClass(e.target.value)}
                    placeholder="Contoh: 1A (opsional)"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={editSubmitting}
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  {editSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password Guru (Password Baru/Sementara + Tautan Reset 1x Pakai) */}
      {resetTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reset-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2
                id="modal-reset-title"
                className="text-base font-extrabold text-[#17325C]"
              >
                Reset Password Guru
              </h2>
              <button
                type="button"
                onClick={() => !resetSubmitting && setResetTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-slate-500 block">Akun Guru:</span>
                  <span className="font-bold text-slate-900">
                    {resetTarget.fullName} ({resetTarget.username})
                  </span>
                </div>
                {resetTarget.email && (
                  <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                    {resetTarget.email}
                  </span>
                )}
              </div>

              {resetError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{resetError}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-3.5" noValidate>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Opsi 1: Tetapkan Password Baru / Sementara
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateTempPassword}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Buat Password
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Password Baru <span className="text-rose-500">*</span>
                    </label>
                    {resetPasswordVal && (
                      <button
                        type="button"
                        onClick={handleCopyTempPassword}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        {copiedTempPass ? (
                          <>
                            <Check className="w-3 h-3" /> Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Salin
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      placeholder="Min. 8 karakter (huruf & angka)"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-slate-300 pl-3.5 pr-11 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((p) => !p)}
                      aria-label={
                        showResetPassword
                          ? 'Sembunyikan password baru'
                          : 'Tampilkan password baru'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showResetPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konfirmasi Password Baru <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showResetConfirm ? 'text' : 'password'}
                      value={resetConfirmVal}
                      onChange={(e) => setResetConfirmVal(e.target.value)}
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-slate-300 pl-3.5 pr-11 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm((p) => !p)}
                      aria-label={
                        showResetConfirm
                          ? 'Sembunyikan konfirmasi password baru'
                          : 'Tampilkan konfirmasi password baru'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showResetConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D63D8] focus:ring-blue-600"
                  />
                  <span className="font-semibold">
                    Wajib ganti password saat login pertama
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                  >
                    {resetSubmitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>

              <div className="border-t border-slate-200 pt-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Tautan Reset (30 Menit)
                  </span>
                  <button
                    type="button"
                    disabled={resetLinkLoading}
                    onClick={handleCreateResetLink}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-600" />
                    {resetLinkLoading ? 'Membuat...' : 'Buat Tautan'}
                  </button>
                </div>

                {generatedResetLink && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2 text-xs">
                    <p className="font-semibold text-emerald-800">
                      {generatedResetLink.emailSent
                        ? 'Tautan reset telah dikirim ke email guru dan dapat juga disalin di bawah:'
                        : 'Tautan reset satu kali pakai siap diberikan kepada guru:'}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedResetLink.url}
                        className="flex-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleCopyResetLink}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer shrink-0"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Salin
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={resetSubmitting}
                  onClick={() => setResetTarget(null)}
                  className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Nonaktifkan Akun Guru */}
      {deactivateTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-deactivate-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="modal-deactivate-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Nonaktifkan Akun Guru
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  Apakah Anda yakin ingin menonaktifkan akun guru ini?
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Akun <strong>{deactivateTarget.fullName}</strong> tidak akan dapat
                  digunakan untuk login hingga diaktifkan kembali, sementara riwayat
                  data tetap tersimpan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={statusSubmittingId === deactivateTarget.id}
                onClick={() => setDeactivateTarget(null)}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={statusSubmittingId === deactivateTarget.id}
                onClick={handleConfirmDeactivate}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
              >
                {statusSubmittingId === deactivateTarget.id
                  ? 'Memproses...'
                  : 'Ya, Nonaktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akun Guru Permanen */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-teacher-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="modal-delete-teacher-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Hapus Akun Guru Permanen
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  Yakin ingin menghapus permanen akun{' '}
                  <strong>{deleteTarget.fullName}</strong> ({deleteTarget.username})?
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Akun akan dihapus permanen dari server, seluruh sesi login aktif guru
                  ini akan dihentikan, dan guru tidak dapat login lagi. Data siswa serta
                  pengaturan sekolah tidak akan terhapus.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleteSubmittingId === deleteTarget.id}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteSubmittingId === deleteTarget.id}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
              >
                {deleteSubmittingId === deleteTarget.id
                  ? 'Menghapus...'
                  : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Generate Semua Akun Guru & Tendik */}
      {generateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-generate-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2
                id="modal-generate-title"
                className="text-base font-extrabold text-[#17325C]"
              >
                Generate Akun Guru & Tendik
              </h2>
              <button
                type="button"
                onClick={() => !generateSubmitting && setGenerateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="p-5 space-y-4" noValidate>
              {generateError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{generateError}</span>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Target</span>
                  <span className="font-bold text-slate-900">Semua Guru & Tendik</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Username</span>
                  <span className="font-bold text-[#1D63D8]">NIK / NIP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password Default <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showGeneratePassword ? 'text' : 'password'}
                    value={generatePassword}
                    onChange={(e) => setGeneratePassword(e.target.value)}
                    placeholder="Min. 8 karakter (huruf & angka)"
                    required
                    className="w-full rounded-xl border border-slate-300 pl-3.5 pr-11 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeneratePassword((p) => !p)}
                    aria-label={
                      showGeneratePassword
                        ? 'Sembunyikan password default'
                        : 'Tampilkan password default'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showGeneratePassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={generateSubmitting}
                  onClick={() => setGenerateOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={generateSubmitting}
                  className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  {generateSubmitting ? 'Memproses...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
