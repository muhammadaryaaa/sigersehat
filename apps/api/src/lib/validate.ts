import { ApiError } from "../domain/errors";
export type FieldError = { field: string; message: string; code: string };
export function validationError(details: FieldError[]): ApiError {
  return new ApiError(400, "validation_error", "Periksa kembali isian Anda.", details);
}
export function requireString(body: Record<string, unknown>, field: string, label: string, errors: FieldError[], opts: { min?: number; max?: number } = {}): string {
  const v = body[field];
  if (typeof v !== "string" || v.trim() === "") { errors.push({ field, message: `${label} wajib diisi.`, code: "required" }); return ""; }
  const t = v.trim();
  if (opts.min && t.length < opts.min) errors.push({ field, message: `${label} minimal ${opts.min} karakter.`, code: "min_length" });
  if (opts.max && t.length > opts.max) errors.push({ field, message: `${label} maksimal ${opts.max} karakter.`, code: "max_length" });
  return t;
}
export function isEmail(v: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Kata sandi minimal 8 karakter.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Kata sandi harus mengandung huruf dan angka.";
  return null;
}
export function isDate(v: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)); }
