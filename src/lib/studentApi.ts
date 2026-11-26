import type {
  DapodikImportCommitResult,
  DapodikPreviewResult,
  ImportConflictMode,
  RowImportDecision,
  StudentInputPayload,
  StudentListItem,
  StudentRecord,
} from '../types/student';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import {
  deleteStudentFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

export interface StudentListResponse {
  totalAll: number;
  rombels: string[];
  students: StudentListItem[];
}

export async function listStudents(params?: {
  search?: string;
  rombel?: string;
}): Promise<StudentListResponse> {
  const qs = new URLSearchParams();
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.rombel?.trim()) qs.set('rombel', params.rombel.trim());
  const query = qs.toString();
  const response = await apiFetch(`/api/students${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<StudentListResponse>(
    response,
    'Gagal memuat data siswa.'
  );
}

export async function getStudentDetail(id: string): Promise<StudentRecord> {
  const response = await apiFetch(`/api/students/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ student: StudentRecord }>(
    response,
    'Gagal memuat profil siswa.'
  );
  return data.student;
}

export async function createStudent(
  payload: StudentInputPayload
): Promise<StudentRecord> {
  const response = await apiFetch('/api/students', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ student: StudentRecord }>(
    response,
    'Gagal menambahkan data siswa.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.student;
}

export async function updateStudent(
  id: string,
  payload: StudentInputPayload
): Promise<StudentRecord> {
  const response = await apiFetch(`/api/students/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ student: StudentRecord }>(
    response,
    'Gagal memperbarui data siswa.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.student;
}

export async function deleteStudent(id: string): Promise<void> {
  const response = await apiFetch(`/api/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await readJsonSafe<{ ok: boolean }>(
    response,
    'Gagal menghapus data siswa.'
  );
  await deleteStudentFromCloud(id);
}

export function validateExcelFileSelection(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return 'Format file tidak didukung. Pilih file Excel berformat XLSX atau XLS.';
  }
  if (file.size === 0) {
    return 'File Excel kosong atau rusak.';
  }
  if (file.size > 15 * 1024 * 1024) {
    return 'Ukuran file maksimal 15 MB.';
  }
  return null;
}

export async function previewDapodikExcel(
  file: File
): Promise<DapodikPreviewResult> {
  const validationError = validateExcelFileSelection(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = file.name.toLowerCase().endsWith('.xls')
    ? 'application/vnd.ms-excel'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const response = await apiFetch('/api/students/import/preview', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({
      'Content-Type': contentType,
      'X-Filename': encodeURIComponent(file.name),
    }),
    body: file,
  });

  return readJsonSafe<DapodikPreviewResult>(
    response,
    'Gagal memeriksa file Excel Dapodik.'
  );
}

export async function commitDapodikImport(payload: {
  previewId: string;
  conflictMode: ImportConflictMode;
  perRowDecisions?: Record<number, RowImportDecision>;
}): Promise<DapodikImportCommitResult> {
  const response = await apiFetch('/api/students/import/commit', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  const result = await readJsonSafe<DapodikImportCommitResult>(
    response,
    'Gagal menyimpan hasil import data siswa.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return result;
}
