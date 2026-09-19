"use client";

import React from "react";

export function IlustracionExplorarVacio({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width="240"
      height="240"
      className={`stroke-[var(--ink-2)] fill-none ${className}`}
      aria-hidden="true"
    >
      {/* Globo con meridianos y tres puntos unidos como constelación */}
      <circle cx="140" cy="140" r="75" strokeWidth="1.4" opacity="0.8" />
      <ellipse cx="140" cy="140" rx="35" ry="75" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <line x1="65" y1="140" x2="215" y2="140" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />

      {/* Tres puntos unidos como constelación */}
      <line x1="110" y1="120" x2="160" y2="110" strokeWidth="1.4" className="stroke-[var(--accent)]" />
      <line x1="160" y1="110" x2="175" y2="155" strokeWidth="1.4" className="stroke-[var(--accent)]" />

      <circle cx="110" cy="120" r="3.5" className="fill-[var(--accent)] stroke-none" />
      <circle cx="175" cy="155" r="3.5" className="fill-[var(--accent)] stroke-none" />

      {/* Punto clave que se enciende y crece */}
      <circle cx="160" cy="110" r="5" className="fill-[var(--accent)] stroke-none" />
      <circle
        cx="160"
        cy="110"
        r="14"
        strokeWidth="1.2"
        className="stroke-[var(--accent)] opacity-40 animate-ping"
      />
    </svg>
  );
}

export function IlustracionCerradasVacio({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width="240"
      height="240"
      className={`stroke-[var(--ink-2)] fill-none ${className}`}
      aria-hidden="true"
    >
      {/* Frasco / alcancía con tapa puesta */}
      <rect x="95" y="110" width="90" height="100" rx="14" strokeWidth="1.4" />
      <line x1="100" y1="155" x2="180" y2="155" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />

      {/* Ranura central */}
      <line x1="125" y1="135" x2="155" y2="135" strokeWidth="2.5" className="stroke-[var(--accent)]" />

      {/* Tapa que encaja */}
      <g className="transition-transform duration-500 hover:translate-y-1">
        <rect x="90" y="94" width="100" height="16" rx="4" strokeWidth="1.4" />
        <line x1="130" y1="94" x2="150" y2="94" strokeWidth="2" className="stroke-[var(--accent)]" />
      </g>

      {/* Sello de cierre */}
      <circle cx="140" cy="178" r="12" strokeWidth="1.2" className="stroke-[var(--accent)]" />
      <path d="M 135 178 L 138 181 L 145 174" strokeWidth="1.4" className="stroke-[var(--accent)]" />
    </svg>
  );
}

export function IlustracionFinalizadasVacio({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width="240"
      height="240"
      className={`stroke-[var(--ink-2)] fill-none ${className}`}
      aria-hidden="true"
    >
      {/* Dos marcos, antes y después */}
      {/* Marco Antes */}
      <rect x="45" y="95" width="75" height="90" rx="8" strokeWidth="1.4" opacity="0.6" />
      <line x1="45" y1="95" x2="120" y2="185" strokeWidth="0.8" opacity="0.3" />
      <line x1="120" y1="95" x2="45" y2="185" strokeWidth="0.8" opacity="0.3" />

      {/* Marco Después */}
      <rect x="160" y="95" width="75" height="90" rx="8" strokeWidth="1.4" />
      <polygon points="197.5,120 178,138 217,138" strokeWidth="1.2" />
      <rect x="182" y="138" width="31" height="28" strokeWidth="1.2" />
      <rect x="193" y="148" width="9" height="18" strokeWidth="1" className="stroke-[var(--accent)]" />

      {/* Flecha que une ambos marcos */}
      <path
        d="M 125 140 L 150 140"
        strokeWidth="1.8"
        className="stroke-[var(--accent)]"
      />
      <polygon points="152,140 144,136 144,144" className="fill-[var(--accent)] stroke-none" />
    </svg>
  );
}

/* ==========================================================
   ILUSTRACIONES PARA /COMO-FUNCIONA (Sección 5.4)
   ========================================================== */

