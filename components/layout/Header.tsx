"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUser } from "@/lib/hooks/useUser";
import { urlDeAvatar } from "@/lib/media";
import {
  IconoAyuda,
  IconoCheckCirculo,
  IconoBrujula,
  IconoSalir,
  IconoHamburguesa,
  IconoEstrellas,
  IconoX,
} from "@/components/iconos";

export function Header() {
  const pathname = usePathname();
  const { user, profile, hasPhone, hasPendingSupports } = useUser();
  const tienePendientes = !hasPhone || hasPendingSupports;
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { href: "/explorar", label: "Explorar causas" },
    { href: "/finalizadas", label: "Finalizadas" },
    { href: "/como-funciona", label: "Cómo funciona" },
  ];

  // El menú se cierra al cambiar de página, al tocar fuera o con Escape
  const [rutaMenu, setRutaMenu] = useState(pathname);
  if (rutaMenu !== pathname) {
    setRutaMenu(pathname);
    setMenuAbierto(false);
  }
  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setMenuAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [menuAbierto]);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <Glass
        variant="bar"
        className="pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-4 py-2.5 px-4 md:px-6 overflow-visible"
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

        {/* Acciones derechas */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* En el celular el tema va dentro del menú, para que quepa todo */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

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
                aria-label={
                  hasPendingSupports
                    ? "Mi perfil, tienes avisos de donación por confirmar"
                    : !hasPhone
                    ? "Mi perfil, tienes datos pendientes"
                    : "Mi perfil"
                }
              >
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full overflow-hidden bg-[var(--avatar)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] flex-shrink-0">
                  {urlDeAvatar(profile?.avatar_url) ? (
                    <img
                      src={urlDeAvatar(profile?.avatar_url)!}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{(profile?.full_name || user.email || "U")[0].toUpperCase()}</span>
                  )}
                </div>
                <span className="max-w-[100px] truncate">{profile?.full_name?.split(" ")[0] || "Perfil"}</span>
                {tienePendientes && (
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
                className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--field)] text-[var(--ink-3)] hover:text-rose-400 hover:border-rose-400/40 hover:bg-rose-500/10 transition-colors"
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

          {/* Menú (celular y tableta): Explorar, Finalizadas, Cómo funciona, tema y salir */}
          <div ref={menuRef} className="relative lg:hidden">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-controls="menu-principal-movil"
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--field)] text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
            >
              {menuAbierto ? <IconoX size={18} /> : <IconoHamburguesa size={18} />}
            </button>

            {menuAbierto && (
              <div
                id="menu-principal-movil"
                className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] p-2 shadow-2xl animate-fade-in"
              >
                <nav aria-label="Menú principal" className="flex flex-col">
                  {[
                    { href: "/explorar", label: "Explorar causas", icono: <IconoBrujula size={18} /> },
                    { href: "/finalizadas", label: "Finalizadas", icono: <IconoCheckCirculo size={18} /> },
                    { href: "/como-funciona", label: "Cómo funciona", icono: <IconoAyuda size={18} /> },
                    { href: "/tutorial", label: "Tutorial de 1 minuto", icono: <IconoEstrellas size={18} /> },
                  ].map((l) => {
                    const activo = pathname === l.href;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={activo ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors ${
                          activo
                            ? "bg-[var(--hover)] text-[var(--accent-ink)] font-semibold"
                            : "text-[var(--ink)] hover:bg-[var(--hover)]"
                        }`}
                      >
                        <span className={activo ? "text-[var(--accent-ink)]" : "text-[var(--ink-2)]"}>{l.icono}</span>
                        {l.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="my-2 h-px bg-[var(--line)] md:hidden" />
                <div className="flex items-center justify-between rounded-xl px-3 py-1.5 md:hidden">
                  <span className="text-[15px] font-medium text-[var(--ink)]">Tema</span>
                  <ThemeToggle />
                </div>
                {user && (
                  <a
                    href="/auth/signout"
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-rose-500 hover:bg-rose-500/10 md:hidden"
                  >
                    <IconoSalir size={18} />
                    Cerrar sesión
                  </a>
                )}
                <div className="mt-1 flex gap-4 px-3 pb-1 pt-2 text-xs text-[var(--ink-3)]">
                  <Link href="/terminos" className="hover:text-[var(--ink)]">
                    Términos
                  </Link>
                  <Link href="/privacidad" className="hover:text-[var(--ink)]">
                    Privacidad
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </Glass>
    </header>
  );
}
