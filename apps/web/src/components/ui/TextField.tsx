import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
type Props = { label: string; error?: string; unit?: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>;
// Label selalu terlihat; galat terhubung aria (Tahap 3 komponen TextField + pola frontend-a11y).
// Kolom kata sandi mendapat tombol tampilkan/sembunyikan (Master Prompt UI/UX butir 7.2).
export function TextField({ label, error, unit, required, ...props }: Props) {
  const id = useId(); const errorId = `${id}-error`;
  const [show, setShow] = useState(false);
  const isPassword = props.type === "password";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <input id={id} aria-required={required} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
            className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base" {...props} type={isPassword && show ? "text" : props.type} />
          {isPassword ? (
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={show}
              className="absolute right-1 top-1/2 inline-flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-btn text-ink-500 hover:bg-brand-50 hover:text-ink-900">
              {show ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          ) : null}
        </div>
        {unit ? <span className="text-sm text-ink-600">{unit}</span> : null}
      </div>
      {error ? <p id={errorId} role="alert" className="text-sm text-danger-700">{error}</p> : null}
    </div>
  );
}
