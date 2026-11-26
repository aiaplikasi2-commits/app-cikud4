import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type {
  ParentGuardianInfo,
  StudentInputPayload,
  StudentRecord,
} from '../types/student';
import { createStudent, updateStudent } from '../lib/studentApi';

interface StudentFormModalProps {
  existingStudent?: StudentRecord | null;
  onClose: () => void;
  onSaved: (student: StudentRecord) => void;
}

type FormSectionId =
  | 'identitas'
  | 'alamat'
  | 'ayah'
  | 'ibu'
  | 'wali'
  | 'akademik'
  | 'bantuan'
  | 'kesehatan';

const SECTIONS: { id: FormSectionId; label: string }[] = [
  { id: 'identitas', label: 'Identitas' },
  { id: 'alamat', label: 'Alamat & Kontak' },
  { id: 'ayah', label: 'Data Ayah' },
  { id: 'ibu', label: 'Data Ibu' },
  { id: 'wali', label: 'Data Wali' },
  { id: 'akademik', label: 'Akademik' },
  { id: 'bantuan', label: 'KIP / PIP' },
  { id: 'kesehatan', label: 'Kesehatan' },
];

function createEmptyParent(): ParentGuardianInfo {
  return {
    nama: '',
    tahunLahir: '',
    jenjangPendidikan: '',
    pekerjaan: '',
    penghasilan: '',
    nik: '',
  };
}

