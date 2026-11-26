import {
  EMPTY_SCHOOL_SETTINGS,
  SchoolFileSlot,
  SchoolSettings,
} from '../types/settings';
import { apiFetch, buildAuthHeaders, readJsonSafe } from './authApi';
import {
  deleteSchoolAssetFromCloud,
  syncServerSnapshotIfOperator,
} from './firestoreSync';

const DB_NAME = 'school-admin-pwa-db';
const DB_VERSION = 1;
const STORE_SETTINGS = 'settings';
const STORE_FILES = 'file_cache';
const SETTINGS_KEY = 'current';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateImageFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

  if (!hasValidExt && !hasValidMime) {
    return 'Format file tidak didukung. Gunakan gambar PNG, JPG, atau JPEG.';
  }
  if (file.size === 0) {
    return 'File gambar kosong atau rusak.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Ukuran file maksimal 10 MB.';
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

async function mirrorSettingsToIndexedDB(settings: SchoolSettings): Promise<void> {
  await idbPut(STORE_SETTINGS, SETTINGS_KEY, settings);
}

export async function loadSchoolSettings(): Promise<SchoolSettings> {
  try {
    const response = await fetch('/api/settings', {
      cache: 'no-store',
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
    if (response.status === 401 || response.status === 403) {
      return EMPTY_SCHOOL_SETTINGS;
    }
    if (response.ok) {
      const data = await readJsonSafe<SchoolSettings>(
        response,
        'Gagal memuat pengaturan sekolah.'
      );
      await mirrorSettingsToIndexedDB(data);
      return data;
    }
  } catch {
    // Fallback to IndexedDB when offline or server unavailable
  }

  const cached = await idbGet<SchoolSettings>(STORE_SETTINGS, SETTINGS_KEY);
  if (!cached) {
    return EMPTY_SCHOOL_SETTINGS;
  }

  // Hydrate offline file URLs from IndexedDB data URLs if available
  const hydratedFiles = { ...cached.files };
  const slots: SchoolFileSlot[] = ['logo', 'kop', 'ttd', 'stempel'];
  for (const slot of slots) {
    const meta = hydratedFiles[slot];
    if (meta) {
      const cachedDataUrl = await idbGet<string>(STORE_FILES, slot);
      if (cachedDataUrl) {
        hydratedFiles[slot] = { ...meta, url: cachedDataUrl };
      }
    }
  }

  return {
    ...cached,
    files: hydratedFiles,
  };
}

export async function saveSchoolTextSettings(
  payload: Partial<Pick<SchoolSettings, 'identity' | 'principal' | 'operator'>>
): Promise<SchoolSettings> {
  const response = await apiFetch('/api/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const updated = await readJsonSafe<SchoolSettings>(
    response,
    'Gagal menyimpan data pengaturan.'
  );
  await mirrorSettingsToIndexedDB(updated);
  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return updated;
}

export async function uploadSchoolFile(
  slot: SchoolFileSlot,
  file: File
): Promise<SchoolSettings> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

  const response = await apiFetch(`/api/settings/files/${slot}`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders({
      'Content-Type': contentType,
      'X-Filename': encodeURIComponent(file.name),
    }),
    body: file,
  });

  const updated = await readJsonSafe<SchoolSettings>(
    response,
    'Gagal mengunggah dan menyimpan file.'
  );
  await mirrorSettingsToIndexedDB(updated);

  try {
    const dataUrl = await fileToDataUrl(file);
    await idbPut(STORE_FILES, slot, dataUrl);
  } catch {
    // Offline cache mirroring is best-effort
  }

  await syncServerSnapshotIfOperator(buildAuthHeaders());
  return updated;
}

export async function deleteSchoolFile(slot: SchoolFileSlot): Promise<SchoolSettings> {
  const response = await apiFetch(`/api/settings/files/${slot}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });

  const updated = await readJsonSafe<SchoolSettings>(
    response,
    'Gagal menghapus file.'
  );
  await mirrorSettingsToIndexedDB(updated);
  await idbDelete(STORE_FILES, slot);
  await deleteSchoolAssetFromCloud(slot);
  await syncServerSnapshotIfOperator(buildAuthHeaders());

  return updated;
}
