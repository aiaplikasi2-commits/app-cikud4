import React from 'react';
import type { SchoolSettings } from '../types/settings';
import type { StudentAcceptedLetterData } from '../types/letter';
import {
  formatCityTitleCase,
  formatIndonesianFullDate,
} from '../lib/letterHelpers';
import { resolveAssetUrl } from '../lib/authApi';

interface SuratPindahSekolahPreviewProps {
  data: StudentAcceptedLetterData;
  settings: SchoolSettings;
}

export const SuratPindahSekolahPreview: React.FC<
  SuratPindahSekolahPreviewProps
> = ({ data, settings }) => {
  const schoolNameRaw =
    settings.identity.schoolName?.trim() || '[Nama Sekolah di Pengaturan]';
  const schoolHeadingPhrase = /^sekolah\b/i.test(schoolNameRaw)
    ? `Kepala ${schoolNameRaw}`
    : `Kepala Sekolah ${schoolNameRaw}`;

  const rawLocation = data.schoolLocationLine?.trim() || '';
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

  const principalPosition =
    settings.principal.position?.trim() || 'Kepala Sekolah';
  const principalName =
    settings.principal.name?.trim() || '........................................';
  const principalNip = settings.principal.nip?.trim();

  const kopUrl = resolveAssetUrl(settings.files.kop?.url);
  const ttdUrl = resolveAssetUrl(settings.files.ttd?.url);
  const stempelUrl = resolveAssetUrl(settings.files.stempel?.url);

  const hasSignatureImages =
    data.showSignatureAssets && Boolean(ttdUrl || stempelUrl);

  const isLegal = data.paperSize === 'LEGAL';
  const printPageSizeRule = isLegal ? 'legal portrait' : '215mm 330mm';

  const dottedFill =
    '....................................................................................';

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${printPageSizeRule};
            margin: 12mm 16mm;
          }
        }
      `}</style>
      <article
        aria-label="Pratinjau Cetak Surat Keterangan Pindah Sekolah"
        className={`print-sheet mx-auto w-full bg-white text-black border border-slate-300 shadow-[0_6px_28px_rgba(15,23,42,0.08)] px-7 py-8 sm:px-14 sm:py-10 print:border-0 print:shadow-none print:p-0 ${
          isLegal ? 'max-w-[816px]' : 'max-w-[812px]'
        }`}
        style={{
          fontFamily: "'Times New Roman', Times, Georgia, serif",
        }}
      >
        {/* KOP Surat Resmi (Opsional, diambil dari Pengaturan) */}
        {data.showKop && kopUrl && (
          <div className="mb-4 pb-1">
            <img
              src={kopUrl}
              alt="Kop Surat Resmi Sekolah"
              className="w-full max-h-[140px] object-contain mx-auto block"
            />
          </div>
        )}

        {/* Judul & Nomor Surat */}
        <header className="text-center">
          <h2 className="text-[15.5px] sm:text-[17px] font-bold uppercase tracking-wide underline underline-offset-4 decoration-[1.5px] text-black leading-tight">
            SURAT KETERANGAN PINDAH SEKOLAH
          </h2>
          <p className="mt-1 text-[13px] sm:text-[14px] text-black leading-snug">
            NOMOR : {data.letterNumber?.trim() || '—'}
          </p>
        </header>

        {/* Kalimat Pembuka */}
        <p className="mt-5 text-[13px] sm:text-[14px] text-black leading-[1.65]">
          Yang bertanda tangan di bawah ini {schoolHeadingPhrase}
          {schoolLocation ? ` ${schoolLocation}` : ''}, dengan ini menerangkan bahwa :
        </p>

        {/* Identitas Siswa */}
        <div className="mt-3.5 pl-8 sm:pl-14">
          <table className="w-full border-collapse text-[13px] sm:text-[14px] text-black leading-[1.65]">
            <tbody>
              <tr>
                <td className="w-[140px] sm:w-[165px] align-top py-[2px] pr-2">
                  Nama
                </td>
                <td className="w-[14px] align-top py-[2px]">:</td>
                <td className="align-top py-[2px] font-bold break-words">
                  {data.studentName?.trim() || '—'}
                </td>
              </tr>
              <tr>
                <td className="w-[140px] sm:w-[165px] align-top py-[2px] pr-2">
                  No Induk / NISN
                </td>
                <td className="w-[14px] align-top py-[2px]">:</td>
                <td className="align-top py-[2px] break-words">
                  {data.nipdNisn?.trim() || '—'}
                </td>
              </tr>
              <tr>
                <td className="w-[140px] sm:w-[165px] align-top py-[2px] pr-2">
                  Jenis Kelamin
                </td>
                <td className="w-[14px] align-top py-[2px]">:</td>
                <td className="align-top py-[2px] break-words">
                  {data.gender?.trim() || '—'}
                </td>
              </tr>
              <tr>
                <td className="w-[140px] sm:w-[165px] align-top py-[2px] pr-2">
                  Kelas
                </td>
                <td className="w-[14px] align-top py-[2px]">:</td>
                <td className="align-top py-[2px] break-words">
                  {data.targetClass?.trim() || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Kalimat Orang Tua / Wali */}
        <p className="mt-4 text-[13px] sm:text-[14px] text-black leading-[1.65]">
          Sesuai Permohonan Pindah Sekolah dari orang tua/wali :
        </p>

        <div className="mt-3 pl-8 sm:pl-14">
          <table className="w-full border-collapse text-[13px] sm:text-[14px] text-black leading-[1.65]">
            <tbody>
              <tr>
                <td className="w-[140px] sm:w-[165px] align-top py-[2px] pr-2">
                  Nama
                </td>
                <td className="w-[14px] align-top py-[2px]">:</td>
                <td className="align-top py-[2px] break-words">
                  {data.parentName?.trim() || '—'}
                </td>
              </tr>
              <tr>
                <td className="w-[140px] sm:w-[165px] align-top py-[2px] pr-2">
                  Pekerjaan
                </td>
                <td className="w-[14px] align-top py-[2px]">:</td>
                <td className="align-top py-[2px] break-words">
                  {data.parentJob?.trim() || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pernyataan Pindah */}
        <p className="mt-4 text-[13px] sm:text-[14px] text-black leading-[1.65]">
          Telah Mengajukan pindah ke{' '}
          {data.destinationSchool?.trim() || '........................................'}
          , dengan alasan{' '}
          {data.transferReason?.trim() || 'permintaan orang tua / wali siswa'} dan
          Sudah dikeluarkan dari DAPODIK.
        </p>

        {/* Blok Tanda Tangan Kepala Sekolah */}
        <div className="mt-8 flex justify-end">
          <div className="w-[240px] sm:w-[270px] text-[13px] sm:text-[14px] text-black leading-[1.45] text-left">
            <p>{cityAndDate}</p>
            <p>{principalPosition}</p>

            <div className="relative h-[74px] my-1 flex items-center">
              {hasSignatureImages && (
                <>
                  {stempelUrl && (
                    <img
                      src={stempelUrl}
                      alt="Stempel Sekolah"
                      className="h-[70px] w-auto object-contain -ml-5 opacity-90 mix-blend-multiply pointer-events-none select-none"
                    />
                  )}
                  {ttdUrl && (
                    <img
                      src={ttdUrl}
                      alt="Tanda Tangan Kepala Sekolah"
                      className={`h-[64px] w-auto object-contain mix-blend-multiply pointer-events-none select-none ${
                        stempelUrl ? '-ml-6' : 'ml-2'
                      }`}
                    />
                  )}
                </>
              )}
            </div>

            <p className="font-bold underline underline-offset-2 decoration-[1.2px] text-black">
              {principalName}
            </p>
            <p className="text-black">NIP. {principalNip || '—'}</p>
          </div>
        </div>

        {/* Garis Putus-Putus Lembar Kembali */}
        <div className="mt-7 mb-3 border-t-2 border-dashed border-black" />

        {/* Lembar Pengembalian Sekolah Penerima */}
        <p className="text-[13px] sm:text-[13.5px] text-black leading-[1.55]">
          Setelah siswa tersebut diatas diterima di sekolah ini, lembaran dibawah ini
          harap diisi dan dikembalikan kepada kami. Terima kasih.
        </p>

        <div className="mt-4">
          <table className="w-full border-collapse text-[13px] sm:text-[13.5px] text-black leading-[2.05]">
            <tbody>
              <tr>
                <td className="w-[175px] sm:w-[205px] align-bottom py-[2px] pr-2">
                  Nama Sekolah
                </td>
                <td className="w-[14px] align-bottom py-[2px]">:</td>
                <td className="align-bottom py-[2px] overflow-hidden whitespace-nowrap">
                  {dottedFill}
                </td>
              </tr>
              <tr>
                <td className="w-[175px] sm:w-[205px] align-bottom py-[2px] pr-2">
                  Status Sekolah
                </td>
                <td className="w-[14px] align-bottom py-[2px]">:</td>
                <td className="align-bottom py-[2px] overflow-hidden whitespace-nowrap">
                  {dottedFill}
                </td>
              </tr>
              <tr>
                <td className="w-[175px] sm:w-[205px] align-bottom py-[2px] pr-2">
                  Alamat Sekolah
                </td>
                <td className="w-[14px] align-bottom py-[2px]">:</td>
                <td className="align-bottom py-[2px] overflow-hidden whitespace-nowrap">
                  {dottedFill}
                </td>
              </tr>
              <tr>
                <td className="w-[175px] sm:w-[205px] align-bottom py-[2px] pr-2">
                  Kelurahan / Kecamatan
                </td>
                <td className="w-[14px] align-bottom py-[2px]">:</td>
                <td className="align-bottom py-[2px] overflow-hidden whitespace-nowrap">
                  {dottedFill}
                </td>
              </tr>
              <tr>
                <td className="w-[175px] sm:w-[205px] align-bottom py-[2px] pr-2">
                  Kab. / Kota / Provinsi
                </td>
                <td className="w-[14px] align-bottom py-[2px]">:</td>
                <td className="align-bottom py-[2px] overflow-hidden whitespace-nowrap">
                  {dottedFill}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Blok Tanda Tangan Sekolah Tujuan */}
        <div className="mt-7 flex justify-end">
          <div className="w-[240px] sm:w-[270px] text-[13px] sm:text-[13.5px] text-black leading-[1.5] text-left">
            <p>Kepala Sekolah,</p>
            <div className="h-[64px]" aria-hidden="true" />
            <p>........................................</p>
            <p>NIP. ...................................</p>
          </div>
        </div>
      </article>
    </>
  );
};
