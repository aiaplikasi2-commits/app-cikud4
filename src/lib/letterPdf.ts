import { jsPDF } from 'jspdf';
import type { SchoolSettings } from '../types/settings';
import type { LetterTypeId, StudentAcceptedLetterData } from '../types/letter';
import {
  formatCityTitleCase,
  formatIndonesianFullDate,
  resolveCustomLetterSigner,
} from './letterHelpers';
import { resolveAssetUrl } from './authApi';

interface LoadedImageInfo {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

async function loadImageForPdf(url: string | null | undefined): Promise<LoadedImageInfo | null> {
  const resolvedUrl = resolveAssetUrl(url);
  if (!resolvedUrl) return null;
  try {
    const response = await fetch(resolvedUrl, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Gagal membaca gambar'));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;

    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          width: img.naturalWidth || 400,
          height: img.naturalHeight || 120,
        });
      img.onerror = () => resolve({ width: 400, height: 120 });
      img.src = dataUrl;
    });

    const format: 'PNG' | 'JPEG' = dataUrl.startsWith('data:image/png')
      ? 'PNG'
      : 'JPEG';
    return {
      dataUrl,
      format,
      width: dims.width,
      height: dims.height,
    };
  } catch {
    return null;
  }
}

function drawKeyValueRow(
  doc: jsPDF,
  opts: {
    label: string;
    value: string;
    labelX: number;
    colonX: number;
    valueX: number;
    maxValueWidth: number;
    y: number;
    lineHeight?: number;
    boldValue?: boolean;
  }
): number {
  const lh = opts.lineHeight ?? 6;
  doc.setFont('times', 'normal');
  doc.text(opts.label, opts.labelX, opts.y);
  doc.text(':', opts.colonX, opts.y);

  doc.setFont('times', opts.boldValue ? 'bold' : 'normal');
  const wrapped = doc.splitTextToSize(opts.value || '—', opts.maxValueWidth) as string[];
  doc.text(wrapped, opts.valueX, opts.y);
  doc.setFont('times', 'normal');
  return opts.y + Math.max(1, wrapped.length) * lh;
}

function drawDottedFillRow(
  doc: jsPDF,
  label: string,
  labelX: number,
  colonX: number,
  dotsStartX: number,
  rightEdgeX: number,
  y: number
): number {
  doc.setFont('times', 'normal');
  doc.text(label, labelX, y);
  doc.text(':', colonX, y);

  let dots = '';
  while (doc.getTextWidth(dots + '.') < rightEdgeX - dotsStartX) {
    dots += '.';
  }
  doc.text(dots, dotsStartX, y);
  return y + 7.5;
}

function drawCenteredUnderlinedTitle(
  doc: jsPDF,
  text: string,
  centerX: number,
  y: number,
  fontSize: number
): void {
  doc.setFont('times', 'bold');
  doc.setFontSize(fontSize);
  doc.text(text, centerX, y, { align: 'center' });
  const w = doc.getTextWidth(text);
  doc.setLineWidth(0.4);
  doc.line(centerX - w / 2, y + 1.1, centerX + w / 2, y + 1.1);
}

async function drawSignatureBlock(
  doc: jsPDF,
  opts: {
    cityAndDate: string;
    position: string;
    principalName: string;
    principalNip: string;
    showNipLine?: boolean;
    x: number;
    startY: number;
    showAssets: boolean;
    ttdImg: LoadedImageInfo | null;
    stempelImg: LoadedImageInfo | null;
  }
): Promise<number> {
  let y = opts.startY;
  doc.setFont('times', 'normal');
  doc.setFontSize(11.5);
  doc.text(opts.cityAndDate, opts.x, y);
  y += 5.5;
  doc.text(opts.position, opts.x, y);

  const assetTopY = y + 2;
  if (opts.showAssets) {
    if (opts.stempelImg) {
      const h = 21;
      const w = (opts.stempelImg.width / Math.max(1, opts.stempelImg.height)) * h;
      doc.addImage(
        opts.stempelImg.dataUrl,
        opts.stempelImg.format,
        opts.x - 6,
        assetTopY,
        Math.min(28, w),
        h
      );
    }
    if (opts.ttdImg) {
      const h = 19;
      const w = (opts.ttdImg.width / Math.max(1, opts.ttdImg.height)) * h;
      doc.addImage(
        opts.ttdImg.dataUrl,
        opts.ttdImg.format,
        opts.x + (opts.stempelImg ? 6 : 2),
        assetTopY + 1,
        Math.min(36, w),
        h
      );
    }
  }

  y = assetTopY + 22;
  doc.setFont('times', 'bold');
  doc.text(opts.principalName, opts.x, y);
  const nameW = doc.getTextWidth(opts.principalName);
  doc.setLineWidth(0.35);
  doc.line(opts.x, y + 0.9, opts.x + nameW, y + 0.9);

  if (opts.showNipLine !== false) {
    y += 5.2;
    doc.setFont('times', 'normal');
    doc.text(`NIP. ${opts.principalNip || '—'}`, opts.x, y);
  }
  return y;
}

