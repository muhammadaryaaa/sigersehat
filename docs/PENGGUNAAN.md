# Dokumentasi Penggunaan SIGERSEHAT

SIGERSEHAT adalah platform kesehatan preventif untuk masyarakat Lampung. **Bukan diagnosis** dan tidak menggantikan tenaga kesehatan.

## Peran & akses
- **Masyarakat**: mendaftar/login, skrining, pemantauan, keluarga, edukasi, tanya AI, pengingat, peta, perangkat IoT, memberi izin nakes.
- **Tenaga kesehatan**: fitur masyarakat + dasbor nakes; akses pasien **hanya** bila pasien memberi persetujuan aktif (dapat dicabut kapan pun) dan akun nakes terverifikasi admin.
- **Administrator**: mengelola pengguna, verifikasi nakes, fasilitas, konten, sumber AI, laporan, audit — **tanpa** akses data kesehatan individu.
- **Super Administrator**: administrator + pengaturan sistem dan perubahan peran.

## Alur utama masyarakat
1. **Daftar** (nama, tanggal lahir, jenis kelamin, kabupaten/kota) lalu masuk.
2. **Periksa Risiko (SIGERCHECK)**: isi pengukuran & jawaban → hasil per indikator + kategori risiko + anjuran tindak lanjut. Tanda bahaya (mis. nyeri dada, TD ≥180/110) menampilkan arahan IGD/119.
3. **Catat & Pantau (SIGERMONITOR)**: catat pengukuran berkala, lihat grafik tren dari data sendiri, koreksi nilai dengan alasan (riwayat koreksi tersimpan).
4. **Keluarga**: tambah profil anak (wajib centang persetujuan wali) dan lansia.
5. **Perempuan**: catat siklus (prediksi diberi label perkiraan), kehamilan & kunjungan ANC (jadwal ANC otomatis menjadi pengingat).
6. **Tumbuh Kembang**: status gizi anak (z-score standar WHO 2006 rujukan Permenkes 2/2020, subset 0–24 bulan) + daftar imunisasi Kepmenkes 1098/2024.
7. **Lansia**: jadwal obat (SIGERSEHAT tidak mengubah dosis) dan target kesehatan.
8. **Gizi**: target harian garam/gula/sayur-buah/air + pencarian pangan TKPI Kemenkes.
9. **Tanya AI (SIGERAI)**: jawaban hanya dari sumber terkurasi dengan sitasi; menolak resep; gawat darurat diarahkan ke 119; batas 20 pesan/hari (diatur admin). Opsi "gunakan hasil skrining terakhir" memerlukan persetujuan eksplisit per percakapan.
10. **Peta Faskes**: hanya fasilitas terverifikasi yang tampil; laporkan koreksi bila menemukan data keliru.
11. **Perangkat IoT**: daftarkan perangkat/simulator, simpan token yang tampil satu kali, data masuk otomatis ke Pantau. Data simulator selalu berlabel SIMULASI.
12. **Izin & Nakes**: berikan/cabut persetujuan nakes terverifikasi; pencabutan menghentikan akses seketika.

## Keamanan akun
- Kelola sesi aktif di halaman Akun & Sesi; keluar dari perangkat lain bila perlu.
- Lupa kata sandi memakai tautan/token sekali pakai (pengiriman email memerlukan penyedia email yang dikonfigurasi saat deployment).
