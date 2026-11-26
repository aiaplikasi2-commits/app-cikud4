import type {
  TeacherForAccountOption,
  TeacherImportCommitResult,
  TeacherImportConflictMode,
  TeacherInputPayload,
  TeacherListItem,
  TeacherPreviewResult,
  TeacherRecord,
  TeacherRowImportDecision,
} from '../types/teacher';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import { validateExcelFileSelection } from './studentApi';
import {
  deleteTeacherFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

export interface TeacherListResponse {
  totalAll: number;
  employmentStatuses: string[];
  ptkTypes: string[];
  teachers: TeacherListItem[];
}

export async function listTeachers(params?: {
  search?: string;
  statusKepegawaian?: string;
  jenisPtk?: string;
}): Promise<TeacherListResponse> {
  const qs = new URLSearchParams();
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.statusKepegawaian?.trim()) {
    qs.set('statusKepegawaian', params.statusKepegawaian.trim());
  }
  if (params?.jenisPtk?.trim()) qs.set('jenisPtk', params.jenisPtk.trim());
  const query = qs.toString();
  const response = await apiFetch(`/api/teachers${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<TeacherListResponse>(
    response,
    'Gagal memuat data guru.'
  );
}

export async function listTeachersForAccountCreation(): Promise<
  TeacherForAccountOption[]
> {
  const response = await apiFetch('/api/teachers/for-account-creation', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ teachers: TeacherForAccountOption[] }>(
    response,
    'Gagal memuat daftar guru dari Data Guru.'
  );
  return data.teachers;
}

export async function getTeacherDetail(id: string): Promise<TeacherRecord> {
  const response = await apiFetch(`/api/teachers/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ teacher: TeacherRecord }>(
    response,
    'Gagal memuat detail profil guru.'
  );
  return data.teacher;
}

export async function createTeacher(
  payload: TeacherInputPayload
): Promise<TeacherRecord> {
  const response = await apiFetch('/api/teachers', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ teacher: TeacherRecord }>(
    response,
    'Gagal menambahkan data guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.teacher;
}

export async function updateTeacher(
  id: string,
  payload: TeacherInputPayload
): Promise<TeacherRecord> {
  const response = await apiFetch(`/api/teachers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ teacher: TeacherRecord }>(
    response,
    'Gagal memperbarui data guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.teacher;
}

export async function deleteTeacher(id: string): Promise<void> {
  const response = await apiFetch(`/api/teachers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await readJsonSafe<{ ok: boolean }>(
    response,
    'Gagal menghapus data guru.'
  );
  await deleteTeacherFromCloud(id);
}

export async function linkTeacherAccount(
  teacherId: string,
  accountId: string | null
): Promise<TeacherRecord> {
  const response = await apiFetch(
    `/api/teachers/${encodeURIComponent(teacherId)}/link-account`,
    {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ accountId }),
    }
  );
  const data = await readJsonSafe<{ teacher: TeacherRecord }>(
    response,
    'Gagal menghubungkan akun login guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.teacher;
}

export async function previewTeacherExcel(
  file: File
): Promise<TeacherPreviewResult> {
  const validationError = validateExcelFileSelection(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = file.name.toLowerCase().endsWith('.xls')
    ? 'application/vnd.ms-excel'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const response = await apiFetch('/api/teachers/import/preview', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({
      'Content-Type': contentType,
      'X-Filename': encodeURIComponent(file.name),
    }),
    body: file,
  });

  return readJsonSafe<TeacherPreviewResult>(
    response,
    'Gagal memeriksa file Excel Data Guru.'
  );
}

export async function commitTeacherImport(payload: {
  previewId: string;
  conflictMode: TeacherImportConflictMode;
  perRowDecisions?: Record<number, TeacherRowImportDecision>;
}): Promise<TeacherImportCommitResult> {
  const response = await apiFetch('/api/teachers/import/commit', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  const result = await readJsonSafe<TeacherImportCommitResult>(
    response,
    'Gagal menyimpan hasil import data guru.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return result;
}

async function triggerBlobDownload(
  response: Response,
  fallbackFilename: string,
  fallbackError: string
): Promise<void> {
  if (!response.ok) {
    let message = fallbackError;
    try {
      const text = await response.text();
      const json = JSON.parse(text);
      if (json && typeof json.error === 'string' && json.error.trim()) {
        message = json.error;
      }
    } catch {
      // Keep fallback message
    }
    throw new Error(message);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const filenameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);
  const filename = filenameMatch?.[1] || fallbackFilename;

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
}

export async function downloadTeacherTemplate(): Promise<void> {
  const response = await apiFetch('/api/teachers/template', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await triggerBlobDownload(
    response,
    'template-import-data-guru.xlsx',
    'Gagal mengunduh template Excel Data Guru.'
  );
}

export async function exportTeachersExcel(): Promise<void> {
  const response = await apiFetch('/api/teachers/export', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await triggerBlobDownload(
    response,
    'data-guru-export.xlsx',
    'Gagal mengekspor data guru ke Excel.'
  );
}

export async function downloadTeacherImportReport(
  result: TeacherImportCommitResult
): Promise<void> {
  const response = await apiFetch('/api/teachers/import/report', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(result),
  });
  await triggerBlobDownload(
    response,
    'laporan-import-data-guru.xlsx',
    'Gagal mengunduh laporan hasil import data guru.'
  );
}
