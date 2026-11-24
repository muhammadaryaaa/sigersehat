import { Link } from "react-router-dom";

// Halaman informasi & legal. Isi ditulis dari fakta proyek yang terverifikasi;
// nama penyelenggara dan kontak resmi adalah SLOT yang menunggu penetapan
// pemilik platform — sengaja tidak dikarang (lihat laporan revisi visual).

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
      <div className="mt-6 flex flex-col gap-5 leading-relaxed">{children}</div>
    </main>
  );
}

export function AboutPage() {
  return (
    <Shell title="Tentang SIGERSEHAT">
      <p>SIGERSEHAT adalah platform kesehatan digital terintegrasi untuk masyarakat Provinsi Lampung. Tujuannya membantu warga mengenali faktor risiko penyakit sejak dini, memahami hasil pemeriksaannya, memantau kondisi dari waktu ke waktu, dan mengetahui fasilitas kesehatan yang dapat dituju — melalui satu website yang dapat dibuka dari ponsel.</p>
      <h2 className="text-2xl font-bold">Apa yang dikerjakan platform ini</h2>
      <ul className="list-disc pl-5">
        <li>Skrining awal risiko penyakit tidak menular (PTM) dan diabetes dengan instrumen yang dirujuk dari Kemenkes RI dan FINDRISC.</li>
        <li>Pencatatan dan grafik pemantauan tekanan darah, berat badan, gula darah, dan ukuran tubuh lain yang diinput pengguna sendiri.</li>
        <li>Edukasi kesehatan yang bersumber dari Kemenkes RI dan WHO, serta asisten AI yang hanya mengambil jawaban dari sumber edukasi tersebut.</li>
        <li>Informasi fasilitas kesehatan terpilih yang diverifikasi satu per satu, dengan sumber dan tanggal verifikasi yang ditampilkan terbuka.</li>
        <li>Pengingat jadwal kontrol, imunisasi, dan pemeriksaan berkala di dalam website.</li>
      </ul>
      <h2 className="text-2xl font-bold">Penyelenggara dan kontak</h2>
      <p>Nama penyelenggara, susunan tim, dan kontak resmi platform ini sedang disiapkan oleh pemilik platform dan akan ditampilkan di halaman ini setelah ditetapkan. Untuk sementara, pertanyaan dan laporan kesalahan data fasilitas dapat disampaikan melalui fitur laporan pada halaman <Link to="/peta" className="font-semibold text-brand-800 underline">Peta Fasilitas Kesehatan</Link>.</p>
      <h2 className="text-2xl font-bold">Sumber data</h2>
      <p>Angka dan rujukan kesehatan di platform ini berasal dari dokumen resmi: Survei Kesehatan Indonesia 2023 (Kemenkes RI), Profil Kesehatan Provinsi Lampung 2023 (Dinas Kesehatan Provinsi Lampung), statistik BPS Provinsi Lampung 2024, dan pedoman WHO. Setiap angka ditampilkan bersama sumber dan tahunnya. Data fasilitas kesehatan bersumber dari OpenStreetMap dan diverifikasi per titik.</p>
      <h2 className="text-2xl font-bold">Program kesehatan resmi yang dapat diakses warga</h2>
      <ul className="list-disc pl-5">
        <li><strong>Cek Kesehatan Gratis (Kemenkes RI)</strong> — program pemeriksaan kesehatan gratis di puskesmas yang berjalan sejak Februari 2025. Informasi resmi: <a href="https://kemkes.go.id" target="_blank" rel="noreferrer" className="font-semibold text-brand-800 underline">kemkes.go.id</a>.</li>
        <li><strong>Posbindu PTM dan Posyandu</strong> — titik deteksi dini faktor risiko PTM dan layanan ibu-anak di lingkungan warga; jadwal mengikuti puskesmas dan kader setempat.</li>
        <li><strong>BPJS Kesehatan</strong> — informasi kepesertaan dan layanan JKN: <a href="https://bpjs-kesehatan.go.id" target="_blank" rel="noreferrer" className="font-semibold text-brand-800 underline">bpjs-kesehatan.go.id</a>. SIGERSEHAT tidak terhubung dengan sistem BPJS.</li>
      </ul>
      <p className="rounded-card bg-cream p-4">SIGERSEHAT <strong>bukan</strong> layanan kesehatan resmi pemerintah dan tidak terhubung dengan rekam medis, SATUSEHAT, atau BPJS. Baca <Link to="/batasan-layanan" className="font-semibold text-brand-800 underline">Batasan Layanan</Link> dan <Link to="/kebijakan-privasi" className="font-semibold text-brand-800 underline">Kebijakan Privasi</Link> sebelum menggunakan fitur yang menyimpan data kesehatan.</p>
    </Shell>
  );
}

