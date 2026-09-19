"use client";

import React, { useEffect, useRef } from "react";

const LINK_DIST = 110;
const MOUSE_RADIUS = 240;

type Nodo = { x: number; y: number; vx: number; vy: number; r: number };

export function FondoConstelacion() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia("(hover: none)").matches;
    const pointer = { x: -99999, y: -99999, t: -99999 };
    const phase = Math.random() * Math.PI * 2;
    let nodos: Nodo[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;

    // Colores desde CSS para respetar el tema
    let rgb = "255,255,255";
    let halo = 0.085;
    let fuerza = 1;

    const leerTema = () => {
      const cs = getComputedStyle(document.documentElement);
      rgb = cs.getPropertyValue("--fx-rgb").trim() || rgb;
      halo = parseFloat(cs.getPropertyValue("--fx-halo")) || halo;
      fuerza = parseFloat(cs.getPropertyValue("--fx-fuerza")) || fuerza;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(26, Math.min(85, Math.round((w * h) / 17000)));
      nodos = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: 1 + Math.random() * 1.3,
      }));
    };

    const draw = (now: number) => {
      let mx = pointer.x;
      let my = pointer.y;
      if (touch || now - pointer.t > 2500) {
        mx = w * (0.5 + 0.36 * Math.sin(now * 0.00042 + phase));
        my = h * (0.5 + 0.36 * Math.sin(now * 0.00031 + phase * 1.7));
      }
      ctx.clearRect(0, 0, w, h);

      const g = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_RADIUS * 1.35);
      g.addColorStop(0, `rgba(${rgb},${halo})`);
      g.addColorStop(0.35, `rgba(${rgb},${halo * 0.41})`);
      g.addColorStop(0.7, `rgba(${rgb},${halo * 0.14})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(
        mx - MOUSE_RADIUS * 1.35,
        my - MOUSE_RADIUS * 1.35,
        MOUSE_RADIUS * 2.7,
        MOUSE_RADIUS * 2.7
      );

      if (!reduced) {
        for (const n of nodos) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }

      for (let i = 0; i < nodos.length; i++) {
        const a = nodos[i];
        const heatA = Math.max(0, 1 - Math.hypot(a.x - mx, a.y - my) / MOUSE_RADIUS);
        for (let j = i + 1; j < nodos.length; j++) {
          const b = nodos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const heatB = Math.max(0, 1 - Math.hypot(b.x - mx, b.y - my) / MOUSE_RADIUS);
            const o =
              (0.022 + Math.max(heatA, heatB) * 0.34) *
              (1 - Math.sqrt(d2) / LINK_DIST) *
              fuerza;
            if (o > 0.006) {
              ctx.strokeStyle = `rgba(${rgb},${o})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
        ctx.fillStyle = `rgba(${rgb},${(0.09 + heatA * 0.72) * fuerza})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + heatA * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - last < 33) return; // máximo ~30 fps
      last = now;
      draw(now);
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.t = performance.now();
    };

    const obs = new MutationObserver(() => {
      leerTema();
      if (reduced) draw(performance.now());
    });

    leerTema();
    resize();
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    window.addEventListener("resize", resize);
    if (!touch) window.addEventListener("pointermove", onMove, { passive: true });
    if (reduced) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="fondo-constelacion" />;
}
