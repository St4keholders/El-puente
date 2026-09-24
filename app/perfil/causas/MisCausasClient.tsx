"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CauseCard, CauseCardProps, CauseMediaItem } from "@/components/feed/CauseCard";
import {
  IconoMas,
  IconoCargando,
  IconoBasura,
  IconoAlerta,
  IconoFlechaDerecha,
  IconoTarjeta,
} from "@/components/iconos";
import { ModalRegistrarApoyo } from "@/components/cause/ModalRegistrarApoyo";

export type CauseStatusTab = "borrador" | "activa" | "cerrada" | "finalizada";

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

export interface ExtendedCauseCardProps extends CauseCardProps {
  first_support_confirmed_at?: string | null;
  supplies?: Array<{
    id: string;
    name: string;
    unit?: string | null;
    quantity_needed?: number | null;
    quantity_received: number;
    position?: number;
  }>;
}

interface MisCausasClientProps {
  userId: string;
  initialCounts: Record<CauseStatusTab, number>;
  initialCauses: ExtendedCauseCardProps[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialHasExampleCause: boolean;
}

export function MisCausasClient({
  userId,
  initialCounts,
  initialCauses,
  initialHasMore,
  initialCursor,
  initialHasExampleCause,
}: MisCausasClientProps) {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<CauseStatusTab>("activa");
  const [counts, setCounts] = useState<Record<CauseStatusTab, number>>(initialCounts);
  const [causes, setCauses] = useState<ExtendedCauseCardProps[]>(initialCauses);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pageError, setPageError] = useState<string | null>(null);

  // Modal registrar apoyo
  const [supportModalCause, setSupportModalCause] = useState<ExtendedCauseCardProps | null>(null);

