import * as XLSX from 'xlsx';
import type {
  DapodikPreviewRow,
  ParentGuardianInfo,
  PreviewRowStatus,
  StudentInputPayload,
  StudentRecord,
} from '../src/types/student.ts';

export interface ParsedDapodikRowInternal {
  preview: DapodikPreviewRow;
  payload: StudentInputPayload;
}

export interface ParsedDapodikWorkbook {
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
  rows: ParsedDapodikRowInternal[];
}

export class DapodikParseError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function createEmptyParentInfo(): ParentGuardianInfo {
  return {
    nama: '',
    tahunLahir: '',
    jenjangPendidikan: '',
    pekerjaan: '',
    penghasilan: '',
    nik: '',
  };
}

export function createEmptyStudentPayload(): StudentInputPayload {
  return {
    no: '',
    nama: '',
    nipd: '',
    jk: '',
    nisn: '',
    tempatLahir: '',
    tanggalLahir: '',
    nik: '',
    agama: '',
    noRegistrasiAktaLahir: '',
    noKk: '',
    kebutuhanKhusus: '',
    anakKeBerapa: '',
    jmlSaudaraKandung: '',
    alamat: '',
    rt: '',
    rw: '',
    dusun: '',
    kelurahan: '',
    kecamatan: '',
    kodePos: '',
    jenisTinggal: '',
    alatTransportasi: '',
    telepon: '',
    hp: '',
    email: '',
    lintang: '',
    bujur: '',
    jarakRumahKeSekolahKm: '',
    ayah: createEmptyParentInfo(),
    ibu: createEmptyParentInfo(),
    wali: createEmptyParentInfo(),
    rombelSaatIni: '',
    sekolahAsal: '',
    skhun: '',
    noPesertaUjianNasional: '',
    noSeriIjazah: '',
    penerimaKps: '',
    noKps: '',
    penerimaKip: '',
    nomorKip: '',
    namaDiKip: '',
    nomorKks: '',
    bank: '',
    nomorRekeningBank: '',
    rekeningAtasNama: '',
    layakPip: '',
    alasanLayakPip: '',
    beratBadan: '',
    tinggiBadan: '',
    lingkarKepala: '',
  };
}

// Column indices A (0) through BN (65) — 66 total columns matching KELAS 6 DAPODIK.xlsx
const COL = {
  NO: 0, // A
  NAMA: 1, // B
  NIPD: 2, // C
  JK: 3, // D
  NISN: 4, // E
  TEMPAT_LAHIR: 5, // F
  TANGGAL_LAHIR: 6, // G
  NIK: 7, // H
  AGAMA: 8, // I
  ALAMAT: 9, // J
  RT: 10, // K
  RW: 11, // L
  DUSUN: 12, // M
  KELURAHAN: 13, // N
  KECAMATAN: 14, // O
  KODE_POS: 15, // P
  JENIS_TINGGAL: 16, // Q
  ALAT_TRANSPORTASI: 17, // R
  TELEPON: 18, // S
  HP: 19, // T
  EMAIL: 20, // U
  SKHUN: 21, // V
  PENERIMA_KPS: 22, // W
  NO_KPS: 23, // X

  // Y - AD: Data Ayah
  AYAH_NAMA: 24,
  AYAH_TAHUN_LAHIR: 25,
  AYAH_PENDIDIKAN: 26,
  AYAH_PEKERJAAN: 27,
  AYAH_PENGHASILAN: 28,
  AYAH_NIK: 29,

  // AE - AJ: Data Ibu
  IBU_NAMA: 30,
  IBU_TAHUN_LAHIR: 31,
  IBU_PENDIDIKAN: 32,
  IBU_PEKERJAAN: 33,
  IBU_PENGHASILAN: 34,
  IBU_NIK: 35,

  // AK - AP: Data Wali
  WALI_NAMA: 36,
  WALI_TAHUN_LAHIR: 37,
  WALI_PENDIDIKAN: 38,
  WALI_PEKERJAAN: 39,
  WALI_PENGHASILAN: 40,
  WALI_NIK: 41,

  // AQ - BN: Data Tambahan Siswa
  ROMBEL_SAAT_INI: 42, // AQ
  NO_PESERTA_UN: 43, // AR
  NO_SERI_IJAZAH: 44, // AS
  PENERIMA_KIP: 45, // AT
  NOMOR_KIP: 46, // AU
  NAMA_DI_KIP: 47, // AV
  NOMOR_KKS: 48, // AW
  NO_REG_AKTA_LAHIR: 49, // AX
  BANK: 50, // AY
  NO_REKENING_BANK: 51, // AZ
  REKENING_ATAS_NAMA: 52, // BA
  LAYAK_PIP: 53, // BB
  ALASAN_LAYAK_PIP: 54, // BC
  KEBUTUHAN_KHUSUS: 55, // BD
  SEKOLAH_ASAL: 56, // BE
  ANAK_KE_BERAPA: 57, // BF
  LINTANG: 58, // BG
  BUJUR: 59, // BH
  NO_KK: 60, // BI
  BERAT_BADAN: 61, // BJ
  TINGGI_BADAN: 62, // BK
  LINGKAR_KEPALA: 63, // BL
  JML_SAUDARA_KANDUNG: 64, // BM
  JARAK_RUMAH_KM: 65, // BN
} as const;