/** Paso 1: Un teléfono con dos marcos de foto y líneas de texto. Pin de ubicación que sube. */
export function IlustracionPasoPublica({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width="240"
      height="240"
      className={`stroke-[var(--line-strong)] fill-none transition-all duration-500 hover:stroke-[var(--ink)] ${className}`}
      aria-hidden="true"
    >
      {/* Teléfono */}
      <rect x="95" y="42" width="90" height="194" rx="18" strokeWidth="1.8" />
      <line x1="125" y1="56" x2="155" y2="56" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />

      {/* Pantalla del teléfono con dos marcos de fotos */}
      <rect x="107" y="74" width="33" height="33" rx="4" strokeWidth="1.4" />
      <line x1="107" y1="74" x2="140" y2="107" strokeWidth="1" opacity="0.6" />

      <rect x="146" y="74" width="33" height="33" rx="4" strokeWidth="1.4" />
      <line x1="146" y1="74" x2="179" y2="107" strokeWidth="1" opacity="0.6" />

      {/* Líneas de texto */}
      <line x1="107" y1="122" x2="173" y2="122" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="107" y1="134" x2="162" y2="134" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
      <line x1="107" y1="145" x2="148" y2="145" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />

      {/* Botón de acción */}
      <rect x="107" y="166" width="66" height="20" rx="6" strokeWidth="1.5" className="stroke-[var(--accent)]" />

      {/* Pin de ubicación animado en azul */}
      <g className="transition-transform duration-500 -translate-y-1.5 hover:-translate-y-3">
        <circle cx="140" cy="205" r="7.5" strokeWidth="1.8" className="stroke-[var(--accent)] fill-[var(--bg)]" />
        <circle cx="140" cy="205" r="3" className="fill-[var(--accent)] stroke-none" />
      </g>
    </svg>
  );
}

/** Paso 2: Dos personas sobre línea de suelo, unidas por arco punteado con punto que recorre el arco. */
export function IlustracionPasoRecibe({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width="240"
      height="240"
      className={`stroke-[var(--line-strong)] fill-none transition-all duration-500 hover:stroke-[var(--ink)] ${className}`}
      aria-hidden="true"
    >
      {/* Línea de suelo */}
      <line x1="38" y1="210" x2="242" y2="210" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />

      {/* Persona Donante (Izquierda) */}
      <circle cx="75" cy="138" r="11" strokeWidth="1.8" />
      <path d="M 58 185 C 58 158, 92 158, 92 185" strokeWidth="1.8" />
      <line x1="58" y1="185" x2="58" y2="210" strokeWidth="1.8" />
      <line x1="92" y1="185" x2="92" y2="210" strokeWidth="1.8" />

      {/* Persona Receptora (Derecha) */}
      <circle cx="205" cy="138" r="11" strokeWidth="1.8" />
      <path d="M 188 185 C 188 158, 222 158, 222 185" strokeWidth="1.8" />
      <line x1="188" y1="185" x2="188" y2="210" strokeWidth="1.8" />
      <line x1="222" y1="185" x2="222" y2="210" strokeWidth="1.8" />

      {/* Arco directo punteado uniendo a ambas personas (gesto del puente) */}
      <path
        d="M 85 138 C 115 76, 165 76, 195 138"
        strokeWidth="2.2"
        strokeDasharray="4 4"
        className="stroke-[var(--accent)]"
      />

      {/* Punto azul viajando por el arco */}
      <circle cx="140" cy="91" r="5" className="fill-[var(--accent)] stroke-none" />
      <circle cx="140" cy="91" r="12" strokeWidth="1.4" className="stroke-[var(--accent)] opacity-40 animate-ping" />
    </svg>
  );
}

/** Paso 3: Casa agrietada a la izquierda y misma casa reconstruida a la derecha con check. */
export function IlustracionPasoResultados({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 280"
      width="240"
      height="240"
      className={`stroke-[var(--line-strong)] fill-none transition-all duration-500 hover:stroke-[var(--ink)] ${className}`}
      aria-hidden="true"
    >
      {/* Casa 1: Antes (agrietada a la izquierda) */}
      <g opacity="0.8">
        <polygon points="80,105 45,135 115,135" strokeWidth="1.6" />
        <rect x="52" y="135" width="56" height="55" strokeWidth="1.6" />
        <rect x="72" y="155" width="16" height="35" strokeWidth="1.4" />
        {/* Grietas de daño */}
        <path d="M 75 118 L 82 128 L 78 135 L 85 148 L 79 165" strokeWidth="1.5" className="stroke-[var(--ink-2)]" />
      </g>

      {/* Separador sutil / flecha central de progreso */}
      <path d="M 124 150 L 146 150" strokeWidth="1.8" className="stroke-[var(--accent)]" />
      <polygon points="149,150 142,146 142,154" className="fill-[var(--accent)] stroke-none" />

      {/* Casa 2: Después (reconstruida a la derecha) */}
      <polygon points="200,95 160,130 240,130" strokeWidth="1.8" />
      <rect x="168" y="130" width="64" height="60" strokeWidth="1.8" />
      <rect x="190" y="152" width="20" height="38" rx="2" strokeWidth="1.4" className="stroke-[var(--accent)]" />
      <rect x="174" y="142" width="10" height="12" rx="1.5" strokeWidth="1.2" />
      <rect x="216" y="142" width="10" height="12" rx="1.5" strokeWidth="1.2" />

      {/* Círculo con check de verificación en azul */}
      <circle cx="200" cy="72" r="14" strokeWidth="1.8" className="stroke-[var(--accent)] fill-[var(--bg)]" />
      <path d="M 193 72 L 198 77 L 207 67" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-[var(--accent)]" />
    </svg>
  );
}
