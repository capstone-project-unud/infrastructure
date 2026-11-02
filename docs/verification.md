# Hasil verifikasi — 2 November 2026

## Lulus

- Tiga modul Go: `go test ./...`, `go vet ./...`, dan build binary Windows.
- Unit test auth: pembatasan 10 percobaan login per menit dan penolakan endpoint privat tanpa token internal; session digest SHA-256.
- Unit test user: mahasiswa lengkap/tidak lengkap, Koprodi dengan/tanpa DOSEN, penolakan ADMIN dari pembuatan akun biasa, role duplikat, format email, dan password pendek.
- Unit test gateway: routing, penolakan Origin asing, blok route privat, pembuangan service-token dari klien, penerusan cookie, dan pelestarian Content-Type JSON. Pengujian integrasi menemukan header Content-Type tergabung pada versi awal; telah diperbaiki dan dilindungi regression test.
- Integrasi layanan hidup dengan Neon: **33 assertion HTTP**. Login admin; cookie HttpOnly/SameSite Strict; pembuatan mahasiswa/dosen; validasi identitas/duplikasi; pencarian peran; penolakan akses non-admin; update profil sendiri tanpa eskalasi role; nonaktif/aktif dan pencabutan sesi; ganti/reset password; edit dosen; perlindungan status admin; audit; logout dan penolakan replay cookie.
- Pemeriksaan database: bcrypt, pemisahan tabel/schema layanan, dan data uji dibersihkan berdasarkan UUID yang dibuat test. Tidak ada akun mahasiswa/dosen dummy yang ditinggalkan.
- Frontend: TypeScript typecheck dan build produksi Nuxt 4.6.3.
- HTTP pada build produksi: `/login` 200; Urbanist lokal 200; login melalui Nuxt BFF 200 dengan JSON; admin users/activity/account merender HTML 200 sesudah login; logout 204; akses admin tanpa sesi diarahkan ke `/login`.
- Migrasi Neon berhasil dan bootstrap ulang mempertahankan checksum tanpa menjalankan ulang migrasi yang sudah diterapkan. Admin awal idempoten: pemanggilan ulang tidak membuat akun kedua.
- `docker compose ... config --quiet` lulus; tidak mencetak nilai rahasia.
- Skill `frontend/skills/capstone-design/SKILL.md` lulus validator skill.
- `.env`, binary, node_modules, `.nuxt`, `.output`, dan `.run` diabaikan Git pada setiap repositori terkait. Scan source tidak menemukan kredensial Neon.
- Binary Node lokal 22.22.3 cocok dengan SHA-256 dalam SHASUMS256 distribusi resmi Node.js.
- `Start-Dev.ps1` berhasil membangun/menjalankan tiga backend dan frontend dengan runtime Node lokal; `Stop-Dev.ps1` memverifikasi identitas proses, menghentikan seluruh proses tercatat, dan melepas port 3000/8080/8081/8082.
- Smoke test HTTP frontend juga diulang pada dev server, termasuk penolakan Origin asing di BFF. Alur login client mengambil `/me` setelah cookie diterbitkan agar profil lengkap tersedia; logout membersihkan cache AsyncData pada client.

## Kontras yang dihitung

| Pasangan | Rasio | Ambang |
| --- | --- | --- |
| muted #63636d / putih | 5.94:1 | 4.5 |
| muted #63636d / canvas | 5.44:1 | 4.5 |
| putih / primary #6741cf | 6.49:1 | 4.5 |
| ink ilustrasi #263f33 / sage | 6.37:1 | 4.5 |
| label ilustrasi #344e40 / sage | 5.08:1 | 4.5 |
| note #53406e / accent-soft | 7.73:1 | 4.5 |
| status #285e46 / hijau lembut | 6.66:1 | 4.5 |
| error #a32732 / merah lembut | 6.56:1 | 4.5 |
| placeholder #72727c / putih | 4.76:1 | 4.5 |
| nav #575761 / sidebar | 6.19:1 | 4.5 |
| border input #85858d / putih | 3.66:1 | 3.0 non-text |

## Batas verifikasi

