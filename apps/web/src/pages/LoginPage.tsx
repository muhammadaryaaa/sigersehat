import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

export function homeForRole(role: string): string {
  if (role === "nakes") return "/nakes/beranda";
  if (role === "admin" || role === "super_admin") return "/admin/beranda";
  return "/beranda";
}
export function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const navigate = useNavigate(); const { refresh } = useAuth();
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await apiFetch<{ role: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      await refresh(); navigate(homeForRole(res.role));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Tidak dapat masuk. Periksa koneksi Anda.");
    } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-xl font-extrabold tracking-tight text-brand-800">SIGERSEHAT</p>
      <h1 className="mt-4 text-3xl font-bold">Masuk</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Kata sandi" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="text-brand-700 underline" to="/lupa-kata-sandi">Lupa kata sandi?</Link></p>
      <p className="mt-2 text-sm">Belum punya akun? <Link className="text-brand-700 underline" to="/daftar">Daftar</Link></p>
    </main>
  );
}
