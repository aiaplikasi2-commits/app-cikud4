import type {
  AttendanceKetColumnMode,
  AttendanceSheetRecord,
  AttendanceSheetResponse,
  ClassHomeroomAssignment,
  MonthlyAttendanceResponse,
  MonthlySchoolDaysMode,
  SaveAttendancePayload,
  SaveMonthlyAttendanceChangesPayload,
} from '../types/attendance';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import {
  deleteAttendanceFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

export async function getAttendanceSheet(params: {
  rombel?: string;
  date?: string;
}): Promise<AttendanceSheetResponse> {
  const qs = new URLSearchParams();
  if (params.rombel?.trim()) qs.set('rombel', params.rombel.trim());
  if (params.date?.trim()) qs.set('date', params.date.trim());
  const query = qs.toString();

  const response = await apiFetch(
    `/api/attendance${query ? `?${query}` : ''}`,
    {
      cache: 'no-store',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );
  return readJsonSafe<AttendanceSheetResponse>(
    response,
    'Gagal memuat daftar absensi siswa.'
  );
}

export async function saveAttendanceSheet(
  payload: SaveAttendancePayload
): Promise<{
  sheet: AttendanceSheetRecord;
  homeroom: ClassHomeroomAssignment;
}> {
  const response = await apiFetch('/api/attendance', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{
    sheet: AttendanceSheetRecord;
    homeroom: ClassHomeroomAssignment;
  }>(response, 'Gagal menyimpan daftar absensi siswa.');
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data;
}

export async function saveHomeroomAssignment(payload: {
  rombel: string;
  teacherId: string | null;
  teacherName: string;
  teacherNip: string;
}): Promise<ClassHomeroomAssignment> {
  const response = await apiFetch('/api/attendance/homeroom', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ homeroom: ClassHomeroomAssignment }>(
    response,
    'Gagal menyimpan data wali kelas.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data.homeroom;
}

export async function deleteAttendanceSheet(id: string): Promise<void> {
  const response = await apiFetch(
    `/api/attendance/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );
  await readJsonSafe<{ ok: boolean }>(
    response,
    'Gagal menghapus catatan absensi.'
  );
  await deleteAttendanceFromCloud(id).catch(() => undefined);
}

export async function downloadAttendanceExcel(params: {
  rombel: string;
  date: string;
  ketMode: AttendanceKetColumnMode;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params.rombel.trim()) qs.set('rombel', params.rombel.trim());
  if (params.date.trim()) qs.set('date', params.date.trim());
  qs.set('ketMode', params.ketMode);

  const response = await apiFetch(
    `/api/attendance/export/excel?${qs.toString()}`,
    {
      cache: 'no-store',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = 'Gagal mengunduh file Excel absensi siswa.';
    try {
      const text = await response.text();
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed?.error?.trim()) message = parsed.error;
    } catch {
      // Keep fallback message
    }
    throw new Error(message);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
  const safeRombel = (params.rombel || 'semua')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename =
    match?.[1] || `absen-siswa-${safeRombel || 'kelas'}-${params.date}.xlsx`;

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

export async function getMonthlyAttendance(params: {
  rombel?: string;
  month?: string;
  schoolDays?: MonthlySchoolDaysMode;
}): Promise<MonthlyAttendanceResponse> {
  const qs = new URLSearchParams();
  if (params.rombel?.trim()) qs.set('rombel', params.rombel.trim());
  if (params.month?.trim()) qs.set('month', params.month.trim());
  if (params.schoolDays) qs.set('schoolDays', params.schoolDays);
  const query = qs.toString();

  const response = await apiFetch(
    `/api/attendance/monthly${query ? `?${query}` : ''}`,
    {
      cache: 'no-store',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );
  return readJsonSafe<MonthlyAttendanceResponse>(
    response,
    'Gagal memuat rekap absensi bulanan.'
  );
}

export async function saveMonthlyAttendanceChanges(
  payload: SaveMonthlyAttendanceChangesPayload
): Promise<{ ok: boolean; updatedDates: number }> {
  const response = await apiFetch('/api/attendance/monthly', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ ok: boolean; updatedDates: number }>(
    response,
    'Gagal menyimpan perubahan rekap bulanan.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data;
}

export async function downloadMonthlyAttendanceExcel(params: {
  rombel: string;
  month: string;
  schoolDays: MonthlySchoolDaysMode;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params.rombel.trim()) qs.set('rombel', params.rombel.trim());
  if (params.month.trim()) qs.set('month', params.month.trim());
  qs.set('schoolDays', params.schoolDays);

  const response = await apiFetch(
    `/api/attendance/monthly/export/excel?${qs.toString()}`,
    {
      cache: 'no-store',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = 'Gagal mengunduh file Excel rekap bulanan.';
    try {
      const text = await response.text();
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed?.error?.trim()) message = parsed.error;
    } catch {
      // Keep fallback message
    }
    throw new Error(message);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
  const safeRombel = (params.rombel || 'semua')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename =
    match?.[1] || `rekap-absen-${safeRombel || 'kelas'}-${params.month}.xlsx`;

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

