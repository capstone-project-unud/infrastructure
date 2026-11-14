# Verifikasi implementasi capstone, 14 November 2026

Pengujian memakai PostgreSQL 17 dan Redis lokal dalam project Compose `capstone-verify`. Auth/user/capstone/gateway menjalankan binary Linux hasil kompilasi source. Tidak ada migrasi atau penulisan data pada Neon. Akun, berkas, dan proyek pengujian diberi nama verifikasi dan hanya berada pada lingkungan uji.

## Hasil

| Pemeriksaan | Hasil dan bukti |
| --- | --- |
| Backend | PASS: `go test ./...` untuk auth, user, gateway, capstone. `go vet ./...` untuk tiga layanan yang logikanya berubah: user, gateway, capstone. |
| Aturan domain | PASS: anggota ganda, calon dosen ganda, keputusan judul berbeda dari kesediaan, pembimbing tiap mahasiswa, dan kelengkapan finalisasi diuji. |
| Storage | PASS: driver lokal menolak traversal dan melakukan put/get/delete; adapter R2 diuji pada endpoint S3 tiruan dengan signature AWS4 dan tanpa public ACL. R2 nyata juga lulus put/get/delete satu objek sintetis lewat `cmd/check-integrations --storage-only`; objek uji dihapus. |
| Ekspor | PASS: XLSX berupa arsip workbook yang mempertahankan nol awal NIM dan input sebagai teks; PDF panjang berisi Unicode menghasilkan beberapa halaman. Endpoint ekspor menghasilkan XLSX/PDF dan header unduhan yang benar. |
| Integrasi API | PASS: `node infrastructure/scripts/capstone_smoke.mjs`, **122 permintaan HTTP**, termasuk lima peran dan tambahan jabatan Koprodi, dashboard kosong/berisi sesuai kewenangan, unggahan salah signature, akses objek mahasiswa lain, calon dosen sendiri, dua keputusan, penetapan per mahasiswa, konflik versi, pembukaan kembali sebelum UP, penguncian setelah UP, revisi log, dan validasi dua berkas secara terpisah. |
| Integrasi UI lewat HTTP | PASS: `node infrastructure/scripts/capstone_frontend_smoke.mjs`, **31 halaman SSR** untuk admin, mahasiswa, dosen, koordinator, TU, dan Koprodi; dashboard tiap peran; redirect tanpa sesi/peran; Origin asing ditolak; XLSX berhasil melewati Nuxt BFF. |
| Redis | PASS: gateway uji memakai Redis nyata; pemeriksaan Redis menemukan penghitung request. Skrip INCR/EXPIRE atomik ada pada middleware gateway. |
| Frontend | PASS: `npm run typecheck` dan `npm run build`. Build terakhir menghasilkan seluruh route baru. |
| Konfigurasi | PASS: Compose utama + dev `config --quiet --no-env-resolution`; bootstrap selektif dijalankan dua kali pada database PostgreSQL Docker lokal terpisah. Migrasi hanya diterapkan sekali, role runtime terpisah dapat membaca delapan tabel termasuk ledger, hostname runtime tersimpan, konfigurasi R2 dipertahankan, dan konfigurasi auth/user/frontend tidak dibuat. Tidak ada perubahan Neon. |
| Whitespace | PASS: `git diff --check` pada frontend, user, gateway, infrastructure. |

Build host memakai Node 22.19.0 dan mengeluarkan peringatan rentang versi Nuxt, tetapi build/typecheck selesai. Gunakan Node 22.22.3 sesuai `.node-version` dan image Docker proyek untuk pengembangan berikutnya. Build pertama terkena pembatasan readlink sandbox Windows; build dengan izin filesystem normal berhasil. Pemeriksaan SSR sempat memberi positif palsu karena mencocokkan nama aset error yang di-prefetch; assertion diperbaiki agar memeriksa status HTTP, main landmark, dan h1 aplikasi.

## Desain dan batas Delivery Gate

Pilihan pemilik pada sesi ini: cukup pemeriksaan API dan build; browser/interaksi visual ditunda. Penghubung CUA tidak tersedia dan alternatif Playwright tidak dijalankan. Hasil SSR tidak diklaim sebagai click-through atau bukti layout mobile.

- Hard Gate, bagian source/API: PASS untuk route nyata, kontrol yang memiliki handler, keadaan loading/kosong/error, label form, pemeriksaan akses server, dan tidak ada data kelulusan simulasi pada fitur yang diubah. Pemeriksaan overflow, keyboard aktual, dan klik masih ditunda.
- Purpose Gate: PASS untuk alasan source yang tercatat pada matriks kebutuhan: tabel untuk perbandingan/penetapan, formulir berkelompok untuk pendaftaran, Urbanist/token dari desain pemilik, status teks untuk keputusan akademik, tanpa ilustrasi dekoratif baru.
- Liveliness: arah ENERGY 2 / RHYTHM 3 / MOTION 1 terdokumentasi; pemisahan judul, tabel kerja, form, dan log mengikuti konten. Konsistensi visual nyata belum diperiksa melalui browser.
- Craftsmanship: PASS untuk build, typecheck, kontrak API, otorisasi, dan SSR; Delivery Gate visual/interaksi penuh tetap ditunda sesuai pilihan pemilik.

Rasio kontras yang dihitung dari token source: muted terang/putih 5.94:1; muted gelap/panel 6.38:1; teks putih/tombol primary 6.49:1; sukses terang/putih 5.02:1; error terang/putih 7.26:1. Tombol primary memakai token aksi tetap agar teks putih tidak kehilangan kontras pada mode gelap. Ini perhitungan token, bukan audit semua pixel halaman.

