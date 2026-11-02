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

Docker CLI tersedia tetapi daemon tidak aktif. Image build, container health, dan alur Compose runtime belum diuji. File Docker tidak dinyatakan telah berjalan.

Audit dependency npm pada lockfile saat implementasi melaporkan 14 advisory (2 low, 12 moderate; 0 high/critical), terutama dependency transitif build/archive/glob. Saran otomatis npm mencakup downgrade Nuxt; tidak diterapkan secara paksa karena dapat mengganti framework di luar tujuan setup. Tinjau advisory dan pembaruan yang kompatibel sebelum deployment. Ini catatan pemeriksaan dependency, bukan audit keamanan menyeluruh.

Setup belum mencakup TLS terminator, secret manager production, rate limit terdistribusi, durable provisioning saga, scheduler pembersihan sesi, maupun migrasi data dari SQL monolit. Batas konsistensi lintas database dijelaskan di architecture.md.
