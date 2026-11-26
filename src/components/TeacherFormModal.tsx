import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { ClassOptionItem } from '../types/auth';
import type { TeacherInputPayload, TeacherRecord } from '../types/teacher';
import { fetchClassOptions } from '../lib/authApi';
import { createTeacher, updateTeacher } from '../lib/teacherApi';

interface TeacherFormModalProps {
  existingTeacher?: TeacherRecord | null;
  onClose: () => void;
  onSaved: (teacher: TeacherRecord) => void;
}

type FormSectionId = 'identitas' | 'alamat' | 'kepegawaian' | 'administrasi';

const SECTIONS: { id: FormSectionId; label: string }[] = [
  { id: 'identitas', label: 'A. Identitas Guru' },
  { id: 'alamat', label: 'B. Alamat & Kontak' },
  { id: 'kepegawaian', label: 'C. Data Kepegawaian' },
  { id: 'administrasi', label: 'D. Administrasi Tambahan' },
];

function buildInitialPayload(teacher?: TeacherRecord | null): TeacherInputPayload {
  if (!teacher) {
    return {
      no: '',
      nama: '',
      nuptk: '',
      jk: '',
      tempatLahir: '',
      tanggalLahir: '',
      nip: '',
      statusKepegawaian: '',
      jenisPtk: '',
      agama: '',
      alamatJalan: '',
      rt: '',
      rw: '',
      namaDusun: '',
      desaKelurahan: '',
      kecamatan: '',
      kodePos: '',
      telepon: '',
      hp: '',
      email: '',
      tugasTambahan: '',
      skCpns: '',
      tanggalCpns: '',
      skPengangkatan: '',
      tmtPengangkatan: '',
      lembagaPengangkatan: '',
      pangkatGolongan: '',
      sumberGaji: '',
      tmtPns: '',
      namaIbuKandung: '',
      statusPerkawinan: '',
      namaSuamiIstri: '',
      nipSuamiIstri: '',
      pekerjaanSuamiIstri: '',
      sudahLisensi: '',
      kepalaSekolah: '',
      pernahDiklatKepengawasan: '',
      keahlianBraille: '',
      keahlianBahasaIsyarat: '',
      npwp: '',
      namaWajibPajak: '',
      kewarganegaraan: 'Indonesia',
      bank: '',
      nomorRekeningBank: '',
      rekeningAtasNama: '',
      nik: '',
      noKk: '',
      karpeg: '',
      karisKarsu: '',
      lintang: '',
      bujur: '',
      nuks: '',
      assignedClass: '',
    };
  }
  const {
    id: _id,
    statusData: _sd,
    linkedAccountId: _lid,
    linkedAccountUsername: _lu,
    linkedAccountStatus: _ls,
    createdAt: _c,
    updatedAt: _u,
    ...rest
  } = teacher;
  return rest;
}

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
    />
  </div>
);

