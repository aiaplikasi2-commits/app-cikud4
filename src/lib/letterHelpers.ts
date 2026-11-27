import type { SchoolSettings } from '../types/settings';
import type { StudentRecord } from '../types/student';
import type { StudentAcceptedLetterData } from '../types/letter';

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

export function formatCityTitleCase(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s./-])(\p{L})/gu, (_, sep: string, ch: string) => {
      return `${sep}${ch.toUpperCase()}`;
    });
}

export function formatIndonesianFullDate(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  // Match YYYY-MM-DD
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (m) {
    const year = m[1];
    const monthIdx = Number.parseInt(m[2], 10) - 1;
    const day = m[3].padStart(2, '0');
    const monthName = INDONESIAN_MONTHS[monthIdx];
    if (monthName) {
      return `${day} ${monthName} ${year}`;
    }
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (m) {
    const day = m[1].padStart(2, '0');
    const monthIdx = Number.parseInt(m[2], 10) - 1;
    const year = m[3];
    const monthName = INDONESIAN_MONTHS[monthIdx];
    if (monthName) {
      return `${day} ${monthName} ${year}`;
    }
  }

  return trimmed;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildSchoolCodeAbbrev(schoolName: string): string {
  const clean = (schoolName || '').trim().toUpperCase();
  if (!clean) return 'SEKOLAH';

  // Detect SDN / SD NEGERI pattern like "SD NEGERI CIKETING UDIK 4" -> SDN.CU04
  const sdnMatch = /^(?:SDN|SD\s+NEGERI)\s+(.+)$/.exec(clean);
  if (sdnMatch) {
    const tokens = sdnMatch[1].split(/\s+/).filter(Boolean);
    const letters: string[] = [];
    let numPart = '';
    for (const token of tokens) {
      if (/^\d+$/.test(token)) {
        numPart = token.padStart(2, '0');
      } else if (token.length > 0) {
        letters.push(token[0]);
      }
    }
    const initials = letters.join('');
    if (initials || numPart) {
      return `SDN.${initials}${numPart}`;
    }
  }

  // Generic school acronym
  const words = clean.split(/\s+/).filter(Boolean);
  return words
    .map((w) => (/^\d+$/.test(w) ? w.padStart(2, '0') : w[0]))
    .join('')
    .slice(0, 12);
}

export function generateDefaultLetterNumber(
  sequenceNumber: number,
  schoolName: string,
  letterDateIso?: string
): string {
  const seq = String(Math.max(1, sequenceNumber)).padStart(3, '0');
  const dateObj =
    letterDateIso && /^\d{4}-\d{2}-\d{2}$/.test(letterDateIso)
      ? new Date(`${letterDateIso}T00:00:00`)
      : new Date();
  const romanMonth = ROMAN_MONTHS[dateObj.getMonth()] || 'I';
  const year = dateObj.getFullYear();
  const schoolCode = buildSchoolCodeAbbrev(schoolName);
  return `421.2/${seq}/${schoolCode}/${romanMonth}/${year}`;
}

export function mapGenderForLetter(jk: string): string {
  const normalized = (jk || '').trim().toUpperCase();
  if (normalized === 'L' || normalized.includes('LAKI')) {
    return 'Laki - Laki';
  }
  if (normalized === 'P' || normalized.includes('PEREMPUAN')) {
    return 'Perempuan';
  }
  return (jk || '').trim();
}

export function extractRomanClassForLetter(rombel: string): string {
  const trimmed = (rombel || '').trim();
  if (!trimmed) return '';

  const romanMap: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX',
    10: 'X',
    11: 'XI',
    12: 'XII',
  };

  const digitMatch = /(\d{1,2})/.exec(trimmed);
  if (digitMatch) {
    const grade = Number.parseInt(digitMatch[1], 10);
    if (romanMap[grade]) return romanMap[grade];
  }

  return trimmed;
}

export function buildAddressForLetter(student: StudentRecord): string {
  const parts: string[] = [];
  if (student.alamat?.trim()) {
    parts.push(student.alamat.trim());
  }
  if (student.rt?.trim() || student.rw?.trim()) {
    const rt = student.rt?.trim() ? `RT ${student.rt.trim()}` : '';
    const rw = student.rw?.trim() ? `RW ${student.rw.trim()}` : '';
    const rtrw = [rt, rw].filter(Boolean).join('/');
    if (rtrw && !parts.join(' ').toUpperCase().includes(rtrw.toUpperCase())) {
      parts.push(rtrw);
    }
  }
  if (
    student.kelurahan?.trim() &&
    !parts.join(' ').toLowerCase().includes(student.kelurahan.trim().toLowerCase())
  ) {
    parts.push(`Kel. ${student.kelurahan.trim()}`);
  }
  if (
    student.kecamatan?.trim() &&
    !parts.join(' ').toLowerCase().includes(student.kecamatan.trim().toLowerCase())
  ) {
    parts.push(`Kec. ${student.kecamatan.trim()}`);
  }
  return parts.join(', ');
}

export function createDefaultLetterData(
  settings: SchoolSettings,
  nextSequenceNumber: number
): StudentAcceptedLetterData {
  const today = getTodayIsoDate();
  return {
    letterNumber: generateDefaultLetterNumber(
      nextSequenceNumber,
      settings.identity.schoolName,
      today
    ),
    letterDate: today,
    letterCity: settings.identity.city?.trim() || '',
    schoolLocationLine: settings.identity.city?.trim() || '',
    studentId: null,
    studentName: '',
    birthPlace: '',
    birthDate: '',
    gender: 'Laki - Laki',
    religion: 'Islam',
    address: '',
    originSchool: '',
    targetClass: '',
    requirementClause:
      'Dengan ketentuan memenuhi syarat yang dibutuhkan sekolah yang dituju.',
    closingClause:
      'Demikian surat keterangan ini dibuat dengan sebenarnya dan dapat dipergunakan oleh yang bersangkutan dengan sebaik-baiknya.',
    nipdNisn: '',
    parentName: '',
    parentJob: '',
    destinationSchool: '',
    transferReason: 'permintaan orang tua / wali siswa',
    paperSize: 'F4',
    showKop: Boolean(settings.files.kop?.url || settings.files.logo?.url || settings.identity.schoolName?.trim()),
    showSignatureAssets: Boolean(
      settings.files.ttd?.url || settings.files.stempel?.url
    ),
    customTitle: '',
    customSubject: '',
    customAttachment: '',
    customRecipient: '',
    customBody: '',
    customCc: '',
    customUseSettingsSigner: true,
    customSignerPosition: '',
    customSignerName: '',
    customSignerNip: '',
  };
}

export function resolveCustomLetterSigner(
  data: StudentAcceptedLetterData,
  settings: SchoolSettings
): {
  position: string;
  name: string;
  nip: string;
  usesSettings: boolean;
} {
  const usesSettings = data.customUseSettingsSigner !== false;
  if (usesSettings) {
    return {
      position: settings.principal.position?.trim() || 'Kepala Sekolah',
      name: settings.principal.name?.trim() || '........................................',
      nip: settings.principal.nip?.trim() || '',
      usesSettings: true,
    };
  }
  return {
    position:
      data.customSignerPosition?.trim() ||
      settings.principal.position?.trim() ||
      'Kepala Sekolah',
    name:
      data.customSignerName?.trim() ||
      settings.principal.name?.trim() ||
      '........................................',
    nip: data.customSignerNip?.trim() || '',
    usesSettings: false,
  };
}

export function applyStudentToLetterData(
  current: StudentAcceptedLetterData,
  student: StudentRecord
): StudentAcceptedLetterData {
  const nipd = student.nipd?.trim() || '';
  const nisn = student.nisn?.trim() || '';
  const nipdNisn =
    nipd && nisn ? `${nipd} / ${nisn}` : nipd || nisn || current.nipdNisn;

  const parentName =
    student.ayah?.nama?.trim() ||
    student.ibu?.nama?.trim() ||
    student.wali?.nama?.trim() ||
    current.parentName;
  const parentJob =
    student.ayah?.pekerjaan?.trim() ||
    student.ibu?.pekerjaan?.trim() ||
    student.wali?.pekerjaan?.trim() ||
    current.parentJob;

  return {
    ...current,
    studentId: student.id,
    studentName: student.nama || '',
    birthPlace: student.tempatLahir || '',
    birthDate: student.tanggalLahir || '',
    gender: mapGenderForLetter(student.jk) || current.gender,
    religion: student.agama?.trim() || current.religion || 'Islam',
    address: buildAddressForLetter(student),
    originSchool: student.sekolahAsal || '',
    targetClass:
      student.rombelSaatIni?.trim() ||
      extractRomanClassForLetter(student.rombelSaatIni) ||
      current.targetClass,
    nipdNisn,
    parentName,
    parentJob,
  };
}
