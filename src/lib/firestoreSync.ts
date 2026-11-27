import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { StoredUserRecord } from '../../server/authStore';
import type { SchoolFileSlot, SchoolSettings } from '../types/settings';
import type { ParentGuardianInfo, StudentRecord } from '../types/student';
import type { TeacherRecord } from '../types/teacher';
import type { LetterRecord } from '../types/letter';
import type {
  AttendanceSheetRecord,
  AttendanceStatus,
  AttendanceStorePayload,
  AttendanceStudentEntry,
  ClassHomeroomAssignment,
} from '../types/attendance';
import {
  DEFAULT_AGENDA_CATEGORIES,
  type AgendaConfig,
  type AgendaRecord,
  type AgendaStatus,
  type AgendaStoreSnapshot,
  type AgendaVisibility,
} from '../types/agenda';
import type {
  AdminNotificationRecord,
  AdminNotificationStoreSnapshot,
  AdminNotificationType,
} from '../types/notification';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { resolveApiUrl } from './authApi';

const SCHOOL_ID = 'main';
const SCHOOL_DOC_PATH = `schools/${SCHOOL_ID}`;
const ASSETS_COL_PATH = `schools/${SCHOOL_ID}/assets`;
const ACCOUNTS_COL_PATH = `schools/${SCHOOL_ID}/accounts`;
const STUDENTS_COL_PATH = `schools/${SCHOOL_ID}/students`;
const TEACHERS_COL_PATH = `schools/${SCHOOL_ID}/teachers`;
const LETTERS_COL_PATH = `schools/${SCHOOL_ID}/letters`;
const ATTENDANCE_COL_PATH = `schools/${SCHOOL_ID}/attendance`;
const AGENDAS_COL_PATH = `schools/${SCHOOL_ID}/agendas`;
const NOTIFICATIONS_COL_PATH = `schools/${SCHOOL_ID}/notifications`;
const HOMEROOM_DOC_ID = 'homeroom_assignments';
const AGENDA_CONFIG_DOC_ID = 'agenda_config';

