import { IconoCargando } from "@/components/iconos";

/** Pantalla de carga mientras llega una página: aparece al instante al tocar un enlace. */
export function CargandoPagina({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 px-4 pt-24 text-[var(--ink-2)]"
    >
      <IconoCargando size={30} className="animate-spin text-[var(--accent)]" />
      <p className="text-sm font-medium">{texto}</p>
    </div>
  );
}
