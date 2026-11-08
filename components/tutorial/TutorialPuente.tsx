"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  IconoCompartir,
  IconoCopiar,
  IconoCorazon,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoFoto,
  IconoTarjeta,
  IconoVerificado,
  IconoArchivo,
  IconoCheck,
  IconoX,
} from "@/components/iconos";
import { avisarNavegacion } from "@/components/layout/BarraNavegacion";

/**
 * Tutorial corto sobre la causa de ejemplo. Ilumina cada parte de la página con un foco,
 * un texto grande y corto, y un dedito que muestra dónde tocar.
 * Pensado para cualquier edad: pocas palabras, botones grandes, se puede saltar siempre.
 */

type Paso = {
  objetivo?: string; // data-tutorial del elemento a iluminar; sin objetivo = tarjeta centrada
  titulo: string;
  texto: string;
  icono: React.ReactNode;
  color: string;
  dedo?: boolean; // mostrar el dedito tocando
};

const PASOS: Paso[] = [
  {
    titulo: "¡Hola! Así funciona Puente",
    texto: "En 1 minuto te mostramos cómo ayudar. Usamos una causa de ejemplo, así que nada es real.",
    icono: <LogoAnimado />,
    color: "#2E62F2",
  },
  {
    objetivo: "fotos",
    titulo: "Esto es una causa",
    texto: "Alguien que necesita ayuda cuenta qué le pasa, con fotos y su historia.",
    icono: <IconoFoto size={26} />,
    color: "#2E62F2",
  },
  {
    objetivo: "autor",
    titulo: "Quién la publica",
    texto: "El sello verde quiere decir que revisamos su cédula y su cara. Es una persona real.",
    icono: <IconoVerificado size={26} />,
    color: "#0F9F6E",
  },
  {
    objetivo: "donar",
    titulo: "Tu ayuda llega directo",
    texto: "El dinero va directo a su cuenta. Puente no lo toca y no cobra nada.",
    icono: <IconoTarjeta size={26} />,
    color: "#2E62F2",
  },
  {
    objetivo: "copiar",
    titulo: "Copia y paga desde tu banco",
    texto: "Toca aquí para copiar el número. Luego abre tu banco o Nequi y pégalo.",
    icono: <IconoCopiar size={26} />,
    color: "#7C3AED",
    dedo: true,
  },
  {
    objetivo: "ya-done",
    titulo: "Avísale que donaste",
    texto: "Toca este botón cuando dones. La persona confirma que le llegó y te da las gracias.",
    icono: <IconoCorazon size={26} />,
    color: "#E9785C",
    dedo: true,
  },
  {
    objetivo: "insumos",
    titulo: "También puedes llevar cosas",
    texto: "Comida, ropa o lo que pidan. Aquí dice dónde y cuándo entregarlas.",
    icono: <IconoArchivo size={26} />,
    color: "#B7791F",
  },
  {
    objetivo: "compartir",
    titulo: "Compártela",
    texto: "Mándala por WhatsApp o redes. Entre más personas la vean, más ayuda llega.",
    icono: <IconoCompartir size={26} />,
    color: "#0F9F6E",
    dedo: true,
  },
  {
    titulo: "¡Listo! Ya sabes ayudar",
    texto: "Ahora mira causas reales cerca de ti. Y si eres tú quien necesita ayuda, publica tu causa.",
    icono: <IconoCheck size={30} />,
    color: "#0F9F6E",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const MARGEN = 10;

export function TutorialPuente({ siguiente }: { siguiente: string }) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [pasos, setPasos] = useState<Paso[]>(PASOS);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [movil, setMovil] = useState(false);
  const botonPrincipal = useRef<HTMLButtonElement>(null);

  // Solo los pasos cuyo elemento existe en esta causa (si no pide insumos, ese paso se salta)
  useEffect(() => {
    setMontado(true);
    setMovil(window.innerWidth < 640);
    setPasos(PASOS.filter((p) => !p.objetivo || document.querySelector(`[data-tutorial="${p.objetivo}"]`)));
  }, []);

  const paso = pasos[indice];
  const ultimo = indice === pasos.length - 1;

  const medir = useCallback(() => {
    if (!paso?.objetivo) return setRect(null);
    const el = document.querySelector(`[data-tutorial="${paso.objetivo}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // En el celular la tarjeta ocupa la parte de abajo: el foco no puede pasar de ahí
    const limiteAbajo = window.innerWidth < 640 ? window.innerHeight * 0.56 : window.innerHeight - 16;
    const top = Math.max(8, r.top - MARGEN);
    const bottom = Math.min(limiteAbajo, r.bottom + MARGEN);
    setRect({
      top,
      left: Math.max(8, r.left - MARGEN),
      width: Math.min(window.innerWidth - 16, r.width + MARGEN * 2),
      height: Math.max(44, bottom - top),
    });
  }, [paso]);

  // Al cambiar de paso: llevar el elemento a la vista y luego medirlo
  useLayoutEffect(() => {
    if (!montado || !paso) return;
    if (!paso.objetivo) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${paso.objetivo}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      // El foco queda arriba (debajo del encabezado) para que la explicación quepa debajo
      const destino = window.scrollY + r.top - 96;
      const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, destino), behavior: suave ? "smooth" : "auto" });
    }
    const t1 = window.setTimeout(medir, 120);
    const t2 = window.setTimeout(medir, 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [indice, montado, paso, medir]);

  useEffect(() => {
    const alCambiar = () => {
      setMovil(window.innerWidth < 640);
      medir();
    };
    window.addEventListener("resize", alCambiar);
    window.addEventListener("scroll", medir, { passive: true });
    return () => {
      window.removeEventListener("resize", alCambiar);
      window.removeEventListener("scroll", medir);
    };
  }, [medir]);

  useEffect(() => {
    botonPrincipal.current?.focus({ preventScroll: true });
  }, [indice]);

  const terminar = useCallback(
    (destino?: string) => {
      try {
        localStorage.setItem("puente:tutorial-visto", "1");
      } catch {}
      if (destino) {
        avisarNavegacion();
        router.push(destino);
      } else {
        // Quita ?tutorial=1 de la dirección sin recargar
        const url = new URL(window.location.href);
        url.searchParams.delete("tutorial");
        url.searchParams.delete("next");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        setIndice(-1);
      }
    },
    [router]
  );

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminar(siguiente !== "/" ? siguiente : undefined);
      if (e.key === "ArrowRight" && !ultimo) setIndice((i) => i + 1);
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [terminar, siguiente, ultimo]);

  if (!montado || !paso || indice < 0) return null;

  const centrado = !paso.objetivo || !rect;
  // Escritorio: la tarjeta va debajo del foco si cabe; si no, encima
  const ALTO_TARJETA = 340;
  const debajo = rect ? rect.top + rect.height + ALTO_TARJETA + 16 < window.innerHeight : true;
  const arriba = rect ? rect.top > ALTO_TARJETA + 16 : false;
  const estiloTarjeta: React.CSSProperties =
    centrado || movil
      ? {}
      : !debajo && !arriba
      ? // El elemento ocupa casi toda la pantalla: la tarjeta va en la esquina
        { position: "fixed", right: 24, bottom: 24, width: 420 }
      : {
          position: "fixed",
          left: Math.min(Math.max(16, rect!.left), window.innerWidth - 16 - 420),
          top: debajo ? rect!.top + rect!.height + 16 : undefined,
          bottom: debajo ? undefined : window.innerHeight - rect!.top + 16,
          width: 420,
        };

  return createPortal(
    <div className="fixed inset-0 z-[400]" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
      {/* Fondo oscuro con el foco (el hueco deja ver el elemento) */}
      {centrado ? (
        <div className="absolute inset-0 bg-[#0a1633]/75 backdrop-blur-[2px] tut-aparecer" />
      ) : (
        <div
          className="tut-foco absolute rounded-3xl"
          style={{
            top: rect!.top,
            left: rect!.left,
            width: rect!.width,
            height: rect!.height,
            boxShadow: "0 0 0 9999px rgba(10,22,51,0.74)",
            ["--tut-color" as string]: paso.color,
          }}
        >
          <span className="tut-anillo absolute inset-0 rounded-3xl" />
        </div>
      )}

      {/* Dedito que toca el elemento */}
      {paso.dedo && rect && (
        <div
          aria-hidden="true"
          className="tut-dedo pointer-events-none absolute"
          style={{ top: rect.top + rect.height / 2 - 6, left: rect.left + rect.width / 2 - 8 }}
        >
          <svg width="54" height="62" viewBox="0 0 54 62" fill="none">
            <path
              d="M20 30V8a5 5 0 0 1 10 0v18l2-1.5a5 5 0 0 1 7 1l.5.7 1.4-.9a5 5 0 0 1 7 1.8l.6 1 .9-.4a5 5 0 0 1 6.6 4.6V44c0 9.4-7.6 17-17 17h-4.3a17 17 0 0 1-13-6.1L9.2 39.5a5 5 0 0 1 7.3-6.8z"
              fill="#FFFFFF"
              stroke="#0A1633"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Clics fuera no hacen nada (evita tocar la página por accidente) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tarjeta con el texto */}
      <div
        key={indice}
        style={estiloTarjeta}
        className={
          centrado
            ? "pointer-events-none absolute inset-0 flex items-center justify-center p-4"
            : movil
            ? "absolute inset-x-0 bottom-0 tut-subir"
            : "tut-subir"
        }
      >
        <div
          className={`relative bg-[var(--surface-solid)] border border-[var(--line)] shadow-2xl p-5 sm:p-6 ${
            movil && !centrado ? "rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]" : "rounded-3xl"
          } ${centrado ? "pointer-events-auto w-full max-w-md tut-subir" : ""}`}
        >
          <button
            type="button"
            onClick={() => terminar(siguiente !== "/" ? siguiente : undefined)}
            className="absolute right-3 top-3 flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] cursor-pointer"
            aria-label="Saltar tutorial"
          >
            Saltar
            <IconoX size={16} />
          </button>

          <div
            className="tut-pop mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: paso.color }}
          >
            {paso.icono}
          </div>

          <h2 id="tutorial-titulo" className="pr-20 text-[22px] leading-tight font-bold text-[var(--ink)]">
            {paso.titulo}
          </h2>
          <p className="mt-2 text-[17px] leading-relaxed text-[var(--ink-2)]" aria-live="polite">
            {paso.texto}
          </p>

          {/* Progreso */}
          <div className="mt-4 flex items-center gap-1.5" aria-label={`Paso ${indice + 1} de ${pasos.length}`}>
            {pasos.map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === indice ? 22 : 8,
                  backgroundColor: i <= indice ? paso.color : "var(--track)",
                }}
              />
            ))}
          </div>

          {/* Botones grandes */}
          {ultimo ? (
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                ref={botonPrincipal}
                type="button"
                onClick={() => terminar(siguiente && siguiente !== "/" ? siguiente : "/explorar")}
                className="flex h-13 min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[var(--cta)] px-5 text-base font-bold text-white shadow-lg hover:brightness-110 cursor-pointer"
              >
                Ver causas reales
                <IconoFlechaDerecha size={18} />
              </button>
              <button
                type="button"
                onClick={() => terminar("/causa/nueva")}
                className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--field)] px-5 text-base font-semibold text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
              >
                Publicar mi causa
              </button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2.5">
              {indice > 0 && (
                <button
                  type="button"
                  onClick={() => setIndice((i) => i - 1)}
                  className="flex min-h-[52px] items-center justify-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--field)] px-4 text-base font-semibold text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
                  aria-label="Paso anterior"
                >
                  <IconoFlechaIzquierda size={18} />
                  <span className="max-[359px]:hidden">Atrás</span>
                </button>
              )}
              <button
                ref={botonPrincipal}
                type="button"
                onClick={() => setIndice((i) => i + 1)}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold text-white shadow-lg hover:brightness-110 cursor-pointer"
                style={{ backgroundColor: paso.color }}
              >
                {indice === 0 ? "Empezar" : "Siguiente"}
                <IconoFlechaDerecha size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** El logo de Puente dibujándose: dos orillas y el puente que las une */
function LogoAnimado() {
  return (
    <svg width="34" height="22" viewBox="0 0 30 18" aria-hidden="true">
      <path
        className="tut-dibujar"
        d="M4 14 C 9 1.5, 21 1.5, 26 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="4" cy="14" r="2.8" fill="currentColor" />
      <circle cx="26" cy="14" r="2.8" fill="#9BD3FF" className="tut-pop" />
    </svg>
  );
}
