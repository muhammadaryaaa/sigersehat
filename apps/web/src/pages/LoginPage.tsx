import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { AuthLayout } from "../components/ui/AuthLayout";

export function homeForRole(role: string): string {
  if (role === "nakes") return "/nakes/beranda";
  if (role === "admin" || role === "super_admin") return "/admin/beranda";
  return "/beranda";
}

// Tujuan kembali sesudah masuk: hanya jalur internal yang aman.
export function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const navigate = useNavigate(); const { refresh } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await apiFetch<{ role: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      await refresh(); navigate(next ?? homeForRole(res.role));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Tidak dapat masuk. Periksa koneksi Anda.");
    } finally { setBusy(false); }
  }
  return (
    <AuthLayout title="Masuk">
      {next ? <p className="mt-2 rounded-card bg-brand-50 p-3 text-[15px] text-brand-800">Masuk dulu untuk membuka halaman itu — setelah masuk kamu akan langsung diarahkan ke sana.</p> : null}
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Kata sandi" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="inline-block py-1 font-semibold text-brand-800 underline" to="/lupa-kata-sandi">Lupa kata sandi?</Link></p>
      <p className="mt-1 text-sm">Belum punya akun? <Link className="inline-block py-1 font-semibold text-brand-800 underline" to={next ? `/daftar?next=${encodeURIComponent(next)}` : "/daftar"}>Daftar</Link></p>
    </AuthLayout>
  );
}
