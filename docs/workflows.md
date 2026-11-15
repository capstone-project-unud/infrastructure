# Workflow lokal, akademik, dan CI

Aplikasi saat ini digunakan melalui Docker Desktop lokal. Frontend tersedia di http://localhost:3000/login. Auth, user, dan capstone memakai database Neon masing-masing; berkas privat memakai driver lokal atau Cloudflare R2. VPS belum digunakan.

## Menjalankan development

Jalankan dari root workspace yang berisi frontend, infrastructure, dan backend dengan empat repo layanan:

```powershell
.\infrastructure\scripts\Start-Dev.ps1
```

Startup memeriksa Docker Linux, kelengkapan berkas konfigurasi, dan validitas Compose; membangun hanya image aplikasi yang belum tersedia; menjalankan enam layanan; menunggu health check; memeriksa admin awal; lalu memantau status. Image aplikasi bertag dev memakai pull_policy never. Base image dan Redis tetap memerlukan unduhan ketika belum tersedia.

| Kebutuhan | Perintah |
| --- | --- |
| Startup tanpa watcher | ./infrastructure/scripts/Start-Dev.ps1 -NoWatch |
| Bangun ulang image setelah perubahan Dockerfile | ./infrastructure/scripts/Start-Dev.ps1 -Build |
| Backend dan Redis saja | ./infrastructure/scripts/Start-Dev.ps1 -SkipFrontend |
| Status sekali | ./infrastructure/scripts/Watch-ServiceStatus.ps1 -Once |
| Log HTTP | ./infrastructure/scripts/Watch-Requests.ps1 |
| Log error sekali | ./infrastructure/scripts/Watch-Requests.ps1 -ErrorsOnly -Once |
| Hentikan development | ./infrastructure/scripts/Stop-Dev.ps1 |

Ctrl+Shift+B di VS Code menjalankan task startup/status, lalu viewer request pada terminal kedua. Ctrl+C menutup watcher, sementara container tetap berjalan. SkipFrontend tidak menghentikan frontend yang sudah aktif. Saat menjalankan backend saja, gunakan viewer dengan -Service api-gateway,auth-service,user-service,capstone-service.

Terminal > Run Task juga menyediakan Capstone: Verify Workspace, Capstone: Verify Integration, dan Capstone: Stop Dev. Task pengujian memerlukan Go dan Node pada host sesuai versi proyek.

Source Go dibaca Air dan frontend memakai Nuxt dev server. Perubahan environment dibaca setelah container dibuat ulang oleh startup. Perubahan SQL tidak diterapkan oleh Air atau Start-Dev: buat migrasi baru dan jalankan bootstrap selektif untuk layanan terkait. Migrasi yang sudah diterapkan memiliki checksum dan tidak boleh disunting.

Untuk instalasi database pertama, ikuti [capstone-workflow.md](capstone-workflow.md). Pertahankan .env yang sudah tersedia. Bootstrap administratif dan pengujian integrasi merupakan perintah terpisah dari startup rutin.

## Lima peran

| Peran | Wewenang dalam alur wajib |
| --- | --- |
| Superuser/admin | Mengelola akun/peran dan bidang minat; memantau data. Keputusan akademik tetap memerlukan peran koordinator/dosen/TU yang sesuai. |
| Mahasiswa | Mengusulkan judul kelompok, mengunggah deskripsi, mengubah calon pembimbing dirinya, mencatat bimbingan, mengunggah dua berkas UP, dan mencetak log. |
| Dosen | Melihat/mengekspor daftar judul; menyetujui judul dan menyatakan kesediaan untuk posisi terkait; memeriksa serta mencetak log mahasiswa bimbingannya. |
| Koordinator TA/Capstone | Meninjau judul, meminta revisi, menyetujui judul/kesediaan saat finalisasi, menetapkan pembimbing per mahasiswa, dan memfinalisasi melalui tabel kerja. |
| TU (Tata Usaha) | Melihat/mengekspor daftar judul dan memvalidasi kedua berkas persyaratan UP secara terpisah. |

