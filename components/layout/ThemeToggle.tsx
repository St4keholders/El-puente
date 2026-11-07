"use client";

import React, { useEffect, useState } from "react";
import { IconoLuna, IconoSol } from "@/components/iconos";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let saved: "light" | "dark" | null = null;
    try {
      saved = localStorage.getItem("puente-theme") as "light" | "dark" | null;
    } catch {}
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // Si otro botón de tema ya lo cambió (hay uno en el menú del celular), se respeta
    const actual = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    const initial = actual || saved || (systemDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("puente-theme", next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      type="button"
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] cursor-pointer"
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === "dark" ? <IconoSol size={20} /> : <IconoLuna size={20} />}
    </button>
  );
}
