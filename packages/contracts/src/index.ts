// Kontrak bersama web <-> api (Tahap 2 REC-02): satu-satunya sumber bentuk respons & kode error.
export interface ApiSuccess<T> { data: T; meta?: PaginationMeta }
export interface PaginationMeta { has_next: boolean; next_cursor: string | null }
export interface ApiErrorBody { error: { code: ErrorCode; message: string; details?: { field: string; message: string; code: string }[] } }
export type ErrorCode =
  | "bad_request" | "unauthorized" | "forbidden" | "not_found" | "conflict"
  | "validation_error" | "rate_limited" | "internal_error" | "service_unavailable"
  | "review_required" | "consent_required" | "usage_limit";
export type Role = "masyarakat" | "nakes" | "admin" | "super_admin";
export const MODULE_CODES = ["dashboard","check","monitor","ai","edu","women","grow","elder","nutri","reminder","map","med","insight","admin"] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];