const TOTAL_DAPODIK_COLUMNS = 66;

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  aug: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
  dec: 12,
};

function isValidExcelMagicBytes(buffer: Buffer, filename: string): boolean {
  if (buffer.length < 4) return false;
  const lower = filename.toLowerCase();
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // PK (.xlsx)
  const isOle2 =
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0; // OLE2 (.xls)

  if (lower.endsWith('.xlsx')) {
    return isZip;
  }
  if (lower.endsWith('.xls')) {
    return isOle2 || isZip;
  }
  return isZip || isOle2;
}

/**
 * Extracts text cleanly without ever turning long ID numbers into scientific notation
 * and without dropping leading zeros when stored as string or formatted number.
 */
function extractCellAsText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) {
    return '';
  }

  if (cell.t === 's') {
    const str = String(cell.v).trim();
    if (str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
      return '';
    }
    return str;
  }

  if (cell.t === 'b') {
    return cell.v ? 'Ya' : 'Tidak';
  }

  if (cell.t === 'd' && cell.v instanceof Date) {
    const y = cell.v.getFullYear();
    const m = String(cell.v.getMonth() + 1).padStart(2, '0');
    const d = String(cell.v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (!Number.isFinite(cell.v)) return '';
    const formatted = typeof cell.w === 'string' ? cell.w.trim() : '';
    const hasScientific = /[eE][+-]?[0-9]+/.test(formatted);

    // Prefer Excel formatted text if it preserves digits/leading zeros without scientific notation
    if (formatted && !hasScientific) {
      return formatted;
    }

    // For large integers (e.g. NIK 16 digits, NISN, No KK), avoid JS float scientific notation
    if (Math.abs(cell.v - Math.round(cell.v)) < 1e-6) {
      return BigInt(Math.round(cell.v)).toString();
    }
    return String(cell.v);
  }

  return String(cell.v ?? '').trim();
}

/**
 * Specifically extracts identity numbers (NISN, NIK, NIPD, No KK, No Rekening, Kode Pos, Telepon, HP)
 * as exact strings, stripping unintended Excel leading apostrophes while preserving leading zeros.
 */
