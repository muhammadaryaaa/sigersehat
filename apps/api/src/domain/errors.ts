import type { ErrorCode } from "@sigersehat/contracts";
export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  details?: { field: string; message: string; code: string }[];
  constructor(status: number, code: ErrorCode, message: string, details?: { field: string; message: string; code: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const notFound = () => new ApiError(404, "not_found", "Data tidak ditemukan.");
export const forbidden = () => new ApiError(403, "forbidden", "Anda tidak memiliki hak untuk tindakan ini.");
export const unauthorized = () => new ApiError(401, "unauthorized", "Sesi tidak valid. Silakan masuk kembali.");
