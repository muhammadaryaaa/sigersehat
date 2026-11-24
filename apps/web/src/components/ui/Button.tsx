import type { ButtonHTMLAttributes } from "react";
type Variant = "primary" | "secondary" | "info" | "danger";
const styles: Record<Variant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700",
  secondary: "bg-white text-ink-900 border border-line hover:bg-canvas",
  info: "bg-info-700 text-white hover:bg-info-800",
  danger: "bg-danger-700 text-white hover:opacity-90",
};
export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`min-h-12 rounded-btn px-5 text-base font-semibold disabled:opacity-50 ${styles[variant]} ${className}`} {...props} />;
}
