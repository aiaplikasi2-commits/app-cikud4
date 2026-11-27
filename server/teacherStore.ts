import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { TeacherAccount, UserRole } from '../src/types/auth.ts';
import type {
  TeacherDataStatus,
  TeacherForAccountOption,
  TeacherImportCommitResult,
  TeacherImportConflictMode,
  TeacherImportFailure,
  TeacherInputPayload,
  TeacherListItem,
  TeacherRecord,
  TeacherRowImportDecision,
} from '../src/types/teacher.ts';
import type { ParsedTeacherRowInternal } from './teacherExcelParser.ts';

export class TeacherStoreError extends Error {
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

function sanitizeTeacherPayload(
  input: Partial<TeacherInputPayload>
): TeacherInputPayload {
  return {
    no: cleanStr(input.no),
    nama: cleanStr(input.nama),
    nuptk: cleanStr(input.nuptk),
    jk: cleanStr(input.jk).toUpperCase(),
    tempatLahir: cleanStr(input.tempatLahir),
    tanggalLahir: cleanStr(input.tanggalLahir),
    nip: cleanStr(input.nip),
    statusKepegawaian: cleanStr(input.statusKepegawaian),
    jenisPtk: cleanStr(input.jenisPtk),
    agama: cleanStr(input.agama),

    alamatJalan: cleanStr(input.alamatJalan),
    rt: cleanStr(input.rt),
    rw: cleanStr(input.rw),
    namaDusun: cleanStr(input.namaDusun),
    desaKelurahan: cleanStr(input.desaKelurahan),
    kecamatan: cleanStr(input.kecamatan),
    kodePos: cleanStr(input.kodePos),
    telepon: cleanStr(input.telepon),
    hp: cleanStr(input.hp),
    email: cleanStr(input.email),

    tugasTambahan: cleanStr(input.tugasTambahan),
    skCpns: cleanStr(input.skCpns),
    tanggalCpns: cleanStr(input.tanggalCpns),
    skPengangkatan: cleanStr(input.skPengangkatan),
    tmtPengangkatan: cleanStr(input.tmtPengangkatan),
    lembagaPengangkatan: cleanStr(input.lembagaPengangkatan),
    pangkatGolongan: cleanStr(input.pangkatGolongan),
    sumberGaji: cleanStr(input.sumberGaji),
    tmtPns: cleanStr(input.tmtPns),

    namaIbuKandung: cleanStr(input.namaIbuKandung),
    statusPerkawinan: cleanStr(input.statusPerkawinan),
    namaSuamiIstri: cleanStr(input.namaSuamiIstri),
    nipSuamiIstri: cleanStr(input.nipSuamiIstri),
    pekerjaanSuamiIstri: cleanStr(input.pekerjaanSuamiIstri),
    sudahLisensi: cleanStr(input.sudahLisensi),
    kepalaSekolah: cleanStr(input.kepalaSekolah),
    pernahDiklatKepengawasan: cleanStr(input.pernahDiklatKepengawasan),
    keahlianBraille: cleanStr(input.keahlianBraille),
    keahlianBahasaIsyarat: cleanStr(input.keahlianBahasaIsyarat),
    npwp: cleanStr(input.npwp),
    namaWajibPajak: cleanStr(input.namaWajibPajak),
    kewarganegaraan: cleanStr(input.kewarganegaraan),
    bank: cleanStr(input.bank),
    nomorRekeningBank: cleanStr(input.nomorRekeningBank),
    rekeningAtasNama: cleanStr(input.rekeningAtasNama),
    nik: cleanStr(input.nik),
    noKk: cleanStr(input.noKk),
    karpeg: cleanStr(input.karpeg),
    karisKarsu: cleanStr(input.karisKarsu),
    lintang: cleanStr(input.lintang),
    bujur: cleanStr(input.bujur),
    nuks: cleanStr(input.nuks),
    assignedClass: cleanStr(input.assignedClass),
  };
}

function computeStatusData(p: TeacherInputPayload): TeacherDataStatus {
  const hasName = Boolean(p.nama);
  const hasId = Boolean(p.nip || p.nuptk || p.nik);
  const hasGender = p.jk === 'L' || p.jk === 'P';
  const hasPtk = Boolean(p.jenisPtk || p.statusKepegawaian);
  return hasName && hasId && hasGender && hasPtk
    ? 'LENGKAP'
    : 'PERLU_PERIKSA';
}

function maskSensitiveDigits(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••';
  return `${trimmed.slice(0, 4)}${'•'.repeat(
    Math.max(4, trimmed.length - 8)
  )}${trimmed.slice(-4)}`;
}

function hasMaskBullet(val: string): boolean {
  return val.includes('•');
}

function preserveMaskedTeacherFields(
  existing: TeacherRecord,
  payload: TeacherInputPayload
): TeacherInputPayload {
  return {
    ...payload,
    nik: hasMaskBullet(payload.nik) ? existing.nik : payload.nik,
    noKk: hasMaskBullet(payload.noKk) ? existing.noKk : payload.noKk,
    npwp: hasMaskBullet(payload.npwp) ? existing.npwp : payload.npwp,
    nomorRekeningBank: hasMaskBullet(payload.nomorRekeningBank)
      ? existing.nomorRekeningBank
      : payload.nomorRekeningBank,
    nipSuamiIstri: hasMaskBullet(payload.nipSuamiIstri)
      ? existing.nipSuamiIstri
      : payload.nipSuamiIstri,
    karpeg: hasMaskBullet(payload.karpeg) ? existing.karpeg : payload.karpeg,
    karisKarsu: hasMaskBullet(payload.karisKarsu)
      ? existing.karisKarsu
      : payload.karisKarsu,
  };
}

function diffTeacherFields(
  existing: TeacherRecord,
  next: TeacherInputPayload
): string[] {
  const changed: string[] = [];
  const check = (label: string, prevVal: string, nextVal: string) => {
    if (cleanStr(prevVal) !== cleanStr(nextVal)) {
      changed.push(label);
    }
  };

  check('Nama Lengkap', existing.nama, next.nama);
  check('NUPTK', existing.nuptk, next.nuptk);
  check('Jenis Kelamin', existing.jk, next.jk);
  check('Tempat Lahir', existing.tempatLahir, next.tempatLahir);
  check('Tanggal Lahir', existing.tanggalLahir, next.tanggalLahir);
  check('NIP', existing.nip, next.nip);
  check('Agama', existing.agama, next.agama);
  check('Alamat Jalan', existing.alamatJalan, next.alamatJalan);
  check('RT', existing.rt, next.rt);
  check('RW', existing.rw, next.rw);
  check('Dusun', existing.namaDusun, next.namaDusun);
  check('Desa/Kelurahan', existing.desaKelurahan, next.desaKelurahan);
  check('Kecamatan', existing.kecamatan, next.kecamatan);
  check('Kode Pos', existing.kodePos, next.kodePos);
  check('Telepon', existing.telepon, next.telepon);
  check('No. HP', existing.hp, next.hp);
  check('Email', existing.email, next.email);
  check('Nama Ibu Kandung', existing.namaIbuKandung, next.namaIbuKandung);
  check('Status Perkawinan', existing.statusPerkawinan, next.statusPerkawinan);
  check('Nama Suami/Istri', existing.namaSuamiIstri, next.namaSuamiIstri);
  check('NIP Suami/Istri', existing.nipSuamiIstri, next.nipSuamiIstri);
  check('Pekerjaan Suami/Istri', existing.pekerjaanSuamiIstri, next.pekerjaanSuamiIstri);
  check('NPWP', existing.npwp, next.npwp);
  check('Nama Wajib Pajak', existing.namaWajibPajak, next.namaWajibPajak);
  check('Kewarganegaraan', existing.kewarganegaraan, next.kewarganegaraan);
  check('Bank', existing.bank, next.bank);
  check('Nomor Rekening', existing.nomorRekeningBank, next.nomorRekeningBank);
  check('Rekening Atas Nama', existing.rekeningAtasNama, next.rekeningAtasNama);
  check('NIK', existing.nik, next.nik);
  check('No. KK', existing.noKk, next.noKk);
  check('Karpeg', existing.karpeg, next.karpeg);
  check('Karis/Karsu', existing.karisKarsu, next.karisKarsu);
  check('Lintang', existing.lintang, next.lintang);
  check('Bujur', existing.bujur, next.bujur);

  return changed;
}

function maskTeacherForNonOperator(record: TeacherRecord): TeacherRecord {
  return {
    ...record,
    nik: maskSensitiveDigits(record.nik),
    noKk: maskSensitiveDigits(record.noKk),
    npwp: maskSensitiveDigits(record.npwp),
    nomorRekeningBank: maskSensitiveDigits(record.nomorRekeningBank),
    nipSuamiIstri: maskSensitiveDigits(record.nipSuamiIstri),
    karpeg: maskSensitiveDigits(record.karpeg),
    karisKarsu: maskSensitiveDigits(record.karisKarsu),
  };
}

function resolveLinkedAccount(
  teacher: TeacherRecord,
  accounts: TeacherAccount[]
): TeacherAccount | null {
  if (teacher.linkedAccountId) {
    const byExplicit = accounts.find((a) => a.id === teacher.linkedAccountId);
    if (byExplicit) return byExplicit;
  }
  const byRecordRef = accounts.find((a) => a.teacherRecordId === teacher.id);
  if (byRecordRef) return byRecordRef;

  const trimmedNip = teacher.nip.trim();
  if (trimmedNip) {
    const byNip = accounts.find((a) => a.nip.trim() === trimmedNip);
    if (byNip) return byNip;
  }
  return null;
}

export function createTeacherStore(storageDir: string) {
  const teachersFile = path.resolve(storageDir, 'teachers.json');

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function readAll(): TeacherRecord[] {
    ensureDir();
    if (!fs.existsSync(teachersFile)) return [];
    try {
      const raw = fs.readFileSync(teachersFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TeacherRecord[]) : [];
    } catch {
      return [];
    }
  }

  function writeAllAtomic(records: TeacherRecord[]): void {
    ensureDir();
    const tempPath = `${teachersFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tempPath, teachersFile);
  }

  function getAllRaw(): TeacherRecord[] {
    return readAll();
  }

  function listTeachers(
    filters: {
      search?: string;
      statusKepegawaian?: string;
      jenisPtk?: string;
    },
    accounts: TeacherAccount[]
  ): {
    totalAll: number;
    employmentStatuses: string[];
    ptkTypes: string[];
    teachers: TeacherListItem[];
  } {
    const all = readAll();

    const statusSet = new Set<string>();
    const ptkSet = new Set<string>();
    for (const t of all) {
      if (t.statusKepegawaian.trim()) statusSet.add(t.statusKepegawaian.trim());
      if (t.jenisPtk.trim()) ptkSet.add(t.jenisPtk.trim());
    }

    const search = (filters.search || '').trim().toLowerCase();
    const statusFilter = (filters.statusKepegawaian || '').trim();
    const ptkFilter = (filters.jenisPtk || '').trim();

    const filtered = all
      .filter((t) => {
        if (statusFilter && t.statusKepegawaian.trim() !== statusFilter) {
          return false;
        }
        if (ptkFilter && t.jenisPtk.trim() !== ptkFilter) {
          return false;
        }
        if (!search) return true;
        return (
          t.nama.toLowerCase().includes(search) ||
          t.nip.toLowerCase().includes(search) ||
          t.nuptk.toLowerCase().includes(search) ||
          t.email.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((t): TeacherListItem => {
        const linked = resolveLinkedAccount(t, accounts);
        return {
          id: t.id,
          no: t.no,
          nama: t.nama,
          nip: t.nip,
          nuptk: t.nuptk,
          jk: t.jk,
          tempatLahir: t.tempatLahir,
          tanggalLahir: t.tanggalLahir,
          statusKepegawaian: t.statusKepegawaian,
          jenisPtk: t.jenisPtk,
          email: t.email,
          hp: t.hp,
          tugasTambahan: t.tugasTambahan,
          statusData: t.statusData,
          assignedClass: cleanStr(t.assignedClass) || cleanStr(linked?.assignedClass),
          linkedAccountId: linked ? linked.id : t.linkedAccountId || null,
          linkedAccountUsername: linked ? linked.username : null,
          linkedAccountStatus: linked ? linked.status : null,
          updatedAt: t.updatedAt,
        };
      });

    return {
      totalAll: all.length,
      employmentStatuses: Array.from(statusSet).sort((a, b) => a.localeCompare(b, 'id')),
      ptkTypes: Array.from(ptkSet).sort((a, b) => a.localeCompare(b, 'id')),
      teachers: filtered,
    };
  }

  function listForAccountCreation(
    accounts: TeacherAccount[]
  ): TeacherForAccountOption[] {
    const all = readAll();
    return all
      .slice()
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((t) => {
        const linked = resolveLinkedAccount(t, accounts);
        return {
          id: t.id,
          nama: t.nama,
          nip: t.nip,
          nik: t.nik,
          email: t.email,
          jenisPtk: t.jenisPtk,
          statusKepegawaian: t.statusKepegawaian,
          assignedClass: cleanStr(t.assignedClass) || cleanStr(linked?.assignedClass),
          alreadyHasAccount: Boolean(linked),
          linkedUsername: linked ? linked.username : null,
        };
      });
  }

  function getTeacherById(
    id: string,
    role: UserRole,
    accounts: TeacherAccount[]
  ): TeacherRecord {
    const all = readAll();
    const found = all.find((t) => t.id === id);
    if (!found) {
      throw new TeacherStoreError(404, 'Data guru tidak ditemukan.');
    }
    const linked = resolveLinkedAccount(found, accounts);
    const enriched: TeacherRecord = {
      ...found,
      assignedClass: cleanStr(found.assignedClass) || cleanStr(linked?.assignedClass),
      linkedAccountId: linked ? linked.id : found.linkedAccountId || null,
      linkedAccountUsername: linked ? linked.username : null,
      linkedAccountStatus: linked ? linked.status : null,
    };
    return role === 'OPERATOR' ? enriched : maskTeacherForNonOperator(enriched);
  }

  function validateUniqueIdentifiers(
    all: TeacherRecord[],
    payload: TeacherInputPayload,
    excludeId?: string
  ): void {
    if (!payload.nama) {
      throw new TeacherStoreError(400, 'Nama guru wajib diisi.');
    }
    if (
      payload.nip &&
      all.some((t) => t.id !== excludeId && t.nip.trim() === payload.nip)
    ) {
      throw new TeacherStoreError(409, 'NIP sudah terdaftar pada data guru lain.');
    }
    if (
      payload.nuptk &&
      all.some((t) => t.id !== excludeId && t.nuptk.trim() === payload.nuptk)
    ) {
      throw new TeacherStoreError(409, 'NUPTK sudah terdaftar pada data guru lain.');
    }
  }

  function createTeacher(input: Partial<TeacherInputPayload>): TeacherRecord {
    const payload = sanitizeTeacherPayload(input);
    const all = readAll();
    validateUniqueIdentifiers(all, payload);

    const nowIso = new Date().toISOString();
    const record: TeacherRecord = {
      id: crypto.randomUUID(),
      ...payload,
      statusData: computeStatusData(payload),
      linkedAccountId: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    all.push(record);
    writeAllAtomic(all);
    return record;
  }

  function updateTeacher(
    id: string,
    input: Partial<TeacherInputPayload>
  ): TeacherRecord {
    const all = readAll();
    const index = all.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new TeacherStoreError(404, 'Data guru tidak ditemukan.');
    }

    const payload = sanitizeTeacherPayload(input);
    validateUniqueIdentifiers(all, payload, id);

    const existing = all[index];
    const updated: TeacherRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      linkedAccountId: existing.linkedAccountId ?? null,
      statusData: computeStatusData(payload),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    writeAllAtomic(all);
    return updated;
  }

  function updateTeacherSelfProfile(
    teacherId: string,
    input: Partial<TeacherInputPayload>
  ): {
    teacher: TeacherRecord;
    rawUpdated: TeacherRecord;
    changedFields: string[];
  } {
    const all = readAll();
    const index = all.findIndex((t) => t.id === teacherId);
    if (index === -1) {
      throw new TeacherStoreError(404, 'Data profil guru tidak ditemukan.');
    }

    const existing = all[index];
    const mergedRaw: Partial<TeacherInputPayload> = {
      ...existing,
      ...(input.nama !== undefined ? { nama: input.nama } : {}),
      ...(input.nuptk !== undefined ? { nuptk: input.nuptk } : {}),
      ...(input.jk !== undefined ? { jk: input.jk } : {}),
      ...(input.tempatLahir !== undefined ? { tempatLahir: input.tempatLahir } : {}),
      ...(input.tanggalLahir !== undefined ? { tanggalLahir: input.tanggalLahir } : {}),
      ...(input.nip !== undefined ? { nip: input.nip } : {}),
      ...(input.agama !== undefined ? { agama: input.agama } : {}),
      ...(input.alamatJalan !== undefined ? { alamatJalan: input.alamatJalan } : {}),
      ...(input.rt !== undefined ? { rt: input.rt } : {}),
      ...(input.rw !== undefined ? { rw: input.rw } : {}),
      ...(input.namaDusun !== undefined ? { namaDusun: input.namaDusun } : {}),
      ...(input.desaKelurahan !== undefined ? { desaKelurahan: input.desaKelurahan } : {}),
      ...(input.kecamatan !== undefined ? { kecamatan: input.kecamatan } : {}),
      ...(input.kodePos !== undefined ? { kodePos: input.kodePos } : {}),
      ...(input.telepon !== undefined ? { telepon: input.telepon } : {}),
      ...(input.hp !== undefined ? { hp: input.hp } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.namaIbuKandung !== undefined ? { namaIbuKandung: input.namaIbuKandung } : {}),
      ...(input.statusPerkawinan !== undefined ? { statusPerkawinan: input.statusPerkawinan } : {}),
      ...(input.namaSuamiIstri !== undefined ? { namaSuamiIstri: input.namaSuamiIstri } : {}),
      ...(input.nipSuamiIstri !== undefined ? { nipSuamiIstri: input.nipSuamiIstri } : {}),
      ...(input.pekerjaanSuamiIstri !== undefined ? { pekerjaanSuamiIstri: input.pekerjaanSuamiIstri } : {}),
      ...(input.npwp !== undefined ? { npwp: input.npwp } : {}),
      ...(input.namaWajibPajak !== undefined ? { namaWajibPajak: input.namaWajibPajak } : {}),
      ...(input.kewarganegaraan !== undefined ? { kewarganegaraan: input.kewarganegaraan } : {}),
      ...(input.bank !== undefined ? { bank: input.bank } : {}),
      ...(input.nomorRekeningBank !== undefined ? { nomorRekeningBank: input.nomorRekeningBank } : {}),
      ...(input.rekeningAtasNama !== undefined ? { rekeningAtasNama: input.rekeningAtasNama } : {}),
      ...(input.nik !== undefined ? { nik: input.nik } : {}),
      ...(input.noKk !== undefined ? { noKk: input.noKk } : {}),
      ...(input.karpeg !== undefined ? { karpeg: input.karpeg } : {}),
      ...(input.karisKarsu !== undefined ? { karisKarsu: input.karisKarsu } : {}),
      ...(input.lintang !== undefined ? { lintang: input.lintang } : {}),
      ...(input.bujur !== undefined ? { bujur: input.bujur } : {}),
      // Lock administrative fields against self-edit
      no: existing.no,
      statusKepegawaian: existing.statusKepegawaian,
      jenisPtk: existing.jenisPtk,
      tugasTambahan: existing.tugasTambahan,
      skCpns: existing.skCpns,
      tanggalCpns: existing.tanggalCpns,
      skPengangkatan: existing.skPengangkatan,
      tmtPengangkatan: existing.tmtPengangkatan,
      lembagaPengangkatan: existing.lembagaPengangkatan,
      pangkatGolongan: existing.pangkatGolongan,
      sumberGaji: existing.sumberGaji,
      tmtPns: existing.tmtPns,
      sudahLisensi: existing.sudahLisensi,
      kepalaSekolah: existing.kepalaSekolah,
      pernahDiklatKepengawasan: existing.pernahDiklatKepengawasan,
      keahlianBraille: existing.keahlianBraille,
      keahlianBahasaIsyarat: existing.keahlianBahasaIsyarat,
      nuks: existing.nuks,
      assignedClass: existing.assignedClass,
    };

    const sanitized = sanitizeTeacherPayload(mergedRaw);
    const payload = preserveMaskedTeacherFields(existing, sanitized);
    validateUniqueIdentifiers(all, payload, teacherId);

    const changedFields = diffTeacherFields(existing, payload);
    const updated: TeacherRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      linkedAccountId: existing.linkedAccountId ?? null,
      assignedClass: existing.assignedClass ?? '',
      statusData: computeStatusData(payload),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    writeAllAtomic(all);
    return {
      teacher: maskTeacherForNonOperator(updated),
      rawUpdated: updated,
      changedFields,
    };
  }

  function deleteTeacher(id: string): void {
    const all = readAll();
    const remaining = all.filter((t) => t.id !== id);
    if (remaining.length === all.length) {
      throw new TeacherStoreError(404, 'Data guru tidak ditemukan.');
    }
    writeAllAtomic(remaining);
  }

  function setLinkedAccountId(
    teacherId: string,
    account: TeacherAccount | null
  ): TeacherRecord {
    const all = readAll();
    const index = all.findIndex((t) => t.id === teacherId);
    if (index === -1) {
      throw new TeacherStoreError(404, 'Data guru tidak ditemukan.');
    }

    const teacher = all[index];
    if (account) {
      const tNip = teacher.nip.trim();
      const aNip = account.nip.trim();
      if (tNip && aNip && tNip !== aNip) {
        throw new TeacherStoreError(
          400,
          'NIP pada data induk guru tidak cocok dengan NIP pada akun login guru tersebut.'
        );
      }
      if (!tNip && aNip) {
        throw new TeacherStoreError(
          400,
          'Data induk guru belum memiliki NIP sehingga tidak sesuai dengan NIP akun login.'
        );
      }
    }

    const updated: TeacherRecord = {
      ...teacher,
      linkedAccountId: account ? account.id : null,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    writeAllAtomic(all);
    return updated;
  }

  function setLinkedAccountIdsBatch(
    links: Array<{ teacherId: string; accountId: string }>
  ): void {
    if (links.length === 0) return;
    const all = readAll();
    const byId = new Map<string, number>();
    all.forEach((t, idx) => byId.set(t.id, idx));

    const nowIso = new Date().toISOString();
    let changed = false;
    for (const link of links) {
      const idx = byId.get(link.teacherId);
      if (idx === undefined) continue;
      all[idx] = {
        ...all[idx],
        linkedAccountId: link.accountId,
        updatedAt: nowIso,
      };
      changed = true;
    }

    if (changed) {
      writeAllAtomic(all);
    }
  }

  function setAssignedClass(
    teacherId: string,
    assignedClass: string
  ): TeacherRecord {
    const all = readAll();
    const index = all.findIndex((t) => t.id === teacherId);
    if (index === -1) {
      throw new TeacherStoreError(404, 'Data guru tidak ditemukan.');
    }
    const updated: TeacherRecord = {
      ...all[index],
      assignedClass: cleanStr(assignedClass),
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    writeAllAtomic(all);
    return updated;
  }

  function commitTeacherImport(options: {
    rows: ParsedTeacherRowInternal[];
    conflictMode: TeacherImportConflictMode;
    perRowDecisions?: Record<number, TeacherRowImportDecision>;
  }): TeacherImportCommitResult {
    const all = readAll();
    const failures: TeacherImportFailure[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const byId = new Map<string, number>();
    const byNip = new Map<string, number>();
    const byNuptk = new Map<string, number>();

    const rebuildIndexes = () => {
      byId.clear();
      byNip.clear();
      byNuptk.clear();
      all.forEach((t, idx) => {
        byId.set(t.id, idx);
        if (t.nip.trim()) byNip.set(t.nip.trim(), idx);
        if (t.nuptk.trim()) byNuptk.set(t.nuptk.trim(), idx);
      });
    };
    rebuildIndexes();

    const decisions = options.perRowDecisions || {};
    const nowIso = new Date().toISOString();

    for (const item of options.rows) {
      const { preview, payload: rawPayload } = item;
      const payload = sanitizeTeacherPayload(rawPayload);
      const rowNum = preview.rowNumber;
      const labelName = payload.nama || `Baris ${rowNum}`;

      try {
        const override: TeacherRowImportDecision = decisions[rowNum] || 'AUTO';

        if (override === 'SKIP') {
          skippedCount++;
          continue;
        }

        if (preview.status === 'DUPLIKAT_FILE' && override === 'AUTO') {
          skippedCount++;
          continue;
        }

        if (!payload.nama) {
          failures.push({
            rowNumber: rowNum,
            nama: labelName,
            nip: payload.nip,
            nuptk: payload.nuptk,
            reason: 'Nama guru kosong.',
          });
          continue;
        }

        const nipIdx = payload.nip ? byNip.get(payload.nip) : undefined;
        const nuptkIdx = payload.nuptk ? byNuptk.get(payload.nuptk) : undefined;

        if (
          nipIdx !== undefined &&
          nuptkIdx !== undefined &&
          nipIdx !== nuptkIdx &&
          override === 'AUTO'
        ) {
          failures.push({
            rowNumber: rowNum,
            nama: labelName,
            nip: payload.nip,
            nuptk: payload.nuptk,
            reason:
              'Konflik identitas: NIP dan NUPTK cocok dengan dua data guru berbeda di database.',
          });
          continue;
        }

        let targetIdx: number | undefined =
          nipIdx !== undefined ? nipIdx : nuptkIdx;

        if (
          targetIdx === undefined &&
          preview.matchedTeacherId &&
          byId.has(preview.matchedTeacherId)
        ) {
          targetIdx = byId.get(preview.matchedTeacherId);
        }

        if (targetIdx !== undefined) {
          if (override === 'INSERT') {
            failures.push({
              rowNumber: rowNum,
              nama: labelName,
              nip: payload.nip,
              nuptk: payload.nuptk,
              reason:
                'Tidak dapat menambah baru karena NIP atau NUPTK sudah terdaftar.',
            });
            continue;
          }

          const shouldUpdate =
            override === 'UPDATE' || options.conflictMode === 'UPDATE_EXISTING';

          if (!shouldUpdate) {
            // SKIP_EXISTING or INSERT_NEW_ONLY preserves existing records untouched
            skippedCount++;
            continue;
          }

          const existing = all[targetIdx];
          if (
            payload.nip &&
            byNip.has(payload.nip) &&
            byNip.get(payload.nip) !== targetIdx
          ) {
            failures.push({
              rowNumber: rowNum,
              nama: labelName,
              nip: payload.nip,
              nuptk: payload.nuptk,
              reason: 'NIP bertabrakan dengan data guru lain.',
            });
            continue;
          }
          if (
            payload.nuptk &&
            byNuptk.has(payload.nuptk) &&
            byNuptk.get(payload.nuptk) !== targetIdx
          ) {
            failures.push({
              rowNumber: rowNum,
              nama: labelName,
              nip: payload.nip,
              nuptk: payload.nuptk,
              reason: 'NUPTK bertabrakan dengan data guru lain.',
            });
            continue;
          }

          all[targetIdx] = {
            ...existing,
            ...payload,
            id: existing.id,
            assignedClass: cleanStr(existing.assignedClass) || payload.assignedClass || '',
            linkedAccountId: existing.linkedAccountId ?? null,
            statusData: computeStatusData(payload),
            createdAt: existing.createdAt,
            updatedAt: nowIso,
          };
          rebuildIndexes();
          updatedCount++;
          continue;
        }

        const created: TeacherRecord = {
          id: crypto.randomUUID(),
          ...payload,
          linkedAccountId: null,
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
          nip: payload.nip,
          nuptk: payload.nuptk,
          reason:
            err instanceof Error
              ? err.message
              : 'Kesalahan tidak terduga saat menyimpan data guru.',
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

  function restoreRawTeachers(records: unknown[]): {
    restored: number;
    updated: number;
  } {
    if (!Array.isArray(records) || records.length === 0) {
      return { restored: 0, updated: 0 };
    }
    const all = readAll();
    const byId = new Map<string, number>();
    all.forEach((t, idx) => byId.set(t.id, idx));

    let restored = 0;
    let updated = 0;

    for (const raw of records) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<TeacherRecord>;
      const id = String(item.id ?? '').trim();
      const payload = sanitizeTeacherPayload(item);
      if (!id || !payload.nama) continue;

      const nowIso = new Date().toISOString();
      const normalized: TeacherRecord = {
        id,
        ...payload,
        linkedAccountId:
          typeof item.linkedAccountId === 'string' &&
          item.linkedAccountId.trim()
            ? item.linkedAccountId.trim()
            : null,
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
    restoreRawTeachers,
    listTeachers,
    listForAccountCreation,
    getTeacherById,
    createTeacher,
    updateTeacher,
    updateTeacherSelfProfile,
    deleteTeacher,
    setLinkedAccountId,
    setLinkedAccountIdsBatch,
    setAssignedClass,
    commitTeacherImport,
  };
}
