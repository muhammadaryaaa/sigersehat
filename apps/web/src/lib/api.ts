import type { ApiErrorBody, ApiSuccess } from "@sigersehat/contracts";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(body?.error.code ?? "internal_error", body?.error.message ?? "Terjadi kesalahan. Silakan coba lagi.", res.status, body?.error.details);
  }
  const body = (await res.json()) as ApiSuccess<T>;
  return body.data;
}
