# Pemetaan kebutuhan ke implementasi tahap pertama

Permintaan pemilik membatasi implementasi saat ini pada autentikasi dan halaman admin manajemen pengguna. Panduan/draft membahas sistem capstone yang lebih luas; keberadaan alur tersebut bukan perintah untuk mengimplementasikannya pada tahap ini.

## Sumber yang diperiksa

Dokumen asli sekarang berada pada folder `docs/` di root workspace; nama di bawah merujuk ke folder tersebut (diagram SOP di `docs/SOP/`).

- `capstone.sql`: inventaris domain, users, user_roles, auth_identities, students, lecturers, study_programs, dan integritasnya; tabel proses capstone digunakan untuk peta batas layanan berikutnya.
- `SOP-001_Registrasi_Pengguna.png`: dibaca secara visual. Admin membuat akun mahasiswa/dosen; tanpa registrasi mandiri; identitas akademik unik; password awal di-hash.
- `SOP-002_Login_dan_Logout_Pengguna.png`: dibaca secara visual. Login email/password pada halaman yang sama; hanya akun aktif; akses mengikuti peran; logout mengakhiri sesi.
- `SOP-003_Pengelolaan_Profil_Pengguna.png`: dibaca secara visual. Pengguna menyunting profil sendiri dengan batas field sesuai peran.
- `SOP-004_Pengelolaan_Data_Master_Akademik.png`: ditinjau sebagai calon batas modul berikutnya.
- Inventaris SOP-005–020 dipetakan dari nama alur dan tabel SQL, bukan diklaim telah direview setiap detail diagramnya; implementasi tahap ini tidak bergantung pada detail alur tersebut.
- `Panduan Capstone Project PSTI Unud Edisi Agustus.pdf`: ekstraksi teks 70 halaman, terutama bab 2 pada halaman PDF 11–15. Kelompok 2–5 mahasiswa, dua pembimbing, penguji, persetujuan maju ujian, dan expo membantu memisahkan domain akademik dari akun.
- `Tugas Akhir Draft.pdf`: ekstraksi teks 47 halaman; batasan masalah pada halaman PDF 13–14, teknologi pada sekitar halaman PDF 34–35, serta rancangan dan lima alur pada halaman PDF 40–43. Draft DOCX adalah sumber alternatif dokumen yang sama; tidak disunting.
- `apple-design.md`, `design-reference.jpg`, dan referensi login dalam percakapan dipakai untuk desain.

Draft masih menyebut Next.js dalam abstrak dan beberapa rancangan, tetapi membahas Vue/Nuxt pada bagian teknologi. Implementasi memilih Nuxt sesuai instruksi terbaru pemilik. Draft tetap tidak diubah.

## Matriks tahap ini

| Aturan | Implementasi |
| --- | --- |
| Akun dibuat admin | POST users hanya ADMIN; bootstrap admin privat sekali |
| Jenis akun mahasiswa/dosen | Validasi roles; UI jenis pengguna; Koprodi tambahan DOSEN |
| Mahasiswa: nama, NIM, email, angkatan | Field wajib dan validasi database/API |
| Dosen: nama, email, NIP/NIDN bila tersedia | Field opsional unik jika terisi |
| Password awal disimpan sebagai hash | Auth credentials bcrypt cost 12 |
| Email bukan username terpisah | Lookup email dinormalisasi, indeks email case-insensitive |
| Akun nonaktif tidak mendapat akses | Login dan setiap request bisnis memeriksa is_active |
| Pengguna hanya mengubah profil sendiri | `/me` mengambil UUID dari sesi, mengabaikan input role/status/UUID |
| Telepon mahasiswa/dosen, keahlian dosen | Batas field di server, bukan hanya UI |
| Logout mengakhiri autentikasi | Hapus sesi server dan cookie; replay cookie lama ditolak |
| Pengelolaan pengguna dapat ditelusuri | Audit create/update/status/profile/reset; 20 aktivitas terbaru |

Belum ada pengiriman kredensial melalui email/WhatsApp, email verification, atau pemulihan password mandiri. Admin menyampaikan kredensial awal secara pribadi dan bisa mengatur ulang password dari editor pengguna. Tidak ada hard delete untuk menjaga riwayat.

## Modul berikutnya yang disarankan

| Calon layanan | Domain / SOP terkait | Status |
| --- | --- | --- |
| academic-service | program studi, periode akademik, bidang minat; SOP-004 | Paling tepat sesudah fondasi akun stabil; belum dibuat |
| project-service | kelompok, anggota, usulan/validasi topik, penugasan pembimbing; SOP-005–009 | Belum dibuat |
| guidance-service | logbook dan validasi pembimbing; SOP-010 | Belum dibuat |
| document-service | metadata berkas, versi, template, akses object storage; SOP-011 | Belum dibuat |
| examination-service | pendaftaran, jadwal, penilaian, revisi seminar/ujian; SOP-012–017 | Belum dibuat |
| publication-service | persetujuan karya, galeri/expo; SOP-018 | Belum dibuat |
| rag-service (Python) | pedoman disetujui, ingestion/retrieval, kutipan jawaban; SOP-019 | Belum dibuat |
| reporting-service/read models | pemantauan dan pelaporan; SOP-020 | Belum dibuat |

Peta ini menunjukkan kepemilikan domain, bukan kewajiban menjadikan setiap tabel sebuah service. Jangan membuat repositori/service kosong hanya untuk menambah jumlah microservice. Batas final modul akademik perlu divalidasi lagi terhadap SOP lengkap saat modul tersebut mulai dikerjakan. Tidak ada menu frontend untuk modul yang belum tersedia.