export function ServiceLimitsPage() {
  return (
    <Shell title="Batasan Layanan">
      <p>Halaman ini menjelaskan dengan terang apa yang dapat dan tidak dapat dilakukan SIGERSEHAT. Dengan menggunakan platform ini, Anda dianggap memahami batasan berikut.</p>
      <h2 className="text-2xl font-bold">Bukan diagnosis, bukan pengganti tenaga kesehatan</h2>
      <p>Fitur Periksa Risiko menghasilkan <strong>perkiraan tingkat risiko awal</strong> berdasarkan jawaban dan ukuran yang Anda masukkan. Hasilnya bersifat edukatif, bukan diagnosis, dan tidak dapat dipakai sebagai dasar pengobatan. Keputusan medis hanya dapat diambil oleh tenaga kesehatan melalui pemeriksaan langsung.</p>
      <h2 className="text-2xl font-bold">Asisten AI (Tanya AI)</h2>
      <ul className="list-disc pl-5">
        <li>Jawaban disusun hanya dari sumber edukasi terkurasi (Kemenkes RI, WHO, dan materi edukasi platform yang telah ditelaah), dan sumbernya ditampilkan.</li>
        <li>Asisten AI tidak memberikan diagnosis, tidak meresepkan obat, dan tidak menentukan dosis.</li>
        <li>Bila pertanyaan menyebut tanda bahaya, asisten mengarahkan Anda ke layanan gawat darurat, bukan menjawab secara medis.</li>
      </ul>
      <h2 className="text-2xl font-bold">Keadaan darurat</h2>
      <p>Untuk nyeri dada, sesak napas berat, penurunan kesadaran, kelemahan mendadak pada satu sisi tubuh, gangguan bicara mendadak, atau perdarahan hebat: <strong>hubungi 119 atau datangi IGD terdekat segera</strong>. Jangan menunggu jawaban dari platform ini.</p>
      <h2 className="text-2xl font-bold">Data fasilitas kesehatan</h2>
      <p>Peta menampilkan <strong>sebagian fasilitas terpilih</strong> yang telah diverifikasi satu per satu — bukan direktori lengkap seluruh Lampung. Alamat dan koordinat bersumber dari OpenStreetMap dengan tanggal verifikasi yang ditampilkan. Nomor telepon dan jam layanan hanya ditampilkan bila terverifikasi; bila tidak tercantum, artinya belum terverifikasi, bukan tidak ada.</p>
      <h2 className="text-2xl font-bold">Perangkat IoT</h2>
      <p>Platform dapat menerima data dari perangkat yang didaftarkan pengguna (misalnya oksimeter dan termometer berbasis ESP32). Perangkat prototipe tersebut <strong>bukan alat medis tervalidasi</strong>. Bila tidak ada perangkat fisik, fitur simulator menampilkan data contoh yang selalu berlabel SIMULASI. Rencana integrasi perangkat yang lebih luas dijelaskan di halaman Perangkat IoT setelah Anda masuk.</p>
      <h2 className="text-2xl font-bold">Ketepatan informasi</h2>
      <p>Konten edukasi ditelaah sebelum diterbitkan dan dicantumkan sumber serta tanggalnya, namun pedoman kesehatan dapat berubah. Untuk keputusan penting, cocokkan dengan pedoman terbaru Kemenkes RI atau konsultasikan ke puskesmas.</p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Kebijakan Privasi">
      <p>Kebijakan ini menjelaskan data apa yang dikumpulkan SIGERSEHAT, untuk apa, berapa lama disimpan, dan bagaimana Anda mengendalikannya, sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP). Data kesehatan termasuk <strong>data pribadi yang bersifat spesifik</strong> dan diperlakukan dengan perlindungan lebih tinggi.</p>
      <h2 className="text-2xl font-bold">Data yang dikumpulkan</h2>
      <ul className="list-disc pl-5">
        <li><strong>Data akun</strong>: nama, email, nomor telepon (bila diisi), tanggal lahir, jenis kelamin, dan wilayah — untuk membuat akun dan menyesuaikan skrining (usia dan jenis kelamin memengaruhi penafsiran risiko).</li>
        <li><strong>Data kesehatan yang Anda masukkan</strong>: hasil pengukuran (tekanan darah, berat badan, gula darah, dan lain-lain), jawaban dan hasil skrining, catatan siklus dan kehamilan, data tumbuh kembang anak, obat lansia, catatan gizi, serta bacaan perangkat IoT yang Anda daftarkan.</li>
        <li><strong>Data penggunaan</strong>: percakapan dengan asisten AI, pengingat yang Anda buat, dan catatan akses keamanan (log audit) untuk melindungi akun Anda.</li>
      </ul>
      <h2 className="text-2xl font-bold">Tujuan dan dasar pemrosesan</h2>
      <p>Data diproses hanya untuk menjalankan fitur yang Anda gunakan: menampilkan hasil skrining dan grafik pemantauan Anda, mengirim pengingat di dalam website, dan — hanya bila Anda memberi persetujuan aktif — menampilkan data Anda kepada tenaga kesehatan yang Anda pilih. Pemrosesan data kesehatan dilakukan berdasarkan <strong>persetujuan eksplisit</strong> Anda; persetujuan dapat dicabut kapan saja melalui halaman Izin &amp; Nakes, dan pencabutan menghentikan akses tenaga kesehatan saat itu juga.</p>
      <h2 className="text-2xl font-bold">Siapa yang dapat melihat data Anda</h2>
      <ul className="list-disc pl-5">
        <li>Anda sendiri, setelah masuk ke akun Anda.</li>
        <li>Tenaga kesehatan yang terverifikasi, hanya untuk pasien yang memberi persetujuan aktif dan hanya sebatas cakupan yang disetujui. Setiap akses tercatat.</li>
        <li>Administrator platform <strong>tidak dapat</strong> membaca data kesehatan individu; yang mereka kelola adalah akun, konten, dan data fasilitas.</li>
        <li>Statistik gabungan (SIGERINSIGHT) bersifat anonim dan diagregasi; kelompok data yang terlalu kecil disembunyikan agar tidak dapat ditelusuri ke individu.</li>
      </ul>
      <p>Data Anda tidak dijual dan tidak dibagikan ke pihak ketiga untuk pemasaran. Data kesehatan tidak pernah ditempatkan pada alamat URL, catatan log, atau penyimpanan browser.</p>
      <h2 className="text-2xl font-bold">Penyimpanan dan keamanan</h2>
      <p>Data disimpan selama akun Anda aktif. Kata sandi disimpan sebagai hash kriptografis (tidak dapat dibaca balik), sesi masuk memakai token acak yang di-hash di server, akses dibatasi berdasarkan peran (RBAC), dan seluruh koneksi berjalan melalui HTTPS. Cadangan basis data mengikuti kebijakan retensi penyedia infrastruktur (Cloudflare D1 Time Travel).</p>
      <h2 className="text-2xl font-bold">Hak Anda</h2>
      <ul className="list-disc pl-5">
        <li><strong>Mengakses dan meninjau</strong> data Anda kapan saja melalui halaman akun, riwayat, dan pemantauan.</li>
        <li><strong>Memperbaiki</strong> data pengukuran yang keliru melalui mekanisme koreksi di halaman pemantauan (perubahan tercatat, nilai lama tidak dihapus diam-diam).</li>
        <li><strong>Mencabut persetujuan</strong> berbagi data dengan tenaga kesehatan kapan saja.</li>
        <li><strong>Menghapus akun dan data</strong>: penghapusan akun beserta data kesehatannya dapat diajukan dari halaman akun; permintaan diproses setelah verifikasi identitas pemilik akun.</li>
      </ul>
      <h2 className="text-2xl font-bold">Perubahan kebijakan</h2>
      <p>Perubahan material pada kebijakan ini akan diumumkan di halaman ini beserta tanggal berlakunya. Terakhir diperbarui: 24 November 2026.</p>
    </Shell>
  );
}
