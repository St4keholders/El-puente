"use client";

import React from "react";
import type { Database } from "@/lib/database.types";

type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];

interface RecentActivityProps {
  activeCausesCount: number;
  activeCountriesCount: number;
  events: ActivityEvent[];
  onSelectCountry: (countryCode: string) => void;
  bumpStat?: "cause" | "country" | null;
}

export function RecentActivity({
  activeCausesCount,
  activeCountriesCount,
  events,
  onSelectCountry,
  bumpStat,
}: RecentActivityProps) {
  const nf = new Intl.NumberFormat("es-CO");
  const fmt = (n: number) => nf.format(Math.round(n));

  const formatAgo = (createdAt: string) => {
    const diffSec = Math.round((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (diffSec < 5) return "ahora";
    if (diffSec < 60) return `hace ${diffSec} s`;
    const min = Math.round(diffSec / 60);
    if (min < 60) return `hace ${min} min`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `hace ${hours} h`;
    return `hace ${Math.round(hours / 24)} d`;
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 z-30 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 px-6 md:px-10 pointer-events-none">
      {/* Contador de estado en vivo */}
      <div className="flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink-2)] shadow-md pointer-events-auto backdrop-blur-md">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]" />
        </span>
        <span>
          <strong
            className={`font-semibold text-[var(--ink)] tabular-nums transition-colors duration-700 ${
              bumpStat === "cause" ? "text-[var(--accent-ink)]" : ""
            }`}
          >
            {fmt(activeCausesCount)}
          </strong>{" "}
          causas activas en{" "}
          <strong
            className={`font-semibold text-[var(--ink)] tabular-nums transition-colors duration-700 ${
              bumpStat === "country" ? "text-[var(--accent-ink)]" : ""
            }`}
          >
            {fmt(activeCountriesCount)}
          </strong>{" "}
          países
        </span>
      </div>

      {/* Feed de eventos recientes */}
      {events.length > 0 && (
        <ol className="flex flex-col gap-1.5 w-full sm:w-auto max-w-[320px] pointer-events-auto" aria-label="Actividad reciente">
          {events.slice(0, 3).map((ev, i) => {
            const isGift = ev.kind === "causa_finalizada";
            const actionText =
              ev.kind === "causa_publicada"
                ? "Nueva causa en"
                : ev.kind === "causa_cerrada"
                ? "Causa cerrada en"
                : "Resultados publicados en";

            return (
              <li
                key={ev.id}
                className="transition-opacity duration-300"
                style={{ opacity: i === 0 ? 1 : i === 1 ? 0.8 : 0.6 }}
              >
                <button
                  type="button"
                  onClick={() => onSelectCountry(ev.country_code)}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-[var(--line)]/50 bg-[var(--surface)]/90 px-3 py-2 text-left shadow-sm backdrop-blur-md hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] cursor-pointer transition-all"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      isGift ? "border border-[var(--accent)] bg-transparent" : "bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-[var(--ink)]">
                      {actionText} <strong>{ev.city || ev.country_code}</strong>
                    </p>
                    <span className="text-[10px] text-[var(--ink-3)] block truncate">
                      {ev.actor_name ? `${ev.actor_name}, ` : ""}
                      {formatAgo(ev.created_at)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
