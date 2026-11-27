import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  LetterInputPayload,
  LetterPaperSize,
  LetterRecord,
  LetterTypeId,
  StudentAcceptedLetterData,
} from '../src/types/letter.ts';

export class LetterStoreError extends Error {
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

function sanitizeLetterType(val: unknown): LetterTypeId {
  if (val === 'SUKET_PINDAH_SEKOLAH') return 'SUKET_PINDAH_SEKOLAH';
  if (val === 'SURAT_LAIN_LAIN') return 'SURAT_LAIN_LAIN';
  return 'SUKET_SISWA_DITERIMA';
}

function sanitizePaperSize(val: unknown): LetterPaperSize {
  if (val === 'LEGAL') return 'LEGAL';
  if (val === 'A4') return 'A4';
  return 'F4';
}

function sanitizeLetterData(
  input: Partial<StudentAcceptedLetterData> | undefined
): StudentAcceptedLetterData {
  return {
    letterNumber: cleanStr(input?.letterNumber),
    letterDate: cleanStr(input?.letterDate),
    letterCity: cleanStr(input?.letterCity),
    schoolLocationLine: cleanStr(input?.schoolLocationLine),
    studentId:
      typeof input?.studentId === 'string' && input.studentId.trim()
        ? input.studentId.trim()
        : null,
    studentName: cleanStr(input?.studentName),
    birthPlace: cleanStr(input?.birthPlace),
    birthDate: cleanStr(input?.birthDate),
    gender: cleanStr(input?.gender),
    religion: cleanStr(input?.religion),
    address: cleanStr(input?.address),
    originSchool: cleanStr(input?.originSchool),
    targetClass: cleanStr(input?.targetClass),
    requirementClause:
      cleanStr(input?.requirementClause) ||
      'Dengan ketentuan memenuhi syarat yang dibutuhkan sekolah yang dituju.',
    closingClause:
      cleanStr(input?.closingClause) ||
      'Demikian surat keterangan ini dibuat dengan sebenarnya dan dapat dipergunakan oleh yang bersangkutan dengan sebaik-baiknya.',
    nipdNisn: cleanStr(input?.nipdNisn),
    parentName: cleanStr(input?.parentName),
    parentJob: cleanStr(input?.parentJob),
    destinationSchool: cleanStr(input?.destinationSchool),
    transferReason:
      cleanStr(input?.transferReason) || 'permintaan orang tua / wali siswa',
    paperSize: sanitizePaperSize(input?.paperSize),
    showKop: input?.showKop !== false,
    showSignatureAssets: input?.showSignatureAssets !== false,
    customTitle: cleanStr(input?.customTitle),
    customSubject: cleanStr(input?.customSubject),
    customAttachment: cleanStr(input?.customAttachment),
    customRecipient: cleanStr(input?.customRecipient),
    customBody: cleanStr(input?.customBody),
    customCc: cleanStr(input?.customCc),
    customUseSettingsSigner: input?.customUseSettingsSigner !== false,
    customSignerPosition: cleanStr(input?.customSignerPosition),
    customSignerName: cleanStr(input?.customSignerName),
    customSignerNip: cleanStr(input?.customSignerNip),
  };
}

function getTitleForType(
  type: LetterTypeId,
  data?: Partial<StudentAcceptedLetterData>
): string {
  if (type === 'SUKET_PINDAH_SEKOLAH') {
    return 'Surat Keterangan Pindah Sekolah';
  }
  if (type === 'SURAT_LAIN_LAIN') {
    return cleanStr(data?.customTitle) || 'Surat Lain-lain';
  }
  return 'Surat Ket. Diterima';
}

function getRecipientForRecord(
  type: LetterTypeId,
  data: StudentAcceptedLetterData
): string {
  if (type === 'SURAT_LAIN_LAIN') {
    const firstRecipientLine = data.customRecipient
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    const candidate =
      firstRecipientLine ||
      data.customSubject ||
      data.customTitle ||
      'Umum';
    return candidate.slice(0, 200);
  }
  return data.studentName;
}

export function createLetterStore(storageDir: string) {
  const lettersFile = path.resolve(storageDir, 'letters.json');

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function readAll(): LetterRecord[] {
    ensureDir();
    if (!fs.existsSync(lettersFile)) return [];
    try {
      const raw = fs.readFileSync(lettersFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as LetterRecord[]) : [];
    } catch {
      return [];
    }
  }

  function writeAllAtomic(records: LetterRecord[]): void {
    ensureDir();
    const tempPath = `${lettersFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tempPath, lettersFile);
  }

  function getAllRaw(): LetterRecord[] {
    return readAll();
  }

  function computeNextSequenceNumber(records: LetterRecord[]): number {
    let maxSeq = records.length;
    for (const r of records) {
      const match = /\/(\d{1,4})\//.exec(r.letterNumber || '');
      if (match) {
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }
    return maxSeq + 1;
  }

  function listLetters(filters?: {
    type?: string;
    search?: string;
  }): {
    totalAll: number;
    nextSequenceNumber: number;
    letters: LetterRecord[];
  } {
    const all = readAll();
    const search = (filters?.search || '').trim().toLowerCase();
    const typeFilter = (filters?.type || '').trim();

    const filtered = all
      .filter((item) => {
        if (typeFilter && item.type !== typeFilter) return false;
        if (!search) return true;
        return (
          item.recipientName.toLowerCase().includes(search) ||
          item.letterNumber.toLowerCase().includes(search) ||
          (item.data.originSchool || '').toLowerCase().includes(search) ||
          (item.data.destinationSchool || '').toLowerCase().includes(search) ||
          (item.data.nipdNisn || '').toLowerCase().includes(search) ||
          (item.data.parentName || '').toLowerCase().includes(search) ||
          (item.data.customTitle || '').toLowerCase().includes(search) ||
          (item.data.customSubject || '').toLowerCase().includes(search) ||
          (item.data.customRecipient || '').toLowerCase().includes(search) ||
          (item.data.customBody || '').toLowerCase().includes(search) ||
          (item.data.customSignerName || '').toLowerCase().includes(search) ||
          item.title.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    return {
      totalAll: all.length,
      nextSequenceNumber: computeNextSequenceNumber(all),
      letters: filtered,
    };
  }

  function getLetterById(id: string): LetterRecord {
    const all = readAll();
    const found = all.find((item) => item.id === id);
    if (!found) {
      throw new LetterStoreError(404, 'Arsip surat tidak ditemukan.');
    }
    return found;
  }

  function validatePayload(payload: Partial<LetterInputPayload>): {
    type: LetterTypeId;
    data: StudentAcceptedLetterData;
  } {
    const type = sanitizeLetterType(payload.type);
    const data = sanitizeLetterData(payload.data);

    if (!data.letterNumber) {
      throw new LetterStoreError(400, 'Nomor surat wajib diisi.');
    }
    if (type === 'SURAT_LAIN_LAIN') {
      if (!data.customTitle) {
        throw new LetterStoreError(400, 'Judul surat wajib diisi.');
      }
      if (!data.customBody) {
        throw new LetterStoreError(400, 'Isi surat wajib diisi.');
      }
    } else if (!data.studentName) {
      throw new LetterStoreError(400, 'Nama siswa pada surat wajib diisi.');
    }
    return { type, data };
  }

  function createLetter(input: Partial<LetterInputPayload>): LetterRecord {
    const { type, data } = validatePayload(input);
    const all = readAll();
    const nowIso = new Date().toISOString();

    const record: LetterRecord = {
      id: crypto.randomUUID(),
      type,
      title: getTitleForType(type, data),
      letterNumber: data.letterNumber,
      letterDate: data.letterDate,
      studentId: type === 'SURAT_LAIN_LAIN' ? null : data.studentId,
      recipientName: getRecipientForRecord(type, data),
      data,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    all.push(record);
    writeAllAtomic(all);
    return record;
  }

  function updateLetter(
    id: string,
    input: Partial<LetterInputPayload>
  ): LetterRecord {
    const all = readAll();
    const idx = all.findIndex((item) => item.id === id);
    if (idx === -1) {
      throw new LetterStoreError(404, 'Arsip surat tidak ditemukan.');
    }

    const { type, data } = validatePayload(input);
    const existing = all[idx];
    const updated: LetterRecord = {
      ...existing,
      type,
      title: getTitleForType(type, data),
      letterNumber: data.letterNumber,
      letterDate: data.letterDate,
      studentId: type === 'SURAT_LAIN_LAIN' ? null : data.studentId,
      recipientName: getRecipientForRecord(type, data),
      data,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    writeAllAtomic(all);
    return updated;
  }

  function deleteLetter(id: string): void {
    const all = readAll();
    const remaining = all.filter((item) => item.id !== id);
    if (remaining.length === all.length) {
      throw new LetterStoreError(404, 'Arsip surat tidak ditemukan.');
    }
    writeAllAtomic(remaining);
  }

  function restoreRawLetters(records: unknown[]): {
    restored: number;
    updated: number;
  } {
    if (!Array.isArray(records) || records.length === 0) {
      return { restored: 0, updated: 0 };
    }
    const all = readAll();
    const byId = new Map<string, number>();
    all.forEach((item, idx) => byId.set(item.id, idx));

    let restored = 0;
    let updated = 0;

    for (const raw of records) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<LetterRecord>;
      const id = String(item.id ?? '').trim();
      const type = sanitizeLetterType(item.type);
      const data = sanitizeLetterData(item.data);
      const hasPrimaryContent =
        type === 'SURAT_LAIN_LAIN'
          ? Boolean(data.customTitle || data.customBody)
          : Boolean(data.studentName);
      if (!id || !data.letterNumber || !hasPrimaryContent) continue;

      const nowIso = new Date().toISOString();
      const normalized: LetterRecord = {
        id,
        type,
        title: String(item.title ?? '').trim() || getTitleForType(type, data),
        letterNumber: data.letterNumber,
        letterDate: data.letterDate,
        studentId: type === 'SURAT_LAIN_LAIN' ? null : data.studentId,
        recipientName:
          String(item.recipientName ?? '').trim() ||
          getRecipientForRecord(type, data),
        data,
        createdAt: String(item.createdAt ?? '').trim() || nowIso,
        updatedAt: String(item.updatedAt ?? '').trim() || nowIso,
      };

      const existingIdx = byId.get(id);
      if (existingIdx === undefined) {
        byId.set(id, all.length);
        all.push(normalized);
        restored++;
      } else {
        const existing = all[existingIdx];
        const existingTime =
          Date.parse(existing.updatedAt || existing.createdAt) || 0;
        const incomingTime =
          Date.parse(normalized.updatedAt || normalized.createdAt) || 0;
        if (incomingTime > existingTime) {
          all[existingIdx] = normalized;
          updated++;
        }
      }
    }

    if (restored > 0 || updated > 0) {
      writeAllAtomic(all);
    }

    return { restored, updated };
  }

  return {
    getAllRaw,
    restoreRawLetters,
    listLetters,
    getLetterById,
    createLetter,
    updateLetter,
    deleteLetter,
  };
}
