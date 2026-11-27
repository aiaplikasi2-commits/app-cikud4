import type {
  AdminNotificationListResponse,
  AdminNotificationRecord,
} from '../types/notification';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import {
  deleteNotificationFromCloud,
  deleteNotificationsFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

export async function listAdminNotifications(): Promise<AdminNotificationListResponse> {
  const response = await apiFetch('/api/notifications', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  return readJsonSafe<AdminNotificationListResponse>(
    response,
    'Gagal memuat notifikasi Admin.'
  );
}

export async function fetchAdminUnreadCount(): Promise<number> {
  const response = await apiFetch('/api/notifications/unread-count', {
    cache: 'no-store',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ unreadCount: number }>(
    response,
    'Gagal menghitung jumlah notifikasi.'
  );
  return Number(data.unreadCount) || 0;
}

export async function markAdminNotificationRead(id: string): Promise<{
  notification: AdminNotificationRecord;
  unreadCount: number;
}> {
  const response = await apiFetch(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );
  const data = await readJsonSafe<{
    notification: AdminNotificationRecord;
    unreadCount: number;
  }>(response, 'Gagal menandai notifikasi sudah dibaca.');
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data;
}

export async function markAllAdminNotificationsRead(): Promise<{
  updatedCount: number;
  unreadCount: number;
}> {
  const response = await apiFetch('/api/notifications/read-all', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{
    updatedCount: number;
    unreadCount: number;
  }>(response, 'Gagal menandai semua notifikasi.');
  await syncServerSnapshotIfOperator(buildAuthHeaders()).catch(() => false);
  return data;
}

export async function deleteAdminNotification(id: string): Promise<number> {
  const response = await apiFetch(`/api/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });
  const data = await readJsonSafe<{ ok: boolean; unreadCount: number }>(
    response,
    'Gagal menghapus notifikasi.'
  );
  await deleteNotificationFromCloud(id).catch(() => {});
  return Number(data.unreadCount) || 0;
}

export async function clearAdminNotifications(
  mode: 'all' | 'read' = 'all'
): Promise<{ deletedCount: number; unreadCount: number }> {
  const response = await apiFetch(
    `/api/notifications?mode=${encodeURIComponent(mode)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: buildAuthHeaders(),
    }
  );
  const data = await readJsonSafe<{
    ok: boolean;
    deletedIds: string[];
    deletedCount: number;
    unreadCount: number;
  }>(response, 'Gagal menghapus notifikasi.');
  if (Array.isArray(data.deletedIds) && data.deletedIds.length > 0) {
    await deleteNotificationsFromCloud(data.deletedIds).catch(() => {});
  }
  return {
    deletedCount: Number(data.deletedCount) || 0,
    unreadCount: Number(data.unreadCount) || 0,
  };
}
