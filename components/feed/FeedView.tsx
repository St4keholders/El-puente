"use client";

import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  IconoBuscador,
  IconoFiltros,
  IconoX,
  IconoFlechaDerecha,
} from "@/components/iconos";
import {
  IlustracionExplorarVacio,
  IlustracionCerradasVacio,
  IlustracionFinalizadasVacio,
} from "@/components/iconos/Ilustraciones";
import { CauseCard, CauseCardProps } from "@/components/feed/CauseCard";
import { HistoriasFila } from "@/components/feed/HistoriasFila";
import {
  fetchFeedPage,
  fetchFeedFacets,
  FeedFilters,
  FeedFacetsResult,
} from "@/lib/feed/fetchFeed";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { getCountryName, getAllCountries } from "@/lib/geo/countries";
import { feedPanelsConfig, FeedPanelKey } from "@/lib/content/es";

interface FeedViewProps {
  initialCauses: CauseCardProps[];
  initialCursor?: { date: string; id: string } | null;
  initialHasMore: boolean;
  filters: FeedFilters;
  panelKey?: FeedPanelKey;
  title?: string;
  emptyMessage?: string;
}

const CATEGORIES = [
  { id: "todas", label: "Todas" },
  { id: "terremoto", label: "Terremoto" },
  { id: "inundacion", label: "Inundación" },
  { id: "incendio", label: "Incendio" },
  { id: "tormenta", label: "Tormenta" },
  { id: "sequia", label: "Sequía" },
  { id: "salud", label: "Salud" },
  { id: "alimentacion", label: "Alimentación" },
  { id: "vivienda", label: "Vivienda" },
  { id: "educacion", label: "Educación" },
  { id: "otra", label: "Otras causas" },
];

