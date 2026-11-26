import type {
  AccountStatus,
  AuthStatusResponse,
  AuthUser,
  BulkGenerateAccountsResponse,
  ClassOptionItem,
  ForgotPasswordResponse,
  ResetTokenValidationResponse,
  TeacherAccount,
} from '../types/auth';
import {
  deleteAccountFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

const SESSION_TOKEN_STORAGE_KEY = 'school_admin_session_token';

export const OFFLINE_SYNC_ERROR =
  'Koneksi internet atau server terputus. Perubahan belum tersinkronisasi ke server.';

export function getStoredSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access issues
  }
}

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = getStoredSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(OFFLINE_SYNC_ERROR);
  }
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(OFFLINE_SYNC_ERROR);
  }
}

export async function readJsonSafe<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const rawText = await response.text();
  let parsed: unknown = null;
  let isJson = false;

  if (rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

  if (!response.ok) {
    if (
      isJson &&
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string' &&
      (parsed as { error: string }).error.trim()
    ) {
      throw new Error((parsed as { error: string }).error);
    }
    throw new Error(fallbackError);
  }

  if (!isJson || parsed === null) {
    throw new Error(
      'Server mengembalikan respons yang tidak valid. Silakan muat ulang halaman atau coba lagi.'
    );
  }

  return parsed as T;
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const response = await apiFetch('/api/auth/status', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<AuthStatusResponse>(
    response,
    'Gagal memeriksa status sesi.'
  );
}

export async function setupInitialOperator(payload: {
  fullName: string;
  nip?: string;
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
}): Promise<{ user: AuthUser; token: string }> {
  const response = await apiFetch('/api/auth/setup-operator', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ user: AuthUser; token: string }>(
    response,
    'Gagal membuat akun Operator awal.'
  );
  setStoredSessionToken(data.token);
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data;
}

export async function loginUser(payload: {
  identifier: string;
  password: string;
}): Promise<{ user: AuthUser; token: string }> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ user: AuthUser; token: string }>(
    response,
    'Login gagal.'
  );
  setStoredSessionToken(data.token);
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
  } finally {
    setStoredSessionToken(null);
  }
}

export async function changeOwnPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ user: AuthUser; token: string }> {
  const response = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ user: AuthUser; token: string }>(
    response,
    'Gagal memperbarui password.'
  );
  setStoredSessionToken(data.token);
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data;
}

export async function fetchClassOptions(): Promise<ClassOptionItem[]> {
  const response = await apiFetch('/api/classes', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ classes: ClassOptionItem[] }>(
    response,
    'Gagal memuat daftar kelas.'
  );
  return data.classes;
}

export async function updateMyAssignedClass(assignedClass: string): Promise<AuthUser> {
  const response = await apiFetch('/api/auth/me/class', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ assignedClass }),
  });
  const data = await readJsonSafe<{ user: AuthUser }>(
    response,
    'Gagal menyimpan kelas yang dipegang.'
  );
  return data.user;
}

export async function requestForgotPassword(
  email: string
): Promise<ForgotPasswordResponse> {
  const response = await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return readJsonSafe<ForgotPasswordResponse>(
    response,
    'Gagal memproses permintaan pemulihan password.'
  );
}

export async function validateResetToken(
  token: string
): Promise<ResetTokenValidationResponse> {
  const response = await apiFetch(
    `/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
    {
      cache: 'no-store',
      credentials: 'include',
    }
  );
  return readJsonSafe<ResetTokenValidationResponse>(
    response,
    'Tautan reset password tidak valid atau sudah kedaluwarsa.'
  );
}

export async function confirmPasswordReset(payload: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; message: string }> {
  const response = await apiFetch('/api/auth/reset-password/confirm', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonSafe<{ ok: boolean; message: string }>(
    response,
    'Gagal mengatur ulang password.'
  );
}

export async function listTeacherAccounts(): Promise<TeacherAccount[]> {
  const response = await apiFetch('/api/teacher-accounts', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ accounts: TeacherAccount[] }>(
    response,
    'Gagal memuat daftar akun guru.'
  );
  return data.accounts;
}

export async function createTeacherAccount(payload: {
  fullName: string;
  nip?: string;
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
  status: AccountStatus;
  teacherRecordId?: string | null;
  assignedClass?: string;
}): Promise<TeacherAccount> {
  const response = await apiFetch('/api/teacher-accounts', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ account: TeacherAccount }>(
    response,
    'Gagal menambahkan akun guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.account;
}

export async function generateAllTeacherAccounts(
  defaultPassword: string
): Promise<BulkGenerateAccountsResponse> {
  const response = await apiFetch('/api/teacher-accounts/generate-all', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ defaultPassword }),
  });
  const data = await readJsonSafe<BulkGenerateAccountsResponse>(
    response,
    'Gagal generate akun guru & tendik.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data;
}

export async function updateTeacherAccount(
  id: string,
  payload: {
    fullName: string;
    nip?: string;
    username: string;
    email?: string;
    status: AccountStatus;
    assignedClass?: string;
  }
): Promise<TeacherAccount> {
  const response = await apiFetch(`/api/teacher-accounts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ account: TeacherAccount }>(
    response,
    'Gagal memperbarui akun guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.account;
}

export async function resetTeacherPassword(
  id: string,
  payload: {
    password: string;
    confirmPassword: string;
    mustChangePassword?: boolean;
  }
): Promise<TeacherAccount> {
  const response = await apiFetch(
    `/api/teacher-accounts/${encodeURIComponent(id)}/reset-password`,
    {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }
  );
  const data = await readJsonSafe<{ account: TeacherAccount }>(
    response,
    'Gagal mengatur ulang password guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.account;
}

export async function generateTeacherResetLink(
  id: string
): Promise<{ ok: boolean; resetUrl: string; expiresAt: string; emailSent: boolean }> {
  const response = await apiFetch(
    `/api/teacher-accounts/${encodeURIComponent(id)}/reset-link`,
    {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );
  return readJsonSafe<{
    ok: boolean;
    resetUrl: string;
    expiresAt: string;
    emailSent: boolean;
  }>(response, 'Gagal membuat tautan reset password.');
}

export async function updateTeacherStatus(
  id: string,
  status: AccountStatus
): Promise<TeacherAccount> {
  const response = await apiFetch(
    `/api/teacher-accounts/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    }
  );
  const data = await readJsonSafe<{ account: TeacherAccount }>(
    response,
    'Gagal mengubah status akun guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.account;
}

export async function deleteTeacherAccount(id: string): Promise<void> {
  const response = await apiFetch(`/api/teacher-accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await readJsonSafe<{ ok: boolean }>(
    response,
    'Gagal menghapus akun guru.'
  );
  await deleteAccountFromCloud(id);
}

