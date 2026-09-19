"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mundoData from "@/lib/geo/mundo.json";
import { decodeTopo } from "@/lib/geo/decodeTopo";
import { HeroSearch } from "@/components/planet/HeroSearch";
import { CountryPanel } from "@/components/planet/CountryPanel";
import { RecentActivity } from "@/components/planet/RecentActivity";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];

interface GlobeHeroProps {
  initialCounts: { country_code: string; active_count: number }[];
  initialEvents: ActivityEvent[];
}

const countryMetaMap = new Map<string, any>();
const countriesList = (mundoData as any).countries || [];
countriesList.forEach((c: any) => {
  countryMetaMap.set(c.id, c);
});

type MaterialOceano = {
  color: { set(c: string): void } | null;
  emissive: { set(c: string): void; clone(): { set(c: string): void } };
  emissiveIntensity: number;
  specular?: { set(c: string): void };
  shininess: number;
  map: { dispose(): void } | null;
  bumpMap: unknown;
  needsUpdate: boolean;
};

export function aplicarOceano(globe: any, tema: "light" | "dark") {
  if (!globe || typeof window === "undefined") return;
  const cs = getComputedStyle(document.documentElement);
  const leer = (nombre: string, respaldo: string) => cs.getPropertyValue(nombre).trim() || respaldo;

  const oceano = leer("--g-ocean", tema === "light" ? "#3F7FE8" : "#050912");
  const emisivoOscuro = leer("--g-ocean-emissive", "#03060D");

  // 1. Sin texturas: una textura oscura tapa el color del océano
  if (typeof globe.globeImageUrl === "function" && globe.globeImageUrl()) globe.globeImageUrl("");
  if (typeof globe.bumpImageUrl === "function" && globe.bumpImageUrl()) globe.bumpImageUrl("");

  const m = (typeof globe.globeMaterial === "function" ? globe.globeMaterial() : null) as unknown as MaterialOceano;
  if (!m) return;
  if (m.map) {
    try { m.map.dispose(); } catch {}
    m.map = null;
  }
  m.bumpMap = null;

  // 2. globe.gl deja color en null cuando alguna vez hubo textura
  if (!m.color && m.emissive) m.color = m.emissive.clone();
  if (m.color) m.color.set(oceano);

  // 3. Luz propia mínima: el océano nunca queda negro aunque falte iluminación
  const lights = typeof globe.lights === "function" ? globe.lights() : [];
  const sinLuces = !lights || lights.length === 0;
  if (tema === "light") {
    if (m.emissive) m.emissive.set(oceano);
    m.emissiveIntensity = sinLuces ? 0.85 : 0.28;
    if (m.specular) m.specular.set("#2a3350");
    m.shininess = 10;
  } else {
    if (m.emissive) m.emissive.set(emisivoOscuro);
    m.emissiveIntensity = 1;
    if (m.specular) m.specular.set("#101a38");
    m.shininess = 14;
  }
  m.needsUpdate = true;
}

