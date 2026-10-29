"use client";

import { useEffect, useState } from "react";
import { IconoAlerta, IconoCheckCirculo, IconoX } from "@/components/iconos";

type Tipo = "error" | "ok" | "info";
interface Aviso {
  id: number;
  mensaje: string;
  tipo: Tipo;
}

const EVENTO = "puente:aviso";
let contador = 0;

/** Muestra un aviso flotante (reemplaza a window.alert, que bloquea la página). */
export function avisar(mensaje: string, tipo: Tipo = "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Aviso>(EVENTO, { detail: { id: ++contador, mensaje, tipo } }));
}

export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    const alRecibir = (e: Event) => {
      const aviso = (e as CustomEvent<Aviso>).detail;
      setAvisos((prev) => [...prev.slice(-2), aviso]);
      window.setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== aviso.id)), 6000);
    };
    window.addEventListener(EVENTO, alRecibir);
    return () => window.removeEventListener(EVENTO, alRecibir);
  }, []);

  if (avisos.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[300] flex flex-col items-center gap-2 px-4"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl border bg-[var(--surface-solid)] p-3.5 text-sm shadow-2xl animate-fade-in ${
            a.tipo === "error"
              ? "border-red-500/40 text-red-600 dark:text-red-400"
              : a.tipo === "ok"
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-[var(--line)] text-[var(--ink)]"
          }`}
        >
          {a.tipo === "ok" ? (
            <IconoCheckCirculo size={18} className="mt-0.5 flex-shrink-0" />
          ) : (
            <IconoAlerta size={18} className="mt-0.5 flex-shrink-0" />
          )}
          <p className="flex-1 font-medium">{a.mensaje}</p>
          <button
            type="button"
            onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))}
            aria-label="Cerrar aviso"
            className="flex-shrink-0 rounded-lg p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <IconoX size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
