"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const EVENTO = "puente:navegando";

/** Para navegaciones con router.push: muestra la barra de carga hasta que cambie la página. */
export function avisarNavegacion() {
  window.dispatchEvent(new Event(EVENTO));
}

/**
 * Barra fina arriba de la pantalla que aparece apenas se toca un enlace interno
 * y se va cuando la nueva página ya está. Así nunca parece que la app se quedó quieta.
 */
export function BarraNavegacion() {
  const pathname = usePathname();
  const [activa, setActiva] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const ubicacion = useRef("");
  const seguro = useRef<number | undefined>(undefined);

  // La página cambió: termina la barra.
  useEffect(() => {
    ubicacion.current = window.location.pathname + window.location.search;
    if (!activa) return;
    setSaliendo(true);
    const t = window.setTimeout(() => {
      setActiva(false);
      setSaliendo(false);
    }, 280);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const empezar = () => {
      window.clearTimeout(seguro.current);
      setSaliendo(false);
      setActiva(true);
      // Si la navegación no cambia de ruta (solo filtros), se apaga sola.
      seguro.current = window.setTimeout(() => {
        setSaliendo(true);
        window.setTimeout(() => {
          setActiva(false);
          setSaliendo(false);
        }, 280);
      }, 8000);
    };

    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace || enlace.target === "_blank" || enlace.hasAttribute("download")) return;
      let destino: URL;
      try {
        destino = new URL(enlace.href, window.location.href);
      } catch {
        return;
      }
      if (destino.origin !== window.location.origin) return;
      const actual = window.location.pathname + window.location.search;
      if (destino.pathname + destino.search === actual) return;
      empezar();
    };

    document.addEventListener("click", alHacerClic, true);
    window.addEventListener(EVENTO, empezar);
    return () => {
      document.removeEventListener("click", alHacerClic, true);
      window.removeEventListener(EVENTO, empezar);
      window.clearTimeout(seguro.current);
    };
  }, []);

  if (!activa) return null;

  return (
    <div
      role="progressbar"
      aria-label="Cargando página"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden"
    >
      <div
        className={`barra-navegacion h-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] ${
          saliendo ? "barra-navegacion--fin" : ""
        }`}
      />
    </div>
  );
}
