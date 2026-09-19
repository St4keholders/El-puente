"use client";

import React, { useState, useEffect, useRef } from "react";
import { IconoFlechaIzquierda, IconoFlechaDerecha } from "@/components/iconos";
import { VisorHistoria } from "@/components/feed/VisorHistoria";
import { createClient } from "@/lib/supabase/client";
import { MarcoImagen } from "@/components/media/MarcoImagen";

export interface HistoriaItem {
  id: string;
  title: string;
  status: "cerrada" | "finalizada";
  closed_at: string;
  city?: string | null;
  country_code?: string | null;
  raised_reported?: number | null;
  currency?: string;
  author: {
    id: string;
    full_name: string;
    username: string;
    avatar_url?: string | null;
  };
  cover_media?: {
    storage_path: string;
    bucket?: string;
  } | null;
}

interface HistoriasFilaProps {
  initialHistorias?: HistoriaItem[];
}

const STORAGE_KEY = "puente-historias-vistas";

export function HistoriasFila({ initialHistorias }: HistoriasFilaProps) {
  const [historias, setHistorias] = useState<HistoriaItem[]>(initialHistorias || []);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // Leer historias vistas de localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSeenIds(new Set(parsed));
        }
      }
    } catch {}
  }, []);

  // Cargar historias si no llegaron por props
  useEffect(() => {
    if (initialHistorias && initialHistorias.length > 0) {
      setHistorias(initialHistorias);
      return;
    }

    const supabase = createClient();
    async function loadStories() {
      try {
        const { data, error } = await (supabase.rpc as any)("recent_closures", {
          p_days: 7,
          p_limit: 20,
        }).select(`
          id,
          title,
          status,
          closed_at,
          city,
          country_code,
          raised_reported,
          currency,
          author:profiles!causes_author_id_fkey(
            id,
            full_name,
            username,
            avatar_url
          ),
          media:cause_media(
            storage_path,
            bucket,
            position,
            phase
          )
        `);

        if (!error && data && Array.isArray(data)) {
          const items: HistoriaItem[] = data.map((d: any) => {
            const sortedMedia = ((d.media || []) as any[]).sort(
              (a, b) => a.position - b.position
            );
            return {
              id: d.id,
              title: d.title,
              status: d.status,
              closed_at: d.closed_at,
              city: d.city,
              country_code: d.country_code,
              raised_reported: d.raised_reported,
              currency: d.currency,
              author: d.author || {
                id: "unknown",
                full_name: "Persona",
                username: "usuario",
              },
              cover_media: sortedMedia[0] || null,
            };
          });
          setHistorias(items);
        }
      } catch (err) {
        console.warn("Error loading stories:", err);
      }
    }

    loadStories();
  }, [initialHistorias]);

  // Actualizar visibilidad de flechas de scroll
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [historias]);

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  const markStoryAsSeen = (id: string) => {
    setSeenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  if (historias.length === 0) {
    return null;
  }

  return (
    <section aria-label="Historias de causas que cerraron recientemente" className="relative w-full mb-8 sm:mb-10 group">
      {/* Flecha izquierda desktop */}
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Desplazar a la izquierda"
          onClick={() => scrollBy(-240)}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full border border-[var(--line)] bg-[var(--surface-solid)]/90 text-[var(--ink)] items-center justify-center backdrop-blur-md shadow-lg hover:scale-105 transition-transform"
        >
          <IconoFlechaIzquierda size={18} />
        </button>
      )}

      {/* Flecha derecha desktop */}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Desplazar a la derecha"
          onClick={() => scrollBy(240)}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full border border-[var(--line)] bg-[var(--surface-solid)]/90 text-[var(--ink)] items-center justify-center backdrop-blur-md shadow-lg hover:scale-105 transition-transform"
        >
          <IconoFlechaDerecha size={18} />
        </button>
      )}

      {/* Fila de círculos con scroll nativo oculto */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-center gap-5 sm:gap-7 overflow-x-auto py-3 px-1 scrollbar-none scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {historias.map((item, index) => {
          const isSeen = seenIds.has(item.id);
          const coverUrl =
            item.cover_media?.storage_path &&
            !item.cover_media.storage_path.startsWith("seed/")
              ? item.cover_media.storage_path.startsWith("http")
                ? item.cover_media.storage_path
                : `${supabaseUrl}/storage/v1/object/public/${
                    item.cover_media.bucket || "causas-imagenes"
                  }/${item.cover_media.storage_path}`
              : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveStoryIndex(index)}
              className="flex flex-col items-center flex-shrink-0 group/circle focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-2xl p-1 transition-transform active:scale-95"
            >
              {/* Anillo de 3px con degradado azul o gris */}
              <div
                className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full p-[3px] transition-all duration-300"
                style={{
                  background: isSeen
                    ? "var(--line)"
                    : "conic-gradient(from 210deg, #2E62F2, #4E80FF, #9DB8FF, #4E80FF, #2E62F2)",
                }}
              >
                {/* Separación de 3px del color del fondo */}
                <div className="w-full h-full rounded-full p-[3px] bg-[var(--bg)] flex items-center justify-center">
                  {/* Foto recortada en círculo */}
                  <div className="w-full h-full rounded-full overflow-hidden bg-[var(--surface-solid)] relative">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover/circle:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <MarcoImagen
                        aspectRatio="1/1"
                        isResult={item.status === "finalizada"}
                        className="rounded-full"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Nombre corto debajo */}
              <span className="mt-1.5 text-xs text-[var(--ink-2)] group-hover/circle:text-[var(--ink)] max-w-[76px] truncate text-center transition-colors">
                {item.author.full_name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Visor modal a pantalla completa */}
      {activeStoryIndex !== null && (
        <VisorHistoria
          historias={historias}
          initialIndex={activeStoryIndex}
          onClose={() => setActiveStoryIndex(null)}
          onStorySeen={markStoryAsSeen}
        />
      )}
    </section>
  );
}
