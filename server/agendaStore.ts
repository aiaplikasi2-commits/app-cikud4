import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AuthUser } from '../src/types/auth.ts';
import type { TeacherRecord } from '../src/types/teacher.ts';
import {
  DEFAULT_AGENDA_CATEGORIES,
  type AgendaConfig,
  type AgendaInputPayload,
  type AgendaPersonOption,
  type AgendaRecord,
  type AgendaStatus,
  type AgendaStoreSnapshot,
  type AgendaSummary,
  type AgendaVisibility,
} from '../src/types/agenda.ts';

export class AgendaStoreError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_STATUSES: AgendaStatus[] = [
  'DIRENCANAKAN',
  'BERLANGSUNG',
  'SELESAI',
  'DIBATALKAN',
];

function cleanStr(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function getJakartaTodayIso(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback below
  }
  return new Date().toISOString().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function normalizeTime(value: unknown): string {
  const s = cleanStr(value, 10);
  if (!s) return '';
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!match) {
    throw new AgendaStoreError(
      400,
      'Format waktu harus HH:MM (contoh 07:30 atau 13:00).'
    );
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function sanitizeStatus(value: unknown): AgendaStatus {
  const s = cleanStr(value, 30).toUpperCase();
  if (VALID_STATUSES.includes(s as AgendaStatus)) {
    return s as AgendaStatus;
  }
  return 'DIRENCANAKAN';
}

function sanitizeVisibility(
  value: unknown,
  fallback: AgendaVisibility = 'SCHOOL'
): AgendaVisibility {
  const s = cleanStr(value, 30).toUpperCase();
  if (s === 'PERSONAL' || s === 'SCHOOL') return s;
  return fallback;
}

function sanitizeCategories(list: unknown): string[] {
  if (!Array.isArray(list)) return [...DEFAULT_AGENDA_CATEGORIES];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const cleaned = cleanStr(item, 80);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= 50) break;
  }
  return result.length > 0 ? result : [...DEFAULT_AGENDA_CATEGORIES];
}

function classifyTeacherGroup(jenisPtk: string): 'GURU' | 'TENDIK' {
  const j = (jenisPtk || '').toLowerCase();
  if (
    j.includes('tenaga') ||
    j.includes('administrasi') ||
    j.includes('operator') ||
    j.includes('pustaka') ||
    j.includes('penjaga') ||
    j.includes('kebersihan') ||
    j.includes('tata usaha') ||
    j.includes('tendik') ||
    j.includes('pesuruh') ||
    j.includes('satpam')
  ) {
    return 'TENDIK';
  }
  return 'GURU';
}

function compareAgendaOrder(a: AgendaRecord, b: AgendaRecord): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const ta = a.startTime || '23:59';
  const tb = b.startTime || '23:59';
  if (ta !== tb) return ta.localeCompare(tb);
  return a.createdAt.localeCompare(b.createdAt);
}

function createDefaultConfig(): AgendaConfig {
  return {
    categories: [...DEFAULT_AGENDA_CATEGORIES],
    allowGuruCreate: true,
    allowOperatorViewGuruPersonal: true,
    updatedAt: null,
  };
}

