export type TeacherDataStatus = 'LENGKAP' | 'PERLU_PERIKSA';

export type TeacherPreviewRowStatus =
  | 'VALID'
  | 'SUDAH_ADA'
  | 'DUPLIKAT_FILE'
  | 'TIDAK_LENGKAP'
  | 'PERLU_PERIKSA';

export type TeacherImportConflictMode =
  | 'SKIP_EXISTING'
  | 'UPDATE_EXISTING'
  | 'INSERT_NEW_ONLY';

export type TeacherRowImportDecision = 'AUTO' | 'INSERT' | 'UPDATE' | 'SKIP';

export interface TeacherInputPayload {
  // A. Identitas Guru
  no: string;
  nama: string;
  nuptk: string;
  jk: string;
  tempatLahir: string;
  tanggalLahir: string;
  nip: string;
  statusKepegawaian: string;
  jenisPtk: string;
  agama: string;

  // B. Alamat dan Kontak
  alamatJalan: string;
  rt: string;
  rw: string;
  namaDusun: string;
  desaKelurahan: string;
  kecamatan: string;
  kodePos: string;
  telepon: string;
  hp: string;
  email: string;

  // C. Data Kepegawaian
  tugasTambahan: string;
  skCpns: string;
  tanggalCpns: string;
  skPengangkatan: string;
  tmtPengangkatan: string;
  lembagaPengangkatan: string;
  pangkatGolongan: string;
  sumberGaji: string;
  tmtPns: string;

  // D. Data Administrasi Tambahan
  namaIbuKandung: string;
  statusPerkawinan: string;
  namaSuamiIstri: string;
  nipSuamiIstri: string;
  pekerjaanSuamiIstri: string;
  sudahLisensi: string;
  kepalaSekolah: string;
  pernahDiklatKepengawasan: string;
  keahlianBraille: string;
  keahlianBahasaIsyarat: string;
  npwp: string;
  namaWajibPajak: string;
  kewarganegaraan: string;
  bank: string;
  nomorRekeningBank: string;
  rekeningAtasNama: string;
  nik: string;
  noKk: string;
  karpeg: string;
  karisKarsu: string;
  lintang: string;
  bujur: string;
  nuks: string;
  assignedClass?: string;
}

export interface TeacherRecord extends TeacherInputPayload {
  id: string;
  statusData: TeacherDataStatus;
  linkedAccountId: string | null;
  linkedAccountUsername?: string | null;
  linkedAccountStatus?: 'ACTIVE' | 'INACTIVE' | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherListItem {
  id: string;
  no: string;
  nama: string;
  nip: string;
  nuptk: string;
  jk: string;
  tempatLahir: string;
  tanggalLahir: string;
  statusKepegawaian: string;
  jenisPtk: string;
  email: string;
  hp: string;
  tugasTambahan: string;
  statusData: TeacherDataStatus;
  assignedClass: string;
  linkedAccountId: string | null;
  linkedAccountUsername: string | null;
  linkedAccountStatus: 'ACTIVE' | 'INACTIVE' | null;
  updatedAt: string;
}

export interface TeacherForAccountOption {
  id: string;
  nama: string;
  nip: string;
  nik: string;
  email: string;
  jenisPtk: string;
  statusKepegawaian: string;
  assignedClass: string;
  alreadyHasAccount: boolean;
  linkedUsername: string | null;
}

export interface TeacherPreviewRow {
  rowNumber: number;
  displayNo: string;
  status: TeacherPreviewRowStatus;
  issues: string[];
  matchedTeacherId: string | null;
  matchedTeacherName: string | null;
  matchedBy: 'NIP' | 'NUPTK' | 'AMBIGU' | null;
  summary: {
    no: string;
    nama: string;
    nip: string;
    nuptk: string;
    jk: string;
    statusKepegawaian: string;
    jenisPtk: string;
    email: string;
  };
}

export interface TeacherPreviewResult {
  previewId: string;
  filename: string;
  sheetName: string;
  headerRowNumber: number;
  detectedColumns: string[];
  summary: {
    totalRows: number;
    validCount: number;
    existingMatchCount: number;
    duplicateInFileCount: number;
    invalidCount: number;
    reviewCount: number;
  };
  rows: TeacherPreviewRow[];
}

export interface TeacherImportFailure {
  rowNumber: number;
  nama: string;
  nip: string;
  nuptk: string;
  reason: string;
}

export interface TeacherImportCommitResult {
  totalProcessed: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: TeacherImportFailure[];
}
