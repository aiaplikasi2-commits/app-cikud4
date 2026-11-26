# Security Specification & Payload TDD (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Semua path yang tidak dideklarasikan eksplisit dalam `firestore.rules` wajib ditolak (`allow read, write: if false;`).
2. **Verified Authentication Gate**: Setiap akses baca maupun tulis mensyaratkan pengguna terautentikasi dengan email terverifikasi (`request.auth != null && request.auth.token.email_verified == true`).
3. **Master Gate & Ownership**: Dokumen subkoleksi (`assets`, `accounts`, `students`, `teachers`) hanya dapat dibuat apabila dokumen induk `schools/{schoolId}` sudah ada, dan hanya dapat diakses oleh pemilik sekolah (`ownerUid == request.auth.uid`) atau Admin sekolah yang telah diverifikasi (`aiaplikasi2@gmail.com`).
4. **Path ID & String Boundary Enforcement**: Setiap path ID wajib lolos `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 karakter) dan setiap field string dibatasi panjang maksimumnya.
5. **Temporal Integrity & Immutability**: `createdAt` harus bernilai `request.time` saat `create` dan tidak boleh diubah saat `update`. `updatedAt` wajib bernilai `request.time`. `ownerUid` bersifat permanen (immutable).
6. **PII Protection**: Data sensitif (akun dengan hash password, NIK/No KK siswa, NIK/NPWP/rekening guru) tidak dapat dibaca oleh pihak ketiga mana pun di luar pemilik sekolah/admin terverifikasi (`allow list` tetap mengevaluasi `resource.data.ownerUid == request.auth.uid || isAdmin()`).
7. **Deletion Integrity**: Dokumen di Firestore hanya terhapus saat operasi `delete` dipanggil secara eksplisit oleh pemilik sekolah/admin terverifikasi.

## 2. The "Dirty Dozen" Attack Payloads (Wajib Ditolak `PERMISSION_DENIED`)
1. **Unauthenticated Read**: `get /schools/main/students/s1` tanpa `request.auth`.
2. **Unverified Email Admin Spoof**: `get /schools/main` dengan `email = "aiaplikasi2@gmail.com"` tetapi `email_verified = false`.
3. **Cross-Tenant List Scraping**: `list /schools/main/teachers` oleh UID lain tanpa kepemilikan `ownerUid`.
4. **Shadow Field Injection on Create**: `create /schools/main/students/s1` menyertakan field liar `isAdmin: true`.
5. **Shadow Field Injection on Update**: `update /schools/main/teachers/t1` menambah field `extraRole: "OPERATOR"`.
6. **Oversized Path ID Poisoning**: `create /schools/main/students/{200-char-id}`.
7. **Invalid Path ID Characters**: `create /schools/main/students/id$invalid!` (gagal regex `^[a-zA-Z0-9_\-]+$`).
8. **Timestamp Tampering on Create**: `create /schools/main/students/s1` dengan `createdAt` string/backdated alih-alih `request.time`.
9. **Immutable Field Mutation on Update**: `update /schools/main/accounts/a1` mengubah `ownerUid` atau `createdAt`.
10. **Orphan Subcollection Create**: `create /schools/nonexistent/students/s1` ketika `schools/nonexistent` tidak ada.
11. **Oversized String DoS**: `create /schools/main/teachers/t1` dengan `nama` sepanjang 5.000 karakter (melebihi batas 200).
12. **Privilege Escalation Role Value**: `create /schools/main/accounts/a1` dengan `role: "SUPERADMIN"` di luar enum `["OPERATOR", "GURU"]`.
