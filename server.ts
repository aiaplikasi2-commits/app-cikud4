import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { SchoolFileSlot, SchoolSettings, StoredFileMeta } from './src/types/settings.ts';
import type { AuthUser, PublicSchoolInfo, UserRole } from './src/types/auth.ts';
import type { ImportConflictMode, RowImportDecision } from './src/types/student.ts';
import type {
  TeacherImportCommitResult,
  TeacherImportConflictMode,
  TeacherRowImportDecision,
} from './src/types/teacher.ts';
import { AuthError, createAuthStore } from './server/authStore.ts';
import { createStudentStore, StudentStoreError } from './server/studentStore.ts';
import {
  DapodikParseError,
  parseDapodikExcelBuffer,
  type ParsedDapodikRowInternal,
} from './server/dapodikParser.ts';
import { createTeacherStore, TeacherStoreError } from './server/teacherStore.ts';
import {
  buildTeacherExcelWorkbookBuffer,
  buildTeacherImportReportBuffer,
  parseTeacherExcelBuffer,
  TeacherExcelParseError,
  type ParsedTeacherRowInternal,
} from './server/teacherExcelParser.ts';
import { createLetterStore, LetterStoreError } from './server/letterStore.ts';
import {
  AttendanceStoreError,
  createAttendanceStore,
} from './server/attendanceStore.ts';
import {
  buildAttendanceExcelBuffer,
  buildMonthlyAttendanceExcelBuffer,
} from './server/attendanceExcelBuilder.ts';
import {
  ClassAssignmentError,
  createClassAssignmentService,
  normalizeClassKey,
} from './server/classAssignment.ts';
import type {
  AttendanceContextInfo,
  AttendanceKetColumnMode,
  AttendanceSheetResponse,
  AttendanceStudentRow,
  MonthlyAttendanceResponse,
  MonthlyAttendanceStudentRow,
  MonthlyCellStatus,
  MonthlyDayInfo,
  MonthlySchoolDaysMode,
} from './src/types/attendance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const STORAGE_DIR = path.resolve(__dirname, 'storage');
const UPLOADS_DIR = path.resolve(STORAGE_DIR, 'uploads');
const SETTINGS_FILE = path.resolve(STORAGE_DIR, 'school-settings.json');

const VALID_SLOTS: SchoolFileSlot[] = ['logo', 'kop', 'ttd', 'stempel'];
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};

