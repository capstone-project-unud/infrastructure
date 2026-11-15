# Startup image development lokal

Log yang diberikan pemilik memperlihatkan `pull access denied` untuk capstone-project-service:dev, kemudian Compose membangun Dockerfile.dev. Tag tersebut merupakan image lokal, bukan repository Docker Hub. Unduhan Redis dan base image Go pada startup pertama tetap diperlukan.

Perbaikan 14 November 2026, diperiksa ulang 15 November 2026:

- Lima image aplikasi pada compose.dev.yaml memakai pull_policy never. [Dokumentasi Compose](https://docs.docker.com/reference/compose-file/services/#pull_policy) menyatakan kebijakan ini memakai cache lokal dan gagal bila image tidak tersedia.
- Start-Dev.ps1 membaca konfigurasi Compose, mendeteksi image aplikasi yang belum ada, lalu membangun hanya layanan tersebut sebelum up --no-build. Rebuild eksplisit tetap tersedia melalui -Build. Redis tidak dimasukkan ke daftar build.
- Image yang sudah ada dipakai kembali. Tidak ada image, cache, volume, atau database yang dihapus.
- Preflight memeriksa berkas .env/Dockerfile layanan terpilih serta validitas Compose sebelum build/up. Nilai environment tidak dicetak; startup tidak menerapkan migrasi.
- Tes permanen tests/Test-DevTools.ps1 memeriksa pemilihan image, konfigurasi hilang/gagal, dan log. tests/Test-Compose.ps1 memeriksa pull_policy never pada source Compose, port privat, serta isolasi stack uji.

Verifikasi:

- PASS: parser PowerShell untuk Start-Dev.ps1 dan DevTools.psm1; Compose config quiet.
- PASS: skenario terisolasi deteksi satu image hilang, semua image tersedia, paksa rebuild lima aplikasi, SkipFrontend, Redis tetap image publik, dan konfigurasi gagal menghentikan startup.
- PASS aktual: image capstone-project-service:dev tersedia; Air menyelesaikan kompilasi source. Auth-service, user-service, dan Redis mencapai healthy.
- Penghambat lanjutan yang ditemukan saat diagnosis: capstone mencatat Cannot connect to database karena role/schema/tabel Neon belum ada. Setelah pemilik menyetujui migrasi, penyiapan berhasil dan kendala ini terselesaikan.

Pemilik kemudian menyetujui migrasi sesuai [activation-review.md](activation-review.md). Capstone 001 dan user 002 telah diterapkan; Start-Dev.ps1 -NoWatch selesai dengan keenam layanan healthy. Runtime Neon dan R2 lulus pemeriksaan. Container development dibiarkan aktif untuk digunakan pemilik. Tidak ada penghapusan image, cache, volume, atau database.

Pengulangan startup 15 November 2026 juga berhasil: enam container healthy, admin sudah tersedia dan dipertahankan. Workflow saat ini untuk Docker Desktop lokal; VPS belum digunakan. Panduan lengkap: [workflows.md](workflows.md).
