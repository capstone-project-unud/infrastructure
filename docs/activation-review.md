# Tinjauan aktivasi Neon dan R2

Pemeriksaan 14 November 2026:

- `.env` capstone berisi konfigurasi R2 dan koneksi runtime yang disiapkan dari database yang diberikan pemilik. `.env` infrastructure menyimpan koneksi owner khusus bootstrap. Keduanya diabaikan Git.
- Setelah persetujuan eksplisit pemilik pada 14 November 2026 (pesan “boleh”), migrasi `001_capstone.sql` dan `002_academic_roles.sql` berhasil diterapkan. Schema `capstone_service`, role `capstone_project_app`, tujuh tabel aplikasi, dan ledger migrasi sudah tersedia.
- R2 nyata berhasil PUT, GET, DELETE pada satu objek sintetis. Tidak ada objek aplikasi lain yang diubah. Aplikasi memakai kredensial S3, bukan Cloudflare API token.
- Eksekusi sebelumnya ditahan automatic approval review karena baru ada izin konfigurasi. Persetujuan eksplisit selanjutnya telah memenuhi kebutuhan tersebut; migrasi kemudian dijalankan sesuai lingkup di bawah.

## Perubahan yang disetujui dan diterapkan

1. Database capstone: buat role runtime LOGIN NOINHERIT `capstone_project_app`, schema privat `capstone_service`, dan tabel schema_migrations. Terapkan `backend/capstone-service/migrations/001_capstone.sql`, yang membuat tujuh tabel aplikasi beserta indeks/constraint. Owner dipakai hanya untuk penyiapan; runtime menerima kredensial role terbatas.
2. Database user yang sudah dikonfigurasi: terapkan `backend/user-service/migrations/002_academic_roles.sql`. Constraint peran diperluas dengan KOORDINATOR_TA dan TU. Data akun yang sudah ada tetap dipertahankan. Bootstrap menggunakan checksum agar migrasi lama tidak dijalankan ulang.

Pembuatan role adalah perubahan pada cluster PostgreSQL, dan perubahan constraint adalah DDL pada database pengguna. Keduanya telah disetujui pemilik. Tidak ada migrasi auth atau perubahan kata sandi pengguna. Admin awal diperiksa melalui startup dan sudah tersedia, sehingga tidak dibuat ulang.

Perintah yang telah dijalankan setelah persetujuan:

```powershell
python infrastructure/scripts/bootstrap.py --service capstone
python infrastructure/scripts/bootstrap.py --service user
```

Bootstrap mendukung CAPSTONE_BOOTSTRAP_DATABASE_URL untuk endpoint yang berbeda dari layanan lama. Nilai rahasia tidak tercantum dalam dokumen ini.

Verifikasi setelah aktivasi:

- PASS: role runtime capstone tersambung ke Neon, menemukan delapan tabel termasuk ledger; R2 lulus PUT/GET/DELETE objek sintetis.
- PASS: pemeriksaan READ ONLY memakai role runtime kedua layanan; checksum seluruh migrasi sesuai source dan constraint user memuat KOORDINATOR_TA/TU.
- PASS: Start-Dev.ps1 -NoWatch selesai; auth, user, capstone, gateway, Redis, dan frontend healthy. Tidak ada penyiapan ulang admin yang sudah tersedia.
- PASS: 15 request HTTP melalui frontend Docker/Neon, termasuk login admin, dashboard/data capstone, tujuh halaman ruang kerja, dan logout sesi pemeriksaan. Tidak membuat fixture akademik remote.
