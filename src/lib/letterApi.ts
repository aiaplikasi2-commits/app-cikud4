import type { LetterInputPayload, LetterRecord, LetterTypeId } from '../types/letter';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import {
  deleteLetterFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

export interface LetterListResponse {
  totalAll: number;
  nextSequenceNumber: number;
  letters: LetterRecord[];
}

export async function listLetters(params?: {
  type?: LetterTypeId;
  search?: string;
}): Promise<LetterListResponse> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  const query = qs.toString();

  const response = await apiFetch(`/api/letters${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<LetterListResponse>(
    response,
    'Gagal memuat arsip surat.'
  );
}

export async function getLetterDetail(id: string): Promise<LetterRecord> {
  const response = await apiFetch(`/api/letters/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ letter: LetterRecord }>(
    response,
    'Gagal memuat detail arsip surat.'
  );
  return data.letter;
}

export async function createLetter(
  payload: LetterInputPayload
): Promise<LetterRecord> {
  const response = await apiFetch('/api/letters', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ letter: LetterRecord }>(
    response,
    'Gagal menyimpan arsip surat.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.letter;
}

export async function updateLetter(
  id: string,
  payload: LetterInputPayload
): Promise<LetterRecord> {
  const response = await apiFetch(`/api/letters/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ letter: LetterRecord }>(
    response,
    'Gagal memperbarui arsip surat.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return data.letter;
}

export async function deleteLetter(id: string): Promise<void> {
  const response = await apiFetch(`/api/letters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await readJsonSafe<{ ok: boolean }>(
    response,
    'Gagal menghapus arsip surat.'
  );
  await deleteLetterFromCloud(id);
}
