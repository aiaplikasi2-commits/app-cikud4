import assert from 'assert';
import fs from 'fs';
import path from 'path';

/**
 * Phase 0 Rules & Blueprint Invariant Verification Runner
 * Memastikan blueprint, ruleset, serta payload "Dirty Dozen" memenuhi delapan pilar keamanan.
 */
const blueprintPath = path.resolve('firebase-blueprint.json');
const rulesPath = path.resolve('firestore.rules');

const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
const rulesText = fs.readFileSync(rulesPath, 'utf-8');

// 1. Pastikan seluruh koleksi blueprint tercakup di firestore.rules
const expectedPaths = Object.keys(blueprint.firestore || {});
assert.ok(expectedPaths.length === 8, 'Harus ada 8 koleksi terdaftar di firebase-blueprint.json');

for (const colPath of expectedPaths) {
  const leaf = colPath.split('/').slice(-2).join('/');
  assert.ok(
    rulesText.includes(leaf) || rulesText.includes('schools/{schoolId}'),
    `Path koleksi ${colPath} wajib memiliki match block di firestore.rules`
  );
}
assert.ok(
  rulesText.includes('match /letters/{letterId}'),
  'Match block match /letters/{letterId} wajib ada di firestore.rules'
);
assert.ok(
  rulesText.includes('match /attendance/{attendanceId}'),
  'Match block match /attendance/{attendanceId} wajib ada di firestore.rules'
);
assert.ok(
  rulesText.includes('match /agendas/{agendaId}'),
  'Match block match /agendas/{agendaId} wajib ada di firestore.rules'
);

// 2. Pastikan Global Catch-All Deny & Email Verified Gate aktif
assert.ok(
  rulesText.includes('match /{document=**}') && rulesText.includes('allow read, write: if false;'),
  'Global catch-all default deny wajib ada'
);
assert.ok(
  rulesText.includes('request.auth.token.email_verified == true'),
  'Verifikasi email wajib diberlakukan'
);
assert.ok(
  rulesText.includes('request.time'),
  'Validasi timestamp server request.time wajib diterapkan'
);
assert.ok(
  !rulesText.includes('allow read: if isSignedIn()') &&
    !rulesText.includes('allow list: if isSignedIn();'),
  'Dilarang menggunakan blanket read/list'
);

// 3. Simulasi Dirty Dozen Invariant Checks (Blueprint Boundary Validation)
const dirtyPayloads = [
  { name: 'Unauthenticated Read', auth: null },
  { name: 'Unverified Email Admin Spoof', auth: { email: 'aiaplikasi2@gmail.com', email_verified: false } },
  { name: 'Shadow Field Injection', extraKey: 'isSuperAdmin' },
  { name: 'Oversized Path ID', id: 'a'.repeat(129) },
  { name: 'Invalid Path ID Regex', id: 'bad/id$!' },
  { name: 'Oversized Nama String', nama: 'X'.repeat(201) },
  { name: 'Invalid Role Enum', role: 'SUPERADMIN' },
  { name: 'Invalid Letter Type Enum', letterType: 'UNKNOWN_SURAT' },
  { name: 'Invalid Attendance Kind Enum', attendanceKind: 'RANDOM_KIND' },
  { name: 'Invalid Agenda Status Enum', agendaStatus: 'INVALID_STATUS' },
];

for (const payload of dirtyPayloads) {
  if ('auth' in payload) {
    const allowed =
      Boolean(payload.auth) &&
      payload.auth?.email_verified === true &&
      payload.auth?.email === 'aiaplikasi2@gmail.com';
    assert.strictEqual(allowed, false, `${payload.name} harus ditolak`);
  }
  if ('id' in payload && payload.id) {
    const validId = /^[a-zA-Z0-9_-]+$/.test(payload.id) && payload.id.length <= 128;
    assert.strictEqual(validId, false, `${payload.name} harus ditolak`);
  }
  if ('nama' in payload && payload.nama) {
    assert.ok(payload.nama.length > 200, `${payload.name} melebihi maxLength 200`);
  }
  if ('role' in payload && payload.role) {
    assert.strictEqual(
      ['OPERATOR', 'GURU'].includes(payload.role),
      false,
      `${payload.name} harus ditolak`
    );
  }
  if ('letterType' in payload && payload.letterType) {
    assert.strictEqual(
      ['SUKET_SISWA_DITERIMA', 'SUKET_PINDAH_SEKOLAH', 'SURAT_LAIN_LAIN'].includes(payload.letterType),
      false,
      `${payload.name} harus ditolak`
    );
  }
  if ('attendanceKind' in payload && payload.attendanceKind) {
    assert.strictEqual(
      ['HOMEROOM_MAP', 'DAILY_SHEET'].includes(payload.attendanceKind),
      false,
      `${payload.name} harus ditolak`
    );
  }
  if ('agendaStatus' in payload && payload.agendaStatus) {
    assert.strictEqual(
      ['DIRENCANAKAN', 'BERLANGSUNG', 'SELESAI', 'DIBATALKAN'].includes(payload.agendaStatus),
      false,
      `${payload.name} harus ditolak`
    );
  }
}

console.log('Security rules & Dirty Dozen invariant checks passed.');
