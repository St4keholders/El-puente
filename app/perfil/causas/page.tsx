"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { CauseCard, CauseCardProps, CauseMediaItem } from "@/components/feed/CauseCard";
import {
  IconoMas,
  IconoCargando,
  IconoBasura,
  IconoAlerta,
  IconoCheck,
  IconoFlechaDerecha,
} from "@/components/iconos";

type CauseStatusTab = "borrador" | "activa" | "cerrada" | "finalizada";

interface TabConfig {
  key: CauseStatusTab;
  label: string;
}

const TABS: TabConfig[] = [
  { key: "borrador", label: "Borradores" },
  { key: "activa", label: "Activas" },
  { key: "cerrada", label: "Cerradas" },
  { key: "finalizada", label: "Finalizadas" },
];

export default function MisCausasPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<CauseStatusTab>("activa");
  const [counts, setCounts] = useState<Record<CauseStatusTab, number>>({
    borrador: 0,
    activa: 0,
    cerrada: 0,
    finalizada: 0,
  });

  const [causes, setCauses] = useState<CauseCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Delete modal state
  const [deletingCauseId, setDeletingCauseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  // 1. Fetch counts for each tab
  const fetchCounts = useCallback(async (userId: string) => {
    try {
      const [borradoresRes, activasRes, cerradasRes, finalizadasRes] = await Promise.all([
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "borrador"),
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "activa"),
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "cerrada"),
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "finalizada"),
      ]);

      setCounts({
        borrador: borradoresRes.count || 0,
        activa: activasRes.count || 0,
        cerrada: cerradasRes.count || 0,
        finalizada: finalizadasRes.count || 0,
      });
    } catch (err) {
      console.error("Error fetching causes counts:", err);
    }
  }, [supabase]);

  // 2. Fetch page of causes for active tab
  const fetchCauses = useCallback(
    async (userId: string, tab: CauseStatusTab, nextCursor: string | null = null) => {
      if (!nextCursor) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        let query = supabase
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
            updated_at,
            profiles:author_id(id, full_name, username, avatar_url),
            cause_media(id, storage_path, kind, position, width, height),
            cause_results(summary, amount_received)
          `)
          .eq("author_id", userId)
          .eq("status", tab)
          .order("created_at", { ascending: false })
          .limit(11);

        if (nextCursor) {
          query = query.lt("created_at", nextCursor);
        }

        const { data, error } = await query;
        if (error) throw error;

        const items = data || [];
        const pageHasMore = items.length > 10;
        const pageItems = pageHasMore ? items.slice(0, 10) : items;

        const mapped: CauseCardProps[] = pageItems.map((c: any) => {
          const media: CauseMediaItem[] = (c.cause_media || []).map((m: any) => ({
            id: m.id,
            storage_path: m.storage_path,
            kind: m.kind,
            position: m.position,
            width: m.width,
            height: m.height,
          }));

          const results = Array.isArray(c.cause_results) ? c.cause_results[0] : c.cause_results;

          return {
            id: c.id,
            title: c.title || (tab === "borrador" ? "Borrador sin título" : "Causa sin título"),
            category: c.category || "otra",
            description: c.description || (tab === "borrador" ? "Borrador pendiente de completar." : ""),
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
              id: c.profiles?.id || userId,
              full_name: c.profiles?.full_name || profile?.full_name || "Mi perfil",
              username: c.profiles?.username || profile?.username || "yo",
              avatar_url: c.profiles?.avatar_url || profile?.avatar_url,
            },
            media,
            resultsSummary: results?.summary || null,
            resultsAmountReceived: results?.amount_received || null,
            isOwner: true,
          };
        });

        if (nextCursor) {
          setCauses((prev) => [...prev, ...mapped]);
        } else {
          setCauses(mapped);
        }

        setHasMore(pageHasMore);
        if (pageItems.length > 0) {
          setCursor(pageItems[pageItems.length - 1].created_at);
        } else {
          setCursor(null);
        }
      } catch (err) {
        console.error("Error loading causes:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [supabase, profile]
  );

  useEffect(() => {
    if (!userLoading && user) {
      fetchCounts(user.id);
      fetchCauses(user.id, activeTab);
    }
  }, [userLoading, user, activeTab, fetchCounts, fetchCauses]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && user && cursor) {
          fetchCauses(user.id, activeTab, cursor);
        }
      },
      { threshold: 0.1 }
    );

    const el = observerTarget.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loadingMore, user, cursor, activeTab, fetchCauses]);

  // Delete draft action
  const handleDeleteDraft = async () => {
    if (!deletingCauseId || !user) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await supabase
        .from("causes")
        .delete()
        .eq("id", deletingCauseId)
        .eq("author_id", user.id)
        .eq("status", "borrador");

      if (error) throw error;

      setCauses((prev) => prev.filter((c) => c.id !== deletingCauseId));
      setCounts((prev) => ({ ...prev, borrador: Math.max(0, prev.borrador - 1) }));
      setDeletingCauseId(null);
    } catch (err: any) {
      console.error("Error deleting draft:", err);
      setDeleteError(err?.message || "No se pudo eliminar el borrador.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Mis causas</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            Administra tus causas publicadas, borradores pendientes y rendición de cuentas.
          </p>
        </div>
        <Link
          href="/causa/nueva"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white text-sm font-semibold shadow-lg shadow-[var(--cta)]/20 transition-all active:scale-[0.98] w-full sm:w-auto"
        >
          <IconoMas size={16} />
          <span>Crear una causa</span>
        </Link>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Filtrar por estado"
        className="flex items-center gap-2 border-b border-[var(--line)] overflow-x-auto pb-px scrollbar-none"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--accent)]/15 text-[var(--accent-ink)]"
                    : "bg-[var(--track)] text-[var(--ink-3)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab panel content */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="space-y-4"
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--ink-3)] flex items-center justify-center gap-2">
            <IconoCargando className="animate-spin text-[var(--accent)]" size={20} />
            <span>Cargando causas...</span>
          </div>
        ) : causes.length === 0 ? (
          <div className="py-16 px-6 text-center rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/40 backdrop-blur-md">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--track)] flex items-center justify-center text-[var(--ink-3)] mb-4">
              <IconoMas size={24} />
            </div>
            <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
              {activeTab === "borrador" && "No tienes borradores pendientes"}
              {activeTab === "activa" && "No tienes causas activas en este momento"}
              {activeTab === "cerrada" && "No tienes causas cerradas pendientes de rendir cuentas"}
              {activeTab === "finalizada" && "Aún no tienes causas finalizadas con resultados"}
            </h3>
            <p className="text-xs text-[var(--ink-3)] max-w-sm mx-auto mb-6">
              {activeTab === "borrador" && "Cuando comienzas a crear una causa, se guarda automáticamente como borrador."}
              {activeTab === "activa" && "Publica una causa solidaria para comenzar a recibir apoyo transparente de la comunidad."}
              {activeTab === "cerrada" && "Las causas cerradas aparecen aquí para que puedas publicar los resultados alcanzados."}
              {activeTab === "finalizada" && "Las causas con rendición de cuentas completada permanecen para siempre en este historial."}
            </p>
            {activeTab !== "cerrada" && activeTab !== "finalizada" && (
              <Link
                href="/causa/nueva"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white text-xs font-semibold shadow-md transition-all"
              >
                <IconoMas size={14} />
                <span>Crear una causa</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {causes.map((cause) => {
              // Build author actions according to status
              let authorActions: React.ReactNode = null;

              if (activeTab === "borrador") {
                authorActions = (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeletingCauseId(cause.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                    >
                      <IconoBasura size={13} />
                      <span>Eliminar</span>
                    </button>
                    <Link
                      href={`/causa/nueva?draftId=${cause.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)] shadow transition-all"
                    >
                      <span>Continuar</span>
                      <IconoFlechaDerecha size={13} />
                    </Link>
                  </div>
                );
              } else if (activeTab === "activa") {
                authorActions = (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/causa/nueva?draftId=${cause.id}&edit=1`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--field)] text-[var(--ink)] hover:bg-[var(--hover)] border border-[var(--line)] transition-all"
                    >
                      <span>Editar</span>
                    </Link>
                    <Link
                      href={`/causa/${cause.id}/cerrar`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
                    >
                      <span>Cerrar causa</span>
                    </Link>
                  </div>
                );
              } else if (activeTab === "cerrada") {
                authorActions = (
                  <Link
                    href={`/causa/${cause.id}/resultados`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all"
                  >
                    <span>Publicar resultados</span>
                    <IconoFlechaDerecha size={13} />
                  </Link>
                );
              }

              return (
                <CauseCard
                  key={cause.id}
                  {...cause}
                  authorActions={authorActions}
                />
              );
            })}

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="py-4 text-center">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 text-xs text-[var(--ink-3)]">
                  <IconoCargando className="animate-spin text-[var(--accent)]" size={16} />
                  <span>Cargando más causas...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmation for deleting draft */}
      {deletingCauseId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-borrador-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
                <IconoAlerta size={20} />
              </div>
              <h3 id="modal-eliminar-borrador-title" className="text-base font-semibold text-[var(--ink)]">
                ¿Eliminar este borrador?
              </h3>
            </div>
            <p className="text-sm text-[var(--ink-2)] leading-relaxed">
              Esta acción no se puede deshacer. Se borrarán los datos y archivos multimedia asociados a este borrador.
            </p>
            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {deleteError}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingCauseId(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--field)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteDraft}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <IconoCargando className="animate-spin" size={14} />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, eliminar borrador</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