Tidak ada browser yang tersedia pada tool browser sesi ini. Karena itu screenshot, resize viewport, zoom 200%, pemeriksaan hydration/console browser, fokus keyboard aktual, dan click-through UI belum dijalankan. Pengujian HTTP bukan pengganti pengujian interaksi browser. Delivery Gate antislop R-35 untuk visual/interaksi masih **pending**, bukan diklaim PASS.

Daftar click-through yang masih harus diperiksa melalui browser:

| Kontrol / kondisi | Pemeriksaan manual yang diperlukan |
| --- | --- |
| Login kosong/salah/valid, Lihat, bantuan masuk | validasi browser, pengumuman error, toggle sandi, buka/tutup details, redirect peran |
| Navigasi admin/aktivitas/profil dan keluar | tautan, penanda aktif, tidak ada error console |
| Tambah pengguna dan editor | switch mahasiswa/dosen, checkbox Koprodi, optional fields, submit/batal/Escape, fokus kembali |
| Pencarian/tab/status/reset/pagination | fetch hasil yang benar, loading/empty/error, kontrol disabled |
| Nonaktif/aktif dan dialog konfirmasi | batal/konfirmasi, feedback status, fokus modal |
| Reset kata sandi di editor | tampilkan form, batal, simpan, sesi lama tidak bisa dipakai |
| Profil dan ganti password | simpan, validasi, pesan sukses lalu login ulang |
| 375/768/1024/1440 px dan zoom 200% | reflow, target sentuh, tidak ada overflow halaman, teks tidak terpotong |
| Keyboard / reduced motion | Tab/Shift+Tab/Enter/Space/Escape, focus ring, dialog trap, tanpa transform saat reduce |

Pada pemeriksaan awal, daemon Docker belum aktif. Verifikasi tambahan mode pengembangan Docker dengan Air dijelaskan di bawah. Image dan runtime mode hasil build tanpa Air belum diperiksa dalam verifikasi tambahan ini.

Audit dependency npm pada lockfile saat implementasi melaporkan 14 advisory (2 low, 12 moderate; 0 high/critical), terutama dependency transitif build/archive/glob. Saran otomatis npm mencakup downgrade Nuxt; tidak diterapkan secara paksa karena dapat mengganti framework di luar tujuan setup. Tinjau advisory dan pembaruan yang kompatibel sebelum deployment. Ini catatan pemeriksaan dependency, bukan audit keamanan menyeluruh.

Setup belum mencakup TLS terminator, secret manager production, rate limit terdistribusi, durable provisioning saga, scheduler pembersihan sesi, maupun migrasi data dari SQL monolit. Batas konsistensi lintas database dijelaskan di architecture.md.

## Verifikasi tambahan: pengembangan Docker dengan Air

Docker Desktop diaktifkan dan konfigurasi gabungan `compose.yaml` + `compose.dev.yaml` dijalankan pada Linux containers. Keempat image development berhasil dibangun. Backend memakai Go 1.26 dan Air v1.67.4; frontend memakai Node 22.22.3 dan Nuxt dev server. Tag image pengembangan menggunakan `:dev`.

- Ketiga backend dan frontend mencapai status `healthy`; hanya port frontend 3000 diterbitkan pada loopback host.
- Pada setiap backend, penambahan berkas Go sementara memicu kompilasi ulang dan pergantian PID binary layanan. ID container dan waktu mulai container tetap sama. Penghapusan berkas uji memicu pemuatan ulang berikutnya. Seluruh berkas uji telah dihapus.
- `go test ./...` lulus pada auth-service, user-service, dan api-gateway di dalam container. `GOTMPDIR` diarahkan ke volume `.air` agar binary pengujian dapat dieksekusi tanpa mengubah opsi keamanan tmpfs `/tmp`.
- `npm run typecheck` lulus di dalam container frontend.
- `frontend_smoke.py` lulus melalui frontend Docker: login, cookie HttpOnly, font lokal, HTML admin/aktivitas/profil, logout, redirect halaman terlindungi, dan penolakan Origin asing.
- Profil Compose `init` dapat menjalankan `seed-admin` dan mengonfirmasi administrator awal sudah tersedia tanpa membuat akun tambahan.
- Konfigurasi dasar dan konfigurasi gabungan development lulus `docker compose config --quiet`. Berkas TOML Air berhasil diparse. Direktori `.air` diabaikan Git dan konteks build image.