export function FeedView({
  initialCauses,
  initialCursor,
  initialHasMore,
  filters: propFilters,
  panelKey: customPanelKey,
  title: customTitle,
  emptyMessage: customEmptyMessage,
}: FeedViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Determinar panel actual según ruta o prop
  const currentPanelKey: FeedPanelKey =
    customPanelKey ||
    (pathname.includes("cerradas")
      ? "cerradas"
      : pathname.includes("finalizadas")
      ? "finalizadas"
      : "explorar");

  const panelConfig = feedPanelsConfig[currentPanelKey];
  const targetStatus = panelConfig.status;
  const panelTitle = customTitle || panelConfig.title;
  const panelEmptyNoFiltersTitle = customEmptyMessage || panelConfig.emptyNoFiltersTitle;


  // Estado del feed
  const [causes, setCauses] = useState<CauseCardProps[]>(initialCauses);
  const [cursor, setCursor] = useState<{ date: string; id: string } | null>(
    initialCursor || null
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Facetas (conteos para filtros)
  const [facets, setFacets] = useState<FeedFacetsResult>({
    categories: [],
    countries: [],
  });

  // Filtros activos desde URL
  const activeQ = searchParams.get("q") || "";
  const activePais = searchParams.get("pais") || "";
  const activeCategoria = searchParams.get("categoria") || "todas";
  const activeSiguiendo = searchParams.get("siguiendo") === "1";

  // Buscador con debounce local
  const [searchTerm, setSearchTerm] = useState(activeQ);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal / Hoja móvil de filtros
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Sincronizar causas con props del servidor al navegar
  useEffect(() => {
    setCauses(initialCauses);
    setCursor(initialCursor || null);
    setHasMore(initialHasMore);
    setLoadError(null);
  }, [initialCauses, initialCursor, initialHasMore]);

  // Sincronizar campo de búsqueda si cambia la URL externamente
  useEffect(() => {
    setSearchTerm(activeQ);
  }, [activeQ]);

  // Atajo de teclado '/' para enfocar el buscador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cargar facetas (conteos de filtros)
  useEffect(() => {
    async function loadFacets() {
      const res = await fetchFeedFacets(
        supabase,
        targetStatus,
        activeQ,
        activePais,
        activeCategoria,
        activeSiguiendo
      );
      setFacets(res);
    }
    loadFacets();
  }, [targetStatus, activeQ, activePais, activeCategoria, activeSiguiendo]);

  // Aplicar actualización a la URL
  const updateUrlFilters = useCallback(
    (newFilters: {
      q?: string;
      pais?: string;
      categoria?: string;
      siguiendo?: boolean;
    }) => {
      const sp = new URLSearchParams(searchParams.toString());

      if (newFilters.q !== undefined) {
        if (newFilters.q.trim()) sp.set("q", newFilters.q.trim());
        else sp.delete("q");
      }

      if (newFilters.pais !== undefined) {
        if (newFilters.pais && newFilters.pais !== "todos") sp.set("pais", newFilters.pais);
        else sp.delete("pais");
      }

      if (newFilters.categoria !== undefined) {
        if (newFilters.categoria && newFilters.categoria !== "todas")
          sp.set("categoria", newFilters.categoria);
        else sp.delete("categoria");
      }

      if (newFilters.siguiendo !== undefined) {
        if (newFilters.siguiendo) sp.set("siguiendo", "1");
        else sp.delete("siguiendo");
      }

      const queryString = sp.toString();
      startTransition(() => {
        router.push(`${pathname}${queryString ? `?${queryString}` : ""}`, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounce para búsqueda (250 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim() !== activeQ.trim()) {
        updateUrlFilters({ q: searchTerm });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, activeQ, updateUrlFilters]);

  // Limpiar todos los filtros
  const handleClearFilters = () => {
    setSearchTerm("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
    setIsFilterSheetOpen(false);
  };

  const hasActiveFilters =
    Boolean(activeQ) ||
    Boolean(activePais) ||
    (activeCategoria && activeCategoria !== "todas") ||
    activeSiguiendo;

  const activeFiltersCount =
    (activeQ ? 1 : 0) +
    (activePais ? 1 : 0) +
    (activeCategoria && activeCategoria !== "todas" ? 1 : 0) +
    (activeSiguiendo ? 1 : 0);

  // Infinite Scroll: cargar siguiente página
  const loadNextPage = useCallback(async () => {
    if (!cursor || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadError(null);

    const currentFilters: FeedFilters = {
      q: activeQ || undefined,
      pais: activePais || undefined,
      categoria: activeCategoria || undefined,
      siguiendo: activeSiguiendo,
      status: targetStatus,
    };

    const res = await fetchFeedPage(
      supabase,
      currentFilters,
      cursor,
      user?.id || null,
      10
    );

    setIsLoadingMore(false);

    if (res.error) {
      setLoadError(res.error);
      return;
    }

    if (res.causes.length > 0) {
      setCauses((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newCauses = res.causes.filter((c) => !existingIds.has(c.id));
        return [...prev, ...newCauses];
      });
      setCursor(res.nextCursor || null);
      setHasMore(res.hasMore);
    } else {
      setHasMore(false);
    }
  }, [
    cursor,
    isLoadingMore,
    hasMore,
    activeQ,
    activePais,
    activeCategoria,
    activeSiguiendo,
    targetStatus,
    supabase,
    user?.id,
  ]);

  // Observer para scroll infinito
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: "350px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadNextPage]);

  // Diccionario de conteos por categoría
  const categoryCounts: Record<string, number> = {};
  let totalCausesCount = 0;
  facets.categories.forEach((c) => {
    categoryCounts[c.category] = c.total;
    totalCausesCount += c.total;
  });

  // Países con causas (ocultando los que tienen 0)
  const countriesWithCauses = facets.countries
    .filter((c) => c.total > 0)
    .map((c) => ({
      code: c.country_code,
      name: getCountryName(c.country_code),
      count: c.total,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  // ==========================================================
  // CONTENIDO DE LA COLUMNA DE FILTROS
  // ==========================================================
  const renderFilterContent = () => (
    <div className="flex flex-col gap-6 text-sm">
      {/* 1. Título y conteo del panel */}
      <div className="border-b border-[var(--line)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">
          {panelTitle}
        </h1>
        <p className="text-xs text-[var(--ink-2)] mt-0.5 font-mono">
          {panelConfig.countText(totalCausesCount || causes.length)}
        </p>
      </div>

      {/* 2. Buscador del panel con atajo '/' */}
      <div>
        <label
          htmlFor="feed-search-input"
          className="block text-xs font-mono uppercase tracking-wider font-semibold text-[var(--ink-3)] mb-2.5"
        >
          Buscar en este panel
        </label>
        <div className="relative">
          <input
            id="feed-search-input"
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={panelConfig.searchPlaceholder}
            className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl bg-[var(--field)] text-[var(--ink)] placeholder:text-[var(--ink-3)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] pointer-events-none">
            <IconoBuscador size={15} />
          </div>

          {searchTerm ? (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setSearchTerm("");
                updateUrlFilters({ q: "" });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)]"
            >
              <IconoX size={14} />
            </button>
          ) : (
            <kbd className="hidden lg:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--ink-3)] border border-[var(--line)] pointer-events-none">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* 3. Selector de País con conteo (oculta países con 0) */}
      <div>
        <label
          htmlFor="feed-country-select"
          className="block text-xs font-mono uppercase tracking-wider font-semibold text-[var(--ink-3)] mb-2.5"
        >
          País
        </label>
        <select
          id="feed-country-select"
          value={activePais || "todos"}
          onChange={(e) => updateUrlFilters({ pais: e.target.value })}
          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--field)] text-[var(--ink)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
        >
          <option value="todos">Todos los países ({totalCausesCount || causes.length})</option>
          {countriesWithCauses.map((c) => (
            <option key={c.code} value={c.code.toLowerCase()}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </div>

      {/* 4. Interruptor Siguiendo */}
      <div className="flex items-center justify-between py-3 border-y border-[var(--line)]">
        <label
          htmlFor="feed-following-toggle"
          className="text-xs font-medium text-[var(--ink-2)] cursor-pointer select-none"
        >
          Solo personas que sigo
        </label>
        <input
          id="feed-following-toggle"
          type="checkbox"
          checked={activeSiguiendo}
          onChange={(e) => {
            if (!user) {
              router.push("/entrar");
              return;
            }
            updateUrlFilters({ siguiendo: e.target.checked });
          }}
          className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--line)] bg-[var(--field)] cursor-pointer"
        />
      </div>

      {/* 5. Categorías (Lista vertical con conteos, sin iconos) */}
      <div>
        <span className="block text-xs font-mono uppercase tracking-wider font-semibold text-[var(--ink-3)] mb-2.5">
          Categorías
        </span>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map((cat) => {
            const isSelected =
              activeCategoria === cat.id ||
              (!activeCategoria && cat.id === "todas") ||
              (activeCategoria === "" && cat.id === "todas");

            const count =
              cat.id === "todas"
                ? totalCausesCount || causes.length
                : categoryCounts[cat.id] || 0;

            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => updateUrlFilters({ categoria: cat.id })}
                className={`w-full flex items-center justify-between py-2 px-3 rounded-xl text-xs transition-colors text-left ${
                  isSelected
                    ? "border-l-2 border-[var(--accent)] pl-2.5 font-semibold text-[var(--ink)] bg-[var(--hover)]"
                    : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-[0.7rem] font-mono text-[var(--ink-3)]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Limpiar filtros si hay activos */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearFilters}
          className="w-full py-2 px-3 text-xs font-medium text-[var(--accent-ink)] hover:underline border border-dashed border-[var(--accent)]/30 rounded-xl transition-colors text-center"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-2 sm:py-4">
      {/* ==========================================================
          BARRA PEGAYOSA DE VIDRIO PARA TABLET Y MÓVIL (< 1100px)
          ========================================================== */}
      <div className="lg:hidden sticky top-16 z-20 mb-6 py-2 bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={panelConfig.searchPlaceholder}
              className="w-full pl-8 pr-7 py-2 text-xs rounded-xl bg-[var(--field)] text-[var(--ink)] placeholder:text-[var(--ink-3)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
              <IconoBuscador size={14} />
            </div>
            {searchTerm && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => {
                  setSearchTerm("");
                  updateUrlFilters({ q: "" });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
              >
                <IconoX size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
          >
            <IconoFiltros size={15} />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[0.65rem] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ==========================================================
          HOJA LATERAL / INFERIOR DE FILTROS EN MÓVIL Y TABLET
          ========================================================== */}
      {isFilterSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros del feed"
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
        >
          <div
            className="relative w-full sm:w-[380px] h-full bg-[var(--surface-solid)] border-l border-[var(--line)] p-6 overflow-y-auto flex flex-col justify-between shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] mb-4">
              <h2 className="text-base font-bold text-[var(--ink)]">Filtros</h2>
              <button
                type="button"
                aria-label="Cerrar filtros"
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1 text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                <IconoX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {renderFilterContent()}
            </div>

            <div className="pt-4 mt-4 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--cta)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors text-center"
              >
                Ver resultados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          LAYOUT DE 2 COLUMNAS (≥ 1100px)
          ========================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
        {/* Columna izquierda (Filtros sticky en desktop) */}
        <aside className="hidden lg:block w-[280px] xl:w-[310px] flex-shrink-0 sticky top-28 xl:top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 scrollbar-none">
          <div className="p-5 sm:p-6 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] shadow-sm">
            {renderFilterContent()}
          </div>
        </aside>

        {/* Columna derecha (Feed de publicaciones) */}
        <div className="flex-1 min-w-0 max-w-[920px]">
          {/* Fila de Historias (arriba de las causas) */}
          <HistoriasFila />

          {/* Lista de Causas */}
          {causes.length > 0 ? (
            <div className="flex flex-col gap-6 sm:gap-7">
              {causes.map((cause) => (
                <CauseCard key={cause.id} {...cause} />
              ))}

              {/* Loader de siguiente página */}
              {isLoadingMore && (
                <div className="py-8 flex items-center justify-center text-xs font-mono text-[var(--ink-3)] animate-pulse">
                  Cargando más causas...
                </div>
              )}
              {loadError && !isLoadingMore && (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-rose-400">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => loadNextPage()}
                    className="font-semibold underline cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Target de intersección */}
              <div ref={observerTarget} className="h-4" />
            </div>
          ) : (
            /* ======================================================
               ESTADOS VACÍOS CON ILUSTRACIONES DE LÍNEA (Sección 5.4)
               ====================================================== */
            <div className="p-12 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] flex flex-col items-center justify-center text-center">
              <div className="mb-4">
                {currentPanelKey === "explorar" ? (
                  <IlustracionExplorarVacio />
                ) : currentPanelKey === "cerradas" ? (
                  <IlustracionCerradasVacio />
                ) : (
                  <IlustracionFinalizadasVacio />
                )}
              </div>

              <h2 className="text-base font-semibold text-[var(--ink)] mb-2 max-w-[340px]">
                {hasActiveFilters
                  ? panelConfig.emptyWithFiltersTitle
                  : panelEmptyNoFiltersTitle}
              </h2>

              <p className="text-xs text-[var(--ink-2)] max-w-[360px] mb-6">
                {hasActiveFilters
                  ? "Prueba cambiando o limpiando los filtros seleccionados para ver más causas."
                  : "Sé el primero en compartir una iniciativa comunitaria o explora las causas de otros paneles."}
              </p>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="py-2.5 px-5 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide transition-colors shadow-md"
                >
                  {panelConfig.emptyWithFiltersAction}
                </button>
              ) : (
                <Link
                  href={panelConfig.emptyNoFiltersAction.href}
                  className="inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide transition-colors shadow-md"
                >
                  <span>{panelConfig.emptyNoFiltersAction.text}</span>
                  <IconoFlechaDerecha size={14} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