function extractIdentifierText(cell: XLSX.CellObject | undefined): string {
  const text = extractCellAsText(cell);
  if (!text) return '';
  if (text.startsWith("'") && text.length > 1) {
    return text.slice(1).trim();
  }
  return text.trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function excelSerialToParts(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) {
    return null;
  }
  const days = Math.floor(serial);
  if (days === 60) {
    return null; // Excel 1900 leap-year bug date
  }
  const baseUtc =
    days < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  const dt = new Date(baseUtc + days * 86400000);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

export function parseBirthDateCell(cell: XLSX.CellObject | undefined): {
  value: string;
  valid: boolean;
} {
  if (!cell || cell.v === undefined || cell.v === null) {
    return { value: '', valid: true };
  }

  if (cell.t === 'd' && cell.v instanceof Date) {
    const y = cell.v.getFullYear();
    const m = cell.v.getMonth() + 1;
    const d = cell.v.getDate();
    if (isValidCalendarDate(y, m, d)) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}`, valid: true };
    }
    return { value: String(cell.v), valid: false };
  }

  if (cell.t === 'n' && typeof cell.v === 'number') {
    const parsed = excelSerialToParts(cell.v);
    if (parsed && isValidCalendarDate(parsed.y, parsed.m, parsed.d)) {
      return {
        value: `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`,
        valid: true,
      };
    }
    return { value: extractCellAsText(cell), valid: false };
  }

  const raw = extractCellAsText(cell).replace(/^'/, '').trim();
  if (!raw) return { value: '', valid: true };

  // ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}`, valid: true };
    }
    return { value: raw, valid: false };
  }

  // DD-MM-YYYY or DD/MM/YYYY (Indonesian standard)
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}`, valid: true };
    }
    return { value: raw, valid: false };
  }

  // "14 Mei 2013"
  const textMonthMatch = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/.exec(raw);
  if (textMonthMatch) {
    const d = Number(textMonthMatch[1]);
    const monthKey = textMonthMatch[2].toLowerCase();
    const m = INDONESIAN_MONTHS[monthKey];
    const y = Number(textMonthMatch[3]);
    if (m && isValidCalendarDate(y, m, d)) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}`, valid: true };
    }
  }

  return { value: raw, valid: false };
}

function normalizeGender(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return '';
  if (cleaned === 'L' || cleaned === 'LAKI-LAKI' || cleaned === 'LAKI LAKI') {
    return 'L';
  }
  if (cleaned === 'P' || cleaned === 'PEREMPUAN') {
    return 'P';
  }
  return raw.trim();
}

function getCell(ws: XLSX.WorkSheet, rowIdx: number, colIdx: number): XLSX.CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  return ws[addr] as XLSX.CellObject | undefined;
}

/**
 * Resolves merged header cells in rows 1 and 2 (indices 0 and 1) and builds composite header labels
 * for columns A..BN without ever shifting indices when row 1 is empty.
 */
function buildCompositeHeaders(ws: XLSX.WorkSheet): string[] {
  const row0: string[] = new Array(TOTAL_DAPODIK_COLUMNS).fill('');
  const row1: string[] = new Array(TOTAL_DAPODIK_COLUMNS).fill('');

  for (let c = 0; c < TOTAL_DAPODIK_COLUMNS; c++) {
    row0[c] = extractCellAsText(getCell(ws, 0, c));
    row1[c] = extractCellAsText(getCell(ws, 1, c));
  }

  // Propagate merged header cells (e.g. Data Ayah Y1:AD1, Data Ibu AE1:AJ1, Data Wali AK1:AP1, or A1:A2)
  const merges = ws['!merges'] || [];
  for (const merge of merges) {
    if (merge.s.r > 1) continue;
    const anchorVal = extractCellAsText(getCell(ws, merge.s.r, merge.s.c));
    if (!anchorVal) continue;
    for (let r = merge.s.r; r <= Math.min(1, merge.e.r); r++) {
      for (let c = merge.s.c; c <= Math.min(TOTAL_DAPODIK_COLUMNS - 1, merge.e.c); c++) {
        if (r === 0 && !row0[c]) row0[c] = anchorVal;
        if (r === 1 && !row1[c]) row1[c] = anchorVal;
      }
    }
  }

  const headers: string[] = [];
  for (let c = 0; c < TOTAL_DAPODIK_COLUMNS; c++) {
    const top = row0[c].trim();
    const sub = row1[c].trim();
    if (top && sub && top.toLowerCase() !== sub.toLowerCase()) {
      headers.push(`${top} - ${sub}`);
    } else {
      headers.push(sub || top || '');
    }
  }
  return headers;
}

