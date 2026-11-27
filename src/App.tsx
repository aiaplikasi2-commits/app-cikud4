import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, LogOut, WifiOff } from 'lucide-react';
import { SchoolHeader } from './components/SchoolHeader';
import { AdminAvatarIcon } from './components/MenuIcons';
import {
  MenuGrid,
  MenuItem,
  OPERATOR_MENU_ITEMS,
} from './components/MenuGrid';
import { BottomNav, NavTabId } from './components/BottomNav';
import { SettingsPage } from './components/SettingsPage';
import { LoginPage } from './components/LoginPage';
import { ForcePasswordChangeScreen } from './components/ForcePasswordChangeScreen';
import { TeacherDashboard } from './components/TeacherDashboard';
import { TeacherAccountManagement } from './components/TeacherAccountManagement';
import { TeacherDataPage } from './components/TeacherDataPage';
import { StudentListPage } from './components/StudentListPage';
import { LettersPage } from './components/LettersPage';
import { AttendancePage } from './components/AttendancePage';
import { AgendaHarianPage } from './components/AgendaHarianPage';
import { AgendaDashboardWidget } from './components/AgendaDashboardWidget';
import {
  AppNavigationTarget,
  BottomTabId,
  BottomTabViews,
} from './components/BottomTabViews';
import { EMPTY_SCHOOL_SETTINGS, SchoolSettings } from './types/settings';
import type { AuthUser, PublicSchoolInfo } from './types/auth';
import type { StudentRecord } from './types/student';
import { buildAuthHeaders, fetchAuthStatus, logoutUser } from './lib/authApi';
import { loadSchoolSettings } from './lib/settingsStorage';
import { auth, onAuthStateChanged, type FirebaseUser } from './lib/firebase';
import { runFullCloudSync } from './lib/firestoreSync';
import { PWAPromptBanner } from './components/PWAPromptBanner';

type OperatorView =
  | 'beranda'
  | 'pengaturan'
  | 'manajemen-akun-guru'
  | 'siswa'
  | 'absen-siswa'
  | 'guru'
  | 'tendik'
  | 'surat'
  | 'agenda-harian';
type GuruView = 'beranda' | 'siswa' | 'absen-siswa' | 'guru' | 'agenda-harian';

const EMPTY_PUBLIC_SCHOOL: PublicSchoolInfo = {
  schoolName: '',
  city: '',
  department: '',
  logoUrl: null,
};

function parseOperatorViewFromPath(pathname: string): OperatorView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/pengaturan') return 'pengaturan';
  if (clean === '/manajemen-akun-guru') return 'manajemen-akun-guru';
  if (clean === '/siswa') return 'siswa';
  if (clean === '/absen-siswa') return 'absen-siswa';
  if (clean === '/guru') return 'guru';
  if (clean === '/tendik') return 'tendik';
  if (clean === '/surat') return 'surat';
  if (clean === '/agenda-harian') return 'agenda-harian';
  return 'beranda';
}

function parseGuruViewFromPath(pathname: string): GuruView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/siswa') return 'siswa';
  if (clean === '/absen-siswa') return 'absen-siswa';
  if (clean === '/guru') return 'guru';
  if (clean === '/agenda-harian') return 'agenda-harian';
  return 'beranda';
}

function getPathForOperatorView(view: OperatorView): string {
  if (view === 'pengaturan') return '/pengaturan';
  if (view === 'manajemen-akun-guru') return '/manajemen-akun-guru';
  if (view === 'siswa') return '/siswa';
  if (view === 'absen-siswa') return '/absen-siswa';
  if (view === 'guru') return '/guru';
  if (view === 'tendik') return '/tendik';
  if (view === 'surat') return '/surat';
  if (view === 'agenda-harian') return '/agenda-harian';
  return '/';
}

function isProtectedOperatorPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (
    clean === '/pengaturan' ||
    clean === '/manajemen-akun-guru' ||
    clean === '/tendik' ||
    clean === '/surat'
  );
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [publicSchool, setPublicSchool] =
    useState<PublicSchoolInfo>(EMPTY_PUBLIC_SCHOOL);

  const [operatorView, setOperatorView] = useState<OperatorView>(() =>
    parseOperatorViewFromPath(window.location.pathname)
  );
  const [guruView, setGuruView] = useState<GuruView>(() =>
    parseGuruViewFromPath(window.location.pathname)
  );
  const [activeTab, setActiveTab] = useState<NavTabId>('beranda');
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [accessDeniedNote, setAccessDeniedNote] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const clean = window.location.pathname.replace(/\/+$/, '') || '/';
    if (clean === '/reset-password') {
      return new URLSearchParams(window.location.search).get('token');
    }
    return null;
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [settings, setSettings] = useState<SchoolSettings>(EMPTY_SCHOOL_SETTINGS);
  const [letterPreselectedStudent, setLetterPreselectedStudent] =
    useState<StudentRecord | null>(null);
  const [agendaOpenCreate, setAgendaOpenCreate] = useState(false);
  const [cloudUser, setCloudUser] = useState<FirebaseUser | null>(null);
  const cloudSyncLockRef = useRef(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const navigateUrl = useCallback((path: string, replace = false) => {
    if (window.location.pathname === path) return;
    if (replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
  }, []);

  const refreshAuth = useCallback(async (preserveOnTransientError = false) => {
    try {
      const status = await fetchAuthStatus();
      setNeedsInitialSetup(status.needsInitialSetup);
      setPublicSchool(status.school);
      setCurrentUser(status.user);
      if (status.authenticated && status.user) {
        setLoginNotice(null);
      }
    } catch (err) {
      if (!preserveOnTransientError) {
        setCurrentUser(null);
        setLoginNotice(
          err instanceof Error
            ? err.message
            : 'Tidak dapat terhubung ke server autentikasi.'
        );
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setCloudUser(fbUser && fbUser.emailVerified ? fbUser : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading || !isOnline || !cloudUser || !cloudUser.emailVerified) {
      return;
    }
    if (cloudSyncLockRef.current) return;

    const isOperator = currentUser?.role === 'OPERATOR';
    // Only auto-restore before setup or auto-sync when Operator is logged in
    if (!needsInitialSetup && !isOperator) {
      return;
    }

    cloudSyncLockRef.current = true;
    runFullCloudSync(buildAuthHeaders(), isOperator)
      .then(async (summary) => {
        const restoredSomething =
          summary.restoredFromCloud.accounts > 0 ||
          summary.restoredFromCloud.students > 0 ||
          summary.restoredFromCloud.teachers > 0 ||
          summary.restoredFromCloud.letters > 0 ||
          summary.restoredFromCloud.attendance > 0 ||
          summary.restoredFromCloud.agendas > 0 ||
          summary.restoredFromCloud.settingsUpdated;
        if (restoredSomething) {
          await refreshAuth();
          if (isOperator) {
            const loaded = await loadSchoolSettings();
            setSettings(loaded);
            setPublicSchool({
              schoolName: loaded.identity.schoolName,
              city: loaded.identity.city,
              department: loaded.identity.department,
              logoUrl: loaded.files.logo?.url ?? null,
            });
          }
        }
      })
      .catch((err) => {
        console.error('Sinkronisasi otomatis Database Online gagal:', err);
      })
      .finally(() => {
        cloudSyncLockRef.current = false;
      });
  }, [authLoading, isOnline, cloudUser, currentUser?.role, needsInitialSetup, refreshAuth]);

  // Enforce RBAC and URL consistency on auth state change and browser history navigation
  useEffect(() => {
    if (authLoading) return;

    const applyRouteRules = () => {
      const pathname = window.location.pathname;
      const cleanPath = pathname.replace(/\/+$/, '') || '/';
      if (!currentUser) {
        if (cleanPath === '/reset-password') {
          const tokenFromQuery = new URLSearchParams(window.location.search).get(
            'token'
          );
          setResetToken(tokenFromQuery);
          return;
        }
        setResetToken(null);
        if (cleanPath !== '/login' && cleanPath !== '/') {
          setLoginNotice('Silakan login terlebih dahulu untuk mengakses halaman tersebut.');
        }
        navigateUrl('/login', true);
        return;
      }

      if (currentUser.role === 'GURU') {
        if (isProtectedOperatorPath(pathname)) {
          setAccessDeniedNote(
            'Akses ditolak. Halaman ini hanya dapat diakses oleh Operator.'
          );
          setGuruView('beranda');
          navigateUrl('/', true);
          return;
        }
        if (pathname === '/login') {
          setGuruView('beranda');
          navigateUrl('/', true);
          return;
        }
        setGuruView(parseGuruViewFromPath(pathname));
        return;
      }

      // OPERATOR
      if (pathname === '/login') {
        setOperatorView('beranda');
        navigateUrl('/', true);
      } else {
        setOperatorView(parseOperatorViewFromPath(pathname));
      }
    };

    applyRouteRules();

    const handlePopState = () => {
      applyRouteRules();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authLoading, currentUser, navigateUrl]);

  // Load full settings when authenticated as OPERATOR
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'OPERATOR') {
      setSettings(EMPTY_SCHOOL_SETTINGS);
      return;
    }
    let mounted = true;
    loadSchoolSettings()
      .then((loaded) => {
        if (mounted) {
          setSettings(loaded);
          setPublicSchool({
            schoolName: loaded.identity.schoolName,
            city: loaded.identity.city,
            department: loaded.identity.department,
            logoUrl: loaded.files.logo?.url ?? null,
          });
        }
      })
      .catch(() => {
        // Keep defaults if loading fails
      });
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  const handleSettingsChange = (next: SchoolSettings) => {
    setSettings(next);
    setPublicSchool({
      schoolName: next.identity.schoolName,
      city: next.identity.city,
      department: next.identity.department,
      logoUrl: next.files.logo?.url ?? null,
    });
  };

  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    setNeedsInitialSetup(false);
    setLoginNotice(null);
    setAccessDeniedNote(null);
    setSelectedMenuId(null);
    setActiveTab('beranda');
    setOperatorView('beranda');
    setGuruView('beranda');
    navigateUrl('/', true);
    void refreshAuth(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      setCurrentUser(null);
      setSettings(EMPTY_SCHOOL_SETTINGS);
      setOperatorView('beranda');
      setGuruView('beranda');
      setSelectedMenuId(null);
      setAccessDeniedNote(null);
      setLoginNotice(null);
      setActiveTab('beranda');
      navigateUrl('/login', true);
      setLoggingOut(false);
    }
  };

  const handleNavigateTarget = useCallback(
    (target: AppNavigationTarget) => {
      if (!currentUser) return;
      if (target === 'profil') {
        handleSelectTab('profil');
        return;
      }
      if (
        currentUser.role === 'GURU' &&
        target !== 'siswa' &&
        target !== 'absen-siswa' &&
        target !== 'guru' &&
        target !== 'agenda-harian'
      ) {
        return;
      }
      setActiveTab('beranda');
      setSelectedMenuId(target);
      if (currentUser.role === 'GURU') {
        setGuruView(target as GuruView);
        navigateUrl(`/${target}`);
      } else {
        setOperatorView(target);
        navigateUrl(getPathForOperatorView(target));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser, navigateUrl]
  );

  const handleOpenAgendaFromDashboard = useCallback(
    (openCreate = false) => {
      if (!currentUser) return;
      setAgendaOpenCreate(Boolean(openCreate));
      setActiveTab('beranda');
      setSelectedMenuId('agenda-harian');
      if (currentUser.role === 'GURU') {
        setGuruView('agenda-harian');
        navigateUrl('/agenda-harian');
      } else {
        setOperatorView('agenda-harian');
        navigateUrl('/agenda-harian');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser, navigateUrl]
  );

  const handleSelectOperatorMenu = (menu: MenuItem) => {
    setActiveTab('beranda');
    setSelectedMenuId(menu.id);
    if (
      menu.id === 'pengaturan' ||
      menu.id === 'manajemen-akun-guru' ||
      menu.id === 'siswa' ||
      menu.id === 'absen-siswa' ||
      menu.id === 'guru' ||
      menu.id === 'tendik' ||
      menu.id === 'surat' ||
      menu.id === 'agenda-harian'
    ) {
      if (menu.id === 'agenda-harian') {
        setAgendaOpenCreate(false);
      }
      setOperatorView(menu.id);
      navigateUrl(getPathForOperatorView(menu.id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectGuruMenu = (menu: MenuItem) => {
    setActiveTab('beranda');
    setSelectedMenuId(menu.id);
    if (
      menu.id === 'siswa' ||
      menu.id === 'absen-siswa' ||
      menu.id === 'guru' ||
      menu.id === 'agenda-harian'
    ) {
      if (menu.id === 'agenda-harian') {
        setAgendaOpenCreate(false);
      }
      setGuruView(menu.id);
      navigateUrl(`/${menu.id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectTab = (tab: NavTabId) => {
    setActiveTab(tab);
    setSelectedMenuId(null);
    setOperatorView('beranda');
    setGuruView('beranda');
    navigateUrl('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading) {
    return (
      <>
        <PWAPromptBanner />
        <div className="min-h-dvh bg-[#F4F7FC] flex items-center justify-center p-6">
          <div className="rounded-2xl bg-white border border-slate-200 px-6 py-5 shadow-xs text-center">
            <p className="text-sm font-semibold text-slate-700">
              Memuat Sistem Administrasi Sekolah...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <PWAPromptBanner />
        <LoginPage
          school={publicSchool}
          needsInitialSetup={needsInitialSetup}
          initialNotice={
            !isOnline
              ? 'Koneksi internet atau server terputus. Pastikan perangkat terhubung ke internet untuk login.'
              : loginNotice
          }
          resetToken={resetToken}
          onClearResetToken={() => {
            setResetToken(null);
            navigateUrl('/login', true);
          }}
          onAuthenticated={handleAuthenticated}
          onCloudRestored={() => refreshAuth()}
        />
      </>
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <>
        <PWAPromptBanner />
        <ForcePasswordChangeScreen
          user={currentUser}
          school={publicSchool}
          onPasswordChanged={(updatedUser) => {
            setCurrentUser(updatedUser);
            navigateUrl('/', true);
          }}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </>
    );
  }

  const effectiveHeaderIdentity =
    currentUser.role === 'OPERATOR'
      ? settings.identity
      : {
          schoolName: publicSchool.schoolName,
          city: publicSchool.city,
          department: publicSchool.department,
          academicYear: '',
        };

  const effectiveLogoUrl =
    currentUser.role === 'OPERATOR'
      ? settings.files.logo?.url ?? publicSchool.logoUrl
      : publicSchool.logoUrl;

  const activeViewKey =
    currentUser.role === 'GURU'
      ? guruView === 'beranda'
        ? `guru-tab-${activeTab}`
        : `guru-${guruView}`
      : operatorView === 'beranda'
      ? `op-tab-${activeTab}`
      : `op-${operatorView}`;

  return (
    <div className="min-h-dvh app-ambient-bg text-slate-900 flex flex-col print:bg-white relative overflow-x-hidden">
      <main className="print-container-reset relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 sm:pb-28">
        {!isOnline && (
          <div
            role="alert"
            className="print-hidden mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs sm:text-sm text-amber-900 font-medium shadow-xs"
          >
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Koneksi internet atau server terputus. Perubahan belum tersinkronisasi
              ke server.
            </span>
          </div>
        )}
        <div key={activeViewKey} className="page-enter">
        {currentUser.role === 'GURU' ? (
          guruView === 'siswa' ? (
            <StudentListPage
              userRole="GURU"
              assignedClass={currentUser.assignedClass || ''}
              onOpenProfil={() => handleSelectTab('profil')}
              onBack={() => {
                setGuruView('beranda');
                setActiveTab('beranda');
                setSelectedMenuId(null);
                navigateUrl('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : guruView === 'absen-siswa' ? (
            <AttendancePage
              userRole="GURU"
              assignedClass={currentUser.assignedClass || ''}
              onOpenProfil={() => handleSelectTab('profil')}
              onBack={() => {
                setGuruView('beranda');
                setActiveTab('beranda');
                setSelectedMenuId(null);
                navigateUrl('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : guruView === 'guru' ? (
            <TeacherDataPage
              userRole="GURU"
              onBack={() => {
                setGuruView('beranda');
                setActiveTab('beranda');
                setSelectedMenuId(null);
                navigateUrl('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : guruView === 'agenda-harian' ? (
            <AgendaHarianPage
              user={currentUser}
              schoolName={publicSchool.schoolName}
              initialOpenCreate={agendaOpenCreate}
              onConsumedInitialCreate={() => setAgendaOpenCreate(false)}
              onBack={() => {
                setAgendaOpenCreate(false);
                setGuruView('beranda');
                setActiveTab('beranda');
                setSelectedMenuId(null);
                navigateUrl('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : activeTab !== 'beranda' ? (
            <BottomTabViews
              tab={activeTab as BottomTabId}
              user={currentUser}
              school={publicSchool}
              settings={settings}
              onBackHome={() => handleSelectTab('beranda')}
              onNavigate={handleNavigateTarget}
              onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
              onPasswordChanged={(updatedUser) => setCurrentUser(updatedUser)}
              onLogout={handleLogout}
              loggingOut={loggingOut}
            />
          ) : (
            <div className="space-y-4">
              {accessDeniedNote && (
                <div
                  role="alert"
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700 font-medium shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{accessDeniedNote}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccessDeniedNote(null)}
                    className="shrink-0 font-bold text-rose-700 hover:text-rose-900 px-2 py-1 rounded-lg hover:bg-rose-100 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              )}

              <TeacherDashboard
                user={currentUser}
                school={publicSchool}
                selectedMenuId={selectedMenuId}
                onSelectMenu={handleSelectGuruMenu}
                onOpenAgenda={handleOpenAgendaFromDashboard}
                onOpenProfil={() => handleSelectTab('profil')}
                onLogout={handleLogout}
                loggingOut={loggingOut}
              />
            </div>
          )
        ) : operatorView === 'pengaturan' ? (
          <SettingsPage
            settings={settings}
            cloudUser={cloudUser}
            onSettingsChange={handleSettingsChange}
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'manajemen-akun-guru' ? (
          <TeacherAccountManagement
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'siswa' ? (
          <StudentListPage
            userRole="OPERATOR"
            onCreateLetterForStudent={(student) => {
              setLetterPreselectedStudent(student);
              setSelectedMenuId('surat');
              setOperatorView('surat');
              navigateUrl('/surat');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'absen-siswa' ? (
          <AttendancePage
            userRole="OPERATOR"
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'guru' ? (
          <TeacherDataPage
            userRole="OPERATOR"
            mode="guru"
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'tendik' ? (
          <TeacherDataPage
            userRole="OPERATOR"
            mode="tendik"
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'surat' ? (
          <LettersPage
            settings={settings}
            initialStudent={letterPreselectedStudent}
            onClearInitialStudent={() => setLetterPreselectedStudent(null)}
            onNavigateSettings={() => {
              setSelectedMenuId('pengaturan');
              setOperatorView('pengaturan');
              navigateUrl('/pengaturan');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateStudents={() => {
              setSelectedMenuId('siswa');
              setOperatorView('siswa');
              navigateUrl('/siswa');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBack={() => {
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : operatorView === 'agenda-harian' ? (
          <AgendaHarianPage
            user={currentUser}
            schoolName={
              settings.identity.schoolName || publicSchool.schoolName
            }
            initialOpenCreate={agendaOpenCreate}
            onConsumedInitialCreate={() => setAgendaOpenCreate(false)}
            onBack={() => {
              setAgendaOpenCreate(false);
              setOperatorView('beranda');
              setActiveTab('beranda');
              setSelectedMenuId(null);
              navigateUrl(getPathForOperatorView('beranda'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : activeTab !== 'beranda' ? (
          <BottomTabViews
            tab={activeTab as BottomTabId}
            user={currentUser}
            school={publicSchool}
            settings={settings}
            onBackHome={() => handleSelectTab('beranda')}
            onNavigate={handleNavigateTarget}
            onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
            onPasswordChanged={(updatedUser) => setCurrentUser(updatedUser)}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {/* Header Identitas Sekolah */}
            <SchoolHeader
              identity={effectiveHeaderIdentity}
              logoUrl={effectiveLogoUrl}
            />

            {/* Bilah Akun Operator & Logout */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/92 backdrop-blur-md border border-white/90 px-3.5 sm:px-4 py-2.5 shadow-[0_6px_24px_rgba(15,35,66,0.06)]">
              <div className="flex items-center gap-3 min-w-0">
                <AdminAvatarIcon className="w-10 h-10 shrink-0" />
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm sm:text-base font-extrabold text-[#17325C] truncate">
                    {currentUser.fullName}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-sky-50 border border-sky-200/80 px-2 py-0.5 text-[11px] font-bold text-[#1D63D8] shrink-0">
                    Operator
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#FF5B4D] to-[#DC3026] hover:brightness-105 disabled:opacity-60 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_14px_rgba(220,48,38,0.28)] active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                {loggingOut ? 'Keluar...' : 'Logout'}
              </button>
            </div>

            {/* Menu Utama Operator */}
            <MenuGrid
              items={OPERATOR_MENU_ITEMS}
              selectedMenuId={selectedMenuId}
              onSelectMenu={handleSelectOperatorMenu}
            />

            {/* Ringkasan Agenda Harian Operator */}
            <AgendaDashboardWidget
              userRole="OPERATOR"
              onOpenAgenda={handleOpenAgendaFromDashboard}
            />
          </div>
        )}
        </div>
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
      <PWAPromptBanner />
    </div>
  );
}
