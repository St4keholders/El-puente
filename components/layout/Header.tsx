"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUser } from "@/lib/hooks/useUser";
import {
  IconoMenuHorizontal,
  IconoAyuda,
  IconoCheckCirculo,
  IconoArchivo,
  IconoSalir,
} from "@/components/iconos";

export function Header() {
  const pathname = usePathname();
  const { user, profile, hasPhone } = useUser();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const navLinks = [
    { href: "/explorar", label: "Explorar causas" },
    { href: "/cerradas", label: "Cerradas" },
    { href: "/finalizadas", label: "Finalizadas" },
    { href: "/como-funciona", label: "Cómo funciona" },
  ];

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <Glass
        variant="bar"
        className="pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-4 py-2.5 px-4 md:px-6"
      >
        {/* Marca / Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--ink)] transition-opacity hover:opacity-85"
          aria-label="Puente, inicio"
        >
          <svg viewBox="0 0 30 18" className="h-5 w-8 overflow-visible" aria-hidden="true">
            <path
              d="M4 14 C 9 1.5, 21 1.5, 26 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.5"
            />
            <circle cx="4" cy="14" r="2.6" fill="currentColor" />
            <circle cx="26" cy="14" r="2.6" fill="var(--accent)" />
          </svg>
          <span>Puente</span>
        </Link>

        {/* Navegación Escritorio (>= 1100px) */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Navegación principal">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--hover)] text-[var(--accent-ink)] font-semibold"
                    : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Navegación Tableta (721px a 1099px) */}
        <nav className="hidden md:flex lg:hidden items-center gap-2" aria-label="Navegación tableta">
          <Link
            href="/explorar"
            aria-current={pathname === "/explorar" ? "page" : undefined}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/explorar"
                ? "bg-[var(--hover)] text-[var(--accent-ink)] font-semibold"
                : "text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
          >
            Explorar
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              type="button"
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
            >
              <span>Más</span>
              <IconoMenuHorizontal size={16} />
            </button>
            {showMoreMenu && (
              <Glass
                variant="menu"
                className="absolute right-0 top-full mt-2 w-48 shadow-xl"
              >
                <Link
                  href="/cerradas"
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  <IconoArchivo size={16} className="text-[var(--ink-2)]" />
                  <span>Cerradas</span>
                </Link>
                <Link
                  href="/finalizadas"
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  <IconoCheckCirculo size={16} className="text-[var(--accent-ink)]" />
                  <span>Finalizadas</span>
                </Link>
                <Link
                  href="/como-funciona"
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  <IconoAyuda size={16} className="text-[var(--ink-2)]" />
                  <span>Cómo funciona</span>
                </Link>
              </Glass>
            )}
          </div>
        </nav>

        {/* Acciones derechas */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          {/* Botón Crear Causa (Desktop y Tableta) */}
          <Link
            href="/causa/nueva"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-95"
          >
            <span>Crear una causa</span>
          </Link>

          {/* Autenticación: Sin sesión = Entrar | Con sesión = Enlace directo a Mi perfil + Cerrar sesión */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/perfil"
                className="relative inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--field)] pl-2 pr-3 py-1.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--glass-edge)]"
                aria-label={!hasPhone ? "Mi perfil, tienes datos pendientes" : "Mi perfil"}
              >
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full overflow-hidden bg-[var(--avatar)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{(profile?.full_name || user.email || "U")[0].toUpperCase()}</span>
                  )}
                </div>
                <span className="max-w-[100px] truncate">{profile?.full_name?.split(" ")[0] || "Perfil"}</span>
                {!hasPhone && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-solid)] animate-pulse"
                  />
                )}
              </Link>
              <a
                href="/auth/signout"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--field)] text-[var(--ink-3)] hover:text-rose-400 hover:border-rose-400/40 hover:bg-rose-500/10 transition-colors"
              >
                <IconoSalir size={15} />
              </a>
            </div>
          ) : (
            <Link
              href="/entrar"
              className="inline-flex items-center rounded-xl border border-[var(--line)] bg-[var(--field)] px-3.5 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--glass-edge)]"
            >
              Entrar
            </Link>
          )}
        </div>
      </Glass>
    </header>
  );
}
