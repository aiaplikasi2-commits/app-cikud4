import * as XLSX from 'xlsx';
import type {
  TeacherImportCommitResult,
  TeacherInputPayload,
  TeacherPreviewRow,
  TeacherPreviewRowStatus,
  TeacherRecord,
} from '../src/types/teacher.ts';
import type { SchoolIdentity } from '../src/types/settings.ts';

export interface ParsedTeacherRowInternal {
  preview: TeacherPreviewRow;
  payload: TeacherInputPayload;
}

export interface ParsedTeacherWorkbook {
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
  rows: ParsedTeacherRowInternal[];
}

export class TeacherExcelParseError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function createEmptyTeacherPayload(): TeacherInputPayload {
  return {
    no: '',
    nama: '',
    nuptk: '',
    jk: '',
    tempatLahir: '',
    tanggalLahir: '',
    nip: '',
    statusKepegawaian: '',
    jenisPtk: '',
    agama: '',

    alamatJalan: '',
    rt: '',
    rw: '',
    namaDusun: '',
    desaKelurahan: '',
    kecamatan: '',
    kodePos: '',
    telepon: '',
    hp: '',
    email: '',

    tugasTambahan: '',
    skCpns: '',
    tanggalCpns: '',
    skPengangkatan: '',
    tmtPengangkatan: '',
    lembagaPengangkatan: '',
    pangkatGolongan: '',
    sumberGaji: '',
    tmtPns: '',

    namaIbuKandung: '',
    statusPerkawinan: '',
    namaSuamiIstri: '',
    nipSuamiIstri: '',
    pekerjaanSuamiIstri: '',
    sudahLisensi: '',
    kepalaSekolah: '',
    pernahDiklatKepengawasan: '',
    keahlianBraille: '',
    keahlianBahasaIsyarat: '',
    npwp: '',
    namaWajibPajak: '',
    kewarganegaraan: '',
    bank: '',
    nomorRekeningBank: '',
    rekeningAtasNama: '',
    nik: '',
    noKk: '',
    karpeg: '',
    karisKarsu: '',
    lintang: '',
    bujur: '',
    nuks: '',
    assignedClass: '',
  };
}

export const TEACHER_EXCEL_COLUMNS: Array<{
  field: keyof TeacherInputPayload;
  header: string;
  isIdentifier?: boolean;
  isDate?: boolean;
}> = [
  { field: 'no', header: 'No', isIdentifier: true },
  { field: 'nama', header: 'Nama' },
  { field: 'nuptk', header: 'NUPTK', isIdentifier: true },
  { field: 'jk', header: 'JK' },
  { field: 'tempatLahir', header: 'Tempat Lahir' },
  { field: 'tanggalLahir', header: 'Tanggal Lahir', isDate: true },
  { field: 'nip', header: 'NIP', isIdentifier: true },
  { field: 'statusKepegawaian', header: 'Status Kepegawaian' },
  { field: 'jenisPtk', header: 'Jenis PTK' },
  { field: 'agama', header: 'Agama' },

  { field: 'alamatJalan', header: 'Alamat Jalan' },
  { field: 'rt', header: 'RT', isIdentifier: true },
  { field: 'rw', header: 'RW', isIdentifier: true },
  { field: 'namaDusun', header: 'Nama Dusun' },
  { field: 'desaKelurahan', header: 'Desa/Kelurahan' },
  { field: 'kecamatan', header: 'Kecamatan' },
  { field: 'kodePos', header: 'Kode Pos', isIdentifier: true },
  { field: 'telepon', header: 'Telepon', isIdentifier: true },
  { field: 'hp', header: 'HP', isIdentifier: true },
  { field: 'email', header: 'Email' },

  { field: 'tugasTambahan', header: 'Tugas Tambahan' },
  { field: 'skCpns', header: 'SK CPNS', isIdentifier: true },
  { field: 'tanggalCpns', header: 'Tanggal CPNS', isDate: true },
  { field: 'skPengangkatan', header: 'SK Pengangkatan', isIdentifier: true },
  { field: 'tmtPengangkatan', header: 'TMT Pengangkatan', isDate: true },
  { field: 'lembagaPengangkatan', header: 'Lembaga Pengangkatan' },
  { field: 'pangkatGolongan', header: 'Pangkat Golongan' },
  { field: 'sumberGaji', header: 'Sumber Gaji' },
  { field: 'tmtPns', header: 'TMT PNS', isDate: true },

  { field: 'namaIbuKandung', header: 'Nama Ibu Kandung' },
  { field: 'statusPerkawinan', header: 'Status Perkawinan' },
  { field: 'namaSuamiIstri', header: 'Nama Suami/Istri' },
  { field: 'nipSuamiIstri', header: 'NIP Suami/Istri', isIdentifier: true },
  { field: 'pekerjaanSuamiIstri', header: 'Pekerjaan Suami/Istri' },
  { field: 'sudahLisensi', header: 'Sudah Lisensi' },
  { field: 'kepalaSekolah', header: 'Kepala Sekolah' },
  { field: 'pernahDiklatKepengawasan', header: 'Pernah Diklat Kepengawasan' },
  { field: 'keahlianBraille', header: 'Keahlian Braille' },
  { field: 'keahlianBahasaIsyarat', header: 'Keahlian Bahasa Isyarat' },
  { field: 'npwp', header: 'NPWP', isIdentifier: true },
  { field: 'namaWajibPajak', header: 'Nama Wajib Pajak' },
  { field: 'kewarganegaraan', header: 'Kewarganegaraan' },
  { field: 'bank', header: 'Bank' },
  { field: 'nomorRekeningBank', header: 'Nomor Rekening Bank', isIdentifier: true },
  { field: 'rekeningAtasNama', header: 'Rekening Atas Nama' },
  { field: 'nik', header: 'NIK', isIdentifier: true },
  { field: 'noKk', header: 'No KK', isIdentifier: true },
  { field: 'karpeg', header: 'Karpeg', isIdentifier: true },
  { field: 'karisKarsu', header: 'Karis/Karsu', isIdentifier: true },
  { field: 'lintang', header: 'Lintang', isIdentifier: true },
  { field: 'bujur', header: 'Bujur', isIdentifier: true },
  { field: 'nuks', header: 'NUKS', isIdentifier: true },
];