function buildInitialPayload(student?: StudentRecord | null): StudentInputPayload {
  if (!student) {
    return {
      no: '',
      nama: '',
      nipd: '',
      jk: '',
      nisn: '',
      tempatLahir: '',
      tanggalLahir: '',
      nik: '',
      agama: '',
      noRegistrasiAktaLahir: '',
      noKk: '',
      kebutuhanKhusus: '',
      anakKeBerapa: '',
      jmlSaudaraKandung: '',
      alamat: '',
      rt: '',
      rw: '',
      dusun: '',
      kelurahan: '',
      kecamatan: '',
      kodePos: '',
      jenisTinggal: '',
      alatTransportasi: '',
      telepon: '',
      hp: '',
      email: '',
      lintang: '',
      bujur: '',
      jarakRumahKeSekolahKm: '',
      ayah: createEmptyParent(),
      ibu: createEmptyParent(),
      wali: createEmptyParent(),
      rombelSaatIni: '',
      sekolahAsal: '',
      skhun: '',
      noPesertaUjianNasional: '',
      noSeriIjazah: '',
      penerimaKps: '',
      noKps: '',
      penerimaKip: '',
      nomorKip: '',
      namaDiKip: '',
      nomorKks: '',
      bank: '',
      nomorRekeningBank: '',
      rekeningAtasNama: '',
      layakPip: '',
      alasanLayakPip: '',
      beratBadan: '',
      tinggiBadan: '',
      lingkarKepala: '',
    };
  }
  const { id: _id, statusData: _s, createdAt: _c, updatedAt: _u, ...rest } = student;
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
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
    />
  </div>
);

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  existingStudent,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(existingStudent);
  const [activeSection, setActiveSection] = useState<FormSectionId>('identitas');
  const [form, setForm] = useState<StudentInputPayload>(() =>
    buildInitialPayload(existingStudent)
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setField = <K extends keyof StudentInputPayload>(
    key: K,
    val: StudentInputPayload[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const setParentField = (
    group: 'ayah' | 'ibu' | 'wali',
    key: keyof ParentGuardianInfo,
    val: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: val,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.nama.trim()) {
      setErrorMsg('Nama siswa wajib diisi.');
      setActiveSection('identitas');
      return;
    }
    if (!form.nisn.trim() && !form.nipd.trim()) {
      setErrorMsg('Minimal NISN atau NIPD harus diisi.');
      setActiveSection('identitas');
      return;
    }

    setSubmitting(true);
    try {
      const saved = existingStudent
        ? await updateStudent(existingStudent.id, form)
        : await createStudent(form);
      onSaved(saved);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan data siswa.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <h2
            id="student-form-title"
            className="text-base sm:text-lg font-extrabold text-[#17325C]"
          >
            {isEdit ? `Edit Data Siswa: ${existingStudent?.nama}` : 'Tambah Data Siswa'}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bagian Formulir */}
        <div className="px-5 py-2.5 border-b border-slate-100 bg-white overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 min-w-max">
            {SECTIONS.map((sec) => {
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1D63D8] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sec.label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0" noValidate>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700 font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {activeSection === 'identitas' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <Field
                    label="Nama Lengkap Siswa"
                    value={form.nama}
                    onChange={(v) => setField('nama', v)}
                    required
                  />
                </div>
                <Field
                  label="NISN"
                  value={form.nisn}
                  onChange={(v) => setField('nisn', v)}
                  placeholder="10 digit angka"
                />
                <Field
                  label="NIPD"
                  value={form.nipd}
                  onChange={(v) => setField('nipd', v)}
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={form.jk}
                    onChange={(e) => setField('jk', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="">Pilih Jenis Kelamin</option>
                    <option value="L">L (Laki-laki)</option>
                    <option value="P">P (Perempuan)</option>
                  </select>
                </div>
                <Field
                  label="Agama"
                  value={form.agama}
                  onChange={(v) => setField('agama', v)}
                />
                <Field
                  label="Tempat Lahir"
                  value={form.tempatLahir}
                  onChange={(v) => setField('tempatLahir', v)}
                />
                <Field
                  label="Tanggal Lahir"
                  type="date"
                  value={/^\d{4}-\d{2}-\d{2}$/.test(form.tanggalLahir) ? form.tanggalLahir : ''}
                  onChange={(v) => setField('tanggalLahir', v)}
                />
                <Field label="NIK" value={form.nik} onChange={(v) => setField('nik', v)} />
                <Field
                  label="No. KK"
                  value={form.noKk}
                  onChange={(v) => setField('noKk', v)}
                />
                <Field
                  label="No. Registrasi Akta Lahir"
                  value={form.noRegistrasiAktaLahir}
                  onChange={(v) => setField('noRegistrasiAktaLahir', v)}
                />
                <Field
                  label="Kebutuhan Khusus"
                  value={form.kebutuhanKhusus}
                  onChange={(v) => setField('kebutuhanKhusus', v)}
                />
                <Field
                  label="Anak Ke-berapa"
                  value={form.anakKeBerapa}
                  onChange={(v) => setField('anakKeBerapa', v)}
                />
                <Field
                  label="Jumlah Saudara Kandung"
                  value={form.jmlSaudaraKandung}
                  onChange={(v) => setField('jmlSaudaraKandung', v)}
                />
              </div>
            )}

            {activeSection === 'alamat' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <Field
                    label="Alamat"
                    value={form.alamat}
                    onChange={(v) => setField('alamat', v)}
                  />
                </div>
                <Field label="RT" value={form.rt} onChange={(v) => setField('rt', v)} />
                <Field label="RW" value={form.rw} onChange={(v) => setField('rw', v)} />
                <Field label="Dusun" value={form.dusun} onChange={(v) => setField('dusun', v)} />
                <Field
                  label="Kelurahan"
                  value={form.kelurahan}
                  onChange={(v) => setField('kelurahan', v)}
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
                  label="Jenis Tinggal"
                  value={form.jenisTinggal}
                  onChange={(v) => setField('jenisTinggal', v)}
                />
                <Field
                  label="Alat Transportasi"
                  value={form.alatTransportasi}
                  onChange={(v) => setField('alatTransportasi', v)}
                />
                <Field
                  label="Telepon"
                  value={form.telepon}
                  onChange={(v) => setField('telepon', v)}
                />
                <Field label="HP" value={form.hp} onChange={(v) => setField('hp', v)} />
                <Field
                  label="E-Mail"
                  value={form.email}
                  onChange={(v) => setField('email', v)}
                />
                <Field
                  label="Jarak Rumah ke Sekolah (KM)"
                  value={form.jarakRumahKeSekolahKm}
                  onChange={(v) => setField('jarakRumahKeSekolahKm', v)}
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
              </div>
            )}

            {(activeSection === 'ayah' ||
              activeSection === 'ibu' ||
              activeSection === 'wali') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <Field
                    label={`Nama ${
                      activeSection === 'ayah'
                        ? 'Ayah'
                        : activeSection === 'ibu'
                          ? 'Ibu'
                          : 'Wali'
                    }`}
                    value={form[activeSection].nama}
                    onChange={(v) => setParentField(activeSection, 'nama', v)}
                  />
                </div>
                <Field
                  label="Tahun Lahir"
                  value={form[activeSection].tahunLahir}
                  onChange={(v) => setParentField(activeSection, 'tahunLahir', v)}
                />
                <Field
                  label="Jenjang Pendidikan"
                  value={form[activeSection].jenjangPendidikan}
                  onChange={(v) =>
                    setParentField(activeSection, 'jenjangPendidikan', v)
                  }
                />
                <Field
                  label="Pekerjaan"
                  value={form[activeSection].pekerjaan}
                  onChange={(v) => setParentField(activeSection, 'pekerjaan', v)}
                />
                <Field
                  label="Penghasilan"
                  value={form[activeSection].penghasilan}
                  onChange={(v) => setParentField(activeSection, 'penghasilan', v)}
                />
                <div className="sm:col-span-2">
                  <Field
                    label="NIK"
                    value={form[activeSection].nik}
                    onChange={(v) => setParentField(activeSection, 'nik', v)}
                  />
                </div>
              </div>
            )}

            {activeSection === 'akademik' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Kelas / Rombel Saat Ini"
                  value={form.rombelSaatIni}
                  onChange={(v) => setField('rombelSaatIni', v)}
                  placeholder="Contoh: Kelas 6A"
                />
                <Field
                  label="Sekolah Asal"
                  value={form.sekolahAsal}
                  onChange={(v) => setField('sekolahAsal', v)}
                />
                <Field
                  label="SKHUN"
                  value={form.skhun}
                  onChange={(v) => setField('skhun', v)}
                />
                <Field
                  label="No. Peserta Ujian Nasional"
                  value={form.noPesertaUjianNasional}
                  onChange={(v) => setField('noPesertaUjianNasional', v)}
                />
                <Field
                  label="No. Seri Ijazah"
                  value={form.noSeriIjazah}
                  onChange={(v) => setField('noSeriIjazah', v)}
                />
                <Field
                  label="No. Urut Dapodik"
                  value={form.no}
                  onChange={(v) => setField('no', v)}
                />
              </div>
            )}

            {activeSection === 'bantuan' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Penerima KPS"
                  value={form.penerimaKps}
                  onChange={(v) => setField('penerimaKps', v)}
                />
                <Field
                  label="No. KPS"
                  value={form.noKps}
                  onChange={(v) => setField('noKps', v)}
                />
                <Field
                  label="Penerima KIP"
                  value={form.penerimaKip}
                  onChange={(v) => setField('penerimaKip', v)}
                />
                <Field
                  label="Nomor KIP"
                  value={form.nomorKip}
                  onChange={(v) => setField('nomorKip', v)}
                />
                <Field
                  label="Nama di KIP"
                  value={form.namaDiKip}
                  onChange={(v) => setField('namaDiKip', v)}
                />
                <Field
                  label="Nomor KKS"
                  value={form.nomorKks}
                  onChange={(v) => setField('nomorKks', v)}
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
                  label="Layak PIP (Usulan Sekolah)"
                  value={form.layakPip}
                  onChange={(v) => setField('layakPip', v)}
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Alasan Layak PIP"
                    value={form.alasanLayakPip}
                    onChange={(v) => setField('alasanLayakPip', v)}
                  />
                </div>
              </div>
            )}

            {activeSection === 'kesehatan' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <Field
                  label="Berat Badan (kg)"
                  value={form.beratBadan}
                  onChange={(v) => setField('beratBadan', v)}
                />
                <Field
                  label="Tinggi Badan (cm)"
                  value={form.tinggiBadan}
                  onChange={(v) => setField('tinggiBadan', v)}
                />
                <Field
                  label="Lingkar Kepala (cm)"
                  value={form.lingkarKepala}
                  onChange={(v) => setField('lingkarKepala', v)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
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
              {submitting
                ? 'Menyimpan...'
                : isEdit
                  ? 'Simpan Perubahan'
                  : 'Simpan Data Siswa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