  // Delete modal state
  const [deletingCauseId, setDeletingCauseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Causa de ejemplo
  const [hasExampleCause, setHasExampleCause] = useState(initialHasExampleCause);
  const [creatingExample, setCreatingExample] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [borradoresRes, activasRes, cerradasRes, finalizadasRes, exRowRes] = await Promise.all([
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "borrador"),
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "activa"),
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "cerrada"),
        supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "finalizada"),
        supabase.from("causes").select("id").eq("author_id", userId).eq("is_example", true).maybeSingle(),
      ]);

      setCounts({
        borrador: borradoresRes.count || 0,
        activa: activasRes.count || 0,
        cerrada: cerradasRes.count || 0,
        finalizada: finalizadasRes.count || 0,
      });
      setHasExampleCause(Boolean(exRowRes.data));
    } catch (err) {
      console.error("Error fetching causes counts:", err);
    }
  }, [supabase, userId]);

  const mapCauses = useCallback((items: any[], tab: CauseStatusTab): ExtendedCauseCardProps[] => {
    return items.map((c: any) => {
      const media: CauseMediaItem[] = (c.cause_media || []).map((m: any) => ({
        id: m.id,
        storage_path: m.storage_path,
        kind: m.kind,
        position: m.position,
        width: m.width,
        height: m.height,
      }));

      const results = Array.isArray(c.cause_results) ? c.cause_results[0] : c.cause_results;
      const suppliesList = (c.cause_supplies || []).sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
      );

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
        collection_type: c.collection_type,
        is_example: c.is_example,
        first_support_confirmed_at: c.first_support_confirmed_at,
        supplies: suppliesList,
        author: {
          id: c.profiles?.id || userId,
          full_name: c.profiles?.full_name || "Mi perfil",
          public_id: c.profiles?.public_id || "",
          avatar_url: c.profiles?.avatar_url,
        },
        media,
        resultsSummary: results?.summary || null,
        resultsAmountReceived: results?.amount_received || null,
        isOwner: true,
      };
    });
  }, [userId]);

  const fetchCausesForTab = useCallback(
    async (tab: CauseStatusTab, nextCursor: string | null = null) => {
      if (!nextCursor) {
        setLoading(true);
        setPageError(null);
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
            collection_type,
            is_example,
            first_support_confirmed_at,
            profiles:author_id(id, full_name, public_id, avatar_url),
            cause_media(id, storage_path, kind, position, width, height),
            cause_results(summary, amount_received),
            cause_supplies(id, name, unit, quantity_needed, quantity_received, position)
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
        const mapped = mapCauses(pageItems, tab);

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
      } catch (err: any) {
        console.error("Error loading causes:", err);
        setPageError("No pudimos cargar esta sección. Puedes reintentar.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [supabase, userId, mapCauses]
  );

  const handleTabChange = (tab: CauseStatusTab) => {
    setActiveTab(tab);
    fetchCausesForTab(tab);
  };

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && cursor) {
          fetchCausesForTab(activeTab, cursor);
        }
      },
      { threshold: 0.1 }
    );

    const el = observerTarget.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loadingMore, cursor, activeTab, fetchCausesForTab]);

  const handleDeleteDraft = async () => {
    if (!deletingCauseId) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await supabase
        .from("causes")
        .delete()
        .eq("id", deletingCauseId)
        .eq("author_id", userId);

      if (error) {
        const msg = error.message?.includes("CAUSA_NO_BORRABLE")
          ? "Esta causa ya recibió apoyo confirmado y no se puede eliminar. Por transparencia solo puedes cerrarla."
          : error.message || "No se pudo eliminar la causa.";
        throw new Error(msg);
      }

      setCauses((prev) => prev.filter((c) => c.id !== deletingCauseId));
      setCounts((prev) => {
        const key = activeTab;
        return { ...prev, [key]: Math.max(0, prev[key] - 1) };
      });
      setDeletingCauseId(null);
    } catch (err: any) {
      console.error("Error deleting cause:", err);
      setDeleteError(err?.message || "No se pudo eliminar la causa.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateExample = async () => {
    setCreatingExample(true);
    setExampleError(null);
    try {
      const { error } = await supabase.rpc("create_example_cause");
      if (error) throw error;
      setActiveTab("activa");
      await fetchCounts();
      await fetchCausesForTab("activa");
      setHasExampleCause(true);
    } catch (err: any) {
      console.error("Error creating example cause:", err);
      setExampleError(err?.message || "No se pudo crear la causa de ejemplo.");
    } finally {
      setCreatingExample(false);
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
        <div className="flex items-center gap-2 flex-wrap">
          {!hasExampleCause && (
            <button
              id="btn-crear-causa-ejemplo"
              type="button"
              onClick={handleCreateExample}
              disabled={creatingExample}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-all disabled:opacity-50 cursor-pointer"
            >
              {creatingExample ? (
                <>
                  <IconoCargando size={13} className="animate-spin" />
                  <span>Creando...</span>
                </>
              ) : (
                <span>Crear causa de ejemplo</span>
              )}
            </button>
          )}
          <Link
            href="/causa/nueva"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white text-sm font-semibold shadow-lg shadow-[var(--cta)]/20 transition-all active:scale-[0.98]"
          >
            <IconoMas size={16} />
            <span>Crear una causa</span>
          </Link>
        </div>
      </div>

      {exampleError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {exampleError}
        </div>
      )}

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
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-[var(--accent)] text-[var(--ink)] font-semibold"
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
        ) : pageError ? (
          <div className="py-16 px-6 text-center rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/40 backdrop-blur-md space-y-3">
            <p className="text-sm font-semibold text-[var(--ink)]">{pageError}</p>
            <button
              type="button"
              onClick={() => {
                fetchCounts();
                fetchCausesForTab(activeTab);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white transition-all cursor-pointer"
            >
              Reintentar
            </button>
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
              let authorActions: React.ReactNode = null;

              if (activeTab === "borrador") {
                authorActions = (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeletingCauseId(cause.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
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
                const hasSupport = Boolean(cause.first_support_confirmed_at);

                authorActions = (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSupportModalCause(cause)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--cta)] text-white hover:bg-[var(--accent)] transition-all cursor-pointer shadow-sm"
                    >
                      <IconoTarjeta size={13} />
                      <span>Registrar apoyo</span>
                    </button>

                    <Link
                      href={`/causa/nueva?draftId=${cause.id}&edit=1`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--field)] text-[var(--ink)] hover:bg-[var(--hover)] border border-[var(--line)] transition-all text-center justify-center"
                    >
                      <span>Editar</span>
                    </Link>

                    {!hasSupport ? (
                      <button
                        type="button"
                        onClick={() => setDeletingCauseId(cause.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer justify-center"
                      >
                        <IconoBasura size={13} />
                        <span>Eliminar</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/causa/${cause.id}/cerrar`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
                        >
                          <span>Cerrar causa</span>
                        </Link>
                        <span
                          className="text-[10px] text-[var(--ink-3)] italic hidden md:inline-block max-w-[200px] leading-tight"
                          title="Esta causa ya recibió apoyo confirmado. Por transparencia con quienes ayudaron, no se puede borrar, pero puedes cerrarla y publicar los resultados."
                        >
                          Apoyo confirmado (no borrable)
                        </span>
                      </div>
                    )}
                  </div>
                );
              } else if (activeTab === "cerrada") {
                authorActions = (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSupportModalCause(cause)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--field)] text-[var(--ink)] hover:bg-[var(--hover)] border border-[var(--line)] transition-all cursor-pointer"
                    >
                      <IconoTarjeta size={13} />
                      <span>Actualizar apoyo</span>
                    </button>
                    <Link
                      href={`/causa/${cause.id}/resultados`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all"
                    >
                      <span>Publicar resultados</span>
                      <IconoFlechaDerecha size={13} />
                    </Link>
                  </div>
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

      {/* Modal confirmation for deleting cause */}
      {deletingCauseId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
                <IconoAlerta size={20} />
              </div>
              <h3 id="modal-eliminar-title" className="text-base font-semibold text-[var(--ink)]">
                ¿Eliminar esta causa?
              </h3>
            </div>
            <p className="text-sm text-[var(--ink-2)] leading-relaxed">
              Esta acción no se puede deshacer. Se borrarán los datos y archivos multimedia asociados. Solo es posible eliminar causas que aún no hayan confirmado recepción de apoyo.
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
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--field)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteDraft}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <IconoCargando className="animate-spin" size={14} />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, eliminar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Apoyo Recibido */}
      {supportModalCause && (
        <ModalRegistrarApoyo
          isOpen={Boolean(supportModalCause)}
          onClose={() => setSupportModalCause(null)}
          causeId={supportModalCause.id}
          collectionType={supportModalCause.collection_type || "dinero"}
          currency={supportModalCause.currency || "USD"}
          currentRaised={supportModalCause.raised_reported || 0}
          supplies={(supportModalCause.supplies || []).map((s) => ({
            id: s.id,
            name: s.name,
            unit: s.unit,
            quantity_needed: s.quantity_needed,
            quantity_received: s.quantity_received || 0,
          }))}
          onSuccess={(newAmount, newSupplies) => {
            setCauses((prev) =>
              prev.map((c) =>
                c.id === supportModalCause.id
                  ? {
                      ...c,
                      raised_reported: typeof newAmount === "number" ? newAmount : c.raised_reported,
                      first_support_confirmed_at: c.first_support_confirmed_at || new Date().toISOString(),
                      supplies: newSupplies || c.supplies,
                    }
                  : c
              )
            );
          }}
        />
      )}
    </div>
  );
}
