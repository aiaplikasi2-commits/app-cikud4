export type AgendaStatus =
  | 'DIRENCANAKAN'
  | 'BERLANGSUNG'
  | 'SELESAI'
  | 'DIBATALKAN';

export type AgendaVisibility = 'SCHOOL' | 'PERSONAL';

export const DEFAULT_AGENDA_CATEGORIES: string[] = [
  'Kegiatan belajar mengajar',
  'Kegiatan kepala sekolah',
  'Kegiatan guru',
  'Kegiatan operator sekolah',
  'Kegiatan tata usaha',
  'Kegiatan administrasi',
  'Rapat',
  'Kegiatan siswa',
  'Kegiatan upacara',
  'Kegiatan ekstrakurikuler',
  'Kegiatan sekolah',
  'Kegiatan dinas',
  'Kegiatan lainnya',
];

export interface AgendaConfig {
  categories: string[];
  allowGuruCreate: boolean;
  allowOperatorViewGuruPersonal: boolean;
  updatedAt: string | null;
}

export interface AgendaPersonOption {
  id: string;
  nama: string;
  nip: string;
  jenisPtk: string;
  group: 'GURU' | 'TENDIK';
  linkedAccountId: string | null;
  assignedClass: string;
}

export interface AgendaRecord {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  category: string;
  picId: string | null;
  picName: string;
  participantIds: string[];
  participantNames: string[];
  extraParticipants: string;
  location: string;
  description: string;
  notes: string;
  status: AgendaStatus;
  visibility: AgendaVisibility;
  createdByUserId: string;
  createdByName: string;
  createdByRole: 'OPERATOR' | 'GURU';
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaInputPayload {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category: string;
  picId?: string | null;
  picName?: string;
  participantIds?: string[];
  extraParticipants?: string;
  location?: string;
  description?: string;
  notes?: string;
  status?: AgendaStatus;
  visibility?: AgendaVisibility;
}

export interface AgendaSummary {
  todayDate: string;
  todayCount: number;
  ongoingCount: number;
  doneCount: number;
  plannedCount: number;
  upcomingCount: number;
  todayAgendas: AgendaRecord[];
  upcomingAgendas: AgendaRecord[];
}

export interface AgendaListResponse {
  items: AgendaRecord[];
  config: AgendaConfig;
  people: AgendaPersonOption[];
  summary: AgendaSummary;
}

export interface AgendaStoreSnapshot {
  config: AgendaConfig;
  items: AgendaRecord[];
}
