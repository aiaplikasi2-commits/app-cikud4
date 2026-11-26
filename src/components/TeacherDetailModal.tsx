import React from 'react';
import { Link2, Pencil, ShieldCheck, User, X } from 'lucide-react';
import type { UserRole } from '../types/auth';
import type { TeacherRecord } from '../types/teacher';

interface TeacherDetailModalProps {
  teacher: TeacherRecord;
  userRole: UserRole;
  onClose: () => void;
  onEdit?: () => void;
  onOpenLinkModal?: () => void;
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
  badge: string;
  title: string;
  children: React.ReactNode;
}> = ({ badge, title, children }) => (
  <section className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3">
    <h3 className="text-xs sm:text-sm font-extrabold text-[#17325C] flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-extrabold text-[#1D63D8]">
        {badge}
      </span>
      {title}
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {children}
    </div>
  </section>
);

export const TeacherDetailModal: React.FC<TeacherDetailModalProps> = ({
  teacher,
  userRole,
  onClose,
  onEdit,
  onOpenLinkModal,
}) => {
  const isOperator = userRole === 'OPERATOR';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-detail-title"
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
                id="teacher-detail-title"
                className="text-base sm:text-lg font-extrabold text-[#17325C] truncate"
              >
                {teacher.nama}
              </h2>
              <p className="text-xs text-slate-600">
                NIP: <strong>{teacher.nip || '—'}</strong> · NUPTK:{' '}
                <strong>{teacher.nuptk || '—'}</strong> ·{' '}
                <strong>{teacher.jenisPtk || 'Guru'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOperator && onOpenLinkModal && (
              <button
                type="button"
                onClick={onOpenLinkModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-2 text-xs font-bold text-blue-700 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                {teacher.linkedAccountId ? 'Ubah Tautan Akun' : 'Hubungkan Akun Login'}
              </button>
            )}
            {isOperator && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Data
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Tutup detail guru"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body 4 Grup */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* Status Tautan Akun Login */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1D63D8]" />
              <span className="font-semibold text-slate-700">
                Status Akun Login Guru:
              </span>
              {teacher.linkedAccountId ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                  Terhubung ({teacher.linkedAccountUsername || 'Aktif'})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                  Belum Dihubungkan ke Akun Login
                </span>
              )}
            </div>
            <span className="text-slate-500">
              Terakhir diperbarui: {formatTimestamp(teacher.updatedAt)}
            </span>
          </div>

          {!isOperator && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
              Demi perlindungan data pribadi PTK, kolom sensitif (NIK, No KK, NPWP,
              Nomor Rekening Bank, NIP Suami/Istri, Karpeg, Karis/Karsu) disamarkan
              untuk peran Guru.
            </div>
          )}

          <SectionBlock badge="A" title="Identitas Guru">
            <InfoItem label="No" value={teacher.no} />
            <InfoItem label="Nama Lengkap" value={teacher.nama} />
            <InfoItem label="NUPTK" value={teacher.nuptk} />
            <InfoItem
              label="Jenis Kelamin (JK)"
              value={
                teacher.jk === 'L'
                  ? 'L (Laki-laki)'
                  : teacher.jk === 'P'
                    ? 'P (Perempuan)'
                    : teacher.jk
              }
            />
            <InfoItem label="Tempat Lahir" value={teacher.tempatLahir} />
            <InfoItem
              label="Tanggal Lahir"
              value={formatDateId(teacher.tanggalLahir)}
            />
            <InfoItem label="NIP" value={teacher.nip} />
            <InfoItem
              label="Status Kepegawaian"
              value={teacher.statusKepegawaian}
            />
            <InfoItem label="Jenis PTK" value={teacher.jenisPtk} />
            <InfoItem label="Agama" value={teacher.agama} />
            <InfoItem label="Kelas yang Dipegang" value={teacher.assignedClass} />
          </SectionBlock>

          <SectionBlock badge="B" title="Alamat dan Kontak">
            <InfoItem label="Alamat Jalan" value={teacher.alamatJalan} />
            <InfoItem label="RT" value={teacher.rt} />
            <InfoItem label="RW" value={teacher.rw} />
            <InfoItem label="Nama Dusun" value={teacher.namaDusun} />
            <InfoItem label="Desa / Kelurahan" value={teacher.desaKelurahan} />
            <InfoItem label="Kecamatan" value={teacher.kecamatan} />
            <InfoItem label="Kode Pos" value={teacher.kodePos} />
            <InfoItem label="Telepon" value={teacher.telepon} />
            <InfoItem label="HP" value={teacher.hp} />
            <InfoItem label="Email" value={teacher.email} />
          </SectionBlock>

          <SectionBlock badge="C" title="Data Kepegawaian">
            <InfoItem label="Tugas Tambahan" value={teacher.tugasTambahan} />
            <InfoItem label="SK CPNS" value={teacher.skCpns} />
            <InfoItem
              label="Tanggal CPNS"
              value={formatDateId(teacher.tanggalCpns)}
            />
            <InfoItem label="SK Pengangkatan" value={teacher.skPengangkatan} />
            <InfoItem
              label="TMT Pengangkatan"
              value={formatDateId(teacher.tmtPengangkatan)}
            />
            <InfoItem
              label="Lembaga Pengangkatan"
              value={teacher.lembagaPengangkatan}
            />
            <InfoItem label="Pangkat Golongan" value={teacher.pangkatGolongan} />
            <InfoItem label="Sumber Gaji" value={teacher.sumberGaji} />
            <InfoItem label="TMT PNS" value={formatDateId(teacher.tmtPns)} />
          </SectionBlock>

          <SectionBlock badge="D" title="Data Administrasi Tambahan">
            <InfoItem label="Nama Ibu Kandung" value={teacher.namaIbuKandung} />
            <InfoItem
              label="Status Perkawinan"
              value={teacher.statusPerkawinan}
            />
            <InfoItem label="Nama Suami / Istri" value={teacher.namaSuamiIstri} />
            <InfoItem label="NIP Suami / Istri" value={teacher.nipSuamiIstri} />
            <InfoItem
              label="Pekerjaan Suami / Istri"
              value={teacher.pekerjaanSuamiIstri}
            />
            <InfoItem label="Sudah Lisensi" value={teacher.sudahLisensi} />
            <InfoItem label="Kepala Sekolah" value={teacher.kepalaSekolah} />
            <InfoItem
              label="Pernah Diklat Kepengawasan"
              value={teacher.pernahDiklatKepengawasan}
            />
            <InfoItem label="Keahlian Braille" value={teacher.keahlianBraille} />
            <InfoItem
              label="Keahlian Bahasa Isyarat"
              value={teacher.keahlianBahasaIsyarat}
            />
            <InfoItem label="NPWP" value={teacher.npwp} />
            <InfoItem label="Nama Wajib Pajak" value={teacher.namaWajibPajak} />
            <InfoItem label="Kewarganegaraan" value={teacher.kewarganegaraan} />
            <InfoItem label="Bank" value={teacher.bank} />
            <InfoItem
              label="Nomor Rekening Bank"
              value={teacher.nomorRekeningBank}
            />
            <InfoItem
              label="Rekening Atas Nama"
              value={teacher.rekeningAtasNama}
            />
            <InfoItem label="NIK" value={teacher.nik} />
            <InfoItem label="No KK" value={teacher.noKk} />
            <InfoItem label="Karpeg" value={teacher.karpeg} />
            <InfoItem label="Karis / Karsu" value={teacher.karisKarsu} />
            <InfoItem label="Lintang" value={teacher.lintang} />
            <InfoItem label="Bujur" value={teacher.bujur} />
            <InfoItem label="NUKS" value={teacher.nuks} />
          </SectionBlock>
        </div>

        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] px-5 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
