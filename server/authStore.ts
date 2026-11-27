import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AccountStatus,
  AuthUser,
  BulkGenerateAccountsResponse,
  TeacherAccount,
  UserRole,
} from '../src/types/auth.ts';
import type { TeacherRecord } from '../src/types/teacher.ts';

export interface StoredUserRecord {
  id: string;
  fullName: string;
  nip: string;
  username: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  mustChangePassword?: boolean;
  teacherRecordId?: string | null;
  assignedClass?: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

interface StoredSessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface StoredPasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 1000 * 60 * 15; // 15 minutes
const LOCKOUT_DURATION_MS = 1000 * 60 * 5; // 5 minutes

export class AuthError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password minimal harus terdiri dari 8 karakter.';
  }
  const hasLetterAndDigit = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const isOfficialIdDigits = /^\d{16,20}$/.test(password);
  if (!hasLetterAndDigit && !isOfficialIdDigits) {
    return 'Password harus mengandung kombinasi huruf dan angka (atau NIK/NIP 16–18 digit).';
  }
  return null;
}

export function validateUsernameFormat(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 4 || trimmed.length > 40) {
    return 'Username harus terdiri dari 4 hingga 40 karakter.';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'Username hanya boleh berisi huruf, angka, titik (.), garis bawah (_), atau tanda hubung (-).';
  }
  return null;
}

export function validateEmailFormat(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null; // Optional email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Format email tidak valid.';
  }
  return null;
}

function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}

