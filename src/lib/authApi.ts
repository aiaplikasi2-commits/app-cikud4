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
import type { TeacherInputPayload, TeacherRecord } from '../types/teacher';
import {
  deleteAccountFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

const SESSION_TOKEN_STORAGE_KEY = 'school_admin_session_token';

const RAW_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/^['"]+|['"]+$/g, '')
  .replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  return RAW_API_BASE_URL;
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (
    /^https?:\/\//i.test(pathOrUrl) ||
    pathOrUrl.startsWith('data:') ||
    pathOrUrl.startsWith('blob:')
  ) {
    return pathOrUrl;
  }
  const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return RAW_API_BASE_URL ? `${RAW_API_BASE_URL}${normalized}` : normalized;
}

export function resolveAssetUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('/uploads/')) {
    return resolveApiUrl(pathOrUrl);
  }
  return pathOrUrl;
}

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
  const target = typeof input === 'string' ? resolveApiUrl(input) : input;
  try {
    return await fetch(target, init);
  } catch {
    throw new Error(OFFLINE_SYNC_ERROR);
  }
}

export async function readJsonSafe<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const rawText = await response.text();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
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

  const looksLikeHtml =
    !isJson &&
    (contentType.includes('text/html') || /^\s*<!doctype|^\s*<html/i.test(rawText));

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
    if (looksLikeHtml || response.status === 404 || response.status === 405) {
      throw new Error(
        `${fallbackError} Endpoint backend tidak ditemukan di domain ini (HTTP ${response.status}). Pastikan server backend aktif dan konfigurasi VITE_API_BASE_URL atau BACKEND_URL di Netlify sudah benar.`
      );
    }
    throw new Error(fallbackError);
  }

  if (!isJson || parsed === null) {
    if (looksLikeHtml) {
      throw new Error(
        `${fallbackError} Respons server berupa halaman HTML, bukan data API JSON. Periksa routing /api/* dan konfigurasi backend pada Netlify.`
      );
    }
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
  const data = await readJsonSafe<AuthStatusResponse>(
    response,
    'Gagal memeriksa status sesi.'
  );
  if (!data.authenticated || !data.user) {
    setStoredSessionToken(null);
  }
  return data;
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
    await fetch(resolveApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
  } catch {
    // Ensure client token is still cleared locally even if offline
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

export interface MyProfileResponse {
  user: AuthUser;
  teacherProfile: TeacherRecord | null;
  changedFields?: string[];
}

export async function fetchMyProfile(): Promise<MyProfileResponse> {
  const response = await apiFetch('/api/auth/me/profile', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<MyProfileResponse>(
    response,
    'Gagal memuat data profil pribadi.'
  );
}

export async function updateMyProfile(payload: {
  fullName: string;
  nip: string;
  email: string;
  teacherProfile?: Partial<TeacherInputPayload>;
}): Promise<MyProfileResponse> {
  const response = await apiFetch('/api/auth/me/profile', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<MyProfileResponse>(
    response,
    'Gagal memperbarui profil pribadi.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data;
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

