import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AttendanceContextInfo,
  AttendanceKetColumnMode,
  AttendanceSheetResponse,
  AttendanceStatus,
  AttendanceStudentEntry,
  AttendanceStudentRow,
  ClassHomeroomAssignment,
  MonthlyAttendanceResponse,
  MonthlyAttendanceStudentRow,
  MonthlyCellStatus,
  MonthlySchoolDaysMode,
} from '../types/attendance';
import type { TeacherListItem } from '../types/teacher';
import {
  deleteAttendanceSheet,
  downloadAttendanceExcel,
  downloadMonthlyAttendanceExcel,
  getAttendanceSheet,
  getMonthlyAttendance,
  saveAttendanceSheet,
  saveHomeroomAssignment,
  saveMonthlyAttendanceChanges,
} from '../lib/attendanceApi';
import {
  generateAttendancePdf,
  generateMonthlyAttendancePdf,
} from '../lib/attendancePdf';
import { listTeachers } from '../lib/teacherApi';
import { AbsenSiswaIcon } from './MenuIcons';

interface AttendancePageProps {
  userRole: 'OPERATOR' | 'GURU';
  assignedClass?: string;
  onOpenProfil?: () => void;
  onBack: () => void;
}

type AttendanceTab = 'HARIAN' | 'BULANAN';

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

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentMonthIso(): string {
  return getTodayIso().slice(0, 7);
}

function formatIndonesianDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((isoDate || '').trim());
  if (!m) return isoDate || '—';
  const year = m[1];
  const monthName = INDONESIAN_MONTHS[Number.parseInt(m[2], 10) - 1] || m[2];
  const day = m[3].padStart(2, '0');
  return `${day} ${monthName} ${year}`;
}

function formatIndonesianMonth(monthIso: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec((monthIso || '').trim());
  if (!m) return monthIso || '—';
  const year = m[1];
  const monthName = INDONESIAN_MONTHS[Number.parseInt(m[2], 10) - 1] || m[2];
  return `${monthName} ${year}`;
}

function formatCityTitleCase(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s./-])(\p{L})/gu, (_, sep: string, ch: string) => {
      return `${sep}${ch.toUpperCase()}`;
    });
}

function normalizeEffectiveDailyStatus(
  status?: AttendanceStatus | ''
): Exclude<AttendanceStatus, ''> {
  if (status === 'S' || status === 'I' || status === 'A') return status;
  return 'H';
}

function nextMonthlyStatus(
  current: MonthlyCellStatus
): Exclude<AttendanceStatus, ''> {
  if (current === 'H') return 'S';
  if (current === 'S') return 'I';
  if (current === 'I') return 'A';
  return 'H';
}

const STATUS_BUTTONS: Array<{
  code: Exclude<AttendanceStatus, ''>;
  label: string;
  activeClass: string;
}> = [
  {
    code: 'H',
    label: 'Hadir',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
  },
  {
    code: 'S',
    label: 'Sakit',
    activeClass: 'bg-amber-500 text-white border-amber-500 shadow-xs',
  },
  {
    code: 'I',
    label: 'Izin',
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-xs',
  },
  {
    code: 'A',
    label: 'Alpa',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-xs',
  },
];

const EMPTY_CONTEXT: AttendanceContextInfo = {
  schoolName: '',
  city: '',
  department: '',
  academicYear: '',
  principalName: '',
  principalPosition: '',
  principalNip: '',
  logoUrl: null,
  kopUrl: null,
};

