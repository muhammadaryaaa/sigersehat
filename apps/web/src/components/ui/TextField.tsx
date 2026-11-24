import { useId } from "react";
type Props = { label: string; error?: string; unit?: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>;
// Label selalu terlihat; galat terhubung aria (Tahap 3 komponen TextField + pola frontend-a11y).
export function TextField({ label, error, unit, required, ...props }: Props) {
  const id = useId(); const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      <div className="flex items-center gap-2">
        <input id={id} aria-required={required} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
          className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base" {...props} />
        {unit ? <span className="text-sm text-ink-600">{unit}</span> : null}
      </div>
      {error ? <p id={errorId} role="alert" className="text-sm text-danger-700">{error}</p> : null}
    </div>
  );
}
