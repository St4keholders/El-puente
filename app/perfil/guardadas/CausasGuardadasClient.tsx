"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CauseCard, CauseCardProps, CauseMediaItem } from "@/components/feed/CauseCard";
import { IconoGuardar, IconoCargando, IconoFlechaDerecha } from "@/components/iconos";

interface CausasGuardadasClientProps {
  userId: string;
  initialCauses: CauseCardProps[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialError: string | null;
}

export function CausasGuardadasClient({
  userId,
  initialCauses,
  initialHasMore,
  initialCursor,
  initialError,
}: CausasGuardadasClientProps) {
  const supabase = createClient();

  const [causes, setCauses] = useState<CauseCardProps[]>(initialCauses);
  const [fetchError, setFetchError] = useState<string | null>(initialError);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);

  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchMoreSavedCauses = useCallback(
    async (nextCursor: string) => {
      setLoadingMore(true);
      setLoadMoreError(null);

      try {
        const { data: savesData, error: savesError } = await supabase
          .from("saves")
          .select("cause_id, created_at")
          .eq("user_id", userId)
          .lt("created_at", nextCursor)
          .order("created_at", { ascending: false })
          .limit(11);

        if (savesError) throw savesError;

        const saves = savesData || [];
        const pageHasMore = saves.length > 10;
        const pageSaves = pageHasMore ? saves.slice(0, 10) : saves;
        const causeIds = pageSaves.map((s) => s.cause_id);

        if (causeIds.length === 0) {
          setHasMore(false);
          setCursor(null);
          return;
        }

        const { data: rawCauses, error: causesError } = await supabase
          .from("causes")
          .select(`
            id,
            title,
            category,
            description,
            status,
            city,
            country_code,
            published_at,
            closed_at,
            finalized_at,
            goal_amount,
            raised_reported,
            currency,
            comments_count,
            saves_count,
            created_at,
            author:profiles!causes_author_id_fkey(
              id,
              full_name,
              public_id,
              avatar_url
            ),
            media:cause_media(
              id,
              storage_path,
              bucket,
              kind,
              phase,
              position,
              width,
              height
            ),
            results:cause_results(
              summary,
              amount_received,
              currency
            )
          `)
          .in("id", causeIds);

        if (causesError) throw causesError;

        const causesMap = new Map((rawCauses || []).map((c) => [c.id, c]));

        const mapped: CauseCardProps[] = pageSaves
          .map((s) => causesMap.get(s.cause_id))
          .filter(Boolean)
          .map((c: any) => {
            const author = c.author || {
              id: "unknown",
              full_name: "Usuario",
              public_id: "",
              avatar_url: null,
            };

            const media: CauseMediaItem[] = (c.media || [])
              .filter((m: any) => m.phase === "causa")
              .sort((a: any, b: any) => a.position - b.position)
              .map((m: any) => ({
                id: m.id,
                storage_path: m.storage_path,
                kind: m.kind,
                position: m.position,
                width: m.width,
                height: m.height,
              }));

            const results = Array.isArray(c.results) ? c.results[0] : c.results;

            return {
              id: c.id,
              title: c.title || "Causa solidaria",
              category: c.category || "otra",
              description: c.description || "",
              status: c.status,
              city: c.city,
              country_code: c.country_code,
              published_at: c.published_at,
              closed_at: c.closed_at,
              finalized_at: c.finalized_at,
              goal_amount: c.goal_amount,
              raised_reported: c.raised_reported,
              currency: c.currency || "USD",
              comments_count: c.comments_count || 0,
              saves_count: c.saves_count || 0,
              author: {
                id: author.id,
                full_name: author.full_name || "Usuario",
                public_id: author.public_id || "",
                avatar_url: author.avatar_url,
              },
              media,
              resultsSummary: results?.summary || null,
              resultsAmountReceived: results?.amount_received || null,
              isSaved: true,
            };
          });

        setCauses((prev) => [...prev, ...mapped]);
        setHasMore(pageHasMore);
        if (pageSaves.length > 0) {
          setCursor(pageSaves[pageSaves.length - 1].created_at);
        } else {
          setCursor(null);
        }
      } catch (err: any) {
        console.error("Error loading more saved causes:", err?.code, err?.message);
        setLoadMoreError(`No pudimos cargar más guardadas: ${err?.message || "error de conexión"}`);
      } finally {
        setLoadingMore(false);
      }
    },
    [supabase, userId]
  );

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && cursor) {
          fetchMoreSavedCauses(cursor);
        }
      },
      { threshold: 0.1 }
    );

    const el = observerTarget.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loadingMore, cursor, fetchMoreSavedCauses]);

  const handleSaveToggle = (causeId: string, currentlySaved: boolean) => {
    if (currentlySaved) {
      setCauses((prev) => prev.filter((c) => c.id !== causeId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Causas guardadas</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Causas que guardaste para darles seguimiento o apoyar más adelante.
        </p>
      </div>

      {/* Content */}
      {fetchError ? (
        <div className="py-16 px-6 text-center rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/40 backdrop-blur-md space-y-3">
          <p className="text-sm font-semibold text-[var(--ink)]">{fetchError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white transition-all cursor-pointer"
          >
            Recargar
          </button>
        </div>
      ) : causes.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/40 backdrop-blur-md">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--track)] flex items-center justify-center text-[var(--accent)] mb-4">
            <IconoGuardar size={26} />
          </div>
          <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
            Aún no tienes causas guardadas
          </h3>
          <p className="text-xs text-[var(--ink-3)] max-w-sm mx-auto mb-6">
            Cuando encuentres causas que quieras apoyar o seguir de cerca, toca el ícono de guardar para tenerlas aquí reunidas.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white text-xs font-semibold shadow-md transition-all"
          >
            <span>Explorar causas</span>
            <IconoFlechaDerecha size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {causes.map((cause) => (
            <CauseCard
              key={cause.id}
              {...cause}
              onSaveToggle={handleSaveToggle}
            />
          ))}

          {/* Infinite scroll loader */}
          <div ref={observerTarget} className="py-4 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--ink-3)]">
                <IconoCargando className="animate-spin text-[var(--accent)]" size={16} />
                <span>Cargando más guardadas...</span>
              </div>
            )}
            {loadMoreError && !loadingMore && (
              <div className="flex items-center justify-center gap-2 text-xs text-rose-400">
                <span>{loadMoreError}</span>
                <button
                  type="button"
                  onClick={() => cursor && fetchMoreSavedCauses(cursor)}
                  className="font-semibold underline cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
