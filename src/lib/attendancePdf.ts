import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AttendanceContextInfo,
  AttendanceKetColumnMode,
  AttendanceStatus,
  AttendanceStudentRow,
  ClassHomeroomAssignment,
  MonthlyAttendanceResponse,
} from '../types/attendance';

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

function formatKetPdfValue(
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

export function generateAttendancePdf(params: {
  context: AttendanceContextInfo;
  rombel: string;
  date: string;
  waliKelas: ClassHomeroomAssignment;
  students: AttendanceStudentRow[];
  ketMode: AttendanceKetColumnMode;
}): void {
  const { context, rombel, date, waliKelas, students, ketMode } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  let cursorY = 14;

  if (context.department?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(context.department.trim().toUpperCase(), pageWidth / 2, cursorY, {
      align: 'center',
    });
    cursorY += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 50, 92);
  doc.text(
    (context.schoolName || 'SEKOLAH').trim().toUpperCase(),
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );
  cursorY += 4;

  doc.setDrawColor(23, 50, 92);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  doc.setLineWidth(0.2);
  doc.line(marginX, cursorY + 1, pageWidth - marginX, cursorY + 1);
  cursorY += 6.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('DAFTAR HADIR / ABSEN SISWA', pageWidth / 2, cursorY, {
    align: 'center',
  });
  cursorY += 5;

  const formattedDate = formatIndonesianDate(date);
  const metaParts = [
    `Kelas / Rombel : ${rombel || 'Semua Kelas'}`,
    `Tanggal : ${formattedDate}`,
  ];
  if (context.academicYear?.trim()) {
    metaParts.push(`Tahun Pelajaran : ${context.academicYear.trim()}`);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(metaParts.join('   |   '), pageWidth / 2, cursorY, {
    align: 'center',
  });
  cursorY += 4.5;

  let maleCount = 0;
  let femaleCount = 0;
  let hadir = 0;
  let sakit = 0;
  let izin = 0;
  let alpa = 0;

  const bodyRows = students.map((student, idx) => {
    const jkClean = (student.jk || '').trim().toUpperCase();
    if (jkClean === 'L') maleCount++;
    if (jkClean === 'P') femaleCount++;

    if (student.status === 'S') sakit++;
    else if (student.status === 'I') izin++;
    else if (student.status === 'A') alpa++;
    else hadir++;

    return [
      String(idx + 1),
      student.nisn || '',
      student.nipd || '',
      student.nama || '',
      jkClean || '',
      formatKetPdfValue(student, ketMode),
    ];
  });

  // Exact column header: No - NISN - NIPD - Nama - JK - Ket.
  // Total width = 10 + 30 + 26 + 64 + 12 + 40 = 182mm (210 - 2*14 = 182mm)
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX, top: 14, bottom: 14 },
    head: [['No', 'NISN', 'NIPD', 'Nama', 'JK', 'Ket.']],
    body: bodyRows,
    showHead: 'everyPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.8,
      cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
      textColor: [15, 23, 42],
      lineColor: [71, 85, 105],
      lineWidth: 0.2,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [220, 232, 250],
      textColor: [23, 50, 92],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 64, halign: 'left' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 40, halign: 'left' },
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? cursorY + 20;

  let footerY = finalY + 8;
  if (footerY + 42 > pageHeight - 12) {
    doc.addPage();
    footerY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(23, 50, 92);
  doc.text('Jumlah Siswa', marginX, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Laki-laki (L)', marginX, footerY + 5.5);
  doc.text(`: ${maleCount} siswa`, marginX + 28, footerY + 5.5);

  doc.text('Perempuan (P)', marginX, footerY + 11);
  doc.text(`: ${femaleCount} siswa`, marginX + 28, footerY + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('Total (L + P)', marginX, footerY + 16.5);
  doc.text(`: ${students.length} siswa`, marginX + 28, footerY + 16.5);

  if (ketMode !== 'KOSONG') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Rekap Kehadiran : Hadir ${hadir}  |  Sakit ${sakit}  |  Izin ${izin}  |  Alpa ${alpa}`,
      marginX,
      footerY + 23
    );
  }

  const rightColX = 128;
  const cityFormatted = formatCityTitleCase(context.city || 'Bekasi');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${cityFormatted}, ${formattedDate}`, rightColX, footerY);
  doc.text(`Wali Kelas ${rombel || ''}`.trim(), rightColX, footerY + 5.5);

  const signNameY = footerY + 25;
  const waliName =
    waliKelas.teacherName?.trim() || '........................................';
  doc.setFont('helvetica', 'bold');
  doc.text(waliName, rightColX, signNameY);

  const nameWidth = doc.getTextWidth(waliName);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(rightColX, signNameY + 0.8, rightColX + nameWidth, signNameY + 0.8);

  doc.setFont('helvetica', 'normal');
  doc.text(
    `NIP. ${waliKelas.teacherNip?.trim() || '—'}`,
    rightColX,
    signNameY + 5
  );

  const safeRombel = (rombel || 'semua')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  doc.save(`absen-siswa-${safeRombel || 'kelas'}-${date}.pdf`);
}

export function generateMonthlyAttendancePdf(data: MonthlyAttendanceResponse): void {
  const { context, selectedRombel, month, waliKelas, days, students, summary } = data;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 10; // usable width = 277mm
  let cursorY = 12;

  if (context.department?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(context.department.trim().toUpperCase(), pageWidth / 2, cursorY, {
      align: 'center',
    });
    cursorY += 4.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 50, 92);
  doc.text(
    (context.schoolName || 'SEKOLAH').trim().toUpperCase(),
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );
  cursorY += 3.5;

  doc.setDrawColor(23, 50, 92);
  doc.setLineWidth(0.5);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  doc.setLineWidth(0.2);
  doc.line(marginX, cursorY + 0.9, pageWidth - marginX, cursorY + 0.9);
  cursorY += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('REKAPITULASI ABSENSI SISWA BULANAN', pageWidth / 2, cursorY, {
    align: 'center',
  });
  cursorY += 4.5;

  const monthLabel = formatIndonesianMonth(month);
  const metaParts = [
    `Kelas / Rombel : ${selectedRombel || 'Semua Kelas'}`,
    `Bulan : ${monthLabel}`,
  ];
  if (context.academicYear?.trim()) {
    metaParts.push(`Tahun Pelajaran : ${context.academicYear.trim()}`);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(metaParts.join('   |   '), pageWidth / 2, cursorY, {
    align: 'center',
  });
  cursorY += 4;

  const dayCount = days.length || 30;
  const fixedTotalWidth = 7 + 21 + 17 + 44 + 7; // 96mm
  const summaryTotalWidth = 22.9; // ~5.7 * 4
  const dayAreaWidth = 277 - fixedTotalWidth - summaryTotalWidth; // 158.1mm
  const dayColWidth = dayAreaWidth / dayCount;

  const headRow1 = [
    { content: 'No', rowSpan: 2 },
    { content: 'NISN', rowSpan: 2 },
    { content: 'NIPD', rowSpan: 2 },
    { content: 'Nama', rowSpan: 2 },
    { content: 'JK', rowSpan: 2 },
    { content: `Tanggal (${monthLabel})`, colSpan: days.length },
    { content: 'Jumlah', colSpan: 4 },
  ];

  const headRow2 = [
    ...days.map((d) => ({
      content: String(d.day),
      styles: d.isHoliday
        ? {
            fillColor: [254, 226, 226] as [number, number, number],
            textColor: [159, 18, 57] as [number, number, number],
          }
        : undefined,
    })),
    { content: 'S', styles: { fillColor: [254, 243, 199] as [number, number, number], textColor: [146, 64, 14] as [number, number, number] } },
    { content: 'I', styles: { fillColor: [219, 234, 254] as [number, number, number], textColor: [30, 64, 175] as [number, number, number] } },
    { content: 'A', styles: { fillColor: [254, 226, 226] as [number, number, number], textColor: [159, 18, 57] as [number, number, number] } },
    { content: 'H', styles: { fillColor: [209, 250, 229] as [number, number, number], textColor: [6, 95, 70] as [number, number, number] } },
  ];

  const bodyRows = students.map((student, idx) => [
    String(idx + 1),
    student.nisn || '',
    student.nipd || '',
    student.nama || '',
    (student.jk || '').trim().toUpperCase(),
    ...days.map((d) => {
      const st = student.statuses[d.date] ?? (d.isHoliday ? 'LIBUR' : 'H');
      return st === 'LIBUR' ? '-' : st;
    }),
    String(student.totals.sakit),
    String(student.totals.izin),
    String(student.totals.alpa),
    String(student.totals.hadir),
  ]);

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: 7, halign: 'center' },
    1: { cellWidth: 21, halign: 'center' },
    2: { cellWidth: 17, halign: 'center' },
    3: { cellWidth: 44, halign: 'left' },
    4: { cellWidth: 7, halign: 'center' },
  };
  for (let i = 0; i < days.length; i++) {
    columnStyles[5 + i] = { cellWidth: dayColWidth, halign: 'center' };
  }
  const sumBaseIdx = 5 + days.length;
  columnStyles[sumBaseIdx] = { cellWidth: 5.7, halign: 'center' };
  columnStyles[sumBaseIdx + 1] = { cellWidth: 5.7, halign: 'center' };
  columnStyles[sumBaseIdx + 2] = { cellWidth: 5.7, halign: 'center' };
  columnStyles[sumBaseIdx + 3] = { cellWidth: 5.8, halign: 'center' };

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX, top: 12, bottom: 12 },
    head: [headRow1, headRow2],
    body: bodyRows,
    showHead: 'everyPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: { top: 1.2, right: 0.7, bottom: 1.2, left: 0.7 },
      textColor: [15, 23, 42],
      lineColor: [100, 116, 139],
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [220, 232, 250],
      textColor: [23, 50, 92],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7,
    },
    columnStyles,
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const col = hookData.column.index;
      if (col >= 5 && col < sumBaseIdx) {
        const val = String(hookData.cell.raw ?? '');
        if (val === 'S') {
          hookData.cell.styles.fillColor = [254, 243, 199];
          hookData.cell.styles.textColor = [146, 64, 14];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (val === 'I') {
          hookData.cell.styles.fillColor = [219, 234, 254];
          hookData.cell.styles.textColor = [30, 64, 175];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (val === 'A') {
          hookData.cell.styles.fillColor = [254, 226, 226];
          hookData.cell.styles.textColor = [159, 18, 57];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (val === '-') {
          hookData.cell.styles.fillColor = [241, 245, 249];
          hookData.cell.styles.textColor = [148, 163, 184];
        } else if (val === 'H') {
          hookData.cell.styles.textColor = [4, 120, 87];
        }
      } else if (col >= sumBaseIdx) {
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? cursorY + 20;

  let footerY = finalY + 6;
  if (footerY + 34 > pageHeight - 10) {
    doc.addPage();
    footerY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(23, 50, 92);
  doc.text(
    `Jumlah Siswa : L = ${summary.male}  |  P = ${summary.female}  |  Total = ${summary.totalStudents} siswa`,
    marginX,
    footerY
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Total Kehadiran (${summary.activeDaysCount} hari efektif) : Hadir ${summary.totalHadir}  |  Sakit ${summary.totalSakit}  |  Izin ${summary.totalIzin}  |  Alpa ${summary.totalAlpa}`,
    marginX,
    footerY + 5
  );
  doc.setFontSize(7.6);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Keterangan : H = Hadir (default bila tidak ada Sakit/Izin/Alpa), S = Sakit, I = Izin, A = Alpa, - = Libur',
    marginX,
    footerY + 9.5
  );

  const rightColX = 212;
  const cityFormatted = formatCityTitleCase(context.city || 'Bekasi');
  const lastDayIso =
    days.length > 0 ? days[days.length - 1].date : `${month}-01`;
  const footerDateLabel = formatIndonesianDate(lastDayIso);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${cityFormatted}, ${footerDateLabel}`, rightColX, footerY);
  doc.text(`Wali Kelas ${selectedRombel || ''}`.trim(), rightColX, footerY + 4.5);

  const signNameY = footerY + 20;
  const waliName =
    waliKelas.teacherName?.trim() || '........................................';
  doc.setFont('helvetica', 'bold');
  doc.text(waliName, rightColX, signNameY);

  const nameWidth = doc.getTextWidth(waliName);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(rightColX, signNameY + 0.8, rightColX + nameWidth, signNameY + 0.8);

  doc.setFont('helvetica', 'normal');
  doc.text(
    `NIP. ${waliKelas.teacherNip?.trim() || '—'}`,
    rightColX,
    signNameY + 4.5
  );

  const safeRombel = (selectedRombel || 'semua')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  doc.save(`rekap-absen-${safeRombel || 'kelas'}-${month}.pdf`);
}

