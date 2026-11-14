# Menjalankan dan menghubungkan alur capstone

Auth service menyimpan kredensial/sesi, user service menyimpan identitas/peran, capstone service (:8083) menyimpan proses akademik dalam schema `capstone_service`, dan gateway meneruskan permintaan dengan pembatasan akses Redis. UUID/API internal menjadi kontrak lintas layanan; tidak ada foreign key atau query lintas database.

## Konfigurasi Neon dan Docker

1. Database pemilik untuk layanan ini bernama `capstone_service`. `infrastructure/.env` menyimpan `CAPSTONE_DATABASE_NAME`, `CAPSTONE_BOOTSTRAP_DATABASE_URL` (endpoint direct), serta `CAPSTONE_RUNTIME_DATABASE_HOST` (pooler). URL layanan lain tetap terpisah.
2. Setelah perubahan remote disetujui sesuai [activation-review.md](activation-review.md), jalankan `python -m pip install -r infrastructure/requirements.txt`, lalu `python infrastructure/scripts/bootstrap.py --service capstone` dan `python infrastructure/scripts/bootstrap.py --service user`. Mode selektif menerapkan hanya migrasi layanan yang dipilih. Migrasi memiliki checksum; jangan mengubah migrasi yang telah diterapkan.
3. Jalankan `infrastructure/scripts/Start-Dev.ps1 -Build`. Auth, user, capstone, gateway, Redis, dan frontend dijalankan di jaringan privat. Hanya frontend port 3000 diterbitkan oleh Compose utama.
4. Admin membuat akun dan mengisi bidang minat resmi. Form dosen dapat menambahkan peran KOORDINATOR_TA. Akun koordinator tersendiri juga tersedia. KOPRODI tidak otomatis menjadi koordinator TA.

Migrasi capstone dan tambahan role user pada Neon belum diterapkan; schema capstone belum ada menurut pemeriksaan READ ONLY. Pengujian memakai PostgreSQL lokal terisolasi. `.env` sudah disiapkan dan diabaikan Git; layanan operasional masih menunggu migrasi. Nilai rahasia tidak berada di source.

## Cloudflare R2

Driver default pengembangan adalah `local` dengan volume `capstone-uploads`. Untuk R2, isi `backend/capstone-service/.env`:

```dotenv
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=isi_account_id
R2_BUCKET=isi_bucket_privat
R2_ACCESS_KEY_ID=isi_access_key
R2_SECRET_ACCESS_KEY=isi_secret_key
```

