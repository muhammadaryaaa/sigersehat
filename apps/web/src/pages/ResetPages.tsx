import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

export function ForgotPage() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [devToken, setDevToken] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const r = await apiFetch<{ message: string; dev_reset_token?: string }>("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setMsg(r.message); setDevToken(r.dev_reset_token ?? ""); }
    catch { setMsg("Permintaan tidak dapat diproses. Coba lagi."); } finally { setBusy(false); }
  }
  return (<main className="mx-auto max-w-md px-4 py-10"><h1 className="text-3xl font-bold">Lupa Kata Sandi</h1>
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Buat Tautan Atur Ulang"}</Button></form>
    {msg ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{msg}</p> : null}
    {devToken ? <p className="mt-3 rounded-card bg-warn-50 p-3 text-warn-800">Mode lokal: token uji Anda <strong>{devToken}</strong> — <Link className="underline" to={`/atur-ulang?token=${devToken}`}>buka halaman atur ulang</Link>. (Di production token dikirim lewat email.)</p> : null}
  </main>);
}
export function ResetPage() {
  const token = new URLSearchParams(location.search).get("token") ?? "";
  const [password, setPassword] = useState(""); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await apiFetch("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); setMsg("Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru."); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Atur ulang gagal."); } finally { setBusy(false); }
  }
  return (<main className="mx-auto max-w-md px-4 py-10"><h1 className="text-3xl font-bold">Atur Ulang Kata Sandi</h1>
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <TextField label="Kata sandi baru" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      {msg ? <p role="status" className="rounded-card bg-brand-50 p-3 text-brand-800">{msg} <Link className="underline" to="/masuk">Masuk</Link></p> : null}
      <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Simpan Kata Sandi Baru"}</Button></form></main>);
}
