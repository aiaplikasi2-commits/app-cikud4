import ExcelJS from 'exceljs';
import type {
  AttendanceContextInfo,
  AttendanceKetColumnMode,
  AttendanceStatus,
  AttendanceStudentRow,
  ClassHomeroomAssignment,
  MonthlyAttendanceResponse,
} from '../src/types/attendance.ts';

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

function formatKetCellValue(
  row: AttendanceStudentRow,
  mode: AttendanceKetColumnMode
): string {
  if (mode === 'KOSONG') return '';
  const cleanNote = (row.note || '').trim();
  if (mode === 'NOTE_ONLY') {
    if (cleanNote) return cleanNote;
    if (row.status === 'S') return 'Sakit';
    if (row.status === 'I') return 'Izin';
    if (row.status === 'A') return 'Alpa';
    return '';
  }

  // Default STATUS_KET: unmarked treated as Hadir
  const effectiveStatus: Exclude<AttendanceStatus, ''> =
    row.status === 'S' || row.status === 'I' || row.status === 'A'
      ? row.status
      : 'H';
  const labelMap: Record<Exclude<AttendanceStatus, ''>, string> = {
    H: 'Hadir',
    S: 'Sakit',
    I: 'Izin',
    A: 'Alpa',
  };
  const label = labelMap[effectiveStatus];
  return cleanNote ? `${label} (${cleanNote})` : label;
}

