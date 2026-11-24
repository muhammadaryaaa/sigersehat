import type { ReactNode } from "react";

// Pita judul halaman bersama (konsistensi desain putaran 2): judul serif,
// deskripsi singkat, dan pembatas motif tapis — dipakai semua halaman fitur
// agar tidak ada halaman yang tampil polos dengan gaya sendiri-sendiri.
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-5 pt-7">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-ink-600">{description}</p> : null}
        {children}
      </div>
      <div className="tapis-band" aria-hidden="true" />
    </div>
  );
}
