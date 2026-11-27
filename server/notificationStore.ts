import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AdminNotificationRecord,
  AdminNotificationStoreSnapshot,
  AdminNotificationType,
} from '../src/types/notification.ts';

export class NotificationStoreError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_TYPES: AdminNotificationType[] = [
  'STUDENT_UPDATED',
  'TEACHER_PROFILE_UPDATED',
  'AGENDA_CREATED',
];

const MAX_ITEMS = 500;
const MAX_DELETED_IDS = 1000;

function cleanStr(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function sanitizeType(val: unknown): AdminNotificationType {
  const s = cleanStr(val, 40).toUpperCase();
  if (VALID_TYPES.includes(s as AdminNotificationType)) {
    return s as AdminNotificationType;
  }
  return 'STUDENT_UPDATED';
}

function sanitizeChangedFields(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const result: string[] = [];
  for (const item of list) {
    const cleaned = cleanStr(item, 160);
    if (!cleaned) continue;
    result.push(cleaned);
    if (result.length >= 40) break;
  }
  return result;
}

function normalizeRecord(raw: Partial<AdminNotificationRecord>): AdminNotificationRecord | null {
  const id = cleanStr(raw.id, 128);
  const title = cleanStr(raw.title, 200);
  if (!id || !title) return null;

  const nowIso = new Date().toISOString();
  return {
    id,
    type: sanitizeType(raw.type),
    actorUserId: cleanStr(raw.actorUserId, 128),
    actorName: cleanStr(raw.actorName, 150) || 'Guru',
    actorUsername: cleanStr(raw.actorUsername, 60),
    title,
    summary: cleanStr(raw.summary, 600),
    targetId: cleanStr(raw.targetId, 128),
    targetName: cleanStr(raw.targetName, 200),
    changedFields: sanitizeChangedFields(raw.changedFields),
    eventDate: cleanStr(raw.eventDate, 40),
    createdAt: cleanStr(raw.createdAt, 64) || nowIso,
    readAt:
      typeof raw.readAt === 'string' && raw.readAt.trim()
        ? cleanStr(raw.readAt, 64)
        : null,
  };
}

export function createNotificationStore(storageDir: string) {
  const notificationsFile = path.resolve(storageDir, 'notifications.json');

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function readStore(): AdminNotificationStoreSnapshot {
    ensureDir();
    if (!fs.existsSync(notificationsFile)) {
      return { items: [], deletedIds: [] };
    }
    try {
      const raw = fs.readFileSync(notificationsFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AdminNotificationStoreSnapshot>;
      const items = Array.isArray(parsed.items)
        ? parsed.items
            .map((item) => normalizeRecord(item))
            .filter((item): item is AdminNotificationRecord => item !== null)
        : [];
      const deletedIds = Array.isArray(parsed.deletedIds)
        ? parsed.deletedIds
            .map((id) => cleanStr(id, 128))
            .filter(Boolean)
            .slice(-MAX_DELETED_IDS)
        : [];
      return { items, deletedIds };
    } catch {
      return { items: [], deletedIds: [] };
    }
  }

  function writeStoreAtomic(snapshot: AdminNotificationStoreSnapshot): void {
    ensureDir();
    const trimmedItems = [...snapshot.items]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_ITEMS);
    const trimmedDeleted = Array.from(new Set(snapshot.deletedIds)).slice(
      -MAX_DELETED_IDS
    );
    const tempPath = `${notificationsFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(
      tempPath,
      JSON.stringify(
        { items: trimmedItems, deletedIds: trimmedDeleted },
        null,
        2
      ),
      'utf-8'
    );
    fs.renameSync(tempPath, notificationsFile);
  }

  function listNotifications(): {
    notifications: AdminNotificationRecord[];
    unreadCount: number;
  } {
    const store = readStore();
    const sorted = [...store.items].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const unreadCount = sorted.filter((n) => !n.readAt).length;
    return { notifications: sorted, unreadCount };
  }

  function getUnreadCount(): number {
    const store = readStore();
    return store.items.filter((n) => !n.readAt).length;
  }

  function createNotification(input: {
    type: AdminNotificationType;
    actorUserId: string;
    actorName: string;
    actorUsername?: string;
    title: string;
    summary: string;
    targetId?: string;
    targetName?: string;
    changedFields?: string[];
    eventDate?: string;
  }): AdminNotificationRecord {
    const store = readStore();
    const record: AdminNotificationRecord = {
      id: crypto.randomUUID(),
      type: sanitizeType(input.type),
      actorUserId: cleanStr(input.actorUserId, 128),
      actorName: cleanStr(input.actorName, 150) || 'Guru',
      actorUsername: cleanStr(input.actorUsername, 60),
      title: cleanStr(input.title, 200) || 'Pemberitahuan Aktivitas Guru',
      summary: cleanStr(input.summary, 600),
      targetId: cleanStr(input.targetId, 128),
      targetName: cleanStr(input.targetName, 200),
      changedFields: sanitizeChangedFields(input.changedFields),
      eventDate: cleanStr(input.eventDate, 40),
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    store.items.unshift(record);
    writeStoreAtomic(store);
    return record;
  }

  function markAsRead(id: string): AdminNotificationRecord {
    const cleanId = cleanStr(id, 128);
    const store = readStore();
    const idx = store.items.findIndex((n) => n.id === cleanId);
    if (idx === -1) {
      throw new NotificationStoreError(404, 'Notifikasi tidak ditemukan.');
    }
    if (!store.items[idx].readAt) {
      store.items[idx] = {
        ...store.items[idx],
        readAt: new Date().toISOString(),
      };
      writeStoreAtomic(store);
    }
    return store.items[idx];
  }

  function markAllAsRead(): { updatedCount: number } {
    const store = readStore();
    const nowIso = new Date().toISOString();
    let updatedCount = 0;
    store.items = store.items.map((n) => {
      if (!n.readAt) {
        updatedCount++;
        return { ...n, readAt: nowIso };
      }
      return n;
    });
    if (updatedCount > 0) {
      writeStoreAtomic(store);
    }
    return { updatedCount };
  }

  function deleteNotification(id: string): void {
    const cleanId = cleanStr(id, 128);
    const store = readStore();
    const remaining = store.items.filter((n) => n.id !== cleanId);
    if (remaining.length === store.items.length) {
      throw new NotificationStoreError(404, 'Notifikasi tidak ditemukan.');
    }
    store.items = remaining;
    if (!store.deletedIds.includes(cleanId)) {
      store.deletedIds.push(cleanId);
    }
    writeStoreAtomic(store);
  }

  function clearNotifications(mode: 'all' | 'read' = 'all'): {
    deletedIds: string[];
    deletedCount: number;
  } {
    const store = readStore();
    const removedIds: string[] = [];
    const kept: AdminNotificationRecord[] = [];
    for (const item of store.items) {
      const shouldRemove = mode === 'all' || Boolean(item.readAt);
      if (shouldRemove) {
        removedIds.push(item.id);
        if (!store.deletedIds.includes(item.id)) {
          store.deletedIds.push(item.id);
        }
      } else {
        kept.push(item);
      }
    }
    if (removedIds.length > 0) {
      store.items = kept;
      writeStoreAtomic(store);
    }
    return { deletedIds: removedIds, deletedCount: removedIds.length };
  }

  function getAllRaw(): AdminNotificationStoreSnapshot {
    return readStore();
  }

  function restoreRawNotifications(raw: unknown): {
    restored: number;
    updated: number;
  } {
    if (!raw || typeof raw !== 'object') {
      return { restored: 0, updated: 0 };
    }
    const obj = raw as Partial<AdminNotificationStoreSnapshot>;
    const store = readStore();
    const deletedSet = new Set<string>(store.deletedIds);
    if (Array.isArray(obj.deletedIds)) {
      for (const dId of obj.deletedIds) {
        const clean = cleanStr(dId, 128);
        if (clean) deletedSet.add(clean);
      }
    }

    const byId = new Map<string, number>();
    store.items.forEach((item, idx) => byId.set(item.id, idx));

    let restored = 0;
    let updated = 0;

    if (Array.isArray(obj.items)) {
      for (const candidate of obj.items) {
        if (!candidate || typeof candidate !== 'object') continue;
        const normalized = normalizeRecord(candidate as Partial<AdminNotificationRecord>);
        if (!normalized) continue;
        if (deletedSet.has(normalized.id)) continue;

        const existingIdx = byId.get(normalized.id);
        if (existingIdx === undefined) {
          byId.set(normalized.id, store.items.length);
          store.items.push(normalized);
          restored++;
        } else {
          const existing = store.items[existingIdx];
          if (!existing.readAt && normalized.readAt) {
            store.items[existingIdx] = { ...existing, readAt: normalized.readAt };
            updated++;
          }
        }
      }
    }

    const beforeLen = store.items.length;
    store.items = store.items.filter((item) => !deletedSet.has(item.id));
    const prunedLocally = beforeLen !== store.items.length;
    store.deletedIds = Array.from(deletedSet).slice(-MAX_DELETED_IDS);

    if (restored > 0 || updated > 0 || prunedLocally) {
      writeStoreAtomic(store);
    }

    return { restored, updated };
  }

  return {
    listNotifications,
    getUnreadCount,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    getAllRaw,
    restoreRawNotifications,
  };
}
