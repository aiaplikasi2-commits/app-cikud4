import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Info,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AuthUser } from '../types/auth';
import {
  DEFAULT_AGENDA_CATEGORIES,
  type AgendaConfig,
  type AgendaInputPayload,
  type AgendaPersonOption,
  type AgendaRecord,
  type AgendaStatus,
  type AgendaSummary,
  type AgendaVisibility,
} from '../types/agenda';
import {
  createAgenda,
  deleteAgenda,
  listAgendas,
  updateAgenda,
  updateAgendaConfig,
} from '../lib/agendaApi';
import { AgendaHarianIcon } from './MenuIcons';
import {
  AGENDA_STATUS_META,
  formatAgendaDateLong,
  formatAgendaDateShort,
  formatAgendaTimeRange,
  getCategoryVisual,
  getLocalTodayIso,
  getMonthLabel,
  getWeekBoundsFromDate,
  shiftIsoDate,
  shiftYearMonth,
} from './agendaStyles';

export type AgendaViewMode =
  | 'HARI_INI'
  | 'PER_TANGGAL'
  | 'MINGGUAN'
  | 'BULANAN'
  | 'SEMUA';

interface AgendaHarianPageProps {
  user: AuthUser;
  schoolName: string;
  initialOpenCreate?: boolean;
  onConsumedInitialCreate?: () => void;
  onBack: () => void;
}

const WEEKDAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const REMINDER_PREF_KEY = 'agenda_harian_reminders_enabled';

interface CalendarDayCell {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

function buildCalendarCells(yearMonth: string): CalendarDayCell[] {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  const today = getLocalTodayIso();
  const y = match ? Number.parseInt(match[1], 10) : Number(today.slice(0, 4));
  const m = match ? Number.parseInt(match[2], 10) - 1 : Number(today.slice(5, 7)) - 1;

  const firstDay = new Date(Date.UTC(y, m, 1));
  const firstDow = firstDay.getUTCDay(); // 0=Sun..6=Sat
  const leadingOffset = firstDow === 0 ? 6 : firstDow - 1; // Monday start
  const startGrid = new Date(firstDay.getTime() - leadingOffset * 86_400_000);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(startGrid.getTime() + i * 86_400_000);
    const isoDate = cur.toISOString().slice(0, 10);
    cells.push({
      isoDate,
      dayNumber: cur.getUTCDate(),
      inCurrentMonth: cur.getUTCMonth() === m,
    });
  }
  return cells;
}

