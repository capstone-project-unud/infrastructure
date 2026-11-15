# Infrastruktur Sistem Layanan Capstone Project

Tambahan 14 November 2026: capstone service, Redis, driver R2, migrasi lima peran, dan stack pengujian PostgreSQL lokal terisolasi. Baca [capstone-workflow.md](docs/capstone-workflow.md) sebelum startup pertama untuk menerapkan migrasi dan membuat `.env` layanan baru. Hasil pemeriksaan lanjutan berada pada [verification-capstone.md](docs/verification-capstone.md).

Repositori ini memuat konfigurasi lingkungan, penyiapan database, dan perangkat pengujian integrasi untuk Sistem Layanan Capstone Project Program Studi Teknologi Informasi, Universitas Udayana. Infrastruktur menghubungkan frontend Nuxt, API gateway, layanan autentikasi, dan layanan pengguna yang dikembangkan dalam repositori terpisah.

Penggunaan saat ini melalui Docker Desktop lokal; VPS belum digunakan. [Workflow lengkap](docs/workflows.md) menjelaskan startup, peran, pendaftaran sampai berkas UP, pengujian terisolasi, dan CI.

## Komponen Sistem

| Komponen | Fungsi | Penyimpanan |
| --- | --- | --- |
| [Frontend](https://github.com/capstone-project-unud/frontend) | Antarmuka pengguna dan perantara API pada origin aplikasi | Melalui backend |
| API gateway | Penerusan permintaan, pembatasan akses origin, dan pembatasan frekuensi permintaan | Tanpa database |
| [Layanan autentikasi](https://github.com/capstone-project-unud/auth-service) | Kredensial dan sesi | PostgreSQL `auth-service` |
| [Layanan pengguna](https://github.com/capstone-project-unud/user-service) | Profil, identitas akademik, peran, status, dan audit | PostgreSQL `user-service` |
| [Capstone service](https://github.com/capstone-project-unud/capstone-service) | Judul, pembimbing per mahasiswa, finalisasi, log bimbingan, dan berkas UP | PostgreSQL `capstone_service`; berkas privat lokal/R2 |
| Redis | Penghitung pembatasan request gateway | Data sementara |

Database setiap layanan dikelola melalui akun runtime dan skema masing-masing. Komunikasi antar layanan menggunakan HTTP dengan token internal; aplikasi tidak menjalankan query langsung ke database layanan lain.

## Isi Repositori

| Lokasi | Kegunaan |
| --- | --- |
| `compose.yaml` | Susunan layanan, jaringan, dan pemeriksaan kesiapan container |
| `compose.dev.yaml` | Pengembangan backend dengan Air dan frontend dengan Nuxt dev server |
| `scripts/bootstrap.py` | Penyiapan role database, skema, migrasi, dan konfigurasi lokal |
| `scripts/seed_admin.py` | Pembuatan administrator awal melalui API internal |
| `scripts/Start-Dev.ps1` dan `Stop-Dev.ps1` | Menjalankan dan menghentikan Docker development dengan Air |
| `scripts/Watch-ServiceStatus.ps1` | Pemantauan keadaan container secara berkala |
| `scripts/Watch-Requests.ps1` | Access log HTTP lintas layanan pada terminal terpisah |
| `scripts/integration_test.py` | Pengujian integrasi autentikasi dan pengelolaan pengguna |
| `scripts/frontend_smoke.py` | Pemeriksaan HTTP halaman dan sesi melalui Nuxt |
| `scripts/Verify-Workspace.ps1` | Unit test, vet, build, serta opsi API/SSR terisolasi melalui -Integration |
| `tests/` | Pemeriksaan sintaks PowerShell dan regresi helper startup/log |
| `.github/workflows/` | CI infrastructure dan integrasi manual lintas repo |
| `docs/` | Arsitektur, pemetaan kebutuhan, dan catatan verifikasi |

## Lingkungan Pengembangan

Struktur direktori yang digunakan adalah `backend/auth-service`, `backend/user-service`, `backend/api-gateway`, `backend/capstone-service`, `frontend`, dan `infrastructure` dalam satu workspace. Pengembangan menggunakan Docker Desktop dengan Linux containers. Go dan Node.js dijalankan di dalam container; Python 3.12 diperlukan untuk bootstrap database pada host. Ketiga database PostgreSQL harus tersedia sebelum bootstrap.

Konfigurasi administratif mengikuti `.env.example`. Script bootstrap menyiapkan role dan skema pada database yang ditentukan, menerapkan migrasi dengan pemeriksaan checksum, serta menghasilkan `.env` untuk setiap aplikasi. Script tidak membuat atau menghapus database. Kredensial dan berkas runtime tidak disertakan dalam Git.

Setelah konfigurasi tersedia, buka folder root workspace pada VS Code dan tekan **Ctrl+Shift+B**. Task **Capstone: Start Dev** menjalankan startup/status dan viewer request dalam dua terminal terintegrasi VS Code. Docker Desktop harus aktif.

Untuk instalasi database baru dan startup manual dari root workspace:

```powershell
python -m pip install -r infrastructure/requirements.txt
python infrastructure/scripts/bootstrap.py
.\infrastructure\scripts\Start-Dev.ps1
```

`Start-Dev.ps1` menjalankan Compose development, menunggu health check, memastikan admin awal tersedia, lalu memeriksa status setiap sepuluh detik. Task VS Code membuka terminal **Capstone: Status Container** lebih dahulu dan terminal **Capstone: Request HTTP** setelah startup siap. Tabel status hanya dicetak saat pertama dibuka atau status berubah, tanpa membersihkan layar. Skrip hanya mencatat metadata, tanpa body, query string, atau cookie. `Ctrl+C` menutup pemantauan; `Stop-Dev.ps1` menghentikan container. Aplikasi diakses melalui `http://localhost:3000`.

Opsi `-NoWatch` menjalankan startup dan status awal tanpa loop pemantauan; `-Build` membangun ulang image Docker. Jika menjalankan skrip secara manual, `Watch-Requests.ps1` dijalankan pada terminal terintegrasi kedua. Skrip tidak membuat jendela PowerShell eksternal. Viewer menampilkan pesan menunggu sampai ada request dari aplikasi. Panduan lengkap workspace tersedia di `docs/menjalankan-proyek.md` pada root workspace.

## Pengembangan Docker

Untuk pengembangan di dalam Docker, jalankan Start-Dev dari root workspace. Keempat backend memakai Air v1.67.4 untuk memantau dan mengompilasi ulang source Go. Frontend menggunakan Nuxt dev server. Source terhubung melalui bind mount; cache kompilasi dan dependensi disimpan dalam volume terpisah. Konfigurasi dasar tanpa berkas tambahan menjalankan hasil build tanpa pemantauan source.

Health check rutin berjalan setiap 30 detik; selama masa awal digunakan interval 5 detik. Log Docker dibatasi tiga berkas berukuran sekitar 10 MB per container development. Image dan cache build tetap disimpan agar startup berikutnya tidak mengunduh atau mengompilasi seluruh dependensi kembali.

## Pengujian dan Batas Implementasi

Gunakan `./infrastructure/scripts/Verify-Workspace.ps1 -Integration` untuk unit test, build, API, dan SSR pada PostgreSQL/Redis sementara. Runner memerlukan Go/Node pada host dan dependency frontend dari npm ci. Hasil pemeriksaan dan batasnya tercatat dalam [verification-capstone.md](docs/verification-capstone.md); [verification.md](docs/verification.md) menyimpan riwayat tahap awal. Gateway development telah memakai Redis. Terminasi HTTPS dan penyiapan deployment VPS belum tersedia.

Penjelasan batas layanan dan konsistensi data tersedia pada [architecture.md](docs/architecture.md). Pemetaan SOP dan lingkup pengembangan tersedia pada [requirements.md](docs/requirements.md).