const HEADER_ALIASES: Record<string, keyof TeacherInputPayload> = {
  no: 'no',
  nomor: 'no',
  nama: 'nama',
  'nama guru': 'nama',
  'nama ptk': 'nama',
  nuptk: 'nuptk',
  jk: 'jk',
  'jenis kelamin': 'jk',
  'tempat lahir': 'tempatLahir',
  'tanggal lahir': 'tanggalLahir',
  'tgl lahir': 'tanggalLahir',
  nip: 'nip',
  'status kepegawaian': 'statusKepegawaian',
  'jenis ptk': 'jenisPtk',
  agama: 'agama',

  'alamat jalan': 'alamatJalan',
  alamat: 'alamatJalan',
  rt: 'rt',
  rw: 'rw',
  'nama dusun': 'namaDusun',
  dusun: 'namaDusun',
  'desa kelurahan': 'desaKelurahan',
  'desa/kelurahan': 'desaKelurahan',
  kelurahan: 'desaKelurahan',
  kecamatan: 'kecamatan',
  'kode pos': 'kodePos',
  kodepos: 'kodePos',
  telepon: 'telepon',
  telp: 'telepon',
  hp: 'hp',
  'no hp': 'hp',
  'nomor hp': 'hp',
  email: 'email',
  'e mail': 'email',

  'tugas tambahan': 'tugasTambahan',
  'sk cpns': 'skCpns',
  'tanggal cpns': 'tanggalCpns',
  'tgl cpns': 'tanggalCpns',
  'sk pengangkatan': 'skPengangkatan',
  'tmt pengangkatan': 'tmtPengangkatan',
  'lembaga pengangkatan': 'lembagaPengangkatan',
  'pangkat golongan': 'pangkatGolongan',
  'pangkat/golongan': 'pangkatGolongan',
  'sumber gaji': 'sumberGaji',
  'tmt pns': 'tmtPns',

  'nama ibu kandung': 'namaIbuKandung',
  'ibu kandung': 'namaIbuKandung',
  'status perkawinan': 'statusPerkawinan',
  'nama suami istri': 'namaSuamiIstri',
  'nama suami/istri': 'namaSuamiIstri',
  'nip suami istri': 'nipSuamiIstri',
  'nip suami/istri': 'nipSuamiIstri',
  'pekerjaan suami istri': 'pekerjaanSuamiIstri',
  'pekerjaan suami/istri': 'pekerjaanSuamiIstri',
  'sudah lisensi': 'sudahLisensi',
  'sudah lisensi kepala sekolah': 'sudahLisensi',
  'kepala sekolah': 'kepalaSekolah',
  'pernah diklat kepengawasan': 'pernahDiklatKepengawasan',
  'diklat kepengawasan': 'pernahDiklatKepengawasan',
  'keahlian braille': 'keahlianBraille',
  'keahlian bahasa isyarat': 'keahlianBahasaIsyarat',
  'keahlian bhs isyarat': 'keahlianBahasaIsyarat',
  npwp: 'npwp',
  'nama wajib pajak': 'namaWajibPajak',
  kewarganegaraan: 'kewarganegaraan',
  bank: 'bank',
  'nomor rekening bank': 'nomorRekeningBank',
  'no rekening bank': 'nomorRekeningBank',
  'rekening atas nama': 'rekeningAtasNama',
  nik: 'nik',
  'no kk': 'noKk',
  'nomor kk': 'noKk',
  karpeg: 'karpeg',
  'karis karsu': 'karisKarsu',
  'karis/karsu': 'karisKarsu',
  lintang: 'lintang',
  bujur: 'bujur',
  nuks: 'nuks',
};