export const AgendaHarianPage: React.FC<AgendaHarianPageProps> = ({
  user,
  schoolName,
  initialOpenCreate = false,
  onConsumedInitialCreate,
  onBack,
}) => {
  const isOperator = user.role === 'OPERATOR';
  const todayIso = useMemo(() => getLocalTodayIso(), []);

  // Server data states
  const [items, setItems] = useState<AgendaRecord[]>([]);
  const [config, setConfig] = useState<AgendaConfig>({
    categories: [...DEFAULT_AGENDA_CATEGORIES],
    allowGuruCreate: true,
    allowOperatorViewGuruPersonal: true,
    updatedAt: null,
  });
  const [people, setPeople] = useState<AgendaPersonOption[]>([]);
  const [summary, setSummary] = useState<AgendaSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // View & Filters
  const [viewMode, setViewMode] = useState<AgendaViewMode>('HARI_INI');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [calendarMonth, setCalendarMonth] = useState<string>(
    todayIso.slice(0, 7)
  );
  const [weekAnchorDate, setWeekAnchorDate] = useState<string>(todayIso);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | AgendaStatus>('');
  const [filterPic, setFilterPic] = useState('');

  // Reminders toggle
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(REMINDER_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Add/Edit Modal State
  const [formOpen, setFormOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<AgendaRecord | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(todayIso);
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formCategory, setFormCategory] = useState(
    DEFAULT_AGENDA_CATEGORIES[0]
  );
  const [formPicMode, setFormPicMode] = useState<'LIST' | 'MANUAL'>('LIST');
  const [formPicId, setFormPicId] = useState('');
  const [formPicManual, setFormPicManual] = useState('');
  const [formParticipantIds, setFormParticipantIds] = useState<string[]>([]);
  const [formParticipantFilter, setFormParticipantFilter] = useState('');
  const [formExtraParticipants, setFormExtraParticipants] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<AgendaStatus>('DIRENCANAKAN');
  const [formVisibility, setFormVisibility] =
    useState<AgendaVisibility>('SCHOOL');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Detail & Delete Modals
  const [detailAgenda, setDetailAgenda] = useState<AgendaRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Operator Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cfgCategories, setCfgCategories] = useState<string[]>([]);
  const [cfgNewCategory, setCfgNewCategory] = useState('');
  const [cfgAllowGuruCreate, setCfgAllowGuruCreate] = useState(true);
  const [cfgAllowOpViewPersonal, setCfgAllowOpViewPersonal] = useState(true);
  const [cfgSubmitting, setCfgSubmitting] = useState(false);
  const [cfgError, setCfgError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await listAgendas();
      setItems(res.items);
      setConfig(res.config);
      setPeople(res.people);
      setSummary(res.summary);
    } catch (err) {
      setPageError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data Agenda Harian dari server.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canGuruCreate = isOperator || config.allowGuruCreate;

  const canModifyRecord = useCallback(
    (item: AgendaRecord): boolean => {
      if (isOperator) return true;
      return config.allowGuruCreate && item.createdByUserId === user.id;
    },
    [isOperator, config.allowGuruCreate, user.id]
  );

  const openCreateModal = useCallback(
    (prefillDate?: string) => {
      if (!canGuruCreate) return;
      setEditingAgenda(null);
      setFormTitle('');
      setFormDate(prefillDate || selectedDate || todayIso);
      setFormStartTime('');
      setFormEndTime('');
      setFormCategory(
        config.categories[0] || DEFAULT_AGENDA_CATEGORIES[0]
      );

      const defaultTeacher = user.teacherRecordId
        ? people.find((p) => p.id === user.teacherRecordId)
        : people.find(
            (p) => p.nama.toLowerCase() === user.fullName.toLowerCase()
          );

      if (defaultTeacher) {
        setFormPicMode('LIST');
        setFormPicId(defaultTeacher.id);
        setFormPicManual('');
      } else if (people.length > 0 && isOperator) {
        setFormPicMode('LIST');
        setFormPicId(people[0].id);
        setFormPicManual('');
      } else {
        setFormPicMode('MANUAL');
        setFormPicId('');
        setFormPicManual(user.fullName);
      }

      setFormParticipantIds([]);
      setFormParticipantFilter('');
      setFormExtraParticipants('');
      setFormLocation('');
      setFormDescription('');
      setFormNotes('');
      setFormStatus('DIRENCANAKAN');
      setFormVisibility('SCHOOL');
      setFormError(null);
      setFormOpen(true);
    },
    [
      canGuruCreate,
      selectedDate,
      todayIso,
      config.categories,
      user.teacherRecordId,
      user.fullName,
      people,
      isOperator,
    ]
  );

  useEffect(() => {
    if (initialOpenCreate && !loading) {
      if (canGuruCreate) {
        openCreateModal(todayIso);
      }
      onConsumedInitialCreate?.();
    }
  }, [
    initialOpenCreate,
    loading,
    canGuruCreate,
    openCreateModal,
    todayIso,
    onConsumedInitialCreate,
  ]);

  const openEditModal = (item: AgendaRecord) => {
    setEditingAgenda(item);
    setFormTitle(item.title);
    setFormDate(item.date);
    setFormStartTime(item.startTime || '');
    setFormEndTime(item.endTime || '');
    setFormCategory(item.category);

    if (item.picId && people.some((p) => p.id === item.picId)) {
      setFormPicMode('LIST');
      setFormPicId(item.picId);
      setFormPicManual('');
    } else {
      setFormPicMode('MANUAL');
      setFormPicId('');
      setFormPicManual(item.picName || '');
    }

    setFormParticipantIds(item.participantIds || []);
    setFormParticipantFilter('');
    setFormExtraParticipants(item.extraParticipants || '');
    setFormLocation(item.location || '');
    setFormDescription(item.description || '');
    setFormNotes(item.notes || '');
    setFormStatus(item.status);
    setFormVisibility(item.visibility || 'SCHOOL');
    setFormError(null);
    setFormOpen(true);
  };

  const handleToggleParticipant = (personId: string) => {
    setFormParticipantIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSubmitting) return;

    const trimmedTitle = formTitle.trim();
    if (trimmedTitle.length < 2) {
      setFormError('Judul kegiatan wajib diisi minimal 2 karakter.');
      return;
    }
    if (!formDate) {
      setFormError('Tanggal kegiatan wajib diisi.');
      return;
    }
    if (formStartTime && formEndTime && formEndTime < formStartTime) {
      setFormError('Waktu selesai tidak boleh lebih awal dari waktu mulai.');
      return;
    }

    const selectedPerson =
      formPicMode === 'LIST'
        ? people.find((p) => p.id === formPicId) || null
        : null;
    const effectivePicName = selectedPerson
      ? selectedPerson.nama
      : formPicManual.trim() || user.fullName;

    const payload: AgendaInputPayload = {
      title: trimmedTitle,
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      category: formCategory || 'Kegiatan lainnya',
      picId: selectedPerson ? selectedPerson.id : null,
      picName: effectivePicName,
      participantIds: formParticipantIds,
      extraParticipants: formExtraParticipants.trim(),
      location: formLocation.trim(),
      description: formDescription.trim(),
      notes: formNotes.trim(),
      status: formStatus,
      visibility: formVisibility,
    };

    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingAgenda) {
        await updateAgenda(editingAgenda.id, payload);
        setSuccessMsg(`Agenda "${trimmedTitle}" berhasil diperbarui.`);
      } else {
        await createAgenda(payload);
        setSuccessMsg(`Agenda "${trimmedTitle}" berhasil ditambahkan.`);
      }
      setFormOpen(false);
      setEditingAgenda(null);
      await loadData();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan agenda kegiatan.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (
    item: AgendaRecord,
    nextStatus: AgendaStatus
  ) => {
    if (!canModifyRecord(item) || item.status === nextStatus) return;
    try {
      await updateAgenda(item.id, {
        title: item.title,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        category: item.category,
        picId: item.picId,
        picName: item.picName,
        participantIds: item.participantIds,
        extraParticipants: item.extraParticipants,
        location: item.location,
        description: item.description,
        notes: item.notes,
        status: nextStatus,
        visibility: item.visibility,
      });
      setSuccessMsg(
        `Status "${item.title}" diubah menjadi ${AGENDA_STATUS_META[nextStatus].label}.`
      );
      await loadData();
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : 'Gagal mengubah status kegiatan.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteAgenda(deleteTarget.id);
      setSuccessMsg(`Agenda "${deleteTarget.title}" berhasil dihapus permanen.`);
      if (detailAgenda?.id === deleteTarget.id) {
        setDetailAgenda(null);
      }
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Gagal menghapus agenda kegiatan.'
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openOperatorSettings = () => {
    setCfgCategories([...config.categories]);
    setCfgNewCategory('');
    setCfgAllowGuruCreate(config.allowGuruCreate);
    setCfgAllowOpViewPersonal(config.allowOperatorViewGuruPersonal);
    setCfgError(null);
    setSettingsOpen(true);
  };

  const handleAddCategoryToDraft = () => {
    const clean = cfgNewCategory.trim();
    if (!clean) return;
    if (cfgCategories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setCfgError(`Kategori "${clean}" sudah ada.`);
      return;
    }
    setCfgError(null);
    setCfgCategories((prev) => [...prev, clean]);
    setCfgNewCategory('');
  };

  const handleSaveOperatorSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cfgSubmitting) return;
    if (cfgCategories.length === 0) {
      setCfgError('Minimal harus ada 1 kategori kegiatan.');
      return;
    }
    setCfgSubmitting(true);
    setCfgError(null);
    try {
      const updated = await updateAgendaConfig({
        categories: cfgCategories,
        allowGuruCreate: cfgAllowGuruCreate,
        allowOperatorViewGuruPersonal: cfgAllowOpViewPersonal,
      });
      setConfig(updated);
      setSettingsOpen(false);
      setSuccessMsg('Pengaturan kategori & hak akses Agenda Harian disimpan.');
      await loadData();
    } catch (err) {
      setCfgError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan pengaturan Agenda Harian.'
      );
    } finally {
      setCfgSubmitting(false);
    }
  };

  const toggleReminders = () => {
    setRemindersEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(REMINDER_PREF_KEY, String(next));
      } catch {
        // Ignore storage restriction
      }
      return next;
    });
  };

  // Agendas grouped by date for calendar dots
  const agendasByDate = useMemo(() => {
    const map = new Map<string, AgendaRecord[]>();
    for (const item of items) {
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [items]);

  const calendarCells = useMemo(
    () => buildCalendarCells(calendarMonth),
    [calendarMonth]
  );

  const weekBounds = useMemo(
    () => getWeekBoundsFromDate(weekAnchorDate),
    [weekAnchorDate]
  );

  // All distinct category & PIC options for filters
  const categoryFilterOptions = useMemo(() => {
    const set = new Set<string>(config.categories);
    for (const item of items) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set);
  }, [config.categories, items]);

  const picFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (p.nama) set.add(p.nama);
    }
    for (const item of items) {
      if (item.picName) set.add(item.picName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [people, items]);

  // Apply Search + Dropdown Filters + View Mode
  const filteredAgendas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (viewMode === 'HARI_INI' && item.date !== todayIso) return false;
      if (viewMode === 'PER_TANGGAL' && item.date !== selectedDate) return false;
      if (
        viewMode === 'MINGGUAN' &&
        (item.date < weekBounds.start || item.date > weekBounds.end)
      ) {
        return false;
      }
      if (viewMode === 'BULANAN' && !item.date.startsWith(calendarMonth)) {
        return false;
      }

      if (filterCategory && item.category !== filterCategory) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterPic && item.picName !== filterPic) return false;
      if (q) {
        const hay = [
          item.title,
          item.category,
          item.picName,
          item.location,
          item.description,
          item.notes,
          item.extraParticipants,
          ...(item.participantNames || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    items,
    viewMode,
    todayIso,
    selectedDate,
    weekBounds.start,
    weekBounds.end,
    calendarMonth,
    filterCategory,
    filterStatus,
    filterPic,
    searchQuery,
  ]);

  const hasActiveAttributeFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(filterCategory) ||
    Boolean(filterStatus) ||
    Boolean(filterPic);

  const activeTodayAlerts = (summary?.todayAgendas || []).filter(
    (item) => item.status === 'BERLANGSUNG' || item.status === 'DIRENCANAKAN'
  );

  const selectedDateAgendas = useMemo(
    () => agendasByDate.get(selectedDate) || [],
    [agendasByDate, selectedDate]
  );

  const filteredModalPeople = useMemo(() => {
    const q = formParticipantFilter.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        p.jenisPtk.toLowerCase().includes(q) ||
        p.nip.toLowerCase().includes(q)
    );
  }, [people, formParticipantFilter]);

  const selectCalendarDate = (isoDate: string) => {
    setSelectedDate(isoDate);
    if (isoDate.slice(0, 7) !== calendarMonth) {
      setCalendarMonth(isoDate.slice(0, 7));
    }
    setViewMode('PER_TANGGAL');
  };

  const viewModeTabs: Array<{ id: AgendaViewMode; label: string }> = [
    { id: 'HARI_INI', label: 'Hari Ini' },
    { id: 'PER_TANGGAL', label: 'Per Tanggal' },
    { id: 'MINGGUAN', label: 'Mingguan' },
    { id: 'BULANAN', label: 'Bulanan' },
    { id: 'SEMUA', label: 'Semua Agenda' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pt-3 sm:pt-5 pb-10">
      {/* Sticky/Clean Top Bar */}
      <header className="rounded-2xl bg-white/95 backdrop-blur-md border border-white/90 shadow-[0_6px_24px_rgba(15,35,66,0.06)] p-3.5 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali ke Beranda"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <AgendaHarianIcon className="w-11 h-11 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#17325C] tracking-tight truncate">
                Agenda Harian Sekolah
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                {schoolName || 'SDN CIKETINGUDIK 4'} · Pencatatan, Jadwal &amp;
                Arsip Kegiatan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleReminders}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[42px] ${
                remindersEnabled
                  ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {remindersEnabled ? (
                <Bell className="w-4 h-4 text-teal-700" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-500" />
              )}
              <span className="hidden sm:inline">
                {remindersEnabled ? 'Pengingat Aktif' : 'Pengingat Mati'}
              </span>
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              aria-label="Muat ulang agenda"
              className="inline-flex items-center justify-center w-11 h-[42px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>

            {isOperator && (
              <button
                type="button"
                onClick={openOperatorSettings}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-3 py-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[42px]"
              >
                <Settings2 className="w-4 h-4 text-slate-600" />
                <span>Pengaturan</span>
              </button>
            )}

            {canGuruCreate && (
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-teal-500 to-teal-700 hover:brightness-105 text-white px-4 py-2 text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Agenda</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-slate-600">
              Agenda Hari Ini
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-[#17325C] tabular-nums">
              {summary?.todayCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/75 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-amber-800">
              Sedang Berlangsung
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-amber-900 tabular-nums">
              {summary?.ongoingCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/75 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-sky-800">
              Agenda Mendatang
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-sky-900 tabular-nums">
              {summary?.upcomingCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/75 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-emerald-800">
              Selesai Hari Ini
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-emerald-900 tabular-nums">
              {summary?.doneCount ?? 0}
            </p>
          </div>
        </div>
      </header>

      {/* Guru Permission Notice when Guru creation disabled */}
      {!isOperator && !config.allowGuruCreate && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs sm:text-sm text-sky-900">
          <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
          <span>
            Mode lihat aktif. Penambahan agenda baru oleh Guru sedang ditutup
            oleh Operator; Anda tetap dapat memantau seluruh agenda sekolah dan
            jadwal terkait Anda.
          </span>
        </div>
      )}

      {/* In-App Reminder Banner */}
      {remindersEnabled && activeTodayAlerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-950 shadow-xs">
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Pengingat Agenda Hari Ini: </span>
              <span>
                {activeTodayAlerts
                  .slice(0, 2)
                  .map(
                    (a) =>
                      `${a.title}${a.startTime ? ` (${a.startTime} WIB)` : ''}`
                  )
                  .join(' · ')}
                {activeTodayAlerts.length > 2
                  ? ` (+${activeTodayAlerts.length - 2} kegiatan lainnya)`
                  : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('HARI_INI')}
            className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer whitespace-nowrap"
          >
            Fokus Hari Ini
          </button>
        </div>
      )}

      {/* Success & Error Feedback */}
      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm text-emerald-900 font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            aria-label="Tutup pesan sukses"
            className="p-1 text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pageError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-800 font-medium"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{pageError}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="text-xs font-bold underline hover:text-rose-950 cursor-pointer whitespace-nowrap"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Interactive Monthly Calendar + Selected Day Snapshot */}
      <section
        aria-label="Kalender Agenda"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Left: Monthly Interactive Calendar */}
        <div className="lg:col-span-7 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm sm:text-base font-extrabold text-[#17325C]">
                {getMonthLabel(calendarMonth)}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((prev) => shiftYearMonth(prev, -1))
                }
                aria-label="Bulan sebelumnya"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalendarMonth(todayIso.slice(0, 7));
                  setSelectedDate(todayIso);
                  setWeekAnchorDate(todayIso);
                }}
                className="rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 px-2.5 h-9 text-xs font-bold text-teal-800 cursor-pointer whitespace-nowrap"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((prev) => shiftYearMonth(prev, 1))
                }
                aria-label="Bulan berikutnya"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_HEADERS.map((dayLabel) => (
              <div
                key={dayLabel}
                className="py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const dayAgendas = agendasByDate.get(cell.isoDate) || [];
              const isToday = cell.isoDate === todayIso;
              const isSelected = cell.isoDate === selectedDate;
              const count = dayAgendas.length;

              return (
                <button
                  key={cell.isoDate}
                  type="button"
                  onClick={() => selectCalendarDate(cell.isoDate)}
                  aria-label={`Tanggal ${formatAgendaDateShort(cell.isoDate)}, ${count} agenda`}
                  aria-pressed={isSelected}
                  className={`relative flex flex-col items-center justify-between rounded-xl border p-1.5 min-h-[48px] sm:min-h-[54px] transition-all cursor-pointer ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                      : isToday
                        ? 'border-teal-300 bg-teal-50/80 text-teal-950 font-extrabold'
                        : cell.inCurrentMonth
                          ? 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800'
                          : 'border-transparent bg-slate-50/50 text-slate-400 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-bold tabular-nums leading-none mt-0.5">
                    {cell.dayNumber}
                  </span>

                  {count > 0 ? (
                    <div className="flex items-center gap-0.5 mt-1">
                      {dayAgendas.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: isSelected
                              ? '#FFFFFF'
                              : getCategoryVisual(a.category).dotColor,
                          }}
                        />
                      ))}
                      {count > 3 && (
                        <span
                          className={`text-[9px] font-extrabold leading-none tabular-nums ${
                            isSelected ? 'text-teal-50' : 'text-teal-700'
                          }`}
                        >
                          +{count - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="h-1.5" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Quick Selected Date Panel */}
        <div className="lg:col-span-5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  Agenda Tanggal Terpilih
                </p>
                <h3 className="text-sm sm:text-base font-extrabold text-[#17325C]">
                  {formatAgendaDateLong(selectedDate)}
                </h3>
              </div>
              {canGuruCreate && (
                <button
                  type="button"
                  onClick={() => openCreateModal(selectedDate)}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 px-2.5 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              )}
            </div>

            {selectedDateAgendas.length > 0 ? (
              <div className="space-y-2 max-h-[270px] overflow-y-auto pr-0.5">
                {selectedDateAgendas.map((item) => {
                  const statusMeta = AGENDA_STATUS_META[item.status];
                  const catVisual = getCategoryVisual(item.category);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDetailAgenda(item)}
                      className="w-full text-left rounded-xl border border-slate-200 hover:border-teal-300 bg-slate-50/70 hover:bg-teal-50/40 px-3 py-2.5 transition-colors cursor-pointer space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                          {item.title}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${statusMeta.chipClass}`}
                        >
                          {statusMeta.shortLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatAgendaTimeRange(item.startTime, item.endTime)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: catVisual.dotColor }}
                          />
                          {item.category}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  Tidak ada agenda kegiatan pada tanggal{' '}
                  <strong>{formatAgendaDateShort(selectedDate)}</strong>.
                </p>
                {canGuruCreate && (
                  <button
                    type="button"
                    onClick={() => openCreateModal(selectedDate)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat Agenda di Tanggal Ini</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            Klik tanggal mana saja pada kalender untuk melihat atau menambahkan
            kegiatan pada hari tersebut.
          </p>
        </div>
      </section>

      {/* View Mode Tabs + Search + Filters */}
      <section
        aria-label="Filter dan Tampilan Agenda"
        className="rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-3.5"
      >
        {/* Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            role="tablist"
            aria-label="Mode Tampilan Agenda"
            className="flex flex-wrap items-center gap-1.5"
          >
            {viewModeTabs.map((t) => {
              const active = viewMode === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(t.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[40px] ${
                    active
                      ? 'bg-[#17325C] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Contextual Date / Week / Month Range Controls */}
          {viewMode === 'PER_TANGGAL' && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="agenda-date-filter"
                className="text-xs font-semibold text-slate-600"
              >
                Tanggal:
              </label>
              <input
                id="agenda-date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedDate(val);
                    setCalendarMonth(val.slice(0, 7));
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[38px]"
              />
            </div>
          )}

          {viewMode === 'MINGGUAN' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setWeekAnchorDate((prev) => shiftIsoDate(prev, -7))
                }
                aria-label="Minggu sebelumnya"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">
                {formatAgendaDateShort(weekBounds.start)} –{' '}
                {formatAgendaDateShort(weekBounds.end)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setWeekAnchorDate((prev) => shiftIsoDate(prev, 7))
                }
                aria-label="Minggu berikutnya"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {viewMode === 'BULANAN' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((prev) => shiftYearMonth(prev, -1))
                }
                aria-label="Bulan sebelumnya"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                {getMonthLabel(calendarMonth)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((prev) => shiftYearMonth(prev, 1))
                }
                aria-label="Bulan berikutnya"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Search + Attribute Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kegiatan, lokasi, peserta..."
              aria-label="Cari agenda kegiatan"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[42px]"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filter kategori kegiatan"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[42px]"
            >
              <option value="">Semua Kategori</option>
              {categoryFilterOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as '' | AgendaStatus)
            }
            aria-label="Filter status kegiatan"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[42px]"
          >
            <option value="">Semua Status</option>
            <option value="DIRENCANAKAN">Direncanakan</option>
            <option value="BERLANGSUNG">Sedang berlangsung</option>
            <option value="SELESAI">Selesai</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>

          <select
            value={filterPic}
            onChange={(e) => setFilterPic(e.target.value)}
            aria-label="Filter penanggung jawab"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[42px]"
          >
            <option value="">Semua Penanggung Jawab</option>
            {picFilterOptions.map((picName) => (
              <option key={picName} value={picName}>
                {picName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan{' '}
            <strong className="text-slate-800 tabular-nums">
              {filteredAgendas.length}
            </strong>{' '}
            kegiatan
          </span>
          {hasActiveAttributeFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('');
                setFilterStatus('');
                setFilterPic('');
              }}
              className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </section>

      {/* Agenda Cards List */}
      <section aria-label="Daftar Agenda Harian" className="space-y-3">
        {loading ? (
          <div className="space-y-3 animate-pulse" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-white border border-slate-200"
              />
            ))}
          </div>
        ) : filteredAgendas.length === 0 ? (
          <div className="rounded-2xl bg-white/95 border border-slate-200 p-8 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 mx-auto flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-teal-700" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm sm:text-base font-extrabold text-[#17325C]">
                Belum Ada Agenda pada Tampilan Ini
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                {hasActiveAttributeFilters
                  ? 'Tidak ada agenda yang cocok dengan pencarian atau filter yang dipilih.'
                  : 'Agenda kegiatan sekolah yang dicatat akan tersimpan permanen di sini.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {hasActiveAttributeFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('');
                    setFilterStatus('');
                    setFilterPic('');
                  }}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer min-h-[42px]"
                >
                  Reset Filter
                </button>
              )}
              {canGuruCreate && (
                <button
                  type="button"
                  onClick={() =>
                    openCreateModal(
                      viewMode === 'PER_TANGGAL' ? selectedDate : todayIso
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs font-bold shadow-xs cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Agenda</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredAgendas.map((item) => {
              const statusMeta = AGENDA_STATUS_META[item.status];
              const catVisual = getCategoryVisual(item.category);
              const editable = canModifyRecord(item);
              const allParticipants = [
                ...(item.participantNames || []),
                ...(item.extraParticipants ? [item.extraParticipants] : []),
              ];

              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-white/95 border border-slate-200/90 hover:border-teal-300 shadow-xs p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-colors"
                >
                  <div className="space-y-2.5">
                    {/* Top Category + Status Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold ${catVisual.badgeClass}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: catVisual.dotColor }}
                        />
                        {item.category}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {item.visibility === 'PERSONAL' && (
                          <span className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                            Pribadi
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.chipClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`}
                          />
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setDetailAgenda(item)}
                        className="text-left group cursor-pointer"
                      >
                        <h3 className="text-base font-extrabold text-[#17325C] group-hover:text-teal-700 transition-colors leading-snug">
                          {item.title}
                        </h3>
                      </button>
                      {item.description && (
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Structured Key Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-slate-700">
                      <div className="inline-flex items-center gap-1.5 tabular-nums">
                        <CalendarIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="font-semibold">
                          {formatAgendaDateShort(item.date)}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {formatAgendaTimeRange(item.startTime, item.endTime)}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="truncate">
                          PJ: <strong>{item.picName}</strong>
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">
                          {item.location || 'Lokasi belum ditentukan'}
                        </span>
                      </div>
                    </div>

                    {allParticipants.length > 0 && (
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-600 pt-0.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">
                          Peserta: {allParticipants.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer & Actions */}
                  <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      Oleh {item.createdByName} (
                      {item.createdByRole === 'OPERATOR' ? 'Operator' : 'Guru'})
                    </span>

                    <div className="flex items-center gap-1.5">
                      {editable && item.status !== 'SELESAI' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickStatusChange(
                              item,
                              item.status === 'DIRENCANAKAN'
                                ? 'BERLANGSUNG'
                                : 'SELESAI'
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1.5 text-[11px] font-bold cursor-pointer whitespace-nowrap min-h-[34px]"
                        >
                          <Check className="w-3 h-3" />
                          <span>
                            {item.status === 'DIRENCANAKAN'
                              ? 'Mulai'
                              : 'Selesai'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDetailAgenda(item)}
                        aria-label={`Lihat detail ${item.title}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 text-[11px] font-bold cursor-pointer whitespace-nowrap min-h-[34px]"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Detail</span>
                      </button>

                      {editable && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.title}`}
                            className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-200 text-sky-700 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(item);
                            }}
                            aria-label={`Hapus ${item.title}`}
                            className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* ADD / EDIT AGENDA MODAL                                             */}
      {/* =================================================================== */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-form-title"
        >
          <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
              <h2
                id="agenda-form-title"
                className="text-base sm:text-lg font-extrabold text-[#17325C]"
              >
                {editingAgenda ? 'Edit Agenda Kegiatan' : 'Tambah Agenda Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup form agenda"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitForm}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-800 font-medium"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Judul Kegiatan */}
              <div>
                <label
                  htmlFor="agenda-title"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Judul Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  id="agenda-title"
                  type="text"
                  required
                  maxLength={200}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Rapat Dewan Guru Persiapan PTS"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Tanggal + Jam Mulai + Jam Selesai */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="agenda-date"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Tanggal Kegiatan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="agenda-date"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="agenda-start-time"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Waktu Mulai
                  </label>
                  <input
                    id="agenda-start-time"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="agenda-end-time"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Waktu Selesai
                  </label>
                  <input
                    id="agenda-end-time"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Kategori + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="agenda-category"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Kategori Kegiatan <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="agenda-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from(
                      new Set([
                        ...config.categories,
                        ...(formCategory ? [formCategory] : []),
                      ])
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="agenda-status"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Status Kegiatan
                  </label>
                  <select
                    id="agenda-status"
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as AgendaStatus)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="DIRENCANAKAN">Direncanakan</option>
                    <option value="BERLANGSUNG">Sedang berlangsung</option>
                    <option value="SELESAI">Selesai</option>
                    <option value="DIBATALKAN">Dibatalkan</option>
                  </select>
                </div>
              </div>

              {/* Penanggung Jawab (Integrated with Guru & Tendik) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="agenda-pic"
                    className="text-xs font-bold text-slate-700"
                  >
                    Penanggung Jawab
                  </label>
                  {people.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormPicMode((m) =>
                          m === 'LIST' ? 'MANUAL' : 'LIST'
                        )
                      }
                      className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                    >
                      {formPicMode === 'LIST'
                        ? 'Ketik manual pihak lain'
                        : 'Pilih dari Data Guru & Tendik'}
                    </button>
                  )}
                </div>

                {formPicMode === 'LIST' && people.length > 0 ? (
                  <select
                    id="agenda-pic"
                    value={formPicId}
                    onChange={(e) => setFormPicId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- Pilih Guru / Tendik --</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.nama}
                        {person.jenisPtk ? ` (${person.jenisPtk})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="agenda-pic"
                    type="text"
                    maxLength={150}
                    value={formPicManual}
                    onChange={(e) => setFormPicManual(e.target.value)}
                    placeholder="Nama penanggung jawab kegiatan"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                )}
              </div>

              {/* Lokasi & Visibilitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="agenda-location"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Lokasi Kegiatan
                  </label>
                  <input
                    id="agenda-location"
                    type="text"
                    maxLength={180}
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Contoh: Ruang Guru / Halaman Sekolah"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="agenda-visibility"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Cakupan Tampil Agenda
                  </label>
                  <select
                    id="agenda-visibility"
                    value={formVisibility}
                    onChange={(e) =>
                      setFormVisibility(e.target.value as AgendaVisibility)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="SCHOOL">
                      Agenda Sekolah (Tampil untuk Operator &amp; Guru)
                    </option>
                    <option value="PERSONAL">
                      Agenda Pribadi / Terkait Pihak Tertentu
                    </option>
                  </select>
                </div>
              </div>

              {/* Peserta atau Pihak Terkait */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    Peserta / Pihak Terkait ({formParticipantIds.length}{' '}
                    dipilih)
                  </label>
                  {people.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormParticipantIds(people.map((p) => p.id))
                        }
                        className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormParticipantIds([])}
                        className="text-[11px] font-bold text-slate-600 hover:underline cursor-pointer"
                      >
                        Bersihkan
                      </button>
                    </div>
                  )}
                </div>

                {people.length > 0 && (
                  <>
                    <input
                      type="text"
                      value={formParticipantFilter}
                      onChange={(e) => setFormParticipantFilter(e.target.value)}
                      placeholder="Filter nama guru atau tendik..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-0.5">
                      {filteredModalPeople.map((person) => {
                        const checked = formParticipantIds.includes(person.id);
                        return (
                          <label
                            key={person.id}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'border-teal-300 bg-teal-50 text-teal-950 font-semibold'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleToggleParticipant(person.id)
                              }
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="truncate">{person.nama}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}

                <input
                  type="text"
                  maxLength={300}
                  value={formExtraParticipants}
                  onChange={(e) => setFormExtraParticipants(e.target.value)}
                  placeholder="Pihak terkait lainnya (opsional, misal: Siswa Kelas 6, Komite, Pengawas)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Deskripsi Kegiatan */}
              <div>
                <label
                  htmlFor="agenda-description"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Deskripsi Kegiatan
                </label>
                <textarea
                  id="agenda-description"
                  rows={3}
                  maxLength={1500}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Uraian singkat maksud dan susunan kegiatan..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label
                  htmlFor="agenda-notes"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Catatan Tambahan
                </label>
                <textarea
                  id="agenda-notes"
                  rows={2}
                  maxLength={800}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Perlengkapan yang perlu disiapkan atau tindak lanjut..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={formSubmitting}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm cursor-pointer min-h-[44px]"
                >
                  {formSubmitting
                    ? 'Menyimpan...'
                    : editingAgenda
                      ? 'Simpan Perubahan'
                      : 'Simpan Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* AGENDA DETAIL MODAL                                                 */}
      {/* =================================================================== */}
      {detailAgenda && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-detail-title"
        >
          <div className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
              <div className="space-y-1">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                    getCategoryVisual(detailAgenda.category).badgeClass
                  }`}
                >
                  {detailAgenda.category}
                </span>
                <h2
                  id="agenda-detail-title"
                  className="text-base sm:text-lg font-extrabold text-[#17325C]"
                >
                  {detailAgenda.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailAgenda(null)}
                aria-label="Tutup detail agenda"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    AGENDA_STATUS_META[detailAgenda.status].chipClass
                  }`}
                >
                  {AGENDA_STATUS_META[detailAgenda.status].label}
                </span>
                {detailAgenda.visibility === 'PERSONAL' && (
                  <span className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800">
                    Agenda Pribadi
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">
                    Tanggal Kegiatan
                  </dt>
                  <dd className="font-bold text-slate-900">
                    {formatAgendaDateLong(detailAgenda.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">
                    Waktu
                  </dt>
                  <dd className="font-bold text-slate-900 tabular-nums">
                    {formatAgendaTimeRange(
                      detailAgenda.startTime,
                      detailAgenda.endTime
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">
                    Penanggung Jawab
                  </dt>
                  <dd className="font-bold text-slate-900">
                    {detailAgenda.picName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">
                    Lokasi
                  </dt>
                  <dd className="font-bold text-slate-900">
                    {detailAgenda.location || '-'}
                  </dd>
                </div>
              </dl>

              {(detailAgenda.participantNames.length > 0 ||
                detailAgenda.extraParticipants) && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Peserta / Pihak Terkait
                  </h3>
                  <p className="text-slate-800 leading-relaxed">
                    {[
                      ...detailAgenda.participantNames,
                      ...(detailAgenda.extraParticipants
                        ? [detailAgenda.extraParticipants]
                        : []),
                    ].join(', ')}
                  </p>
                </div>
              )}

              {detailAgenda.description && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Deskripsi Kegiatan
                  </h3>
                  <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                    {detailAgenda.description}
                  </p>
                </div>
              )}

              {detailAgenda.notes && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Catatan Tambahan
                  </h3>
                  <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                    {detailAgenda.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
                <p>
                  Dibuat oleh: <strong>{detailAgenda.createdByName}</strong> (
                  {detailAgenda.createdByRole === 'OPERATOR'
                    ? 'Operator'
                    : 'Guru'}
                  )
                </p>
                {detailAgenda.updatedByName && (
                  <p>Terakhir diperbarui oleh: {detailAgenda.updatedByName}</p>
                )}
              </div>
            </div>

            {canModifyRecord(detailAgenda) && (
              <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = detailAgenda;
                    setDetailAgenda(null);
                    setDeleteError(null);
                    setDeleteTarget(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 text-xs font-bold cursor-pointer min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = detailAgenda;
                    setDetailAgenda(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#17325C] hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold cursor-pointer min-h-[40px]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Agenda</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                           */}
      {/* =================================================================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-delete-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="space-y-1.5">
              <h2
                id="agenda-delete-title"
                className="text-base font-extrabold text-slate-900"
              >
                Hapus Agenda Kegiatan?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Agenda <strong>{deleteTarget.title}</strong> tanggal{' '}
                <strong>{formatAgendaDateShort(deleteTarget.date)}</strong> akan
                dihapus permanen dari server dan database online.
              </p>
            </div>

            {deleteError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-4 py-2 text-xs font-bold cursor-pointer min-h-[40px]"
              >
                {deleteSubmitting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* OPERATOR SETTINGS MODAL (CATEGORIES & GURU ACCESS)                  */}
      {/* =================================================================== */}
      {settingsOpen && isOperator && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-settings-title"
        >
          <div className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
              <h2
                id="agenda-settings-title"
                className="text-base font-extrabold text-[#17325C]"
              >
                Pengaturan Kategori &amp; Hak Akses Agenda
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Tutup pengaturan agenda"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveOperatorSettings}
              className="flex-1 overflow-y-auto p-5 space-y-5"
            >
              {cfgError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {cfgError}
                </div>
              )}

              {/* Access Controls */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  Hak Akses Guru
                </h3>

                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={cfgAllowGuruCreate}
                    onChange={(e) => setCfgAllowGuruCreate(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">
                      Izinkan Guru menambah &amp; mengelola agenda sendiri
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      Guru dapat membuat agenda pribadi/terkait guru, namun
                      tidak dapat mengubah atau menghapus agenda milik Operator
                      maupun pengguna lain.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={cfgAllowOpViewPersonal}
                    onChange={(e) =>
                      setCfgAllowOpViewPersonal(e.target.checked)
                    }
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">
                      Tampilkan agenda pribadi Guru di daftar Operator
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      Memungkinkan Operator memantau seluruh agenda kegiatan
                      yang dibuat oleh Guru.
                    </p>
                  </div>
                </label>
              </div>

              {/* Custom Categories Management */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    Daftar Kategori Kegiatan ({cfgCategories.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setCfgCategories([...DEFAULT_AGENDA_CATEGORIES])
                    }
                    className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                  >
                    Kembalikan Bawaan
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={80}
                    value={cfgNewCategory}
                    onChange={(e) => setCfgNewCategory(e.target.value)}
                    placeholder="Tambah kategori baru..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategoryToDraft}
                    className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Tambah
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {cfgCategories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{cat}</span>
                      {cfgCategories.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCfgCategories((prev) =>
                              prev.filter((c) => c !== cat)
                            )
                          }
                          aria-label={`Hapus kategori ${cat}`}
                          className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  disabled={cfgSubmitting}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cfgSubmitting}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-2 text-xs font-bold cursor-pointer min-h-[40px]"
                >
                  {cfgSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
