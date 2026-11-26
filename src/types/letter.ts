export type LetterTypeId = 'SUKET_SISWA_DITERIMA' | 'SUKET_PINDAH_SEKOLAH';

export type LetterPaperSize = 'F4' | 'LEGAL';

export interface LetterTypeDefinition {
  id: LetterTypeId;
  title: string;
  shortTitle: string;
  description: string;
  defaultNumberCode: string;
  available: boolean;
}

export const LETTER_TYPE_REGISTRY: LetterTypeDefinition[] = [
  {
    id: 'SUKET_SISWA_DITERIMA',
    title: 'Surat Ket. Diterima',
    shortTitle: 'Surat Ket. Diterima',
    description: 'Surat keterangan bersedia menerima siswa pindahan.',
    defaultNumberCode: '421.2',
    available: true,
  },
  {
    id: 'SUKET_PINDAH_SEKOLAH',
    title: 'Surat Keterangan Pindah Sekolah',
    shortTitle: 'Suket. Pindah Sekolah',
    description: 'Surat keterangan pindah sekolah (F4 / Legal).',
    defaultNumberCode: '421.2',
    available: true,
  },
];

export interface StudentAcceptedLetterData {
  letterNumber: string;
  letterDate: string;
  letterCity: string;
  schoolLocationLine: string;
  studentId: string | null;
  studentName: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  religion: string;
  address: string;
  originSchool: string;
  targetClass: string;
  requirementClause: string;
  closingClause: string;
  nipdNisn: string;
  parentName: string;
  parentJob: string;
  destinationSchool: string;
  transferReason: string;
  paperSize: LetterPaperSize;
  showKop: boolean;
  showSignatureAssets: boolean;
}

export interface LetterRecord {
  id: string;
  type: LetterTypeId;
  title: string;
  letterNumber: string;
  letterDate: string;
  studentId: string | null;
  recipientName: string;
  data: StudentAcceptedLetterData;
  createdAt: string;
  updatedAt: string;
}

export interface LetterInputPayload {
  type: LetterTypeId;
  data: StudentAcceptedLetterData;
}