export function createAgendaStore(storageDir: string) {
  const agendasFile = path.resolve(storageDir, 'agendas.json');

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function readStore(): AgendaStoreSnapshot {
    ensureDir();
    if (!fs.existsSync(agendasFile)) {
      return {
        config: createDefaultConfig(),
        items: [],
      };
    }
    try {
      const raw = fs.readFileSync(agendasFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AgendaStoreSnapshot>;
      const rawConfig = (parsed.config || {}) as Partial<AgendaConfig>;
      const config: AgendaConfig = {
        categories: sanitizeCategories(rawConfig.categories),
        allowGuruCreate: rawConfig.allowGuruCreate !== false,
        allowOperatorViewGuruPersonal:
          rawConfig.allowOperatorViewGuruPersonal !== false,
        updatedAt:
          typeof rawConfig.updatedAt === 'string' && rawConfig.updatedAt.trim()
            ? rawConfig.updatedAt.trim()
            : null,
      };
      const items = Array.isArray(parsed.items)
        ? (parsed.items as AgendaRecord[])
        : [];
      return { config, items };
    } catch {
      return {
        config: createDefaultConfig(),
        items: [],
      };
    }
  }

  function writeStoreAtomic(snapshot: AgendaStoreSnapshot): void {
    ensureDir();
    const tempPath = `${agendasFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tempPath, agendasFile);
  }

  function getAllRaw(): AgendaStoreSnapshot {
    return readStore();
  }

  function buildPeopleOptions(
    teachers: TeacherRecord[]
  ): AgendaPersonOption[] {
    return [...teachers]
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((t) => ({
        id: t.id,
        nama: t.nama,
        nip: t.nip || '',
        jenisPtk: t.jenisPtk || '',
        group: classifyTeacherGroup(t.jenisPtk || ''),
        linkedAccountId: t.linkedAccountId || null,
        assignedClass: t.assignedClass || '',
      }));
  }

  function isVisibleToUser(
    item: AgendaRecord,
    user: AuthUser,
    config: AgendaConfig
  ): boolean {
    if (user.role === 'OPERATOR') {
      if (item.visibility === 'SCHOOL') return true;
      if (item.createdByUserId === user.id) return true;
      return config.allowOperatorViewGuruPersonal;
    }

    // GURU
    if (item.visibility === 'SCHOOL') return true;
    if (item.createdByUserId === user.id) return true;
    if (user.teacherRecordId) {
      if (item.picId && item.picId === user.teacherRecordId) return true;
      if (
        Array.isArray(item.participantIds) &&
        item.participantIds.includes(user.teacherRecordId)
      ) {
        return true;
      }
    }
    if (
      item.picName &&
      user.fullName &&
      item.picName.trim().toLowerCase() === user.fullName.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  }

  function canModifyItem(
    item: AgendaRecord,
    user: AuthUser,
    config: AgendaConfig
  ): boolean {
    if (user.role === 'OPERATOR') return true;
    return config.allowGuruCreate && item.createdByUserId === user.id;
  }

  function resolveAndValidatePayload(
    input: Partial<AgendaInputPayload>,
    user: AuthUser,
    teachers: TeacherRecord[],
    existingVisibility?: AgendaVisibility
  ): Omit<
    AgendaRecord,
    | 'id'
    | 'createdByUserId'
    | 'createdByName'
    | 'createdByRole'
    | 'updatedByName'
    | 'createdAt'
    | 'updatedAt'
  > {
    const title = cleanStr(input.title, 200);
    if (title.length < 2) {
      throw new AgendaStoreError(
        400,
        'Judul kegiatan wajib diisi (minimal 2 karakter).'
      );
    }

    const date = cleanStr(input.date, 20);
    if (!isValidIsoDate(date)) {
      throw new AgendaStoreError(
        400,
        'Tanggal kegiatan tidak valid. Gunakan format tanggal yang benar.'
      );
    }

    const startTime = normalizeTime(input.startTime);
    const endTime = normalizeTime(input.endTime);
    if (startTime && endTime && endTime < startTime) {
      throw new AgendaStoreError(
        400,
        'Waktu selesai tidak boleh lebih awal dari waktu mulai.'
      );
    }

    const category = cleanStr(input.category, 80) || 'Kegiatan lainnya';

    const teacherById = new Map<string, TeacherRecord>();
    for (const t of teachers) {
      teacherById.set(t.id, t);
    }

    let picId = cleanStr(input.picId, 128) || null;
    let picName = cleanStr(input.picName, 150);
    if (picId) {
      const foundPic = teacherById.get(picId);
      if (foundPic) {
        picName = foundPic.nama;
      } else {
        picId = null;
      }
    }
    if (!picName) {
      picName = user.fullName;
    }

    const rawParticipantIds = Array.isArray(input.participantIds)
      ? input.participantIds
      : [];
    const participantIds: string[] = [];
    const participantNames: string[] = [];
    const seenPid = new Set<string>();
    for (const rawId of rawParticipantIds) {
      const pid = cleanStr(rawId, 128);
      if (!pid || seenPid.has(pid)) continue;
      const found = teacherById.get(pid);
      if (!found) continue;
      seenPid.add(pid);
      participantIds.push(found.id);
      participantNames.push(found.nama);
      if (participantIds.length >= 100) break;
    }

    const extraParticipants = cleanStr(input.extraParticipants, 300);
    const location = cleanStr(input.location, 180);
    const description = cleanStr(input.description, 1500);
    const notes = cleanStr(input.notes, 800);
    const status = sanitizeStatus(input.status);
    const defaultVisibility: AgendaVisibility =
      user.role === 'OPERATOR'
        ? 'SCHOOL'
        : existingVisibility ?? 'SCHOOL';
    const visibility = sanitizeVisibility(input.visibility, defaultVisibility);

    return {
      title,
      date,
      startTime,
      endTime,
      category,
      picId,
      picName,
      participantIds,
      participantNames,
      extraParticipants,
      location,
      description,
      notes,
      status,
      visibility,
    };
  }

  function computeSummary(visibleItems: AgendaRecord[]): AgendaSummary {
    const todayDate = getJakartaTodayIso();
    const sorted = [...visibleItems].sort(compareAgendaOrder);

    const todayAgendas = sorted.filter((item) => item.date === todayDate);
    const upcomingAgendas = sorted
      .filter(
        (item) =>
          item.date > todayDate &&
          item.status !== 'DIBATALKAN' &&
          item.status !== 'SELESAI'
      )
      .slice(0, 6);

    const ongoingCount = todayAgendas.filter(
      (item) => item.status === 'BERLANGSUNG'
    ).length;
    const doneCount = todayAgendas.filter(
      (item) => item.status === 'SELESAI'
    ).length;
    const plannedCount = todayAgendas.filter(
      (item) => item.status === 'DIRENCANAKAN'
    ).length;

    return {
      todayDate,
      todayCount: todayAgendas.length,
      ongoingCount,
      doneCount,
      plannedCount,
      upcomingCount: sorted.filter(
        (item) =>
          item.date > todayDate &&
          item.status !== 'DIBATALKAN' &&
          item.status !== 'SELESAI'
      ).length,
      todayAgendas,
      upcomingAgendas,
    };
  }

  function listAgendasForUser(
    user: AuthUser,
    teachers: TeacherRecord[],
    filters?: {
      date?: string;
      month?: string;
      category?: string;
      status?: string;
      pic?: string;
      search?: string;
    }
  ) {
    const store = readStore();
    const visibleAll = store.items
      .filter((item) => isVisibleToUser(item, user, store.config))
      .sort(compareAgendaOrder);

    const summary = computeSummary(visibleAll);

    const filterDate = cleanStr(filters?.date, 20);
    const filterMonth = cleanStr(filters?.month, 10);
    const filterCategory = cleanStr(filters?.category, 80).toLowerCase();
    const filterStatus = cleanStr(filters?.status, 30).toUpperCase();
    const filterPic = cleanStr(filters?.pic, 150).toLowerCase();
    const search = cleanStr(filters?.search, 120).toLowerCase();

    const filtered = visibleAll.filter((item) => {
      if (filterDate && item.date !== filterDate) return false;
      if (filterMonth && !item.date.startsWith(filterMonth)) return false;
      if (
        filterCategory &&
        item.category.toLowerCase() !== filterCategory
      ) {
        return false;
      }
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterPic) {
        const matchesPicId = (item.picId || '').toLowerCase() === filterPic;
        const matchesPicName = item.picName.toLowerCase().includes(filterPic);
        if (!matchesPicId && !matchesPicName) return false;
      }
      if (search) {
        const haystack = [
          item.title,
          item.category,
          item.picName,
          item.location,
          item.description,
          item.notes,
          item.extraParticipants,
          ...(item.participantNames || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return {
      items: filtered,
      config: store.config,
      people: buildPeopleOptions(teachers),
      summary,
    };
  }

  function getSummaryForUser(user: AuthUser): {
    summary: AgendaSummary;
    config: AgendaConfig;
  } {
    const store = readStore();
    const visibleAll = store.items.filter((item) =>
      isVisibleToUser(item, user, store.config)
    );
    return {
      summary: computeSummary(visibleAll),
      config: store.config,
    };
  }

  function createAgenda(
    input: Partial<AgendaInputPayload>,
    user: AuthUser,
    teachers: TeacherRecord[]
  ): AgendaRecord {
    const store = readStore();
    if (user.role === 'GURU' && !store.config.allowGuruCreate) {
      throw new AgendaStoreError(
        403,
        'Pembuatan agenda oleh Guru saat ini dinonaktifkan oleh Operator.'
      );
    }

    const validated = resolveAndValidatePayload(input, user, teachers);
    const nowIso = new Date().toISOString();

    const record: AgendaRecord = {
      id: crypto.randomUUID(),
      ...validated,
      createdByUserId: user.id,
      createdByName: user.fullName,
      createdByRole: user.role,
      updatedByName: user.fullName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.items.push(record);
    writeStoreAtomic(store);
    return record;
  }

  function updateAgenda(
    id: string,
    input: Partial<AgendaInputPayload>,
    user: AuthUser,
    teachers: TeacherRecord[]
  ): AgendaRecord {
    const store = readStore();
    const idx = store.items.findIndex((item) => item.id === id);
    if (idx === -1) {
      throw new AgendaStoreError(404, 'Agenda kegiatan tidak ditemukan.');
    }

    const existing = store.items[idx];
    if (!canModifyItem(existing, user, store.config)) {
      throw new AgendaStoreError(
        403,
        'Anda hanya dapat mengubah agenda yang Anda buat sendiri.'
      );
    }

    const validated = resolveAndValidatePayload(
      input,
      user,
      teachers,
      existing.visibility
    );
    const updated: AgendaRecord = {
      ...existing,
      ...validated,
      createdByUserId: existing.createdByUserId,
      createdByName: existing.createdByName,
      createdByRole: existing.createdByRole,
      updatedByName: user.fullName,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    store.items[idx] = updated;
    writeStoreAtomic(store);
    return updated;
  }

  function deleteAgenda(id: string, user: AuthUser): void {
    const store = readStore();
    const existing = store.items.find((item) => item.id === id);
    if (!existing) {
      throw new AgendaStoreError(404, 'Agenda kegiatan tidak ditemukan.');
    }
    if (!canModifyItem(existing, user, store.config)) {
      throw new AgendaStoreError(
        403,
        'Anda hanya dapat menghapus agenda yang Anda buat sendiri.'
      );
    }

    store.items = store.items.filter((item) => item.id !== id);
    writeStoreAtomic(store);
  }

  function updateConfig(input: Partial<AgendaConfig>): AgendaConfig {
    const store = readStore();
    const nextConfig: AgendaConfig = {
      categories:
        input.categories !== undefined
          ? sanitizeCategories(input.categories)
          : store.config.categories,
      allowGuruCreate:
        typeof input.allowGuruCreate === 'boolean'
          ? input.allowGuruCreate
          : store.config.allowGuruCreate,
      allowOperatorViewGuruPersonal:
        typeof input.allowOperatorViewGuruPersonal === 'boolean'
          ? input.allowOperatorViewGuruPersonal
          : store.config.allowOperatorViewGuruPersonal,
      updatedAt: new Date().toISOString(),
    };
    store.config = nextConfig;
    writeStoreAtomic(store);
    return nextConfig;
  }

  function restoreRawAgendas(payload: unknown): {
    configUpdated: boolean;
    restored: number;
    updated: number;
  } {
    if (!payload || typeof payload !== 'object') {
      return { configUpdated: false, restored: 0, updated: 0 };
    }
    const rawObj = payload as {
      config?: Partial<AgendaConfig>;
      items?: unknown[];
    };
    const store = readStore();
    let configUpdated = false;

    if (rawObj.config && typeof rawObj.config === 'object') {
      const localTime = store.config.updatedAt
        ? Date.parse(store.config.updatedAt) || 0
        : 0;
      const incomingTime = rawObj.config.updatedAt
        ? Date.parse(rawObj.config.updatedAt) || 0
        : 0;
      if (incomingTime > localTime || (!store.config.updatedAt && rawObj.config.updatedAt)) {
        store.config = {
          categories: sanitizeCategories(rawObj.config.categories),
          allowGuruCreate: rawObj.config.allowGuruCreate !== false,
          allowOperatorViewGuruPersonal:
            rawObj.config.allowOperatorViewGuruPersonal !== false,
          updatedAt: rawObj.config.updatedAt || new Date().toISOString(),
        };
        configUpdated = true;
      }
    }

    const byId = new Map<string, number>();
    store.items.forEach((item, idx) => byId.set(item.id, idx));

    let restored = 0;
    let updated = 0;

    if (Array.isArray(rawObj.items)) {
      for (const raw of rawObj.items) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Partial<AgendaRecord>;
        const id = cleanStr(r.id, 128);
        const title = cleanStr(r.title, 200);
        const date = cleanStr(r.date, 20);
        if (!id || !title || !isValidIsoDate(date)) continue;

        const nowIso = new Date().toISOString();
        const normalized: AgendaRecord = {
          id,
          title,
          date,
          startTime: cleanStr(r.startTime, 10),
          endTime: cleanStr(r.endTime, 10),
          category: cleanStr(r.category, 80) || 'Kegiatan lainnya',
          picId: cleanStr(r.picId, 128) || null,
          picName: cleanStr(r.picName, 150) || 'Pengguna',
          participantIds: Array.isArray(r.participantIds)
            ? r.participantIds.map((x) => cleanStr(x, 128)).filter(Boolean).slice(0, 100)
            : [],
          participantNames: Array.isArray(r.participantNames)
            ? r.participantNames.map((x) => cleanStr(x, 150)).filter(Boolean).slice(0, 100)
            : [],
          extraParticipants: cleanStr(r.extraParticipants, 300),
          location: cleanStr(r.location, 180),
          description: cleanStr(r.description, 1500),
          notes: cleanStr(r.notes, 800),
          status: sanitizeStatus(r.status),
          visibility: sanitizeVisibility(r.visibility, 'SCHOOL'),
          createdByUserId: cleanStr(r.createdByUserId, 128) || 'system',
          createdByName: cleanStr(r.createdByName, 150) || 'Pengguna',
          createdByRole: r.createdByRole === 'GURU' ? 'GURU' : 'OPERATOR',
          updatedByName: cleanStr(r.updatedByName, 150) || 'Pengguna',
          createdAt: cleanStr(r.createdAt, 64) || nowIso,
          updatedAt: cleanStr(r.updatedAt, 64) || nowIso,
        };

        const existingIdx = byId.get(id);
        if (existingIdx === undefined) {
          byId.set(id, store.items.length);
          store.items.push(normalized);
          restored++;
        } else {
          const existing = store.items[existingIdx];
          const existingTime =
            Date.parse(existing.updatedAt || existing.createdAt) || 0;
          const incomingTime =
            Date.parse(normalized.updatedAt || normalized.createdAt) || 0;
          if (incomingTime > existingTime) {
            store.items[existingIdx] = normalized;
            updated++;
          }
        }
      }
    }

    if (configUpdated || restored > 0 || updated > 0) {
      writeStoreAtomic(store);
    }

    return { configUpdated, restored, updated };
  }

  return {
    getAllRaw,
    restoreRawAgendas,
    listAgendasForUser,
    getSummaryForUser,
    createAgenda,
    updateAgenda,
    deleteAgenda,
    updateConfig,
  };
}
