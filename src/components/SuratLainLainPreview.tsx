import React from 'react';
import type { SchoolSettings } from '../types/settings';
import type { StudentAcceptedLetterData } from '../types/letter';
import {
  formatCityTitleCase,
  formatIndonesianFullDate,
  resolveCustomLetterSigner,
} from '../lib/letterHelpers';
import { resolveAssetUrl } from '../lib/authApi';

interface SuratLainLainPreviewProps {
  data: StudentAcceptedLetterData;
  settings: SchoolSettings;
}

export const SuratLainLainPreview: React.FC<SuratLainLainPreviewProps> = ({
  data,
  settings,
}) => {
  const schoolName =
    settings.identity.schoolName?.trim() || '[Nama Sekolah di Pengaturan]';
  const departmentName = settings.identity.department?.trim();
  const rawLocation =
    data.schoolLocationLine?.trim() || settings.identity.city?.trim() || '';
  const schoolLocation =
    rawLocation && rawLocation === rawLocation.toUpperCase()
      ? formatCityTitleCase(rawLocation)
      : rawLocation;

  const rawLetterCity =
    data.letterCity?.trim() || settings.identity.city?.trim() || 'Bekasi';
  const letterCity = formatCityTitleCase(rawLetterCity);
  const formattedLetterDate = formatIndonesianFullDate(data.letterDate);
  const cityAndDate = formattedLetterDate
    ? `${letterCity}, ${formattedLetterDate}`
    : letterCity;

  const signer = resolveCustomLetterSigner(data, settings);

  const kopUrl = resolveAssetUrl(settings.files.kop?.url);
  const logoUrl = resolveAssetUrl(settings.files.logo?.url);
  const ttdUrl = resolveAssetUrl(settings.files.ttd?.url);
  const stempelUrl = resolveAssetUrl(settings.files.stempel?.url);

  const hasSignatureImages =
    data.showSignatureAssets && Boolean(ttdUrl || stempelUrl);

  const paperSize = data.paperSize || 'A4';
  const printPageSizeRule =
    paperSize === 'LEGAL'
      ? 'legal portrait'
      : paperSize === 'F4'
        ? '215mm 330mm'
        : 'A4 portrait';
  const maxWidthClass =
    paperSize === 'LEGAL'
      ? 'max-w-[816px]'
      : paperSize === 'F4'
        ? 'max-w-[812px]'
        : 'max-w-[794px]';

  const titleText = data.customTitle?.trim() || 'JUDUL SURAT';
  const subjectText = data.customSubject?.trim();
  const attachmentText = data.customAttachment?.trim();
  const recipientText = data.customRecipient?.trim();
  const ccText = data.customCc?.trim();

  const bodyLines = (data.customBody || '').replace(/\r\n/g, '\n').split('\n');
  const hasBodyContent = bodyLines.some((line) => line.trim().length > 0);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${printPageSizeRule};
            margin: 14mm 18mm;
          }
        }
      `}</style>
      <article
        aria-label="Pratinjau Cetak Surat Lain-lain"
        className={`print-sheet mx-auto w-full ${maxWidthClass} bg-white text-black border border-slate-300 shadow-[0_6px_28px_rgba(15,23,42,0.08)] px-7 py-8 sm:px-14 sm:py-11 print:border-0 print:shadow-none print:p-0`}
        style={{
          fontFamily: "'Times New Roman', Times, Georgia, serif",
        }}
      >
        {/* KOP Surat Resmi (Otomatis Sinkron dengan Pengaturan) */}
        {data.showKop && (
          kopUrl ? (
            <div className="mb-5 pb-1">
              <img
                src={kopUrl}
                alt="Kop Surat Resmi Sekolah"
                className="w-full max-h-[145px] object-contain mx-auto block"
              />
            </div>
          ) : (
            <div className="mb-5 pb-3 border-b-[3px] border-double border-black flex items-center gap-4">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo Sekolah"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
                />
              )}
              <div className="flex-1 text-center leading-tight">
                {departmentName && (
                  <p className="text-[12.5px] sm:text-[13.5px] font-bold uppercase tracking-wide">
                    {departmentName}
                  </p>
                )}
                <p className="text-[16px] sm:text-[19px] font-bold uppercase tracking-wide mt-0.5">
                  {schoolName}
                </p>
                {schoolLocation && (
                  <p className="text-[11.5px] sm:text-[12.5px] mt-0.5">
                    {schoolLocation}
                  </p>
                )}
              </div>
              {logoUrl && <div className="w-16 sm:w-20 shrink-0" aria-hidden="true" />}
            </div>
          )
        )}

        {/* Judul & Nomor Surat */}
        <header className="text-center">
          <h2 className="text-[15.5px] sm:text-[16.5px] font-bold uppercase tracking-wide underline underline-offset-4 decoration-[1.5px] text-black leading-tight break-words">
            {titleText}
          </h2>
          {data.letterNumber?.trim() && (
            <p className="mt-1 text-[13.5px] sm:text-[14px] text-black leading-snug">
              Nomor : {data.letterNumber.trim()}
            </p>
          )}
        </header>

        {/* Lampiran, Perihal & Tujuan Surat (Opsional sesuai isian Operator) */}
        {(attachmentText || subjectText || recipientText) && (
          <div className="mt-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-[13.5px] sm:text-[14.5px] text-black leading-[1.6]">
            {(attachmentText || subjectText) && (
              <table className="border-collapse sm:max-w-[56%]">
                <tbody>
                  {attachmentText && (
                    <tr>
                      <td className="w-[82px] align-top py-[1px] pr-2">
                        Lampiran
                      </td>
                      <td className="w-[12px] align-top py-[1px]">:</td>
                      <td className="align-top py-[1px] break-words">
                        {attachmentText}
                      </td>
                    </tr>
                  )}
                  {subjectText && (
                    <tr>
                      <td className="w-[82px] align-top py-[1px] pr-2">
                        Perihal
                      </td>
                      <td className="w-[12px] align-top py-[1px]">:</td>
                      <td className="align-top py-[1px] font-bold break-words">
                        {subjectText}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {recipientText && (
              <div
                className={
                  attachmentText || subjectText
                    ? 'sm:min-w-[220px] sm:max-w-[42%]'
                    : 'w-full'
                }
              >
                <p>Kepada Yth.</p>
                <p className="whitespace-pre-line break-words">{recipientText}</p>
              </div>
            )}
          </div>
        )}

        {/* Isi Surat Custom */}
        <div className="mt-6 text-[13.5px] sm:text-[14.5px] text-black leading-[1.75] space-y-2.5">
          {hasBodyContent ? (
            bodyLines.map((line, idx) =>
              line.trim() === '' ? (
                <div key={idx} className="h-2.5" aria-hidden="true" />
              ) : (
                <p
                  key={idx}
                  className="whitespace-pre-wrap break-words text-left sm:text-justify"
                >
                  {line}
                </p>
              )
            )
          ) : (
            <p className="text-slate-400 italic">
              Isi surat akan tampil di sini sesuai teks yang Anda ketik pada editor...
            </p>
          )}
        </div>

        {/* Blok Tanda Tangan Penandatangan */}
        <div className="mt-10 sm:mt-12 flex justify-end">
          <div className="w-[245px] sm:w-[275px] text-[13.5px] sm:text-[14.5px] text-black leading-[1.45] text-left">
            <p>{cityAndDate}</p>
            <p>{signer.position}</p>

            <div className="relative h-[82px] my-1 flex items-center">
              {hasSignatureImages && (
                <>
                  {stempelUrl && (
                    <img
                      src={stempelUrl}
                      alt="Stempel Sekolah"
                      className="h-[74px] w-auto object-contain -ml-5 opacity-90 mix-blend-multiply pointer-events-none select-none"
                    />
                  )}
                  {ttdUrl && (
                    <img
                      src={ttdUrl}
                      alt="Tanda Tangan Penandatangan"
                      className={`h-[68px] w-auto object-contain mix-blend-multiply pointer-events-none select-none ${
                        stempelUrl ? '-ml-6' : 'ml-2'
                      }`}
                    />
                  )}
                </>
              )}
            </div>

            <p className="font-bold underline underline-offset-2 decoration-[1.2px] text-black">
              {signer.name}
            </p>
            {(signer.usesSettings || signer.nip) && (
              <p className="text-black">NIP. {signer.nip || '—'}</p>
            )}
          </div>
        </div>

        {/* Tembusan / Catatan Tambahan (Opsional) */}
        {ccText && (
          <div className="mt-8 pt-2 text-[12.5px] sm:text-[13px] text-black leading-[1.5]">
            <p className="font-bold underline underline-offset-2">Tembusan :</p>
            <p className="mt-1 whitespace-pre-line break-words">{ccText}</p>
          </div>
        )}
      </article>
    </>
  );
};
