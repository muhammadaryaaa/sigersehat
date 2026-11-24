import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";

export type Me = {
  user: { id: string; email: string; phone: string | null; role: string };
  profile: { id: string; full_name: string } | null;
  health_worker: { profession: string; verification_status: string } | null;
  csrf_token?: string | null;
};
type AuthState = { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const Ctx = createContext<AuthState>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(Ctx);

// Token CSRF disimpan di MEMORI saja. Di produksi, web dan API berada di domain
// berbeda sehingga document.cookie halaman tidak dapat membaca cookie API;
// token diterima dari respons /auth/me. Cadangan cookie hanya untuk dev lokal.
let csrfTokenMemory = "";
export function setCsrfToken(token: string | null | undefined) { if (token) csrfTokenMemory = token; }
export function getCsrf(): string {
  if (csrfTokenMemory) return csrfTokenMemory;
  return document.cookie.match(/csrf_token=([^;]+)/)?.[1] ?? "";
}
export async function apiMutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method, headers: { "X-CSRF-Token": getCsrf() }, body: body ? JSON.stringify(body) : undefined });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try { const data = await apiFetch<Me>("/api/v1/auth/me"); setCsrfToken(data.csrf_token); setMe(data); }
    catch { setMe(null); }
    finally { setLoading(false); }
  };
  const logout = async () => { try { await apiMutate("/api/v1/auth/logout", "POST"); } catch { /* abaikan: keadaan dibersihkan di bawah */ } csrfTokenMemory = ""; setMe(null); };
  useEffect(() => { refresh(); }, []);
  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}
