import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { homeForRole } from "./LoginPage";

type Region = { id: string; name: string; type: string };
export function RegisterPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", birthDate: "", sex: "female", regionId: "", accountType: "masyarakat", profession: "perawat", credentialType: "STR", credentialNumber: "", workplaceName: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const navigate = useNavigate(); const { refresh } = useAuth();
  useEffect(() => { fetch("/api/v1/regions").then((r) => r.json()).then((j) => setRegions(j.data ?? [])).catch(() => {}); }, []);
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setFieldErrors({});
    try {
      const res = await apiFetch<{ role: string }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ ...form, regionId: form.regionId || null }) });
      await refresh(); navigate(homeForRole(res.role));
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        const details = err.details as { field: string; message: string }[] | undefined;
        if (details) setFieldErrors(Object.fromEntries(details.map((d) => [d.field, d.message])));
      } else setError("Tidak dapat mendaftar. Periksa koneksi Anda.");
    } finally { setBusy(false); }
  }
  const labelCls = "text-sm font-medium";
  const selectCls = "min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base";
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-xl font-extrabold tracking-tight text-brand-800">SIGERSEHAT</p>
      <h1 className="mt-4 text-3xl font-bold">Daftar</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5"><label className={labelCls} htmlFor="accountType">Jenis akun</label>
          <select id="accountType" className={selectCls} value={form.accountType} onChange={set("accountType")}>
            <option value="masyarakat">Masyarakat</option><option value="nakes">Tenaga Kesehatan</option>
          </select></div>
        <TextField label="Nama lengkap" autoComplete="name" required value={form.fullName} onChange={set("fullName")} error={fieldErrors.fullName} />
        <TextField label="Email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} error={fieldErrors.email} />
        <TextField label="Kata sandi" type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} error={fieldErrors.password} />
        <TextField label="Tanggal lahir" type="date" required value={form.birthDate} onChange={set("birthDate")} error={fieldErrors.birthDate} />
        <div className="flex flex-col gap-1.5"><label className={labelCls} htmlFor="sex">Jenis kelamin</label>
          <select id="sex" className={selectCls} value={form.sex} onChange={set("sex")}>
            <option value="female">Perempuan</option><option value="male">Laki-laki</option>
          </select></div>
        <div className="flex flex-col gap-1.5"><label className={labelCls} htmlFor="regionId">Kabupaten/Kota</label>
          <select id="regionId" className={selectCls} value={form.regionId} onChange={set("regionId")}>
            <option value="">— Pilih wilayah —</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.type === "kota" ? "Kota" : "Kab."} {r.name}</option>)}
          </select></div>
        {form.accountType === "nakes" ? <>
          <div className="flex flex-col gap-1.5"><label className={labelCls} htmlFor="profession">Profesi</label>
            <select id="profession" className={selectCls} value={form.profession} onChange={set("profession")}>
              <option value="dokter">Dokter</option><option value="perawat">Perawat</option><option value="bidan">Bidan</option><option value="tenaga_gizi">Tenaga Gizi</option><option value="kader">Kader</option><option value="lainnya">Lainnya</option>
            </select></div>
          <TextField label="Nomor kredensial (STR/SIP)" required value={form.credentialNumber} onChange={set("credentialNumber")} error={fieldErrors.credentialNumber} />
          <TextField label="Tempat praktik/kerja" value={form.workplaceName} onChange={set("workplaceName")} />
          <p className="rounded-card bg-info-50 p-3 text-sm text-info-800">Akun tenaga kesehatan aktif setelah kredensial diverifikasi administrator. Unggah dokumen kredensial menyusul dari halaman status verifikasi.</p>
        </> : null}
        {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Daftar"}</Button>
      </form>
      <p className="mt-4 text-sm">Sudah punya akun? <Link className="text-brand-700 underline" to="/masuk">Masuk</Link></p>
    </main>
  );
}
