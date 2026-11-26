import type { AuthUser, ClassOptionItem, TeacherAccount } from '../src/types/auth.ts';
import type { ClassHomeroomAssignment } from '../src/types/attendance.ts';
import type { TeacherRecord } from '../src/types/teacher.ts';
import type { createAttendanceStore } from './attendanceStore.ts';
import type { createAuthStore } from './authStore.ts';
import type { createStudentStore } from './studentStore.ts';
import type { createTeacherStore } from './teacherStore.ts';

export class ClassAssignmentError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function normalizeClassKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

interface PersonIdentity {
  teacherId: string | null;
  accountId: string | null;
  nip: string;
  name: string;
}

export interface ClassClaimant extends PersonIdentity {
  className: string;
}

export function createClassAssignmentService(deps: {
  authStore: ReturnType<typeof createAuthStore>;
  teacherStore: ReturnType<typeof createTeacherStore>;
  attendanceStore: ReturnType<typeof createAttendanceStore>;
  studentStore: ReturnType<typeof createStudentStore>;
}) {
  const { authStore, teacherStore, attendanceStore, studentStore } = deps;

  function resolveCanonicalClassName(rawClass: string): string {
    const cleaned = cleanText(rawClass);
    if (!cleaned) return '';
    if (cleaned.length > 80) {
      throw new ClassAssignmentError(400, 'Nama kelas maksimal 80 karakter.');
    }
    const targetKey = normalizeClassKey(cleaned);
    const students = studentStore.getAllRaw();
    for (const s of students) {
      const candidate = cleanText(s.rombelSaatIni);
      if (candidate && normalizeClassKey(candidate) === targetKey) {
        return candidate;
      }
    }
    return cleaned;
  }

  function findTeacherForAccount(
    account: { id: string; teacherRecordId?: string | null; nip?: string },
    teachers: TeacherRecord[]
  ): TeacherRecord | null {
    if (account.teacherRecordId) {
      const byRef = teachers.find((t) => t.id === account.teacherRecordId);
      if (byRef) return byRef;
    }
    const byLinked = teachers.find((t) => t.linkedAccountId === account.id);
    if (byLinked) return byLinked;
    const nip = cleanText(account.nip);
    if (nip) {
      const byNip = teachers.find((t) => cleanText(t.nip) === nip);
      if (byNip) return byNip;
    }
    return null;
  }

  function findAccountForTeacher(
    teacher: { id: string; linkedAccountId?: string | null; nip?: string },
    accounts: TeacherAccount[]
  ): TeacherAccount | null {
    if (teacher.linkedAccountId) {
      const byRef = accounts.find((a) => a.id === teacher.linkedAccountId);
      if (byRef) return byRef;
    }
    const byRec = accounts.find((a) => a.teacherRecordId === teacher.id);
    if (byRec) return byRec;
    const nip = cleanText(teacher.nip);
    if (nip) {
      const byNip = accounts.find((a) => cleanText(a.nip) === nip);
      if (byNip) return byNip;
    }
    return null;
  }

  function isSamePerson(
    a: Partial<PersonIdentity>,
    b: Partial<PersonIdentity>,
    teachers: TeacherRecord[],
    accounts: TeacherAccount[]
  ): boolean {
    if (a.teacherId && b.teacherId && a.teacherId === b.teacherId) return true;
    if (a.accountId && b.accountId && a.accountId === b.accountId) return true;
    const aNip = cleanText(a.nip);
    const bNip = cleanText(b.nip);
    if (aNip && bNip && aNip === bNip) return true;

    if (a.teacherId && b.accountId) {
      const teacher = teachers.find((t) => t.id === a.teacherId);
      const account = accounts.find((acc) => acc.id === b.accountId);
      if (
        (teacher && teacher.linkedAccountId === b.accountId) ||
        (account && account.teacherRecordId === a.teacherId)
      ) {
        return true;
      }
    }
    if (a.accountId && b.teacherId) {
      const teacher = teachers.find((t) => t.id === b.teacherId);
      const account = accounts.find((acc) => acc.id === a.accountId);
      if (
        (teacher && teacher.linkedAccountId === a.accountId) ||
        (account && account.teacherRecordId === b.teacherId)
      ) {
        return true;
      }
    }
    return false;
  }

  function collectAllClaimants(
    teachers: TeacherRecord[],
    accounts: TeacherAccount[]
  ): ClassClaimant[] {
    const claimants: ClassClaimant[] = [];
    const { homerooms } = attendanceStore.getAllRaw();

    for (const acc of accounts) {
      const rawClass = cleanText(acc.assignedClass);
      if (!rawClass) continue;
      const linkedTeacher = findTeacherForAccount(acc, teachers);
      claimants.push({
        className: rawClass,
        teacherId: linkedTeacher?.id ?? acc.teacherRecordId ?? null,
        accountId: acc.id,
        nip: cleanText(acc.nip) || cleanText(linkedTeacher?.nip),
        name: cleanText(acc.fullName) || cleanText(linkedTeacher?.nama) || acc.username,
      });
    }

    for (const teacher of teachers) {
      const rawClass = cleanText(teacher.assignedClass);
      if (!rawClass) continue;
      const linkedAccount = findAccountForTeacher(teacher, accounts);
      claimants.push({
        className: rawClass,
        teacherId: teacher.id,
        accountId: linkedAccount?.id ?? teacher.linkedAccountId ?? null,
        nip: cleanText(teacher.nip) || cleanText(linkedAccount?.nip),
        name: cleanText(teacher.nama) || cleanText(linkedAccount?.fullName),
      });
    }

    for (const [rombelKey, hm] of Object.entries(homerooms || {})) {
      const className = cleanText(hm?.rombel || rombelKey);
      const hmName = cleanText(hm?.teacherName);
      const hmTeacherId =
        typeof hm?.teacherId === 'string' && hm.teacherId.trim()
          ? hm.teacherId.trim()
          : null;
      if (!className || (!hmTeacherId && !hmName)) continue;

      const matchedTeacher = hmTeacherId
        ? teachers.find((t) => t.id === hmTeacherId) || null
        : null;
      const matchedAccount = matchedTeacher
        ? findAccountForTeacher(matchedTeacher, accounts)
        : hmTeacherId
          ? accounts.find((a) => a.id === hmTeacherId) || null
          : null;

      claimants.push({
        className,
        teacherId: matchedTeacher?.id ?? hmTeacherId,
        accountId: matchedAccount?.id ?? matchedTeacher?.linkedAccountId ?? null,
        nip: cleanText(hm?.teacherNip) || cleanText(matchedTeacher?.nip) || cleanText(matchedAccount?.nip),
        name: hmName || cleanText(matchedTeacher?.nama) || cleanText(matchedAccount?.fullName),
      });
    }

    return claimants;
  }

  function getEffectiveAssignedClassForAccount(
    user: {
      id: string;
      role: string;
      fullName?: string;
      nip?: string;
      teacherRecordId?: string | null;
      assignedClass?: string;
    },
    teachersOverride?: TeacherRecord[]
  ): string {
    if (user.role !== 'GURU') return '';
    const direct = cleanText(user.assignedClass);
    if (direct) return resolveCanonicalClassNameSafe(direct);

    const teachers = teachersOverride ?? teacherStore.getAllRaw();
    const linkedTeacher = findTeacherForAccount(user, teachers);
    const fromTeacher = cleanText(linkedTeacher?.assignedClass);
    if (fromTeacher) return resolveCanonicalClassNameSafe(fromTeacher);

    const { homerooms } = attendanceStore.getAllRaw();
    const userNameKey = cleanText(user.fullName).toLowerCase();
    for (const [rombelKey, hm] of Object.entries(homerooms || {})) {
      const hmClass = cleanText(hm?.rombel || rombelKey);
      if (!hmClass) continue;
      if (
        (linkedTeacher && hm?.teacherId === linkedTeacher.id) ||
        hm?.teacherId === user.id ||
        (!hm?.teacherId && userNameKey && cleanText(hm?.teacherName).toLowerCase() === userNameKey)
      ) {
        return resolveCanonicalClassNameSafe(hmClass);
      }
    }
    return '';
  }

  function resolveCanonicalClassNameSafe(raw: string): string {
    const cleaned = cleanText(raw);
    if (!cleaned) return '';
    const targetKey = normalizeClassKey(cleaned);
    const students = studentStore.getAllRaw();
    for (const s of students) {
      const candidate = cleanText(s.rombelSaatIni);
      if (candidate && normalizeClassKey(candidate) === targetKey) {
        return candidate;
      }
    }
    return cleaned;
  }

  function enrichAuthUser(user: AuthUser): AuthUser {
    if (user.role !== 'GURU') {
      return { ...user, assignedClass: '' };
    }
    return {
      ...user,
      assignedClass: getEffectiveAssignedClassForAccount(user),
    };
  }

  function enrichTeacherAccountList(accounts: TeacherAccount[]): TeacherAccount[] {
    const teachers = teacherStore.getAllRaw();
    return accounts.map((acc) => ({
      ...acc,
      assignedClass: getEffectiveAssignedClassForAccount(acc, teachers),
    }));
  }

  function findConflictingClaimant(params: {
    className: string;
    actor: Partial<PersonIdentity>;
  }): ClassClaimant | null {
    const targetKey = normalizeClassKey(params.className);
    if (!targetKey) return null;
    const teachers = teacherStore.getAllRaw();
    const accounts = authStore.listTeacherAccounts();
    const claimants = collectAllClaimants(teachers, accounts);

    for (const claimant of claimants) {
      if (normalizeClassKey(claimant.className) !== targetKey) continue;
      if (isSamePerson(claimant, params.actor, teachers, accounts)) continue;
      // When comparing two manual homeroom names without teacherId/accountId
      if (
        !claimant.teacherId &&
        !claimant.accountId &&
        !params.actor.teacherId &&
        !params.actor.accountId &&
        params.actor.name &&
        claimant.name.toLowerCase() === cleanText(params.actor.name).toLowerCase()
      ) {
        continue;
      }
      return claimant;
    }
    return null;
  }

  function assertClassClaimAvailable(params: {
    nextClassRaw: string;
    actorTeacherId?: string | null;
    actorAccountId?: string | null;
    actorNip?: string;
    actorName?: string;
  }): void {
    const cleaned = cleanText(params.nextClassRaw);
    if (!cleaned) return;
    if (cleaned.length > 80) {
      throw new ClassAssignmentError(400, 'Nama kelas maksimal 80 karakter.');
    }
    const conflict = findConflictingClaimant({
      className: cleaned,
      actor: {
        teacherId: params.actorTeacherId ?? null,
        accountId: params.actorAccountId ?? null,
        nip: params.actorNip ?? '',
        name: params.actorName ?? '',
      },
    });
    if (conflict) {
      const holderLabel = conflict.name || 'guru lain';
      throw new ClassAssignmentError(
        409,
        `Kelas "${cleaned}" sudah dipegang oleh ${holderLabel}. 1 kelas hanya dapat dipegang oleh 1 guru.`
      );
    }
  }

  function listClassOptions(currentUser: AuthUser): ClassOptionItem[] {
    const teachers = teacherStore.getAllRaw();
    const accounts = authStore.listTeacherAccounts();
    const claimants = collectAllClaimants(teachers, accounts);
    const { homerooms } = attendanceStore.getAllRaw();
    const students = studentStore.getAllRaw();

    const canonicalByKey = new Map<string, string>();
    const addClassName = (raw: unknown) => {
      const cleaned = cleanText(raw);
      if (!cleaned) return;
      const key = normalizeClassKey(cleaned);
      if (!canonicalByKey.has(key)) {
        canonicalByKey.set(key, cleaned);
      }
    };

    // Prioritize student rombel naming first
    for (const s of students) addClassName(s.rombelSaatIni);
    for (const t of teachers) addClassName(t.assignedClass);
    for (const a of accounts) addClassName(a.assignedClass);
    for (const [k, hm] of Object.entries(homerooms || {})) {
      addClassName(hm?.rombel || k);
    }

    const meActor: Partial<PersonIdentity> =
      currentUser.role === 'GURU'
        ? {
            accountId: currentUser.id,
            teacherId:
              currentUser.teacherRecordId ??
              findTeacherForAccount(currentUser, teachers)?.id ??
              null,
            nip: currentUser.nip,
            name: currentUser.fullName,
          }
        : {};

    const options: ClassOptionItem[] = Array.from(canonicalByKey.entries())
      .map(([key, name]) => {
        const holder =
          claimants.find((c) => normalizeClassKey(c.className) === key) || null;
        const isMine =
          currentUser.role === 'GURU' &&
          holder !== null &&
          isSamePerson(holder, meActor, teachers, accounts);

        return {
          name,
          occupiedByName: holder ? holder.name || null : null,
          occupiedByTeacherId: holder ? holder.teacherId : null,
          occupiedByAccountId: holder ? holder.accountId : null,
          isMine,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }));

    return options;
  }

  function syncUnifiedPersonClass(params: {
    canonicalClass: string;
    teacher: TeacherRecord | null;
    account: TeacherAccount | null;
  }): void {
    const { canonicalClass, teacher, account } = params;
    const personTeacherId = teacher?.id ?? account?.teacherRecordId ?? null;
    const personName =
      cleanText(teacher?.nama) || cleanText(account?.fullName) || cleanText(account?.username);
    const personNip = cleanText(teacher?.nip) || cleanText(account?.nip);

    if (account) {
      authStore.setAssignedClass(account.id, canonicalClass);
    }
    if (teacher) {
      teacherStore.setAssignedClass(teacher.id, canonicalClass);
    }

    attendanceStore.clearHomeroomsForTeacher({
      teacherId: personTeacherId || account?.id || null,
      teacherName: personName,
      exceptRombel: canonicalClass || undefined,
    });
    if (account?.id && personTeacherId !== account.id) {
      attendanceStore.clearHomeroomsForTeacher({
        teacherId: account.id,
        exceptRombel: canonicalClass || undefined,
      });
    }

    if (canonicalClass) {
      attendanceStore.saveHomeroom({
        rombel: canonicalClass,
        teacherId: personTeacherId ?? account?.id ?? null,
        teacherName: personName,
        teacherNip: personNip,
      });
    } else {
      // Clear any homeroom matching this person completely
      attendanceStore.clearHomeroomsForTeacher({
        teacherId: personTeacherId ?? account?.id ?? null,
        teacherName: personName,
      });
    }
  }

  function assignClassToAccount(accountId: string, rawClass: string): AuthUser {
    const userRecord = authStore.getUserById(accountId);
    if (!userRecord) {
      throw new ClassAssignmentError(404, 'Akun pengguna tidak ditemukan.');
    }
    if (userRecord.role !== 'GURU') {
      throw new ClassAssignmentError(
        403,
        'Pengaturan kelas yang dipegang hanya berlaku untuk akun Guru.'
      );
    }

    const teachers = teacherStore.getAllRaw();
    const linkedTeacher = findTeacherForAccount(userRecord, teachers);
    const accounts = authStore.listTeacherAccounts();
    const accountObj = accounts.find((a) => a.id === accountId) || null;

    const canonical = resolveCanonicalClassName(rawClass);
    if (canonical) {
      assertClassClaimAvailable({
        nextClassRaw: canonical,
        actorTeacherId: linkedTeacher?.id ?? userRecord.teacherRecordId ?? null,
        actorAccountId: userRecord.id,
        actorNip: userRecord.nip || linkedTeacher?.nip || '',
        actorName: userRecord.fullName || linkedTeacher?.nama || '',
      });
    }

    syncUnifiedPersonClass({
      canonicalClass: canonical,
      teacher: linkedTeacher,
      account: accountObj,
    });

    const refreshed = authStore.getUserById(accountId)!;
    return enrichAuthUser({
      id: refreshed.id,
      fullName: refreshed.fullName,
      nip: refreshed.nip,
      username: refreshed.username,
      email: refreshed.email,
      role: refreshed.role,
      status: refreshed.status,
      mustChangePassword: Boolean(refreshed.mustChangePassword),
      teacherRecordId: refreshed.teacherRecordId ?? null,
      assignedClass: String(refreshed.assignedClass ?? '').trim(),
      createdAt: refreshed.createdAt,
      updatedAt: refreshed.updatedAt,
    });
  }

  function assignClassToTeacher(teacherId: string, rawClass: string): TeacherRecord {
    const teachers = teacherStore.getAllRaw();
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) {
      throw new ClassAssignmentError(404, 'Data guru tidak ditemukan.');
    }
    const accounts = authStore.listTeacherAccounts();
    const linkedAccount = findAccountForTeacher(teacher, accounts);

    const canonical = resolveCanonicalClassName(rawClass);
    if (canonical) {
      assertClassClaimAvailable({
        nextClassRaw: canonical,
        actorTeacherId: teacher.id,
        actorAccountId: linkedAccount?.id ?? teacher.linkedAccountId ?? null,
        actorNip: teacher.nip || linkedAccount?.nip || '',
        actorName: teacher.nama || linkedAccount?.fullName || '',
      });
    }

    syncUnifiedPersonClass({
      canonicalClass: canonical,
      teacher,
      account: linkedAccount,
    });

    const refreshedTeachers = teacherStore.getAllRaw();
    return refreshedTeachers.find((t) => t.id === teacherId)!;
  }

  function assignHomeroomByOperator(input: {
    rombel: string;
    teacherId?: string | null;
    teacherName?: string;
    teacherNip?: string;
  }): ClassHomeroomAssignment {
    const canonical = resolveCanonicalClassName(input.rombel);
    if (!canonical) {
      throw new ClassAssignmentError(400, 'Kelas / Rombel wajib dipilih.');
    }
    const targetKey = normalizeClassKey(canonical);

    const teacherId =
      typeof input.teacherId === 'string' && input.teacherId.trim()
        ? input.teacherId.trim()
        : null;
    const manualName = cleanText(input.teacherName);
    const manualNip = cleanText(input.teacherNip);

    const teachers = teacherStore.getAllRaw();
    const accounts = authStore.listTeacherAccounts();

    // Case 1: Clearing homeroom assignment for this class
    if (!teacherId && !manualName) {
      for (const t of teachers) {
        if (normalizeClassKey(t.assignedClass) === targetKey) {
          teacherStore.setAssignedClass(t.id, '');
        }
      }
      for (const a of accounts) {
        if (normalizeClassKey(a.assignedClass) === targetKey) {
          authStore.setAssignedClass(a.id, '');
        }
      }
      attendanceStore.clearHomeroom(canonical);
      return {
        rombel: canonical,
        teacherId: null,
        teacherName: '',
        teacherNip: '',
      };
    }

    // Case 2: Teacher selected from Data Guru
    if (teacherId) {
      const teacher = teachers.find((t) => t.id === teacherId);
      if (!teacher) {
        throw new ClassAssignmentError(404, 'Data guru tidak ditemukan.');
      }
      const linkedAccount = findAccountForTeacher(teacher, accounts);

      // Enforce 1 guru only holds 1 class
      const existingClass =
        cleanText(teacher.assignedClass) || cleanText(linkedAccount?.assignedClass);
      if (existingClass && normalizeClassKey(existingClass) !== targetKey) {
        throw new ClassAssignmentError(
          409,
          `Guru "${teacher.nama}" sudah memegang kelas "${existingClass}". 1 guru hanya boleh memegang 1 kelas.`
        );
      }

      // Also check homerooms map for this teacher
      const { homerooms } = attendanceStore.getAllRaw();
      for (const [k, hm] of Object.entries(homerooms || {})) {
        const hmClass = cleanText(hm?.rombel || k);
        if (!hmClass || normalizeClassKey(hmClass) === targetKey) continue;
        if (
          hm?.teacherId === teacher.id ||
          (linkedAccount && hm?.teacherId === linkedAccount.id)
        ) {
          throw new ClassAssignmentError(
            409,
            `Guru "${teacher.nama}" sudah tercatat memegang kelas "${hmClass}". 1 guru hanya boleh memegang 1 kelas.`
          );
        }
      }

      // Enforce 1 class cannot be claimed by 2 different teachers
      assertClassClaimAvailable({
        nextClassRaw: canonical,
        actorTeacherId: teacher.id,
        actorAccountId: linkedAccount?.id ?? teacher.linkedAccountId ?? null,
        actorNip: teacher.nip || linkedAccount?.nip || '',
        actorName: teacher.nama,
      });

      syncUnifiedPersonClass({
        canonicalClass: canonical,
        teacher,
        account: linkedAccount,
      });

      return {
        rombel: canonical,
        teacherId: teacher.id,
        teacherName: teacher.nama,
        teacherNip: teacher.nip,
        updatedAt: new Date().toISOString(),
      };
    }

    // Case 3: Manual teacher name entry
    assertClassClaimAvailable({
      nextClassRaw: canonical,
      actorTeacherId: null,
      actorAccountId: null,
      actorNip: manualNip,
      actorName: manualName,
    });

    const manualKey = manualName.toLowerCase();
    for (const acc of accounts) {
      const accClass = cleanText(acc.assignedClass);
      if (
        accClass &&
        acc.fullName.trim().toLowerCase() === manualKey &&
        normalizeClassKey(accClass) !== targetKey
      ) {
        throw new ClassAssignmentError(
          409,
          `Guru "${manualName}" sudah memegang kelas "${accClass}". 1 guru hanya boleh memegang 1 kelas.`
        );
      }
    }

    return attendanceStore.saveHomeroom({
      rombel: canonical,
      teacherId: null,
      teacherName: manualName,
      teacherNip: manualNip,
    });
  }

  function syncAfterAccountLinking(teacherId: string, accountId: string | null): void {
    if (!accountId) return;
    const teachers = teacherStore.getAllRaw();
    const teacher = teachers.find((t) => t.id === teacherId);
    const accounts = authStore.listTeacherAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!teacher || !account) return;

    const teacherClass = cleanText(teacher.assignedClass);
    const accountClass = cleanText(account.assignedClass);

    if (
      teacherClass &&
      accountClass &&
      normalizeClassKey(teacherClass) !== normalizeClassKey(accountClass)
    ) {
      throw new ClassAssignmentError(
        409,
        `Konflik kelas: Data guru memegang kelas "${teacherClass}" sedangkan akun login memegang kelas "${accountClass}". 1 guru hanya boleh memegang 1 kelas.`
      );
    }

    const unified = resolveCanonicalClassName(teacherClass || accountClass);
    if (unified) {
      syncUnifiedPersonClass({
        canonicalClass: unified,
        teacher,
        account,
      });
    }
  }

  function validateLinkCompatibilityBeforeLink(
    teacherId: string,
    accountId: string | null
  ): void {
    if (!accountId) return;
    const teachers = teacherStore.getAllRaw();
    const teacher = teachers.find((t) => t.id === teacherId);
    const accounts = authStore.listTeacherAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!teacher || !account) return;

    const teacherClass = cleanText(teacher.assignedClass);
    const accountClass = cleanText(account.assignedClass);

    if (
      teacherClass &&
      accountClass &&
      normalizeClassKey(teacherClass) !== normalizeClassKey(accountClass)
    ) {
      throw new ClassAssignmentError(
        409,
        `Konflik kelas: Data guru memegang kelas "${teacherClass}" sedangkan akun login memegang kelas "${accountClass}". Kosongkan salah satu terlebih dahulu.`
      );
    }
  }

  function cleanupOnTeacherDelete(teacherId: string): void {
    const teachers = teacherStore.getAllRaw();
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;
    const accounts = authStore.listTeacherAccounts();
    const linkedAccount = findAccountForTeacher(teacher, accounts);
    if (!linkedAccount) {
      attendanceStore.clearHomeroomsForTeacher({
        teacherId: teacher.id,
        teacherName: teacher.nama,
      });
    }
  }

  function cleanupOnAccountDelete(deletedUser: {
    id: string;
    fullName: string;
    teacherRecordId?: string | null;
    nip?: string;
  } | null): void {
    if (!deletedUser) return;
    const teachers = teacherStore.getAllRaw();
    const linkedTeacher = findTeacherForAccount(deletedUser, teachers);
    if (!linkedTeacher) {
      attendanceStore.clearHomeroomsForTeacher({
        teacherId: deletedUser.id,
        teacherName: deletedUser.fullName,
      });
    }
  }

  return {
    normalizeClassKey,
    resolveCanonicalClassName,
    getEffectiveAssignedClassForAccount,
    enrichAuthUser,
    enrichTeacherAccountList,
    assertClassClaimAvailable,
    listClassOptions,
    assignClassToAccount,
    assignClassToTeacher,
    assignHomeroomByOperator,
    validateLinkCompatibilityBeforeLink,
    syncAfterAccountLinking,
    cleanupOnTeacherDelete,
    cleanupOnAccountDelete,
  };
}