export async function downloadLetterPdf(
  type: LetterTypeId,
  data: StudentAcceptedLetterData,
  settings: SchoolSettings
): Promise<void> {
  const isPindah = type === 'SUKET_PINDAH_SEKOLAH';
  const isCustom = type === 'SURAT_LAIN_LAIN';

  const formatOption: 'a4' | [number, number] = isPindah
    ? data.paperSize === 'LEGAL'
      ? [215.9, 355.6]
      : [215, 330]
    : isCustom
      ? data.paperSize === 'LEGAL'
        ? [215.9, 355.6]
        : data.paperSize === 'F4'
          ? [215, 330]
          : 'a4'
      : 'a4';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: formatOption,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;
  let y = 16;

  const [kopImg, logoImg, ttdImg, stempelImg] = await Promise.all([
    data.showKop ? loadImageForPdf(settings.files.kop?.url) : Promise.resolve(null),
    data.showKop && !settings.files.kop?.url
      ? loadImageForPdf(settings.files.logo?.url)
      : Promise.resolve(null),
    data.showSignatureAssets
      ? loadImageForPdf(settings.files.ttd?.url)
      : Promise.resolve(null),
    data.showSignatureAssets
      ? loadImageForPdf(settings.files.stempel?.url)
      : Promise.resolve(null),
  ]);

  const schoolNameRaw =
    settings.identity.schoolName?.trim() || '[Nama Sekolah di Pengaturan]';
  const rawLoc =
    data.schoolLocationLine?.trim() || settings.identity.city?.trim() || '';
  const schoolLocation =
    rawLoc && rawLoc === rawLoc.toUpperCase()
      ? formatCityTitleCase(rawLoc)
      : rawLoc;

  if (kopImg) {
    const targetW = contentWidth;
    const rawH = (kopImg.height / Math.max(1, kopImg.width)) * targetW;
    const drawH = Math.min(34, rawH);
    const drawW = (kopImg.width / Math.max(1, kopImg.height)) * drawH;
    doc.addImage(
      kopImg.dataUrl,
      kopImg.format,
      marginX + (contentWidth - drawW) / 2,
      y - 4,
      drawW,
      drawH
    );
    y += drawH + 3;
  } else if (isCustom && data.showKop) {
    const headerStartY = y - 2;
    if (logoImg) {
      const logoH = 18;
      const logoW = Math.min(
        20,
        (logoImg.width / Math.max(1, logoImg.height)) * logoH
      );
      doc.addImage(
        logoImg.dataUrl,
        logoImg.format,
        marginX,
        headerStartY,
        logoW,
        logoH
      );
    }
    const departmentName = settings.identity.department?.trim();
    let headerY = headerStartY + 4.5;
    doc.setTextColor(0, 0, 0);
    if (departmentName) {
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text(departmentName.toUpperCase(), pageWidth / 2, headerY, {
        align: 'center',
      });
      headerY += 5.5;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(14.5);
    doc.text(schoolNameRaw.toUpperCase(), pageWidth / 2, headerY, {
      align: 'center',
    });
    headerY += 5;
    if (schoolLocation) {
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(schoolLocation, pageWidth / 2, headerY, { align: 'center' });
      headerY += 4;
    }
    const lineY = Math.max(headerStartY + 20, headerY + 1);
    doc.setLineWidth(0.75);
    doc.line(marginX, lineY, pageWidth - marginX, lineY);
    doc.setLineWidth(0.25);
    doc.line(marginX, lineY + 1.1, pageWidth - marginX, lineY + 1.1);
    y = lineY + 8;
  }

  const rawLetterCity =
    data.letterCity?.trim() || settings.identity.city?.trim() || 'Bekasi';
  const letterCity = formatCityTitleCase(rawLetterCity);
  const formattedLetterDate = formatIndonesianFullDate(data.letterDate);
  const cityAndDate = formattedLetterDate
    ? `${letterCity}, ${formattedLetterDate}`
    : letterCity;

  const principalPosition =
    settings.principal.position?.trim() || 'Kepala Sekolah';
  const principalName =
    settings.principal.name?.trim() || '........................................';
  const principalNip = settings.principal.nip?.trim() || '—';

  doc.setTextColor(0, 0, 0);

  if (isCustom) {
    const titleUpper = (data.customTitle?.trim() || 'JUDUL SURAT').toUpperCase();
    doc.setFont('times', 'bold');
    doc.setFontSize(13.5);
    const titleLines = doc.splitTextToSize(titleUpper, contentWidth) as string[];
    if (titleLines.length === 1) {
      drawCenteredUnderlinedTitle(doc, titleLines[0], pageWidth / 2, y, 13.5);
      y += 6;
    } else {
      doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
      y += titleLines.length * 6;
    }

    if (data.letterNumber?.trim()) {
      doc.setFont('times', 'normal');
      doc.setFontSize(11.5);
      doc.text(
        `Nomor : ${data.letterNumber.trim()}`,
        pageWidth / 2,
        y,
        { align: 'center' }
      );
      y += 8;
    } else {
      y += 4;
    }

    const attachmentText = data.customAttachment?.trim();
    const subjectText = data.customSubject?.trim();
    const recipientText = data.customRecipient?.trim();

    if (attachmentText || subjectText || recipientText) {
      doc.setFontSize(11.5);
      const hasLeftMeta = Boolean(attachmentText || subjectText);
      const leftBlockStartY = y;
      let leftEndY = y;
      if (hasLeftMeta) {
        const leftMaxW = recipientText ? contentWidth * 0.54 - 22 : contentWidth - 22;
        if (attachmentText) {
          leftEndY = drawKeyValueRow(doc, {
            label: 'Lampiran',
            value: attachmentText,
            labelX: marginX,
            colonX: marginX + 19,
            valueX: marginX + 22,
            maxValueWidth: leftMaxW,
            y: leftEndY,
            lineHeight: 5.5,
          });
        }
        if (subjectText) {
          leftEndY = drawKeyValueRow(doc, {
            label: 'Perihal',
            value: subjectText,
            labelX: marginX,
            colonX: marginX + 19,
            valueX: marginX + 22,
            maxValueWidth: leftMaxW,
            y: leftEndY,
            lineHeight: 5.5,
            boldValue: true,
          });
        }
      }

      let rightEndY = y;
      if (recipientText) {
        const recX = hasLeftMeta ? marginX + contentWidth * 0.58 : marginX;
        const recMaxW = pageWidth - marginX - recX;
        doc.setFont('times', 'normal');
        doc.text('Kepada Yth.', recX, leftBlockStartY);
        rightEndY = leftBlockStartY + 5.5;
        const recLines = recipientText
          .replace(/\r\n/g, '\n')
          .split('\n')
          .flatMap((line) => doc.splitTextToSize(line || ' ', recMaxW) as string[]);
        doc.text(recLines, recX, rightEndY);
        rightEndY += recLines.length * 5.5;
      }

      y = Math.max(leftEndY, rightEndY) + 6;
    } else {
      y += 4;
    }

    const bodyParagraphs = (data.customBody || '').replace(/\r\n/g, '\n').split('\n');
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    const bottomLimit = pageHeight - 22;

    for (const rawLine of bodyParagraphs) {
      if (rawLine.trim() === '') {
        y += 4.2;
        if (y > bottomLimit) {
          doc.addPage();
          y = 20;
        }
        continue;
      }
      const wrapped = doc.splitTextToSize(rawLine, contentWidth) as string[];
      for (const wLine of wrapped) {
        if (y > bottomLimit) {
          doc.addPage();
          y = 20;
        }
        doc.text(wLine, marginX, y);
        y += 6;
      }
      y += 1.2;
    }

    y += 7;
    if (y > pageHeight - 58) {
      doc.addPage();
      y = 22;
    }

    const signer = resolveCustomLetterSigner(data, settings);
    const signX = pageWidth - marginX - 66;
    y = await drawSignatureBlock(doc, {
      cityAndDate,
      position: signer.position,
      principalName: signer.name,
      principalNip: signer.nip,
      showNipLine: signer.usesSettings || Boolean(signer.nip),
      x: signX,
      startY: y,
      showAssets: data.showSignatureAssets,
      ttdImg,
      stempelImg,
    });

    if (data.customCc?.trim()) {
      y += 10;
      const ccLines = data.customCc
        .trim()
        .replace(/\r\n/g, '\n')
        .split('\n')
        .flatMap((line) => doc.splitTextToSize(line || ' ', contentWidth) as string[]);
      if (y + ccLines.length * 5 > pageHeight - 16) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('times', 'bold');
      doc.setFontSize(10.5);
      doc.text('Tembusan :', marginX, y);
      const ccW = doc.getTextWidth('Tembusan :');
      doc.setLineWidth(0.3);
      doc.line(marginX, y + 0.8, marginX + ccW, y + 0.8);
      y += 5.2;
      doc.setFont('times', 'normal');
      doc.text(ccLines, marginX, y);
    }
  } else if (isPindah) {
    drawCenteredUnderlinedTitle(
      doc,
      'SURAT KETERANGAN PINDAH SEKOLAH',
      pageWidth / 2,
      y,
      13.5
    );
    y += 6;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text(
      `NOMOR : ${data.letterNumber?.trim() || '—'}`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 10;

    const schoolPhrase = /^sekolah\b/i.test(schoolNameRaw)
      ? `Kepala ${schoolNameRaw}`
      : `Kepala Sekolah ${schoolNameRaw}`;
    const opening = `Yang bertanda tangan di bawah ini ${schoolPhrase}${
      schoolLocation ? ` ${schoolLocation}` : ''
    }, dengan ini menerangkan bahwa :`;

    doc.setFontSize(11.5);
    const openingLines = doc.splitTextToSize(opening, contentWidth) as string[];
    doc.text(openingLines, marginX, y);
    y += openingLines.length * 5.8 + 4;

    const labelX = marginX + 14;
    const colonX = labelX + 38;
    const valueX = colonX + 4;
    const maxValW = pageWidth - marginX - valueX;

    y = drawKeyValueRow(doc, {
      label: 'Nama',
      value: data.studentName?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6,
      boldValue: true,
    });
    y = drawKeyValueRow(doc, {
      label: 'No Induk / NISN',
      value: data.nipdNisn?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6,
    });
    y = drawKeyValueRow(doc, {
      label: 'Jenis Kelamin',
      value: data.gender?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6,
    });
    y = drawKeyValueRow(doc, {
      label: 'Kelas',
      value: data.targetClass?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6,
    });

    y += 4;
    doc.setFont('times', 'normal');
    doc.text(
      'Sesuai Permohonan Pindah Sekolah dari orang tua/wali :',
      marginX,
      y
    );
    y += 7;

    y = drawKeyValueRow(doc, {
      label: 'Nama',
      value: data.parentName?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6,
    });
    y = drawKeyValueRow(doc, {
      label: 'Pekerjaan',
      value: data.parentJob?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6,
    });

    y += 4;
    const transferText = `Telah Mengajukan pindah ke ${
      data.destinationSchool?.trim() || '........................................'
    }, dengan alasan ${
      data.transferReason?.trim() || 'permintaan orang tua / wali siswa'
    } dan Sudah dikeluarkan dari DAPODIK.`;
    const transferLines = doc.splitTextToSize(transferText, contentWidth) as string[];
    doc.text(transferLines, marginX, y);
    y += transferLines.length * 5.8 + 8;

    const signX = pageWidth - marginX - 66;
    y = await drawSignatureBlock(doc, {
      cityAndDate,
      position: principalPosition,
      principalName,
      principalNip,
      x: signX,
      startY: y,
      showAssets: data.showSignatureAssets,
      ttdImg,
      stempelImg,
    });

    // Dashed tear-off line
    y += 10;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    const dashLen = 2.5;
    const gapLen = 1.6;
    for (let x = marginX; x < pageWidth - marginX; x += dashLen + gapLen) {
      doc.line(x, y, Math.min(x + dashLen, pageWidth - marginX), y);
    }

    y += 6;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    const slipIntro =
      'Setelah siswa tersebut diatas diterima di sekolah ini, lembaran dibawah ini harap diisi dan dikembalikan kepada kami. Terima kasih.';
    const slipLines = doc.splitTextToSize(slipIntro, contentWidth) as string[];
    doc.text(slipLines, marginX, y);
    y += slipLines.length * 5.4 + 6;

    const slipLabelX = marginX;
    const slipColonX = marginX + 46;
    const slipDotsX = slipColonX + 4;
    const rightEdgeX = pageWidth - marginX;

    y = drawDottedFillRow(doc, 'Nama Sekolah', slipLabelX, slipColonX, slipDotsX, rightEdgeX, y);
    y = drawDottedFillRow(doc, 'Status Sekolah', slipLabelX, slipColonX, slipDotsX, rightEdgeX, y);
    y = drawDottedFillRow(doc, 'Alamat Sekolah', slipLabelX, slipColonX, slipDotsX, rightEdgeX, y);
    y = drawDottedFillRow(
      doc,
      'Kelurahan / Kecamatan',
      slipLabelX,
      slipColonX,
      slipDotsX,
      rightEdgeX,
      y
    );
    y = drawDottedFillRow(
      doc,
      'Kab. / Kota / Provinsi',
      slipLabelX,
      slipColonX,
      slipDotsX,
      rightEdgeX,
      y
    );

    y += 8;
    doc.text('Kepala Sekolah,', signX, y);
    y += 22;
    doc.text('........................................', signX, y);
    y += 5.5;
    doc.text('NIP. ...................................', signX, y);
  } else {
    drawCenteredUnderlinedTitle(doc, 'SURAT KETERANGAN', pageWidth / 2, y, 13.5);
    y += 6;
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.text(
      `Nomor : ${data.letterNumber?.trim() || '—'}`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 12;

    const opening = `Yang bertanda tangan di bawah ini Kepala Sekolah ${schoolNameRaw}${
      schoolLocation ? ` ${schoolLocation}` : ''
    } bersedia menerima pindahan atas nama :`;
    const openingLines = doc.splitTextToSize(opening, contentWidth) as string[];
    doc.text(openingLines, marginX, y);
    y += openingLines.length * 6.5 + 5;

    const labelX = marginX + 10;
    const colonX = labelX + 44;
    const valueX = colonX + 4;
    const maxValW = pageWidth - marginX - valueX;

    const formattedBirth = formatIndonesianFullDate(data.birthDate);
    const ttl =
      [data.birthPlace?.trim(), formattedBirth].filter(Boolean).join(', ') || '—';

    y = drawKeyValueRow(doc, {
      label: 'Nama',
      value: data.studentName?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });
    y = drawKeyValueRow(doc, {
      label: 'Tempat tanggal lahir',
      value: ttl,
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });
    y = drawKeyValueRow(doc, {
      label: 'Jenis Kelamin',
      value: data.gender?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });
    y = drawKeyValueRow(doc, {
      label: 'Agama',
      value: data.religion?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });
    y = drawKeyValueRow(doc, {
      label: 'Alamat / Domisili',
      value: data.address?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });
    y = drawKeyValueRow(doc, {
      label: 'Asal Sekolah',
      value: data.originSchool?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });
    y = drawKeyValueRow(doc, {
      label: 'Kelas',
      value: data.targetClass?.trim() || '—',
      labelX,
      colonX,
      valueX,
      maxValueWidth: maxValW,
      y,
      lineHeight: 6.5,
    });

    y += 7;
    if (data.requirementClause?.trim()) {
      const reqLines = doc.splitTextToSize(
        data.requirementClause.trim(),
        contentWidth
      ) as string[];
      doc.text(reqLines, marginX, y);
      y += reqLines.length * 6.5 + 3;
    }
    if (data.closingClause?.trim()) {
      const closeLines = doc.splitTextToSize(
        data.closingClause.trim(),
        contentWidth
      ) as string[];
      doc.text(closeLines, marginX, y);
      y += closeLines.length * 6.5 + 8;
    }

    const signX = pageWidth - marginX - 66;
    await drawSignatureBlock(doc, {
      cityAndDate,
      position: principalPosition,
      principalName,
      principalNip,
      x: signX,
      startY: y + 4,
      showAssets: data.showSignatureAssets,
      ttdImg,
      stempelImg,
    });
  }

  const slugSource = isCustom
    ? data.customTitle || data.customSubject || 'surat-lain-lain'
    : data.studentName || 'siswa';
  const safeSlug = slugSource
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = isPindah
    ? 'surat-keterangan-pindah-sekolah'
    : isCustom
      ? 'surat-resmi'
      : 'surat-mutasi-keluar';
  doc.save(`${prefix}-${safeSlug || 'dokumen'}.pdf`);
}
