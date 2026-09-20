"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IconoCerrar, IconoCorazon, IconoFlechaDerecha } from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { getCountryCausesAction } from "@/app/actions/planet";
import type { Database } from "@/lib/database.types";

type Cause = Database["public"]["Tables"]["causes"]["Row"] & {
  author?: Database["public"]["Tables"]["profiles"]["Row"];
  cause_media?: Database["public"]["Tables"]["cause_media"]["Row"][];
};

interface CountryPanelProps {
  countryCode: string | null;
  countryName: string;
  nearCity?: string;
  focusCauseId?: string;
  onClose: () => void;
}

export function CountryPanel({
  countryCode,
  countryName,
  nearCity,
  focusCauseId,
  onClose,
}: CountryPanelProps) {
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCountryCauses = useCallback(async () => {
    if (!countryCode) return;
    setLoading(true);
    setLoadError(null);

    try {
      const res = await getCountryCausesAction(countryCode);
      if (!res.success) {
        setLoadError("No pudimos cargar las causas de este país.");
        setCauses([]);
        setTotalCount(0);
      } else {
        setCauses(res.causes as any);
        setTotalCount(res.count);
        setLoadError(null);
      }
    } catch (err: any) {
      console.error("Error fetching country causes:", err);
      setLoadError("Ocurrió un error inesperado al consultar las causas.");
      setCauses([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    fetchCountryCauses();
  }, [fetchCountryCauses]);

  if (!countryCode) return null;

  const nf = new Intl.NumberFormat("es-CO");
  const fmt = (n: number) => nf.format(Math.round(n));
  const money = (n: number) => `US$ ${fmt(n)}`;

  return (
    <aside
      aria-labelledby="panelTitle"
      className="fixed z-50 flex flex-col transition-all duration-500 ease-out
        /* Desktop */
        md:top-20 md:right-6 md:bottom-6 md:w-[400px] md:max-h-[calc(100vh-7rem)]
        /* Mobile */
        bottom-0 left-0 right-0 max-h-[75svh] w-full rounded-t-3xl md:rounded-3xl"
    >
      <Glass
        variant="panel"
        className="flex h-full w-full flex-col overflow-hidden p-0 shadow-2xl border border-[var(--line)] bg-[var(--surface)]"
      >
        {/* Grabber en móvil */}
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[var(--line)] md:hidden" />

        {/* Encabezado */}
        <div className="relative border-b border-[var(--line)] p-5 pb-4">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
            aria-label="Cerrar panel"
          >
            <IconoCerrar size={16} />
          </button>

          {nearCity && (
            <p className="text-xs font-medium text-[var(--ink-3)] mb-0.5">
              Cerca de {nearCity}
            </p>
          )}
          <h2 id="panelTitle" className="text-2xl font-bold tracking-tight text-[var(--ink)] pr-10">
            {countryName}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            {loading ? (
              "Buscando causas..."
            ) : loadError ? (
              "No pudimos conectar con el servidor"
            ) : totalCount > 0 ? (
              <span>
                <strong className="text-[var(--ink)] font-semibold">{fmt(totalCount)}</strong>{" "}
                {totalCount === 1 ? "causa activa" : "causas activas"}
              </span>
            ) : (
              "Todavía no hay causas activas aquí"
            )}
          </p>
        </div>

        {/* Lista de causas o estado vacío / error */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {loading ? (
            <div className="space-y-4 py-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2.5 rounded-2xl bg-[var(--hover)] p-4">
                  <div className="h-4 w-1/3 rounded bg-[var(--line)]" />
                  <div className="h-5 w-3/4 rounded bg-[var(--line)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--line)]" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{loadError}</p>
              <button
                type="button"
                onClick={fetchCountryCauses}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white transition-all cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : causes.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hover)] text-[var(--ink-3)]">
                <IconoCorazon size={24} />
              </div>
              <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
                Aún no hay causas activas en este país
              </h3>
              <p className="text-xs text-[var(--ink-2)] mb-5 max-w-xs mx-auto">
                Si tú o alguien cercano necesita apoyo en {countryName}, crea la primera causa y aparecerá una luz en el mapa.
              </p>
              <Link
                href={`/causa/nueva?pais=${countryCode}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--cta)] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <span>Crear una causa</span>
              </Link>
            </div>
          ) : (
            causes.map((c) => {
              const isFocused = focusCauseId === c.id;
              const hasGoal = !!c.goal_amount && c.goal_amount > 0;
              const raised = c.raised_reported || 0;
              const pct = hasGoal ? Math.min(100, Math.round((raised / c.goal_amount!) * 100)) : 0;
              const firstMedia = c.cause_media?.sort((a, b) => a.position - b.position)[0];
              const authorName = c.author?.full_name || "Anónimo";

              return (
                <div
                  key={c.id}
                  id={`cause-${c.id}`}
                  className={`group relative rounded-2xl border p-4 transition-all ${
                    isFocused
                      ? "border-[var(--accent)] bg-[var(--hover)] shadow-md"
                      : "border-[var(--line)] bg-[var(--surface-solid)] hover:border-[var(--accent)]/40 hover:shadow-sm"
                  }`}
                >
                  <Link href={`/causa/${c.id}`} className="block">
                    <div className="flex items-center justify-between text-xs text-[var(--ink-3)] mb-1.5">
                      <span className="font-semibold text-[var(--accent-ink)] uppercase tracking-wider">
                        {c.category}
                      </span>
                      <span>{c.city || countryName}</span>
                    </div>

                    <h3 className="text-base font-semibold text-[var(--ink)] line-clamp-2 leading-snug group-hover:text-[var(--accent-ink)] transition-colors">
                      {c.title}
                    </h3>

                    {/* Autor */}
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-[var(--ink-2)]">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--avatar)] font-semibold text-[var(--ink)] overflow-hidden">
                        {c.author?.avatar_url ? (
                          <img src={c.author.avatar_url} alt={authorName} className="h-full w-full object-cover" />
                        ) : (
                          authorName[0].toUpperCase()
                        )}
                      </div>
                      <span className="truncate">{authorName}</span>
                    </div>

                    {/* Barra de progreso si tiene meta */}
                    {hasGoal && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs font-medium text-[var(--ink-2)] mb-1 tabular-nums">
                          <span>
                            <strong className="text-[var(--ink)]">{money(raised)}</strong> reportados
                          </span>
                          <span className="text-[var(--ink-3)]">de {money(c.goal_amount!)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--track)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>

                  {/* Botón Donar */}
                  <div className="mt-3.5 flex items-center justify-end">
                    <Link
                      href={`/causa/${c.id}#donar`}
                      className="rounded-lg bg-[var(--cta)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
                    >
                      Donar
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie del panel con enlace a explorar país */}
        {totalCount > 0 && (
          <div className="border-t border-[var(--line)] p-4">
            <Link
              href={`/explorar?pais=${countryCode}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--hover)] py-2.5 px-4 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--line)]"
            >
              <span>Ver las {fmt(totalCount)} causas de {countryName}</span>
              <IconoFlechaDerecha size={16} />
            </Link>
          </div>
        )}
      </Glass>
    </aside>
  );
}
