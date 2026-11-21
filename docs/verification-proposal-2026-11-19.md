# Verifikasi revisi proposal — 19 November 2026

## Hasil

- Unit test dan `go vet` untuk auth-service, user-service, api-gateway dan capstone-service: lulus.
- Binary Linux keempat layanan untuk stack integrasi: berhasil dibangun.
- Frontend: typecheck dan build produksi Nuxt lulus; empat tes kalender lulus.
- API pada PostgreSQL/Redis sementara: 471 permintaan HTTP lulus. Mencakup alur judul yang dipertahankan, enam berkas dan revisi parsial, filter/isi XLSX/NIM nol awal, peran Koprodi, panel berbeda tiap mahasiswa, jadwal eksternal, tanda tangan privat, lima penilai, aturan versi, dan konflik dua pengiriman nilai bersamaan.
- SSR: 86 halaman lintas peran lulus, berikut redirect hak akses, perlindungan Origin BFF, font Urbanist dan unduhan XLSX.
- PDF: presensi, berita acara, dan lima form nilai berhasil dihasilkan, dirender dengan Poppler dan diperiksa. Ketujuh dokumen data normal muat satu halaman. Uji nama/judul/indikator panjang memeriksa pemenggalan halaman dan header lanjutan.
- `git diff --check`: lulus pada repository terkait. `.env` dan fixture `.run` diabaikan Git.

Rangkaian API utama: `scripts/capstone_smoke.mjs`, dengan regresi khusus di `scripts/proposal_exam_smoke.mjs`. Rangkaian SSR: `scripts/capstone_frontend_smoke.mjs`. Runner gabungan tetap `scripts/Verify-Workspace.ps1 -Integration`.

Pengujian dibatasi API, SSR, typecheck/build dan dokumen. Interaksi browser serta pemeriksaan visual aplikasi pada perangkat/tema belum dijalankan sesuai arahan pengguna. Integrasi ini menggunakan storage lokal, bukan unggahan pengujian ke R2.

## Aktivasi Neon — 21 November 2026

Setelah persetujuan eksplisit pengguna, bootstrap kedua layanan berhasil dijalankan. Pemeriksaan sebelum migrasi memastikan checksum migrasi lama cocok, tidak ada akun Koprodi yang terdampak migrasi 003 lama, dan tidak ada pendaftaran proposal.

Migrasi yang diterapkan:

- user-service: `003_remove_koprodi_role.sql` diikuti `004_restore_koprodi_role.sql`.
- capstone-service: `002_sempro_and_documents.sql`, `003_full_sop_modules.sql`, `004_individual_proposal_exams.sql`.

Pemeriksaan sesudah migrasi menemukan empat versi tercatat di masing-masing layanan dan keenam tabel baru tersedia: `proposal_documents`, `proposal_exams`, `proposal_grading_policies`, `proposal_exam_evaluations`, `proposal_exam_attendance`, dan `lecturer_signatures`.

Konfigurasi lokal tetap memakai kredensial privat dalam `.env` yang diabaikan Git. Adapter dan konfigurasi R2 yang sudah ada dipertahankan.

Koneksi kedua akun runtime ke Neon, akses baca tabel baru, constraint yang mengizinkan Koprodi, serta keberadaan konfigurasi R2 lulus pemeriksaan. Seluruh layanan development lokal kembali healthy.

## Pembersihan teks antarmuka — 21 November 2026

Paragraf rujukan pedoman pada dashboard mahasiswa dihapus. Nomor SOP pada judul, label tahapan, dan katalog data master serta catatan implementasi pada halaman lain dibersihkan. Syarat akademik, indikator penilaian, dan kutipan sumber pada asisten tetap tersedia.

Typecheck, build produksi Nuxt, tes capstone-service, dan pemeriksaan whitespace lulus. Pemeriksaan dilakukan melalui kode, build, dan HTTP; tidak menggunakan interaksi browser.

Admin/koordinator juga perlu menerbitkan bobot penilaian dan konversi huruf yang disetujui program studi. Teks pedoman menetapkan 16 indikator dan kategori nilai, tetapi tidak menetapkan kedua aturan agregasi tersebut. Aturan sintetis pada tes tidak diterapkan sebagai aturan akademik ke Neon.
