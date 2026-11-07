"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CauseCard, type CauseCardProps } from "@/components/feed/CauseCard";
import { fetchFeedPage } from "@/lib/feed/fetchFeed";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { IconoCargando } from "@/components/iconos";

const POR_PAGINA = 8;

/**
 * Causas más recientes debajo del planeta. Se cargan de a poco al bajar (scroll infinito),
 * sin límite: mientras haya causas publicadas, la lista sigue.
 */
export function CausasRecientes({
  iniciales,
  cursorInicial,
  hayMasInicial,
}: {
  iniciales: CauseCardProps[];
  cursorInicial: { date: string; id: string } | null;
  hayMasInicial: boolean;
}) {
  const { user } = useUser();
  const userId = user?.id || null;
  const [causas, setCausas] = useState(iniciales);
  const [cursor, setCursor] = useState(cursorInicial);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const centinela = useRef<HTMLDivElement>(null);
  const cargandoRef = useRef(false);

  const cargarMas = useCallback(async () => {
    if (cargandoRef.current || !hayMas) return;
    cargandoRef.current = true;
    setCargando(true);
    setError(null);
    try {
      const res = await fetchFeedPage(createClient(), { status: "activa" }, cursor, userId, POR_PAGINA);
      if (res.error) {
        setError("No pudimos cargar más causas.");
        return;
      }
      setCausas((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...res.causes.filter((c) => !ids.has(c.id))];
      });
      setCursor(res.nextCursor || null);
      setHayMas(res.hasMore && res.causes.length > 0);
    } catch {
      setError("No pudimos cargar más causas.");
    } finally {
      cargandoRef.current = false;
      setCargando(false);
    }
  }, [cursor, hayMas, userId]);

  useEffect(() => {
    const el = centinela.current;
    if (!el || !hayMas || error) return;
    const obs = new IntersectionObserver((e) => e[0].isIntersecting && cargarMas(), { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cargarMas, hayMas, error]);

  return (
    <section
      id="causas-recientes"
      aria-labelledby="titulo-causas-recientes"
      className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-10 pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-16"
      style={{ scrollMarginTop: "calc(var(--alto-header, 80px) + 8px)" }}
    >
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 id="titulo-causas-recientes" className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
            Causas más recientes
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-2)]">Lo último que se publicó en Puente, en todo el mundo.</p>
        </div>
        <Link
          href="/explorar"
          className="flex-shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Filtrar
        </Link>
      </div>

      {causas.length === 0 ? (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-solid)] p-8 text-center">
          <p className="font-semibold text-[var(--ink)]">Todavía no hay causas activas.</p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">Cuando alguien publique una, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-7">
          {causas.map((c) => (
            <CauseCard key={c.id} {...c} />
          ))}
        </div>
      )}

      <div ref={centinela} aria-hidden="true" className="h-px" />

      {cargando && (
        <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--ink-2)]">
          <IconoCargando size={18} className="animate-spin text-[var(--accent)]" />
          Cargando más causas…
        </div>
      )}
      {error && !cargando && (
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-rose-500">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded-xl border border-[var(--line)] px-3 py-1.5 font-semibold text-[var(--ink)] cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}
      {!hayMas && causas.length > 0 && (
        <p className="py-8 text-center text-xs text-[var(--ink-3)]">Ya viste todas las causas activas.</p>
      )}
    </section>
  );
}
