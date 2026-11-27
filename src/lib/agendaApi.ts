import type {
  AgendaConfig,
  AgendaInputPayload,
  AgendaListResponse,
  AgendaRecord,
  AgendaSummary,
} from '../types/agenda';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import {
  deleteAgendaFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

export async function listAgendas(filters?: {
  date?: string;
  month?: string;
  category?: string;
  status?: string;
  pic?: string;
  search?: string;
}): Promise<AgendaListResponse> {
  const qs = new URLSearchParams();
  if (filters?.date?.trim()) qs.set('date', filters.date.trim());
  if (filters?.month?.trim()) qs.set('month', filters.month.trim());
  if (filters?.category?.trim()) qs.set('category', filters.category.trim());
  if (filters?.status?.trim()) qs.set('status', filters.status.trim());
  if (filters?.pic?.trim()) qs.set('pic', filters.pic.trim());
  if (filters?.search?.trim()) qs.set('search', filters.search.trim());
  const query = qs.toString();

  const response = await apiFetch(`/api/agenda${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<AgendaListResponse>(
    response,
    'Gagal memuat daftar Agenda Harian.'
  );
}

export async function fetchAgendaSummary(): Promise<{
  summary: AgendaSummary;
  config: AgendaConfig;
}> {
  const response = await apiFetch('/api/agenda/summary', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<{ summary: AgendaSummary; config: AgendaConfig }>(
    response,
    'Gagal memuat ringkasan Agenda Harian.'
  );
}

export async function createAgenda(
  payload: AgendaInputPayload
): Promise<AgendaRecord> {
  const response = await apiFetch('/api/agenda', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ agenda: AgendaRecord }>(
    response,
    'Gagal menyimpan agenda kegiatan.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data.agenda;
}

export async function updateAgenda(
  id: string,
  payload: AgendaInputPayload
): Promise<AgendaRecord> {
  const response = await apiFetch(`/api/agenda/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ agenda: AgendaRecord }>(
    response,
    'Gagal memperbarui agenda kegiatan.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data.agenda;
}

export async function deleteAgenda(id: string): Promise<void> {
  const response = await apiFetch(`/api/agenda/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  await readJsonSafe<{ ok: boolean }>(
    response,
    'Gagal menghapus agenda kegiatan.'
  );
  await deleteAgendaFromCloud(id).catch(() => false);
}

export async function updateAgendaConfig(
  payload: Partial<AgendaConfig>
): Promise<AgendaConfig> {
  const response = await apiFetch('/api/agenda/config', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe<{ config: AgendaConfig }>(
    response,
    'Gagal memperbarui pengaturan Agenda Harian.'
  );
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data.config;
}
