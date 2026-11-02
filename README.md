# Infrastruktur Sistem Layanan Capstone Project

Repositori ini memuat konfigurasi lingkungan, penyiapan database, dan perangkat pengujian integrasi untuk Sistem Layanan Capstone Project Program Studi Teknologi Informasi, Universitas Udayana. Infrastruktur menghubungkan frontend Nuxt, API gateway, layanan autentikasi, dan layanan pengguna yang dikembangkan dalam repositori terpisah.

## Komponen Sistem

| Komponen | Fungsi | Penyimpanan |
| --- | --- | --- |
| [Frontend](https://github.com/capstone-project-unud/frontend) | Antarmuka pengguna dan perantara API pada origin aplikasi | Melalui backend |
| API gateway | Penerusan permintaan, pembatasan akses origin, dan pembatasan frekuensi permintaan | Tanpa database |
| [Layanan autentikasi](https://github.com/capstone-project-unud/auth-service) | Kredensial dan sesi | PostgreSQL `auth-service` |
| [Layanan pengguna](https://github.com/capstone-project-unud/user-service) | Profil, identitas akademik, peran, status, dan audit | PostgreSQL `user-service` |

Database setiap layanan dikelola melalui akun runtime dan skema masing-masing. Komunikasi antar layanan menggunakan HTTP dengan token internal; aplikasi tidak menjalankan query langsung ke database layanan lain.

## Isi Repositori

| Lokasi | Kegunaan |
| --- | --- |
| `compose.yaml` | Susunan layanan, jaringan, dan pemeriksaan kesiapan container |
| `scripts/bootstrap.py` | Penyiapan role database, skema, migrasi, dan konfigurasi lokal |
| `scripts/seed_admin.py` | Pembuatan administrator awal melalui API internal |
| `scripts/Start-Dev.ps1` dan `Stop-Dev.ps1` | Pengelolaan proses pengembangan pada Windows |
| `scripts/integration_test.py` | Pengujian integrasi autentikasi dan pengelolaan pengguna |
| `scripts/frontend_smoke.py` | Pemeriksaan HTTP halaman dan sesi melalui Nuxt |
| `docs/` | Arsitektur, pemetaan kebutuhan, dan catatan verifikasi |

## Lingkungan Pengembangan

Struktur direktori yang digunakan adalah `backend/auth-service`, `backend/user-service`, `backend/api-gateway`, `frontend`, dan `infrastructure` dalam satu workspace. Persyaratan meliputi Go 1.26 atau lebih baru, Python 3.12 atau lebih baru, Node.js sesuai `frontend/package.json`, serta dua database PostgreSQL yang telah tersedia.

Konfigurasi administratif mengikuti `.env.example`. Script bootstrap menyiapkan role dan skema pada database yang ditentukan, menerapkan migrasi dengan pemeriksaan checksum, serta menghasilkan `.env` untuk setiap aplikasi. Script tidak membuat atau menghapus database. Kredensial dan berkas runtime tidak disertakan dalam Git.

Perintah berikut dijalankan dari root workspace setelah konfigurasi database dan dependensi frontend tersedia:

```powershell
python -m pip install -r infrastructure/requirements.txt
python infrastructure/scripts/bootstrap.py
.\infrastructure\scripts\Start-Dev.ps1
```

Skrip `Stop-Dev.ps1` menghentikan proses pengembangan yang tercatat. Alternatif berbasis container tersedia melalui `docker compose -f infrastructure/compose.yaml up --build -d`; inisialisasi administrator menggunakan profil `init` pada Compose. Aplikasi lokal diakses melalui `http://localhost:3000`.

## Pengujian dan Batas Implementasi

Pengujian integrasi menggunakan akun sementara dan membersihkan data yang dibuatnya. Hasil pemeriksaan, termasuk bagian yang belum diverifikasi, dicatat dalam [verification.md](docs/verification.md). Konfigurasi lokal ini belum mencakup terminasi HTTPS, pengelolaan rahasia untuk produksi, atau pembatasan permintaan terdistribusi.

Penjelasan batas layanan dan konsistensi data tersedia pada [architecture.md](docs/architecture.md). Pemetaan SOP dan lingkup pengembangan tersedia pada [requirements.md](docs/requirements.md).
