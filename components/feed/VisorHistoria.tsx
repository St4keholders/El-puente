"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  IconoX,
  IconoFlechaIzquierda,
  IconoFlechaDerecha,
  IconoVerificado,
  IconoFlechaDerecha as IconoVerMas,
} from "@/components/iconos";
import { formatDistanceToNow } from "@/lib/utils/date";
import { getCountryName } from "@/lib/geo/countries";
import { MarcoImagen } from "@/components/media/MarcoImagen";
import type { HistoriaItem } from "./HistoriasFila";

interface VisorHistoriaProps {
  historias: HistoriaItem[];
  initialIndex: number;
  onClose: () => void;
  onStorySeen: (id: string) => void;
}

export function VisorHistoria({
  historias,
  initialIndex,
  onClose,
  onStorySeen,
}: VisorHistoriaProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const DURATION_MS = 6000;
  const STEP_MS = 50;

  const current = historias[currentIndex];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // Marcar historia como vista al visualizarse
  useEffect(() => {
    if (current) {
      onStorySeen(current.id);
    }
  }, [current, onStorySeen]);

  const goToNext = useCallback(() => {
    setProgress(0);
    if (currentIndex < historias.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, historias.length, onClose]);

  const goToPrev = useCallback(() => {
    setProgress(0);
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // Trap focus accesibilidad
  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  // Autoplay con temporizador
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setProgress(0);
    const stepIncrement = (STEP_MS / DURATION_MS) * 100;

    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          goToNext();
          return 0;
        }
        return p + stepIncrement;
      });
    }, STEP_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, goToNext]);

  if (!current) return null;

  const coverUrl =
    current.cover_media?.storage_path &&
    !current.cover_media.storage_path.startsWith("seed/")
      ? current.cover_media.storage_path.startsWith("http")
        ? current.cover_media.storage_path
        : `${supabaseUrl}/storage/v1/object/public/${
            current.cover_media.bucket || "causas-imagenes"
          }/${current.cover_media.storage_path}`
      : null;

  const resolvedCountry = getCountryName(current.country_code);
  const locationText = [current.city, resolvedCountry].filter(Boolean).join(", ");
  const closedAgo = current.closed_at
    ? formatDistanceToNow(new Date(current.closed_at))
    : "recientemente";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Historia de ${current.author.full_name}`}
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in select-none"
    >
      {/* Botones de navegación laterales para desktop */}
      <button
        type="button"
        aria-label="Historia anterior"
        onClick={goToPrev}
        disabled={currentIndex === 0}
        className={`hidden sm:flex absolute left-4 lg:left-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-[var(--line)] bg-[var(--surface-solid)]/80 text-white items-center justify-center backdrop-blur-md transition-all z-20 ${
          currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-white/20 hover:scale-105"
        }`}
      >
        <IconoFlechaIzquierda size={22} />
      </button>

      <button
        type="button"
        aria-label="Siguiente historia"
        onClick={goToNext}
        className="hidden sm:flex absolute right-4 lg:right-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-[var(--line)] bg-[var(--surface-solid)]/80 text-white items-center justify-center backdrop-blur-md hover:bg-white/20 hover:scale-105 transition-all z-20"
      >
        <IconoFlechaDerecha size={22} />
      </button>

      {/* Tarjeta central de vidrio */}
      <div
        className="relative w-full max-w-[420px] max-h-[90vh] rounded-3xl border border-[var(--glass-edge)] bg-[var(--surface-solid)] overflow-hidden shadow-2xl flex flex-col justify-between"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        }}
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerLeave={() => setIsPaused(false)}
      >
        {/* Barras de progreso superiores */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5 pointer-events-none">
          {historias.map((h, idx) => (
            <div
              key={h.id}
              className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden backdrop-blur-sm"
            >
              <div
                className="h-full bg-white transition-all ease-linear"
                style={{
                  width:
                    idx < currentIndex
                      ? "100%"
                      : idx === currentIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Cabecera de la historia */}
        <div className="absolute top-7 inset-x-3 z-30 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--avatar)] border border-white/20 flex items-center justify-center text-xs font-mono font-bold text-white">
              {current.author.avatar_url ? (
                <img
                  src={current.author.avatar_url}
                  alt={current.author.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                current.author.full_name.charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-white drop-shadow-md flex items-center gap-1">
                {current.author.full_name}
              </span>
              <span className="text-xs text-white/80 drop-shadow-md">
                {locationText}
              </span>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Cerrar visor de historias"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition-colors"
          >
            <IconoX size={18} />
          </button>
        </div>

        {/* Zona táctil invisible izquierda / derecha para celular */}
        <div className="absolute inset-0 z-20 flex">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          />
        </div>

        {/* Imagen principal */}
        <div className="relative w-full aspect-[4/5] bg-black overflow-hidden flex items-center justify-center">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={current.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <MarcoImagen aspectRatio="4/5" isResult={current.status === "finalizada"} />
          )}

          {/* Degradado para legibilidad del texto superior e inferior */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/85" />
        </div>

        {/* Contenido inferior */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[0.7rem] font-mono uppercase font-semibold bg-white/20 text-white backdrop-blur-sm">
              Cerró hace {closedAgo}
            </span>

            {current.status === "finalizada" && (
              <span className="px-2 py-0.5 rounded text-[0.7rem] font-mono uppercase font-semibold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 backdrop-blur-sm">
                <IconoVerificado size={12} />
                Ya publicó resultados
              </span>
            )}
          </div>

          <h4 className="text-base font-semibold text-white leading-snug line-clamp-2">
            {current.title}
          </h4>

          {current.raised_reported && current.raised_reported > 0 && (
            <div className="text-xs font-mono text-white/90">
              Recaudo reportado:{" "}
              <strong className="text-white font-bold">
                ${current.raised_reported.toLocaleString()} {current.currency || "USD"}
              </strong>
            </div>
          )}

          <Link
            href={`/causa/${current.id}`}
            onClick={onClose}
            className="mt-1 w-full py-2.5 px-4 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-1.5 transition-colors shadow-lg"
          >
            <span>Ver causa</span>
            <IconoVerMas size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