Verifikasi ini membuktikan pemantauan source dan pemulaian ulang binary Go di dalam Docker. Pemeriksaan visual, WebSocket HMR pada browser, dan interaksi keyboard tetap belum dijalankan. Pengujian integrasi 33 assertion yang dicatat sebelumnya dijalankan pada mode lokal; pada Docker, verifikasi HTTP menggunakan frontend BFF karena port backend tidak dipublikasikan.

## Revisi keterbacaan dan sidebar

Perubahan mencakup ukuran teks, penghapusan keterangan berulang, fokus form login, serta sidebar mengambang yang dapat diperluas atau diminimalkan. Aturan terbaru tersimpan identik pada `docs/design.md` di workspace dan `frontend/design.md`.

| Pemeriksaan | Hasil dan bukti |
| --- | --- |
| Build produksi | PASS: Nuxt menyelesaikan build pada host dengan runtime Node proyek, exit 0. Build di container development tidak digunakan sebagai bukti karena direktori `.output` merupakan mount volume dan tidak dapat dihapus oleh proses build. |
| TypeScript | PASS: `npm run typecheck` di container frontend, exit 0. |
| Render dan autentikasi | PASS: `frontend_smoke.py` memeriksa login, font lokal, cookie HttpOnly, halaman pengguna/aktivitas/profil, logout, redirect terlindungi, dan penolakan Origin asing. |
| Preferensi sidebar | PASS: cookie `capstone_sidebar_collapsed=true` menghasilkan sidebar diminimalkan sejak HTML server; tombol memiliki `aria-expanded=false`, tautan ikon memiliki nama aksesibel dan tooltip. Tanpa preferensi tersebut, server menghasilkan sidebar terbuka. Ini menguji render preferensi, bukan klik toggle pada browser. |
| Penghapusan teks | PASS: pemeriksaan HTML memastikan banner, label ruang kerja, teks footer login, dan elemen footer tidak muncul. |
| Ukuran teks | PASS: pemindaian deklarasi CSS aplikasi tidak menemukan ukuran teks eksplisit di bawah 14 px. Isi/input 16 px, tombol/navigasi 15 px, metadata 14 px. |
| Kontras token | PASS: muted/putih 5.94:1, muted/canvas 5.44:1, navigasi aktif 5.56:1, tombol utama 6.49:1, status aktif/putih 7.55:1, placeholder/putih 4.76:1. |
| Integritas berkas | PASS: `git diff --check` pada frontend dan infrastructure; kedua salinan panduan desain memiliki SHA-256 yang sama. |

Pemeriksaan HTTP diulang pada server lokal dan container Docker. Koneksi Docker diarahkan ke IPv4 saat pengujian karena server lokal memakai `::1` pada port 3000. Semua container pengujian mencapai kondisi healthy.

Delivery Gate antislop: pemeriksaan kode dan HTTP mendukung penghapusan elemen tanpa fungsi, penggunaan data API, nama aksesibel kontrol, status loading/error/empty, dan alasan visual yang tertulis dalam panduan desain. Purpose-Gate dan arah desain tetap menggunakan Urbanist, sage pada ilustrasi, aksen ungu pada tindakan, serta elevasi sidebar sesuai permintaan pemilik. Pemeriksaan visual Hard Gate, reflow, keyboard, dan click-through R-35 tetap **pending**: daftar browser tersedia kosong dan upaya membuka browser pratinjau mengembalikan “Browser is not available”. Belum ada klaim lulus untuk tampilan responsif atau interaksi aktual. Daftar pemeriksaan manual di atas tetap berlaku, ditambah toggle sidebar, persistensi setelah refresh, dan fokus email/kata sandi yang tidak menimpa label.

## Pemantauan development dan access log

`Start-Dev.ps1` memakai Docker dengan Air. Startup menunggu health check, menjalankan seed admin yang idempotent, lalu membuka tabel status berkala. `Stop-Dev.ps1` menghentikan container. Pada penyederhanaan berikutnya, mode lokal, skrip startup/stop lokal, dan pemasang Node lokal dihapus sesuai permintaan pemilik. Seluruh perintah development kini menggunakan Docker tanpa opsi pemilihan mode.

