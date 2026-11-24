import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";

// Halaman 404 terdesain (revisi putaran 2): identitas situs + jalan kembali yang berguna.
export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Halaman tidak ditemukan" description="Alamat yang kamu buka tidak ada atau sudah dipindahkan." />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-display text-7xl font-bold text-accent-800">404</p>
        <p className="mt-3 text-ink-600">Mungkin tautannya salah ketik, atau halamannya sudah berganti nama. Pilihan yang paling sering dicari:</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[["/skrining", "Skrining awal", "Perkirakan tingkat risiko PTM dan diabetes tanpa akun."], ["/edukasi", "Edukasi kesehatan", "Artikel bersumber Kemenkes RI dan WHO."], ["/peta", "Peta fasilitas kesehatan", "Fasilitas kesehatan di seluruh Lampung dari data terbuka."], ["/", "Beranda", "Kembali ke halaman utama SIGERSEHAT."]].map(([to, t, d]) => (
            <Link key={to} to={to} className="card-hover rounded-card border border-line bg-white p-5 shadow-card">
              <span className="font-bold text-brand-800">{t}</span>
              <span className="mt-1 block text-[15px] text-ink-600">{d}</span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-500">Keadaan darurat? Hubungi <a href="tel:119" className="font-bold text-accent-800 underline">119</a>.</p>
      </main>
    </>
  );
}
