import React from 'react';
import { FileText, Pencil, User, X } from 'lucide-react';
import type { StudentRecord } from '../types/student';
import type { UserRole } from '../types/auth';

interface StudentDetailModalProps {
  student: StudentRecord;
  userRole: UserRole;
  onClose: () => void;
  onEdit?: () => void;
  onCreateLetter?: () => void;
}

function formatDateId(value: string): string {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

const InfoItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="bg-slate-50/70 rounded-xl px-3 py-2 border border-slate-100">
    <span className="block text-[11px] font-medium text-slate-500">{label}</span>
    <span className="mt-0.5 block text-xs sm:text-sm font-semibold text-slate-900 break-words">
      {value && value.trim() ? value : '—'}
    </span>
  </div>
);

const SectionBlock: React.FC<{
  number: number;
  title: string;
  children: React.ReactNode;
}> = ({ number, title, children }) => (
  <section className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3">
    <h3 className="text-xs sm:text-sm font-extrabold text-[#17325C] flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-extrabold text-[#1D63D8]">
        {number}
      </span>
      {title}
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {children}
    </div>
  </section>
);

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  userRole,
  onClose,
  onEdit,
  onCreateLetter,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#F4F7FC] shadow-2xl border border-slate-200 overflow-hidden max-h-[93dvh] flex flex-col">
        {/* Header Profil */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-[#1D63D8] flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="student-detail-title"
                className="text-base sm:text-lg font-extrabold text-[#17325C] truncate"
              >
                {student.nama}
              </h2>
              <p className="text-xs text-slate-600">
                NISN: <strong>{student.nisn || '—'}</strong> · NIPD:{' '}
                <strong>{student.nipd || '—'}</strong> · Rombel:{' '}
                <strong>{student.rombelSaatIni || '—'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userRole === 'OPERATOR' && onCreateLetter && (
              <button
                type="button"
                onClick={onCreateLetter}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 text-xs font-bold text-[#1D63D8] whitespace-nowrap cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Buat Surat
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Tutup profil siswa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 9 Bagian Profil Siswa */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          <SectionBlock number={1} title="Identitas Siswa">
            <InfoItem label="Nama Lengkap" value={student.nama} />
            <InfoItem label="NISN" value={student.nisn} />
            <InfoItem label="NIPD" value={student.nipd} />
            <InfoItem
              label="Jenis Kelamin"
              value={
                student.jk === 'L'
                  ? 'Laki-laki (L)'
                  : student.jk === 'P'
                    ? 'Perempuan (P)'
                    : student.jk
              }
            />
            <InfoItem label="Tempat Lahir" value={student.tempatLahir} />
            <InfoItem label="Tanggal Lahir" value={formatDateId(student.tanggalLahir)} />
            <InfoItem label="NIK" value={student.nik} />
            <InfoItem label="No. KK" value={student.noKk} />
            <InfoItem label="No. Registrasi Akta Lahir" value={student.noRegistrasiAktaLahir} />
            <InfoItem label="Agama" value={student.agama} />
            <InfoItem label="Kebutuhan Khusus" value={student.kebutuhanKhusus} />
            <InfoItem label="Anak Ke-berapa" value={student.anakKeBerapa} />
            <InfoItem label="Jumlah Saudara Kandung" value={student.jmlSaudaraKandung} />
          </SectionBlock>

          <SectionBlock number={2} title="Alamat dan Kontak">
            <InfoItem label="Alamat" value={student.alamat} />
            <InfoItem label="RT / RW" value={[student.rt, student.rw].filter(Boolean).join(' / ')} />
            <InfoItem label="Dusun" value={student.dusun} />
            <InfoItem label="Kelurahan" value={student.kelurahan} />
            <InfoItem label="Kecamatan" value={student.kecamatan} />
            <InfoItem label="Kode Pos" value={student.kodePos} />
            <InfoItem label="Jenis Tinggal" value={student.jenisTinggal} />
            <InfoItem label="Alat Transportasi" value={student.alatTransportasi} />
            <InfoItem label="Telepon" value={student.telepon} />
            <InfoItem label="HP" value={student.hp} />
            <InfoItem label="E-Mail" value={student.email} />
            <InfoItem label="Jarak ke Sekolah (KM)" value={student.jarakRumahKeSekolahKm} />
            <InfoItem label="Lintang" value={student.lintang} />
            <InfoItem label="Bujur" value={student.bujur} />
          </SectionBlock>

          <SectionBlock number={3} title="Data Ayah">
            <InfoItem label="Nama Ayah" value={student.ayah.nama} />
            <InfoItem label="Tahun Lahir" value={student.ayah.tahunLahir} />
            <InfoItem label="Jenjang Pendidikan" value={student.ayah.jenjangPendidikan} />
            <InfoItem label="Pekerjaan" value={student.ayah.pekerjaan} />
            <InfoItem label="Penghasilan" value={student.ayah.penghasilan} />
            <InfoItem label="NIK Ayah" value={student.ayah.nik} />
          </SectionBlock>

          <SectionBlock number={4} title="Data Ibu">
            <InfoItem label="Nama Ibu" value={student.ibu.nama} />
            <InfoItem label="Tahun Lahir" value={student.ibu.tahunLahir} />
            <InfoItem label="Jenjang Pendidikan" value={student.ibu.jenjangPendidikan} />
            <InfoItem label="Pekerjaan" value={student.ibu.pekerjaan} />
            <InfoItem label="Penghasilan" value={student.ibu.penghasilan} />
            <InfoItem label="NIK Ibu" value={student.ibu.nik} />
          </SectionBlock>

          <SectionBlock number={5} title="Data Wali">
            <InfoItem label="Nama Wali" value={student.wali.nama} />
            <InfoItem label="Tahun Lahir" value={student.wali.tahunLahir} />
            <InfoItem label="Jenjang Pendidikan" value={student.wali.jenjangPendidikan} />
            <InfoItem label="Pekerjaan" value={student.wali.pekerjaan} />
            <InfoItem label="Penghasilan" value={student.wali.penghasilan} />
            <InfoItem label="NIK Wali" value={student.wali.nik} />
          </SectionBlock>

          <SectionBlock number={6} title="Data Akademik">
            <InfoItem label="Rombel Saat Ini" value={student.rombelSaatIni} />
            <InfoItem label="Sekolah Asal" value={student.sekolahAsal} />
            <InfoItem label="SKHUN" value={student.skhun} />
            <InfoItem label="No. Peserta Ujian Nasional" value={student.noPesertaUjianNasional} />
            <InfoItem label="No. Seri Ijazah" value={student.noSeriIjazah} />
          </SectionBlock>

          <SectionBlock number={7} title="Data Bantuan dan KIP/PIP">
            <InfoItem label="Penerima KPS" value={student.penerimaKps} />
            <InfoItem label="No. KPS" value={student.noKps} />
            <InfoItem label="Penerima KIP" value={student.penerimaKip} />
            <InfoItem label="Nomor KIP" value={student.nomorKip} />
            <InfoItem label="Nama di KIP" value={student.namaDiKip} />
            <InfoItem label="Nomor KKS" value={student.nomorKks} />
            <InfoItem label="Bank" value={student.bank} />
            <InfoItem label="Nomor Rekening Bank" value={student.nomorRekeningBank} />
            <InfoItem label="Rekening Atas Nama" value={student.rekeningAtasNama} />
            <InfoItem label="Layak PIP (Usulan Sekolah)" value={student.layakPip} />
            <InfoItem label="Alasan Layak PIP" value={student.alasanLayakPip} />
          </SectionBlock>

          <SectionBlock number={8} title="Data Kesehatan dan Fisik">
            <InfoItem label="Berat Badan" value={student.beratBadan} />
            <InfoItem label="Tinggi Badan" value={student.tinggiBadan} />
            <InfoItem label="Lingkar Kepala" value={student.lingkarKepala} />
          </SectionBlock>

          <SectionBlock number={9} title="Data Administrasi Tambahan">
            <InfoItem label="No. Urut Dapodik" value={student.no} />
            <InfoItem
              label="Status Kelengkapan Data"
              value={student.statusData === 'LENGKAP' ? 'Lengkap' : 'Perlu Diperiksa'}
            />
            <InfoItem label="Terakhir Diperbarui" value={formatTimestamp(student.updatedAt)} />
          </SectionBlock>
        </div>
      </div>
    </div>
  );
};