export const AttendancePage: React.FC<AttendancePageProps> = ({
  userRole,
  assignedClass = '',
  onOpenProfil,
  onBack,
}) => {
  const isOperator = userRole === 'OPERATOR';
  const cleanAssignedClass = assignedClass.trim();

  const [activeTab, setActiveTab] = useState<AttendanceTab>('HARIAN');
  const [selectedRombel, setSelectedRombel] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIso);
  const [ketMode, setKetMode] = useState<AttendanceKetColumnMode>('STATUS_KET');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Daily state
  const [sheetData, setSheetData] = useState<AttendanceSheetResponse | null>(
    null
  );
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [entries, setEntries] = useState<
    Record<string, AttendanceStudentEntry>
  >({});
  const [waliKelas, setWaliKelas] = useState<ClassHomeroomAssignment>({
    rombel: '',
    teacherId: null,
    teacherName: '',
    teacherNip: '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Monthly recap state
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthIso);
  const [schoolDaysMode, setSchoolDaysMode] =
    useState<MonthlySchoolDaysMode>('5');
  const [monthlyData, setMonthlyData] =
    useState<MonthlyAttendanceResponse | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlySaving, setMonthlySaving] = useState(false);
  const [monthlyExportingExcel, setMonthlyExportingExcel] = useState(false);
  const [pendingMonthlyChanges, setPendingMonthlyChanges] = useState<
    Record<string, Record<string, AttendanceStudentEntry>>
  >({});

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadAttendanceData = useCallback(
    async (rombelArg: string, dateArg: string) => {
      setLoading(true);
      try {
        const data = await getAttendanceSheet({
          rombel: rombelArg,
          date: dateArg,
        });
        setSheetData(data);
        setSelectedRombel(data.selectedRombel);
        setSelectedDate(data.date);
        setWaliKelas(data.waliKelas);

        const nextEntries: Record<string, AttendanceStudentEntry> = {};
        for (const s of data.students) {
          nextEntries[s.id] = {
            status: normalizeEffectiveDailyStatus(s.status),
            note: s.note || '',
          };
        }
        setEntries(nextEntries);
        setIsDirty(false);
      } catch (err) {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal memuat data absensi siswa.',
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMonthlyData = useCallback(
    async (
      rombelArg: string,
      monthArg: string,
      schoolDaysArg: MonthlySchoolDaysMode
    ) => {
      setMonthlyLoading(true);
      try {
        const data = await getMonthlyAttendance({
          rombel: rombelArg,
          month: monthArg,
          schoolDays: schoolDaysArg,
        });
        setMonthlyData(data);
        if (data.selectedRombel) {
          setSelectedRombel(data.selectedRombel);
        }
        setSelectedMonth(data.month);
        setSchoolDaysMode(data.schoolDaysMode);
        setPendingMonthlyChanges({});
      } catch (err) {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal memuat rekap absensi bulanan.',
        });
      } finally {
        setMonthlyLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getAttendanceSheet({ date: getTodayIso() }),
      listTeachers().catch(() => ({
        totalAll: 0,
        employmentStatuses: [],
        ptkTypes: [],
        teachers: [] as TeacherListItem[],
      })),
    ])
      .then(([attData, teacherRes]) => {
        if (!mounted) return;
        setTeachers(
          [...(teacherRes.teachers || [])].sort((a, b) =>
            a.nama.localeCompare(b.nama, 'id')
          )
        );
        setSheetData(attData);
        setSelectedRombel(attData.selectedRombel);
        setSelectedDate(attData.date);
        setWaliKelas(attData.waliKelas);

        const nextEntries: Record<string, AttendanceStudentEntry> = {};
        for (const s of attData.students) {
          nextEntries[s.id] = {
            status: normalizeEffectiveDailyStatus(s.status),
            note: s.note || '',
          };
        }
        setEntries(nextEntries);
        setIsDirty(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal memuat data absensi siswa.',
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'BULANAN') return;
    if (!isOperator && !cleanAssignedClass) return;
    const rombelToLoad = isOperator ? selectedRombel : cleanAssignedClass;
    loadMonthlyData(rombelToLoad, selectedMonth, schoolDaysMode);
  }, [
    activeTab,
    isOperator,
    cleanAssignedClass,
    selectedRombel,
    selectedMonth,
    schoolDaysMode,
    loadMonthlyData,
  ]);

  const baseStudents = sheetData?.students ?? [];
  const context =
    (activeTab === 'BULANAN' ? monthlyData?.context : sheetData?.context) ??
    EMPTY_CONTEXT;
  const rombels =
    (activeTab === 'BULANAN' ? monthlyData?.rombels : sheetData?.rombels) ??
    sheetData?.rombels ??
    [];
  const savedDatesForRombel = sheetData?.savedDatesForRombel ?? [];

  const liveAllRows: AttendanceStudentRow[] = useMemo(() => {
    return baseStudents.map((s) => {
      const current = entries[s.id];
      return {
        ...s,
        status: normalizeEffectiveDailyStatus(current?.status ?? s.status),
        note: current?.note ?? s.note ?? '',
      };
    });
  }, [baseStudents, entries]);

  const filteredRows: AttendanceStudentRow[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return liveAllRows;
    return liveAllRows.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.nipd.toLowerCase().includes(q)
    );
  }, [liveAllRows, searchQuery]);

  const liveCounts = useMemo(() => {
    let male = 0;
    let female = 0;
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    for (const row of liveAllRows) {
      const jkClean = (row.jk || '').trim().toUpperCase();
      if (jkClean === 'L') male++;
      if (jkClean === 'P') female++;

      if (row.status === 'S') sakit++;
      else if (row.status === 'I') izin++;
      else if (row.status === 'A') alpa++;
      else hadir++;
    }

    return {
      total: liveAllRows.length,
      male,
      female,
      hadir,
      sakit,
      izin,
      alpa,
    };
  }, [liveAllRows]);

  // Monthly live data merging unsaved cell toggles
  const liveMonthlyData: MonthlyAttendanceResponse | null = useMemo(() => {
    if (!monthlyData) return null;
    const pendingDates = Object.keys(pendingMonthlyChanges);
    if (pendingDates.length === 0) return monthlyData;

    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlpa = 0;

    const updatedStudents: MonthlyAttendanceStudentRow[] =
      monthlyData.students.map((student) => {
        const nextStatuses: Record<string, MonthlyCellStatus> = {
          ...student.statuses,
        };
        const nextNotes: Record<string, string> = { ...student.notes };

        for (const dateKey of pendingDates) {
          const override = pendingMonthlyChanges[dateKey]?.[student.id];
          if (override) {
            nextStatuses[dateKey] = normalizeEffectiveDailyStatus(
              override.status
            );
            nextNotes[dateKey] = override.note || '';
          }
        }

        let hadir = 0;
        let sakit = 0;
        let izin = 0;
        let alpa = 0;

        for (const d of monthlyData.days) {
          const st = nextStatuses[d.date] ?? (d.isHoliday ? 'LIBUR' : 'H');
          if (st === 'LIBUR') continue;
          if (st === 'S') sakit++;
          else if (st === 'I') izin++;
          else if (st === 'A') alpa++;
          else hadir++;
        }

        totalHadir += hadir;
        totalSakit += sakit;
        totalIzin += izin;
        totalAlpa += alpa;

        return {
          ...student,
          statuses: nextStatuses,
          notes: nextNotes,
          totals: { hadir, sakit, izin, alpa },
        };
      });

    return {
      ...monthlyData,
      students: updatedStudents,
      summary: {
        ...monthlyData.summary,
        totalHadir,
        totalSakit,
        totalIzin,
        totalAlpa,
      },
    };
  }, [monthlyData, pendingMonthlyChanges]);

  const filteredMonthlyStudents: MonthlyAttendanceStudentRow[] = useMemo(() => {
    const list = liveMonthlyData?.students ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.nipd.toLowerCase().includes(q)
    );
  }, [liveMonthlyData, searchQuery]);

  const monthlyDirty = useMemo(() => {
    return Object.values(pendingMonthlyChanges).some(
      (dateEntries) => Object.keys(dateEntries).length > 0
    );
  }, [pendingMonthlyChanges]);

  const handleRombelChange = (nextRombel: string) => {
    setFeedback(null);
    setSearchQuery('');
    setSelectedRombel(nextRombel);
    if (activeTab === 'HARIAN') {
      loadAttendanceData(nextRombel, selectedDate);
    }
  };

  const handleDateChange = (nextDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    setFeedback(null);
    loadAttendanceData(selectedRombel, nextDate);
  };

  const refreshTeachersList = useCallback(async () => {
    try {
      const teacherRes = await listTeachers();
      setTeachers(
        [...(teacherRes.teachers || [])].sort((a, b) =>
          a.nama.localeCompare(b.nama, 'id')
        )
      );
    } catch {
      // Ignore refresh error
    }
  }, []);

  const handleSelectTeacherWali = async (teacherId: string) => {
    if (!isOperator) return;
    setFeedback(null);

    if (teacherId === '__CLEAR__') {
      const previousWali = sheetData?.waliKelas || {
        rombel: selectedRombel,
        teacherId: null,
        teacherName: '',
        teacherNip: '',
      };
      const cleared: ClassHomeroomAssignment = {
        rombel: selectedRombel,
        teacherId: null,
        teacherName: '',
        teacherNip: '',
      };
      setWaliKelas(cleared);

      if (selectedRombel) {
        try {
          const saved = await saveHomeroomAssignment({
            rombel: selectedRombel,
            teacherId: null,
            teacherName: '',
            teacherNip: '',
          });
          setWaliKelas(saved);
          setSheetData((prev) =>
            prev ? { ...prev, waliKelas: saved } : prev
          );
          await refreshTeachersList();
          setFeedback({
            type: 'success',
            message: `Wali Kelas ${selectedRombel} dikosongkan.`,
          });
        } catch (err) {
          setWaliKelas(previousWali);
          setFeedback({
            type: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Gagal mengosongkan wali kelas.',
          });
        }
      }
      return;
    }

    if (!teacherId) {
      const next: ClassHomeroomAssignment = {
        rombel: selectedRombel,
        teacherId: null,
        teacherName: waliKelas.teacherName,
        teacherNip: waliKelas.teacherNip,
      };
      setWaliKelas(next);
      setIsDirty(true);
      return;
    }

    const found = teachers.find((t) => t.id === teacherId);
    if (!found) return;

    const previousWali = sheetData?.waliKelas || {
      rombel: selectedRombel,
      teacherId: null,
      teacherName: '',
      teacherNip: '',
    };
    const next: ClassHomeroomAssignment = {
      rombel: selectedRombel,
      teacherId: found.id,
      teacherName: found.nama,
      teacherNip: found.nip || '',
    };
    setWaliKelas(next);

    if (selectedRombel) {
      try {
        const saved = await saveHomeroomAssignment({
          rombel: selectedRombel,
          teacherId: next.teacherId,
          teacherName: next.teacherName,
          teacherNip: next.teacherNip,
        });
        setWaliKelas(saved);
        setSheetData((prev) => (prev ? { ...prev, waliKelas: saved } : prev));
        await refreshTeachersList();
        setFeedback({
          type: 'success',
          message: `Wali Kelas ${selectedRombel} ditetapkan ke ${found.nama}.`,
        });
      } catch (err) {
        setWaliKelas(previousWali);
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Gagal menyimpan wali kelas.',
        });
      }
    }
  };

  const handleStatusToggle = (
    studentId: string,
    code: Exclude<AttendanceStatus, ''>
  ) => {
    setFeedback(null);
    setEntries((prev) => {
      const existing = prev[studentId] || { status: 'H', note: '' };
      const current = normalizeEffectiveDailyStatus(existing.status);
      // Clicking S/I/A again reverts back to default Hadir ('H')
      const nextStatus: Exclude<AttendanceStatus, ''> =
        code === 'H' ? 'H' : current === code ? 'H' : code;
      return {
        ...prev,
        [studentId]: {
          ...existing,
          status: nextStatus,
        },
      };
    });
    setIsDirty(true);
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setFeedback(null);
    setEntries((prev) => {
      const existing = prev[studentId] || { status: 'H', note: '' };
      return {
        ...prev,
        [studentId]: {
          status: normalizeEffectiveDailyStatus(existing.status),
          note,
        },
      };
    });
    setIsDirty(true);
  };

  const handleMarkAllHadir = () => {
    if (filteredRows.length === 0) return;
    setFeedback(null);
    setEntries((prev) => {
      const next = { ...prev };
      for (const s of filteredRows) {
        const existing = next[s.id] || { status: 'H', note: '' };
        next[s.id] = {
          ...existing,
          status: 'H',
        };
      }
      return next;
    });
    setIsDirty(true);
  };

  const buildNormalizedEntriesPayload = () => {
    const normalized: Record<string, AttendanceStudentEntry> = {};
    for (const s of liveAllRows) {
      normalized[s.id] = {
        status: normalizeEffectiveDailyStatus(s.status),
        note: s.note || '',
      };
    }
    return normalized;
  };

  const persistCurrentSheet = async (): Promise<boolean> => {
    if (!selectedRombel) {
      setFeedback({
        type: 'error',
        message: 'Pilih Kelas / Rombel terlebih dahulu sebelum menyimpan.',
      });
      return false;
    }
    const result = await saveAttendanceSheet({
      date: selectedDate,
      rombel: selectedRombel,
      waliKelasId: waliKelas.teacherId,
      waliKelasName: waliKelas.teacherName,
      waliKelasNip: waliKelas.teacherNip,
      entries: buildNormalizedEntriesPayload(),
    });
    setWaliKelas(result.homeroom);
    setIsDirty(false);
    await loadAttendanceData(selectedRombel, selectedDate);
    if (isOperator) {
      await refreshTeachersList();
    }
    return true;
  };

  const handleSaveDaily = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await persistCurrentSheet();
      if (saved) {
        setFeedback({
          type: 'success',
          message: `Absensi kelas ${selectedRombel} tanggal ${formatIndonesianDate(
            selectedDate
          )} berhasil disimpan.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDailyPdf = () => {
    if (liveAllRows.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Tidak ada data siswa pada kelas ini untuk dicetak ke PDF.',
      });
      return;
    }
    try {
      generateAttendancePdf({
        context,
        rombel: selectedRombel,
        date: selectedDate,
        waliKelas,
        students: liveAllRows,
        ketMode,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal membuat file PDF absensi siswa.',
      });
    }
  };

  const handleDownloadDailyExcel = async () => {
    if (liveAllRows.length === 0) {
      setFeedback({
        type: 'error',
        message:
          'Tidak ada data siswa pada kelas ini untuk diunduh ke Excel.',
      });
      return;
    }
    setExportingExcel(true);
    setFeedback(null);
    try {
      if (isDirty && selectedRombel) {
        await saveAttendanceSheet({
          date: selectedDate,
          rombel: selectedRombel,
          waliKelasId: waliKelas.teacherId,
          waliKelasName: waliKelas.teacherName,
          waliKelasNip: waliKelas.teacherNip,
          entries: buildNormalizedEntriesPayload(),
        });
        setIsDirty(false);
      }
      await downloadAttendanceExcel({
        rombel: selectedRombel,
        date: selectedDate,
        ketMode,
      });
      setFeedback({
        type: 'success',
        message: 'File Excel absensi siswa berhasil diunduh.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal mengunduh file Excel absensi siswa.',
      });
    } finally {
      setExportingExcel(false);
    }
  };

  // Monthly handlers
  const handleToggleMonthlyCell = (
    student: MonthlyAttendanceStudentRow,
    date: string,
    isHoliday: boolean
  ) => {
    if (isHoliday) return;
    setFeedback(null);
    const currentStatus = student.statuses[date] ?? 'H';
    const nextStatus = nextMonthlyStatus(currentStatus);
    const existingNote = student.notes[date] ?? '';

    setPendingMonthlyChanges((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [student.id]: {
          status: nextStatus,
          note: existingNote,
        },
      },
    }));
  };

  const commitMonthlyChanges = async (): Promise<boolean> => {
    const rombelTarget = liveMonthlyData?.selectedRombel || selectedRombel;
    if (!rombelTarget) {
      setFeedback({
        type: 'error',
        message: 'Pilih kelas terlebih dahulu sebelum menyimpan rekap bulanan.',
      });
      return false;
    }
    const changes = Object.entries(pendingMonthlyChanges)
      .filter(([, dateEntries]) => Object.keys(dateEntries).length > 0)
      .map(([date, dateEntries]) => ({
        date,
        entries: dateEntries,
      }));

    if (changes.length === 0) return true;

    await saveMonthlyAttendanceChanges({
      rombel: rombelTarget,
      changes,
    });
    await loadMonthlyData(rombelTarget, selectedMonth, schoolDaysMode);
    return true;
  };

  const handleSaveMonthly = async () => {
    setMonthlySaving(true);
    setFeedback(null);
    try {
      const ok = await commitMonthlyChanges();
      if (ok) {
        setFeedback({
          type: 'success',
          message: `Rekap absensi bulan ${formatIndonesianMonth(
            selectedMonth
          )} berhasil disimpan.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal menyimpan rekap absensi bulanan.',
      });
    } finally {
      setMonthlySaving(false);
    }
  };

  const handleDownloadMonthlyPdf = () => {
    if (!liveMonthlyData || liveMonthlyData.students.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Tidak ada data siswa pada bulan ini untuk dicetak ke PDF.',
      });
      return;
    }
    try {
      generateMonthlyAttendancePdf(liveMonthlyData);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal membuat file PDF rekap bulanan.',
      });
    }
  };

  const handleDownloadMonthlyExcel = async () => {
    if (!liveMonthlyData || liveMonthlyData.students.length === 0) {
      setFeedback({
        type: 'error',
        message:
          'Tidak ada data siswa pada bulan ini untuk diunduh ke Excel.',
      });
      return;
    }
    setMonthlyExportingExcel(true);
    setFeedback(null);
    try {
      if (monthlyDirty) {
        await commitMonthlyChanges();
      }
      await downloadMonthlyAttendanceExcel({
        rombel: liveMonthlyData.selectedRombel || selectedRombel,
        month: selectedMonth,
        schoolDays: schoolDaysMode,
      });
      setFeedback({
        type: 'success',
        message: 'File Excel rekap absensi bulanan berhasil diunduh.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal mengunduh file Excel rekap bulanan.',
      });
    } finally {
      setMonthlyExportingExcel(false);
    }
  };

  const handleJumpToDailyDate = (dateIso: string) => {
    setFeedback(null);
    setActiveTab('HARIAN');
    loadAttendanceData(
      isOperator ? selectedRombel : cleanAssignedClass,
      dateIso
    );
  };

  const handleDeleteSheet = async () => {
    if (!sheetData?.sheetId) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await deleteAttendanceSheet(sheetData.sheetId);
      setConfirmDeleteOpen(false);
      await loadAttendanceData(selectedRombel, selectedDate);
      setFeedback({
        type: 'success',
        message: `Catatan absensi tanggal ${formatIndonesianDate(
          selectedDate
        )} berhasil dihapus.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Gagal menghapus catatan absensi.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const cityFormatted = formatCityTitleCase(context.city || 'Bekasi');

  const activeBusy = activeTab === 'HARIAN' ? loading : monthlyLoading;
  const activeHasStudents =
    activeTab === 'HARIAN'
      ? liveAllRows.length > 0
      : (liveMonthlyData?.students.length ?? 0) > 0;
  const activeSaving = activeTab === 'HARIAN' ? saving : monthlySaving;
  const activeExportingExcel =
    activeTab === 'HARIAN' ? exportingExcel : monthlyExportingExcel;

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <header className="pt-3 sm:pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF867E] via-[#EF4E47] to-[#CC2B25] border border-[#FFB0AA]/75 px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_10px_24px_-6px_rgba(204,43,37,0.4)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali ke Beranda"
              className="min-w-[42px] min-h-[42px] inline-flex items-center justify-center rounded-xl bg-white/92 hover:bg-white text-[#7F1D1D] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <AbsenSiswaIcon className="w-11 h-11 shrink-0 hidden sm:block drop-shadow-xs" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(70,10,10,0.35)] truncate">
                Absen Siswa
              </h1>
              <p className="text-xs text-rose-50 font-medium truncate">
                {selectedRombel ? `Kelas ${selectedRombel}` : 'Daftar Hadir Kelas'}
                {' · '}
                {activeTab === 'HARIAN'
                  ? formatIndonesianDate(selectedDate)
                  : formatIndonesianMonth(selectedMonth)}
                {(activeTab === 'HARIAN' ? isDirty : monthlyDirty)
                  ? ' · Belum disimpan'
                  : ''}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* Segmented View Mode */}
            <div
              role="tablist"
              aria-label="Tampilan Absensi"
              className="inline-flex items-center rounded-xl bg-black/20 p-1 backdrop-blur-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'HARIAN'}
                onClick={() => {
                  setFeedback(null);
                  setActiveTab('HARIAN');
                }}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'HARIAN'
                    ? 'bg-white text-[#991B1B] shadow-xs'
                    : 'text-white/95 hover:bg-white/15'
                }`}
              >
                Absen Harian
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'BULANAN'}
                onClick={() => {
                  setFeedback(null);
                  setActiveTab('BULANAN');
                }}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'BULANAN'
                    ? 'bg-white text-[#991B1B] shadow-xs'
                    : 'text-white/95 hover:bg-white/15'
                }`}
              >
                Rekap Bulanan
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={
                  activeTab === 'HARIAN'
                    ? handleDownloadDailyPdf
                    : handleDownloadMonthlyPdf
                }
                disabled={activeBusy || !activeHasStudents}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-800 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                PDF
              </button>

              <button
                type="button"
                onClick={
                  activeTab === 'HARIAN'
                    ? handleDownloadDailyExcel
                    : handleDownloadMonthlyExcel
                }
                disabled={
                  activeBusy || activeExportingExcel || !activeHasStudents
                }
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 border border-white/25 disabled:opacity-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />
                {activeExportingExcel ? 'Menyiapkan...' : 'Excel'}
              </button>

              <button
                type="button"
                onClick={
                  activeTab === 'HARIAN' ? handleSaveDaily : handleSaveMonthly
                }
                disabled={
                  activeBusy ||
                  activeSaving ||
                  !selectedRombel ||
                  (activeTab === 'BULANAN' && !monthlyDirty)
                }
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#102547] hover:bg-[#17325C] border border-white/20 disabled:opacity-50 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Save className="w-4 h-4 shrink-0" />
                {activeSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pemberitahuan"
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isOperator && !cleanAssignedClass && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-900"
        >
          <span className="font-semibold">
            Anda belum memilih kelas yang dipegang di menu Profil.
          </span>
          {onOpenProfil && (
            <button
              type="button"
              onClick={onOpenProfil}
              className="self-start sm:self-auto rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
            >
              Pilih Kelas di Profil
            </button>
          )}
        </div>
      )}

      {activeTab === 'HARIAN' ? (
        <>
          {/* Daily Filter & Wali Kelas Panel */}
          <section
            aria-label="Filter Kelas, Tanggal, dan Wali Kelas"
            className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Rombel */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-rombel"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {isOperator ? 'Kelas / Rombongan Belajar' : 'Kelas Anda'}
                </label>
                <select
                  id="att-rombel"
                  value={selectedRombel}
                  onChange={(e) => handleRombelChange(e.target.value)}
                  disabled={!isOperator || loading || rombels.length === 0}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                >
                  {rombels.length === 0 ? (
                    <option value="">
                      {!isOperator && cleanAssignedClass
                        ? cleanAssignedClass
                        : 'Belum ada kelas'}
                    </option>
                  ) : (
                    rombels.map((rb) => (
                      <option key={rb} value={rb}>
                        {rb}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-date"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tanggal Absensi
                </label>
                <input
                  id="att-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                />
              </div>

              {/* Ket. Column Mode */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-ket-mode"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Isi Kolom &ldquo;Ket.&rdquo; (PDF &amp; Excel)
                </label>
                <select
                  id="att-ket-mode"
                  value={ketMode}
                  onChange={(e) =>
                    setKetMode(e.target.value as AttendanceKetColumnMode)
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                >
                  <option value="STATUS_KET">Status &amp; Keterangan</option>
                  <option value="NOTE_ONLY">Hanya Keterangan</option>
                  <option value="KOSONG">Kosong (Lembar Cetak)</option>
                </select>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-search"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Cari Nama / NISN / NIPD
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="att-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama siswa..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Wali Kelas Picker & Editable Fields */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="att-wali-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Pilih Wali Kelas (Data Guru)
                </label>
                <select
                  id="att-wali-select"
                  value={waliKelas.teacherId || ''}
                  disabled={!isOperator}
                  onChange={(e) => handleSelectTeacherWali(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                >
                  <option value="">Isi Manual / Pilih Guru...</option>
                  {(waliKelas.teacherId || waliKelas.teacherName) && (
                    <option value="__CLEAR__">-- Kosongkan Wali Kelas --</option>
                  )}
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama}
                      {t.nip ? ` (${t.nip})` : ''}
                      {t.assignedClass ? ` [Kelas: ${t.assignedClass}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="att-wali-name"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nama Wali Kelas (Tercetak)
                </label>
                <input
                  id="att-wali-name"
                  type="text"
                  value={waliKelas.teacherName}
                  disabled={!isOperator}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWaliKelas((prev) => ({ ...prev, teacherName: val }));
                    setIsDirty(true);
                  }}
                  placeholder="Nama lengkap & gelar wali kelas"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="att-wali-nip"
                  className="block text-xs font-semibold text-slate-700"
                >
                  NIP Wali Kelas
                </label>
                <input
                  id="att-wali-nip"
                  type="text"
                  value={waliKelas.teacherNip}
                  disabled={!isOperator}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWaliKelas((prev) => ({ ...prev, teacherNip: val }));
                    setIsDirty(true);
                  }}
                  placeholder="NIP wali kelas (opsional)"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 px-3 py-2 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Saved History Quick Jump & Batch Action */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 tabular-nums">
                <span className="font-semibold text-slate-800">
                  Total: {liveCounts.total}
                </span>
                <span aria-hidden="true">·</span>
                <span>L: {liveCounts.male}</span>
                <span aria-hidden="true">·</span>
                <span>P: {liveCounts.female}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium">
                  H: {liveCounts.hadir}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 font-medium">
                  S: {liveCounts.sakit}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-blue-700 font-medium">
                  I: {liveCounts.izin}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-rose-700 font-medium">
                  A: {liveCounts.alpa}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {savedDatesForRombel.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      aria-label="Riwayat tanggal absensi tersimpan"
                      value={
                        savedDatesForRombel.some((d) => d.date === selectedDate)
                          ? selectedDate
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) handleDateChange(e.target.value);
                      }}
                      className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">Riwayat tersimpan...</option>
                      {savedDatesForRombel.map((item) => (
                        <option key={item.id} value={item.date}>
                          {formatIndonesianDate(item.date)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleMarkAllHadir}
                  disabled={loading || filteredRows.length === 0}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                  Hadir Semua
                </button>

                {isOperator && sheetData?.sheetId && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Daily Attendance Sheet Table (6 Columns: No - NISN - NIPD - Nama - JK - Ket.) */}
          <section
            aria-label="Tabel Daftar Hadir Siswa"
            className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden"
          >
            {loading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="h-10 rounded-lg bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : liveAllRows.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="mx-auto w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  Belum Ada Data Siswa
                </h2>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[780px]">
                    <thead>
                      <tr className="bg-[#DCE8FA] text-[#17325C] border-b border-slate-300 text-xs font-bold">
                        <th className="py-3 px-2.5 text-center w-12 border-r border-slate-300/70">
                          No
                        </th>
                        <th className="py-3 px-3 text-center w-28 border-r border-slate-300/70">
                          NISN
                        </th>
                        <th className="py-3 px-3 text-center w-24 border-r border-slate-300/70">
                          NIPD
                        </th>
                        <th className="py-3 px-3 text-left border-r border-slate-300/70">
                          Nama
                        </th>
                        <th className="py-3 px-2.5 text-center w-14 border-r border-slate-300/70">
                          JK
                        </th>
                        <th className="py-3 px-3 text-left w-[340px]">Ket.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm text-slate-800">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-sm text-slate-500"
                          >
                            Tidak ada siswa yang cocok dengan pencarian &ldquo;
                            {searchQuery}&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((student, idx) => {
                          const effectiveStatus = normalizeEffectiveDailyStatus(
                            student.status
                          );
                          return (
                            <tr
                              key={student.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-2 px-2.5 text-center tabular-nums font-medium text-slate-600 border-r border-slate-200">
                                {searchQuery ? idx + 1 : student.noUrut}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-xs tabular-nums text-slate-700 border-r border-slate-200">
                                {student.nisn || '—'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-xs tabular-nums text-slate-700 border-r border-slate-200">
                                {student.nipd || '—'}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 border-r border-slate-200">
                                {student.nama}
                              </td>
                              <td className="py-2 px-2.5 text-center font-semibold text-slate-700 border-r border-slate-200">
                                {student.jk || '—'}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="inline-flex items-center gap-1 shrink-0"
                                    role="group"
                                    aria-label={`Kehadiran ${student.nama}`}
                                  >
                                    {STATUS_BUTTONS.map((btn) => {
                                      const active =
                                        effectiveStatus === btn.code;
                                      return (
                                        <button
                                          key={btn.code}
                                          type="button"
                                          title={btn.label}
                                          aria-label={`${btn.label} untuk ${student.nama}`}
                                          aria-pressed={active}
                                          onClick={() =>
                                            handleStatusToggle(
                                              student.id,
                                              btn.code
                                            )
                                          }
                                          className={`min-w-[32px] min-h-[32px] rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                            active
                                              ? btn.activeClass
                                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                          }`}
                                        >
                                          {btn.code}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <input
                                    type="text"
                                    aria-label={`Keterangan ${student.nama}`}
                                    value={
                                      ketMode === 'KOSONG'
                                        ? ''
                                        : student.note || ''
                                    }
                                    disabled={ketMode === 'KOSONG'}
                                    onChange={(e) =>
                                      handleNoteChange(
                                        student.id,
                                        e.target.value
                                      )
                                    }
                                    placeholder={
                                      ketMode === 'KOSONG'
                                        ? 'Kosong (lembar cetak)'
                                        : 'Keterangan...'
                                    }
                                    className="min-w-[140px] flex-1 min-h-[34px] rounded-lg border border-slate-200 bg-white disabled:bg-slate-50 px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Below Table: Jumlah L/P (Left) & Wali Kelas (Right) */}
                <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  {/* Left: Jumlah L / P */}
                  <div className="space-y-1.5 text-xs sm:text-sm text-slate-800">
                    <h3 className="font-bold text-[#17325C]">Jumlah Siswa</h3>
                    <div className="grid grid-cols-[120px_auto] gap-x-2 gap-y-1 tabular-nums">
                      <span className="text-slate-600">Laki-laki (L)</span>
                      <span className="font-semibold">
                        : {liveCounts.male} siswa
                      </span>
                      <span className="text-slate-600">Perempuan (P)</span>
                      <span className="font-semibold">
                        : {liveCounts.female} siswa
                      </span>
                      <span className="font-bold text-slate-900">
                        Total (L + P)
                      </span>
                      <span className="font-bold text-slate-900">
                        : {liveCounts.total} siswa
                      </span>
                    </div>
                    {ketMode !== 'KOSONG' && (
                      <p className="pt-1 text-xs text-slate-600 tabular-nums">
                        Rekap Kehadiran: Hadir {liveCounts.hadir} · Sakit{' '}
                        {liveCounts.sakit} · Izin {liveCounts.izin} · Alpa{' '}
                        {liveCounts.alpa}
                      </p>
                    )}
                  </div>

                  {/* Right: Wali Kelas */}
                  <div className="text-xs sm:text-sm text-slate-800 sm:min-w-[230px]">
                    <p>
                      {cityFormatted}, {formatIndonesianDate(selectedDate)}
                    </p>
                    <p className="font-medium text-slate-700">
                      Wali Kelas {selectedRombel || ''}
                    </p>
                    <div className="h-12" aria-hidden="true" />
                    <p className="font-bold text-slate-900 underline underline-offset-4">
                      {waliKelas.teacherName?.trim() ||
                        '........................................'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700 tabular-nums">
                      NIP. {waliKelas.teacherNip?.trim() || '—'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Monthly Filter Panel */}
          <section
            aria-label="Filter Rekap Absensi Bulanan"
            className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Rombel */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-month-rombel"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {isOperator ? 'Kelas / Rombongan Belajar' : 'Kelas Anda'}
                </label>
                <select
                  id="att-month-rombel"
                  value={selectedRombel}
                  onChange={(e) => handleRombelChange(e.target.value)}
                  disabled={
                    !isOperator || monthlyLoading || rombels.length === 0
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                >
                  {rombels.length === 0 ? (
                    <option value="">
                      {!isOperator && cleanAssignedClass
                        ? cleanAssignedClass
                        : 'Belum ada kelas'}
                    </option>
                  ) : (
                    rombels.map((rb) => (
                      <option key={rb} value={rb}>
                        {rb}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Month Picker */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-month"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Bulan Rekap
                </label>
                <input
                  id="att-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                      setFeedback(null);
                      setSelectedMonth(e.target.value);
                    }
                  }}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                />
              </div>

              {/* Active School Days Mode */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-school-days"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Hari Sekolah Efektif
                </label>
                <select
                  id="att-school-days"
                  value={schoolDaysMode}
                  onChange={(e) => {
                    setFeedback(null);
                    setSchoolDaysMode(e.target.value as MonthlySchoolDaysMode);
                  }}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                >
                  <option value="5">5 Hari (Senin – Jumat)</option>
                  <option value="6">6 Hari (Senin – Sabtu)</option>
                  <option value="7">Semua Tanggal (7 Hari)</option>
                </select>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <label
                  htmlFor="att-month-search"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Cari Nama / NISN / NIPD
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="att-month-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama siswa..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {liveMonthlyData && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-2.5 tabular-nums">
                  <span className="font-semibold text-slate-800">
                    Siswa: {liveMonthlyData.summary.totalStudents} (L{' '}
                    {liveMonthlyData.summary.male} / P{' '}
                    {liveMonthlyData.summary.female})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Hari Efektif: {liveMonthlyData.summary.activeDaysCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-medium">
                    H: {liveMonthlyData.summary.totalHadir}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-medium">
                    S: {liveMonthlyData.summary.totalSakit}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-blue-700 font-medium">
                    I: {liveMonthlyData.summary.totalIzin}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-700 font-medium">
                    A: {liveMonthlyData.summary.totalAlpa}
                  </span>
                </div>
                <span className="text-slate-500">
                  Klik sel tanggal untuk ubah status (H &rarr; S &rarr; I &rarr; A), atau klik nomor tanggal untuk buka harian.
                </span>
              </div>
            )}
          </section>

          {/* Monthly Matrix Table */}
          <section
            aria-label="Tabel Rekap Absensi Bulanan"
            className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden"
          >
            {monthlyLoading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="h-10 rounded-lg bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : !liveMonthlyData || liveMonthlyData.students.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="mx-auto w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  Belum Ada Data Siswa
                </h2>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#DCE8FA] text-[#17325C] border-b border-slate-300 font-bold">
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-center w-10 min-w-[40px] max-w-[40px] border-r border-slate-300/80 sticky left-0 z-20 bg-[#DCE8FA]"
                        >
                          No
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-center min-w-[92px] border-r border-slate-300/80"
                        >
                          NISN
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-center min-w-[82px] border-r border-slate-300/80"
                        >
                          NIPD
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-3 text-left min-w-[180px] border-r border-slate-300/80 sticky left-10 z-20 bg-[#DCE8FA]"
                        >
                          Nama
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-center w-10 min-w-[40px] max-w-[40px] border-r border-slate-300/80"
                        >
                          JK
                        </th>
                        <th
                          colSpan={liveMonthlyData.days.length}
                          className="py-1.5 px-2 text-center border-r border-slate-300/80"
                        >
                          Tanggal ({formatIndonesianMonth(selectedMonth)})
                        </th>
                        <th colSpan={4} className="py-1.5 px-2 text-center">
                          Jumlah
                        </th>
                      </tr>
                      <tr className="bg-[#EAF1FC] text-[#17325C] border-b border-slate-300 text-[11px] font-bold">
                        {liveMonthlyData.days.map((d) => (
                          <th
                            key={d.date}
                            className={`py-1 px-1 text-center min-w-[34px] border-r border-slate-300/70 tabular-nums ${
                              d.isHoliday ? 'bg-rose-50 text-rose-700' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleJumpToDailyDate(d.date)}
                              title={`Buka absen harian ${formatIndonesianDate(
                                d.date
                              )}`}
                              className="w-full flex flex-col items-center leading-tight hover:underline cursor-pointer"
                            >
                              <span>{d.day}</span>
                              <span className="text-[9px] font-medium opacity-75">
                                {d.weekdayShort}
                              </span>
                            </button>
                          </th>
                        ))}
                        <th className="py-1 px-2 text-center min-w-[32px] border-r border-slate-300/70 bg-amber-100/80 text-amber-900">
                          S
                        </th>
                        <th className="py-1 px-2 text-center min-w-[32px] border-r border-slate-300/70 bg-blue-100/80 text-blue-900">
                          I
                        </th>
                        <th className="py-1 px-2 text-center min-w-[32px] border-r border-slate-300/70 bg-rose-100/80 text-rose-900">
                          A
                        </th>
                        <th className="py-1 px-2 text-center min-w-[34px] bg-emerald-100/80 text-emerald-900">
                          H
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {filteredMonthlyStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9 + liveMonthlyData.days.length}
                            className="py-8 text-center text-sm text-slate-500"
                          >
                            Tidak ada siswa yang cocok dengan pencarian &ldquo;
                            {searchQuery}&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        filteredMonthlyStudents.map((student, idx) => (
                          <tr
                            key={student.id}
                            className="hover:bg-slate-50/90 transition-colors"
                          >
                            <td className="py-1.5 px-2 text-center w-10 min-w-[40px] max-w-[40px] tabular-nums font-medium text-slate-600 border-r border-slate-200 sticky left-0 z-10 bg-white">
                              {searchQuery ? idx + 1 : student.noUrut}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[11px] tabular-nums text-slate-700 border-r border-slate-200">
                              {student.nisn || '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[11px] tabular-nums text-slate-700 border-r border-slate-200">
                              {student.nipd || '—'}
                            </td>
                            <td className="py-1.5 px-3 font-medium text-slate-900 border-r border-slate-200 sticky left-10 z-10 bg-white whitespace-nowrap">
                              {student.nama}
                            </td>
                            <td className="py-1.5 px-2 text-center font-semibold text-slate-700 border-r border-slate-200">
                              {student.jk || '—'}
                            </td>

                            {liveMonthlyData.days.map((d) => {
                              const cellStatus: MonthlyCellStatus =
                                student.statuses[d.date] ??
                                (d.isHoliday ? 'LIBUR' : 'H');
                              const isDirtyCell = Boolean(
                                pendingMonthlyChanges[d.date]?.[student.id]
                              );

                              let cellStyle =
                                'bg-emerald-50/70 text-emerald-700 border-emerald-200/70 hover:bg-emerald-100';
                              let displayChar = 'H';

                              if (cellStatus === 'LIBUR') {
                                cellStyle =
                                  'bg-slate-100 text-slate-400 border-slate-200/70 cursor-default';
                                displayChar = '-';
                              } else if (cellStatus === 'S') {
                                cellStyle =
                                  'bg-amber-100 text-amber-900 border-amber-300 font-bold hover:bg-amber-200';
                                displayChar = 'S';
                              } else if (cellStatus === 'I') {
                                cellStyle =
                                  'bg-blue-100 text-blue-900 border-blue-300 font-bold hover:bg-blue-200';
                                displayChar = 'I';
                              } else if (cellStatus === 'A') {
                                cellStyle =
                                  'bg-rose-100 text-rose-900 border-rose-300 font-bold hover:bg-rose-200';
                                displayChar = 'A';
                              }

                              return (
                                <td
                                  key={d.date}
                                  className={`p-0.5 text-center border-r border-slate-200 ${
                                    d.isHoliday ? 'bg-slate-50/80' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    disabled={d.isHoliday}
                                    onClick={() =>
                                      handleToggleMonthlyCell(
                                        student,
                                        d.date,
                                        d.isHoliday
                                      )
                                    }
                                    title={
                                      d.isHoliday
                                        ? `${formatIndonesianDate(
                                            d.date
                                          )} (Libur)`
                                        : `${student.nama} · ${formatIndonesianDate(
                                            d.date
                                          )}: ${displayChar}`
                                    }
                                    className={`w-7 h-7 rounded-md border font-mono text-[11px] tabular-nums inline-flex items-center justify-center transition-colors ${
                                      d.isHoliday ? '' : 'cursor-pointer'
                                    } ${cellStyle} ${
                                      isDirtyCell
                                        ? 'ring-2 ring-blue-500/60'
                                        : ''
                                    }`}
                                  >
                                    {displayChar}
                                  </button>
                                </td>
                              );
                            })}

                            <td className="py-1.5 px-2 text-center font-bold tabular-nums text-amber-800 bg-amber-50/50 border-r border-slate-200">
                              {student.totals.sakit}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold tabular-nums text-blue-800 bg-blue-50/50 border-r border-slate-200">
                              {student.totals.izin}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold tabular-nums text-rose-800 bg-rose-50/50 border-r border-slate-200">
                              {student.totals.alpa}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold tabular-nums text-emerald-800 bg-emerald-50/50">
                              {student.totals.hadir}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Monthly Footer */}
                <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  <div className="space-y-1.5 text-xs sm:text-sm text-slate-800">
                    <h3 className="font-bold text-[#17325C]">
                      Rekapitulasi Siswa &amp; Kehadiran
                    </h3>
                    <div className="grid grid-cols-[120px_auto] gap-x-2 gap-y-1 tabular-nums">
                      <span className="text-slate-600">Laki-laki (L)</span>
                      <span className="font-semibold">
                        : {liveMonthlyData.summary.male} siswa
                      </span>
                      <span className="text-slate-600">Perempuan (P)</span>
                      <span className="font-semibold">
                        : {liveMonthlyData.summary.female} siswa
                      </span>
                      <span className="font-bold text-slate-900">
                        Total (L + P)
                      </span>
                      <span className="font-bold text-slate-900">
                        : {liveMonthlyData.summary.totalStudents} siswa
                      </span>
                    </div>
                    <p className="pt-1 text-xs text-slate-600 tabular-nums">
                      Keterangan: H = Hadir (otomatis jika tidak ada S/I/A), S =
                      Sakit, I = Izin, A = Alpa, - = Libur.
                    </p>
                  </div>

                  <div className="text-xs sm:text-sm text-slate-800 sm:min-w-[230px]">
                    <p>
                      {cityFormatted},{' '}
                      {liveMonthlyData.days.length > 0
                        ? formatIndonesianDate(
                            liveMonthlyData.days[
                              liveMonthlyData.days.length - 1
                            ].date
                          )
                        : formatIndonesianMonth(selectedMonth)}
                    </p>
                    <p className="font-medium text-slate-700">
                      Wali Kelas {liveMonthlyData.selectedRombel || ''}
                    </p>
                    <div className="h-12" aria-hidden="true" />
                    <p className="font-bold text-slate-900 underline underline-offset-4">
                      {liveMonthlyData.waliKelas.teacherName?.trim() ||
                        '........................................'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700 tabular-nums">
                      NIP. {liveMonthlyData.waliKelas.teacherNip?.trim() || '—'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* Delete Confirmation Modal (OPERATOR only) */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-att-delete-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5 sm:p-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="confirm-att-delete-title"
                  className="text-base font-bold text-slate-900 leading-snug"
                >
                  Hapus Catatan Absensi
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus catatan absensi kelas{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedRombel}
                  </span>{' '}
                  tanggal{' '}
                  <span className="font-semibold text-slate-800">
                    {formatIndonesianDate(selectedDate)}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteSheet}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