function ensureStorageDirs(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function createEmptySettings(): SchoolSettings {
  return {
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
}

function readSettings(): SchoolSettings {
  ensureStorageDirs();
  if (!fs.existsSync(SETTINGS_FILE)) {
    return createEmptySettings();
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SchoolSettings>;
    const defaults = createEmptySettings();
    const merged: SchoolSettings = {
      identity: {
        schoolName: String(parsed.identity?.schoolName ?? ''),
        city: String(parsed.identity?.city ?? ''),
        department: String(parsed.identity?.department ?? ''),
        academicYear: String(parsed.identity?.academicYear ?? ''),
      },
      principal: {
        name: String(parsed.principal?.name ?? ''),
        position: String(parsed.principal?.position ?? ''),
        nip: String(parsed.principal?.nip ?? ''),
      },
      operator: {
        name: String(parsed.operator?.name ?? ''),
        position: String(parsed.operator?.position ?? ''),
        nip: String(parsed.operator?.nip ?? ''),
      },
      files: {
        logo: parsed.files?.logo ?? defaults.files.logo,
        kop: parsed.files?.kop ?? defaults.files.kop,
        ttd: parsed.files?.ttd ?? defaults.files.ttd,
        stempel: parsed.files?.stempel ?? defaults.files.stempel,
      },
      updatedAt: parsed.updatedAt ?? null,
    };

    // Ensure referenced upload files still exist on disk
    for (const slot of VALID_SLOTS) {
      const meta = merged.files[slot];
      if (meta && meta.filename) {
        const filePath = path.resolve(UPLOADS_DIR, path.basename(meta.filename));
        if (!fs.existsSync(filePath)) {
          merged.files[slot] = null;
        }
      }
    }

    return merged;
  } catch {
    return createEmptySettings();
  }
}

function writeSettingsAtomic(settings: SchoolSettings): void {
  ensureStorageDirs();
  const tempPath = `${SETTINGS_FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf-8');
  fs.renameSync(tempPath, SETTINGS_FILE);
}

function removeUploadedFile(meta: StoredFileMeta | null): void {
  if (!meta?.filename) return;
  const safeName = path.basename(meta.filename);
  const fullPath = path.resolve(UPLOADS_DIR, safeName);
  if (fullPath.startsWith(UPLOADS_DIR) && fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function isValidSlot(slot: string): slot is SchoolFileSlot {
  return VALID_SLOTS.includes(slot as SchoolFileSlot);
}

const SESSION_COOKIE_NAME = 'school_admin_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  return typeof proto === 'string' && proto.split(',')[0].trim().toLowerCase() === 'https';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isSecure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${60 * 60 * 12}`,
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isSecure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

interface AuthedRequest extends Request {
  authUser?: AuthUser;
  authToken?: string;
}

async function startServer() {
  ensureStorageDirs();
  const authStore = createAuthStore(STORAGE_DIR);
  const studentStore = createStudentStore(STORAGE_DIR);
  const teacherStore = createTeacherStore(STORAGE_DIR);
  const letterStore = createLetterStore(STORAGE_DIR);
  const attendanceStore = createAttendanceStore(STORAGE_DIR);
  const classAssignment = createClassAssignmentService({
    authStore,
    teacherStore,
    attendanceStore,
    studentStore,
  });

  interface PendingImportPreview {
    userId: string;
    filename: string;
    rows: ParsedDapodikRowInternal[];
    expiresAt: number;
  }
  const importPreviewCache = new Map<string, PendingImportPreview>();

  interface PendingTeacherImportPreview {
    userId: string;
    filename: string;
    rows: ParsedTeacherRowInternal[];
    expiresAt: number;
  }
  const teacherImportPreviewCache = new Map<string, PendingTeacherImportPreview>();

  function pruneExpiredPreviews(): void {
    const now = Date.now();
    for (const [key, value] of importPreviewCache.entries()) {
      if (value.expiresAt <= now) {
        importPreviewCache.delete(key);
      }
    }
    for (const [key, value] of teacherImportPreviewCache.entries()) {
      if (value.expiresAt <= now) {
        teacherImportPreviewCache.delete(key);
      }
    }
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  function extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return token;
    }
    const cookies = parseCookies(req.headers.cookie);
    return cookies[SESSION_COOKIE_NAME] || null;
  }

  function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
    const token = extractToken(req);
    const user = authStore.getUserFromToken(token);
    if (!user || !token) {
      res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
      return;
    }
    req.authUser = classAssignment.enrichAuthUser(user);
    req.authToken = token;
    next();
  }

  function requireRole(role: UserRole) {
    return (req: AuthedRequest, res: Response, next: NextFunction): void => {
      if (!req.authUser) {
        res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
        return;
      }
      if (req.authUser.role !== role) {
        res.status(403).json({
          error: 'Akses ditolak. Anda tidak memiliki kewenangan untuk membuka sumber daya ini.',
        });
        return;
      }
      next();
    };
  }

  function getPublicSchoolInfo(): PublicSchoolInfo {
    const settings = readSettings();
    return {
      schoolName: settings.identity.schoolName,
      city: settings.identity.city,
      department: settings.identity.department,
      logoUrl: settings.files.logo?.url ?? null,
    };
  }

  // Serve saved uploaded files cleanly
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      maxAge: '365d',
      immutable: true,
    })
  );

  // Public school identity for Login page and Teacher dashboard header
  app.get('/api/school/public', (_req, res) => {
    res.json(getPublicSchoolInfo());
  });

  // Auth status check
  app.get('/api/auth/status', (req, res) => {
    const token = extractToken(req);
    const rawUser = authStore.getUserFromToken(token);
    const user = rawUser ? classAssignment.enrichAuthUser(rawUser) : null;
    res.json({
      needsInitialSetup: authStore.needsInitialOperatorSetup(),
      authenticated: Boolean(user),
      user,
      school: getPublicSchoolInfo(),
    });
  });

  // Initial Operator setup (only available when zero Operator accounts exist)
  app.post('/api/auth/setup-operator', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const result = authStore.setupInitialOperator(req.body || {});
      setSessionCookie(req, res, result.token);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Gagal membuat akun Operator awal.' });
    }
  });

  // Login (Operator & Guru)
  app.post('/api/auth/login', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const result = authStore.login({
        identifier: req.body?.identifier,
        password: req.body?.password,
        ip: getClientIp(req),
      });
      setSessionCookie(req, res, result.token);
      res.json({
        ...result,
        user: classAssignment.enrichAuthUser(result.user),
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Terjadi kesalahan saat memproses login.' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const token = extractToken(req);
    if (token) {
      authStore.revokeSessionToken(token);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Current authenticated user profile
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.authUser });
  });

  // Available classes & occupation status (OPERATOR & GURU)
  app.get('/api/classes', requireAuth, (req: AuthedRequest, res) => {
    res.json({ classes: classAssignment.listClassOptions(req.authUser!) });
  });

  // Update Guru's own assigned class from Profil Guru (enforces 1 class per teacher & rejects duplicates)
  app.put(
    '/api/auth/me/class',
    requireAuth,
    express.json({ limit: '256kb' }),
    (req: AuthedRequest, res) => {
      try {
        if (req.authUser!.role !== 'GURU') {
          res.status(403).json({
            error: 'Pengaturan kelas yang dipegang hanya berlaku untuk akun Guru.',
          });
          return;
        }
        const user = classAssignment.assignClassToAccount(
          req.authUser!.id,
          String(req.body?.assignedClass ?? '')
        );
        res.json({ user });
      } catch (err) {
        if (
          err instanceof ClassAssignmentError ||
          err instanceof AuthError ||
          err instanceof TeacherStoreError ||
          err instanceof AttendanceStoreError
        ) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memperbarui kelas yang dipegang.' });
      }
    }
  );

  // Change own password (used for mandatory first login change after temporary reset)
  app.post(
    '/api/auth/change-password',
    requireAuth,
    express.json({ limit: '1mb' }),
    (req: AuthedRequest, res) => {
      try {
        const result = authStore.changeOwnPassword(req.authUser!.id, req.body || {});
        setSessionCookie(req, res, result.token);
        res.json({
          ...result,
          user: classAssignment.enrichAuthUser(result.user),
        });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal mengubah password akun.' });
      }
    }
  );

  function buildAppOrigin(req: Request): string {
    const forwardedHost = req.headers['x-forwarded-host'];
    const host =
      typeof forwardedHost === 'string' && forwardedHost.trim()
        ? forwardedHost.split(',')[0].trim()
        : req.get('host') || `localhost:${PORT}`;
    const proto = isHttpsRequest(req) ? 'https' : req.protocol || 'http';
    return `${proto}://${host}`;
  }

  async function deliverPasswordResetEmail(params: {
    toEmail: string;
    fullName: string;
    resetUrl: string;
  }): Promise<boolean> {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const emailFrom =
      process.env.EMAIL_FROM?.trim() || 'no-reply@administrasi-sekolah.local';
    if (resendKey) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [params.toEmail],
          subject: 'Reset Password Sistem Administrasi Sekolah',
          text: `Halo ${params.fullName},\n\nKlik tautan satu kali berikut (berlaku 30 menit) untuk mengatur ulang password Anda:\n${params.resetUrl}\n\nJika Anda tidak meminta reset password, abaikan pesan ini.`,
        }),
      });
      return resp.ok;
    }

    const webhookUrl = process.env.EMAIL_WEBHOOK_URL?.trim();
    if (webhookUrl) {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: params.toEmail,
          subject: 'Reset Password Sistem Administrasi Sekolah',
          fullName: params.fullName,
          resetUrl: params.resetUrl,
        }),
      });
      return resp.ok;
    }

    return false;
  }

  // Forgot Password (public, non-leaking response)
  app.post(
    '/api/auth/forgot-password',
    express.json({ limit: '1mb' }),
    async (req, res) => {
      const email = String(req.body?.email ?? '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
        return;
      }

      const genericMessage =
        'Jika email tersebut terdaftar pada akun aktif, tautan reset password telah dikirim (berlaku 30 menit, satu kali pakai).';

      try {
        const user = authStore.findActiveUserByEmail(email);
        if (!user) {
          res.json({ ok: true, message: genericMessage });
          return;
        }

        const { rawToken } = authStore.issueResetTokenForUser(user.id);
        const resetUrl = `${buildAppOrigin(req)}/reset-password?token=${encodeURIComponent(
          rawToken
        )}`;

        const delivered = await deliverPasswordResetEmail({
          toEmail: user.email,
          fullName: user.fullName,
          resetUrl,
        });

        const hasExternalMailer = Boolean(
          process.env.RESEND_API_KEY?.trim() || process.env.EMAIL_WEBHOOK_URL?.trim()
        );

        res.json({
          ok: true,
          message: genericMessage,
          ...(hasExternalMailer && delivered ? {} : { previewResetUrl: resetUrl }),
        });
      } catch {
        res.json({ ok: true, message: genericMessage });
      }
    }
  );

  // Validate one-time reset token
  app.get('/api/auth/reset-password/validate', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const result = authStore.validatePasswordResetToken(token);
    if (!result.valid) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  // Confirm password reset using one-time token
  app.post(
    '/api/auth/reset-password/confirm',
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        authStore.confirmPasswordReset(req.body || {});
        res.json({
          ok: true,
          message:
            'Password berhasil diperbarui. Silakan login kembali menggunakan password baru Anda.',
        });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal mengatur ulang password.' });
      }
    }
  );

  // Teacher Account Management (OPERATOR ONLY)
  app.get('/api/teacher-accounts', requireAuth, requireRole('OPERATOR'), (_req, res) => {
    res.json({
      accounts: classAssignment.enrichTeacherAccountList(
        authStore.listTeacherAccounts()
      ),
    });
  });

  app.post(
    '/api/teacher-accounts',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const body = req.body || {};
        const teacherRecordId =
          typeof body.teacherRecordId === 'string' && body.teacherRecordId.trim()
            ? body.teacherRecordId.trim()
            : null;
        let requestedClass =
          body.assignedClass !== undefined ? String(body.assignedClass ?? '').trim() : '';
        if (body.assignedClass === undefined && teacherRecordId) {
          const linkedTeacher = teacherStore
            .getAllRaw()
            .find((t) => t.id === teacherRecordId);
          requestedClass = String(linkedTeacher?.assignedClass ?? '').trim();
        }
        if (requestedClass) {
          classAssignment.assertClassClaimAvailable({
            nextClassRaw: requestedClass,
            actorTeacherId: teacherRecordId,
            actorNip: String(body.nip ?? ''),
            actorName: String(body.fullName ?? ''),
          });
        }

        const created = authStore.createTeacherAccount({
          ...body,
          assignedClass: requestedClass,
        });
        if (created.teacherRecordId) {
          try {
            teacherStore.setLinkedAccountId(created.teacherRecordId, created);
          } catch {
            // Keep account creation atomic even if optional teacher link skipped
          }
        }
        if (requestedClass || created.teacherRecordId) {
          classAssignment.assignClassToAccount(created.id, requestedClass);
        }
        const enriched =
          classAssignment
            .enrichTeacherAccountList(authStore.listTeacherAccounts())
            .find((a) => a.id === created.id) || created;
        res.status(201).json({ account: enriched });
      } catch (err) {
        if (err instanceof ClassAssignmentError || err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menambahkan akun guru.' });
      }
    }
  );

  app.post(
    '/api/teacher-accounts/generate-all',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const result = authStore.generateAccountsForTeachers(
          teacherStore.getAllRaw(),
          req.body?.defaultPassword
        );
        const links = result.createdAccounts
          .filter((a) => Boolean(a.teacherRecordId))
          .map((a) => ({ teacherId: a.teacherRecordId!, accountId: a.id }));
        if (links.length > 0) {
          try {
            teacherStore.setLinkedAccountIdsBatch(links);
          } catch {
            // Keep created accounts atomic even if teacher link batch fails
          }
        }
        res.status(201).json(result);
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal generate akun guru & tendik.' });
      }
    }
  );

  app.put(
    '/api/teacher-accounts/:id',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const body = req.body || {};
        if (body.assignedClass !== undefined) {
          const existingAcc = authStore.getUserById(req.params.id);
          if (!existingAcc || existingAcc.role !== 'GURU') {
            res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
            return;
          }
          classAssignment.assertClassClaimAvailable({
            nextClassRaw: String(body.assignedClass ?? ''),
            actorAccountId: existingAcc.id,
            actorTeacherId: existingAcc.teacherRecordId ?? null,
            actorNip: String(body.nip ?? existingAcc.nip),
            actorName: String(body.fullName ?? existingAcc.fullName),
          });
        }

        const account = authStore.updateTeacherAccount(req.params.id, body);
        if (body.assignedClass !== undefined) {
          classAssignment.assignClassToAccount(
            req.params.id,
            String(body.assignedClass ?? '')
          );
        }
        const enriched =
          classAssignment
            .enrichTeacherAccountList(authStore.listTeacherAccounts())
            .find((a) => a.id === req.params.id) || account;
        res.json({ account: enriched });
      } catch (err) {
        if (err instanceof ClassAssignmentError || err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memperbarui akun guru.' });
      }
    }
  );

  app.post(
    '/api/teacher-accounts/:id/reset-password',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const account = authStore.resetTeacherPassword(req.params.id, {
          password: req.body?.password,
          confirmPassword: req.body?.confirmPassword,
          mustChangePassword: Boolean(req.body?.mustChangePassword),
        });
        res.json({ account });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal mengatur ulang password guru.' });
      }
    }
  );

  app.post(
    '/api/teacher-accounts/:id/reset-link',
    requireAuth,
    requireRole('OPERATOR'),
    async (req, res) => {
      try {
        const issued = authStore.createPasswordResetForTeacher(req.params.id);
        const resetUrl = `${buildAppOrigin(req)}/reset-password?token=${encodeURIComponent(
          issued.rawToken
        )}`;
        let emailSent = false;
        if (issued.teacher.email) {
          emailSent = await deliverPasswordResetEmail({
            toEmail: issued.teacher.email,
            fullName: issued.teacher.fullName,
            resetUrl,
          }).catch(() => false);
        }
        res.json({
          ok: true,
          resetUrl,
          expiresAt: issued.expiresAt,
          emailSent,
        });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal membuat tautan reset password.' });
      }
    }
  );

  app.patch(
    '/api/teacher-accounts/:id/status',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const status = req.body?.status === 'INACTIVE' ? 'INACTIVE' : req.body?.status === 'ACTIVE' ? 'ACTIVE' : null;
        if (!status) {
          res.status(400).json({ error: 'Status akun tidak valid.' });
          return;
        }
        const account = authStore.setTeacherStatus(req.params.id, status);
        res.json({ account });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal mengubah status akun guru.' });
      }
    }
  );

  app.delete(
    '/api/teacher-accounts/:id',
    requireAuth,
    requireRole('OPERATOR'),
    (req, res) => {
      try {
        const existingUser = authStore.getUserById(req.params.id);
        authStore.deleteTeacherAccount(req.params.id);
        classAssignment.cleanupOnAccountDelete(existingUser);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menghapus akun guru dari server.' });
      }
    }
  );

  // GET current school settings (OPERATOR ONLY)
  app.get('/api/settings', requireAuth, requireRole('OPERATOR'), (_req, res) => {
    const settings = readSettings();
    res.json(settings);
  });

  // PUT update text settings (OPERATOR ONLY)
  app.put('/api/settings', requireAuth, requireRole('OPERATOR'), express.json({ limit: '1mb' }), (req, res) => {
    try {
      const current = readSettings();
      const body = req.body as Partial<SchoolSettings>;

      const updated: SchoolSettings = {
        ...current,
        identity: body.identity
          ? {
              schoolName: String(body.identity.schoolName ?? ''),
              city: String(body.identity.city ?? ''),
              department: String(body.identity.department ?? ''),
              academicYear: String(body.identity.academicYear ?? ''),
            }
          : current.identity,
        principal: body.principal
          ? {
              name: String(body.principal.name ?? ''),
              position: String(body.principal.position ?? ''),
              nip: String(body.principal.nip ?? ''),
            }
          : current.principal,
        operator: body.operator
          ? {
              name: String(body.operator.name ?? ''),
              position: String(body.operator.position ?? ''),
              nip: String(body.operator.nip ?? ''),
            }
          : current.operator,
        updatedAt: new Date().toISOString(),
      };

      writeSettingsAtomic(updated);
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Gagal menyimpan pengaturan sekolah.' });
    }
  });

  // POST upload & save file for a specific slot (OPERATOR ONLY)
  app.post(
    '/api/settings/files/:slot',
    requireAuth,
    requireRole('OPERATOR'),
    express.raw({ type: ['image/png', 'image/jpeg', 'image/jpg'], limit: '10mb' }),
    (req, res) => {
      const { slot } = req.params;
      if (!isValidSlot(slot)) {
        res.status(400).json({ error: 'Jenis file tidak valid.' });
        return;
      }

      const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = MIME_TO_EXT[contentType];
      if (!ext) {
        res.status(400).json({ error: 'Format file harus PNG, JPG, atau JPEG.' });
        return;
      }

      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'File gambar kosong atau tidak terbaca.' });
        return;
      }

      try {
        const current = readSettings();
        const previousFile = current.files[slot];

        const rawHeaderName = req.headers['x-filename'];
        const decodedOriginalName =
          typeof rawHeaderName === 'string'
            ? decodeURIComponent(rawHeaderName)
            : `${slot}.${ext}`;
        const safeOriginalName = path.basename(decodedOriginalName).slice(0, 120);

        const newFilename = `${slot}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const destPath = path.resolve(UPLOADS_DIR, newFilename);

        // Write new file first before modifying metadata or deleting old file
        fs.writeFileSync(destPath, buffer);

        const newMeta: StoredFileMeta = {
          slot,
          filename: newFilename,
          originalName: safeOriginalName,
          mimeType: contentType,
          size: buffer.length,
          url: `/uploads/${newFilename}`,
          updatedAt: new Date().toISOString(),
        };

        const updated: SchoolSettings = {
          ...current,
          files: {
            ...current.files,
            [slot]: newMeta,
          },
          updatedAt: new Date().toISOString(),
        };

        writeSettingsAtomic(updated);

        // Only remove previous file after new file and settings JSON are safely committed
        if (previousFile) {
          removeUploadedFile(previousFile);
        }

        res.json(updated);
      } catch {
        res.status(500).json({ error: 'Gagal menyimpan file ke penyimpanan.' });
      }
    }
  );

  // DELETE saved file for a specific slot (OPERATOR ONLY)
  app.delete('/api/settings/files/:slot', requireAuth, requireRole('OPERATOR'), (req, res) => {
    const { slot } = req.params;
    if (!isValidSlot(slot)) {
      res.status(400).json({ error: 'Jenis file tidak valid.' });
      return;
    }

    try {
      const current = readSettings();
      const existingFile = current.files[slot];

      const updated: SchoolSettings = {
        ...current,
        files: {
          ...current.files,
          [slot]: null,
        },
        updatedAt: new Date().toISOString(),
      };

      writeSettingsAtomic(updated);
      removeUploadedFile(existingFile);

      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Gagal menghapus file dari penyimpanan.' });
    }
  });

  // =========================================================================
  // STUDENT DATA & DAPODIK IMPORT ROUTES
  // =========================================================================

  // List students (OPERATOR sees all; GURU strictly isolated to assignedClass)
  app.get('/api/students', requireAuth, (req: AuthedRequest, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const rombel = typeof req.query.rombel === 'string' ? req.query.rombel : '';

    if (req.authUser!.role === 'GURU') {
      const assigned = classAssignment.getEffectiveAssignedClassForAccount(
        req.authUser!
      );
      if (!assigned) {
        res.json({ totalAll: 0, rombels: [], students: [] });
        return;
      }
      if (
        rombel.trim() &&
        normalizeClassKey(rombel) !== normalizeClassKey(assigned)
      ) {
        res.status(403).json({
          error: `Akses ditolak. Guru hanya dapat mengakses data siswa kelas "${assigned}".`,
        });
        return;
      }
      const classAll = studentStore.listStudents({ rombel: assigned });
      const filtered = studentStore.listStudents({ search, rombel: assigned });
      res.json({
        totalAll: classAll.students.length,
        rombels: [assigned],
        students: filtered.students,
      });
      return;
    }

    res.json(studentStore.listStudents({ search, rombel }));
  });

  // Get single student profile grouped (OPERATOR unmasked, GURU masked sensitive IDs & class isolated)
  app.get('/api/students/:id', requireAuth, (req: AuthedRequest, res) => {
    try {
      const student = studentStore.getStudentById(
        req.params.id,
        req.authUser!.role
      );
      if (req.authUser!.role === 'GURU') {
        const assigned = classAssignment.getEffectiveAssignedClassForAccount(
          req.authUser!
        );
        if (!assigned) {
          res.status(403).json({
            error: 'Anda belum memilih kelas yang dipegang di menu Profil.',
          });
          return;
        }
        if (normalizeClassKey(student.rombelSaatIni) !== normalizeClassKey(assigned)) {
          res.status(403).json({
            error: `Akses ditolak. Siswa ini berada di kelas ${student.rombelSaatIni || '-'}, sedangkan Anda hanya memegang kelas ${assigned}.`,
          });
          return;
        }
      }
      res.json({ student });
    } catch (err) {
      if (err instanceof StudentStoreError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Gagal memuat profil siswa.' });
    }
  });

  // Create student manually (OPERATOR ONLY)
  app.post(
    '/api/students',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const student = studentStore.createStudent(req.body || {});
        res.status(201).json({ student });
      } catch (err) {
        if (err instanceof StudentStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menyimpan data siswa.' });
      }
    }
  );

  // Update student (OPERATOR ONLY)
  app.put(
    '/api/students/:id',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const student = studentStore.updateStudent(req.params.id, req.body || {});
        res.json({ student });
      } catch (err) {
        if (err instanceof StudentStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memperbarui data siswa.' });
      }
    }
  );

  // Delete student (OPERATOR ONLY)
  app.delete(
    '/api/students/:id',
    requireAuth,
    requireRole('OPERATOR'),
    (req, res) => {
      try {
        studentStore.deleteStudent(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof StudentStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menghapus data siswa.' });
      }
    }
  );

  // Preview Dapodik Excel upload in memory (OPERATOR ONLY, no public storage)
  app.post(
    '/api/students/import/preview',
    requireAuth,
    requireRole('OPERATOR'),
    express.raw({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ],
      limit: '15mb',
    }),
    (req: AuthedRequest, res) => {
      const rawNameHeader = req.headers['x-filename'];
      const filename =
        typeof rawNameHeader === 'string'
          ? path.basename(decodeURIComponent(rawNameHeader))
          : 'dapodik.xlsx';

      const lower = filename.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        res
          .status(400)
          .json({ error: 'Format file tidak didukung. Gunakan file XLSX atau XLS.' });
        return;
      }

      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'File Excel kosong atau tidak terbaca.' });
        return;
      }

      try {
        pruneExpiredPreviews();
        const existing = studentStore.getAllRaw();
        const parsed = parseDapodikExcelBuffer(buffer, filename, existing);

        const previewId = crypto.randomUUID();
        importPreviewCache.set(previewId, {
          userId: req.authUser!.id,
          filename,
          rows: parsed.rows,
          expiresAt: Date.now() + 1000 * 60 * 20, // 20 minutes
        });

        res.json({
          previewId,
          filename,
          sheetName: parsed.sheetName,
          totalColumnsDetected: parsed.totalColumnsDetected,
          summary: parsed.summary,
          rows: parsed.rows.map((r) => r.preview),
        });
      } catch (err) {
        if (err instanceof DapodikParseError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memeriksa file Excel Dapodik.' });
      }
    }
  );

  // Commit previewed Dapodik import to database (OPERATOR ONLY)
  app.post(
    '/api/students/import/commit',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req: AuthedRequest, res) => {
      pruneExpiredPreviews();
      const previewId = String(req.body?.previewId ?? '').trim();
      if (!previewId) {
        res.status(400).json({ error: 'Sesi preview import tidak valid.' });
        return;
      }

      const entry = importPreviewCache.get(previewId);
      if (!entry || entry.userId !== req.authUser!.id) {
        res.status(404).json({
          error:
            'Sesi preview sudah kedaluwarsa atau tidak ditemukan. Silakan periksa ulang file Excel.',
        });
        return;
      }

      const rawMode = String(req.body?.conflictMode ?? 'INSERT_NEW_ONLY');
      const conflictMode: ImportConflictMode =
        rawMode === 'UPDATE_EXISTING' || rawMode === 'SKIP_DUPLICATES'
          ? rawMode
          : 'INSERT_NEW_ONLY';

      const rawDecisions = req.body?.perRowDecisions;
      const perRowDecisions: Record<number, RowImportDecision> = {};
      if (rawDecisions && typeof rawDecisions === 'object') {
        for (const [k, v] of Object.entries(rawDecisions as Record<string, unknown>)) {
          const rowNum = Number(k);
          if (
            Number.isInteger(rowNum) &&
            (v === 'AUTO' || v === 'INSERT' || v === 'UPDATE' || v === 'SKIP')
          ) {
            perRowDecisions[rowNum] = v;
          }
        }
      }

      try {
        const result = studentStore.commitDapodikImport({
          rows: entry.rows,
          conflictMode,
          perRowDecisions,
        });
        importPreviewCache.delete(previewId);
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Gagal menyimpan hasil import data siswa.' });
      }
    }
  );

  // =========================================================================
  // TEACHER MASTER DATA (DATA GURU) & EXCEL IMPORT/EXPORT ROUTES
  // =========================================================================

  // List teachers (OPERATOR & GURU — non-sensitive summary + login link status)
  app.get('/api/teachers', requireAuth, (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const statusKepegawaian =
      typeof req.query.statusKepegawaian === 'string'
        ? req.query.statusKepegawaian
        : '';
    const jenisPtk =
      typeof req.query.jenisPtk === 'string' ? req.query.jenisPtk : '';
    const accounts = authStore.listTeacherAccounts();
    res.json(
      teacherStore.listTeachers(
        { search, statusKepegawaian, jenisPtk },
        accounts
      )
    );
  });

  // Teacher dropdown data for Pengaturan -> Tambah Akun Guru (OPERATOR ONLY)
  app.get(
    '/api/teachers/for-account-creation',
    requireAuth,
    requireRole('OPERATOR'),
    (_req, res) => {
      const accounts = authStore.listTeacherAccounts();
      res.json({
        teachers: teacherStore.listForAccountCreation(accounts),
      });
    }
  );

  // Download Excel Template matching Daftar guru header row 5 (OPERATOR ONLY)
  app.get(
    '/api/teachers/template',
    requireAuth,
    requireRole('OPERATOR'),
    (_req, res) => {
      try {
        const settings = readSettings();
        const buffer = buildTeacherExcelWorkbookBuffer([], settings.identity);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="template-import-data-guru.xlsx"'
        );
        res.send(buffer);
      } catch {
        res.status(500).json({ error: 'Gagal membuat template Excel Data Guru.' });
      }
    }
  );

  // Export all stored Data Guru to Excel (OPERATOR ONLY)
  app.get(
    '/api/teachers/export',
    requireAuth,
    requireRole('OPERATOR'),
    (_req, res) => {
      try {
        const settings = readSettings();
        const allTeachers = teacherStore.getAllRaw();
        const buffer = buildTeacherExcelWorkbookBuffer(
          allTeachers,
          settings.identity
        );
        const safeSchool = (settings.identity.schoolName || 'sekolah')
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase();
        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="data-guru-${safeSchool || 'sekolah'}-${dateStr}.xlsx"`
        );
        res.send(buffer);
      } catch {
        res.status(500).json({ error: 'Gagal mengekspor data guru ke Excel.' });
      }
    }
  );

  // Preview uploaded Teacher Excel file in memory (OPERATOR ONLY)
  app.post(
    '/api/teachers/import/preview',
    requireAuth,
    requireRole('OPERATOR'),
    express.raw({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ],
      limit: '15mb',
    }),
    (req: AuthedRequest, res) => {
      const rawNameHeader = req.headers['x-filename'];
      const filename =
        typeof rawNameHeader === 'string'
          ? path.basename(decodeURIComponent(rawNameHeader))
          : 'daftar-guru.xlsx';

      const lower = filename.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        res.status(400).json({
          error: 'Format file tidak didukung. Gunakan file Excel (.xlsx / .xls).',
        });
        return;
      }

      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'File Excel kosong atau tidak terbaca.' });
        return;
      }

      try {
        pruneExpiredPreviews();
        const existing = teacherStore.getAllRaw();
        const parsed = parseTeacherExcelBuffer(buffer, filename, existing);

        const previewId = crypto.randomUUID();
        teacherImportPreviewCache.set(previewId, {
          userId: req.authUser!.id,
          filename,
          rows: parsed.rows,
          expiresAt: Date.now() + 1000 * 60 * 20, // 20 minutes
        });

        res.json({
          previewId,
          filename,
          sheetName: parsed.sheetName,
          headerRowNumber: parsed.headerRowNumber,
          detectedColumns: parsed.detectedColumns,
          summary: parsed.summary,
          rows: parsed.rows.map((r) => r.preview),
        });
      } catch (err) {
        if (err instanceof TeacherExcelParseError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memeriksa file Excel Data Guru.' });
      }
    }
  );

  // Commit previewed Teacher Excel import to server database (OPERATOR ONLY)
  app.post(
    '/api/teachers/import/commit',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req: AuthedRequest, res) => {
      pruneExpiredPreviews();
      const previewId = String(req.body?.previewId ?? '').trim();
      if (!previewId) {
        res.status(400).json({ error: 'Sesi preview import guru tidak valid.' });
        return;
      }

      const entry = teacherImportPreviewCache.get(previewId);
      if (!entry || entry.userId !== req.authUser!.id) {
        res.status(404).json({
          error:
            'Sesi preview sudah kedaluwarsa atau tidak ditemukan. Silakan periksa ulang file Excel.',
        });
        return;
      }

      const rawMode = String(req.body?.conflictMode ?? 'SKIP_EXISTING');
      const conflictMode: TeacherImportConflictMode =
        rawMode === 'UPDATE_EXISTING' || rawMode === 'INSERT_NEW_ONLY'
          ? rawMode
          : 'SKIP_EXISTING';

      const rawDecisions = req.body?.perRowDecisions;
      const perRowDecisions: Record<number, TeacherRowImportDecision> = {};
      if (rawDecisions && typeof rawDecisions === 'object') {
        for (const [k, v] of Object.entries(rawDecisions as Record<string, unknown>)) {
          const rowNum = Number(k);
          if (
            Number.isInteger(rowNum) &&
            (v === 'AUTO' || v === 'INSERT' || v === 'UPDATE' || v === 'SKIP')
          ) {
            perRowDecisions[rowNum] = v;
          }
        }
      }

      try {
        const result = teacherStore.commitTeacherImport({
          rows: entry.rows,
          conflictMode,
          perRowDecisions,
        });
        teacherImportPreviewCache.delete(previewId);
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Gagal menyimpan hasil import data guru.' });
      }
    }
  );

  // Download Excel Report from an import result (OPERATOR ONLY)
  app.post(
    '/api/teachers/import/report',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '2mb' }),
    (req, res) => {
      try {
        const body = (req.body || {}) as Partial<TeacherImportCommitResult>;
        const report: TeacherImportCommitResult = {
          totalProcessed: Number(body.totalProcessed) || 0,
          importedCount: Number(body.importedCount) || 0,
          updatedCount: Number(body.updatedCount) || 0,
          skippedCount: Number(body.skippedCount) || 0,
          failedCount: Number(body.failedCount) || 0,
          failures: Array.isArray(body.failures) ? body.failures : [],
        };
        const buffer = buildTeacherImportReportBuffer(report);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="laporan-import-data-guru.xlsx"'
        );
        res.send(buffer);
      } catch {
        res.status(500).json({ error: 'Gagal membuat file laporan import guru.' });
      }
    }
  );

  // Get single teacher profile (OPERATOR unmasked, GURU masked NIK/KK/NPWP/Rekening)
  app.get('/api/teachers/:id', requireAuth, (req: AuthedRequest, res) => {
    try {
      const accounts = authStore.listTeacherAccounts();
      const teacher = teacherStore.getTeacherById(
        req.params.id,
        req.authUser!.role,
        accounts
      );
      res.json({ teacher });
    } catch (err) {
      if (err instanceof TeacherStoreError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Gagal memuat detail data guru.' });
    }
  });

  // Create teacher manually (OPERATOR ONLY)
  app.post(
    '/api/teachers',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const body = req.body || {};
        if (body.assignedClass) {
          classAssignment.assertClassClaimAvailable({
            nextClassRaw: String(body.assignedClass ?? ''),
            actorNip: String(body.nip ?? ''),
            actorName: String(body.nama ?? ''),
          });
        }
        let teacher = teacherStore.createTeacher(body);
        if (teacher.assignedClass) {
          teacher = classAssignment.assignClassToTeacher(
            teacher.id,
            teacher.assignedClass
          );
        }
        res.status(201).json({ teacher });
      } catch (err) {
        if (err instanceof ClassAssignmentError || err instanceof TeacherStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menyimpan data guru.' });
      }
    }
  );

  // Update teacher manually (OPERATOR ONLY)
  app.put(
    '/api/teachers/:id',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const body = req.body || {};
        if (body.assignedClass !== undefined) {
          classAssignment.assertClassClaimAvailable({
            nextClassRaw: String(body.assignedClass ?? ''),
            actorTeacherId: req.params.id,
            actorNip: String(body.nip ?? ''),
            actorName: String(body.nama ?? ''),
          });
        }
        let teacher = teacherStore.updateTeacher(req.params.id, body);
        if (body.assignedClass !== undefined) {
          teacher = classAssignment.assignClassToTeacher(
            req.params.id,
            String(body.assignedClass ?? '')
          );
        }
        res.json({ teacher });
      } catch (err) {
        if (err instanceof ClassAssignmentError || err instanceof TeacherStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memperbarui data guru.' });
      }
    }
  );

  // Delete teacher record (OPERATOR ONLY)
  app.delete(
    '/api/teachers/:id',
    requireAuth,
    requireRole('OPERATOR'),
    (req, res) => {
      try {
        classAssignment.cleanupOnTeacherDelete(req.params.id);
        teacherStore.deleteTeacher(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof TeacherStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menghapus data guru.' });
      }
    }
  );

  // Link Data Induk Guru with an existing Akun Login Guru using validated NIP (OPERATOR ONLY)
  app.post(
    '/api/teachers/:id/link-account',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const accountId =
          typeof req.body?.accountId === 'string' && req.body.accountId.trim()
            ? req.body.accountId.trim()
            : null;
        const accounts = authStore.listTeacherAccounts();
        const account = accountId
          ? accounts.find((a) => a.id === accountId) || null
          : null;
        if (accountId && !account) {
          res.status(404).json({ error: 'Akun login guru tidak ditemukan.' });
          return;
        }

        classAssignment.validateLinkCompatibilityBeforeLink(
          req.params.id,
          accountId
        );

        const updatedTeacher = teacherStore.setLinkedAccountId(
          req.params.id,
          account
        );
        if (account) {
          authStore.linkAccountToTeacherRecord(account.id, updatedTeacher.id);
          classAssignment.syncAfterAccountLinking(updatedTeacher.id, account.id);
        }
        const refreshedTeacher = teacherStore.getTeacherById(
          updatedTeacher.id,
          'OPERATOR',
          authStore.listTeacherAccounts()
        );
        res.json({ teacher: refreshedTeacher });
      } catch (err) {
        if (
          err instanceof ClassAssignmentError ||
          err instanceof TeacherStoreError ||
          err instanceof AuthError
        ) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menghubungkan akun login guru.' });
      }
    }
  );

  // =========================================================================
  // OFFICIAL SCHOOL LETTERS & ARCHIVE (PERSURATAN) ROUTES (OPERATOR ONLY)
  // =========================================================================

  app.get('/api/letters', requireAuth, requireRole('OPERATOR'), (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    res.json(letterStore.listLetters({ type, search }));
  });

  app.get('/api/letters/:id', requireAuth, requireRole('OPERATOR'), (req, res) => {
    try {
      const letter = letterStore.getLetterById(req.params.id);
      res.json({ letter });
    } catch (err) {
      if (err instanceof LetterStoreError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Gagal memuat arsip surat.' });
    }
  });

  app.post(
    '/api/letters',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const letter = letterStore.createLetter(req.body || {});
        res.status(201).json({ letter });
      } catch (err) {
        if (err instanceof LetterStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menyimpan surat ke arsip.' });
      }
    }
  );

  app.put(
    '/api/letters/:id',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '1mb' }),
    (req, res) => {
      try {
        const letter = letterStore.updateLetter(req.params.id, req.body || {});
        res.json({ letter });
      } catch (err) {
        if (err instanceof LetterStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal memperbarui arsip surat.' });
      }
    }
  );

  app.delete(
    '/api/letters/:id',
    requireAuth,
    requireRole('OPERATOR'),
    (req, res) => {
      try {
        letterStore.deleteLetter(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof LetterStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menghapus arsip surat.' });
      }
    }
  );

  // =========================================================================
  // STUDENT ATTENDANCE (ABSEN SISWA) & EXCEL EXPORT ROUTES (OPERATOR & GURU)
  // =========================================================================

  function buildAttendanceResponse(
    reqRombel: string,
    reqDate: string,
    forcedRombel?: string
  ): AttendanceSheetResponse {
    const settings = readSettings();
    const context: AttendanceContextInfo = {
      schoolName: settings.identity.schoolName,
      city: settings.identity.city,
      department: settings.identity.department,
      academicYear: settings.identity.academicYear,
      principalName: settings.principal.name,
      principalPosition: settings.principal.position,
      principalNip: settings.principal.nip,
      logoUrl: settings.files.logo?.url ?? null,
      kopUrl: settings.files.kop?.url ?? null,
    };

    const today = new Date();
    const fallbackDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(reqDate.trim())
      ? reqDate.trim()
      : fallbackDate;

    if (forcedRombel !== undefined && !forcedRombel.trim()) {
      return {
        context,
        rombels: [],
        selectedRombel: '',
        date,
        sheetId: null,
        waliKelas: {
          rombel: '',
          teacherId: null,
          teacherName: '',
          teacherNip: '',
        },
        students: [],
        summary: {
          total: 0,
          male: 0,
          female: 0,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
          unmarked: 0,
        },
        savedDatesForRombel: [],
      };
    }

    const allRawStudents = studentStore.getAllRaw();
    const rombelSet = new Set<string>();
    for (const s of allRawStudents) {
      if (s.rombelSaatIni?.trim()) {
        rombelSet.add(s.rombelSaatIni.trim());
      }
    }
    const allRombels = Array.from(rombelSet).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );

    const rombels =
      forcedRombel !== undefined ? [forcedRombel.trim()] : allRombels;

    const selectedRombel =
      forcedRombel !== undefined
        ? forcedRombel.trim()
        : reqRombel.trim()
          ? reqRombel.trim()
          : rombels[0] || '';

    const { sheet, homeroom, savedDatesForRombel } = attendanceStore.getSheet(
      date,
      selectedRombel
    );

    const selectedKey = normalizeClassKey(selectedRombel);
    const classStudents = allRawStudents
      .filter((s) =>
        selectedKey
          ? normalizeClassKey(s.rombelSaatIni) === selectedKey
          : true
      )
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

    let male = 0;
    let female = 0;
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;
    let unmarked = 0;

    const rows: AttendanceStudentRow[] = classStudents.map((s, idx) => {
      const jkClean = (s.jk || '').trim().toUpperCase();
      if (jkClean === 'L') male++;
      if (jkClean === 'P') female++;

      const entry = sheet?.entries?.[s.id];
      const status = entry?.status ?? '';
      if (status === 'H') hadir++;
      else if (status === 'S') sakit++;
      else if (status === 'I') izin++;
      else if (status === 'A') alpa++;
      else unmarked++;

      return {
        id: s.id,
        noUrut: idx + 1,
        nisn: s.nisn || '',
        nipd: s.nipd || '',
        nama: s.nama || '',
        jk: jkClean,
        rombelSaatIni: s.rombelSaatIni || '',
        status,
        note: entry?.note ?? '',
      };
    });

    const effectiveWaliKelas =
      sheet && (sheet.waliKelasName || sheet.waliKelasId)
        ? {
            rombel: selectedRombel,
            teacherId: sheet.waliKelasId,
            teacherName: sheet.waliKelasName,
            teacherNip: sheet.waliKelasNip,
          }
        : homeroom;

    return {
      context,
      rombels,
      selectedRombel,
      date,
      sheetId: sheet?.id ?? null,
      waliKelas: effectiveWaliKelas,
      students: rows,
      summary: {
        total: rows.length,
        male,
        female,
        hadir,
        sakit,
        izin,
        alpa,
        unmarked,
      },
      savedDatesForRombel,
    };
  }

  app.get('/api/attendance', requireAuth, (req: AuthedRequest, res) => {
    try {
      const rombel = typeof req.query.rombel === 'string' ? req.query.rombel : '';
      const date = typeof req.query.date === 'string' ? req.query.date : '';

      if (req.authUser!.role === 'GURU') {
        const assigned = classAssignment.getEffectiveAssignedClassForAccount(
          req.authUser!
        );
        if (
          assigned &&
          rombel.trim() &&
          normalizeClassKey(rombel) !== normalizeClassKey(assigned)
        ) {
          res.status(403).json({
            error: `Akses ditolak. Guru hanya dapat membuka absensi kelas "${assigned}".`,
          });
          return;
        }
        res.json(buildAttendanceResponse(assigned, date, assigned));
        return;
      }

      res.json(buildAttendanceResponse(rombel, date));
    } catch {
      res.status(500).json({ error: 'Gagal memuat data absensi siswa.' });
    }
  });

  app.put(
    '/api/attendance',
    requireAuth,
    express.json({ limit: '2mb' }),
    (req: AuthedRequest, res) => {
      try {
        const body = req.body || {};
        const reqRombel = String(body.rombel ?? '').trim();

        if (req.authUser!.role === 'GURU') {
          const assigned = classAssignment.getEffectiveAssignedClassForAccount(
            req.authUser!
          );
          if (!assigned) {
            res.status(403).json({
              error: 'Anda belum memilih kelas yang dipegang di menu Profil.',
            });
            return;
          }
          if (normalizeClassKey(reqRombel) !== normalizeClassKey(assigned)) {
            res.status(403).json({
              error: `Akses ditolak. Guru hanya dapat menyimpan absensi kelas "${assigned}".`,
            });
            return;
          }
          const existingSheetInfo = attendanceStore.getSheet(
            String(body.date ?? ''),
            assigned
          );
          const result = attendanceStore.saveSheet({
            date: String(body.date ?? ''),
            rombel: assigned,
            waliKelasId:
              existingSheetInfo.homeroom.teacherId ??
              req.authUser!.teacherRecordId ??
              req.authUser!.id,
            waliKelasName:
              existingSheetInfo.homeroom.teacherName || req.authUser!.fullName,
            waliKelasNip:
              existingSheetInfo.homeroom.teacherNip || req.authUser!.nip,
            entries: body.entries || {},
            updatedBy: req.authUser!.fullName || req.authUser!.username || 'Guru',
          });
          res.json(result);
          return;
        }

        // Operator: validate wali kelas does not conflict with 1-guru-1-kelas
        if (reqRombel && (body.waliKelasId || String(body.waliKelasName ?? '').trim())) {
          classAssignment.assignHomeroomByOperator({
            rombel: reqRombel,
            teacherId: body.waliKelasId ?? null,
            teacherName: String(body.waliKelasName ?? ''),
            teacherNip: String(body.waliKelasNip ?? ''),
          });
        }

        const canonicalRombel = classAssignment.resolveCanonicalClassName(reqRombel);
        const result = attendanceStore.saveSheet({
          date: String(body.date ?? ''),
          rombel: canonicalRombel,
          waliKelasId: body.waliKelasId ?? null,
          waliKelasName: String(body.waliKelasName ?? ''),
          waliKelasNip: String(body.waliKelasNip ?? ''),
          entries: body.entries || {},
          updatedBy: req.authUser?.fullName || req.authUser?.username || 'Pengguna',
        });
        res.json(result);
      } catch (err) {
        if (
          err instanceof ClassAssignmentError ||
          err instanceof AttendanceStoreError
        ) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menyimpan absensi siswa.' });
      }
    }
  );

  app.put(
    '/api/attendance/homeroom',
    requireAuth,
    requireRole('OPERATOR'),
    express.json({ limit: '512kb' }),
    (req, res) => {
      try {
        const body = req.body || {};
        const homeroom = classAssignment.assignHomeroomByOperator({
          rombel: String(body.rombel ?? ''),
          teacherId: body.teacherId ?? null,
          teacherName: String(body.teacherName ?? ''),
          teacherNip: String(body.teacherNip ?? ''),
        });
        res.json({ homeroom });
      } catch (err) {
        if (
          err instanceof ClassAssignmentError ||
          err instanceof AttendanceStoreError
        ) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menyimpan data wali kelas.' });
      }
    }
  );

  const WEEKDAY_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  function buildMonthlyAttendanceResponse(
    reqRombel: string,
    reqMonth: string,
    schoolDaysMode: MonthlySchoolDaysMode,
    forcedRombel?: string
  ): MonthlyAttendanceResponse {
    const settings = readSettings();
    const context: AttendanceContextInfo = {
      schoolName: settings.identity.schoolName,
      city: settings.identity.city,
      department: settings.identity.department,
      academicYear: settings.identity.academicYear,
      principalName: settings.principal.name,
      principalPosition: settings.principal.position,
      principalNip: settings.principal.nip,
      logoUrl: settings.files.logo?.url ?? null,
      kopUrl: settings.files.kop?.url ?? null,
    };

    const now = new Date();
    const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(reqMonth.trim())
      ? reqMonth.trim()
      : fallbackMonth;

    if (forcedRombel !== undefined && !forcedRombel.trim()) {
      return {
        context,
        rombels: [],
        selectedRombel: '',
        month,
        schoolDaysMode,
        waliKelas: {
          rombel: '',
          teacherId: null,
          teacherName: '',
          teacherNip: '',
        },
        days: [],
        students: [],
        summary: {
          totalStudents: 0,
          male: 0,
          female: 0,
          activeDaysCount: 0,
          totalHadir: 0,
          totalSakit: 0,
          totalIzin: 0,
          totalAlpa: 0,
        },
      };
    }

    const allRawStudents = studentStore.getAllRaw();
    const rombelSet = new Set<string>();
    for (const s of allRawStudents) {
      if (s.rombelSaatIni?.trim()) {
        rombelSet.add(s.rombelSaatIni.trim());
      }
    }
    const allRombels = Array.from(rombelSet).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );

    const rombels =
      forcedRombel !== undefined ? [forcedRombel.trim()] : allRombels;
    const selectedRombel =
      forcedRombel !== undefined
        ? forcedRombel.trim()
        : reqRombel.trim()
          ? reqRombel.trim()
          : rombels[0] || '';

    const { homeroom, sheetsByDate } = attendanceStore.getMonthlySheets(
      month,
      selectedRombel
    );

    const [yearStr, monthStr] = month.split('-');
    const yearNum = Number.parseInt(yearStr, 10);
    const monthNum = Number.parseInt(monthStr, 10);
    const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();

    const days: MonthlyDayInfo[] = [];
    let activeDaysCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = `${month}-${String(day).padStart(2, '0')}`;
      const weekday = new Date(Date.UTC(yearNum, monthNum - 1, day)).getUTCDay();
      const sheetForDay = sheetsByDate[dateIso];
      const hasSavedSheet = Boolean(sheetForDay);
      const hasRecordedAbsenceOrPresent =
        Boolean(sheetForDay) &&
        Object.values(sheetForDay.entries || {}).some(
          (e) =>
            e.status === 'H' ||
            e.status === 'S' ||
            e.status === 'I' ||
            e.status === 'A'
        );

      let isHoliday = false;
      if (schoolDaysMode === '5') {
        isHoliday = (weekday === 0 || weekday === 6) && !hasRecordedAbsenceOrPresent;
      } else if (schoolDaysMode === '6') {
        isHoliday = weekday === 0 && !hasRecordedAbsenceOrPresent;
      }
      if (!isHoliday) activeDaysCount++;

      days.push({
        day,
        date: dateIso,
        weekday,
        weekdayShort: WEEKDAY_SHORT_ID[weekday] || '',
        isHoliday,
        hasSavedSheet,
      });
    }

    const selectedKey = normalizeClassKey(selectedRombel);
    const classStudents = allRawStudents
      .filter((s) =>
        selectedKey
          ? normalizeClassKey(s.rombelSaatIni) === selectedKey
          : true
      )
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

    let male = 0;
    let female = 0;
    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlpa = 0;

    const rows: MonthlyAttendanceStudentRow[] = classStudents.map((s, idx) => {
      const jkClean = (s.jk || '').trim().toUpperCase();
      if (jkClean === 'L') male++;
      if (jkClean === 'P') female++;

      const statuses: Record<string, MonthlyCellStatus> = {};
      const notes: Record<string, string> = {};
      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alpa = 0;

      for (const d of days) {
        const entry = sheetsByDate[d.date]?.entries?.[s.id];
        const rawStatus = entry?.status ?? '';
        let cellStatus: MonthlyCellStatus;
        if (rawStatus === 'S' || rawStatus === 'I' || rawStatus === 'A') {
          cellStatus = rawStatus;
        } else if (d.isHoliday) {
          cellStatus = 'LIBUR';
        } else {
          // Default Hadir when no Sakit / Izin / Alpa note exists
          cellStatus = 'H';
        }

        statuses[d.date] = cellStatus;
        if (entry?.note) {
          notes[d.date] = entry.note;
        }

        if (cellStatus === 'H') {
          hadir++;
          totalHadir++;
        } else if (cellStatus === 'S') {
          sakit++;
          totalSakit++;
        } else if (cellStatus === 'I') {
          izin++;
          totalIzin++;
        } else if (cellStatus === 'A') {
          alpa++;
          totalAlpa++;
        }
      }

      return {
        id: s.id,
        noUrut: idx + 1,
        nisn: s.nisn || '',
        nipd: s.nipd || '',
        nama: s.nama || '',
        jk: jkClean,
        rombelSaatIni: s.rombelSaatIni || '',
        statuses,
        notes,
        totals: {
          hadir,
          sakit,
          izin,
          alpa,
        },
      };
    });

    return {
      context,
      rombels,
      selectedRombel,
      month,
      schoolDaysMode,
      waliKelas: homeroom,
      days,
      students: rows,
      summary: {
        totalStudents: rows.length,
        male,
        female,
        activeDaysCount,
        totalHadir,
        totalSakit,
        totalIzin,
        totalAlpa,
      },
    };
  }

  app.get('/api/attendance/monthly', requireAuth, (req: AuthedRequest, res) => {
    try {
      const rombel = typeof req.query.rombel === 'string' ? req.query.rombel : '';
      const month = typeof req.query.month === 'string' ? req.query.month : '';
      const rawDays = typeof req.query.schoolDays === 'string' ? req.query.schoolDays : '5';
      const schoolDaysMode: MonthlySchoolDaysMode =
        rawDays === '6' || rawDays === '7' ? rawDays : '5';

      if (req.authUser!.role === 'GURU') {
        const assigned = classAssignment.getEffectiveAssignedClassForAccount(
          req.authUser!
        );
        if (
          assigned &&
          rombel.trim() &&
          normalizeClassKey(rombel) !== normalizeClassKey(assigned)
        ) {
          res.status(403).json({
            error: `Akses ditolak. Guru hanya dapat membuka rekap absensi kelas "${assigned}".`,
          });
          return;
        }
        res.json(
          buildMonthlyAttendanceResponse(assigned, month, schoolDaysMode, assigned)
        );
        return;
      }

      res.json(buildMonthlyAttendanceResponse(rombel, month, schoolDaysMode));
    } catch {
      res.status(500).json({ error: 'Gagal memuat rekap absensi bulanan.' });
    }
  });

  app.put(
    '/api/attendance/monthly',
    requireAuth,
    express.json({ limit: '2mb' }),
    (req: AuthedRequest, res) => {
      try {
        const body = req.body || {};
        const reqRombel = String(body.rombel ?? '').trim();
        let targetRombel = reqRombel;

        if (req.authUser!.role === 'GURU') {
          const assigned = classAssignment.getEffectiveAssignedClassForAccount(
            req.authUser!
          );
          if (!assigned) {
            res.status(403).json({
              error: 'Anda belum memilih kelas yang dipegang di menu Profil.',
            });
            return;
          }
          if (reqRombel && normalizeClassKey(reqRombel) !== normalizeClassKey(assigned)) {
            res.status(403).json({
              error: `Akses ditolak. Guru hanya dapat menyimpan absensi kelas "${assigned}".`,
            });
            return;
          }
          targetRombel = assigned;
        } else {
          targetRombel = classAssignment.resolveCanonicalClassName(reqRombel);
        }

        if (!targetRombel) {
          res.status(400).json({ error: 'Kelas / Rombel wajib dipilih.' });
          return;
        }

        const changes = Array.isArray(body.changes) ? body.changes : [];
        if (changes.length === 0) {
          res.status(400).json({ error: 'Tidak ada perubahan absensi untuk disimpan.' });
          return;
        }

        const updatedBy =
          req.authUser?.fullName || req.authUser?.username || 'Pengguna';
        for (const ch of changes) {
          if (!ch || typeof ch !== 'object') continue;
          attendanceStore.patchSheetEntries({
            date: String((ch as { date?: unknown }).date ?? ''),
            rombel: targetRombel,
            entries: ((ch as { entries?: unknown }).entries ?? {}) as Record<string, any>,
            updatedBy,
          });
        }

        res.json({ ok: true, updatedDates: changes.length });
      } catch (err) {
        if (
          err instanceof ClassAssignmentError ||
          err instanceof AttendanceStoreError
        ) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menyimpan perubahan rekap bulanan.' });
      }
    }
  );

  app.get('/api/attendance/monthly/export/excel', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rombel = typeof req.query.rombel === 'string' ? req.query.rombel : '';
      const month = typeof req.query.month === 'string' ? req.query.month : '';
      const rawDays = typeof req.query.schoolDays === 'string' ? req.query.schoolDays : '5';
      const schoolDaysMode: MonthlySchoolDaysMode =
        rawDays === '6' || rawDays === '7' ? rawDays : '5';

      let data: MonthlyAttendanceResponse;
      if (req.authUser!.role === 'GURU') {
        const assigned = classAssignment.getEffectiveAssignedClassForAccount(
          req.authUser!
        );
        if (!assigned) {
          res.status(403).json({
            error: 'Anda belum memilih kelas yang dipegang di menu Profil.',
          });
          return;
        }
        if (rombel.trim() && normalizeClassKey(rombel) !== normalizeClassKey(assigned)) {
          res.status(403).json({
            error: `Akses ditolak. Guru hanya dapat mengekspor rekap absensi kelas "${assigned}".`,
          });
          return;
        }
        data = buildMonthlyAttendanceResponse(assigned, month, schoolDaysMode, assigned);
      } else {
        data = buildMonthlyAttendanceResponse(rombel, month, schoolDaysMode);
      }

      const buffer = await buildMonthlyAttendanceExcelBuffer(data);
      const safeRombel = (data.selectedRombel || 'semua')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const filename = `rekap-absen-${safeRombel || 'kelas'}-${data.month}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(buffer);
    } catch {
      res.status(500).json({ error: 'Gagal membuat file Excel rekap bulanan.' });
    }
  });

  app.get('/api/attendance/export/excel', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rombel = typeof req.query.rombel === 'string' ? req.query.rombel : '';
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      const rawMode =
        typeof req.query.ketMode === 'string'
          ? req.query.ketMode
          : typeof req.query.anakMode === 'string'
            ? req.query.anakMode
            : 'STATUS_KET';
      const ketMode: AttendanceKetColumnMode =
        rawMode === 'NOTE_ONLY' || rawMode === 'KOSONG'
          ? rawMode
          : 'STATUS_KET';

      let data: AttendanceSheetResponse;
      if (req.authUser!.role === 'GURU') {
        const assigned = classAssignment.getEffectiveAssignedClassForAccount(
          req.authUser!
        );
        if (!assigned) {
          res.status(403).json({
            error: 'Anda belum memilih kelas yang dipegang di menu Profil.',
          });
          return;
        }
        if (rombel.trim() && normalizeClassKey(rombel) !== normalizeClassKey(assigned)) {
          res.status(403).json({
            error: `Akses ditolak. Guru hanya dapat mengekspor absensi kelas "${assigned}".`,
          });
          return;
        }
        data = buildAttendanceResponse(assigned, date, assigned);
      } else {
        data = buildAttendanceResponse(rombel, date);
      }

      const buffer = await buildAttendanceExcelBuffer({
        context: data.context,
        rombel: data.selectedRombel,
        date: data.date,
        waliKelas: data.waliKelas,
        students: data.students,
        ketMode,
      });

      const safeRombel = (data.selectedRombel || 'semua')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const filename = `absen-siswa-${safeRombel || 'kelas'}-${data.date}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(buffer);
    } catch {
      res.status(500).json({ error: 'Gagal membuat file Excel absensi siswa.' });
    }
  });

  app.delete(
    '/api/attendance/:id',
    requireAuth,
    requireRole('OPERATOR'),
    (req, res) => {
      try {
        attendanceStore.deleteSheet(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof AttendanceStoreError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Gagal menghapus catatan absensi.' });
      }
    }
  );

  // =========================================================================
  // CLOUD FIRESTORE SYNC SNAPSHOT & NON-DESTRUCTIVE RESTORE ROUTES
  // =========================================================================

  app.get('/api/sync/snapshot', requireAuth, requireRole('OPERATOR'), (_req, res) => {
    try {
      const settings = readSettings();
      const assets: Array<{
        slot: SchoolFileSlot;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        dataUrl: string;
      }> = [];

      for (const slot of VALID_SLOTS) {
        const meta = settings.files[slot];
        if (!meta?.filename) continue;
        const safeName = path.basename(meta.filename);
        const fullPath = path.resolve(UPLOADS_DIR, safeName);
        if (!fullPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(fullPath)) {
          continue;
        }
        try {
          const buf = fs.readFileSync(fullPath);
          const mime = MIME_TO_EXT[meta.mimeType] ? meta.mimeType : 'image/png';
          const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          if (dataUrl.length <= 900_000) {
            assets.push({
              slot,
              filename: safeName,
              originalName: meta.originalName || safeName,
              mimeType: mime,
              size: buf.length,
              dataUrl,
            });
          }
        } catch {
          // Skip unreadable file
        }
      }

      res.json({
        settings,
        assets,
        accounts: authStore.exportRawUsers(),
        students: studentStore.getAllRaw(),
        teachers: teacherStore.getAllRaw(),
        letters: letterStore.getAllRaw(),
        attendance: attendanceStore.getAllRaw(),
      });
    } catch {
      res.status(500).json({ error: 'Gagal menyiapkan snapshot data sekolah.' });
    }
  });

  app.post('/api/sync/restore', express.json({ limit: '25mb' }), (req, res) => {
    try {
      const hasOperator = authStore.hasAnyOperator();
      if (hasOperator) {
        const token = extractToken(req);
        const user = authStore.getUserFromToken(token);
        if (!user) {
          res.status(401).json({
            error: 'Sesi tidak valid. Silakan login sebagai Operator untuk memulihkan data.',
          });
          return;
        }
        if (user.role !== 'OPERATOR') {
          res.status(403).json({
            error: 'Akses ditolak. Hanya Operator yang dapat memulihkan snapshot data.',
          });
          return;
        }
      }

      ensureStorageDirs();
      const body = (req.body || {}) as {
        settings?: Partial<SchoolSettings>;
        assets?: Array<{
          slot?: string;
          filename?: string;
          originalName?: string;
          mimeType?: string;
          size?: number;
          dataUrl?: string;
        }>;
        accounts?: unknown[];
        students?: unknown[];
        teachers?: unknown[];
        letters?: unknown[];
        attendance?: {
          homerooms?: Record<string, any>;
          sheets?: unknown[];
        };
      };

      const restoredFiles: Partial<Record<SchoolFileSlot, StoredFileMeta>> = {};
      if (Array.isArray(body.assets)) {
        for (const asset of body.assets) {
          if (!asset || typeof asset !== 'object') continue;
          const slot = String(asset.slot ?? '');
          if (!isValidSlot(slot)) continue;
          const dataUrl = String(asset.dataUrl ?? '');
          const match = /^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/.exec(
            dataUrl
          );
          if (!match) continue;

          const mimeType = match[1];
          const ext = MIME_TO_EXT[mimeType] || 'png';
          const rawFilename = String(asset.filename ?? `${slot}.${ext}`);
          const safeBase = path
            .basename(rawFilename)
            .replace(/[^a-zA-Z0-9._-]/g, '_');
          const safeFilename = safeBase || `${slot}.${ext}`;
          const destPath = path.resolve(UPLOADS_DIR, safeFilename);
          if (!destPath.startsWith(UPLOADS_DIR + path.sep)) continue;

          const buffer = Buffer.from(match[2], 'base64');
          if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) continue;

          fs.writeFileSync(destPath, buffer);
          restoredFiles[slot] = {
            slot,
            filename: safeFilename,
            originalName: String(asset.originalName ?? safeFilename).slice(0, 200),
            mimeType,
            size: buffer.length,
            url: `/uploads/${safeFilename}`,
            updatedAt: new Date().toISOString(),
          };
        }
      }

      let settingsUpdated = false;
      const currentSettings = readSettings();
      const incomingSettings = body.settings;
      if (incomingSettings && typeof incomingSettings === 'object') {
        const localTime = currentSettings.updatedAt
          ? Date.parse(currentSettings.updatedAt) || 0
          : 0;
        const incomingTime = incomingSettings.updatedAt
          ? Date.parse(incomingSettings.updatedAt) || 0
          : 0;
        const localIsEmpty =
          !currentSettings.identity.schoolName &&
          !currentSettings.identity.city &&
          !currentSettings.identity.department &&
          !currentSettings.principal.name &&
          !currentSettings.operator.name;

        const nextFiles = { ...currentSettings.files };
        for (const slot of VALID_SLOTS) {
          if (!nextFiles[slot] && restoredFiles[slot]) {
            nextFiles[slot] = restoredFiles[slot]!;
            settingsUpdated = true;
          }
        }

        if (localIsEmpty || incomingTime > localTime) {
          const mergedSettings: SchoolSettings = {
            identity: {
              schoolName: String(
                incomingSettings.identity?.schoolName ??
                  currentSettings.identity.schoolName
              ),
              city: String(
                incomingSettings.identity?.city ?? currentSettings.identity.city
              ),
              department: String(
                incomingSettings.identity?.department ??
                  currentSettings.identity.department
              ),
              academicYear: String(
                incomingSettings.identity?.academicYear ??
                  currentSettings.identity.academicYear
              ),
            },
            principal: {
              name: String(
                incomingSettings.principal?.name ??
                  currentSettings.principal.name
              ),
              position: String(
                incomingSettings.principal?.position ??
                  currentSettings.principal.position
              ),
              nip: String(
                incomingSettings.principal?.nip ??
                  currentSettings.principal.nip
              ),
            },
            operator: {
              name: String(
                incomingSettings.operator?.name ?? currentSettings.operator.name
              ),
              position: String(
                incomingSettings.operator?.position ??
                  currentSettings.operator.position
              ),
              nip: String(
                incomingSettings.operator?.nip ?? currentSettings.operator.nip
              ),
            },
            files: {
              logo: restoredFiles.logo ?? nextFiles.logo,
              kop: restoredFiles.kop ?? nextFiles.kop,
              ttd: restoredFiles.ttd ?? nextFiles.ttd,
              stempel: restoredFiles.stempel ?? nextFiles.stempel,
            },
            updatedAt:
              incomingSettings.updatedAt ||
              currentSettings.updatedAt ||
              new Date().toISOString(),
          };
          writeSettingsAtomic(mergedSettings);
          settingsUpdated = true;
        } else if (settingsUpdated) {
          writeSettingsAtomic({
            ...currentSettings,
            files: nextFiles,
            updatedAt: currentSettings.updatedAt || new Date().toISOString(),
          });
        }
      } else if (Object.keys(restoredFiles).length > 0) {
        const nextFiles = { ...currentSettings.files };
        for (const slot of VALID_SLOTS) {
          if (!nextFiles[slot] && restoredFiles[slot]) {
            nextFiles[slot] = restoredFiles[slot]!;
            settingsUpdated = true;
          }
        }
        if (settingsUpdated) {
          writeSettingsAtomic({
            ...currentSettings,
            files: nextFiles,
            updatedAt: currentSettings.updatedAt || new Date().toISOString(),
          });
        }
      }

      const accountsResult = authStore.restoreRawUsers(body.accounts || []);
      const studentsResult = studentStore.restoreRawStudents(body.students || []);
      const teachersResult = teacherStore.restoreRawTeachers(body.teachers || []);
      const lettersResult = letterStore.restoreRawLetters(body.letters || []);
      const attendanceResult = attendanceStore.restoreRawAttendance(
        body.attendance || {}
      );

      res.json({
        ok: true,
        settingsUpdated,
        accounts: accountsResult,
        students: studentsResult,
        teachers: teachersResult,
        letters: lettersResult,
        attendance: attendanceResult,
      });
    } catch {
      res.status(500).json({ error: 'Gagal memulihkan data sekolah dari database online.' });
    }
  });

  // Ensure unknown /api routes always return JSON instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // Ensure middleware/body-parser errors on /api always return JSON instead of Express HTML
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : typeof (err as { statusCode?: number })?.statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
    const message =
      status === 413
        ? 'Ukuran file atau data melebihi batas maksimal 10 MB.'
        : status === 400
          ? 'Format permintaan ke server tidak valid.'
          : 'Terjadi kesalahan pada server API.';
    res.status(status).json({ error: message });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !hmrDisabled,
        ws: { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan pada port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