export function toPublicUser(record: StoredUserRecord): AuthUser {
  return {
    id: record.id,
    fullName: record.fullName,
    nip: record.nip,
    username: record.username,
    email: record.email,
    role: record.role,
    status: record.status,
    mustChangePassword: Boolean(record.mustChangePassword),
    teacherRecordId: record.teacherRecordId ?? null,
    assignedClass: String(record.assignedClass ?? '').trim(),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toTeacherAccount(record: StoredUserRecord): TeacherAccount {
  return {
    id: record.id,
    fullName: record.fullName,
    nip: record.nip,
    username: record.username,
    email: record.email,
    role: 'GURU',
    status: record.status,
    mustChangePassword: Boolean(record.mustChangePassword),
    teacherRecordId: record.teacherRecordId ?? null,
    assignedClass: String(record.assignedClass ?? '').trim(),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deactivatedAt: record.deactivatedAt,
  };
}

export function createAuthStore(storageDir: string) {
  const usersFile = path.resolve(storageDir, 'users.json');
  const sessionsFile = path.resolve(storageDir, 'sessions.json');
  const resetsFile = path.resolve(storageDir, 'password-resets.json');
  const secretFile = path.resolve(storageDir, '.session-secret');
  const loginAttempts = new Map<string, LoginAttemptRecord>();

  function ensureDir() {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function getSessionSecret(): string {
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
      return process.env.SESSION_SECRET;
    }
    ensureDir();
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { encoding: 'utf-8', mode: 0o600 });
    return generated;
  }

  function writeJsonAtomic(filePath: string, data: unknown): void {
    ensureDir();
    const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  function readUsers(): StoredUserRecord[] {
    ensureDir();
    if (!fs.existsSync(usersFile)) return [];
    try {
      const raw = fs.readFileSync(usersFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredUserRecord[]) : [];
    } catch {
      return [];
    }
  }

  function writeUsers(users: StoredUserRecord[]): void {
    writeJsonAtomic(usersFile, users);
  }

  function readSessions(): StoredSessionRecord[] {
    ensureDir();
    if (!fs.existsSync(sessionsFile)) return [];
    try {
      const raw = fs.readFileSync(sessionsFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return (parsed as StoredSessionRecord[]).filter(
        (s) => Date.parse(s.expiresAt) > now
      );
    } catch {
      return [];
    }
  }

  function writeSessions(sessions: StoredSessionRecord[]): void {
    writeJsonAtomic(sessionsFile, sessions);
  }

  function hashResetToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  function readResetTokens(): StoredPasswordResetRecord[] {
    ensureDir();
    if (!fs.existsSync(resetsFile)) return [];
    try {
      const raw = fs.readFileSync(resetsFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      // Prune expired records
      return (parsed as StoredPasswordResetRecord[]).filter(
        (r) => Date.parse(r.expiresAt) > now
      );
    } catch {
      return [];
    }
  }

  function writeResetTokens(records: StoredPasswordResetRecord[]): void {
    writeJsonAtomic(resetsFile, records);
  }

  function signSessionId(sessionId: string): string {
    const secret = getSessionSecret();
    const sig = crypto
      .createHmac('sha256', secret)
      .update(sessionId)
      .digest('hex');
    return `${sessionId}.${sig}`;
  }

  function verifySignedSessionToken(token: string): string | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [sessionId, sig] = parts;
    if (!sessionId || !sig) return null;
    const secret = getSessionSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(sessionId)
      .digest('hex');
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');
      if (sigBuf.length !== expBuf.length) return null;
      if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
      return sessionId;
    } catch {
      return null;
    }
  }

  function needsInitialOperatorSetup(): boolean {
    const users = readUsers();
    return !users.some((u) => u.role === 'OPERATOR');
  }

  function createSessionForUser(userId: string): string {
    const sessions = readSessions();
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const record: StoredSessionRecord = {
      id: sessionId,
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };
    sessions.push(record);
    writeSessions(sessions);
    return signSessionId(sessionId);
  }

  function revokeSessionToken(token: string): void {
    const sessionId = verifySignedSessionToken(token);
    if (!sessionId) return;
    const sessions = readSessions();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    writeSessions(remaining);
  }

  function revokeAllSessionsForUser(userId: string): void {
    const sessions = readSessions();
    const remaining = sessions.filter((s) => s.userId !== userId);
    writeSessions(remaining);
  }

  function getUserFromToken(token: string | null | undefined): AuthUser | null {
    if (!token) return null;
    const sessionId = verifySignedSessionToken(token);
    if (!sessionId) return null;

    const sessions = readSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const users = readUsers();
    const user = users.find((u) => u.id === session.userId);
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }
    return toPublicUser(user);
  }

  function getAttemptKey(ip: string, identifier: string): string {
    return `${ip}::${identifier.trim().toLowerCase()}`;
  }

  function checkRateLimit(ip: string, identifier: string): void {
    const key = getAttemptKey(ip, identifier);
    const entry = loginAttempts.get(key);
    if (!entry) return;

    const now = Date.now();
    if (entry.lockedUntil > now) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((entry.lockedUntil - now) / 60000)
      );
      throw new AuthError(
        429,
        `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${remainingMinutes} menit.`
      );
    }

    if (now - entry.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }

  function recordFailedAttempt(ip: string, identifier: string): void {
    const key = getAttemptKey(ip, identifier);
    const now = Date.now();
    const existing = loginAttempts.get(key);

    if (!existing || now - existing.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      loginAttempts.set(key, {
        count: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
      });
      return;
    }

    const nextCount = existing.count + 1;
    loginAttempts.set(key, {
      count: nextCount,
      firstAttemptAt: existing.firstAttemptAt,
      lockedUntil: nextCount >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0,
    });
  }

  function clearFailedAttempts(ip: string, identifier: string): void {
    loginAttempts.delete(getAttemptKey(ip, identifier));
  }

  function setupInitialOperator(input: {
    fullName: string;
    nip?: string;
    username: string;
    email?: string;
    password: string;
    confirmPassword: string;
  }): { user: AuthUser; token: string } {
    if (!needsInitialOperatorSetup()) {
      throw new AuthError(
        403,
        'Akun Operator awal sudah dikonfigurasi. Silakan masuk melalui halaman login.'
      );
    }

    const fullName = String(input.fullName ?? '').trim();
    const nip = String(input.nip ?? '').trim();
    const usernameRaw = String(input.username ?? '').trim();
    const emailRaw = String(input.email ?? '').trim();
    const password = String(input.password ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');

    if (!fullName) {
      throw new AuthError(400, 'Nama lengkap Operator wajib diisi.');
    }

    const usernameError = validateUsernameFormat(usernameRaw);
    if (usernameError) {
      throw new AuthError(400, usernameError);
    }

    const emailError = validateEmailFormat(emailRaw);
    if (emailError) {
      throw new AuthError(400, emailError);
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new AuthError(400, passwordError);
    }

    if (password !== confirmPassword) {
      throw new AuthError(400, 'Password dan konfirmasi password tidak sama.');
    }

    const { salt, hash } = hashPassword(password);
    const nowIso = new Date().toISOString();

    const record: StoredUserRecord = {
      id: crypto.randomUUID(),
      fullName,
      nip,
      username: usernameRaw,
      email: emailRaw,
      role: 'OPERATOR',
      status: 'ACTIVE',
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: nowIso,
      updatedAt: nowIso,
      deactivatedAt: null,
    };

    const users = readUsers();
    users.push(record);
    writeUsers(users);

    const token = createSessionForUser(record.id);
    return { user: toPublicUser(record), token };
  }

  function login(input: {
    identifier: string;
    password: string;
    ip: string;
  }): { user: AuthUser; token: string } {
    const identifier = String(input.identifier ?? '').trim();
    const password = String(input.password ?? '');

    if (!identifier || !password) {
      throw new AuthError(400, 'Username/email dan password wajib diisi.');
    }

    checkRateLimit(input.ip, identifier);

    const normalized = identifier.toLowerCase();
    const users = readUsers();
    const matched = users.find(
      (u) =>
        normalizeUsername(u.username) === normalized ||
        (u.email && normalizeEmail(u.email) === normalized)
    );

    if (!matched || !verifyPassword(password, matched.passwordSalt, matched.passwordHash)) {
      recordFailedAttempt(input.ip, identifier);
      throw new AuthError(401, 'Username/email atau password tidak sesuai.');
    }

    if (matched.status !== 'ACTIVE') {
      throw new AuthError(
        403,
        'Akun Anda sedang dinonaktifkan. Silakan hubungi Operator sekolah.'
      );
    }

    clearFailedAttempts(input.ip, identifier);
    const token = createSessionForUser(matched.id);
    return { user: toPublicUser(matched), token };
  }

  function listTeacherAccounts(): TeacherAccount[] {
    const users = readUsers();
    return users
      .filter((u) => u.role === 'GURU')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toTeacherAccount);
  }

  function createTeacherAccount(input: {
    fullName: string;
    nip?: string;
    username: string;
    email?: string;
    password: string;
    confirmPassword: string;
    status?: AccountStatus;
    teacherRecordId?: string | null;
    assignedClass?: string;
  }): TeacherAccount {
    const fullName = String(input.fullName ?? '').trim();
    const nip = String(input.nip ?? '').trim();
    const usernameRaw = String(input.username ?? '').trim();
    const emailRaw = String(input.email ?? '').trim();
    const password = String(input.password ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');
    const status: AccountStatus =
      input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const teacherRecordId =
      typeof input.teacherRecordId === 'string' && input.teacherRecordId.trim()
        ? input.teacherRecordId.trim()
        : null;
    const assignedClass = String(input.assignedClass ?? '').trim();

    if (!fullName) {
      throw new AuthError(400, 'Nama lengkap guru wajib diisi.');
    }

    const usernameError = validateUsernameFormat(usernameRaw);
    if (usernameError) {
      throw new AuthError(400, usernameError);
    }

    const emailError = validateEmailFormat(emailRaw);
    if (emailError) {
      throw new AuthError(400, emailError);
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new AuthError(400, passwordError);
    }

    if (password !== confirmPassword) {
      throw new AuthError(400, 'Password dan konfirmasi password tidak sama.');
    }

    const users = readUsers();

    if (users.some((u) => normalizeUsername(u.username) === normalizeUsername(usernameRaw))) {
      throw new AuthError(409, 'Username sudah digunakan oleh akun lain.');
    }

    if (nip && users.some((u) => u.nip.trim() && u.nip.trim() === nip)) {
      throw new AuthError(409, 'NIP sudah terdaftar pada akun lain.');
    }

    if (
      emailRaw &&
      users.some((u) => u.email && normalizeEmail(u.email) === normalizeEmail(emailRaw))
    ) {
      throw new AuthError(409, 'Email sudah terdaftar pada akun lain.');
    }

    const { salt, hash } = hashPassword(password);
    const nowIso = new Date().toISOString();

    const record: StoredUserRecord = {
      id: crypto.randomUUID(),
      fullName,
      nip,
      username: usernameRaw,
      email: emailRaw,
      role: 'GURU', // Role is strictly enforced as GURU
      status,
      teacherRecordId,
      assignedClass,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: nowIso,
      updatedAt: nowIso,
      deactivatedAt: status === 'INACTIVE' ? nowIso : null,
    };

    users.push(record);
    writeUsers(users);
    return toTeacherAccount(record);
  }

  function updateTeacherAccount(
    id: string,
    input: {
      fullName: string;
      nip: string;
      username: string;
      email?: string;
      status?: AccountStatus;
      assignedClass?: string;
    }
  ): TeacherAccount {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === id && u.role === 'GURU');
    if (index === -1) {
      throw new AuthError(404, 'Akun guru tidak ditemukan.');
    }

    const fullName = String(input.fullName ?? '').trim();
    const nip = String(input.nip ?? '').trim();
    const usernameRaw = String(input.username ?? '').trim();
    const emailRaw = String(input.email ?? '').trim();
    const status: AccountStatus =
      input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (!fullName) {
      throw new AuthError(400, 'Nama lengkap guru wajib diisi.');
    }

    const usernameError = validateUsernameFormat(usernameRaw);
    if (usernameError) {
      throw new AuthError(400, usernameError);
    }

    const emailError = validateEmailFormat(emailRaw);
    if (emailError) {
      throw new AuthError(400, emailError);
    }

    if (
      users.some(
        (u) =>
          u.id !== id &&
          normalizeUsername(u.username) === normalizeUsername(usernameRaw)
      )
    ) {
      throw new AuthError(409, 'Username sudah digunakan oleh akun lain.');
    }

    if (nip && users.some((u) => u.id !== id && u.nip.trim() && u.nip.trim() === nip)) {
      throw new AuthError(409, 'NIP sudah terdaftar pada akun lain.');
    }

    if (
      emailRaw &&
      users.some(
        (u) =>
          u.id !== id &&
          u.email &&
          normalizeEmail(u.email) === normalizeEmail(emailRaw)
      )
    ) {
      throw new AuthError(409, 'Email sudah terdaftar pada akun lain.');
    }

    const existing = users[index];
    const nextAssignedClass =
      input.assignedClass !== undefined
        ? String(input.assignedClass ?? '').trim()
        : String(existing.assignedClass ?? '').trim();
    const nowIso = new Date().toISOString();
    const updated: StoredUserRecord = {
      ...existing,
      fullName,
      nip,
      username: usernameRaw,
      email: emailRaw,
      role: 'GURU', // Never allow elevating role to OPERATOR
      status,
      assignedClass: nextAssignedClass,
      updatedAt: nowIso,
      deactivatedAt:
        status === 'INACTIVE'
          ? existing.deactivatedAt || nowIso
          : null,
    };

    users[index] = updated;
    writeUsers(users);

    if (status === 'INACTIVE') {
      revokeAllSessionsForUser(id);
    }

    return toTeacherAccount(updated);
  }

  function resetTeacherPassword(
    id: string,
    input: {
      password: string;
      confirmPassword: string;
      mustChangePassword?: boolean;
    }
  ): TeacherAccount {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === id && u.role === 'GURU');
    if (index === -1) {
      throw new AuthError(404, 'Akun guru tidak ditemukan.');
    }

    const password = String(input.password ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new AuthError(400, passwordError);
    }

    if (password !== confirmPassword) {
      throw new AuthError(400, 'Password baru dan konfirmasi password tidak sama.');
    }

    const { salt, hash } = hashPassword(password);
    const existing = users[index];
    const updated: StoredUserRecord = {
      ...existing,
      mustChangePassword: Boolean(input.mustChangePassword),
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: new Date().toISOString(),
    };

    users[index] = updated;
    writeUsers(users);
    revokeAllSessionsForUser(id);

    return toTeacherAccount(updated);
  }

  function changeOwnPassword(
    userId: string,
    input: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }
  ): { user: AuthUser; token: string } {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new AuthError(404, 'Akun pengguna tidak ditemukan.');
    }

    const existing = users[index];
    if (existing.status !== 'ACTIVE') {
      throw new AuthError(403, 'Akun Anda sedang dinonaktifkan.');
    }

    const currentPassword = String(input.currentPassword ?? '');
    const newPassword = String(input.newPassword ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');

    if (!verifyPassword(currentPassword, existing.passwordSalt, existing.passwordHash)) {
      throw new AuthError(400, 'Password saat ini / sementara tidak sesuai.');
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      throw new AuthError(400, strengthError);
    }

    if (newPassword !== confirmPassword) {
      throw new AuthError(400, 'Password baru dan konfirmasi password tidak sama.');
    }

    if (newPassword === currentPassword) {
      throw new AuthError(
        400,
        'Password baru harus berbeda dari password sementara atau password lama.'
      );
    }

    const { salt, hash } = hashPassword(newPassword);
    const updated: StoredUserRecord = {
      ...existing,
      mustChangePassword: false,
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: new Date().toISOString(),
    };

    users[index] = updated;
    writeUsers(users);
    revokeAllSessionsForUser(userId);
    const newToken = createSessionForUser(userId);
    return { user: toPublicUser(updated), token: newToken };
  }

  function setTeacherStatus(id: string, status: AccountStatus): TeacherAccount {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === id && u.role === 'GURU');
    if (index === -1) {
      throw new AuthError(404, 'Akun guru tidak ditemukan.');
    }

    const existing = users[index];
    const nowIso = new Date().toISOString();
    const updated: StoredUserRecord = {
      ...existing,
      status,
      updatedAt: nowIso,
      deactivatedAt: status === 'INACTIVE' ? nowIso : null,
    };

    users[index] = updated;
    writeUsers(users);

    if (status === 'INACTIVE') {
      revokeAllSessionsForUser(id);
    }

    return toTeacherAccount(updated);
  }

  function deleteTeacherAccount(id: string): void {
    const users = readUsers();
    const target = users.find((u) => u.id === id && u.role === 'GURU');
    if (!target) {
      throw new AuthError(404, 'Akun guru tidak ditemukan.');
    }

    const remainingUsers = users.filter((u) => u.id !== id);
    writeUsers(remainingUsers);
    revokeAllSessionsForUser(id);

    const remainingResets = readResetTokens().filter((r) => r.userId !== id);
    writeResetTokens(remainingResets);
  }

  function issueResetTokenForUser(userId: string): {
    rawToken: string;
    expiresAt: string;
  } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = new Date(now + RESET_TOKEN_TTL_MS).toISOString();

    const tokens = readResetTokens().filter(
      (r) => r.userId !== userId || r.usedAt !== null
    );
    tokens.push({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashResetToken(rawToken),
      createdAt: new Date(now).toISOString(),
      expiresAt,
      usedAt: null,
    });
    writeResetTokens(tokens);

    return { rawToken, expiresAt };
  }

  function createPasswordResetForTeacher(id: string): {
    rawToken: string;
    expiresAt: string;
    teacher: TeacherAccount;
  } {
    const users = readUsers();
    const target = users.find((u) => u.id === id && u.role === 'GURU');
    if (!target) {
      throw new AuthError(404, 'Akun guru tidak ditemukan.');
    }
    if (target.status !== 'ACTIVE') {
      throw new AuthError(
        400,
        'Akun guru sedang nonaktif. Aktifkan akun terlebih dahulu sebelum membuat tautan reset.'
      );
    }
    const issued = issueResetTokenForUser(target.id);
    return {
      ...issued,
      teacher: toTeacherAccount(target),
    };
  }

  function findActiveUserByEmail(email: string): StoredUserRecord | null {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const users = readUsers();
    return (
      users.find(
        (u) =>
          u.status === 'ACTIVE' &&
          u.email &&
          normalizeEmail(u.email) === normalized
      ) || null
    );
  }

  function validatePasswordResetToken(rawToken: string): {
    valid: boolean;
    username?: string;
    fullName?: string;
    error?: string;
  } {
    const trimmed = String(rawToken ?? '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Token pemulihan password tidak ditemukan.' };
    }
    const tokenHash = hashResetToken(trimmed);
    const records = readResetTokens();
    const record = records.find((r) => r.tokenHash === tokenHash);

    if (!record) {
      return {
        valid: false,
        error: 'Tautan reset password tidak valid atau sudah kedaluwarsa.',
      };
    }
    if (record.usedAt) {
      return {
        valid: false,
        error: 'Tautan reset password ini sudah pernah digunakan.',
      };
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      return {
        valid: false,
        error: 'Tautan reset password telah melewati batas waktu.',
      };
    }

    const users = readUsers();
    const user = users.find((u) => u.id === record.userId && u.status === 'ACTIVE');
    if (!user) {
      return {
        valid: false,
        error: 'Akun pengguna tidak tersedia atau sedang dinonaktifkan.',
      };
    }

    return {
      valid: true,
      username: user.username,
      fullName: user.fullName,
    };
  }

  function confirmPasswordReset(input: {
    token: string;
    password?: string;
    newPassword?: string;
    confirmPassword: string;
  }): AuthUser {
    const rawToken = String(input.token ?? '').trim();
    const password = String(input.newPassword ?? input.password ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');

    if (!rawToken) {
      throw new AuthError(400, 'Token pemulihan password wajib disertakan.');
    }

    const tokenHash = hashResetToken(rawToken);
    const records = readResetTokens();
    const recIdx = records.findIndex((r) => r.tokenHash === tokenHash);
    if (recIdx === -1) {
      throw new AuthError(
        400,
        'Tautan reset password tidak valid atau sudah kedaluwarsa.'
      );
    }

    const record = records[recIdx];
    if (record.usedAt) {
      throw new AuthError(
        400,
        'Tautan reset password ini sudah digunakan sebelumnya.'
      );
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      throw new AuthError(400, 'Tautan reset password sudah kedaluwarsa.');
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      throw new AuthError(400, strengthError);
    }
    if (password !== confirmPassword) {
      throw new AuthError(400, 'Password baru dan konfirmasi password tidak sama.');
    }

    const users = readUsers();
    const userIdx = users.findIndex(
      (u) => u.id === record.userId && u.status === 'ACTIVE'
    );
    if (userIdx === -1) {
      throw new AuthError(403, 'Akun pengguna tidak aktif atau tidak ditemukan.');
    }

    const { salt, hash } = hashPassword(password);
    const nowIso = new Date().toISOString();
    const updatedUser: StoredUserRecord = {
      ...users[userIdx],
      mustChangePassword: false,
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: nowIso,
    };
    users[userIdx] = updatedUser;
    writeUsers(users);

    // Mark token used (single-use) and invalidate any other tokens for user
    records[recIdx] = { ...record, usedAt: nowIso };
    writeResetTokens(records);

    revokeAllSessionsForUser(updatedUser.id);

    return toPublicUser(updatedUser);
  }

  function linkAccountToTeacherRecord(
    accountId: string,
    teacherRecordId: string | null
  ): TeacherAccount {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === accountId && u.role === 'GURU');
    if (index === -1) {
      throw new AuthError(404, 'Akun login guru tidak ditemukan.');
    }
    const updated: StoredUserRecord = {
      ...users[index],
      teacherRecordId,
      updatedAt: new Date().toISOString(),
    };
    users[index] = updated;
    writeUsers(users);
    return toTeacherAccount(updated);
  }

  function getUserById(id: string): StoredUserRecord | null {
    const users = readUsers();
    return users.find((u) => u.id === id) || null;
  }

  function setAssignedClass(accountId: string, assignedClass: string): AuthUser {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === accountId);
    if (index === -1) {
      throw new AuthError(404, 'Akun pengguna tidak ditemukan.');
    }
    const updated: StoredUserRecord = {
      ...users[index],
      assignedClass: String(assignedClass ?? '').trim(),
      updatedAt: new Date().toISOString(),
    };
    users[index] = updated;
    writeUsers(users);
    return toPublicUser(updated);
  }

  function updateOwnProfile(
    userId: string,
    input: {
      fullName?: string;
      nip?: string;
      email?: string;
    }
  ): { user: AuthUser; changedFields: string[] } {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new AuthError(404, 'Akun pengguna tidak ditemukan.');
    }

    const existing = users[index];
    if (existing.status !== 'ACTIVE') {
      throw new AuthError(403, 'Akun Anda sedang dinonaktifkan.');
    }

    const fullName =
      input.fullName !== undefined
        ? String(input.fullName ?? '').trim()
        : existing.fullName;
    const nip =
      input.nip !== undefined ? String(input.nip ?? '').trim() : existing.nip;
    const emailRaw =
      input.email !== undefined
        ? String(input.email ?? '').trim()
        : existing.email;

    if (!fullName) {
      throw new AuthError(400, 'Nama lengkap wajib diisi.');
    }

    const emailError = validateEmailFormat(emailRaw);
    if (emailError) {
      throw new AuthError(400, emailError);
    }

    if (
      nip &&
      users.some((u) => u.id !== userId && u.nip.trim() && u.nip.trim() === nip)
    ) {
      throw new AuthError(409, 'NIP sudah terdaftar pada akun lain.');
    }

    if (
      emailRaw &&
      users.some(
        (u) =>
          u.id !== userId &&
          u.email &&
          normalizeEmail(u.email) === normalizeEmail(emailRaw)
      )
    ) {
      throw new AuthError(409, 'Email sudah terdaftar pada akun lain.');
    }

    const changedFields: string[] = [];
    if (fullName !== existing.fullName) changedFields.push('Nama Lengkap');
    if (nip !== existing.nip) changedFields.push('NIP');
    if (emailRaw !== existing.email) changedFields.push('Email');

    const updated: StoredUserRecord = {
      ...existing,
      fullName,
      nip,
      email: emailRaw,
      updatedAt: new Date().toISOString(),
    };
    users[index] = updated;
    writeUsers(users);
    return {
      user: toPublicUser(updated),
      changedFields,
    };
  }

  function hasAnyOperator(): boolean {
    return !needsInitialOperatorSetup();
  }

  function exportRawUsers(): StoredUserRecord[] {
    return readUsers();
  }

  function restoreRawUsers(records: unknown[]): {
    restored: number;
    updated: number;
  } {
    if (!Array.isArray(records) || records.length === 0) {
      return { restored: 0, updated: 0 };
    }
    const users = readUsers();
    const byId = new Map<string, number>();
    users.forEach((u, idx) => byId.set(u.id, idx));

    let restored = 0;
    let updated = 0;

    for (const raw of records) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<StoredUserRecord>;
      const id = String(item.id ?? '').trim();
      const fullName = String(item.fullName ?? '').trim();
      const username = String(item.username ?? '').trim();
      const role: UserRole | null =
        item.role === 'OPERATOR' || item.role === 'GURU' ? item.role : null;
      const status: AccountStatus =
        item.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const passwordSalt = String(item.passwordSalt ?? '').trim();
      const passwordHash = String(item.passwordHash ?? '').trim();

      if (
        !id ||
        !fullName ||
        !username ||
        !role ||
        !passwordSalt ||
        !passwordHash
      ) {
        continue;
      }

      const nowIso = new Date().toISOString();
      const normalizedRecord: StoredUserRecord = {
        id,
        fullName,
        nip: String(item.nip ?? '').trim(),
        username,
        email: String(item.email ?? '').trim(),
        role,
        status,
        mustChangePassword: Boolean(item.mustChangePassword),
        teacherRecordId:
          typeof item.teacherRecordId === 'string' &&
          item.teacherRecordId.trim()
            ? item.teacherRecordId.trim()
            : null,
        assignedClass: String(item.assignedClass ?? '').trim(),
        passwordSalt,
        passwordHash,
        createdAt: String(item.createdAt ?? '').trim() || nowIso,
        updatedAt: String(item.updatedAt ?? '').trim() || nowIso,
        deactivatedAt:
          typeof item.deactivatedAt === 'string' && item.deactivatedAt.trim()
            ? item.deactivatedAt.trim()
            : null,
      };

      const existingIdx = byId.get(id);
      if (existingIdx === undefined) {
        const sameUsernameExists = users.some(
          (u) => normalizeUsername(u.username) === normalizeUsername(username)
        );
        if (sameUsernameExists) continue;
        byId.set(id, users.length);
        users.push(normalizedRecord);
        restored++;
      } else {
        const existing = users[existingIdx];
        const existingTime =
          Date.parse(existing.updatedAt || existing.createdAt) || 0;
        const incomingTime =
          Date.parse(normalizedRecord.updatedAt || normalizedRecord.createdAt) ||
          0;
        if (incomingTime > existingTime) {
          users[existingIdx] = normalizedRecord;
          updated++;
        }
      }
    }

    if (restored > 0 || updated > 0) {
      writeUsers(users);
    }

    return { restored, updated };
  }

  function cleanIdUsername(raw: string): string {
    return String(raw ?? '').replace(/\s+/g, '').trim();
  }

  function generateAccountsForTeachers(
    teachers: TeacherRecord[],
    defaultPassword: string
  ): BulkGenerateAccountsResponse {
    const password = String(defaultPassword ?? '');
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new AuthError(400, passwordError);
    }

    const users = readUsers();
    const usedUsernames = new Set(
      users.map((u) => normalizeUsername(u.username)).filter(Boolean)
    );
    const usedNips = new Set(
      users.map((u) => u.nip.trim()).filter(Boolean)
    );
    const usedEmails = new Set(
      users.map((u) => normalizeEmail(u.email)).filter(Boolean)
    );
    const linkedTeacherIds = new Set(
      users.map((u) => u.teacherRecordId).filter((v): v is string => Boolean(v))
    );
    const activeUserIds = new Set(users.map((u) => u.id));

    const createdRecords: StoredUserRecord[] = [];
    let skippedExistingCount = 0;
    const skippedNoId: Array<{ id: string; nama: string; reason: string }> = [];

    for (const teacher of teachers) {
      const fullName = String(teacher.nama ?? '').trim();
      const nipTrimmed = String(teacher.nip ?? '').trim();
      const nikClean = cleanIdUsername(teacher.nik);
      const nipClean = cleanIdUsername(teacher.nip);

      const alreadyLinked =
        (teacher.linkedAccountId && activeUserIds.has(teacher.linkedAccountId)) ||
        linkedTeacherIds.has(teacher.id) ||
        (nipTrimmed && usedNips.has(nipTrimmed)) ||
        (nikClean && usedUsernames.has(normalizeUsername(nikClean))) ||
        (nipClean && usedUsernames.has(normalizeUsername(nipClean)));

      if (alreadyLinked) {
        skippedExistingCount++;
        continue;
      }

      let username = '';
      if (nikClean && validateUsernameFormat(nikClean) === null) {
        username = nikClean;
      } else if (nipClean && validateUsernameFormat(nipClean) === null) {
        username = nipClean;
      }

      if (!username) {
        skippedNoId.push({
          id: teacher.id,
          nama: fullName || '-',
          reason: 'NIK dan NIP kosong atau tidak valid',
        });
        continue;
      }

      const rawEmail = String(teacher.email ?? '').trim();
      const safeEmail =
        rawEmail &&
        validateEmailFormat(rawEmail) === null &&
        !usedEmails.has(normalizeEmail(rawEmail))
          ? rawEmail
          : '';

      const { salt, hash } = hashPassword(password);
      const nowIso = new Date().toISOString();
      const record: StoredUserRecord = {
        id: crypto.randomUUID(),
        fullName: fullName || username,
        nip: nipTrimmed,
        username,
        email: safeEmail,
        role: 'GURU',
        status: 'ACTIVE',
        mustChangePassword: false,
        teacherRecordId: teacher.id,
        assignedClass: String(teacher.assignedClass ?? '').trim(),
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: nowIso,
        updatedAt: nowIso,
        deactivatedAt: null,
      };

      users.push(record);
      createdRecords.push(record);
      activeUserIds.add(record.id);
      linkedTeacherIds.add(teacher.id);
      usedUsernames.add(normalizeUsername(username));
      if (nipTrimmed) usedNips.add(nipTrimmed);
      if (safeEmail) usedEmails.add(normalizeEmail(safeEmail));
    }

    if (createdRecords.length > 0) {
      writeUsers(users);
    }

    return {
      createdAccounts: createdRecords.map(toTeacherAccount),
      createdCount: createdRecords.length,
      skippedExistingCount,
      skippedNoId,
    };
  }

  return {
    needsInitialOperatorSetup,
    hasAnyOperator,
    exportRawUsers,
    restoreRawUsers,
    getUserById,
    setAssignedClass,
    updateOwnProfile,
    setupInitialOperator,
    login,
    revokeSessionToken,
    getUserFromToken,
    listTeacherAccounts,
    createTeacherAccount,
    generateAccountsForTeachers,
    updateTeacherAccount,
    resetTeacherPassword,
    changeOwnPassword,
    setTeacherStatus,
    deleteTeacherAccount,
    linkAccountToTeacherRecord,
    findActiveUserByEmail,
    issueResetTokenForUser,
    createPasswordResetForTeacher,
    validatePasswordResetToken,
    confirmPasswordReset,
  };
}
