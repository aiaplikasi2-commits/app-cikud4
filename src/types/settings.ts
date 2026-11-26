export type SchoolFileSlot = 'logo' | 'kop' | 'ttd' | 'stempel';

export interface StoredFileMeta {
  slot: SchoolFileSlot;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  updatedAt: string;
}

export interface SchoolIdentity {
  schoolName: string;
  city: string;
  department: string;
  academicYear: string;
}

export interface OfficialPerson {
  name: string;
  position: string;
  nip: string;
}

export interface SchoolSettings {
  identity: SchoolIdentity;
  principal: OfficialPerson;
  operator: OfficialPerson;
  files: Record<SchoolFileSlot, StoredFileMeta | null>;
  updatedAt: string | null;
}

export const EMPTY_SCHOOL_SETTINGS: SchoolSettings = {
  identity: {
    schoolName: '',
    city: '',
    department: '',
    academicYear: '',
  },
  principal: {
    name: '',
    position: '',
    nip: '',
  },
  operator: {
    name: '',
    position: '',
    nip: '',
  },
  files: {
    logo: null,
    kop: null,
    ttd: null,
    stempel: null,
  },
  updatedAt: null,
};
