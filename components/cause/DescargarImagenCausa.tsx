"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconoCargando, IconoDescargar, IconoX } from "@/components/iconos";
import { avisar } from "@/components/ui/Avisos";

type Formato = "historia" | "publicacion";

const OPCIONES: { id: Formato; titulo: string; detalle: string; ancho: number; alto: number }[] = [
  { id: "historia", titulo: "Historia", detalle: "Vertical · WhatsApp e Instagram", ancho: 27, alto: 48 },
  { id: "publicacion", titulo: "Publicación", detalle: "4:5 · Feed y Facebook", ancho: 34, alto: 42 },
];

/**
 * Botón para bajar una imagen de la causa con cómo donar, el enlace y un QR.
 * En el celular abre el menú de compartir (desde ahí se guarda en Fotos o se manda por WhatsApp);
 * en el computador la descarga directo.
 */
export function DescargarImagenCausa({
  causeId,
  titulo,
  variante = "boton",
}: {
  causeId: string;
  titulo: string;
  variante?: "boton" | "icono";
}) {
  const [abierto, setAbierto] = useState(false);
  const [generando, setGenerando] = useState<Formato | null>(null);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!abierto) return;
    const alEscape = (e: KeyboardEvent) => e.key === "Escape" && !generando && setAbierto(false);
    window.addEventListener("keydown", alEscape);
    return () => window.removeEventListener("keydown", alEscape);
  }, [abierto, generando]);

  const descargar = async (formato: Formato) => {
    if (generando) return;
    setGenerando(formato);
    try {
      const res = await fetch(`/causa/${causeId}/imagen?formato=${formato}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const nombre = `puente-${formato}.png`;
      const archivo = new File([blob], nombre, { type: "image/png" });

      // Celular: menú nativo para guardar en Fotos o enviar directo
      const tactil = window.matchMedia("(pointer: coarse)").matches;
      if (tactil && typeof navigator.canShare === "function" && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: titulo });
          setAbierto(false);
          return;
        } catch (err) {
          // Si la persona cerró el menú no es un error
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      avisar("Imagen descargada. Ya la puedes compartir.", "ok");
      setAbierto(false);
    } catch (err) {
      console.error("Descargar imagen de la causa:", err);
      avisar("No pudimos crear la imagen. Inténtalo de nuevo.");
    } finally {
      setGenerando(null);
    }
  };

  return (
    <>
      {variante === "icono" ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="p-2.5 rounded-full glass-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title="Descargar imagen para compartir"
          aria-label="Descargar imagen para compartir"
        >
          <IconoDescargar size={20} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          <IconoDescargar size={18} />
          <span>Descargar imagen para compartir</span>
        </button>
      )}

      {abierto &&
        montado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-descargar-imagen"
            className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !generando) setAbierto(false);
            }}
          >
            <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface-solid)] border border-[var(--line)] shadow-2xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="titulo-descargar-imagen" className="text-base font-bold text-[var(--ink)]">
                    Imagen para compartir
                  </h3>
                  <p className="mt-1 text-xs text-[var(--ink-2)]">
                    Lleva la foto, cómo donar, el enlace y un código QR que abre esta causa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  disabled={Boolean(generando)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <IconoX size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {OPCIONES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => descargar(o.id)}
                    disabled={Boolean(generando)}
                    aria-busy={generando === o.id}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] p-4 text-center hover:border-[var(--accent)] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <span
                      className="flex items-center justify-center rounded-lg border-2 border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                      style={{ width: o.ancho, height: o.alto }}
                    >
                      {generando === o.id ? (
                        <IconoCargando size={16} className="animate-spin" />
                      ) : (
                        <IconoDescargar size={14} />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--ink)]">{o.titulo}</span>
                      <span className="block text-[11px] text-[var(--ink-3)]">
                        {generando === o.id ? "Creando imagen…" : o.detalle}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