export interface CloudAssetPayload {
  slot: SchoolFileSlot;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface ServerSyncSnapshot {
  settings: SchoolSettings;
  assets: CloudAssetPayload[];
  accounts: StoredUserRecord[];
  students: StudentRecord[];
  teachers: TeacherRecord[];
  letters: LetterRecord[];
  attendance?: AttendanceStorePayload;
  agendas?: AgendaStoreSnapshot;
  notifications?: AdminNotificationStoreSnapshot;
}

export interface CloudSyncSummary {
  restoredFromCloud: {
    hasData: boolean;
    accounts: number;
    students: number;
    teachers: number;
    letters: number;
    attendance: number;
    agendas: number;
    notifications: number;
    assets: number;
    settingsUpdated: boolean;
  };
  pushedToCloud: {
    accounts: number;
    students: number;
    teachers: number;
    letters: number;
    attendance: number;
    agendas: number;
    notifications: number;
    assets: number;
  };
}

function cut(val: unknown, maxLen: number): string {
  return String(val ?? '').slice(0, maxLen);
}

function cleanParent(p: Partial<ParentGuardianInfo> | undefined): ParentGuardianInfo {
  return {
    nama: cut(p?.nama, 150),
    tahunLahir: cut(p?.tahunLahir, 20),
    jenjangPendidikan: cut(p?.jenjangPendidikan, 80),
    pekerjaan: cut(p?.pekerjaan, 100),
    penghasilan: cut(p?.penghasilan, 100),
    nik: cut(p?.nik, 40),
  };
}

function getAuthenticatedCloudUid(): string | null {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return null;
  return user.uid;
}

function buildSchoolPayload(
  settings: SchoolSettings,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    schoolName: cut(settings.identity?.schoolName, 200),
    city: cut(settings.identity?.city, 120),
    department: cut(settings.identity?.department, 200),
    academicYear: cut(settings.identity?.academicYear, 40),
    principalName: cut(settings.principal?.name, 150),
    principalPosition: cut(settings.principal?.position, 150),
    principalNip: cut(settings.principal?.nip, 40),
    operatorName: cut(settings.operator?.name, 150),
    operatorPosition: cut(settings.operator?.position, 150),
    operatorNip: cut(settings.operator?.nip, 40),
    logoUrl: cut(settings.files?.logo?.url, 500),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildAssetPayload(
  asset: CloudAssetPayload,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    slot: asset.slot,
    filename: cut(asset.filename, 200),
    originalName: cut(asset.originalName, 200),
    mimeType: cut(asset.mimeType, 60),
    size: Math.max(0, Math.min(10485760, Number(asset.size) || 0)),
    dataUrl: cut(asset.dataUrl, 950000),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildAccountPayload(
  account: StoredUserRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    id: cut(account.id, 128),
    fullName: cut(account.fullName, 150) || 'Pengguna',
    nip: cut(account.nip, 40),
    username: cut(account.username, 60) || 'user',
    email: cut(account.email, 150),
    role: account.role === 'OPERATOR' ? 'OPERATOR' : 'GURU',
    status: account.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    mustChangePassword: Boolean(account.mustChangePassword),
    teacherRecordId: cut(account.teacherRecordId, 128),
    assignedClass: cut(account.assignedClass, 80),
    passwordSalt: cut(account.passwordSalt, 128),
    passwordHash: cut(account.passwordHash, 256),
    deactivatedAt: cut(account.deactivatedAt, 64),
    clientCreatedAt: cut(account.createdAt, 64),
    clientUpdatedAt: cut(account.updatedAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildStudentPayload(
  s: StudentRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    id: cut(s.id, 128),
    no: cut(s.no, 20),
    nama: cut(s.nama, 200) || 'Siswa',
    nipd: cut(s.nipd, 40),
    jk: cut(s.jk, 10),
    nisn: cut(s.nisn, 40),
    tempatLahir: cut(s.tempatLahir, 120),
    tanggalLahir: cut(s.tanggalLahir, 40),
    rombelSaatIni: cut(s.rombelSaatIni, 80),
    statusData: s.statusData === 'LENGKAP' ? 'LENGKAP' : 'PERLU_PERIKSA',
    details: {
      nik: cut(s.nik, 40),
      agama: cut(s.agama, 50),
      noRegistrasiAktaLahir: cut(s.noRegistrasiAktaLahir, 80),
      noKk: cut(s.noKk, 40),
      kebutuhanKhusus: cut(s.kebutuhanKhusus, 120),
      anakKeBerapa: cut(s.anakKeBerapa, 20),
      jmlSaudaraKandung: cut(s.jmlSaudaraKandung, 20),
      alamat: cut(s.alamat, 250),
      rt: cut(s.rt, 16),
      rw: cut(s.rw, 16),
      dusun: cut(s.dusun, 120),
      kelurahan: cut(s.kelurahan, 120),
      kecamatan: cut(s.kecamatan, 120),
      kodePos: cut(s.kodePos, 20),
      jenisTinggal: cut(s.jenisTinggal, 80),
      alatTransportasi: cut(s.alatTransportasi, 80),
      telepon: cut(s.telepon, 40),
      hp: cut(s.hp, 40),
      email: cut(s.email, 150),
      lintang: cut(s.lintang, 40),
      bujur: cut(s.bujur, 40),
      jarakRumahKeSekolahKm: cut(s.jarakRumahKeSekolahKm, 30),
      ayah: cleanParent(s.ayah),
      ibu: cleanParent(s.ibu),
      wali: cleanParent(s.wali),
      sekolahAsal: cut(s.sekolahAsal, 150),
      skhun: cut(s.skhun, 80),
      noPesertaUjianNasional: cut(s.noPesertaUjianNasional, 80),
      noSeriIjazah: cut(s.noSeriIjazah, 80),
      penerimaKps: cut(s.penerimaKps, 20),
      noKps: cut(s.noKps, 60),
      penerimaKip: cut(s.penerimaKip, 20),
      nomorKip: cut(s.nomorKip, 60),
      namaDiKip: cut(s.namaDiKip, 150),
      nomorKks: cut(s.nomorKks, 60),
      bank: cut(s.bank, 80),
      nomorRekeningBank: cut(s.nomorRekeningBank, 60),
      rekeningAtasNama: cut(s.rekeningAtasNama, 150),
      layakPip: cut(s.layakPip, 20),
      alasanLayakPip: cut(s.alasanLayakPip, 200),
      beratBadan: cut(s.beratBadan, 20),
      tinggiBadan: cut(s.tinggiBadan, 20),
      lingkarKepala: cut(s.lingkarKepala, 20),
    },
    clientCreatedAt: cut(s.createdAt, 64),
    clientUpdatedAt: cut(s.updatedAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildTeacherPayload(
  t: TeacherRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    id: cut(t.id, 128),
    no: cut(t.no, 20),
    nama: cut(t.nama, 200) || 'Guru',
    nip: cut(t.nip, 40),
    nuptk: cut(t.nuptk, 40),
    jk: cut(t.jk, 10),
    tempatLahir: cut(t.tempatLahir, 120),
    tanggalLahir: cut(t.tanggalLahir, 40),
    statusKepegawaian: cut(t.statusKepegawaian, 100),
    jenisPtk: cut(t.jenisPtk, 100),
    email: cut(t.email, 150),
    statusData: t.statusData === 'LENGKAP' ? 'LENGKAP' : 'PERLU_PERIKSA',
    linkedAccountId: cut(t.linkedAccountId, 128),
    assignedClass: cut(t.assignedClass, 80),
    details: {
      agama: cut(t.agama, 50),
      alamatJalan: cut(t.alamatJalan, 250),
      rt: cut(t.rt, 16),
      rw: cut(t.rw, 16),
      namaDusun: cut(t.namaDusun, 120),
      desaKelurahan: cut(t.desaKelurahan, 120),
      kecamatan: cut(t.kecamatan, 120),
      kodePos: cut(t.kodePos, 20),
      telepon: cut(t.telepon, 40),
      hp: cut(t.hp, 40),
      tugasTambahan: cut(t.tugasTambahan, 120),
      skCpns: cut(t.skCpns, 100),
      tanggalCpns: cut(t.tanggalCpns, 40),
      skPengangkatan: cut(t.skPengangkatan, 100),
      tmtPengangkatan: cut(t.tmtPengangkatan, 40),
      lembagaPengangkatan: cut(t.lembagaPengangkatan, 120),
      pangkatGolongan: cut(t.pangkatGolongan, 60),
      sumberGaji: cut(t.sumberGaji, 80),
      tmtPns: cut(t.tmtPns, 40),
      namaIbuKandung: cut(t.namaIbuKandung, 150),
      statusPerkawinan: cut(t.statusPerkawinan, 40),
      namaSuamiIstri: cut(t.namaSuamiIstri, 150),
      nipSuamiIstri: cut(t.nipSuamiIstri, 40),
      pekerjaanSuamiIstri: cut(t.pekerjaanSuamiIstri, 100),
      sudahLisensi: cut(t.sudahLisensi, 20),
      kepalaSekolah: cut(t.kepalaSekolah, 20),
      pernahDiklatKepengawasan: cut(t.pernahDiklatKepengawasan, 20),
      keahlianBraille: cut(t.keahlianBraille, 20),
      keahlianBahasaIsyarat: cut(t.keahlianBahasaIsyarat, 20),
      npwp: cut(t.npwp, 40),
      namaWajibPajak: cut(t.namaWajibPajak, 150),
      kewarganegaraan: cut(t.kewarganegaraan, 60),
      bank: cut(t.bank, 80),
      nomorRekeningBank: cut(t.nomorRekeningBank, 60),
      rekeningAtasNama: cut(t.rekeningAtasNama, 150),
      nik: cut(t.nik, 40),
      noKk: cut(t.noKk, 40),
      karpeg: cut(t.karpeg, 60),
      karisKarsu: cut(t.karisKarsu, 60),
      lintang: cut(t.lintang, 40),
      bujur: cut(t.bujur, 40),
      nuks: cut(t.nuks, 60),
    },
    clientCreatedAt: cut(t.createdAt, 64),
    clientUpdatedAt: cut(t.updatedAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildLetterPayload(
  l: LetterRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  const d = l.data;
  const letterType =
    l.type === 'SUKET_PINDAH_SEKOLAH'
      ? 'SUKET_PINDAH_SEKOLAH'
      : l.type === 'SURAT_LAIN_LAIN'
        ? 'SURAT_LAIN_LAIN'
        : 'SUKET_SISWA_DITERIMA';
  const defaultTitle =
    letterType === 'SUKET_PINDAH_SEKOLAH'
      ? 'Surat Keterangan Pindah Sekolah'
      : letterType === 'SURAT_LAIN_LAIN'
        ? cut(d?.customTitle, 150) || 'Surat Lain-lain'
        : 'Surat Mutasi Keluar';
  const firstRecipientLine = String(d?.customRecipient ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const resolvedRecipient =
    letterType === 'SURAT_LAIN_LAIN'
      ? cut(
          l.recipientName ||
            firstRecipientLine ||
            d?.customSubject ||
            d?.customTitle,
          200
        ) || 'Umum'
      : cut(l.recipientName || d?.studentName, 200) || 'Siswa';
  const paperSize =
    d?.paperSize === 'LEGAL'
      ? 'LEGAL'
      : d?.paperSize === 'A4'
        ? 'A4'
        : 'F4';

  return {
    ownerUid,
    id: cut(l.id, 128),
    type: letterType,
    title: cut(l.title, 150) || defaultTitle,
    letterNumber: cut(l.letterNumber || d?.letterNumber, 100) || '-',
    letterDate: cut(l.letterDate || d?.letterDate, 40),
    studentId: letterType === 'SURAT_LAIN_LAIN' ? '' : cut(l.studentId, 128),
    recipientName: resolvedRecipient,
    data: {
      letterNumber: cut(d?.letterNumber || l.letterNumber, 100) || '-',
      letterDate: cut(d?.letterDate || l.letterDate, 40),
      letterCity: cut(d?.letterCity, 120),
      schoolLocationLine: cut(d?.schoolLocationLine, 250),
      studentId:
        letterType === 'SURAT_LAIN_LAIN'
          ? ''
          : cut(d?.studentId ?? l.studentId, 128),
      studentName:
        letterType === 'SURAT_LAIN_LAIN'
          ? cut(d?.studentName, 200)
          : cut(d?.studentName || l.recipientName, 200) || 'Siswa',
      birthPlace: cut(d?.birthPlace, 120),
      birthDate: cut(d?.birthDate, 40),
      gender: cut(d?.gender, 40),
      religion: cut(d?.religion, 50),
      address: cut(d?.address, 300),
      originSchool: cut(d?.originSchool, 150),
      targetClass: cut(d?.targetClass, 40),
      requirementClause: cut(d?.requirementClause, 500),
      closingClause: cut(d?.closingClause, 500),
      nipdNisn: cut(d?.nipdNisn, 80),
      parentName: cut(d?.parentName, 150),
      parentJob: cut(d?.parentJob, 100),
      destinationSchool: cut(d?.destinationSchool, 180),
      transferReason: cut(d?.transferReason, 250),
      paperSize,
      showKop: Boolean(d?.showKop),
      showSignatureAssets: Boolean(d?.showSignatureAssets),
      customTitle: cut(d?.customTitle, 150),
      customSubject: cut(d?.customSubject, 250),
      customAttachment: cut(d?.customAttachment, 150),
      customRecipient: cut(d?.customRecipient, 600),
      customBody: cut(d?.customBody, 20000),
      customCc: cut(d?.customCc, 600),
      customUseSettingsSigner: d?.customUseSettingsSigner !== false,
      customSignerPosition: cut(d?.customSignerPosition, 150),
      customSignerName: cut(d?.customSignerName, 150),
      customSignerNip: cut(d?.customSignerNip, 60),
    },
    clientCreatedAt: cut(l.createdAt, 64),
    clientUpdatedAt: cut(l.updatedAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeAttendanceStatus(val: unknown): AttendanceStatus {
  const s = String(val ?? '').trim().toUpperCase();
  if (s === 'H' || s === 'S' || s === 'I' || s === 'A') return s;
  return '';
}

function computeHomeroomsVersion(
  homerooms: Record<string, ClassHomeroomAssignment>
): string {
  const entries = Object.entries(homerooms)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.teacherId || ''}:${v.teacherName}:${v.teacherNip}:${v.updatedAt || ''}`);
  return entries.join('|').slice(0, 64) || 'empty';
}

function buildHomeroomDocPayload(
  homerooms: Record<string, ClassHomeroomAssignment>,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  const cleanMap: Record<
    string,
    {
      rombel: string;
      teacherId: string;
      teacherName: string;
      teacherNip: string;
      updatedAt: string;
    }
  > = {};

  let count = 0;
  for (const [key, val] of Object.entries(homerooms || {})) {
    if (count >= 150) break;
    const cleanKey = cut(key, 80).trim();
    if (!cleanKey || !val) continue;
    cleanMap[cleanKey] = {
      rombel: cut(val.rombel || cleanKey, 80),
      teacherId: cut(val.teacherId, 128),
      teacherName: cut(val.teacherName, 150),
      teacherNip: cut(val.teacherNip, 40),
      updatedAt: cut(val.updatedAt, 64),
    };
    count++;
  }

  return {
    ownerUid,
    id: HOMEROOM_DOC_ID,
    kind: 'HOMEROOM_MAP',
    date: '',
    rombel: 'ALL',
    waliKelasId: '',
    waliKelasName: '',
    waliKelasNip: '',
    updatedBy: 'Operator',
    entries: cleanMap,
    clientCreatedAt: 'homerooms',
    clientUpdatedAt: computeHomeroomsVersion(homerooms),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildAttendanceSheetPayload(
  sheet: AttendanceSheetRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  const cleanEntries: Record<string, { status: AttendanceStatus; note: string }> =
    {};
  let count = 0;
  for (const [studentId, entry] of Object.entries(sheet.entries || {})) {
    if (count >= 150) break;
    const cleanId = cut(studentId, 128).trim();
    if (!cleanId || !entry) continue;
    cleanEntries[cleanId] = {
      status: sanitizeAttendanceStatus(entry.status),
      note: cut(entry.note, 200),
    };
    count++;
  }

  return {
    ownerUid,
    id: cut(sheet.id, 128),
    kind: 'DAILY_SHEET',
    date: cut(sheet.date, 40),
    rombel: cut(sheet.rombel, 80),
    waliKelasId: cut(sheet.waliKelasId, 128),
    waliKelasName: cut(sheet.waliKelasName, 150),
    waliKelasNip: cut(sheet.waliKelasNip, 40),
    updatedBy: cut(sheet.updatedBy, 150) || 'Pengguna',
    entries: cleanEntries,
    clientCreatedAt: cut(sheet.createdAt, 64),
    clientUpdatedAt: cut(sheet.updatedAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeAgendaStatus(val: unknown): AgendaStatus {
  const s = String(val ?? '').trim().toUpperCase();
  if (
    s === 'DIRENCANAKAN' ||
    s === 'BERLANGSUNG' ||
    s === 'SELESAI' ||
    s === 'DIBATALKAN'
  ) {
    return s;
  }
  return 'DIRENCANAKAN';
}

function sanitizeAgendaVisibility(val: unknown): AgendaVisibility {
  return String(val ?? '').trim().toUpperCase() === 'PERSONAL'
    ? 'PERSONAL'
    : 'SCHOOL';
}

function computeAgendaConfigVersion(config: AgendaConfig): string {
  return `${config.allowGuruCreate ? '1' : '0'}:${config.allowOperatorViewGuruPersonal ? '1' : '0'}:${config.updatedAt || ''}:${(config.categories || []).join('|')}`.slice(
    0,
    64
  );
}

function buildAgendaConfigPayload(
  config: AgendaConfig,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  const cleanCategories = (config.categories || [])
    .map((c) => cut(c, 80).trim())
    .filter(Boolean)
    .slice(0, 50);
  return {
    ownerUid,
    id: AGENDA_CONFIG_DOC_ID,
    kind: 'AGENDA_CONFIG',
    title: 'Konfigurasi Agenda Harian',
    date: '',
    startTime: '',
    endTime: '',
    category: '',
    picId: '',
    picName: '',
    participantIds: [],
    participantNames: [],
    extraParticipants: '',
    location: '',
    description: '',
    notes: '',
    status: 'DIRENCANAKAN',
    visibility: 'SCHOOL',
    createdByUserId: '',
    createdByName: 'Operator',
    createdByRole: 'OPERATOR',
    updatedByName: 'Operator',
    categories:
      cleanCategories.length > 0
        ? cleanCategories
        : [...DEFAULT_AGENDA_CATEGORIES],
    allowGuruCreate: config.allowGuruCreate !== false,
    allowOperatorViewGuruPersonal:
      config.allowOperatorViewGuruPersonal !== false,
    clientCreatedAt: 'agenda_config',
    clientUpdatedAt: cut(config.updatedAt || computeAgendaConfigVersion(config), 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildAgendaItemPayload(
  item: AgendaRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    id: cut(item.id, 128),
    kind: 'AGENDA_ITEM',
    title: cut(item.title, 200) || 'Kegiatan Sekolah',
    date: cut(item.date, 20),
    startTime: cut(item.startTime, 10),
    endTime: cut(item.endTime, 10),
    category: cut(item.category, 80) || 'Kegiatan lainnya',
    picId: cut(item.picId, 128),
    picName: cut(item.picName, 150),
    participantIds: (item.participantIds || [])
      .map((x) => cut(x, 128))
      .filter(Boolean)
      .slice(0, 100),
    participantNames: (item.participantNames || [])
      .map((x) => cut(x, 150))
      .filter(Boolean)
      .slice(0, 100),
    extraParticipants: cut(item.extraParticipants, 300),
    location: cut(item.location, 180),
    description: cut(item.description, 1500),
    notes: cut(item.notes, 800),
    status: sanitizeAgendaStatus(item.status),
    visibility: sanitizeAgendaVisibility(item.visibility),
    createdByUserId: cut(item.createdByUserId, 128) || 'system',
    createdByName: cut(item.createdByName, 150) || 'Pengguna',
    createdByRole: item.createdByRole === 'GURU' ? 'GURU' : 'OPERATOR',
    updatedByName: cut(item.updatedByName, 150) || 'Pengguna',
    categories: [],
    allowGuruCreate: true,
    allowOperatorViewGuruPersonal: true,
    clientCreatedAt: cut(item.createdAt, 64),
    clientUpdatedAt: cut(item.updatedAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function fromCloudStudentDoc(data: DocumentData): StudentRecord {
  const details = (data.details || {}) as Record<string, unknown>;
  return {
    id: String(data.id ?? ''),
    no: String(data.no ?? ''),
    nama: String(data.nama ?? ''),
    nipd: String(data.nipd ?? ''),
    jk: String(data.jk ?? ''),
    nisn: String(data.nisn ?? ''),
    tempatLahir: String(data.tempatLahir ?? ''),
    tanggalLahir: String(data.tanggalLahir ?? ''),
    rombelSaatIni: String(data.rombelSaatIni ?? ''),
    statusData:
      data.statusData === 'LENGKAP' ? 'LENGKAP' : 'PERLU_PERIKSA',
    nik: String(details.nik ?? ''),
    agama: String(details.agama ?? ''),
    noRegistrasiAktaLahir: String(details.noRegistrasiAktaLahir ?? ''),
    noKk: String(details.noKk ?? ''),
    kebutuhanKhusus: String(details.kebutuhanKhusus ?? ''),
    anakKeBerapa: String(details.anakKeBerapa ?? ''),
    jmlSaudaraKandung: String(details.jmlSaudaraKandung ?? ''),
    alamat: String(details.alamat ?? ''),
    rt: String(details.rt ?? ''),
    rw: String(details.rw ?? ''),
    dusun: String(details.dusun ?? ''),
    kelurahan: String(details.kelurahan ?? ''),
    kecamatan: String(details.kecamatan ?? ''),
    kodePos: String(details.kodePos ?? ''),
    jenisTinggal: String(details.jenisTinggal ?? ''),
    alatTransportasi: String(details.alatTransportasi ?? ''),
    telepon: String(details.telepon ?? ''),
    hp: String(details.hp ?? ''),
    email: String(details.email ?? ''),
    lintang: String(details.lintang ?? ''),
    bujur: String(details.bujur ?? ''),
    jarakRumahKeSekolahKm: String(details.jarakRumahKeSekolahKm ?? ''),
    ayah: cleanParent(details.ayah as Partial<ParentGuardianInfo> | undefined),
    ibu: cleanParent(details.ibu as Partial<ParentGuardianInfo> | undefined),
    wali: cleanParent(details.wali as Partial<ParentGuardianInfo> | undefined),
    sekolahAsal: String(details.sekolahAsal ?? ''),
    skhun: String(details.skhun ?? ''),
    noPesertaUjianNasional: String(details.noPesertaUjianNasional ?? ''),
    noSeriIjazah: String(details.noSeriIjazah ?? ''),
    penerimaKps: String(details.penerimaKps ?? ''),
    noKps: String(details.noKps ?? ''),
    penerimaKip: String(details.penerimaKip ?? ''),
    nomorKip: String(details.nomorKip ?? ''),
    namaDiKip: String(details.namaDiKip ?? ''),
    nomorKks: String(details.nomorKks ?? ''),
    bank: String(details.bank ?? ''),
    nomorRekeningBank: String(details.nomorRekeningBank ?? ''),
    rekeningAtasNama: String(details.rekeningAtasNama ?? ''),
    layakPip: String(details.layakPip ?? ''),
    alasanLayakPip: String(details.alasanLayakPip ?? ''),
    beratBadan: String(details.beratBadan ?? ''),
    tinggiBadan: String(details.tinggiBadan ?? ''),
    lingkarKepala: String(details.lingkarKepala ?? ''),
    createdAt: String(data.clientCreatedAt ?? ''),
    updatedAt: String(data.clientUpdatedAt ?? ''),
  };
}

function fromCloudTeacherDoc(data: DocumentData): TeacherRecord {
  const details = (data.details || {}) as Record<string, unknown>;
  return {
    id: String(data.id ?? ''),
    no: String(data.no ?? ''),
    nama: String(data.nama ?? ''),
    nip: String(data.nip ?? ''),
    nuptk: String(data.nuptk ?? ''),
    jk: String(data.jk ?? ''),
    tempatLahir: String(data.tempatLahir ?? ''),
    tanggalLahir: String(data.tanggalLahir ?? ''),
    statusKepegawaian: String(data.statusKepegawaian ?? ''),
    jenisPtk: String(data.jenisPtk ?? ''),
    email: String(data.email ?? ''),
    statusData:
      data.statusData === 'LENGKAP' ? 'LENGKAP' : 'PERLU_PERIKSA',
    linkedAccountId:
      typeof data.linkedAccountId === 'string' && data.linkedAccountId.trim()
        ? data.linkedAccountId.trim()
        : null,
    assignedClass: String(data.assignedClass ?? '').trim(),
    agama: String(details.agama ?? ''),
    alamatJalan: String(details.alamatJalan ?? ''),
    rt: String(details.rt ?? ''),
    rw: String(details.rw ?? ''),
    namaDusun: String(details.namaDusun ?? ''),
    desaKelurahan: String(details.desaKelurahan ?? ''),
    kecamatan: String(details.kecamatan ?? ''),
    kodePos: String(details.kodePos ?? ''),
    telepon: String(details.telepon ?? ''),
    hp: String(details.hp ?? ''),
    tugasTambahan: String(details.tugasTambahan ?? ''),
    skCpns: String(details.skCpns ?? ''),
    tanggalCpns: String(details.tanggalCpns ?? ''),
    skPengangkatan: String(details.skPengangkatan ?? ''),
    tmtPengangkatan: String(details.tmtPengangkatan ?? ''),
    lembagaPengangkatan: String(details.lembagaPengangkatan ?? ''),
    pangkatGolongan: String(details.pangkatGolongan ?? ''),
    sumberGaji: String(details.sumberGaji ?? ''),
    tmtPns: String(details.tmtPns ?? ''),
    namaIbuKandung: String(details.namaIbuKandung ?? ''),
    statusPerkawinan: String(details.statusPerkawinan ?? ''),
    namaSuamiIstri: String(details.namaSuamiIstri ?? ''),
    nipSuamiIstri: String(details.nipSuamiIstri ?? ''),
    pekerjaanSuamiIstri: String(details.pekerjaanSuamiIstri ?? ''),
    sudahLisensi: String(details.sudahLisensi ?? ''),
    kepalaSekolah: String(details.kepalaSekolah ?? ''),
    pernahDiklatKepengawasan: String(details.pernahDiklatKepengawasan ?? ''),
    keahlianBraille: String(details.keahlianBraille ?? ''),
    keahlianBahasaIsyarat: String(details.keahlianBahasaIsyarat ?? ''),
    npwp: String(details.npwp ?? ''),
    namaWajibPajak: String(details.namaWajibPajak ?? ''),
    kewarganegaraan: String(details.kewarganegaraan ?? ''),
    bank: String(details.bank ?? ''),
    nomorRekeningBank: String(details.nomorRekeningBank ?? ''),
    rekeningAtasNama: String(details.rekeningAtasNama ?? ''),
    nik: String(details.nik ?? ''),
    noKk: String(details.noKk ?? ''),
    karpeg: String(details.karpeg ?? ''),
    karisKarsu: String(details.karisKarsu ?? ''),
    lintang: String(details.lintang ?? ''),
    bujur: String(details.bujur ?? ''),
    nuks: String(details.nuks ?? ''),
    createdAt: String(data.clientCreatedAt ?? ''),
    updatedAt: String(data.clientUpdatedAt ?? ''),
  };
}

function fromCloudAccountDoc(data: DocumentData): StoredUserRecord {
  return {
    id: String(data.id ?? ''),
    fullName: String(data.fullName ?? ''),
    nip: String(data.nip ?? ''),
    username: String(data.username ?? ''),
    email: String(data.email ?? ''),
    role: data.role === 'OPERATOR' ? 'OPERATOR' : 'GURU',
    status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    mustChangePassword: Boolean(data.mustChangePassword),
    teacherRecordId:
      typeof data.teacherRecordId === 'string' && data.teacherRecordId.trim()
        ? data.teacherRecordId.trim()
        : null,
    assignedClass: String(data.assignedClass ?? '').trim(),
    passwordSalt: String(data.passwordSalt ?? ''),
    passwordHash: String(data.passwordHash ?? ''),
    createdAt: String(data.clientCreatedAt ?? ''),
    updatedAt: String(data.clientUpdatedAt ?? ''),
    deactivatedAt:
      typeof data.deactivatedAt === 'string' && data.deactivatedAt.trim()
        ? data.deactivatedAt.trim()
        : null,
  };
}

function fromCloudLetterDoc(data: DocumentData): LetterRecord {
  const payload = (data.data || {}) as Record<string, unknown>;
  const rawStudentId =
    typeof data.studentId === 'string' && data.studentId.trim()
      ? data.studentId.trim()
      : typeof payload.studentId === 'string' && payload.studentId.trim()
        ? payload.studentId.trim()
        : null;
  const letterType =
    data.type === 'SUKET_PINDAH_SEKOLAH'
      ? 'SUKET_PINDAH_SEKOLAH'
      : data.type === 'SURAT_LAIN_LAIN'
        ? 'SURAT_LAIN_LAIN'
        : 'SUKET_SISWA_DITERIMA';

  return {
    id: String(data.id ?? ''),
    type: letterType,
    title: String(
      data.title ??
        (letterType === 'SUKET_PINDAH_SEKOLAH'
          ? 'Surat Keterangan Pindah Sekolah'
          : letterType === 'SURAT_LAIN_LAIN'
            ? String(payload.customTitle ?? '') || 'Surat Lain-lain'
            : 'Surat Mutasi Keluar')
    ),
    letterNumber: String(data.letterNumber ?? payload.letterNumber ?? ''),
    letterDate: String(data.letterDate ?? payload.letterDate ?? ''),
    studentId: letterType === 'SURAT_LAIN_LAIN' ? null : rawStudentId,
    recipientName: String(data.recipientName ?? payload.studentName ?? ''),
    data: {
      letterNumber: String(payload.letterNumber ?? data.letterNumber ?? ''),
      letterDate: String(payload.letterDate ?? data.letterDate ?? ''),
      letterCity: String(payload.letterCity ?? ''),
      schoolLocationLine: String(payload.schoolLocationLine ?? ''),
      studentId: letterType === 'SURAT_LAIN_LAIN' ? null : rawStudentId,
      studentName:
        letterType === 'SURAT_LAIN_LAIN'
          ? String(payload.studentName ?? '')
          : String(payload.studentName ?? data.recipientName ?? ''),
      birthPlace: String(payload.birthPlace ?? ''),
      birthDate: String(payload.birthDate ?? ''),
      gender: String(payload.gender ?? ''),
      religion: String(payload.religion ?? ''),
      address: String(payload.address ?? ''),
      originSchool: String(payload.originSchool ?? ''),
      targetClass: String(payload.targetClass ?? ''),
      requirementClause: String(payload.requirementClause ?? ''),
      closingClause: String(payload.closingClause ?? ''),
      nipdNisn: String(payload.nipdNisn ?? ''),
      parentName: String(payload.parentName ?? ''),
      parentJob: String(payload.parentJob ?? ''),
      destinationSchool: String(payload.destinationSchool ?? ''),
      transferReason:
        String(payload.transferReason ?? '') || 'permintaan orang tua / wali siswa',
      paperSize:
        payload.paperSize === 'LEGAL'
          ? 'LEGAL'
          : payload.paperSize === 'A4'
            ? 'A4'
            : 'F4',
      showKop: payload.showKop !== false,
      showSignatureAssets: payload.showSignatureAssets !== false,
      customTitle: String(payload.customTitle ?? ''),
      customSubject: String(payload.customSubject ?? ''),
      customAttachment: String(payload.customAttachment ?? ''),
      customRecipient: String(payload.customRecipient ?? ''),
      customBody: String(payload.customBody ?? ''),
      customCc: String(payload.customCc ?? ''),
      customUseSettingsSigner: payload.customUseSettingsSigner !== false,
      customSignerPosition: String(payload.customSignerPosition ?? ''),
      customSignerName: String(payload.customSignerName ?? ''),
      customSignerNip: String(payload.customSignerNip ?? ''),
    },
    createdAt: String(data.clientCreatedAt ?? ''),
    updatedAt: String(data.clientUpdatedAt ?? ''),
  };
}

function fromCloudHomeroomMap(
  data: DocumentData
): Record<string, ClassHomeroomAssignment> {
  const result: Record<string, ClassHomeroomAssignment> = {};
  const entries = (data.entries || {}) as Record<string, Record<string, unknown>>;
  for (const [rombelKey, val] of Object.entries(entries)) {
    if (!val || typeof val !== 'object') continue;
    const rombel = String(val.rombel ?? rombelKey).trim();
    if (!rombel) continue;
    result[rombel] = {
      rombel,
      teacherId:
        typeof val.teacherId === 'string' && val.teacherId.trim()
          ? val.teacherId.trim()
          : null,
      teacherName: String(val.teacherName ?? ''),
      teacherNip: String(val.teacherNip ?? ''),
      updatedAt: String(val.updatedAt ?? ''),
    };
  }
  return result;
}

function fromCloudAttendanceSheet(data: DocumentData): AttendanceSheetRecord {
  const rawEntries = (data.entries || {}) as Record<
    string,
    Partial<AttendanceStudentEntry>
  >;
  const entries: Record<string, AttendanceStudentEntry> = {};
  for (const [studentId, entry] of Object.entries(rawEntries)) {
    if (!studentId || !entry) continue;
    entries[studentId] = {
      status: sanitizeAttendanceStatus(entry.status),
      note: String(entry.note ?? ''),
    };
  }

  return {
    id: String(data.id ?? ''),
    date: String(data.date ?? ''),
    rombel: String(data.rombel ?? ''),
    waliKelasId:
      typeof data.waliKelasId === 'string' && data.waliKelasId.trim()
        ? data.waliKelasId.trim()
        : null,
    waliKelasName: String(data.waliKelasName ?? ''),
    waliKelasNip: String(data.waliKelasNip ?? ''),
    entries,
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: String(data.clientCreatedAt ?? ''),
    updatedAt: String(data.clientUpdatedAt ?? ''),
  };
}

function fromCloudAgendaConfig(data: DocumentData): AgendaConfig {
  const rawCats = Array.isArray(data.categories)
    ? data.categories.map((c) => String(c ?? '').trim()).filter(Boolean)
    : [];
  return {
    categories:
      rawCats.length > 0 ? rawCats : [...DEFAULT_AGENDA_CATEGORIES],
    allowGuruCreate: data.allowGuruCreate !== false,
    allowOperatorViewGuruPersonal:
      data.allowOperatorViewGuruPersonal !== false,
    updatedAt:
      typeof data.clientUpdatedAt === 'string' && data.clientUpdatedAt.trim()
        ? data.clientUpdatedAt.trim()
        : null,
  };
}

function fromCloudAgendaItem(data: DocumentData): AgendaRecord {
  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    date: String(data.date ?? ''),
    startTime: String(data.startTime ?? ''),
    endTime: String(data.endTime ?? ''),
    category: String(data.category ?? 'Kegiatan lainnya'),
    picId:
      typeof data.picId === 'string' && data.picId.trim()
        ? data.picId.trim()
        : null,
    picName: String(data.picName ?? ''),
    participantIds: Array.isArray(data.participantIds)
      ? data.participantIds.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [],
    participantNames: Array.isArray(data.participantNames)
      ? data.participantNames.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [],
    extraParticipants: String(data.extraParticipants ?? ''),
    location: String(data.location ?? ''),
    description: String(data.description ?? ''),
    notes: String(data.notes ?? ''),
    status: sanitizeAgendaStatus(data.status),
    visibility: sanitizeAgendaVisibility(data.visibility),
    createdByUserId: String(data.createdByUserId ?? ''),
    createdByName: String(data.createdByName ?? ''),
    createdByRole: data.createdByRole === 'GURU' ? 'GURU' : 'OPERATOR',
    updatedByName: String(data.updatedByName ?? ''),
    createdAt: String(data.clientCreatedAt ?? ''),
    updatedAt: String(data.clientUpdatedAt ?? ''),
  };
}

function sanitizeNotificationType(val: unknown): AdminNotificationType {
  const s = String(val ?? '').trim().toUpperCase();
  if (s === 'TEACHER_PROFILE_UPDATED') return 'TEACHER_PROFILE_UPDATED';
  if (s === 'AGENDA_CREATED') return 'AGENDA_CREATED';
  return 'STUDENT_UPDATED';
}

function buildNotificationPayload(
  n: AdminNotificationRecord,
  ownerUid: string,
  existingCreatedAt: unknown
) {
  return {
    ownerUid,
    id: cut(n.id, 128),
    type: sanitizeNotificationType(n.type),
    actorUserId: cut(n.actorUserId, 128),
    actorName: cut(n.actorName, 150) || 'Guru',
    actorUsername: cut(n.actorUsername, 60),
    title: cut(n.title, 200) || 'Pemberitahuan Aktivitas Guru',
    summary: cut(n.summary, 600),
    targetId: cut(n.targetId, 128),
    targetName: cut(n.targetName, 200),
    changedFields: (n.changedFields || [])
      .map((f) => cut(f, 160))
      .filter(Boolean)
      .slice(0, 40),
    eventDate: cut(n.eventDate, 40),
    readAt: cut(n.readAt, 64),
    clientCreatedAt: cut(n.createdAt, 64),
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function fromCloudNotificationDoc(data: DocumentData): AdminNotificationRecord {
  const rawReadAt = String(data.readAt ?? '').trim();
  return {
    id: String(data.id ?? ''),
    type: sanitizeNotificationType(data.type),
    actorUserId: String(data.actorUserId ?? ''),
    actorName: String(data.actorName ?? ''),
    actorUsername: String(data.actorUsername ?? ''),
    title: String(data.title ?? ''),
    summary: String(data.summary ?? ''),
    targetId: String(data.targetId ?? ''),
    targetName: String(data.targetName ?? ''),
    changedFields: Array.isArray(data.changedFields)
      ? data.changedFields.map((f) => String(f ?? '').trim()).filter(Boolean)
      : [],
    eventDate: String(data.eventDate ?? ''),
    createdAt: String(data.clientCreatedAt ?? ''),
    readAt: rawReadAt || null,
  };
}

export async function ensureSchoolDocExists(
  settings?: SchoolSettings
): Promise<{ ownerUid: string }> {
  const uid = getAuthenticatedCloudUid();
  if (!uid) {
    throw new Error('Akun Google belum terhubung untuk sinkronisasi database online.');
  }

  const schoolRef = doc(db, 'schools', SCHOOL_ID);
  let snap;
  try {
    snap = await getDoc(schoolRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, SCHOOL_DOC_PATH);
  }

  if (snap.exists()) {
    const data = snap.data();
    const ownerUid = String(data.ownerUid || uid);
    if (settings) {
      const payload = buildSchoolPayload(settings, ownerUid, data.createdAt);
      try {
        await setDoc(schoolRef, payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, SCHOOL_DOC_PATH);
      }
    }
    return { ownerUid };
  }

  const empty: SchoolSettings = settings || {
    identity: { schoolName: '', city: '', department: '', academicYear: '' },
    principal: { name: '', position: '', nip: '' },
    operator: { name: '', position: '', nip: '' },
    files: { logo: null, kop: null, ttd: null, stempel: null },
    updatedAt: null,
  };
  const payload = buildSchoolPayload(empty, uid, null);
  try {
    await setDoc(schoolRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SCHOOL_DOC_PATH);
  }
  return { ownerUid: uid };
}

async function fetchExistingMap(
  colPath: string,
  colSegments: [string, string, string]
): Promise<Map<string, DocumentData>> {
  try {
    const snap = await getDocs(collection(db, ...colSegments));
    const map = new Map<string, DocumentData>();
    snap.forEach((d) => map.set(d.id, d.data()));
    return map;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

export async function syncSnapshotToCloud(
  snapshot: ServerSyncSnapshot
): Promise<{
  accounts: number;
  students: number;
  teachers: number;
  letters: number;
  attendance: number;
  agendas: number;
  notifications: number;
  assets: number;
}> {
  const uid = getAuthenticatedCloudUid();
  if (!uid) {
    return {
      accounts: 0,
      students: 0,
      teachers: 0,
      letters: 0,
      attendance: 0,
      agendas: 0,
      notifications: 0,
      assets: 0,
    };
  }

  const { ownerUid } = await ensureSchoolDocExists(snapshot.settings);

  const [
    existingAssets,
    existingAccounts,
    existingStudents,
    existingTeachers,
    existingLetters,
    existingAttendance,
    existingAgendas,
    existingNotifications,
  ] = await Promise.all([
    fetchExistingMap(ASSETS_COL_PATH, ['schools', SCHOOL_ID, 'assets']),
    fetchExistingMap(ACCOUNTS_COL_PATH, ['schools', SCHOOL_ID, 'accounts']),
    fetchExistingMap(STUDENTS_COL_PATH, ['schools', SCHOOL_ID, 'students']),
    fetchExistingMap(TEACHERS_COL_PATH, ['schools', SCHOOL_ID, 'teachers']),
    fetchExistingMap(LETTERS_COL_PATH, ['schools', SCHOOL_ID, 'letters']),
    fetchExistingMap(ATTENDANCE_COL_PATH, ['schools', SCHOOL_ID, 'attendance']),
    fetchExistingMap(AGENDAS_COL_PATH, ['schools', SCHOOL_ID, 'agendas']),
    fetchExistingMap(NOTIFICATIONS_COL_PATH, ['schools', SCHOOL_ID, 'notifications']),
  ]);

  const ops: Array<{
    path: string;
    ref: ReturnType<typeof doc>;
    data: Record<string, unknown>;
    kind:
      | 'asset'
      | 'account'
      | 'student'
      | 'teacher'
      | 'letter'
      | 'attendance'
      | 'agenda'
      | 'notification';
  }> = [];

  for (const asset of snapshot.assets || []) {
    if (!asset?.slot) continue;
    const prev = existingAssets.get(asset.slot);
    if (
      prev &&
      prev.filename === asset.filename &&
      prev.size === asset.size &&
      prev.dataUrl === asset.dataUrl
    ) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${ASSETS_COL_PATH}/${asset.slot}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'assets', asset.slot),
      data: buildAssetPayload(asset, effectiveOwner, prev?.createdAt),
      kind: 'asset',
    });
  }

  for (const acc of snapshot.accounts || []) {
    if (!acc?.id) continue;
    const prev = existingAccounts.get(acc.id);
    if (
      prev &&
      prev.clientUpdatedAt === acc.updatedAt &&
      prev.status === acc.status &&
      prev.passwordHash === acc.passwordHash &&
      String(prev.assignedClass ?? '') === String(acc.assignedClass ?? '')
    ) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${ACCOUNTS_COL_PATH}/${acc.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'accounts', acc.id),
      data: buildAccountPayload(acc, effectiveOwner, prev?.createdAt),
      kind: 'account',
    });
  }

  for (const student of snapshot.students || []) {
    if (!student?.id) continue;
    const prev = existingStudents.get(student.id);
    if (prev && prev.clientUpdatedAt === student.updatedAt) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${STUDENTS_COL_PATH}/${student.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'students', student.id),
      data: buildStudentPayload(student, effectiveOwner, prev?.createdAt),
      kind: 'student',
    });
  }

  for (const teacher of snapshot.teachers || []) {
    if (!teacher?.id) continue;
    const prev = existingTeachers.get(teacher.id);
    if (
      prev &&
      prev.clientUpdatedAt === teacher.updatedAt &&
      prev.linkedAccountId === (teacher.linkedAccountId || '') &&
      String(prev.assignedClass ?? '') === String(teacher.assignedClass ?? '')
    ) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${TEACHERS_COL_PATH}/${teacher.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'teachers', teacher.id),
      data: buildTeacherPayload(teacher, effectiveOwner, prev?.createdAt),
      kind: 'teacher',
    });
  }

  for (const letter of snapshot.letters || []) {
    if (!letter?.id) continue;
    const prev = existingLetters.get(letter.id);
    if (prev && prev.clientUpdatedAt === letter.updatedAt) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${LETTERS_COL_PATH}/${letter.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'letters', letter.id),
      data: buildLetterPayload(letter, effectiveOwner, prev?.createdAt),
      kind: 'letter',
    });
  }

  const attendanceHomerooms = snapshot.attendance?.homerooms || {};
  if (Object.keys(attendanceHomerooms).length > 0) {
    const prevHm = existingAttendance.get(HOMEROOM_DOC_ID);
    const nextVersion = computeHomeroomsVersion(attendanceHomerooms);
    if (!prevHm || prevHm.clientUpdatedAt !== nextVersion) {
      const effectiveOwner = prevHm?.ownerUid ? String(prevHm.ownerUid) : ownerUid;
      ops.push({
        path: `${ATTENDANCE_COL_PATH}/${HOMEROOM_DOC_ID}`,
        ref: doc(db, 'schools', SCHOOL_ID, 'attendance', HOMEROOM_DOC_ID),
        data: buildHomeroomDocPayload(
          attendanceHomerooms,
          effectiveOwner,
          prevHm?.createdAt
        ),
        kind: 'attendance',
      });
    }
  }

  for (const sheet of snapshot.attendance?.sheets || []) {
    if (!sheet?.id) continue;
    const prev = existingAttendance.get(sheet.id);
    if (prev && prev.clientUpdatedAt === sheet.updatedAt) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${ATTENDANCE_COL_PATH}/${sheet.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'attendance', sheet.id),
      data: buildAttendanceSheetPayload(sheet, effectiveOwner, prev?.createdAt),
      kind: 'attendance',
    });
  }

  if (snapshot.agendas?.config) {
    const prevCfg = existingAgendas.get(AGENDA_CONFIG_DOC_ID);
    const nextVersion = cut(
      snapshot.agendas.config.updatedAt ||
        computeAgendaConfigVersion(snapshot.agendas.config),
      64
    );
    if (!prevCfg || prevCfg.clientUpdatedAt !== nextVersion) {
      const effectiveOwner = prevCfg?.ownerUid ? String(prevCfg.ownerUid) : ownerUid;
      ops.push({
        path: `${AGENDAS_COL_PATH}/${AGENDA_CONFIG_DOC_ID}`,
        ref: doc(db, 'schools', SCHOOL_ID, 'agendas', AGENDA_CONFIG_DOC_ID),
        data: buildAgendaConfigPayload(
          snapshot.agendas.config,
          effectiveOwner,
          prevCfg?.createdAt
        ),
        kind: 'agenda',
      });
    }
  }

  for (const agenda of snapshot.agendas?.items || []) {
    if (!agenda?.id) continue;
    const prev = existingAgendas.get(agenda.id);
    if (prev && prev.clientUpdatedAt === agenda.updatedAt) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${AGENDAS_COL_PATH}/${agenda.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'agendas', agenda.id),
      data: buildAgendaItemPayload(agenda, effectiveOwner, prev?.createdAt),
      kind: 'agenda',
    });
  }

  const deletedNotifSet = new Set(snapshot.notifications?.deletedIds || []);
  for (const notif of snapshot.notifications?.items || []) {
    if (!notif?.id || deletedNotifSet.has(notif.id)) continue;
    const prev = existingNotifications.get(notif.id);
    if (
      prev &&
      prev.clientCreatedAt === notif.createdAt &&
      String(prev.readAt ?? '') === String(notif.readAt ?? '')
    ) {
      continue;
    }
    const effectiveOwner = prev?.ownerUid ? String(prev.ownerUid) : ownerUid;
    ops.push({
      path: `${NOTIFICATIONS_COL_PATH}/${notif.id}`,
      ref: doc(db, 'schools', SCHOOL_ID, 'notifications', notif.id),
      data: buildNotificationPayload(notif, effectiveOwner, prev?.createdAt),
      kind: 'notification',
    });
  }

  const deleteNotificationRefs: Array<{ path: string; ref: ReturnType<typeof doc> }> = [];
  for (const deletedId of deletedNotifSet) {
    if (existingNotifications.has(deletedId)) {
      deleteNotificationRefs.push({
        path: `${NOTIFICATIONS_COL_PATH}/${deletedId}`,
        ref: doc(db, 'schools', SCHOOL_ID, 'notifications', deletedId),
      });
    }
  }

  const counts = {
    accounts: 0,
    students: 0,
    teachers: 0,
    letters: 0,
    attendance: 0,
    agendas: 0,
    notifications: 0,
    assets: 0,
  };
  const CHUNK_SIZE = 200;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.set(op.ref, op.data);
      if (op.kind === 'asset') counts.assets++;
      if (op.kind === 'account') counts.accounts++;
      if (op.kind === 'student') counts.students++;
      if (op.kind === 'teacher') counts.teachers++;
      if (op.kind === 'letter') counts.letters++;
      if (op.kind === 'attendance') counts.attendance++;
      if (op.kind === 'agenda') counts.agendas++;
      if (op.kind === 'notification') counts.notifications++;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, chunk[0]?.path ?? SCHOOL_DOC_PATH);
    }
  }

  for (let i = 0; i < deleteNotificationRefs.length; i += CHUNK_SIZE) {
    const chunk = deleteNotificationRefs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const del of chunk) {
      batch.delete(del.ref);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        chunk[0]?.path ?? NOTIFICATIONS_COL_PATH
      );
    }
  }

  return counts;
}

export async function fetchCloudSnapshot(): Promise<{
  hasData: boolean;
  settings?: SchoolSettings;
  assets: CloudAssetPayload[];
  accounts: StoredUserRecord[];
  students: StudentRecord[];
  teachers: TeacherRecord[];
  letters: LetterRecord[];
  attendance: AttendanceStorePayload;
  agendas: AgendaStoreSnapshot;
  notifications: AdminNotificationStoreSnapshot;
}> {
  const emptyAgendaSnapshot: AgendaStoreSnapshot = {
    config: {
      categories: [...DEFAULT_AGENDA_CATEGORIES],
      allowGuruCreate: true,
      allowOperatorViewGuruPersonal: true,
      updatedAt: null,
    },
    items: [],
  };

  const uid = getAuthenticatedCloudUid();
  if (!uid) {
    return {
      hasData: false,
      assets: [],
      accounts: [],
      students: [],
      teachers: [],
      letters: [],
      attendance: { homerooms: {}, sheets: [] },
      agendas: emptyAgendaSnapshot,
      notifications: { items: [], deletedIds: [] },
    };
  }

  const schoolRef = doc(db, 'schools', SCHOOL_ID);
  let schoolSnap;
  try {
    schoolSnap = await getDoc(schoolRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, SCHOOL_DOC_PATH);
  }

  if (!schoolSnap.exists()) {
    return {
      hasData: false,
      assets: [],
      accounts: [],
      students: [],
      teachers: [],
      letters: [],
      attendance: { homerooms: {}, sheets: [] },
      agendas: emptyAgendaSnapshot,
      notifications: { items: [], deletedIds: [] },
    };
  }

  const [
    assetsMap,
    accountsMap,
    studentsMap,
    teachersMap,
    lettersMap,
    attendanceMap,
    agendasMap,
    notificationsMap,
  ] = await Promise.all([
    fetchExistingMap(ASSETS_COL_PATH, ['schools', SCHOOL_ID, 'assets']),
    fetchExistingMap(ACCOUNTS_COL_PATH, ['schools', SCHOOL_ID, 'accounts']),
    fetchExistingMap(STUDENTS_COL_PATH, ['schools', SCHOOL_ID, 'students']),
    fetchExistingMap(TEACHERS_COL_PATH, ['schools', SCHOOL_ID, 'teachers']),
    fetchExistingMap(LETTERS_COL_PATH, ['schools', SCHOOL_ID, 'letters']),
    fetchExistingMap(ATTENDANCE_COL_PATH, ['schools', SCHOOL_ID, 'attendance']),
    fetchExistingMap(AGENDAS_COL_PATH, ['schools', SCHOOL_ID, 'agendas']),
    fetchExistingMap(NOTIFICATIONS_COL_PATH, ['schools', SCHOOL_ID, 'notifications']),
  ]);

  const sd = schoolSnap.data();
  const updatedIso =
    typeof sd.updatedAt?.toDate === 'function'
      ? sd.updatedAt.toDate().toISOString()
      : new Date().toISOString();

  const assets: CloudAssetPayload[] = [];
  assetsMap.forEach((val) => {
    const slot = String(val.slot ?? '') as SchoolFileSlot;
    if (
      (slot === 'logo' || slot === 'kop' || slot === 'ttd' || slot === 'stempel') &&
      val.dataUrl
    ) {
      assets.push({
        slot,
        filename: String(val.filename ?? `${slot}.png`),
        originalName: String(val.originalName ?? `${slot}.png`),
        mimeType: String(val.mimeType ?? 'image/png'),
        size: Number(val.size ?? 0),
        dataUrl: String(val.dataUrl ?? ''),
      });
    }
  });

  const accounts: StoredUserRecord[] = [];
  accountsMap.forEach((val) => {
    const parsed = fromCloudAccountDoc(val);
    if (parsed.id && parsed.username) accounts.push(parsed);
  });

  const students: StudentRecord[] = [];
  studentsMap.forEach((val) => {
    const parsed = fromCloudStudentDoc(val);
    if (parsed.id && parsed.nama) students.push(parsed);
  });

  const teachers: TeacherRecord[] = [];
  teachersMap.forEach((val) => {
    const parsed = fromCloudTeacherDoc(val);
    if (parsed.id && parsed.nama) teachers.push(parsed);
  });

  const letters: LetterRecord[] = [];
  lettersMap.forEach((val) => {
    const parsed = fromCloudLetterDoc(val);
    if (parsed.id && parsed.letterNumber && parsed.recipientName) {
      letters.push(parsed);
    }
  });

  let homerooms: Record<string, ClassHomeroomAssignment> = {};
  const sheets: AttendanceSheetRecord[] = [];
  attendanceMap.forEach((val, docId) => {
    if (val.kind === 'HOMEROOM_MAP' || docId === HOMEROOM_DOC_ID) {
      homerooms = { ...homerooms, ...fromCloudHomeroomMap(val) };
    } else if (val.kind === 'DAILY_SHEET') {
      const parsed = fromCloudAttendanceSheet(val);
      if (parsed.id && parsed.date && parsed.rombel) {
        sheets.push(parsed);
      }
    }
  });

  let agendaConfig: AgendaConfig = emptyAgendaSnapshot.config;
  let hasAgendaConfig = false;
  const agendaItems: AgendaRecord[] = [];
  agendasMap.forEach((val, docId) => {
    if (val.kind === 'AGENDA_CONFIG' || docId === AGENDA_CONFIG_DOC_ID) {
      agendaConfig = fromCloudAgendaConfig(val);
      hasAgendaConfig = true;
    } else if (val.kind === 'AGENDA_ITEM') {
      const parsed = fromCloudAgendaItem(val);
      if (parsed.id && parsed.title && parsed.date) {
        agendaItems.push(parsed);
      }
    }
  });

  const notifications: AdminNotificationRecord[] = [];
  notificationsMap.forEach((val) => {
    const parsed = fromCloudNotificationDoc(val);
    if (parsed.id && parsed.title) {
      notifications.push(parsed);
    }
  });

  const settings: SchoolSettings = {
    identity: {
      schoolName: String(sd.schoolName ?? ''),
      city: String(sd.city ?? ''),
      department: String(sd.department ?? ''),
      academicYear: String(sd.academicYear ?? ''),
    },
    principal: {
      name: String(sd.principalName ?? ''),
      position: String(sd.principalPosition ?? ''),
      nip: String(sd.principalNip ?? ''),
    },
    operator: {
      name: String(sd.operatorName ?? ''),
      position: String(sd.operatorPosition ?? ''),
      nip: String(sd.operatorNip ?? ''),
    },
    files: {
      logo: null,
      kop: null,
      ttd: null,
      stempel: null,
    },
    updatedAt: updatedIso,
  };

  const hasData =
    Boolean(settings.identity.schoolName) ||
    assets.length > 0 ||
    accounts.length > 0 ||
    students.length > 0 ||
    teachers.length > 0 ||
    letters.length > 0 ||
    Object.keys(homerooms).length > 0 ||
    sheets.length > 0 ||
    hasAgendaConfig ||
    agendaItems.length > 0 ||
    notifications.length > 0;

  return {
    hasData,
    settings,
    assets,
    accounts,
    students,
    teachers,
    letters,
    attendance: { homerooms, sheets },
    agendas: { config: agendaConfig, items: agendaItems },
    notifications: { items: notifications, deletedIds: [] },
  };
}

export async function syncServerSnapshotIfOperator(
  authHeaders: Record<string, string>
): Promise<boolean> {
  const uid = getAuthenticatedCloudUid();
  if (!uid) return false;

  const res = await fetch(resolveApiUrl('/api/sync/snapshot'), {
    cache: 'no-store',
    credentials: 'include',
    headers: authHeaders,
  });
  if (!res.ok) return false;
  const snapshot = (await res.json()) as ServerSyncSnapshot;
  await syncSnapshotToCloud(snapshot);
  return true;
}

let inFlightSyncPromise: Promise<CloudSyncSummary> | null = null;

async function executeFullCloudSync(
  authHeaders: Record<string, string>,
  isOperatorSession: boolean
): Promise<CloudSyncSummary> {
  const cloud = await fetchCloudSnapshot();
  const summary: CloudSyncSummary = {
    restoredFromCloud: {
      hasData: cloud.hasData,
      accounts: 0,
      students: 0,
      teachers: 0,
      letters: 0,
      attendance: 0,
      agendas: 0,
      notifications: 0,
      assets: cloud.assets.length,
      settingsUpdated: false,
    },
    pushedToCloud: {
      accounts: 0,
      students: 0,
      teachers: 0,
      letters: 0,
      attendance: 0,
      agendas: 0,
      notifications: 0,
      assets: 0,
    },
  };

  if (cloud.hasData) {
    const restoreRes = await fetch(resolveApiUrl('/api/sync/restore'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        settings: cloud.settings,
        assets: cloud.assets,
        accounts: cloud.accounts,
        students: cloud.students,
        teachers: cloud.teachers,
        letters: cloud.letters,
        attendance: cloud.attendance,
        agendas: cloud.agendas,
        notifications: cloud.notifications,
      }),
    });

    if (restoreRes.ok) {
      const restoreData = (await restoreRes.json()) as {
        settingsUpdated?: boolean;
        accounts?: { restored?: number; updated?: number };
        students?: { restored?: number; updated?: number };
        teachers?: { restored?: number; updated?: number };
        letters?: { restored?: number; updated?: number };
        attendance?: {
          homerooms?: number;
          sheetsRestored?: number;
          sheetsUpdated?: number;
        };
        agendas?: {
          configUpdated?: boolean;
          restored?: number;
          updated?: number;
        };
        notifications?: {
          restored?: number;
          updated?: number;
        };
      };
      summary.restoredFromCloud.settingsUpdated = Boolean(
        restoreData.settingsUpdated
      );
      summary.restoredFromCloud.accounts =
        (restoreData.accounts?.restored || 0) +
        (restoreData.accounts?.updated || 0);
      summary.restoredFromCloud.students =
        (restoreData.students?.restored || 0) +
        (restoreData.students?.updated || 0);
      summary.restoredFromCloud.teachers =
        (restoreData.teachers?.restored || 0) +
        (restoreData.teachers?.updated || 0);
      summary.restoredFromCloud.letters =
        (restoreData.letters?.restored || 0) +
        (restoreData.letters?.updated || 0);
      summary.restoredFromCloud.attendance =
        (restoreData.attendance?.homerooms || 0) +
        (restoreData.attendance?.sheetsRestored || 0) +
        (restoreData.attendance?.sheetsUpdated || 0);
      summary.restoredFromCloud.agendas =
        (restoreData.agendas?.restored || 0) +
        (restoreData.agendas?.updated || 0) +
        (restoreData.agendas?.configUpdated ? 1 : 0);
      summary.restoredFromCloud.notifications =
        (restoreData.notifications?.restored || 0) +
        (restoreData.notifications?.updated || 0);
    }
  }

  if (isOperatorSession) {
    const snapRes = await fetch(resolveApiUrl('/api/sync/snapshot'), {
      cache: 'no-store',
      credentials: 'include',
      headers: authHeaders,
    });
    if (snapRes.ok) {
      const snapshot = (await snapRes.json()) as ServerSyncSnapshot;
      summary.pushedToCloud = await syncSnapshotToCloud(snapshot);
    }
  }

  return summary;
}

export function runFullCloudSync(
  authHeaders: Record<string, string>,
  isOperatorSession: boolean
): Promise<CloudSyncSummary> {
  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }
  inFlightSyncPromise = executeFullCloudSync(authHeaders, isOperatorSession).finally(
    () => {
      inFlightSyncPromise = null;
    }
  );
  return inFlightSyncPromise;
}

export async function deleteSchoolAssetFromCloud(
  slot: SchoolFileSlot
): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid) return;
  const path = `${ASSETS_COL_PATH}/${slot}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'assets', slot));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteAccountFromCloud(accountId: string): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !accountId) return;
  const path = `${ACCOUNTS_COL_PATH}/${accountId}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'accounts', accountId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteStudentFromCloud(studentId: string): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !studentId) return;
  const path = `${STUDENTS_COL_PATH}/${studentId}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteTeacherFromCloud(teacherId: string): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !teacherId) return;
  const path = `${TEACHERS_COL_PATH}/${teacherId}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'teachers', teacherId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteLetterFromCloud(letterId: string): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !letterId) return;
  const path = `${LETTERS_COL_PATH}/${letterId}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'letters', letterId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteAttendanceFromCloud(
  attendanceId: string
): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !attendanceId) return;
  const path = `${ATTENDANCE_COL_PATH}/${attendanceId}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'attendance', attendanceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteAgendaFromCloud(agendaId: string): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !agendaId) return;
  const path = `${AGENDAS_COL_PATH}/${agendaId}`;
  try {
    await deleteDoc(doc(db, 'schools', SCHOOL_ID, 'agendas', agendaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteNotificationFromCloud(
  notificationId: string
): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || !notificationId) return;
  const path = `${NOTIFICATIONS_COL_PATH}/${notificationId}`;
  try {
    await deleteDoc(
      doc(db, 'schools', SCHOOL_ID, 'notifications', notificationId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteNotificationsFromCloud(
  notificationIds: string[]
): Promise<void> {
  const uid = getAuthenticatedCloudUid();
  if (!uid || notificationIds.length === 0) return;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < notificationIds.length; i += CHUNK_SIZE) {
    const chunk = notificationIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      if (!id) continue;
      batch.delete(doc(db, 'schools', SCHOOL_ID, 'notifications', id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        NOTIFICATIONS_COL_PATH
      );
    }
  }
}