export const TeacherFormModal: React.FC<TeacherFormModalProps> = ({
  existingTeacher,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(existingTeacher);
  const [section, setSection] = useState<FormSectionId>('identitas');
  const [form, setForm] = useState<TeacherInputPayload>(() =>
    buildInitialPayload(existingTeacher)
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOptionItem[]>([]);

  useEffect(() => {
    fetchClassOptions()
      .then((list) => setClassOptions(list))
      .catch(() => setClassOptions([]));
  }, []);

  const normalizeClassKey = (val: string) =>
    (val || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const setField = <K extends keyof TeacherInputPayload>(
    key: K,
    val: TeacherInputPayload[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.nama.trim()) {
      setSection('identitas');
      setErrorMsg('Nama lengkap guru wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const saved = existingTeacher
        ? await updateTeacher(existingTeacher.id, form)
        : await createTeacher(form);
      onSaved(saved);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan data guru.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[93dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div>
            <h2
              id="teacher-form-title"
              className="text-base sm:text-lg font-extrabold text-[#17325C]"
            >
              {isEdit ? 'Edit Data Guru' : 'Tambah Data Guru'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lengkapi identitas guru sesuai struktur data resmi sekolah.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup form guru"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi 4 Grup */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-5 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                section === s.id
                  ? 'bg-[#1D63D8] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {section === 'identitas' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Field
                label="No Urut"
                value={form.no}
                onChange={(v) => setField('no', v)}
                placeholder="1"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Nama Lengkap Guru"
                  value={form.nama}
                  onChange={(v) => setField('nama', v)}
                  placeholder="Contoh: Siti Aminah, S.Pd."
                  required
                />
              </div>
              <Field
                label="NIP"
                value={form.nip}
                onChange={(v) => setField('nip', v)}
                placeholder="18 digit NIP (jika ada)"
              />
              <Field
                label="NUPTK"
                value={form.nuptk}
                onChange={(v) => setField('nuptk', v)}
                placeholder="16 digit NUPTK"
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Kelamin (JK)
                </label>
                <select
                  value={form.jk}
                  onChange={(e) => setField('jk', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm"
                >
                  <option value="">-- Pilih --</option>
                  <option value="L">L (Laki-laki)</option>
                  <option value="P">P (Perempuan)</option>
                </select>
              </div>
              <Field
                label="Tempat Lahir"
                value={form.tempatLahir}
                onChange={(v) => setField('tempatLahir', v)}
              />
              <Field
                label="Tanggal Lahir"
                type="date"
                value={form.tanggalLahir}
                onChange={(v) => setField('tanggalLahir', v)}
              />
              <Field
                label="Status Kepegawaian"
                value={form.statusKepegawaian}
                onChange={(v) => setField('statusKepegawaian', v)}
                placeholder="PNS / PPPK / Guru Honor Sekolah"
              />
              <Field
                label="Jenis PTK"
                value={form.jenisPtk}
                onChange={(v) => setField('jenisPtk', v)}
                placeholder="Guru Kelas / Guru Mapel / Kepala Sekolah"
              />
              <Field
                label="Agama"
                value={form.agama}
                onChange={(v) => setField('agama', v)}
                placeholder="Islam / Kristen / ..."
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelas yang Dipegang
                </label>
                {classOptions.length > 0 ? (
                  <select
                    value={form.assignedClass || ''}
                    onChange={(e) => setField('assignedClass', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="">-- Tidak memegang kelas --</option>
                    {existingTeacher?.assignedClass &&
                      !classOptions.some(
                        (opt) =>
                          normalizeClassKey(opt.name) ===
                          normalizeClassKey(existingTeacher.assignedClass || '')
                      ) && (
                        <option value={existingTeacher.assignedClass}>
                          {existingTeacher.assignedClass}
                        </option>
                      )}
                    {classOptions.map((opt) => {
                      const isCurrentOwner =
                        Boolean(existingTeacher?.assignedClass) &&
                        normalizeClassKey(opt.name) ===
                          normalizeClassKey(existingTeacher?.assignedClass || '');
                      const occupiedOther =
                        Boolean(opt.occupiedByName) && !isCurrentOwner;
                      return (
                        <option
                          key={opt.name}
                          value={opt.name}
                          disabled={occupiedOther}
                        >
                          {opt.name}
                          {occupiedOther
                            ? ` (Dipegang: ${opt.occupiedByName})`
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.assignedClass || ''}
                    onChange={(e) => setField('assignedClass', e.target.value)}
                    placeholder="Contoh: 1A, 4B (opsional)"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                )}
              </div>
            </div>
          )}

          {section === 'alamat' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2 lg:col-span-3">
                <Field
                  label="Alamat Jalan"
                  value={form.alamatJalan}
                  onChange={(v) => setField('alamatJalan', v)}
                />
              </div>
              <Field
                label="RT"
                value={form.rt}
                onChange={(v) => setField('rt', v)}
              />
              <Field
                label="RW"
                value={form.rw}
                onChange={(v) => setField('rw', v)}
              />
              <Field
                label="Nama Dusun"
                value={form.namaDusun}
                onChange={(v) => setField('namaDusun', v)}
              />
              <Field
                label="Desa / Kelurahan"
                value={form.desaKelurahan}
                onChange={(v) => setField('desaKelurahan', v)}
              />
              <Field
                label="Kecamatan"
                value={form.kecamatan}
                onChange={(v) => setField('kecamatan', v)}
              />
              <Field
                label="Kode Pos"
                value={form.kodePos}
                onChange={(v) => setField('kodePos', v)}
              />
              <Field
                label="Telepon"
                value={form.telepon}
                onChange={(v) => setField('telepon', v)}
              />
              <Field
                label="HP"
                value={form.hp}
                onChange={(v) => setField('hp', v)}
                placeholder="08..."
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setField('email', v)}
              />
            </div>
          )}

          {section === 'kepegawaian' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Field
                label="Tugas Tambahan"
                value={form.tugasTambahan}
                onChange={(v) => setField('tugasTambahan', v)}
              />
              <Field
                label="SK CPNS"
                value={form.skCpns}
                onChange={(v) => setField('skCpns', v)}
              />
              <Field
                label="Tanggal CPNS"
                type="date"
                value={form.tanggalCpns}
                onChange={(v) => setField('tanggalCpns', v)}
              />
              <Field
                label="SK Pengangkatan"
                value={form.skPengangkatan}
                onChange={(v) => setField('skPengangkatan', v)}
              />
              <Field
                label="TMT Pengangkatan"
                type="date"
                value={form.tmtPengangkatan}
                onChange={(v) => setField('tmtPengangkatan', v)}
              />
              <Field
                label="Lembaga Pengangkatan"
                value={form.lembagaPengangkatan}
                onChange={(v) => setField('lembagaPengangkatan', v)}
              />
              <Field
                label="Pangkat Golongan"
                value={form.pangkatGolongan}
                onChange={(v) => setField('pangkatGolongan', v)}
                placeholder="III/a, IX, ..."
              />
              <Field
                label="Sumber Gaji"
                value={form.sumberGaji}
                onChange={(v) => setField('sumberGaji', v)}
              />
              <Field
                label="TMT PNS"
                type="date"
                value={form.tmtPns}
                onChange={(v) => setField('tmtPns', v)}
              />
            </div>
          )}

          {section === 'administrasi' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Field
                label="Nama Ibu Kandung"
                value={form.namaIbuKandung}
                onChange={(v) => setField('namaIbuKandung', v)}
              />
              <Field
                label="Status Perkawinan"
                value={form.statusPerkawinan}
                onChange={(v) => setField('statusPerkawinan', v)}
              />
              <Field
                label="Nama Suami / Istri"
                value={form.namaSuamiIstri}
                onChange={(v) => setField('namaSuamiIstri', v)}
              />
              <Field
                label="NIP Suami / Istri"
                value={form.nipSuamiIstri}
                onChange={(v) => setField('nipSuamiIstri', v)}
              />
              <Field
                label="Pekerjaan Suami / Istri"
                value={form.pekerjaanSuamiIstri}
                onChange={(v) => setField('pekerjaanSuamiIstri', v)}
              />
              <Field
                label="Sudah Lisensi"
                value={form.sudahLisensi}
                onChange={(v) => setField('sudahLisensi', v)}
                placeholder="Ya / Tidak"
              />
              <Field
                label="Kepala Sekolah"
                value={form.kepalaSekolah}
                onChange={(v) => setField('kepalaSekolah', v)}
                placeholder="Ya / Tidak"
              />
              <Field
                label="Pernah Diklat Kepengawasan"
                value={form.pernahDiklatKepengawasan}
                onChange={(v) => setField('pernahDiklatKepengawasan', v)}
              />
              <Field
                label="Keahlian Braille"
                value={form.keahlianBraille}
                onChange={(v) => setField('keahlianBraille', v)}
              />
              <Field
                label="Keahlian Bahasa Isyarat"
                value={form.keahlianBahasaIsyarat}
                onChange={(v) => setField('keahlianBahasaIsyarat', v)}
              />
              <Field
                label="NPWP"
                value={form.npwp}
                onChange={(v) => setField('npwp', v)}
              />
              <Field
                label="Nama Wajib Pajak"
                value={form.namaWajibPajak}
                onChange={(v) => setField('namaWajibPajak', v)}
              />
              <Field
                label="Kewarganegaraan"
                value={form.kewarganegaraan}
                onChange={(v) => setField('kewarganegaraan', v)}
              />
              <Field
                label="Bank"
                value={form.bank}
                onChange={(v) => setField('bank', v)}
              />
              <Field
                label="Nomor Rekening Bank"
                value={form.nomorRekeningBank}
                onChange={(v) => setField('nomorRekeningBank', v)}
              />
              <Field
                label="Rekening Atas Nama"
                value={form.rekeningAtasNama}
                onChange={(v) => setField('rekeningAtasNama', v)}
              />
              <Field
                label="NIK"
                value={form.nik}
                onChange={(v) => setField('nik', v)}
                placeholder="16 digit NIK"
              />
              <Field
                label="No KK"
                value={form.noKk}
                onChange={(v) => setField('noKk', v)}
                placeholder="16 digit No KK"
              />
              <Field
                label="Karpeg"
                value={form.karpeg}
                onChange={(v) => setField('karpeg', v)}
              />
              <Field
                label="Karis / Karsu"
                value={form.karisKarsu}
                onChange={(v) => setField('karisKarsu', v)}
              />
              <Field
                label="Lintang"
                value={form.lintang}
                onChange={(v) => setField('lintang', v)}
              />
              <Field
                label="Bujur"
                value={form.bujur}
                onChange={(v) => setField('bujur', v)}
              />
              <Field
                label="NUKS"
                value={form.nuks}
                onChange={(v) => setField('nuks', v)}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#1D63D8] hover:bg-[#1753B8] disabled:opacity-60 px-5 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Data Guru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
