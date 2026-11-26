import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  DapodikImportCommitResult,
  DapodikImportFailure,
  ImportConflictMode,
  RowImportDecision,
  StudentDataStatus,
  StudentInputPayload,
  StudentListItem,
  StudentRecord,
} from '../src/types/student.ts';
import type { UserRole } from '../src/types/auth.ts';
import type { ParsedDapodikRowInternal } from './dapodikParser.ts';

export class StudentStoreError extends Error {
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

function sanitizeStudentPayload(input: Partial<StudentInputPayload>): StudentInputPayload {
  return {
    no: cleanStr(input.no),
    nama: cleanStr(input.nama),
    nipd: cleanStr(input.nipd),
    jk: cleanStr(input.jk).toUpperCase(),
    nisn: cleanStr(input.nisn),
    tempatLahir: cleanStr(input.tempatLahir),
    tanggalLahir: cleanStr(input.tanggalLahir),
    nik: cleanStr(input.nik),
    agama: cleanStr(input.agama),
    noRegistrasiAktaLahir: cleanStr(input.noRegistrasiAktaLahir),
    noKk: cleanStr(input.noKk),
    kebutuhanKhusus: cleanStr(input.kebutuhanKhusus),
    anakKeBerapa: cleanStr(input.anakKeBerapa),
    jmlSaudaraKandung: cleanStr(input.jmlSaudaraKandung),
    alamat: cleanStr(input.alamat),
    rt: cleanStr(input.rt),
    rw: cleanStr(input.rw),
    dusun: cleanStr(input.dusun),
    kelurahan: cleanStr(input.kelurahan),
    kecamatan: cleanStr(input.kecamatan),
    kodePos: cleanStr(input.kodePos),
    jenisTinggal: cleanStr(input.jenisTinggal),
    alatTransportasi: cleanStr(input.alatTransportasi),
    telepon: cleanStr(input.telepon),
    hp: cleanStr(input.hp),
    email: cleanStr(input.email),
    lintang: cleanStr(input.lintang),
    bujur: cleanStr(input.bujur),
    jarakRumahKeSekolahKm: cleanStr(input.jarakRumahKeSekolahKm),
    ayah: {
      nama: cleanStr(input.ayah?.nama),
      tahunLahir: cleanStr(input.ayah?.tahunLahir),
      jenjangPendidikan: cleanStr(input.ayah?.jenjangPendidikan),
      pekerjaan: cleanStr(input.ayah?.pekerjaan),
      penghasilan: cleanStr(input.ayah?.penghasilan),
      nik: cleanStr(input.ayah?.nik),
    },
    ibu: {
      nama: cleanStr(input.ibu?.nama),
      tahunLahir: cleanStr(input.ibu?.tahunLahir),
      jenjangPendidikan: cleanStr(input.ibu?.jenjangPendidikan),
      pekerjaan: cleanStr(input.ibu?.pekerjaan),
      penghasilan: cleanStr(input.ibu?.penghasilan),
      nik: cleanStr(input.ibu?.nik),
    },
    wali: {
      nama: cleanStr(input.wali?.nama),
      tahunLahir: cleanStr(input.wali?.tahunLahir),
      jenjangPendidikan: cleanStr(input.wali?.jenjangPendidikan),
      pekerjaan: cleanStr(input.wali?.pekerjaan),
      penghasilan: cleanStr(input.wali?.penghasilan),
      nik: cleanStr(input.wali?.nik),
    },
    rombelSaatIni: cleanStr(input.rombelSaatIni),
    sekolahAsal: cleanStr(input.sekolahAsal),
    skhun: cleanStr(input.skhun),
    noPesertaUjianNasional: cleanStr(input.noPesertaUjianNasional),
    noSeriIjazah: cleanStr(input.noSeriIjazah),
    penerimaKps: cleanStr(input.penerimaKps),
    noKps: cleanStr(input.noKps),
    penerimaKip: cleanStr(input.penerimaKip),
    nomorKip: cleanStr(input.nomorKip),
    namaDiKip: cleanStr(input.namaDiKip),
    nomorKks: cleanStr(input.nomorKks),
    bank: cleanStr(input.bank),
    nomorRekeningBank: cleanStr(input.nomorRekeningBank),
    rekeningAtasNama: cleanStr(input.rekeningAtasNama),
    layakPip: cleanStr(input.layakPip),
    alasanLayakPip: cleanStr(input.alasanLayakPip),
    beratBadan: cleanStr(input.beratBadan),
    tinggiBadan: cleanStr(input.tinggiBadan),
    lingkarKepala: cleanStr(input.lingkarKepala),
  };
}

function computeStatusData(p: StudentInputPayload): StudentDataStatus {
  const hasName = Boolean(p.nama);
  const hasId = Boolean(p.nisn || p.nipd);
  const hasGender = p.jk === 'L' || p.jk === 'P';
  const hasBirth = Boolean(p.tempatLahir && p.tanggalLahir);
  const hasRombel = Boolean(p.rombelSaatIni);
  return hasName && hasId && hasGender && hasBirth && hasRombel
    ? 'LENGKAP'
    : 'PERLU_PERIKSA';
}

function maskSensitiveDigits(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••';
  return `${trimmed.slice(0, 4)}${'•'.repeat(Math.max(4, trimmed.length - 8))}${trimmed.slice(-4)}`;
}

function maskStudentForTeacher(record: StudentRecord): StudentRecord {
  return {
    ...record,
    nik: maskSensitiveDigits(record.nik),
    noKk: maskSensitiveDigits(record.noKk),
    noRegistrasiAktaLahir: maskSensitiveDigits(record.noRegistrasiAktaLahir),
    nomorRekeningBank: maskSensitiveDigits(record.nomorRekeningBank),
    ayah: {
      ...record.ayah,
      nik: maskSensitiveDigits(record.ayah.nik),
    },
    ibu: {
      ...record.ibu,
      nik: maskSensitiveDigits(record.ibu.nik),
    },
    wali: {
      ...record.wali,
      nik: maskSensitiveDigits(record.wali.nik),
    },
  };
}

function toListItem(record: StudentRecord): StudentListItem {
  return {
    id: record.id,
    nama: record.nama,
    nisn: record.nisn,
    nipd: record.nipd,
    jk: record.jk,
    tempatLahir: record.tempatLahir,
    tanggalLahir: record.tanggalLahir,
    rombelSaatIni: record.rombelSaatIni,
    statusData: record.statusData,
    updatedAt: record.updatedAt,
  };
}

export function createStudentStore(storageDir: string) {
  const studentsFile = path.resolve(storageDir, 'students.json');

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function readAll(): StudentRecord[] {
    ensureDir();
    if (!fs.existsSync(studentsFile)) return [];
    try {
      const raw = fs.readFileSync(studentsFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StudentRecord[]) : [];
    } catch {
      return [];
    }
  }

  function writeAllAtomic(records: StudentRecord[]): void {
    ensureDir();
    const tempPath = `${studentsFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tempPath, studentsFile);
  }

  function getAllRaw(): StudentRecord[] {
    return readAll();
  }

  function listStudents(filters: {
    search?: string;
    rombel?: string;
  }): {
    totalAll: number;
    rombels: string[];
    students: StudentListItem[];
  } {
    const all = readAll();
    const rombelSet = new Set<string>();
    for (const s of all) {
      if (s.rombelSaatIni.trim()) {
        rombelSet.add(s.rombelSaatIni.trim());
      }
    }
    const rombels = Array.from(rombelSet).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );

    const search = (filters.search || '').trim().toLowerCase();
    const rombel = (filters.rombel || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const filtered = all
      .filter((s) => {
        if (
          rombel &&
          s.rombelSaatIni.trim().replace(/\s+/g, ' ').toLowerCase() !== rombel
        ) {
          return false;
        }
        if (!search) return true;
        return (
          s.nama.toLowerCase().includes(search) ||
          s.nisn.toLowerCase().includes(search) ||
          s.nipd.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const rombelCmp = a.rombelSaatIni.localeCompare(b.rombelSaatIni, 'id', {
          numeric: true,
        });
        if (rombelCmp !== 0) return rombelCmp;
        return a.nama.localeCompare(b.nama, 'id');
      })
      .map(toListItem);

    return {
      totalAll: all.length,
      rombels,
      students: filtered,
    };
  }

  function getStudentById(id: string, role: UserRole): StudentRecord {
    const all = readAll();
    const found = all.find((s) => s.id === id);
    if (!found) {
      throw new StudentStoreError(404, 'Data siswa tidak ditemukan.');
    }
    return role === 'OPERATOR' ? found : maskStudentForTeacher(found);
  }

  function validateUniqueIdentifiers(
    all: StudentRecord[],
    payload: StudentInputPayload,
    excludeId?: string
  ): void {
    if (!payload.nama) {
      throw new StudentStoreError(400, 'Nama siswa wajib diisi.');
    }
    if (!payload.nisn && !payload.nipd) {
      throw new StudentStoreError(400, 'Minimal NISN atau NIPD harus diisi.');
    }
    if (
      payload.nisn &&
      all.some((s) => s.id !== excludeId && s.nisn.trim() === payload.nisn)
    ) {
      throw new StudentStoreError(409, 'NISN sudah terdaftar pada siswa lain.');
    }
    if (
      payload.nipd &&
      all.some((s) => s.id !== excludeId && s.nipd.trim() === payload.nipd)
    ) {
      throw new StudentStoreError(409, 'NIPD sudah terdaftar pada siswa lain.');
    }
  }

  function createStudent(input: Partial<StudentInputPayload>): StudentRecord {
    const payload = sanitizeStudentPayload(input);
    const all = readAll();
    validateUniqueIdentifiers(all, payload);

    const nowIso = new Date().toISOString();
    const record: StudentRecord = {
      id: crypto.randomUUID(),
      ...payload,
      statusData: computeStatusData(payload),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    all.push(record);
    writeAllAtomic(all);
    return record;
  }

  function updateStudent(
    id: string,
    input: Partial<StudentInputPayload>
  ): StudentRecord {
    const all = readAll();
    const index = all.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new StudentStoreError(404, 'Data siswa tidak ditemukan.');
    }

    const payload = sanitizeStudentPayload(input);
    validateUniqueIdentifiers(all, payload, id);

    const existing = all[index];
    const updated: StudentRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      statusData: computeStatusData(payload),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    writeAllAtomic(all);
    return updated;
  }

  function deleteStudent(id: string): void {
    const all = readAll();
    const remaining = all.filter((s) => s.id !== id);
    if (remaining.length === all.length) {
      throw new StudentStoreError(404, 'Data siswa tidak ditemukan.');
    }
    writeAllAtomic(remaining);
  }

  function commitDapodikImport(options: {
    rows: ParsedDapodikRowInternal[];
    conflictMode: ImportConflictMode;
    perRowDecisions?: Record<number, RowImportDecision>;
  }): DapodikImportCommitResult {
    const all = readAll();
    const failures: DapodikImportFailure[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Index current students for sequential conflict-safe updates
    const byId = new Map<string, number>();
    const byNisn = new Map<string, number>();
    const byNipd = new Map<string, number>();

    const rebuildIndexes = () => {
      byId.clear();
      byNisn.clear();
      byNipd.clear();
      all.forEach((s, idx) => {
        byId.set(s.id, idx);
        if (s.nisn.trim()) byNisn.set(s.nisn.trim(), idx);
        if (s.nipd.trim()) byNipd.set(s.nipd.trim(), idx);
      });
    };
    rebuildIndexes();

    const decisions = options.perRowDecisions || {};
    const nowIso = new Date().toISOString();

    for (const item of options.rows) {
      const { preview, payload: rawPayload } = item;
      const payload = sanitizeStudentPayload(rawPayload);
      const rowNum = preview.rowNumber;
      const labelName = payload.nama || `Baris ${rowNum}`;

      try {
        const override: RowImportDecision = decisions[rowNum] || 'AUTO';

        if (override === 'SKIP') {
          skippedCount++;
          continue;
        }

        // Duplicate within the same Excel file is never inserted automatically unless explicitly skipped
        if (preview.status === 'DUPLIKAT_FILE' && override === 'AUTO') {
          skippedCount++;
          continue;
        }

        if (!payload.nama) {
          failures.push({
            rowNumber: rowNum,
            nama: labelName,
            reason: 'Nama siswa kosong.',
          });
          continue;
        }

        if (!payload.nisn && !payload.nipd) {
          failures.push({
            rowNumber: rowNum,
            nama: labelName,
            reason: 'NISN dan NIPD keduanya kosong sehingga identitas tidak dapat diverifikasi.',
          });
          continue;
        }

        // Determine live match in current working list
        const nisnIdx = payload.nisn ? byNisn.get(payload.nisn) : undefined;
        const nipdIdx = payload.nipd ? byNipd.get(payload.nipd) : undefined;

        if (
          nisnIdx !== undefined &&
          nipdIdx !== undefined &&
          nisnIdx !== nipdIdx &&
          override === 'AUTO'
        ) {
          failures.push({
            rowNumber: rowNum,
            nama: labelName,
            reason: 'Konflik identitas: NISN dan NIPD cocok dengan dua siswa yang berbeda.',
          });
          continue;
        }

        let targetIdx: number | undefined =
          nisnIdx !== undefined ? nisnIdx : nipdIdx;

        if (
          targetIdx === undefined &&
          preview.matchedStudentId &&
          byId.has(preview.matchedStudentId)
        ) {
          targetIdx = byId.get(preview.matchedStudentId);
        }

        // Handle existing match according to conflictMode / override
        if (targetIdx !== undefined) {
          if (override === 'INSERT') {
            failures.push({
              rowNumber: rowNum,
              nama: labelName,
              reason: 'Tidak dapat menambah sebagai siswa baru karena NISN/NIPD sudah ada.',
            });
            continue;
          }

          const shouldUpdate =
            override === 'UPDATE' || options.conflictMode === 'UPDATE_EXISTING';

          if (!shouldUpdate) {
            // INSERT_NEW_ONLY or SKIP_DUPLICATES skips existing matches
            skippedCount++;
            continue;
          }

          const existing = all[targetIdx];
          // Ensure updating does not collide with another student's NISN/NIPD
          if (
            payload.nisn &&
            byNisn.has(payload.nisn) &&
            byNisn.get(payload.nisn) !== targetIdx
          ) {
            failures.push({
              rowNumber: rowNum,
              nama: labelName,
              reason: 'NISN bertabrakan dengan data siswa lain.',
            });
            continue;
          }
          if (
            payload.nipd &&
            byNipd.has(payload.nipd) &&
            byNipd.get(payload.nipd) !== targetIdx
          ) {
            failures.push({
              rowNumber: rowNum,
              nama: labelName,
              reason: 'NIPD bertabrakan dengan data siswa lain.',
            });
            continue;
          }

          all[targetIdx] = {
            ...existing,
            ...payload,
            id: existing.id,
            statusData: computeStatusData(payload),
            createdAt: existing.createdAt,
            updatedAt: nowIso,
          };
          rebuildIndexes();
          updatedCount++;
          continue;
        }

        // Insert new student
        if (override === 'UPDATE') {
          // Operator requested update even if not matched, insert cleanly if no existing record
        }

        const created: StudentRecord = {
          id: crypto.randomUUID(),
          ...payload,
          statusData: computeStatusData(payload),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        all.push(created);
        rebuildIndexes();
        importedCount++;
      } catch (err) {
        failures.push({
          rowNumber: rowNum,
          nama: labelName,
          reason:
            err instanceof Error
              ? err.message
              : 'Kesalahan tidak terduga saat memproses baris siswa.',
        });
      }
    }

    if (importedCount > 0 || updatedCount > 0) {
      writeAllAtomic(all);
    }

    return {
      totalProcessed: options.rows.length,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount: failures.length,
      failures,
    };
  }

  function restoreRawStudents(records: unknown[]): {
    restored: number;
    updated: number;
  } {
    if (!Array.isArray(records) || records.length === 0) {
      return { restored: 0, updated: 0 };
    }
    const all = readAll();
    const byId = new Map<string, number>();
    all.forEach((s, idx) => byId.set(s.id, idx));

    let restored = 0;
    let updated = 0;

    for (const raw of records) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<StudentRecord>;
      const id = String(item.id ?? '').trim();
      const payload = sanitizeStudentPayload(item);
      if (!id || !payload.nama) continue;

      const nowIso = new Date().toISOString();
      const normalized: StudentRecord = {
        id,
        ...payload,
        statusData: computeStatusData(payload),
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
    restoreRawStudents,
    listStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    commitDapodikImport,
  };
}