## Yang belum diaktifkan atau diperiksa

- Migrasi Neon: `.env` sudah disiapkan dan diabaikan Git. Pemeriksaan READ ONLY berhasil; schema, tabel capstone, dan role runtime belum ada. Migrasi/pembuatan role remote menunggu persetujuan karena automatic approval review menolak pelaksanaan sebelumnya. Rincian: [activation-review.md](activation-review.md).
- Format surat resmi: PDF sengaja berlabel format sementara sampai detail diberikan.
- Browser: klik, fokus, ukuran mobile/tablet, tema nyata, dan console/hydration belum diverifikasi.
- Pemeriksaan mata kuliah, penjadwalan/nilai/kelulusan ujian, Expo, RAG, dan dokumen B-Series lengkap berada di luar alur wajib tahap ini. Panduan asli telah diekstrak ulang; validasi dua berkas belum mencakup seluruh persyaratan pedoman.

Stack uji dan frontend lokal dihentikan sesudah verifikasi. Berkas hasil uji tersimpan pada `infrastructure/.run/artifacts`, diabaikan Git. Source capstone dipublikasikan hanya ke repo yang diberikan pemilik; `.env` dan kredensial tidak termasuk commit.

## Penyelarasan dengan User Management

Arahan pemilik: seluruh halaman ruang kerja mengikuti tampilan Manajemen pengguna. Implementasi memakai `workspace.css` bersama untuk header panel, ringkasan, dasar tabel, pencarian, filter, pagination, dan aksi teks. User Management dan dashboard memakai `WorkspaceStatistics`; pencarian pengguna, judul, dosen, dan pemilih anggota memakai `WorkspaceSearch`. Halaman bidang minat memakai daftar tabel dan editor dialog. Form akademik mengikuti ukuran label, kontrol, check-card, serta dialog yang sama. Kedua salinan design.md memiliki isi/hash identik.

- PASS: typecheck Nuxt dan build produksi terakhir dengan Node 22.22.3; build selesai dalam 48.9 detik. Font Urbanist tetap tersedia di public/fonts.
- PASS: 122 permintaan API pada stack lokal terisolasi dan 31 halaman SSR lintas peran dari build produksi, termasuk User Management, dashboard, daftar/detail judul, finalisasi, bimbingan, proposal, dan bidang minat. Redirect kewenangan, proteksi Origin, dan unduhan XLSX melalui BFF tetap lulus.
- PASS: `git diff --check` frontend. Source memakai token tema yang sudah ada; tidak ada warna latar baru per halaman atau data ringkasan rekaan.
- Delivery Gate antislop: tujuan tiap pola mengikuti acuan pemilik; kontrol memiliki handler; loading/error/empty dan nama aksesibel dipertahankan. Konsistensi yang diverifikasi adalah source, build, API, dan SSR. Pixel, reflow viewport, tema di browser, fokus, klik, dan dialog aktual belum diperiksa karena pemilik memilih API/build dahulu. Gerbang visual/interaksi tetap pending.

Frontend lokal dan stack `capstone-verify` dihentikan setelah pemeriksaan. Penyelarasan ini tidak menjalankan migrasi Neon.

## Kontrol tanpa tampilan bawaan browser

Permintaan lanjutan pemilik mengganti seluruh dropdown native, kalender native, dan tombol file bawaan. `WorkspaceSelect` dipakai pada filter pengguna, judul, bidang minat, mahasiswa, calon/pembimbing, serta formulir UP. `WorkspaceDatePicker` menampilkan kalender Indonesia dan mempertahankan nilai ISO untuk API. `WorkspaceFilePicker` menjadi satu komponen unggah bagi akademik serta impor mahasiswa/dosen. Checkbox digambar CSS dan spinner number input disembunyikan.

- PASS source: pemindaian seluruh app tidak menemukan `<select>`, input date/datetime-local/month, atau input file terlihat. Satu input file tersembunyi tetap menjadi penghubung pemilih berkas OS.
- PASS: typecheck Nuxt dan build produksi dengan Node 22.22.3; build terakhir selesai sekitar 63 detik.
- PASS: empat tes logika kalender pada `frontend/tests/calendar.test.ts`, mencakup tahun kabisat/tanggal tidak valid, batas bulan/tahun, grid Senin berisi 42 hari berurutan, serta pergeseran UTC melewati DST. Perintah: `node --experimental-strip-types --test tests/calendar.test.ts` dari frontend.
- PASS: 122 permintaan API dan 31 halaman SSR lintas peran. Pemeriksaan SSR sempat menemukan import absolut Windows dari dependency Excel; Nitro kini membundel xlsx beserta modul codepage. Render User Management dan seluruh pemeriksaan SSR diulang lalu lulus.
- PASS: whitespace frontend dan dua salinan panduan desain identik. Tidak ada dependency UI/tanggal baru atau migrasi Neon.

Delivery Gate source: menu memakai ARIA, navigasi keyboard, keputusan opsi disabled, validasi required, fokus balik, dan light dismiss melalui popover; kalender memakai tombol hari dengan label tanggal lengkap; unggah memiliki tombol keyboard, drag-and-drop, format/ukuran, serta busy/disabled. Gerbang visual/interaksi browser tetap pending sesuai pilihan pemilik. Pengujian logika/SSR tidak membuktikan klik, fokus, posisi popover, tema, atau reflow viewport pada browser. Stack uji dan frontend dihentikan sesudah verifikasi.
