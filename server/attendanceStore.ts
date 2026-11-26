import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AttendanceSheetRecord,
  AttendanceStatus,
  AttendanceStorePayload,
  AttendanceStudentEntry,
  ClassHomeroomAssignment,
} from '../src/types/attendance.ts';

export class AttendanceStoreError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function cleanStr(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim();
}

function normalizeStatus(val: unknown): AttendanceStatus {
  const s = String(val ?? '').trim().toUpperCase();
  if (s === 'H' || s === 'S' || s === 'I' || s === 'A') return s;
  return '';
}

function normalizeRombelKey(val: unknown): string {
  return String(val ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function sanitizeEntries(
  raw: unknown
): Record<string, AttendanceStudentEntry> {
  const result: Record<string, AttendanceStudentEntry> = {};
  if (!raw || typeof raw !== 'object') return result;

  for (const [studentId, entry] of Object.entries(
    raw as Record<string, unknown>
  )) {
    const cleanId = studentId.trim();
    if (!cleanId || !entry || typeof entry !== 'object') continue;
    const obj = entry as Partial<AttendanceStudentEntry>;
    result[cleanId] = {
      status: normalizeStatus(obj.status),
      note: cleanStr(obj.note).slice(0, 200),
    };
  }
  return result;
}

export function buildAttendanceSheetId(date: string, rombel: string): string {
  const safeDate = date.replace(/[^0-9-]/g, '').slice(0, 20) || 'nodate';
  const hash = crypto
    .createHash('sha1')
    .update(`${safeDate}::${rombel.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 12);
  const slug = rombel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `att_${safeDate}_${slug || 'kelas'}_${hash}`;
}

export function createAttendanceStore(storageDir: string) {
  const attendanceFile = path.resolve(storageDir, 'attendance.json');

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function readAll(): AttendanceStorePayload {
    ensureDir();
    if (!fs.existsSync(attendanceFile)) {
      return { homerooms: {}, sheets: [] };
    }
    try {
      const raw = fs.readFileSync(attendanceFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AttendanceStorePayload>;
      return {
        homerooms:
          parsed.homerooms && typeof parsed.homerooms === 'object'
            ? parsed.homerooms
            : {},
        sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [],
      };
    } catch {
      return { homerooms: {}, sheets: [] };
    }
  }

  function writeAllAtomic(data: AttendanceStorePayload): void {
    ensureDir();
    const tempPath = `${attendanceFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, attendanceFile);
  }

  function getAllRaw(): AttendanceStorePayload {
    return readAll();
  }

  function getSheet(
    date: string,
    rombel: string
  ): {
    sheet: AttendanceSheetRecord | null;
    homeroom: ClassHomeroomAssignment;
    savedDatesForRombel: Array<{
      id: string;
      date: string;
      updatedAt: string;
      updatedBy: string;
    }>;
  } {
    const cleanDate = date.trim();
    const cleanRombel = rombel.trim();
    const targetRombelKey = normalizeRombelKey(cleanRombel);
    const store = readAll();

    let savedHomeroom: ClassHomeroomAssignment = store.homerooms[cleanRombel] || {
      rombel: cleanRombel,
      teacherId: null,
      teacherName: '',
      teacherNip: '',
    };
    if (!store.homerooms[cleanRombel] && targetRombelKey) {
      for (const [key, hm] of Object.entries(store.homerooms)) {
        if (normalizeRombelKey(key) === targetRombelKey) {
          savedHomeroom = { ...hm, rombel: cleanRombel || hm.rombel };
          break;
        }
      }
    }

    const sheet =
      store.sheets.find(
        (s) =>
          s.date === cleanDate &&
          normalizeRombelKey(s.rombel) === targetRombelKey
      ) || null;

    const savedDatesForRombel = store.sheets
      .filter((s) => normalizeRombelKey(s.rombel) === targetRombelKey)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60)
      .map((s) => ({
        id: s.id,
        date: s.date,
        updatedAt: s.updatedAt,
        updatedBy: s.updatedBy,
      }));

    return {
      sheet,
      homeroom: savedHomeroom,
      savedDatesForRombel,
    };
  }

  function getMonthlySheets(
    month: string,
    rombel: string
  ): {
    homeroom: ClassHomeroomAssignment;
    sheetsByDate: Record<string, AttendanceSheetRecord>;
  } {
    const cleanMonth = month.trim();
    const cleanRombel = rombel.trim();
    const targetRombelKey = normalizeRombelKey(cleanRombel);
    const store = readAll();

    let savedHomeroom: ClassHomeroomAssignment = store.homerooms[cleanRombel] || {
      rombel: cleanRombel,
      teacherId: null,
      teacherName: '',
      teacherNip: '',
    };
    if (!store.homerooms[cleanRombel] && targetRombelKey) {
      for (const [key, hm] of Object.entries(store.homerooms)) {
        if (normalizeRombelKey(key) === targetRombelKey) {
          savedHomeroom = { ...hm, rombel: cleanRombel || hm.rombel };
          break;
        }
      }
    }

    const sheetsByDate: Record<string, AttendanceSheetRecord> = {};
    for (const s of store.sheets) {
      if (
        s.date.startsWith(`${cleanMonth}-`) &&
        normalizeRombelKey(s.rombel) === targetRombelKey
      ) {
        sheetsByDate[s.date] = s;
      }
    }

    return {
      homeroom: savedHomeroom,
      sheetsByDate,
    };
  }

  function patchSheetEntries(input: {
    date: string;
    rombel: string;
    waliKelasId?: string | null;
    waliKelasName?: string;
    waliKelasNip?: string;
    entries: Record<string, AttendanceStudentEntry>;
    updatedBy: string;
  }): AttendanceSheetRecord {
    const cleanDate = cleanStr(input.date);
    const cleanRombel = cleanStr(input.rombel);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      throw new AttendanceStoreError(400, 'Tanggal absensi tidak valid.');
    }
    if (!cleanRombel) {
      throw new AttendanceStoreError(400, 'Kelas / Rombel wajib dipilih.');
    }

    const store = readAll();
    const targetRombelKey = normalizeRombelKey(cleanRombel);
    const existingIdx = store.sheets.findIndex(
      (s) =>
        s.date === cleanDate &&
        normalizeRombelKey(s.rombel) === targetRombelKey
    );
    const existing = existingIdx >= 0 ? store.sheets[existingIdx] : null;
    const mergedEntries: Record<string, AttendanceStudentEntry> = {
      ...(existing?.entries || {}),
      ...sanitizeEntries(input.entries),
    };

    const existingHomeroom = Object.entries(store.homerooms).find(
      ([k]) => normalizeRombelKey(k) === targetRombelKey
    )?.[1];

    const waliKelasId =
      existing?.waliKelasId ??
      existingHomeroom?.teacherId ??
      (typeof input.waliKelasId === 'string' && input.waliKelasId.trim()
        ? input.waliKelasId.trim()
        : null);
    const waliKelasName =
      cleanStr(existing?.waliKelasName) ||
      cleanStr(existingHomeroom?.teacherName) ||
      cleanStr(input.waliKelasName);
    const waliKelasNip =
      cleanStr(existing?.waliKelasNip) ||
      cleanStr(existingHomeroom?.teacherNip) ||
      cleanStr(input.waliKelasNip);

    const nowIso = new Date().toISOString();
    const sheetId = existing?.id || buildAttendanceSheetId(cleanDate, cleanRombel);
    const record: AttendanceSheetRecord = {
      id: sheetId,
      date: cleanDate,
      rombel: cleanRombel,
      waliKelasId,
      waliKelasName,
      waliKelasNip,
      entries: mergedEntries,
      updatedBy: cleanStr(input.updatedBy) || 'Pengguna',
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      store.sheets[existingIdx] = record;
    } else {
      store.sheets.push(record);
    }

    writeAllAtomic(store);
    return record;
  }

  function saveSheet(input: {
    date: string;
    rombel: string;
    waliKelasId?: string | null;
    waliKelasName?: string;
    waliKelasNip?: string;
    entries: Record<string, AttendanceStudentEntry>;
    updatedBy: string;
  }): {
    sheet: AttendanceSheetRecord;
    homeroom: ClassHomeroomAssignment;
  } {
    const cleanDate = cleanStr(input.date);
    const cleanRombel = cleanStr(input.rombel);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      throw new AttendanceStoreError(400, 'Tanggal absensi tidak valid.');
    }
    if (!cleanRombel) {
      throw new AttendanceStoreError(400, 'Kelas / Rombel wajib dipilih.');
    }

    const store = readAll();
    const nowIso = new Date().toISOString();
    const sheetId = buildAttendanceSheetId(cleanDate, cleanRombel);

    const waliKelasId =
      typeof input.waliKelasId === 'string' && input.waliKelasId.trim()
        ? input.waliKelasId.trim()
        : null;
    const waliKelasName = cleanStr(input.waliKelasName);
    const waliKelasNip = cleanStr(input.waliKelasNip);
    const entries = sanitizeEntries(input.entries);

    const homeroom: ClassHomeroomAssignment = {
      rombel: cleanRombel,
      teacherId: waliKelasId,
      teacherName: waliKelasName,
      teacherNip: waliKelasNip,
      updatedAt: nowIso,
    };
    store.homerooms[cleanRombel] = homeroom;

    const existingIdx = store.sheets.findIndex(
      (s) => s.id === sheetId || (s.date === cleanDate && s.rombel === cleanRombel)
    );

    const record: AttendanceSheetRecord = {
      id: existingIdx >= 0 ? store.sheets[existingIdx].id : sheetId,
      date: cleanDate,
      rombel: cleanRombel,
      waliKelasId,
      waliKelasName,
      waliKelasNip,
      entries,
      updatedBy: cleanStr(input.updatedBy) || 'Pengguna',
      createdAt:
        existingIdx >= 0 ? store.sheets[existingIdx].createdAt : nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      store.sheets[existingIdx] = record;
    } else {
      store.sheets.push(record);
    }

    writeAllAtomic(store);
    return { sheet: record, homeroom };
  }

  function saveHomeroom(input: {
    rombel: string;
    teacherId?: string | null;
    teacherName?: string;
    teacherNip?: string;
  }): ClassHomeroomAssignment {
    const cleanRombel = cleanStr(input.rombel);
    if (!cleanRombel) {
      throw new AttendanceStoreError(400, 'Kelas / Rombel wajib dipilih.');
    }
    const store = readAll();
    const homeroom: ClassHomeroomAssignment = {
      rombel: cleanRombel,
      teacherId:
        typeof input.teacherId === 'string' && input.teacherId.trim()
          ? input.teacherId.trim()
          : null,
      teacherName: cleanStr(input.teacherName),
      teacherNip: cleanStr(input.teacherNip),
      updatedAt: new Date().toISOString(),
    };
    store.homerooms[cleanRombel] = homeroom;
    writeAllAtomic(store);
    return homeroom;
  }

  function clearHomeroom(rombel: string): void {
    const targetKey = rombel.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!targetKey) return;
    const store = readAll();
    let changed = false;
    for (const key of Object.keys(store.homerooms)) {
      if (key.trim().replace(/\s+/g, ' ').toLowerCase() === targetKey) {
        delete store.homerooms[key];
        changed = true;
      }
    }
    if (changed) {
      writeAllAtomic(store);
    }
  }

  function clearHomeroomsForTeacher(opts: {
    teacherId?: string | null;
    teacherName?: string;
    exceptRombel?: string;
  }): void {
    const tid = (opts.teacherId || '').trim();
    const tname = (opts.teacherName || '').trim().toLowerCase();
    const exceptKey = (opts.exceptRombel || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tid && !tname) return;

    const store = readAll();
    let changed = false;
    for (const [key, hm] of Object.entries(store.homerooms)) {
      const normKey = key.trim().replace(/\s+/g, ' ').toLowerCase();
      if (exceptKey && normKey === exceptKey) continue;
      const matchesId = Boolean(tid && hm.teacherId && hm.teacherId === tid);
      const matchesName = Boolean(
        !hm.teacherId &&
          tname &&
          hm.teacherName &&
          hm.teacherName.trim().toLowerCase() === tname
      );
      if (matchesId || matchesName) {
        delete store.homerooms[key];
        changed = true;
      }
    }
    if (changed) {
      writeAllAtomic(store);
    }
  }

  function deleteSheet(id: string): void {
    const store = readAll();
    const remaining = store.sheets.filter((s) => s.id !== id);
    if (remaining.length === store.sheets.length) {
      throw new AttendanceStoreError(404, 'Data absensi tidak ditemukan.');
    }
    store.sheets = remaining;
    writeAllAtomic(store);
  }

  function restoreRawAttendance(payload: {
    homerooms?: Record<string, ClassHomeroomAssignment>;
    sheets?: unknown[];
  }): { homerooms: number; sheetsRestored: number; sheetsUpdated: number } {
    const store = readAll();
    let homeroomsCount = 0;
    let sheetsRestored = 0;
    let sheetsUpdated = 0;

    if (payload.homerooms && typeof payload.homerooms === 'object') {
      for (const [rombelKey, rawHm] of Object.entries(payload.homerooms)) {
        if (!rawHm || typeof rawHm !== 'object') continue;
        const rombel = cleanStr(rawHm.rombel || rombelKey);
        if (!rombel) continue;
        const existing = store.homerooms[rombel];
        const incomingTime = rawHm.updatedAt
          ? Date.parse(rawHm.updatedAt) || 0
          : 0;
        const existingTime = existing?.updatedAt
          ? Date.parse(existing.updatedAt) || 0
          : 0;
        if (!existing || incomingTime > existingTime) {
          store.homerooms[rombel] = {
            rombel,
            teacherId:
              typeof rawHm.teacherId === 'string' && rawHm.teacherId.trim()
                ? rawHm.teacherId.trim()
                : null,
            teacherName: cleanStr(rawHm.teacherName),
            teacherNip: cleanStr(rawHm.teacherNip),
            updatedAt: cleanStr(rawHm.updatedAt) || new Date().toISOString(),
          };
          homeroomsCount++;
        }
      }
    }

    if (Array.isArray(payload.sheets)) {
      const byId = new Map<string, number>();
      store.sheets.forEach((s, idx) => byId.set(s.id, idx));

      for (const raw of payload.sheets) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Partial<AttendanceSheetRecord>;
        const id = cleanStr(item.id);
        const date = cleanStr(item.date);
        const rombel = cleanStr(item.rombel);
        if (!id || !date || !rombel) continue;
        const nowIso = new Date().toISOString();
        const normalized: AttendanceSheetRecord = {
          id,
          date,
          rombel,
          waliKelasId:
            typeof item.waliKelasId === 'string' && item.waliKelasId.trim()
              ? item.waliKelasId.trim()
              : null,
          waliKelasName: cleanStr(item.waliKelasName),
          waliKelasNip: cleanStr(item.waliKelasNip),
          entries: sanitizeEntries(item.entries),
          updatedBy: cleanStr(item.updatedBy) || 'Sync',
          createdAt: cleanStr(item.createdAt) || nowIso,
          updatedAt: cleanStr(item.updatedAt) || nowIso,
        };

        const idx = byId.get(id);
        if (idx === undefined) {
          byId.set(id, store.sheets.length);
          store.sheets.push(normalized);
          sheetsRestored++;
        } else {
          const existingTime = Date.parse(store.sheets[idx].updatedAt) || 0;
          const incomingTime = Date.parse(normalized.updatedAt) || 0;
          if (incomingTime > existingTime) {
            store.sheets[idx] = normalized;
            sheetsUpdated++;
          }
        }
      }
    }

    if (homeroomsCount > 0 || sheetsRestored > 0 || sheetsUpdated > 0) {
      writeAllAtomic(store);
    }

    return { homerooms: homeroomsCount, sheetsRestored, sheetsUpdated };
  }

  return {
    getAllRaw,
    getSheet,
    getMonthlySheets,
    saveSheet,
    patchSheetEntries,
    saveHomeroom,
    clearHomeroom,
    clearHomeroomsForTeacher,
    deleteSheet,
    restoreRawAttendance,
  };
}
