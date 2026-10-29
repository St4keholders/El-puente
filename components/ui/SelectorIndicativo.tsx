"use client";

import { paisesTelefono } from "@/lib/geo/telefonos";
import { IconoFlechaAbajo } from "@/components/iconos";

const PAISES = paisesTelefono();

/**
 * Selector de indicativo: muestra corto ("CO +57") y al tocarlo abre la lista nativa
 * con el nombre de cada país, que en el celular es mucho más fácil de recorrer.
 */
export function SelectorIndicativo({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const actual = PAISES.find((p) => p.code === value);
  return (
    <div
      className={`relative flex flex-shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--field)] pl-3 pr-2 text-sm text-[var(--ink)] focus-within:border-[var(--accent)] ${
        disabled ? "opacity-60" : ""
      } ${className}`}
    >
      <span className="font-medium tabular-nums whitespace-nowrap">
        {actual ? `${actual.code} ${actual.dial}` : value}
      </span>
      <IconoFlechaAbajo size={14} className="text-[var(--ink-3)]" />
      <select
        aria-label="Indicativo del país"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {PAISES.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name} ({p.dial})
          </option>
        ))}
      </select>
    </div>
  );
}
