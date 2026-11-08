"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconoFoto,
  IconoVerificado,
  IconoTarjeta,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoX,
} from "@/components/iconos";

const CLAVE = "puente:intro-publicar-vista";

const PASOS = [
  {
    titulo: "1. Cuenta tu historia",
    texto: "Sube 2 fotos o más y explica qué necesitas, con palabras sencillas.",
    icono: <IconoFoto size={30} />,
    color: "#2E62F2",
  },
  {
    titulo: "2. Verifica que eres tú",
    texto: "Una sola vez: foto de tu cédula y una selfie. Toma unos 2 minutos. Necesitas tener 18 años.",
    icono: <IconoVerificado size={30} />,
    color: "#0F9F6E",
  },
  {
    titulo: "3. Di cómo ayudarte",
    texto: "Pon tu Nequi o tu cuenta (a tu nombre) o dónde recibir cosas. La ayuda te llega directo, sin comisiones.",
    icono: <IconoTarjeta size={30} />,
    color: "#E9785C",
  },
];

/** Presentación de 3 pasos la primera vez que alguien entra a publicar una causa. */
export function IntroPublicar() {
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CLAVE)) setVisible(true);
    } catch {}
  }, []);

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;
  const paso = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-publicar-titulo"
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-[#0a1633]/75 backdrop-blur-[2px] tut-aparecer sm:p-4"
    >
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface-solid)] border border-[var(--line)] shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] tut-subir">
        <button
          type="button"
          onClick={cerrar}
          className="absolute right-3 top-3 flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] cursor-pointer"
          aria-label="Cerrar"
        >
          Saltar
          <IconoX size={16} />
        </button>

        <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-3)]">Publicar es fácil</p>

        <div key={i} className="mt-4">
          <div
            className="tut-pop mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: paso.color }}
          >
            {paso.icono}
          </div>
          <h2 id="intro-publicar-titulo" className="text-[22px] font-bold leading-tight text-[var(--ink)] tut-subir">
            {paso.titulo}
          </h2>
          <p className="mt-2 text-[17px] leading-relaxed text-[var(--ink-2)] tut-subir">{paso.texto}</p>
        </div>

        <div className="mt-5 flex items-center gap-1.5">
          {PASOS.map((_, k) => (
            <span
              key={k}
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: k === i ? 22 : 8, backgroundColor: k <= i ? paso.color : "var(--track)" }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              aria-label="Anterior"
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--field)] px-4 text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
            >
              <IconoFlechaIzquierda size={18} />
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => (ultimo ? cerrar() : setI(i + 1))}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold text-white shadow-lg hover:brightness-110 cursor-pointer"
            style={{ backgroundColor: paso.color }}
          >
            {ultimo ? "¡Empezar!" : "Siguiente"}
            <IconoFlechaDerecha size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