const FIELD_META_MAP = new Map(
  TEACHER_EXCEL_COLUMNS.map((c) => [c.field, c])
);

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

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/[.():_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapHeaderToField(rawHeader: string): keyof TeacherInputPayload | null {
  const trimmed = rawHeader.trim();
  if (!trimmed) return null;
  const direct = trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
  if (HEADER_ALIASES[direct]) return HEADER_ALIASES[direct];

  const normalized = normalizeHeaderKey(trimmed);
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];

  const spaceSlash = normalized.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  if (HEADER_ALIASES[spaceSlash]) return HEADER_ALIASES[spaceSlash];

  return null;
}

function isValidExcelMagicBytes(buffer: Buffer, filename: string): boolean {
  if (buffer.length < 4) return false;
  const lower = filename.toLowerCase();
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle2 =
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  if (lower.endsWith('.xlsx')) {
    return isZip;
  }
  if (lower.endsWith('.xls')) {
    return isOle2 || isZip;
  }
  return isZip || isOle2;
}

function extractCellAsText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) {
    return '';
  }

  if (cell.t === 's') {
    const str = String(cell.v).trim();
    if (
      str === '-' ||
      str.toLowerCase() === 'null' ||
      str.toLowerCase() === 'undefined'
    ) {
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

    if (formatted && !hasScientific) {
      return formatted;
    }

    if (Math.abs(cell.v - Math.round(cell.v)) < 1e-6) {
      return BigInt(Math.round(cell.v)).toString();
    }
    return String(cell.v);
  }

  return String(cell.v ?? '').trim();
}