Gunakan token yang dibatasi pada bucket terkait. Endpoint S3 `https://<account>.r2.cloudflarestorage.com` dan region `auto` mengikuti [dokumentasi R2](https://developers.cloudflare.com/r2/get-started/s3/). AWS SDK Go v2 mengirim/membaca objek melalui backend; bucket tetap privat. Browser tidak menerima kredensial atau tautan publik, sehingga upload langsung/presigned URL dan CORS bucket tidak diperlukan pada desain ini.

Maksimal 10 MB per berkas. Ekstensi dan signature MIME diperiksa: PDF/PNG/JPEG; deskripsi dan surat persetujuan harus PDF. Objek bernama UUID; nama asli menjadi metadata unduhan. API memeriksa hak baca berdasarkan pemilik, relasi proyek, dan peran. Penggantian berkas menghasilkan ID baru, dan audit mempertahankan referensi sebelumnya.

Konfigurasi R2 nyata sudah tersimpan pada `.env` lokal. Adapter lulus pengujian endpoint S3 tiruan serta put/get/delete satu objek sintetis pada bucket pemilik; objek uji sudah dihapus. Cloudflare API token tidak diperlukan/disimpan, runtime memakai kredensial S3. Pemindaian malware, kuota storage per akun, dan pembersihan otomatis unggahan tanpa relasi belum tersedia. Jangan menghapus volume lokal jika unggahan masih diperlukan.

## Redis

Compose mengisi `REDIS_URL=redis://redis:6379/0`. Gateway membatasi 180 permintaan per menit per IP menggunakan satu skrip Lua atomik `INCR` + `EXPIRE`, sesuai [pola Redis](https://redis.io/docs/latest/commands/incr/). Redis tidak menyimpan keputusan akademik; sesi tetap diperiksa ke auth dan profil aktif ke user service. Port Redis tidak diterbitkan ke host.

Tanpa `REDIS_URL`, pengembangan host memakai limiter memori. Jika Redis dikonfigurasi tetapi gagal, request mendapat 503. Limiter login auth masih merupakan lapisan tambahan per instance. Deployment lintas mesin memerlukan jaringan privat, autentikasi, dan TLS yang sesuai.

## Kontrak API

Awalan `/api/v1/capstone`; autentikasi cookie HttpOnly yang sudah ada. Mutasi JSON, kecuali `POST /files` menggunakan multipart field `file`. Semua mutasi data yang sudah ada membawa `version`; konflik mendapat 409. Transaksi/penguncian lokal menjaga perubahan data dan audit tetap satu kesatuan.

| Kelompok endpoint | Perilaku dan akses |
| --- | --- |
| `/dashboard` | GET ringkasan per peran; mahasiswa/dosen lingkup pribadi, admin/koordinator/TU/Koprodi agregat program studi. Tidak memberi kewenangan mutasi baru. |
| `/directory?role=MAHASISWA\|DOSEN&q=...` | Pencarian identitas minimum pengguna aktif; maksimal 100 hasil, gunakan kata kunci untuk nama lain |
| `/interests` | GET semua pengguna; POST dan PUT `/:id` oleh admin/koordinator |
| `/files`, `/files/:id` | POST mahasiswa; GET hanya pemilik/relasi/peran yang berhak |
| `/projects`, `/projects/:id` | GET anggota sendiri atau seluruh judul untuk staf; POST mahasiswa; PUT pengusul pada DRAFT/REVISION |
| `/projects/:id/submit`, `/revision` | Pengusul mengajukan, koordinator meminta revisi dengan alasan |
| `/projects/:id/candidates` | PUT mahasiswa anggota, identitas mahasiswa berasal dari sesi |
| `/projects/:id/decision` | PUT dosen terkait/koordinator: student_id, slot, kind=title/confirmation, status=APPROVED/REJECTED, note |
| `/projects/:id/assignment` | PUT koordinator: student_id, slot 1/2, supervisor_id atau null |
| `/projects/:id/finalize`, `/reopen` | POST koordinator; pembukaan kembali memerlukan alasan dan belum ada pengajuan UP |
| `/projects/export` | GET staf; XLSX semua hasil filter q/interest_id/status, bukan pagination aktif; batas 10000 judul |
| `/projects/:id/letter`, `/history` | GET anggota/staf: PDF setelah finalisasi dan 100 aktivitas terakhir |
| `/guidance`, `/guidance/:id` | GET pemilik/dosen terkait atau admin/koordinator; POST/PUT mahasiswa pemilik; filter project_id/student_id/id |
| `/guidance/:id/review` | PUT dosen log terkait: status APPROVED/REVISION dan note; catatan revisi wajib |
| `/guidance/export` | GET sesuai hak baca log; PDF satu atau semua hasil filter, batas 1000 log |
| `/proposals` | GET mahasiswa pemilik/TU/admin/koordinator; POST mahasiswa dengan dua berkas dan dua pembimbing; batas daftar 1000 |
| `/proposals/:id/review` | PUT hanya TU: kind=simak/approval, status=VALID/REVISION, note |

Daftar proyek berhalaman 20. Tabel `project_students` menyatukan mahasiswa dan dua posisi pembimbing; keunikan `(student_id,slot)` membatasi mahasiswa pada satu kelompok pada tahap ini. Riwayat proyek lintas periode/kelulusan belum tersedia. Nama/NIM pada detail merupakan snapshot, UUID tetap identitas utama.

Tidak ada sinkronisasi SIMAK atau pembacaan otomatis screenshot/tanda tangan. Dua status VALID menunjukkan kelengkapan berkas, bukan kelulusan atau jadwal ujian. Format surat penetapan berlabel sementara sampai kop, nomor, dasar, dan penandatangan resmi tersedia.

## Pengujian terisolasi

Go 1.26, Node sesuai `.node-version`, Docker Desktop:

```powershell
.\infrastructure\scripts\Prepare-Verification.ps1
docker compose -f infrastructure/compose.verify.yaml up -d
node infrastructure/scripts/capstone_smoke.mjs
```

Setiap smoke test memerlukan stack uji baru. Hentikan/hapus hanya stack `capstone-verify` dengan `docker compose -f infrastructure/compose.verify.yaml down -v` sebelum pengulangan. Stack ini tidak memakai `.env` Neon; database/container uji tidak memuat data operasional. Fixture/sesi dan ekspor disimpan pada `.run` yang diabaikan Git. Port loopback: gateway 18080 dan user service privat untuk bootstrap uji 18082.

Untuk BFF lokal terhadap stack uji, jalankan frontend dengan `NUXT_GATEWAY_URL=http://127.0.0.1:18080`. Jangan memakai konfigurasi uji untuk data operasional.
