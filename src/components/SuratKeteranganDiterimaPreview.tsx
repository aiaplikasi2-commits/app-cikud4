import React from 'react';
import type { SchoolSettings } from '../types/settings';
import type { StudentAcceptedLetterData } from '../types/letter';
import {
  formatCityTitleCase,
  formatIndonesianFullDate,
} from '../lib/letterHelpers';

interface SuratKeteranganDiterimaPreviewProps {
  data: StudentAcceptedLetterData;
  settings: SchoolSettings;
}

export const SuratKeteranganDiterimaPreview: React.FC<
  SuratKeteranganDiterimaPreviewProps
> = ({ data, settings }) => {
  const schoolName =
    settings.identity.schoolName?.trim() || '[Nama Sekolah di Pengaturan]';
  const schoolLocation = data.schoolLocationLine?.trim();
  const formattedBirthDate = formatIndonesianFullDate(data.birthDate);
  const ttlDisplay =
    [data.birthPlace?.trim(), formattedBirthDate].filter(Boolean).join(', ') ||
    '—';

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

  const kopUrl = settings.files.kop?.url ?? null;
  const ttdUrl = settings.files.ttd?.url ?? null;
  const stempelUrl = settings.files.stempel?.url ?? null;

  const hasSignatureImages =
    data.showSignatureAssets && Boolean(ttdUrl || stempelUrl);

  return (
    <article
      aria-label="Pratinjau Cetak Surat Keterangan Siswa Diterima"
      className="print-sheet mx-auto w-full max-w-[794px] bg-white text-black border border-slate-300 shadow-[0_6px_28px_rgba(15,23,42,0.08)] px-7 py-8 sm:px-14 sm:py-12 print:border-0 print:shadow-none print:p-0"
      style={{
        fontFamily: "'Times New Roman', Times, Georgia, serif",
      }}
    >
      {/* KOP Surat Resmi (Opsional, diambil dari Pengaturan) */}
      {data.showKop && kopUrl && (
        <div className="mb-5 pb-1">
          <img
            src={kopUrl}
            alt="Kop Surat Resmi Sekolah"
            className="w-full max-h-[145px] object-contain mx-auto block"
          />
        </div>
      )}

      {/* Judul Surat & Nomor Surat */}
      <header className="text-center">
        <h2 className="text-[15px] sm:text-[16px] font-bold uppercase tracking-wide underline underline-offset-4 decoration-[1.5px] text-black leading-tight">
          SURAT KETERANGAN
        </h2>
        <p className="mt-1 text-[13.5px] sm:text-[14px] text-black leading-snug">
          Nomor : {data.letterNumber?.trim() || '—'}
        </p>
      </header>

      {/* Kalimat Pembuka */}
      <p className="mt-6 text-[13.5px] sm:text-[14.5px] text-black leading-[1.9] text-justify">
        Yang bertanda tangan di bawah ini Kepala Sekolah {schoolName}
        {schoolLocation ? ` ${schoolLocation}` : ''} bersedia menerima pindahan
        atas nama :
      </p>

      {/* Tabel Data Siswa Diterima */}
      <div className="mt-5 pl-5 sm:pl-9">
        <table className="w-full border-collapse text-[13.5px] sm:text-[14.5px] text-black leading-[1.75]">
          <tbody>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
                Nama
              </td>
              <td className="w-[14px] align-top py-[2px]">:</td>
              <td className="align-top py-[2px] break-words">
                {data.studentName?.trim() || '—'}
              </td>
            </tr>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
                Tempat tanggal lahir
              </td>
              <td className="w-[14px] align-top py-[2px]">:</td>
              <td className="align-top py-[2px] break-words">{ttlDisplay}</td>
            </tr>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
                Jenis Kelamin
              </td>
              <td className="w-[14px] align-top py-[2px]">:</td>
              <td className="align-top py-[2px] break-words">
                {data.gender?.trim() || '—'}
              </td>
            </tr>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
                Agama
              </td>
              <td className="w-[14px] align-top py-[2px]">:</td>
              <td className="align-top py-[2px] break-words">
                {data.religion?.trim() || '—'}
              </td>
            </tr>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
                Alamat / Domisili
              </td>
              <td className="w-[14px] align-top py-[2px]">:</td>
              <td className="align-top py-[2px] break-words">
                {data.address?.trim() || '—'}
              </td>
            </tr>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
                Asal Sekolah
              </td>
              <td className="w-[14px] align-top py-[2px]">:</td>
              <td className="align-top py-[2px] break-words">
                {data.originSchool?.trim() || '—'}
              </td>
            </tr>
            <tr>
              <td className="w-[150px] sm:w-[175px] align-top py-[2px] pr-2">
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

      {/* Kalimat Ketentuan & Penutup */}
      <div className="mt-6 space-y-2 text-[13.5px] sm:text-[14.5px] text-black leading-[1.9] text-justify">
        {data.requirementClause?.trim() && <p>{data.requirementClause.trim()}</p>}
        {data.closingClause?.trim() && <p>{data.closingClause.trim()}</p>}
      </div>

      {/* Blok Tanda Tangan Kepala Sekolah */}
      <div className="mt-10 sm:mt-12 flex justify-end">
        <div className="w-[240px] sm:w-[270px] text-[13.5px] sm:text-[14.5px] text-black leading-[1.45] text-left">
          <p>{cityAndDate}</p>
          <p>{principalPosition}</p>

          {/* Ruang Tanda Tangan & Stempel */}
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
                    alt="Tanda Tangan Kepala Sekolah"
                    className={`h-[68px] w-auto object-contain mix-blend-multiply pointer-events-none select-none ${
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
          <p className="text-black">
            NIP. {principalNip || '—'}
          </p>
        </div>
      </div>
    </article>
  );
};
