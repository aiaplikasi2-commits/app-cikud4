export type AttendanceStatus = 'H' | 'S' | 'I' | 'A' | '';

export type AttendanceKetColumnMode = 'STATUS_KET' | 'NOTE_ONLY' | 'KOSONG';

export type MonthlySchoolDaysMode = '5' | '6' | '7';

export type MonthlyCellStatus = 'H' | 'S' | 'I' | 'A' | 'LIBUR';

export interface AttendanceStudentEntry {
  status: AttendanceStatus;
  note: string;
}

export interface ClassHomeroomAssignment {
  rombel: string;
  teacherId: string | null;
  teacherName: string;
  teacherNip: string;
  updatedAt?: string;
}

export interface AttendanceSheetRecord {
  id: string;
  date: string;
  rombel: string;
  waliKelasId: string | null;
  waliKelasName: string;
  waliKelasNip: string;
  entries: Record<string, AttendanceStudentEntry>;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceStorePayload {
  homerooms: Record<string, ClassHomeroomAssignment>;
  sheets: AttendanceSheetRecord[];
}

export interface AttendanceStudentRow {
  id: string;
  noUrut: number;
  nisn: string;
  nipd: string;
  nama: string;
  jk: string;
  rombelSaatIni: string;
  status: AttendanceStatus;
  note: string;
}

export interface AttendanceContextInfo {
  schoolName: string;
  city: string;
  department: string;
  academicYear: string;
  principalName: string;
  principalPosition: string;
  principalNip: string;
  logoUrl: string | null;
  kopUrl: string | null;
}

export interface AttendanceSheetResponse {
  context: AttendanceContextInfo;
  rombels: string[];
  selectedRombel: string;
  date: string;
  sheetId: string | null;
  waliKelas: ClassHomeroomAssignment;
  students: AttendanceStudentRow[];
  summary: {
    total: number;
    male: number;
    female: number;
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    unmarked: number;
  };
  savedDatesForRombel: Array<{
    id: string;
    date: string;
    updatedAt: string;
    updatedBy: string;
  }>;
}

export interface SaveAttendancePayload {
  date: string;
  rombel: string;
  waliKelasId: string | null;
  waliKelasName: string;
  waliKelasNip: string;
  entries: Record<string, AttendanceStudentEntry>;
}

export interface MonthlyDayInfo {
  day: number;
  date: string;
  weekday: number; // 0 = Minggu .. 6 = Sabtu
  weekdayShort: string; // Min, Sen, Sel, Rab, Kam, Jum, Sab
  isHoliday: boolean;
  hasSavedSheet: boolean;
}

export interface MonthlyAttendanceStudentRow {
  id: string;
  noUrut: number;
  nisn: string;
  nipd: string;
  nama: string;
  jk: string;
  rombelSaatIni: string;
  statuses: Record<string, MonthlyCellStatus>; // keyed by ISO date 'YYYY-MM-DD'
  notes: Record<string, string>; // keyed by ISO date 'YYYY-MM-DD'
  totals: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
  };
}

export interface MonthlyAttendanceResponse {
  context: AttendanceContextInfo;
  rombels: string[];
  selectedRombel: string;
  month: string; // 'YYYY-MM'
  schoolDaysMode: MonthlySchoolDaysMode;
  waliKelas: ClassHomeroomAssignment;
  days: MonthlyDayInfo[];
  students: MonthlyAttendanceStudentRow[];
  summary: {
    totalStudents: number;
    male: number;
    female: number;
    activeDaysCount: number;
    totalHadir: number;
    totalSakit: number;
    totalIzin: number;
    totalAlpa: number;
  };
}

export interface SaveMonthlyAttendanceChangesPayload {
  rombel: string;
  changes: Array<{
    date: string;
    entries: Record<string, AttendanceStudentEntry>;
  }>;
}

