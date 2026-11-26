export type StudentDataStatus = 'LENGKAP' | 'PERLU_PERIKSA';

export interface ParentGuardianInfo {
  nama: string;
  tahunLahir: string;
  jenjangPendidikan: string;
  pekerjaan: string;
  penghasilan: string;
  nik: string;
}

export interface StudentRecord {
  id: string;
  // 1. Identitas Siswa
  no: string;
  nama: string;
  nipd: string;
  jk: string;
  nisn: string;
  tempatLahir: string;
  tanggalLahir: string;
  nik: string;
  agama: string;
  noRegistrasiAktaLahir: string;
  noKk: string;
  kebutuhanKhusus: string;
  anakKeBerapa: string;
  jmlSaudaraKandung: string;

  // 2. Alamat dan Kontak
  alamat: string;
  rt: string;
  rw: string;
  dusun: string;
  kelurahan: string;
  kecamatan: string;
  kodePos: string;
  jenisTinggal: string;
  alatTransportasi: string;
  telepon: string;
  hp: string;
  email: string;
  lintang: string;
  bujur: string;
  jarakRumahKeSekolahKm: string;

  // 3. Data Ayah (Y-AD)
  ayah: ParentGuardianInfo;

  // 4. Data Ibu (AE-AJ)
  ibu: ParentGuardianInfo;

  // 5. Data Wali (AK-AP)
  wali: ParentGuardianInfo;

  // 6. Data Akademik
  rombelSaatIni: string;
  sekolahAsal: string;
  skhun: string;
  noPesertaUjianNasional: string;
  noSeriIjazah: string;

  // 7. Data Bantuan dan KIP/PIP
  penerimaKps: string;
  noKps: string;
  penerimaKip: string;
  nomorKip: string;
  namaDiKip: string;
  nomorKks: string;
  bank: string;
  nomorRekeningBank: string;
  rekeningAtasNama: string;
  layakPip: string;
  alasanLayakPip: string;

  // 8. Data Kesehatan dan Fisik
  beratBadan: string;
  tinggiBadan: string;
  lingkarKepala: string;

  // 9. Administrasi Tambahan
  statusData: StudentDataStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListItem {
  id: string;
  nama: string;
  nisn: string;
  nipd: string;
  jk: string;
  tempatLahir: string;
  tanggalLahir: string;
  rombelSaatIni: string;
  statusData: StudentDataStatus;
  updatedAt: string;
}

export type StudentInputPayload = Omit<
  StudentRecord,
  'id' | 'statusData' | 'createdAt' | 'updatedAt'
>;

export type PreviewRowStatus =
  | 'VALID'
  | 'SUDAH_ADA'
  | 'DUPLIKAT_FILE'
  | 'TIDAK_LENGKAP'
  | 'PERLU_PERIKSA';

export type ImportConflictMode =
  | 'INSERT_NEW_ONLY'
  | 'UPDATE_EXISTING'
  | 'SKIP_DUPLICATES';

export type RowImportDecision = 'AUTO' | 'INSERT' | 'UPDATE' | 'SKIP';

export interface DapodikPreviewRow {
  rowNumber: number;
  status: PreviewRowStatus;
  issues: string[];
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  matchedBy: 'NISN' | 'NIPD' | 'NAMA_TGL_LAHIR' | 'AMBIGU' | null;
  summary: {
    nama: string;
    nipd: string;
    nisn: string;
    jk: string;
    tanggalLahir: string;
    rombelSaatIni: string;
  };
}

export interface DapodikPreviewResult {
  previewId: string;
  filename: string;
  sheetName: string;
  totalColumnsDetected: number;
  summary: {
    totalRows: number;
    validCount: number;
    incompleteCount: number;
    duplicateCount: number;
    reviewCount: number;
    existingMatchCount: number;
  };
  rows: DapodikPreviewRow[];
}

export interface DapodikImportFailure {
  rowNumber: number;
  nama: string;
  reason: string;
}

export interface DapodikImportCommitResult {
  totalProcessed: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: DapodikImportFailure[];
}