Koordinator TA mengurus keputusan akademik judul/pembimbing. TU mengurus pemeriksaan administratif berkas. KOPRODI merupakan jabatan tambahan dosen; jabatan tersebut tidak otomatis memberikan wewenang koordinator TA atau TU.

## Pendaftaran judul hingga finalisasi

1. Mahasiswa memperoleh pengesahan calon pembimbing pada dokumen deskripsi.
2. Pengusul mengisi judul, ringkasan, bidang minat, kelompok 2–5 mahasiswa termasuk dirinya, calon pembimbing masing-masing anggota, serta PDF deskripsi. Calon pembimbing yang belum ditentukan dapat dilengkapi melalui akun mahasiswa terkait.
3. Pengajuan memerlukan deskripsi dan pernyataan pengesahan. Pemeriksaan tanda tangan tetap dilakukan manusia.
4. Dosen terkait memberi dua keputusan independen: persetujuan judul dan kesediaan membimbing. Satu persetujuan tidak mengubah keputusan lainnya. Koordinator juga dapat memberikan kedua keputusan saat rapat finalisasi.
5. Koordinator menetapkan pembimbing 1 dan/atau 2 per mahasiswa pada tabel finalisasi. Setiap mahasiswa minimal memiliki satu pembimbing dengan kedua keputusan disetujui. Pembimbing antaranggota boleh berbeda; dua posisi pada mahasiswa yang sama harus diisi dosen berbeda.
6. Koordinator memfinalisasi judul. Dosen, TU, dan koordinator dapat mengunduh XLSX seluruh data atau hasil filter bidang minat. PDF penetapan tersedia setelah finalisasi; format surat masih sementara sampai detail resmi diberikan.
7. Sebelum ada pengajuan UP, koordinator dapat membuka kembali penetapan dengan alasan, melengkapi pembimbing kedua, lalu memfinalisasi kembali.

Status judul: DRAFT → SUBMITTED → FINALIZED. Permintaan perbaikan memakai REVISION lalu pengajuan ulang. Perubahan data memakai versi; permintaan dengan versi lama ditolak 409. Keputusan terikat pada mahasiswa/posisi dalam satu tabel project_students.

## Bimbingan dan persyaratan UP

Setelah finalisasi, mahasiswa mengisi tanggal, topik, progres, kendala, serta rencana bimbingan kepada pembimbing yang ditetapkan. Dosen terkait menyetujui atau meminta revisi. Mahasiswa dan dosen dapat mengunduh PDF satu log atau semua hasil filter yang boleh mereka baca.

Sebelum mengajukan dua berkas persyaratan UP, mahasiswa harus memiliki dua pembimbing dan judul telah difinalisasi:

- Screenshot pendaftaran TA pada SIMAK dengan status diterima, berupa PDF/PNG/JPEG.
- Surat persetujuan pembimbing berupa PDF.

TU memvalidasi setiap berkas sendiri-sendiri: VALID atau REVISION dengan catatan. Mengganti satu berkas mengulang validasi berkas tersebut dan mempertahankan keputusan berkas lainnya. Status lengkap hanya jika keduanya VALID.

Dua berkas valid menunjukkan kelengkapan administrasi dalam modul ini. Pemeriksaan mata kuliah, B-100–B-400 lengkap, penjadwalan/nilai ujian, kelulusan, Expo, dan RAG masih modul lanjutan. Aplikasi belum menetapkan kelayakan ujian berdasarkan seluruh pedoman. Rincian: [cakupan wajib](../../backend/capstone-service/docs/coverage.md).

## Pengujian terisolasi

Pasang Go sesuai go.mod dan Node sesuai frontend/.node-version. Jalankan npm ci dari frontend. Kemudian, dari root workspace:

```powershell
.\infrastructure\scripts\Verify-Workspace.ps1
.\infrastructure\scripts\Verify-Workspace.ps1 -Integration
```

