# Tinjauan aktivasi Neon dan R2

Pemeriksaan 14 November 2026:

- `.env` capstone berisi konfigurasi R2 dan koneksi runtime yang disiapkan dari database yang diberikan pemilik. `.env` infrastructure menyimpan koneksi owner khusus bootstrap. Keduanya diabaikan Git.
- Neon READ ONLY berhasil untuk database `capstone_service`. Schema `capstone_service`, role `capstone_project_app`, dan tabel aplikasi belum ada.
- R2 nyata berhasil PUT, GET, DELETE pada satu objek sintetis. Tidak ada objek aplikasi lain yang diubah. Aplikasi memakai kredensial S3, bukan Cloudflare API token.
- Migrasi remote belum dijalankan: automatic approval review menolak karena permintaan konfigurasi belum secara jelas menyetujui perubahan skema/role remote.

## Perubahan yang menunggu persetujuan

1. Database capstone: buat role runtime LOGIN NOINHERIT `capstone_project_app`, schema privat `capstone_service`, dan tabel schema_migrations. Terapkan `backend/capstone-service/migrations/001_capstone.sql`, yang membuat tujuh tabel aplikasi beserta indeks/constraint. Owner dipakai hanya untuk penyiapan; runtime menerima kredensial role terbatas.
2. Database user yang sudah dikonfigurasi: terapkan `backend/user-service/migrations/002_academic_roles.sql`. Constraint peran diperluas dengan KOORDINATOR_TA dan TU. Data akun yang sudah ada tetap dipertahankan. Bootstrap menggunakan checksum agar migrasi lama tidak dijalankan ulang.

Pembuatan role adalah perubahan pada cluster PostgreSQL, dan perubahan constraint adalah DDL pada database pengguna. Pengujian lokal tidak menggantikan persetujuan untuk mengubah lingkungan remote tersebut. Tidak ada migrasi auth atau perubahan kata sandi pengguna yang direncanakan.

Perintah yang disiapkan, dijalankan hanya setelah persetujuan:

```powershell
python infrastructure/scripts/bootstrap.py --service capstone
python infrastructure/scripts/bootstrap.py --service user
```

Bootstrap mendukung CAPSTONE_BOOTSTRAP_DATABASE_URL untuk endpoint yang berbeda dari layanan lama. Nilai rahasia tidak tercantum dalam dokumen ini. Pemeriksaan setelah aktivasi: `go run -buildvcs=false ./cmd/check-integrations` dari folder capstone-service dan pemeriksaan health melalui Compose.
