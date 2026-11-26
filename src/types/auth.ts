export type UserRole = 'OPERATOR' | 'GURU';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface AuthUser {
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
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAccount {
  id: string;
  fullName: string;
  nip: string;
  username: string;
  email: string;
  role: 'GURU';
  status: AccountStatus;
  mustChangePassword?: boolean;
  teacherRecordId?: string | null;
  assignedClass?: string;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

export interface ClassOptionItem {
  name: string;
  occupiedByName: string | null;
  occupiedByTeacherId: string | null;
  occupiedByAccountId: string | null;
  isMine: boolean;
}

export interface PublicSchoolInfo {
  schoolName: string;
  city: string;
  department: string;
  logoUrl: string | null;
}

export interface AuthStatusResponse {
  needsInitialSetup: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  school: PublicSchoolInfo;
}

export interface ForgotPasswordResponse {
  ok: boolean;
  message: string;
  previewResetUrl?: string;
}

export interface ResetTokenValidationResponse {
  valid: boolean;
  username?: string;
  fullName?: string;
  error?: string;
}

export interface BulkGenerateAccountsResponse {
  createdAccounts: TeacherAccount[];
  createdCount: number;
  skippedExistingCount: number;
  skippedNoId: Array<{
    id: string;
    nama: string;
    reason: string;
  }>;
}