function validateDapodikHeaderStructure(headers: string[]): void {
  const bHeader = headers[COL.NAMA]?.toLowerCase() || '';
  const cHeader = headers[COL.NIPD]?.toLowerCase() || '';
  const eHeader = headers[COL.NISN]?.toLowerCase() || '';
  const aqHeader = headers[COL.ROMBEL_SAAT_INI]?.toLowerCase() || '';

  const hasNama = bHeader.includes('nama');
  const hasNipd = cHeader.includes('nipd');
  const hasNisn = eHeader.includes('nisn');
  const hasRombel = aqHeader.includes('rombel');

  if (!hasNama || (!hasNipd && !hasNisn) || !hasRombel) {
    throw new DapodikParseError(
      400,
      'Struktur kolom Excel tidak sesuai format Dapodik (Sheet1, baris 1–2 header, kolom A–BN dengan Nama, NIPD, NISN, dan Rombel Saat Ini).'
    );
  }
}

function isRowCompletelyEmpty(ws: XLSX.WorkSheet, rowIdx: number): boolean {
  for (let c = 0; c < TOTAL_DAPODIK_COLUMNS; c++) {
    if (extractCellAsText(getCell(ws, rowIdx, c)) !== '') {
      return false;
    }
  }
  return true;
}

export function parseDapodikExcelBuffer(
  buffer: Buffer,
  filename: string,
  existingStudents: StudentRecord[]
): ParsedDapodikWorkbook {
  if (!isValidExcelMagicBytes(buffer, filename)) {
    throw new DapodikParseError(
      400,
      'File bukan berkas Excel XLSX atau XLS yang valid.'
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellText: true,
      cellNF: true,
    });
  } catch {
    throw new DapodikParseError(
      400,
      'Gagal membaca file Excel. Pastikan file tidak rusak atau terenkripsi.'
    );
  }

  const sheetKey =
    workbook.SheetNames.find((name) => name === 'Sheet1') ||
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'sheet1');

  if (!sheetKey || !workbook.Sheets[sheetKey]) {
    throw new DapodikParseError(
      400,
      'Sheet "Sheet1" tidak ditemukan pada file Excel. Gunakan file hasil ekspor Dapodik asli.'
    );
  }

  const ws = workbook.Sheets[sheetKey];
  const ref = ws['!ref'];
  if (!ref) {
    throw new DapodikParseError(400, 'Sheet1 dalam file Excel kosong.');
  }

  const range = XLSX.utils.decode_range(ref);
  if (range.e.r < 2) {
    throw new DapodikParseError(
      400,
      'Belum terdapat baris data siswa pada baris ke-3 ke bawah di Sheet1.'
    );
  }

  const headers = buildCompositeHeaders(ws);
  validateDapodikHeaderStructure(headers);

  // Build existing lookup indexes
  const existingByNisn = new Map<string, StudentRecord>();
  const existingByNipd = new Map<string, StudentRecord>();
  const existingByNameDob = new Map<string, StudentRecord>();

  for (const s of existingStudents) {
    if (s.nisn.trim()) existingByNisn.set(s.nisn.trim(), s);
    if (s.nipd.trim()) existingByNipd.set(s.nipd.trim(), s);
    if (s.nama.trim() && s.tanggalLahir.trim()) {
      existingByNameDob.set(
        `${s.nama.trim().toLowerCase()}::${s.tanggalLahir.trim()}`,
        s
      );
    }
  }

  // Track duplicates within the uploaded Excel file
  const seenFileNisn = new Map<string, number>();
  const seenFileNipd = new Map<string, number>();
  const seenFileNameDob = new Map<string, number>();

  const rows: ParsedDapodikRowInternal[] = [];
  let validCount = 0;
  let incompleteCount = 0;
  let duplicateCount = 0;
  let reviewCount = 0;
  let existingMatchCount = 0;

  for (let r = 2; r <= range.e.r; r++) {
    if (isRowCompletelyEmpty(ws, r)) {
      continue;
    }

    const excelRowNum = r + 1;
    const birthDateParsed = parseBirthDateCell(getCell(ws, r, COL.TANGGAL_LAHIR));

    const payload: StudentInputPayload = {
      no: extractIdentifierText(getCell(ws, r, COL.NO)),
      nama: extractCellAsText(getCell(ws, r, COL.NAMA)),
      nipd: extractIdentifierText(getCell(ws, r, COL.NIPD)),
      jk: normalizeGender(extractCellAsText(getCell(ws, r, COL.JK))),
      nisn: extractIdentifierText(getCell(ws, r, COL.NISN)),
      tempatLahir: extractCellAsText(getCell(ws, r, COL.TEMPAT_LAHIR)),
      tanggalLahir: birthDateParsed.value,
      nik: extractIdentifierText(getCell(ws, r, COL.NIK)),
      agama: extractCellAsText(getCell(ws, r, COL.AGAMA)),
      alamat: extractCellAsText(getCell(ws, r, COL.ALAMAT)),
      rt: extractIdentifierText(getCell(ws, r, COL.RT)),
      rw: extractIdentifierText(getCell(ws, r, COL.RW)),
      dusun: extractCellAsText(getCell(ws, r, COL.DUSUN)),
      kelurahan: extractCellAsText(getCell(ws, r, COL.KELURAHAN)),
      kecamatan: extractCellAsText(getCell(ws, r, COL.KECAMATAN)),
      kodePos: extractIdentifierText(getCell(ws, r, COL.KODE_POS)),
      jenisTinggal: extractCellAsText(getCell(ws, r, COL.JENIS_TINGGAL)),
      alatTransportasi: extractCellAsText(getCell(ws, r, COL.ALAT_TRANSPORTASI)),
      telepon: extractIdentifierText(getCell(ws, r, COL.TELEPON)),
      hp: extractIdentifierText(getCell(ws, r, COL.HP)),
      email: extractCellAsText(getCell(ws, r, COL.EMAIL)),
      skhun: extractIdentifierText(getCell(ws, r, COL.SKHUN)),
      penerimaKps: extractCellAsText(getCell(ws, r, COL.PENERIMA_KPS)),
      noKps: extractIdentifierText(getCell(ws, r, COL.NO_KPS)),

      ayah: {
        nama: extractCellAsText(getCell(ws, r, COL.AYAH_NAMA)),
        tahunLahir: extractIdentifierText(getCell(ws, r, COL.AYAH_TAHUN_LAHIR)),
        jenjangPendidikan: extractCellAsText(getCell(ws, r, COL.AYAH_PENDIDIKAN)),
        pekerjaan: extractCellAsText(getCell(ws, r, COL.AYAH_PEKERJAAN)),
        penghasilan: extractCellAsText(getCell(ws, r, COL.AYAH_PENGHASILAN)),
        nik: extractIdentifierText(getCell(ws, r, COL.AYAH_NIK)),
      },

      ibu: {
        nama: extractCellAsText(getCell(ws, r, COL.IBU_NAMA)),
        tahunLahir: extractIdentifierText(getCell(ws, r, COL.IBU_TAHUN_LAHIR)),
        jenjangPendidikan: extractCellAsText(getCell(ws, r, COL.IBU_PENDIDIKAN)),
        pekerjaan: extractCellAsText(getCell(ws, r, COL.IBU_PEKERJAAN)),
        penghasilan: extractCellAsText(getCell(ws, r, COL.IBU_PENGHASILAN)),
        nik: extractIdentifierText(getCell(ws, r, COL.IBU_NIK)),
      },

      wali: {
        nama: extractCellAsText(getCell(ws, r, COL.WALI_NAMA)),
        tahunLahir: extractIdentifierText(getCell(ws, r, COL.WALI_TAHUN_LAHIR)),
        jenjangPendidikan: extractCellAsText(getCell(ws, r, COL.WALI_PENDIDIKAN)),
        pekerjaan: extractCellAsText(getCell(ws, r, COL.WALI_PEKERJAAN)),
        penghasilan: extractCellAsText(getCell(ws, r, COL.WALI_PENGHASILAN)),
        nik: extractIdentifierText(getCell(ws, r, COL.WALI_NIK)),
      },

      rombelSaatIni: extractCellAsText(getCell(ws, r, COL.ROMBEL_SAAT_INI)),
      noPesertaUjianNasional: extractIdentifierText(getCell(ws, r, COL.NO_PESERTA_UN)),
      noSeriIjazah: extractIdentifierText(getCell(ws, r, COL.NO_SERI_IJAZAH)),
      penerimaKip: extractCellAsText(getCell(ws, r, COL.PENERIMA_KIP)),
      nomorKip: extractIdentifierText(getCell(ws, r, COL.NOMOR_KIP)),
      namaDiKip: extractCellAsText(getCell(ws, r, COL.NAMA_DI_KIP)),
      nomorKks: extractIdentifierText(getCell(ws, r, COL.NOMOR_KKS)),
      noRegistrasiAktaLahir: extractIdentifierText(getCell(ws, r, COL.NO_REG_AKTA_LAHIR)),
      bank: extractCellAsText(getCell(ws, r, COL.BANK)),
      nomorRekeningBank: extractIdentifierText(getCell(ws, r, COL.NO_REKENING_BANK)),
      rekeningAtasNama: extractCellAsText(getCell(ws, r, COL.REKENING_ATAS_NAMA)),
      layakPip: extractCellAsText(getCell(ws, r, COL.LAYAK_PIP)),
      alasanLayakPip: extractCellAsText(getCell(ws, r, COL.ALASAN_LAYAK_PIP)),
      kebutuhanKhusus: extractCellAsText(getCell(ws, r, COL.KEBUTUHAN_KHUSUS)),
      sekolahAsal: extractCellAsText(getCell(ws, r, COL.SEKOLAH_ASAL)),
      anakKeBerapa: extractIdentifierText(getCell(ws, r, COL.ANAK_KE_BERAPA)),
      lintang: extractCellAsText(getCell(ws, r, COL.LINTANG)),
      bujur: extractCellAsText(getCell(ws, r, COL.BUJUR)),
      noKk: extractIdentifierText(getCell(ws, r, COL.NO_KK)),
      beratBadan: extractCellAsText(getCell(ws, r, COL.BERAT_BADAN)),
      tinggiBadan: extractCellAsText(getCell(ws, r, COL.TINGGI_BADAN)),
      lingkarKepala: extractCellAsText(getCell(ws, r, COL.LINGKAR_KEPALA)),
      jmlSaudaraKandung: extractIdentifierText(getCell(ws, r, COL.JML_SAUDARA_KANDUNG)),
      jarakRumahKeSekolahKm: extractCellAsText(getCell(ws, r, COL.JARAK_RUMAH_KM)),
    };

    // Skip trailing footer/summary row if Nama is empty and "No" says "Jumlah"/"Total"
    if (
      !payload.nama &&
      !payload.nisn &&
      !payload.nipd &&
      /^(jumlah|total)/i.test(payload.no)
    ) {
      continue;
    }

    const issues: string[] = [];
    let hasMissingRequired = false;
    let needsReview = false;

    if (!payload.nama) {
      hasMissingRequired = true;
      issues.push('Nama siswa kosong');
    }
    if (!payload.nisn && !payload.nipd) {
      hasMissingRequired = true;
      issues.push('NISN dan NIPD keduanya kosong');
    }
    if (!payload.jk) {
      hasMissingRequired = true;
      issues.push('Jenis kelamin (JK) kosong');
    } else if (payload.jk !== 'L' && payload.jk !== 'P') {
      needsReview = true;
      issues.push(`Format jenis kelamin "${payload.jk}" tidak standar (L/P)`);
    }

    if (!payload.tanggalLahir) {
      hasMissingRequired = true;
      issues.push('Tanggal lahir kosong');
    } else if (!birthDateParsed.valid) {
      needsReview = true;
      issues.push(`Format tanggal lahir "${payload.tanggalLahir}" tidak dikenali`);
    }

    if (!payload.rombelSaatIni) {
      hasMissingRequired = true;
      issues.push('Rombel Saat Ini kosong');
    }

    if (payload.nisn && !/^\d{10}$/.test(payload.nisn)) {
      needsReview = true;
      issues.push('NISN bukan 10 digit angka');
    }

    // Check internal file duplicates
    let fileDuplicateOfRow: number | null = null;
    if (payload.nisn) {
      const prev = seenFileNisn.get(payload.nisn);
      if (prev !== undefined) {
        fileDuplicateOfRow = prev;
        issues.push(`NISN ganda dengan baris ${prev} pada file ini`);
      } else {
        seenFileNisn.set(payload.nisn, excelRowNum);
      }
    }
    if (payload.nipd) {
      const prev = seenFileNipd.get(payload.nipd);
      if (prev !== undefined) {
        fileDuplicateOfRow = fileDuplicateOfRow ?? prev;
        issues.push(`NIPD ganda dengan baris ${prev} pada file ini`);
      } else {
        seenFileNipd.set(payload.nipd, excelRowNum);
      }
    }
    if (!payload.nisn && !payload.nipd && payload.nama && payload.tanggalLahir) {
      const key = `${payload.nama.toLowerCase()}::${payload.tanggalLahir}`;
      const prev = seenFileNameDob.get(key);
      if (prev !== undefined) {
        fileDuplicateOfRow = prev;
        issues.push(`Nama & tanggal lahir ganda dengan baris ${prev} pada file ini`);
      } else {
        seenFileNameDob.set(key, excelRowNum);
      }
    }

    // Check match with existing database (NISN primary, NIPD fallback)
    let matchedStudent: StudentRecord | null = null;
    let matchedBy: DapodikPreviewRow['matchedBy'] = null;

    const matchNisn = payload.nisn ? existingByNisn.get(payload.nisn) || null : null;
    const matchNipd = payload.nipd ? existingByNipd.get(payload.nipd) || null : null;

    if (matchNisn && matchNipd && matchNisn.id !== matchNipd.id) {
      needsReview = true;
      matchedBy = 'AMBIGU';
      matchedStudent = matchNisn;
      issues.push(
        `NISN cocok dengan "${matchNisn.nama}", tetapi NIPD cocok dengan "${matchNipd.nama}"`
      );
    } else if (matchNisn) {
      matchedStudent = matchNisn;
      matchedBy = 'NISN';
    } else if (matchNipd) {
      matchedStudent = matchNipd;
      matchedBy = 'NIPD';
    } else if (payload.nama && payload.tanggalLahir) {
      const nameDobMatch =
        existingByNameDob.get(
          `${payload.nama.toLowerCase()}::${payload.tanggalLahir}`
        ) || null;
      if (nameDobMatch) {
        matchedStudent = nameDobMatch;
        matchedBy = 'NAMA_TGL_LAHIR';
        needsReview = true;
        issues.push(
          `Nama & tanggal lahir mirip dengan siswa terdaftar "${nameDobMatch.nama}"`
        );
      }
    }

    let status: PreviewRowStatus;
    if (fileDuplicateOfRow !== null) {
      status = 'DUPLIKAT_FILE';
      duplicateCount++;
    } else if (matchedBy === 'AMBIGU' || matchedBy === 'NAMA_TGL_LAHIR') {
      status = 'PERLU_PERIKSA';
      reviewCount++;
    } else if (matchedStudent) {
      status = 'SUDAH_ADA';
      duplicateCount++;
      existingMatchCount++;
      if (issues.length === 0) {
        issues.push(`Data sudah ada (cocok ${matchedBy}: ${matchedStudent.nama})`);
      }
    } else if (hasMissingRequired) {
      status = 'TIDAK_LENGKAP';
      incompleteCount++;
    } else if (needsReview) {
      status = 'PERLU_PERIKSA';
      reviewCount++;
    } else {
      status = 'VALID';
      validCount++;
    }

    rows.push({
      preview: {
        rowNumber: excelRowNum,
        status,
        issues,
        matchedStudentId: matchedStudent ? matchedStudent.id : null,
        matchedStudentName: matchedStudent ? matchedStudent.nama : null,
        matchedBy,
        summary: {
          nama: payload.nama,
          nipd: payload.nipd,
          nisn: payload.nisn,
          jk: payload.jk,
          tanggalLahir: payload.tanggalLahir,
          rombelSaatIni: payload.rombelSaatIni,
        },
      },
      payload,
    });
  }

  if (rows.length === 0) {
    throw new DapodikParseError(
      400,
      'Tidak ditemukan baris data siswa pada baris 3 ke bawah di Sheet1.'
    );
  }

  return {
    sheetName: sheetKey,
    totalColumnsDetected: Math.min(TOTAL_DAPODIK_COLUMNS, range.e.c + 1),
    summary: {
      totalRows: rows.length,
      validCount,
      incompleteCount,
      duplicateCount,
      reviewCount,
      existingMatchCount,
    },
    rows,
  };
}
