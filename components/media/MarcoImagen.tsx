"use client";

import React from "react";
import { IconoFoto } from "@/components/iconos";

export interface MarcoImagenProps {
  aspectRatio?: "4/3" | "16/9" | "1/1" | "4/5";
  index?: number;
  total?: number;
  isResult?: boolean;
  className?: string;
}

export function MarcoImagen({
  aspectRatio = "4/3",
  index,
  total,
  isResult = false,
  className = "",
}: MarcoImagenProps) {
  const aspectClass =
    aspectRatio === "4/3"
      ? "aspect-[4/3]"
      : aspectRatio === "16/9"
      ? "aspect-video"
      : aspectRatio === "4/5"
      ? "aspect-[4/5]"
      : "aspect-square";

  const subtitle =
    index != null && total != null ? `Imagen ${index} de ${total}` : null;
  const mainText = isResult
    ? "Aquí va la foto del resultado"
    : "Aquí va la foto de la causa";

  return (
    <div
      role="img"
      aria-label="Espacio para imagen de la causa"
      className={`relative w-full h-full ${aspectClass} overflow-hidden rounded-[inherit] flex flex-col items-center justify-center select-none bg-[color-mix(in_oklab,var(--bg)_92%,var(--ink))] border border-[var(--line)] ${className}`}
    >
      {/* Trazos diagonales estilo plano arquitectónico */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none stroke-[var(--line)]"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <line x1="0" y1="0" x2="100" y2="100" strokeWidth="0.75" />
        <line x1="100" y1="0" x2="0" y2="100" strokeWidth="0.75" />
      </svg>

      {/* Contenido central */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 pointer-events-none">
        <div className="text-[var(--ink-2)] opacity-80 mb-2">
          <IconoFoto size={48} />
        </div>
        {subtitle && (
          <span className="text-[0.8rem] font-medium text-[var(--ink-3)] tracking-wide mb-0.5">
            {subtitle}
          </span>
        )}
        <span className="text-xs font-semibold text-[var(--ink-2)] max-w-[200px]">
          {mainText}
        </span>
      </div>
    </div>
  );
}