- PASS: parser PowerShell memeriksa seluruh `.ps1` dan `.psm1` tanpa kesalahan sintaks.
- PASS: `Start-Dev.ps1 -NoWatch` menyalakan keempat container hingga healthy dan mengonfirmasi administrator sudah tersedia.
- PASS: status membedakan container belum dibuat, aktif, dan berhenti. Penghentian sementara user-service menghasilkan status Berhenti dan kode keluar 0; layanan kemudian dipulihkan hingga healthy.
- PASS: pemantauan status pada proses PowerShell terpisah menghasilkan beberapa pembaruan dengan interval satu detik. Viewer request pada proses terminal kedua menangkap request baru melalui mode follow. Setelah proses monitor diakhiri, seluruh container tetap aktif dan healthy.
- PASS: kondisi Docker tidak ditemukan ditampilkan untuk keempat layanan. Kondisi Docker tidak dapat diakses memiliki cabang status tersendiri; daemon tidak sengaja dimatikan sebagai bagian pengujian.
- PASS: format request menampilkan waktu WITA, status, method, layanan, path, dan durasi. Filter errors-only, pilihan layanan, health opt-in, log tidak valid, dan Tail 0 diperiksa.
- PASS: `go test ./...` pada ketiga backend, termasuk pengujian status akhir 200/400/401/403/404/500, pemulihan panic, dan pencegahan pencatatan body, query, cookie, Authorization, serta pesan error privat.
- PASS: typecheck frontend dalam Docker dan build produksi pada host. Logger Nuxt menggunakan event finish pada respons Node agar respons error yang ditulis langsung oleh Nitro tetap tercatat; penolakan Origin 403 diperiksa melalui request HTTP nyata dan viewer log.

Access log dari keempat layanan terlihat pada pengujian HTTP. Jalur internal juga dicatat, sehingga satu tindakan pengguna dapat menghasilkan beberapa baris. Health check disembunyikan oleh viewer secara bawaan. Aset yang dilayani langsung oleh Vite dan WebSocket HMR berada di luar cakupan access log Nitro. Pemeriksaan ini tidak mengubah status verifikasi visual UI yang masih pending pada bagian sebelumnya.

## Pengurangan aktivitas monitor dan batas log

Snapshot saat empat container development berjalan mencatat RAM sekitar 545 MiB: frontend 423 MiB, gateway 21.43 MiB, user-service 29.98 MiB, dan auth-service 70.46 MiB. Ini angka sesaat dari `docker stats`, tidak termasuk overhead Docker Desktop/WSL dan dapat naik selama kompilasi atau menerima request. `docker system df` mencatat image global 1.605 GB, volume 1.838 GB, serta build cache 4.769 GB; angka tersebut mencakup seluruh lingkungan Docker. Ukuran image bertag tidak dijumlahkan karena lapisan dapat dipakai bersama.

- Pembacaan status memanggil Compose pada host dan tidak mengirim request tambahan ke API atau Neon. Tiga pengukuran pembacaan status adalah 706, 415, dan 436 ms.
- Interval monitor bawaan menjadi 10 detik. Tabel hanya dicetak saat pembukaan atau isi status berubah. `Clear-Host` dihapus agar layar tidak berkedip penuh.
- Health check development rutin menjadi 30 detik. Interval awal tetap 5 detik melalui `start_interval`, dengan masa awal 180 detik. Setelah masa awal, tiga kegagalan berturut-turut menandai kondisi unhealthy.
- Driver log development memakai json-file, maksimum tiga berkas sekitar 10 MB per container. Keempat layanan memiliki batas log nominal sekitar 120 MB; batas ini tidak berlaku untuk image, volume, dan cache.
- PASS: penggabungan Compose dan sintaks PowerShell. Fixture tiga polling dengan dua keadaan berbeda menghasilkan tepat dua tampilan status, tanpa pembersihan terminal. Default interval 10 detik diperiksa dari parameter skrip. Perubahan konfigurasi container diterapkan saat startup berikutnya; container aktif tidak dibuat ulang selama pemeriksaan ini. Cache tidak dihapus.

Rujukan: [healthcheck Compose](https://docs.docker.com/reference/compose-file/services/#healthcheck) dan [Docker build cache](https://docs.docker.com/build/cache/).