function extractIdentifierText(cell: XLSX.CellObject | undefined): string {
  const text = extractCellAsText(cell);
  if (!text) return '';
  const stripped = text.startsWith("'") && text.length > 1 ? text.slice(1).trim() : text.trim();
  if (stripped === '-') return '';
  return stripped;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1930 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
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
    return null;
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

export function parseTeacherDateCell(cell: XLSX.CellObject | undefined): {
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

  // DD-MM-YYYY or DD/MM/YYYY
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

  // "14 Mei 1985"
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

function getCell(
  ws: XLSX.WorkSheet,
  rowIdx: number,
  colIdx: number
): XLSX.CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  return ws[addr] as XLSX.CellObject | undefined;
}

function resolveHeaderMapForRow(
  ws: XLSX.WorkSheet,
  headerRowIdx: number,
  maxCol: number
): {
  colMap: Map<number, keyof TeacherInputPayload>;
  detectedColumns: string[];
} {
  const colMap = new Map<number, keyof TeacherInputPayload>();
  const detectedColumns: string[] = [];

  // Handle potential vertical merges landing on headerRowIdx
  const merges = ws['!merges'] || [];
  const rowTexts = new Map<number, string>();
  for (let c = 0; c <= maxCol; c++) {
    const txt = extractCellAsText(getCell(ws, headerRowIdx, c));
    if (txt) rowTexts.set(c, txt);
  }
  for (const m of merges) {
    if (m.s.r <= headerRowIdx && m.e.r >= headerRowIdx) {
      const anchor = extractCellAsText(getCell(ws, m.s.r, m.s.c));
      if (anchor) {
        for (let c = m.s.c; c <= Math.min(maxCol, m.e.c); c++) {
          if (!rowTexts.has(c)) rowTexts.set(c, anchor);
        }
      }
    }
  }

  for (let c = 0; c <= maxCol; c++) {
    const headerText = (rowTexts.get(c) || '').trim();
    if (!headerText) {
      // Safely ignore empty or unnamed columns
      continue;
    }
    const mapped = mapHeaderToField(headerText);
    if (mapped && !Array.from(colMap.values()).includes(mapped)) {
      colMap.set(c, mapped);
      detectedColumns.push(headerText);
    }
  }

  return { colMap, detectedColumns };
}

function detectTeacherHeaderRow(
  ws: XLSX.WorkSheet,
  range: XLSX.Range
): {
  headerRowIdx: number;
  colMap: Map<number, keyof TeacherInputPayload>;
  detectedColumns: string[];
} {
  // Primary check: row 5 (0-based index 4) per Dapodik teacher export specification
  const candidateRows = [4];
  for (let r = 0; r <= Math.min(12, range.e.r); r++) {
    if (r !== 4) candidateRows.push(r);
  }

  for (const r of candidateRows) {
    if (r > range.e.r) continue;
    const { colMap, detectedColumns } = resolveHeaderMapForRow(ws, r, range.e.c);
    const fields = new Set(colMap.values());
    const hasCore =
      fields.has('nama') &&
      (fields.has('nip') || fields.has('nuptk') || fields.has('jenisPtk')) &&
      colMap.size >= 5;
    if (hasCore) {
      return { headerRowIdx: r, colMap, detectedColumns };
    }
  }

  throw new TeacherExcelParseError(
    400,
    'Header tabel tidak ditemukan pada sheet "Daftar guru" (baris kelima harus memuat kolom Nama, NIP/NUPTK, Jenis PTK, dan kolom guru lainnya).'
  );
}

export function parseTeacherExcelBuffer(
  buffer: Buffer,
  filename: string,
  existingTeachers: TeacherRecord[]
): ParsedTeacherWorkbook {
  if (!isValidExcelMagicBytes(buffer, filename)) {
    throw new TeacherExcelParseError(
      400,
      'File bukan berkas Excel (.xlsx / .xls) yang valid.'
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
    throw new TeacherExcelParseError(
      400,
      'Gagal membaca file Excel. Pastikan file tidak rusak atau terenkripsi password.'
    );
  }

  const sheetKey =
    workbook.SheetNames.find((name) => name === 'Daftar guru') ||
    workbook.SheetNames.find(
      (name) => name.trim().toLowerCase() === 'daftar guru'
    );

  if (!sheetKey || !workbook.Sheets[sheetKey]) {
    throw new TeacherExcelParseError(
      400,
      `Sheet "Daftar guru" tidak ditemukan pada file Excel. Sheet yang ditemukan: ${
        workbook.SheetNames.join(', ') || '-'
      }.`
    );
  }

  const ws = workbook.Sheets[sheetKey];
  const ref = ws['!ref'];
  if (!ref) {
    throw new TeacherExcelParseError(400, 'Sheet "Daftar guru" kosong.');
  }

  const range = XLSX.utils.decode_range(ref);
  const { headerRowIdx, colMap, detectedColumns } = detectTeacherHeaderRow(
    ws,
    range
  );

  if (range.e.r <= headerRowIdx) {
    throw new TeacherExcelParseError(
      400,
      'Belum terdapat baris data guru setelah baris header.'
    );
  }

  // Existing lookups by NIP and NUPTK
  const existingByNip = new Map<string, TeacherRecord>();
  const existingByNuptk = new Map<string, TeacherRecord>();
  for (const t of existingTeachers) {
    if (t.nip.trim()) existingByNip.set(t.nip.trim(), t);
    if (t.nuptk.trim()) existingByNuptk.set(t.nuptk.trim(), t);
  }

  // Track duplicates inside the uploaded Excel file
  const seenFileNip = new Map<string, number>();
  const seenFileNuptk = new Map<string, number>();

  const rows: ParsedTeacherRowInternal[] = [];
  let validCount = 0;
  let existingMatchCount = 0;
  let duplicateInFileCount = 0;
  let invalidCount = 0;
  let reviewCount = 0;

  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    // Skip completely empty rows across mapped columns
    let hasAnyValue = false;
    for (const c of colMap.keys()) {
      if (extractCellAsText(getCell(ws, r, c)) !== '') {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) continue;

    const excelRowNum = r + 1;
    const payload = createEmptyTeacherPayload();
    const invalidDateReasons: string[] = [];

    for (const [colIdx, field] of colMap.entries()) {
      const cell = getCell(ws, r, colIdx);
      const meta = FIELD_META_MAP.get(field);

      if (meta?.isDate) {
        const parsedDate = parseTeacherDateCell(cell);
        payload[field] = parsedDate.value;
        if (parsedDate.value && !parsedDate.valid) {
          invalidDateReasons.push(
            `Format ${meta.header} "${parsedDate.value}" tidak valid`
          );
        }
      } else if (meta?.isIdentifier) {
        payload[field] = extractIdentifierText(cell);
      } else {
        payload[field] = extractCellAsText(cell);
      }
    }

    payload.jk = normalizeGender(payload.jk);

    // Skip trailing total/summary rows
    if (
      !payload.nama &&
      !payload.nip &&
      !payload.nuptk &&
      /^(jumlah|total)/i.test(payload.no)
    ) {
      continue;
    }

    const issues: string[] = [...invalidDateReasons];
    let isInvalid = false;
    let needsReview = invalidDateReasons.length > 0;

    if (!payload.nama) {
      isInvalid = true;
      issues.push('Nama guru kosong');
    }

    if (payload.jk && payload.jk !== 'L' && payload.jk !== 'P') {
      needsReview = true;
      issues.push(`Format JK "${payload.jk}" tidak standar (L/P)`);
    }

    if (
      payload.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
    ) {
      needsReview = true;
      issues.push(`Format email "${payload.email}" tidak valid`);
    }

    if (!payload.nip && !payload.nuptk) {
      needsReview = true;
      issues.push('NIP dan NUPTK keduanya kosong');
    }

    // Internal file duplicate detection on NIP & NUPTK
    let fileDuplicateOfRow: number | null = null;
    if (payload.nip) {
      const prev = seenFileNip.get(payload.nip);
      if (prev !== undefined) {
        fileDuplicateOfRow = prev;
        issues.push(`NIP ganda dengan baris ${prev} dalam file ini`);
      } else {
        seenFileNip.set(payload.nip, excelRowNum);
      }
    }
    if (payload.nuptk) {
      const prev = seenFileNuptk.get(payload.nuptk);
      if (prev !== undefined) {
        fileDuplicateOfRow = fileDuplicateOfRow ?? prev;
        issues.push(`NUPTK ganda dengan baris ${prev} dalam file ini`);
      } else {
        seenFileNuptk.set(payload.nuptk, excelRowNum);
      }
    }

    // Match against existing database (NIP primary, NUPTK secondary)
    let matchedTeacher: TeacherRecord | null = null;
    let matchedBy: TeacherPreviewRow['matchedBy'] = null;

    const matchNip = payload.nip ? existingByNip.get(payload.nip) || null : null;
    const matchNuptk = payload.nuptk
      ? existingByNuptk.get(payload.nuptk) || null
      : null;

    if (matchNip && matchNuptk && matchNip.id !== matchNuptk.id) {
      needsReview = true;
      matchedBy = 'AMBIGU';
      matchedTeacher = matchNip;
      issues.push(
        `NIP cocok dengan "${matchNip.nama}", tetapi NUPTK cocok dengan "${matchNuptk.nama}"`
      );
    } else if (matchNip) {
      matchedTeacher = matchNip;
      matchedBy = 'NIP';
    } else if (matchNuptk) {
      matchedTeacher = matchNuptk;
      matchedBy = 'NUPTK';
    }

    let status: TeacherPreviewRowStatus;
    if (isInvalid) {
      status = 'TIDAK_LENGKAP';
      invalidCount++;
    } else if (fileDuplicateOfRow !== null) {
      status = 'DUPLIKAT_FILE';
      duplicateInFileCount++;
    } else if (matchedBy === 'AMBIGU') {
      status = 'PERLU_PERIKSA';
      reviewCount++;
    } else if (matchedTeacher) {
      status = 'SUDAH_ADA';
      existingMatchCount++;
      issues.push(
        `Sudah terdaftar di database (${matchedBy}: ${matchedTeacher.nama})`
      );
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
        displayNo: payload.no || String(rows.length + 1),
        status,
        issues,
        matchedTeacherId: matchedTeacher ? matchedTeacher.id : null,
        matchedTeacherName: matchedTeacher ? matchedTeacher.nama : null,
        matchedBy,
        summary: {
          no: payload.no,
          nama: payload.nama,
          nip: payload.nip,
          nuptk: payload.nuptk,
          jk: payload.jk,
          statusKepegawaian: payload.statusKepegawaian,
          jenisPtk: payload.jenisPtk,
          email: payload.email,
        },
      },
      payload,
    });
  }

  if (rows.length === 0) {
    throw new TeacherExcelParseError(
      400,
      'Tidak ditemukan baris data guru setelah baris header pada sheet "Daftar guru".'
    );
  }

  return {
    sheetName: sheetKey,
    headerRowNumber: headerRowIdx + 1,
    detectedColumns,
    summary: {
      totalRows: rows.length,
      validCount,
      existingMatchCount,
      duplicateInFileCount,
      invalidCount,
      reviewCount,
    },
    rows,
  };
}

function setStringCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  val: string
): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { t: 's', v: val };
}

export function buildTeacherExcelWorkbookBuffer(
  teachers: TeacherRecord[],
  school?: Partial<SchoolIdentity>
): Buffer {
  const schoolName = school?.schoolName?.trim() || 'Nama Sekolah';
  const city = school?.city?.trim() || '';
  const department = school?.department?.trim() || '';
  const academicYear = school?.academicYear?.trim() || '';

  const ws: XLSX.WorkSheet = {};
  const colCount = TEACHER_EXCEL_COLUMNS.length;

  // Rows 1-4: School header information matching Dapodik teacher format (header at row 5)
  setStringCell(ws, 0, 0, 'DAFTAR GURU');
  setStringCell(ws, 1, 0, schoolName);
  setStringCell(
    ws,
    2,
    0,
    [department, city].filter(Boolean).join(' - ') || 'Data Induk Guru'
  );
  setStringCell(
    ws,
    3,
    0,
    academicYear ? `Tahun Ajaran: ${academicYear}` : 'Format Sesuai Dapodik (Header Baris 5)'
  );

  // Row 5 (index 4): Exact 52 column headers
  TEACHER_EXCEL_COLUMNS.forEach((col, idx) => {
    setStringCell(ws, 4, idx, col.header);
  });

  // Rows 6+: Teacher data (all stored cleanly as strings so IDs/bank numbers never convert to scientific notation)
  teachers.forEach((t, rowIdx) => {
    const targetRow = 5 + rowIdx;
    TEACHER_EXCEL_COLUMNS.forEach((col, colIdx) => {
      const value =
        col.field === 'no' ? t.no || String(rowIdx + 1) : t[col.field] || '';
      setStringCell(ws, targetRow, colIdx, String(value));
    });
  });

  const lastRow = Math.max(4, 4 + teachers.length);
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: colCount - 1 },
  });
  ws['!cols'] = TEACHER_EXCEL_COLUMNS.map((c) => ({
    wch: Math.max(14, c.header.length + 4),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar guru');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function buildTeacherImportReportBuffer(
  result: TeacherImportCommitResult
): Buffer {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ['LAPORAN HASIL IMPORT DATA GURU'],
    ['Waktu Laporan', new Date().toLocaleString('id-ID')],
    [],
    ['Ringkasan', 'Jumlah'],
    ['Total Data dalam Excel', result.totalProcessed],
    ['Berhasil Diimpor (Baru)', result.importedCount],
    ['Berhasil Diperbarui', result.updatedCount],
    ['Dilewati (Sudah Terdaftar / Duplikat)', result.skippedCount],
    ['Gagal', result.failedCount],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 36 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan Import');

  const failureHeader = [['Baris Excel', 'Nama Guru', 'NIP', 'NUPTK', 'Alasan']];
  const failureData =
    result.failures.length > 0
      ? result.failures.map((f) => [
          String(f.rowNumber),
          f.nama,
          f.nip || '-',
          f.nuptk || '-',
          f.reason,
        ])
      : [['-', 'Tidak ada baris gagal', '-', '-', '-']];
  const detailSheet = XLSX.utils.aoa_to_sheet([...failureHeader, ...failureData]);
  detailSheet['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 22 },
    { wch: 20 },
    { wch: 48 },
  ];
  XLSX.utils.book_append_sheet(wb, detailSheet, 'Detail Gagal');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