export async function buildAttendanceExcelBuffer(params: {
  context: AttendanceContextInfo;
  rombel: string;
  date: string;
  waliKelas: ClassHomeroomAssignment;
  students: AttendanceStudentRow[];
  ketMode: AttendanceKetColumnMode;
}): Promise<Buffer> {
  const { context, rombel, date, waliKelas, students, ketMode } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.schoolName || 'Sistem Administrasi Sekolah';
  workbook.created = new Date();

  const safeSheetName =
    `Absen ${rombel || 'Semua'}`
      .replace(/[\\/*?:[\]]/g, ' ')
      .trim()
      .slice(0, 31) || 'Absen Siswa';

  const sheet = workbook.addWorksheet(safeSheetName, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.45,
        right: 0.45,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // Column definitions: No - NISN - NIPD - Nama - JK - Ket.
  sheet.columns = [
    { key: 'no', width: 5.5 },
    { key: 'nisn', width: 16 },
    { key: 'nipd', width: 14 },
    { key: 'nama', width: 36 },
    { key: 'jk', width: 6.5 },
    { key: 'ket', width: 32 },
  ];

  const totalCols = 6;
  let rowIdx = 1;

  if (context.department?.trim()) {
    sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
    const cell = sheet.getCell(rowIdx, 1);
    cell.value = context.department.trim().toUpperCase();
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(rowIdx).height = 18;
    rowIdx++;
  }

  sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
  const schoolCell = sheet.getCell(rowIdx, 1);
  schoolCell.value = (context.schoolName || 'SEKOLAH').trim().toUpperCase();
  schoolCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF17325C' } };
  schoolCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 22;
  rowIdx++;

  sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
  const titleCell = sheet.getCell(rowIdx, 1);
  titleCell.value = 'DAFTAR HADIR / ABSEN SISWA';
  titleCell.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 20;
  rowIdx++;

  const formattedDate = formatIndonesianDate(date);
  const metaParts = [
    `Kelas / Rombel : ${rombel || 'Semua Kelas'}`,
    `Tanggal : ${formattedDate}`,
  ];
  if (context.academicYear?.trim()) {
    metaParts.push(`Tahun Pelajaran : ${context.academicYear.trim()}`);
  }
  sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
  const metaCell = sheet.getCell(rowIdx, 1);
  metaCell.value = metaParts.join('   |   ');
  metaCell.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF334155' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 18;
  rowIdx++;

  // Blank spacer row before table header
  sheet.getRow(rowIdx).height = 8;
  rowIdx++;

  // Table Header Row (EXACTLY: No - NISN - NIPD - Nama - JK - Ket.)
  const headerRowNum = rowIdx;
  const headerLabels = ['No', 'NISN', 'NIPD', 'Nama', 'JK', 'Ket.'];
  const headerRow = sheet.getRow(headerRowNum);
  headerRow.height = 24;

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    left: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'thin', color: { argb: 'FF475569' } },
    right: { style: 'thin', color: { argb: 'FF475569' } },
  };

  headerLabels.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF17325C' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCE8FA' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  // Repeat header row when printed in Excel
  sheet.pageSetup.printTitlesRow = `${headerRowNum}:${headerRowNum}`;
  rowIdx++;

  // Data Rows
  let maleCount = 0;
  let femaleCount = 0;

  students.forEach((student, idx) => {
    const jkClean = (student.jk || '').trim().toUpperCase();
    if (jkClean === 'L') maleCount++;
    if (jkClean === 'P') femaleCount++;

    const r = sheet.getRow(rowIdx);
    r.height = 20;

    const values = [
      idx + 1,
      student.nisn || '',
      student.nipd || '',
      student.nama || '',
      jkClean || '',
      formatKetCellValue(student, ketMode),
    ];

    values.forEach((val, colIdx) => {
      const cell = r.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      cell.border = thinBorder;

      if (colIdx === 1 || colIdx === 2) {
        cell.numFmt = '@';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 0 || colIdx === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });

    rowIdx++;
  });

  // Blank spacer row before footer
  sheet.getRow(rowIdx).height = 12;
  rowIdx++;

  // Footer: Jumlah L / P on Left, Wali Kelas on Right
  const cityFormatted = formatCityTitleCase(context.city || 'Bekasi');
  const footerStartRow = rowIdx;

  sheet.mergeCells(footerStartRow, 1, footerStartRow, 3);
  const sumHeaderCell = sheet.getCell(footerStartRow, 1);
  sumHeaderCell.value = 'Jumlah Siswa';
  sumHeaderCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF17325C' } };

  sheet.mergeCells(footerStartRow + 1, 1, footerStartRow + 1, 2);
  sheet.getCell(footerStartRow + 1, 1).value = 'Laki-laki (L)';
  sheet.getCell(footerStartRow + 1, 1).font = { name: 'Calibri', size: 10 };
  sheet.getCell(footerStartRow + 1, 3).value = `: ${maleCount} siswa`;
  sheet.getCell(footerStartRow + 1, 3).font = { name: 'Calibri', size: 10, bold: true };

  sheet.mergeCells(footerStartRow + 2, 1, footerStartRow + 2, 2);
  sheet.getCell(footerStartRow + 2, 1).value = 'Perempuan (P)';
  sheet.getCell(footerStartRow + 2, 1).font = { name: 'Calibri', size: 10 };
  sheet.getCell(footerStartRow + 2, 3).value = `: ${femaleCount} siswa`;
  sheet.getCell(footerStartRow + 2, 3).font = { name: 'Calibri', size: 10, bold: true };

  sheet.mergeCells(footerStartRow + 3, 1, footerStartRow + 3, 2);
  sheet.getCell(footerStartRow + 3, 1).value = 'Total (L + P)';
  sheet.getCell(footerStartRow + 3, 1).font = { name: 'Calibri', size: 10, bold: true };
  sheet.getCell(footerStartRow + 3, 3).value = `: ${students.length} siswa`;
  sheet.getCell(footerStartRow + 3, 3).font = { name: 'Calibri', size: 10, bold: true };

  // Right side Wali Kelas block (Columns E..F)
  sheet.mergeCells(footerStartRow, 5, footerStartRow, 6);
  const signDateCell = sheet.getCell(footerStartRow, 5);
  signDateCell.value = `${cityFormatted}, ${formattedDate}`;
  signDateCell.font = { name: 'Calibri', size: 10 };

  sheet.mergeCells(footerStartRow + 1, 5, footerStartRow + 1, 6);
  const waliRoleCell = sheet.getCell(footerStartRow + 1, 5);
  waliRoleCell.value = `Wali Kelas ${rombel || ''}`.trim();
  waliRoleCell.font = { name: 'Calibri', size: 10 };

  sheet.getRow(footerStartRow + 2).height = 20;
  sheet.getRow(footerStartRow + 3).height = 20;

  sheet.mergeCells(footerStartRow + 4, 5, footerStartRow + 4, 6);
  const waliNameCell = sheet.getCell(footerStartRow + 4, 5);
  waliNameCell.value =
    waliKelas.teacherName?.trim() || '........................................';
  waliNameCell.font = { name: 'Calibri', size: 10.5, bold: true, underline: true };

  sheet.mergeCells(footerStartRow + 5, 5, footerStartRow + 5, 6);
  const waliNipCell = sheet.getCell(footerStartRow + 5, 5);
  waliNipCell.value = `NIP. ${waliKelas.teacherNip?.trim() || '—'}`;
  waliNipCell.font = { name: 'Calibri', size: 10 };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function buildMonthlyAttendanceExcelBuffer(
  data: MonthlyAttendanceResponse
): Promise<Buffer> {
  const { context, selectedRombel, month, waliKelas, days, students, summary } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.schoolName || 'Sistem Administrasi Sekolah';
  workbook.created = new Date();

  const safeSheetName =
    `Rekap ${selectedRombel || 'Kelas'} ${month}`
      .replace(/[\\/*?:[\]]/g, ' ')
      .trim()
      .slice(0, 31) || 'Rekap Bulanan';

  const sheet = workbook.addWorksheet(safeSheetName, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  const dayCount = days.length;
  const totalCols = 5 + dayCount + 4; // No, NISN, NIPD, Nama, JK + days + S, I, A, H

  const cols: Array<{ key: string; width: number }> = [
    { key: 'no', width: 4.5 },
    { key: 'nisn', width: 14 },
    { key: 'nipd', width: 12 },
    { key: 'nama', width: 28 },
    { key: 'jk', width: 4.5 },
  ];
  for (const d of days) {
    cols.push({ key: `d_${d.day}`, width: 3.6 });
  }
  cols.push(
    { key: 'sakit', width: 4.8 },
    { key: 'izin', width: 4.8 },
    { key: 'alpa', width: 4.8 },
    { key: 'hadir', width: 5.5 }
  );
  sheet.columns = cols;

  let rowIdx = 1;

  if (context.department?.trim()) {
    sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
    const cell = sheet.getCell(rowIdx, 1);
    cell.value = context.department.trim().toUpperCase();
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(rowIdx).height = 17;
    rowIdx++;
  }

  sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
  const schoolCell = sheet.getCell(rowIdx, 1);
  schoolCell.value = (context.schoolName || 'SEKOLAH').trim().toUpperCase();
  schoolCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF17325C' } };
  schoolCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 20;
  rowIdx++;

  sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
  const titleCell = sheet.getCell(rowIdx, 1);
  titleCell.value = 'REKAPITULASI ABSENSI SISWA BULANAN';
  titleCell.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 19;
  rowIdx++;

  const monthLabel = formatIndonesianMonth(month);
  const metaParts = [
    `Kelas / Rombel : ${selectedRombel || 'Semua Kelas'}`,
    `Bulan : ${monthLabel}`,
  ];
  if (context.academicYear?.trim()) {
    metaParts.push(`Tahun Pelajaran : ${context.academicYear.trim()}`);
  }
  sheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
  const metaCell = sheet.getCell(rowIdx, 1);
  metaCell.value = metaParts.join('   |   ');
  metaCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 17;
  rowIdx++;

  sheet.getRow(rowIdx).height = 6;
  rowIdx++;

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    left: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'thin', color: { argb: 'FF475569' } },
    right: { style: 'thin', color: { argb: 'FF475569' } },
  };

  // Two-row Table Header
  const headerRow1Num = rowIdx;
  const headerRow2Num = rowIdx + 1;
  const headerRow1 = sheet.getRow(headerRow1Num);
  const headerRow2 = sheet.getRow(headerRow2Num);
  headerRow1.height = 19;
  headerRow2.height = 19;

  const fixedHeaders = ['No', 'NISN', 'NIPD', 'Nama', 'JK'];
  fixedHeaders.forEach((label, idx) => {
    const col = idx + 1;
    sheet.mergeCells(headerRow1Num, col, headerRow2Num, col);
    const cell = sheet.getCell(headerRow1Num, col);
    cell.value = label;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF17325C' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8FA' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
    sheet.getCell(headerRow2Num, col).border = thinBorder;
  });

  // Dates header group
  const firstDayCol = 6;
  const lastDayCol = 5 + dayCount;
  if (dayCount > 0) {
    sheet.mergeCells(headerRow1Num, firstDayCol, headerRow1Num, lastDayCol);
    const tglGroup = sheet.getCell(headerRow1Num, firstDayCol);
    tglGroup.value = `Tanggal (${monthLabel})`;
    tglGroup.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF17325C' } };
    tglGroup.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8FA' } };
    tglGroup.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = firstDayCol; c <= lastDayCol; c++) {
      sheet.getCell(headerRow1Num, c).border = thinBorder;
    }

    days.forEach((d, idx) => {
      const c = firstDayCol + idx;
      const cell = headerRow2.getCell(c);
      cell.value = d.day;
      cell.font = {
        name: 'Calibri',
        size: 9,
        bold: true,
        color: { argb: d.isHoliday ? 'FF9F1239' : 'FF17325C' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: d.isHoliday ? 'FFFEE2E2' : 'FFEBF2FD' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
  }

  // Summary header group: S, I, A, H
  const sumStartCol = lastDayCol + 1;
  sheet.mergeCells(headerRow1Num, sumStartCol, headerRow1Num, totalCols);
  const sumGroup = sheet.getCell(headerRow1Num, sumStartCol);
  sumGroup.value = 'Jumlah';
  sumGroup.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF17325C' } };
  sumGroup.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8FA' } };
  sumGroup.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = sumStartCol; c <= totalCols; c++) {
    sheet.getCell(headerRow1Num, c).border = thinBorder;
  }

  const sumHeaders = [
    { label: 'S', bg: 'FFFEF3C7', fg: 'FF92400E' },
    { label: 'I', bg: 'FFDBEAFE', fg: 'FF1E40AF' },
    { label: 'A', bg: 'FFFEE2E2', fg: 'FF9F1239' },
    { label: 'H', bg: 'FFD1FAE5', fg: 'FF065F46' },
  ];
  sumHeaders.forEach((item, idx) => {
    const cell = headerRow2.getCell(sumStartCol + idx);
    cell.value = item.label;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: item.fg } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.bg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  sheet.pageSetup.printTitlesRow = `${headerRow1Num}:${headerRow2Num}`;
  rowIdx += 2;

  // Student Rows
  students.forEach((student, idx) => {
    const r = sheet.getRow(rowIdx);
    r.height = 18;

    const fixedVals = [
      idx + 1,
      student.nisn || '',
      student.nipd || '',
      student.nama || '',
      (student.jk || '').trim().toUpperCase(),
    ];
    fixedVals.forEach((val, colIdx) => {
      const cell = r.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
      cell.border = thinBorder;
      if (colIdx === 1 || colIdx === 2) {
        cell.numFmt = '@';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 0 || colIdx === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });

    days.forEach((d, dayIdx) => {
      const c = firstDayCol + dayIdx;
      const cell = r.getCell(c);
      const st = student.statuses[d.date] ?? (d.isHoliday ? 'LIBUR' : 'H');
      cell.value = st === 'LIBUR' ? '-' : st;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (st === 'S') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF92400E' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else if (st === 'I') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E40AF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      } else if (st === 'A') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF9F1239' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else if (st === 'LIBUR') {
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      } else {
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF047857' } };
      }
    });

    const totalVals = [
      { v: student.totals.sakit, fg: 'FF92400E' },
      { v: student.totals.izin, fg: 'FF1E40AF' },
      { v: student.totals.alpa, fg: 'FF9F1239' },
      { v: student.totals.hadir, fg: 'FF065F46' },
    ];
    totalVals.forEach((item, tIdx) => {
      const cell = r.getCell(sumStartCol + tIdx);
      cell.value = item.v;
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: item.fg } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    rowIdx++;
  });

  sheet.getRow(rowIdx).height = 10;
  rowIdx++;

  // Footer: Left Jumlah Siswa + Legend, Right Wali Kelas
  const cityFormatted = formatCityTitleCase(context.city || 'Bekasi');
  const lastDayIso =
    days.length > 0 ? days[days.length - 1].date : `${month}-01`;
  const footerDateLabel = formatIndonesianDate(lastDayIso);
  const footerStartRow = rowIdx;

  const rightStartCol = Math.max(8, totalCols - 8);
  const leftEndCol = Math.max(4, Math.min(12, rightStartCol - 1));

  sheet.mergeCells(footerStartRow, 1, footerStartRow, leftEndCol);
  const sumHdr = sheet.getCell(footerStartRow, 1);
  sumHdr.value = `Jumlah Siswa : L = ${summary.male}  |  P = ${summary.female}  |  Total = ${summary.totalStudents} siswa`;
  sumHdr.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF17325C' } };

  sheet.mergeCells(footerStartRow + 1, 1, footerStartRow + 1, leftEndCol);
  const recHdr = sheet.getCell(footerStartRow + 1, 1);
  recHdr.value = `Total Bulan Ini (${summary.activeDaysCount} hari efektif) : H = ${summary.totalHadir}  |  S = ${summary.totalSakit}  |  I = ${summary.totalIzin}  |  A = ${summary.totalAlpa}`;
  recHdr.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF334155' } };

  sheet.mergeCells(footerStartRow + 2, 1, footerStartRow + 2, leftEndCol);
  const legendCell = sheet.getCell(footerStartRow + 2, 1);
  legendCell.value = 'Keterangan : H = Hadir (default bila tidak ada Sakit/Izin/Alpa), S = Sakit, I = Izin, A = Alpa, - = Hari Libur';
  legendCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };

  sheet.mergeCells(footerStartRow, rightStartCol, footerStartRow, totalCols);
  sheet.getCell(footerStartRow, rightStartCol).value = `${cityFormatted}, ${footerDateLabel}`;
  sheet.getCell(footerStartRow, rightStartCol).font = { name: 'Calibri', size: 10 };

  sheet.mergeCells(footerStartRow + 1, rightStartCol, footerStartRow + 1, totalCols);
  sheet.getCell(footerStartRow + 1, rightStartCol).value = `Wali Kelas ${selectedRombel || ''}`.trim();
  sheet.getCell(footerStartRow + 1, rightStartCol).font = { name: 'Calibri', size: 10 };

  sheet.getRow(footerStartRow + 2).height = 20;
  sheet.getRow(footerStartRow + 3).height = 20;

  sheet.mergeCells(footerStartRow + 4, rightStartCol, footerStartRow + 4, totalCols);
  const waliNameCell = sheet.getCell(footerStartRow + 4, rightStartCol);
  waliNameCell.value =
    waliKelas.teacherName?.trim() || '........................................';
  waliNameCell.font = { name: 'Calibri', size: 10, bold: true, underline: true };

  sheet.mergeCells(footerStartRow + 5, rightStartCol, footerStartRow + 5, totalCols);
  const waliNipCell = sheet.getCell(footerStartRow + 5, rightStartCol);
  waliNipCell.value = `NIP. ${waliKelas.teacherNip?.trim() || '—'}`;
  waliNipCell.font = { name: 'Calibri', size: 9.5 };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