export function GlobeHero({ initialCounts, initialEvents }: GlobeHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const starCanvasRef = useRef<HTMLCanvasElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Globe instance and internal state
  const globeInstance = useRef<any>(null);
  const stateRef = useRef<{
    selected: string | null;
    hovered: string | null;
    homeAlt: number;
    cy: number;
    D: number;
    autoTimer: any;
    rings: any[];
    lights: Map<string, any>;
  }>({
    selected: null,
    hovered: null,
    homeAlt: 2.2,
    cy: 0,
    D: 600,
    autoTimer: null,
    rings: [],
    lights: new Map(),
  });

  // Reactive state for UI
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [panelOpts, setPanelOpts] = useState<{ nearCity?: string; focusCauseId?: string }>({});
  const [countryCounts, setCountryCounts] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>();
    initialCounts.forEach((c) => {
      if (c.country_code) map.set(c.country_code, Number(c.active_count));
    });
    return map;
  });
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(initialEvents);
  const [bumpStat, setBumpStat] = useState<"cause" | "country" | null>(null);
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);


  // Calculate totals
  const totalCauses = Array.from(countryCounts.values()).reduce((a, b) => a + b, 0);
  const totalCountries = countryCounts.size;

  // Starry sky background
  useEffect(() => {
    const canvas = starCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let stars: any[] = [];
    let consts: any[] = [];

    const buildStars = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = Math.min(420, Math.round((w * h) / 5200));
      stars = [];
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          s: 0.35 + Math.pow(Math.random(), 3) * 1.25,
          a: 0.15 + Math.random() * 0.7,
          tw: Math.random() < 0.22 ? 0.6 + Math.random() * 1.6 : 0,
          ph: Math.random() * 6.28,
        });
      }

      const shapes = [
        { cx: 0.12, cy: 0.2, pts: [[-46, 6], [0, 0], [44, 18], [36, 40], [-8, 46]], links: [[0, 1], [1, 2], [2, 3], [1, 4]] },
        { cx: 0.88, cy: 0.3, pts: [[-30, -10], [8, -24], [34, 6], [4, 30]], links: [[0, 1], [1, 2], [2, 3]] },
        { cx: 0.9, cy: 0.82, pts: [[-20, 0], [14, -18], [30, 16]], links: [[0, 1], [1, 2]] },
      ];
      consts = shapes.map((sh) => ({
        pts: sh.pts.map((p) => [sh.cx * w + p[0], sh.cy * h + p[1]]),
        links: sh.links,
      }));
    };

    const drawStars = (t: number) => {
      const parent = containerRef.current;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const starRgb = isDark ? "245,245,240" : "10,22,51";
      const baseAlpha = isDark ? 0.55 : 0.22;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = s.a * baseAlpha * (s.tw ? 0.55 + 0.45 * Math.sin((t / 1000) * s.tw + s.ph) : 1);
        ctx.fillStyle = `rgba(${starRgb},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, 6.283);
        ctx.fill();
      }

      ctx.lineWidth = 0.8;
      consts.forEach((c) => {
        ctx.strokeStyle = `rgba(${starRgb},${(0.28 * baseAlpha).toFixed(3)})`;
        c.links.forEach((l: number[]) => {
          ctx.beginPath();
          ctx.moveTo(c.pts[l[0]][0], c.pts[l[0]][1]);
          ctx.lineTo(c.pts[l[1]][0], c.pts[l[1]][1]);
          ctx.stroke();
        });
        ctx.fillStyle = `rgba(${starRgb},${(0.85 * baseAlpha).toFixed(3)})`;
        c.pts.forEach((p: number[]) => {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 1.6, 0, 6.283);
          ctx.fill();
        });
      });
    };

    buildStars();
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 50) {
        drawStars(t);
        last = t;
      }
      animFrame = requestAnimationFrame(loop);
    };
    animFrame = requestAnimationFrame(loop);

    const onResize = () => {
      buildStars();
      drawStars(performance.now());
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Helper to calculate light size
  const getLightSize = (n: number) => Math.max(6, Math.min(16, 5 + Math.sqrt(n) * 1.35));
  const getLightOpacity = (n: number) => Math.max(0.62, Math.min(1, 0.62 + Math.sqrt(n) * 0.06));

  // Pulse ring animation
  const ping = useCallback((lat: number, lng: number, strong: boolean) => {
    if (!globeInstance.current) return;
    const r = {
      lat,
      lng,
      max: strong ? 6 : 3.2,
      speed: strong ? 3.2 : 2.4,
      period: strong ? 650 : 900,
    };
    stateRef.current.rings = [...stateRef.current.rings, r];
    globeInstance.current.ringsData(stateRef.current.rings);
    setTimeout(() => {
      stateRef.current.rings = stateRef.current.rings.filter((x) => x !== r);
      if (globeInstance.current) globeInstance.current.ringsData(stateRef.current.rings);
    }, strong ? 3200 : 2000);
  }, []);

  // Shift globe stage when panel opens/closes
  const shiftStage = useCallback(() => {
    if (!stageRef.current || !containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const selected = stateRef.current.selected;

    if (!selected) {
      stageRef.current.style.transform = "";
      return;
    }

    if (w > 720) {
      stageRef.current.style.transform = "translateX(-216px)";
    } else {
      const target = (containerRef.current.clientHeight - 400) / 2 + 8;
      stageRef.current.style.transform = `translateY(${target - stateRef.current.cy}px)`;
    }
  }, []);

  // Select country action
  const selectCountry = useCallback(
    (countryCode: string, opts?: { lat?: number; lng?: number; focusCauseId?: string; nearCity?: string }) => {
      const meta = countryMetaMap.get(countryCode);
      if (!meta) return;

      stateRef.current.selected = countryCode;
      setSelectedCountry(countryCode);
      setPanelOpts({ nearCity: opts?.nearCity, focusCauseId: opts?.focusCauseId });

      if (globeInstance.current) {
        globeInstance.current.controls().autoRotate = false;
        // Zoom and center
        const lat = opts?.lat != null ? opts.lat : meta.lat;
        const lng = opts?.lng != null ? opts.lng : meta.lng;
        const targetAlt = stateRef.current.homeAlt * Math.max(0.36, Math.min(0.62, 0.3 + 0.07 * Math.log10(Math.max(meta.area || 1000, 1000) / 1000)));

        globeInstance.current.pointOfView({ lat, lng, altitude: targetAlt }, 1500);
        setTimeout(() => ping(lat, lng, false), 900);

        // Refresh polygon highlights
        globeInstance.current.polygonCapColor(globeInstance.current.polygonCapColor());
      }

      shiftStage();
    },
    [ping, shiftStage]
  );

  const closePanel = useCallback(() => {
    stateRef.current.selected = null;
    setSelectedCountry(null);
    setPanelOpts({});

    if (globeInstance.current) {
      globeInstance.current.pointOfView({ altitude: stateRef.current.homeAlt }, 1100);
      setTimeout(() => {
        if (!stateRef.current.selected && globeInstance.current) {
          globeInstance.current.controls().autoRotate = true;
        }
      }, 3500);
      globeInstance.current.polygonCapColor(globeInstance.current.polygonCapColor());
    }

    shiftStage();
  }, [shiftStage]);

  // Handle Supabase Realtime updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("activity_events_globe")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
        },
        (payload) => {
          const newEvent = payload.new as ActivityEvent;

          // Update recent events feed
          setActivityEvents((prev) => [newEvent, ...prev.slice(0, 5)]);

          const cCode = newEvent.country_code;
          const meta = countryMetaMap.get(cCode);

          if (newEvent.kind === "causa_publicada") {
            setCountryCounts((prev) => {
              const next = new Map(prev);
              const current = next.get(cCode) || 0;
              next.set(cCode, current + 1);
              return next;
            });
            setBumpStat("cause");
            setTimeout(() => setBumpStat(null), 900);

            // Pulse and ignite light on globe
            if (meta) {
              ping(meta.lat, meta.lng, true);
              const existingLight = stateRef.current.lights.get(cCode);
              if (existingLight?.el) {
                existingLight.el.classList.remove("is-new");
                void existingLight.el.offsetWidth; // trigger reflow
                existingLight.el.classList.add("is-new");
              } else if (globeInstance.current) {
                // Create newly ignited light
                const el = document.createElement("div");
                el.className = "light is-new";
                el.appendChild(document.createElement("i"));
                el.style.setProperty("--s", "9px");
                el.style.setProperty("--o", "1");
                const lightObj = { id: cCode, lat: meta.lat, lng: meta.lng, el };
                stateRef.current.lights.set(cCode, lightObj);
                globeInstance.current.htmlElementsData(Array.from(stateRef.current.lights.values()));
              }
            }
          } else if (newEvent.kind === "causa_cerrada") {
            setCountryCounts((prev) => {
              const next = new Map(prev);
              const current = next.get(cCode) || 0;
              if (current <= 1) {
                next.delete(cCode);
                const lightObj = stateRef.current.lights.get(cCode);
                if (lightObj?.el) lightObj.el.classList.add("is-hidden");
              } else {
                next.set(cCode, current - 1);
              }
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ping]);

  // Initialize Globe
  useEffect(() => {
    let mounted = true;

    // Check WebGL support
    const checkWebGL = () => {
      try {
        const c = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
      } catch {
        return false;
      }
    };

    if (!checkWebGL()) {
      setWebglSupported(false);
      return;
    }

    const init = async () => {
      try {
        const GlobeModule = await import("globe.gl");
        const Globe = GlobeModule.default;
        if (!mounted || !globeRef.current || !containerRef.current) return;

        const geoFeatures = decodeTopo((mundoData as any).topo);

        // Build lights data from active country counts
        const lightsArray: any[] = [];
        countryCounts.forEach((count, cCode) => {
          const c = countryMetaMap.get(cCode);
          if (c) {
            const el = document.createElement("div");
            el.className = "light is-boot";
            el.appendChild(document.createElement("i"));
            el.style.setProperty("--s", `${getLightSize(count)}px`);
            el.style.setProperty("--o", `${getLightOpacity(count)}`);
            const lightObj = { id: cCode, lat: c.lat, lng: c.lng, el };
            stateRef.current.lights.set(cCode, lightObj);
            lightsArray.push(lightObj);
          }
        });

        const globe = new (Globe as any)(globeRef.current, {
          animateIn: true,
          rendererConfig: { antialias: true, alpha: true, powerPreference: "high-performance" },
        });

        globeInstance.current = globe;

        const readColors = () => {
          const cs = getComputedStyle(document.documentElement);
          const v = (n: string) => cs.getPropertyValue(n).trim();
          return {
            ocean: v("--g-ocean") || "#EEF3FC",
            oceanEm: v("--g-ocean-emissive") || "#000000",
            land: v("--g-land") || "#0D2152",
            landLit: v("--g-land-lit") || "#15307A",
            landHover: v("--g-land-hover") || "#1E43A6",
            landSel: v("--g-land-selected") || "#2E62F2",
            stroke: v("--g-stroke") || "rgba(255,255,255,0.35)",
            atmo: v("--g-atmo") || "#2E62F2",
            atmoAlt: parseFloat(v("--g-atmo-alt")) || 0.15,
            ring: v("--g-ring") || "46,98,242",
          };
        };

        const colors = readColors();

        globe
          .backgroundColor("rgba(0,0,0,0)")
          .showAtmosphere(true)
          .polygonsData(geoFeatures)
          .polygonSideColor(() => "rgba(0,0,0,0)")
          .polygonCapCurvatureResolution(4)
          .polygonsTransitionDuration(260)
          .polygonCapColor((f: any) => {
            if (f.id === stateRef.current.selected) return colors.landSel;
            if (f.id === stateRef.current.hovered) return colors.landHover;
            return countryCounts.get(f.id) ? colors.landLit : colors.land;
          })
          .polygonAltitude((f: any) => {
            if (f.id === stateRef.current.selected) return 0.03;
            if (f.id === stateRef.current.hovered) return 0.018;
            return 0.006;
          })
          .polygonStrokeColor(() => colors.stroke)
          .polygonLabel((f: any) => {
            const c = countryMetaMap.get(f.id);
            if (!c) return "";
            const n = countryCounts.get(f.id) || 0;
            return `<div class="rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] px-3 py-1.5 shadow-lg text-xs font-semibold text-[var(--ink)]">
              <span>${c.n}</span>
              <span class="block text-[11px] font-medium ${n ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]"}">
                ${n === 0 ? "Sin causas activas" : n === 1 ? "1 causa activa" : `${n} causas activas`}
              </span>
            </div>`;
          })
          .onPolygonHover((f: any) => {
            stateRef.current.hovered = f ? f.id : null;
            if (globeRef.current) globeRef.current.style.cursor = f ? "pointer" : "";
            globe.polygonCapColor(globe.polygonCapColor());
          })
          .onPolygonClick((f: any) => {
            selectCountry(f.id);
          })
          .onGlobeClick(() => {
            if (stateRef.current.selected) closePanel();
          })
          .htmlElementsData(lightsArray)
          .htmlLat("lat")
          .htmlLng("lng")
          .htmlAltitude(0.012)
          .htmlElement((d: any) => d.el)
          .htmlTransitionDuration(0)
          .ringsData([])
          .ringLat("lat")
          .ringLng("lng")
          .ringMaxRadius("max")
          .ringPropagationSpeed("speed")
          .ringRepeatPeriod("period")
          .ringColor(() => (t: number) => `rgba(${colors.ring},${(1 - t).toFixed(3)})`)
          .onGlobeReady(() => {
            if (!mounted) return;
            setIsGlobeReady(true);
            const isDarkNow =
              document.documentElement.getAttribute("data-theme") === "dark" ||
              document.documentElement.classList.contains("dark") ||
              (!document.documentElement.getAttribute("data-theme") &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
            aplicarOceano(globe, isDarkNow ? "dark" : "light");
            if (globeInstance.current) {
              globeInstance.current.pointOfView({ lat: 14, lng: -28, altitude: stateRef.current.homeAlt }, 0);
            }
            if (posterRef.current) posterRef.current.style.opacity = "0";
          });

        // Controls setup
        const ctl = globe.controls();
        ctl.enablePan = false;
        ctl.rotateSpeed = 0.55;
        ctl.zoomSpeed = 0.7;
        ctl.autoRotate = true;
        ctl.autoRotateSpeed = 0.32;
        ctl.addEventListener("start", () => {
          clearTimeout(stateRef.current.autoTimer);
          ctl.autoRotate = false;
        });
        ctl.addEventListener("end", () => {
          if (!stateRef.current.selected) {
            clearTimeout(stateRef.current.autoTimer);
            stateRef.current.autoTimer = setTimeout(() => {
              if (globeInstance.current && !stateRef.current.selected) {
                globeInstance.current.controls().autoRotate = true;
              }
            }, 6000);
          }
        });

        // Layout sizing - exact math from planeta-hero.html & Section 1.2
        const layout = () => {
          if (!containerRef.current || !globe) return;
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          const mobile = w <= 720;
          const searchEl = searchWrapperRef.current;
          const introBottom = searchEl
            ? searchEl.getBoundingClientRect().bottom - containerRef.current.getBoundingClientRect().top
            : mobile ? 220 : 180;
          const bottomEl = document.getElementById("hero-bottom-stats");
          const bottomReserve = mobile ? (bottomEl?.offsetHeight || 60) + 20 : 36;
          const avail = h - bottomReserve - introBottom;
          let d = Math.min(w * (mobile ? 0.96 : 0.9), avail / 0.93, 880);
          d = Math.max(d, 240);
          const cy = introBottom + d / 2 - d * 0.07 + Math.max(0, (avail - d * 0.93) / 2);
          const hc = Math.max(2 * cy, 2 * (h - cy), d * 1.3) + (mobile ? 160 : 0);

          if (stageRef.current) {
            stageRef.current.style.top = `${cy - hc / 2}px`;
            stageRef.current.style.height = `${hc}px`;
            stageRef.current.style.setProperty("--d", `${d}px`);
          }

          const k = (d / hc) * Math.tan((25 * Math.PI) / 180);
          stateRef.current.homeAlt = Math.sqrt(1 + 1 / (k * k)) - 1;
          stateRef.current.cy = cy;
          stateRef.current.D = d;

          const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt((mobile ? 3.2e6 : 5e6) / (w * hc)));
          globe.renderer().setPixelRatio(Math.max(1, dpr));
          globe.width(w).height(hc);

          ctl.minDistance = 100 * (1 + stateRef.current.homeAlt * 0.24);
          ctl.maxDistance = 100 * (1 + stateRef.current.homeAlt * 1.25);

          if (!stateRef.current.selected) {
            globe.pointOfView({ lat: 14, lng: -28, altitude: stateRef.current.homeAlt }, 0);
          }
          shiftStage();
        };

        layout();
        window.addEventListener("resize", layout);
        if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
          document.fonts.ready.then(layout);
        }

        // Apply theme dynamically to globe without reloads (Sección 6.1)
        const applyGlobeTheme = () => {
          if (!globeInstance.current) return;
          const c = readColors();
          const isDark =
            document.documentElement.getAttribute("data-theme") === "dark" ||
            document.documentElement.classList.contains("dark") ||
            (!document.documentElement.getAttribute("data-theme") &&
              window.matchMedia("(prefers-color-scheme: dark)").matches);

          try {
            aplicarOceano(globeInstance.current, isDark ? "dark" : "light");
            globeInstance.current
              .atmosphereColor(c.atmo)
              .atmosphereAltitude(c.atmoAlt)
              .polygonStrokeColor(() => c.stroke)
              .ringColor(() => (t: number) => `rgba(${c.ring},${(1 - t).toFixed(3)})`)
              .polygonCapColor((f: any) => {
                if (f.id === stateRef.current.selected) return c.landSel;
                if (f.id === stateRef.current.hovered) return c.landHover;
                return countryCounts.get(f.id) ? c.landLit : c.land;
              });
          } catch (err) {
            console.error("Error applying globe theme:", err);
          }
        };

        const themeObs = new MutationObserver(() => {
          applyGlobeTheme();
        });
        themeObs.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme", "class", "style"],
        });
        const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
        const onMqChange = () => applyGlobeTheme();
        if (darkMq.addEventListener) darkMq.addEventListener("change", onMqChange);

        // Pause animation when hero leaves viewport
        if ("IntersectionObserver" in window) {
          const obs = new IntersectionObserver((entries) => {
            if (!globeInstance.current) return;
            entries[0].isIntersecting ? globeInstance.current.resumeAnimation() : globeInstance.current.pauseAnimation();
          }, { threshold: 0.05 });
          obs.observe(containerRef.current);
        }

        return () => {
          themeObs.disconnect();
          if (darkMq.removeEventListener) darkMq.removeEventListener("change", onMqChange);
          window.removeEventListener("resize", layout);
        };
      } catch (err) {
        console.error("Globe initialization error:", err);
        setWebglSupported(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (globeInstance.current) {
        try {
          globeInstance.current.pauseAnimation();
          globeInstance.current.renderer().dispose();
          globeInstance.current.renderer().forceContextLoss();
        } catch {}
      }
    };
  }, [countryCounts, selectCountry, closePanel, shiftStage]);

  const selectedMeta = selectedCountry ? countryMetaMap.get(selectedCountry) : null;

  return (
    <div
      ref={containerRef}
      className="relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-[var(--bg)] select-none"
    >
      {/* Canvas cielo estrellado */}
      <canvas ref={starCanvasRef} className="absolute inset-0 pointer-events-none z-0" aria-hidden="true" />

      {/* Stage del globo terráqueo */}
      <div
        ref={stageRef}
        className="absolute left-0 right-0 z-10 transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.1,1)] pointer-events-none"
      >
        {/* Glow de ambientación */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: "var(--d, 600px)",
            height: "var(--d, 600px)",
            transform: "translate(-50%, -50%) scale(1.9)",
            background: "radial-gradient(closest-side, var(--glow), transparent 100%)",
          }}
          aria-hidden="true"
        />

        {/* Poster estático renderizado al instante */}
        <div
          ref={posterRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-opacity duration-1000"
          style={{
            width: "var(--d, 600px)",
            height: "var(--d, 600px)",
            background: "radial-gradient(circle at 36% 30%, var(--poster-hi), var(--poster-lo) 70%)",
            boxShadow: "0 0 0 1px var(--line) inset, 0 0 70px 6px var(--halo)",
          }}
          aria-hidden="true"
        />

        {/* Contenedor WebGL */}
        <div
          ref={globeRef}
          className={`absolute inset-0 transition-opacity duration-1000 pointer-events-auto cursor-grab active:cursor-grabbing ${
            isGlobeReady ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Planeta interactivo en 3D. Gira y toca un país para explorar sus causas."
        />

        {!webglSupported && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-xs text-center text-sm text-[var(--ink-2)] pointer-events-auto">
            Tu navegador no pudo inicializar WebGL. Puedes usar el buscador superior para encontrar causas en cualquier país.
          </div>
        )}
      </div>

      {/* Titular y Buscador centrado (Sección 1.3: una sola línea desde 1024px) */}
      <div
        className={`absolute left-0 right-0 top-20 sm:top-24 z-20 flex flex-col items-center px-4 text-center pointer-events-none transition-all duration-300 ${
          selectedCountry ? "opacity-0 pointer-events-none scale-95 md:scale-100" : "opacity-100"
        }`}
      >
        <h1 className="w-full text-center font-extrabold tracking-tight text-[var(--ink)] leading-[1.08] [text-wrap:balance] lg:[text-wrap:nowrap] text-[clamp(2.25rem,3.4vw,3.6rem)]">
          Cada luz es una persona que necesita ayuda.
        </h1>
        <h2 className="mt-3 text-center text-sm sm:text-base text-[var(--ink-2)] font-medium [text-wrap:balance] lg:[text-wrap:nowrap] lg:whitespace-nowrap max-w-[52ch] lg:max-w-none">
          Gira el planeta y toca un país para conocer a quién puedes apoyar ahí, sin intermediarios.
        </h2>

        <div ref={searchWrapperRef} className="mt-6 w-full flex justify-center">
          <HeroSearch
            onSelectCountry={(cCode, opts) => selectCountry(cCode, opts)}
            activeCountryCounts={countryCounts}
          />
        </div>
      </div>

      {/* Panel lateral / inferior del país */}
      {selectedCountry && selectedMeta && (
        <CountryPanel
          countryCode={selectedCountry}
          countryName={selectedMeta.n}
          nearCity={panelOpts.nearCity}
          focusCauseId={panelOpts.focusCauseId}
          onClose={closePanel}
        />
      )}

      {/* Estado en vivo y Actividad reciente */}
      <div id="hero-bottom-stats" className="pointer-events-auto">
        <RecentActivity
          activeCausesCount={totalCauses}
          activeCountriesCount={totalCountries}
          events={activityEvents}
          onSelectCountry={(cCode) => selectCountry(cCode)}
          bumpStat={bumpStat}
        />
      </div>
    </div>
  );
}