Perintah pertama menjalankan tes helper PowerShell, unit test/vet/build empat backend, tes kalender, typecheck, dan build produksi frontend. Opsi Integration menambahkan PostgreSQL/Redis sementara, API alur wajib, dan pemeriksaan halaman SSR. Ini pengujian HTTP, bukan pengujian klik atau tampilan browser.

VerificationTools mempertahankan output warning native dan memeriksa exit code, sehingga menyimpan log pada Windows PowerShell tidak menjadikan warning sebagai kegagalan. Tes regresi stderr/exit code dijalankan pada CI dan runner workspace.

| Lingkungan | Project / alamat | Data dan storage |
| --- | --- | --- |
| Development | capstone, frontend localhost:3000 | Neon dan driver storage yang dikonfigurasi |
| Pengujian API | capstone-verify, localhost:18080; bootstrap user localhost:18082 | PostgreSQL sementara, seluruh migrasi dari source, storage lokal sementara |
| Pengujian SSR | localhost:13000 | Build frontend menuju gateway uji localhost:18080 |

Runner membuat token acak dan ledger checksum seluruh migrasi pada .run, tanpa membaca .env operasional untuk layanan uji. Ia menolak stack uji yang sudah ada, lalu membersihkan stack yang dibuatnya dalam finally. Berkas fixture akun dan hasil ekspor tetap di .run yang diabaikan Git.

Runner menyamakan VERIFY_ORIGIN gateway dan Origin request API dengan alamat SSR http://127.0.0.1:13000. Pemeriksaan Origin pada BFF/gateway tetap aktif. Pengujian manual tanpa runner memakai default http://localhost:3000; gunakan origin yang sama pada gateway uji dan frontend uji.

Jika percobaan manual meninggalkan stack uji, jalankan dari root workspace:

```powershell
docker compose -p capstone-verify -f infrastructure/compose.verify.yaml down --volumes
```

Perintah itu menghapus hanya container/volume project pengujian yang disebutkan. Hindari down --volumes pada project development karena volume capstone-uploads dapat berisi unggahan lokal.

Node dapat dipilih melalui -NodeExecutable jika instalasi host berbeda. Prepare-Verification memulihkan variabel kompilasi dan mendukung binary linux/amd64 maupun linux/arm64 sesuai Docker daemon.

## GitHub Actions

Setiap repo menyimpan workflow sendiri di .github/workflows:

| Repo | Pemeriksaan otomatis push main / pull request |
| --- | --- |
| Empat backend | go test -race -count=1 ./..., go vet, build cmd/api; versi Go dari go.mod |
| Frontend | npm ci, npm test, typecheck, build; versi Node dari .node-version |
| Infrastructure | Parser seluruh skrip PowerShell, tes pemilihan image/log, sintaks Python, validasi Compose tanpa membaca env file |

Workflow manual Workspace integration pada repo infrastructure mengambil keenam repo ke struktur workspace yang sama, lalu menjalankan Verify-Workspace -Integration pada runner GitHub. Kode repo pendamping berasal dari default branch saat checkout; commit tiap checkout terlihat pada log Actions. Untuk repo pendamping privat, isi secret TEST_REPOSITORIES_TOKEN dengan hak Contents: read pada repo terkait; github.token hanya dapat membaca repo asal jika repo lain privat.

Workflow tersebut tidak membutuhkan rahasia Neon/R2 atau server VPS. Ia membangun dan menguji aplikasi pada runner sementara. File workflow baru harus di-commit/push ke repo masing-masing sebelum muncul di Actions. Hasil lokal tidak membuktikan workflow telah berjalan di GitHub.

Rujukan teknis: [Compose pull policy](https://docs.docker.com/reference/compose-file/services/#pull_policy), [Compose up --wait](https://docs.docker.com/reference/cli/docker/compose/up/), [setup-go](https://github.com/actions/setup-go), [setup-node](https://github.com/actions/setup-node), dan [checkout repo privat](https://github.com/actions/checkout#checkout-multiple-repos-private).
