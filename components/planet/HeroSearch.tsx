"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { IconoBuscar, IconoCerrar, IconoGlobo, IconoMarcador, IconoUsuario, IconoCorazon } from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import mundoData from "@/lib/geo/mundo.json";
import { createClient } from "@/lib/supabase/client";

interface SearchItem {
  type: "country" | "city" | "person" | "cause";
  id: string;
  label: string;
  sublabel: string;
  countryCode: string;
  lat?: number;
  lng?: number;
  username?: string;
  causeId?: string;
}

interface HeroSearchProps {
  onSelectCountry: (countryCode: string, opts?: { lat?: number; lng?: number; focusCauseId?: string; nearCity?: string }) => void;
  onNavigateToUser?: (username: string) => void;
  activeCountryCounts: Map<string, number>;
}

export function HeroSearch({ onSelectCountry, onNavigateToUser, activeCountryCounts }: HeroSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [remoteResults, setRemoteResults] = useState<SearchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize string for accent-insensitive search
  const norm = (s: string) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // Local index of countries and cities from mundo.json
  const localItems = useMemo(() => {
    const items: SearchItem[] = [];
    const countries = (mundoData as any).countries || [];
    const cities = (mundoData as any).cities || [];

    countries.forEach((c: any) => {
      items.push({
        type: "country",
        id: c.id,
        label: c.n,
        sublabel: c.en !== c.n ? c.en : "",
        countryCode: c.id,
        lat: c.lat,
        lng: c.lng,
      });
    });

    cities.forEach(([cityName, countryCode, lat, lng]: [string, string, number, number]) => {
      const country = countries.find((c: any) => c.id === countryCode);
      items.push({
        type: "city",
        id: `${cityName}-${countryCode}`,
        label: cityName,
        sublabel: country?.n || countryCode,
        countryCode,
        lat,
        lng,
      });
    });

    return items;
  }, []);

  // Filter local items
  const filteredLocal = useMemo(() => {
    const q = norm(query);
    if (!q) return [];

    const matchedCountries: SearchItem[] = [];
    const matchedCities: SearchItem[] = [];

    for (const item of localItems) {
      const nLabel = norm(item.label);
      const nSub = norm(item.sublabel);

      if (nLabel.startsWith(q) || nLabel.includes(" " + q)) {
        if (item.type === "country" && matchedCountries.length < 4) {
          matchedCountries.push(item);
        } else if (item.type === "city" && matchedCities.length < 3) {
          matchedCities.push(item);
        }
      } else if (q.length > 2 && (nLabel.includes(q) || nSub.includes(q))) {
        if (item.type === "country" && matchedCountries.length < 4) {
          matchedCountries.push(item);
        } else if (item.type === "city" && matchedCities.length < 3) {
          matchedCities.push(item);
        }
      }
    }

    return [...matchedCountries, ...matchedCities];
  }, [query, localItems]);

  // Fetch remote people and causes with 200ms debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("search_people_and_causes", {
          q,
          max_results: 6,
        });

        if (!error && data) {
          const items: SearchItem[] = data.map((d: any) => ({
            type: d.kind === "persona" ? "person" : "cause",
            id: d.id,
            label: d.label,
            sublabel: d.sublabel,
            countryCode: d.country_code,
            lat: d.lat,
            lng: d.lng,
            username: d.username,
            causeId: d.kind === "causa" ? d.id : undefined,
          }));
          setRemoteResults(items);
        }
      } catch (err) {
        console.error("Error in remote search:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Combined results
  const allResults = useMemo(() => {
    return [...filteredLocal, ...remoteResults];
  }, [filteredLocal, remoteResults]);

  // Global keydown shortcut '/' to focus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (/INPUT|TEXTAREA/.test(target?.tagName)) return;
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    setQuery(item.label);
    inputRef.current?.blur();

    if (item.type === "person" && item.username) {
      if (onNavigateToUser) {
        onNavigateToUser(item.username);
      } else {
        window.location.href = `/u/${item.username}`;
      }
    } else if (item.type === "city") {
      onSelectCountry(item.countryCode, { lat: item.lat, lng: item.lng, nearCity: item.label });
    } else if (item.type === "cause") {
      onSelectCountry(item.countryCode, { lat: item.lat, lng: item.lng, focusCauseId: item.causeId });
    } else {
      onSelectCountry(item.countryCode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!allResults.length) return;
      setActiveIndex((prev) => (prev + 1) % allResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!allResults.length) return;
      setActiveIndex((prev) => (prev - 1 + allResults.length) % allResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < allResults.length) {
        handleSelect(allResults[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[600px] pointer-events-auto">
      <Glass
        variant="pill"
        className="flex h-14 items-center gap-3 px-4 shadow-lg border border-[var(--line)] bg-[var(--glass-tint-strong)] backdrop-blur-md focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--focus-ring)] transition-all"
      >
        <IconoBuscar size={20} className="text-[var(--ink-2)] flex-shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Busca un país, ciudad o persona"
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className="flex-1 bg-transparent text-[var(--ink)] placeholder-[var(--ink-2)] text-base outline-none [appearance:none] [&::-webkit-search-cancel-button]:hidden font-medium"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
          >
            <IconoCerrar size={16} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-[var(--line)] px-2 text-xs font-semibold text-[var(--ink-3)]">
            /
          </kbd>
        )}
      </Glass>

      {/* Resultados desplegables */}
      {isOpen && query.trim().length > 0 && (
        <Glass
          variant="panel"
          className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[420px] overflow-y-auto p-2 shadow-2xl border border-[var(--line)] bg-[var(--surface-solid)]"
          role="listbox"
        >
          {allResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--ink-2)]">
              No encontramos nada para “<strong>{query}</strong>”. Prueba con el nombre de un país, una ciudad o una persona.
            </div>
          ) : (
            <div className="space-y-1">
              {allResults.map((item, idx) => {
                const count = activeCountryCounts.get(item.countryCode) || 0;
                const isSelected = idx === activeIndex;

                let IconComp = IconoGlobo;
                if (item.type === "city") IconComp = IconoMarcador;
                if (item.type === "person") IconComp = IconoUsuario;
                if (item.type === "cause") IconComp = IconoCorazon;

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--hover)] text-[var(--ink-2)]">
                        <IconComp size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--ink)] truncate">
                          {item.label}
                        </p>
                        {item.sublabel && (
                          <p className="text-xs text-[var(--ink-3)] truncate">
                            {item.sublabel}
                          </p>
                        )}
                      </div>
                    </div>

                    {item.type === "country" && (
                      <span className={`text-xs tabular-nums flex-shrink-0 font-medium ${count > 0 ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]"}`}>
                        {count > 0 ? `${count} ${count === 1 ? "causa" : "causas"}` : "Sin causas"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Glass>
      )}
    </div>
  );
}
