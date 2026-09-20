"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import {
  IconoUsuario,
  IconoBilletera,
  IconoArchivo,
  IconoGuardar,
  IconoAjustes,
  IconoFlechaDerecha,
  IconoSalir,
} from "@/components/iconos";
import type { Database } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const NAV_ITEMS = [
  { href: "/perfil", label: "Mis datos", Icon: IconoUsuario, exact: true },
  { href: "/perfil/metodos", label: "Métodos de pago", Icon: IconoBilletera },
  { href: "/perfil/causas", label: "Mis causas", Icon: IconoArchivo },
  { href: "/perfil/guardadas", label: "Guardadas", Icon: IconoGuardar },
  { href: "/perfil/cuenta", label: "Cuenta y privacidad", Icon: IconoAjustes },
];

interface PerfilLayoutClientProps {
  user: User;
  profile: Profile | null;
  hasPhone: boolean;
  children: React.ReactNode;
}

export function PerfilLayoutClient({
  user,
  profile,
  hasPhone,
  children,
}: PerfilLayoutClientProps) {
  const pathname = usePathname();

  const isCurrent = (itemHref: string, exact?: boolean) => {
    if (exact) return pathname === itemHref;
    return pathname.startsWith(itemHref);
  };

  const handleSignOut = () => {
    window.location.href = "/auth/signout";
  };

  const displayName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Mi perfil";

  const displayUser = profile?.username || user.email?.split("@")[0] || "usuario";
  const displayAvatar =
    profile?.avatar_url ||
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null;

  return (
    <div className="relative min-h-screen w-full pt-24 sm:pt-28 lg:pt-32 pb-24">
      <div className="relative z-[2] w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-2 sm:py-4">
        {/* Barra de pestañas horizontal en móvil (< 1024px) */}
        <div className="lg:hidden mb-6 -mx-4 px-4 overflow-x-auto scrollbar-none border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md sticky top-16 z-20 py-2">
          <nav className="flex items-center gap-1.5 min-w-max" aria-label="Navegación de perfil en móvil">
            {NAV_ITEMS.map((item) => {
              const active = isCurrent(item.href, item.exact);
              const { Icon } = item;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
                    active
                      ? "bg-[var(--surface-solid)] text-[var(--ink)] shadow-sm border border-[var(--line)] border-b-2 border-b-[var(--accent)]"
                      : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
                  }`}
                >
                  <Icon size={16} className={active ? "text-[var(--accent)]" : "text-[var(--ink-3)]"} />
                  <span>{item.label}</span>
                  {item.href === "/perfil" && !hasPhone && (
                    <span
                      aria-label="Tienes datos pendientes"
                      className="w-2 h-2 rounded-full bg-[var(--accent)]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 2 columnas en Desktop (>= 1024px) */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
          {/* Columna Izquierda: Tarjeta de Navegación Fija */}
          <aside className="hidden lg:block w-[280px] xl:w-[310px] flex-shrink-0 sticky top-28 xl:top-32">
            <div className="p-6 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] shadow-sm space-y-6">
              {/* Identidad del usuario resuelta en servidor */}
              <div className="flex flex-col items-center text-center">
                <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-[var(--line)] bg-[var(--avatar)] mb-3 shadow-md flex items-center justify-center">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold text-[var(--ink)]">
                      {displayName[0].toUpperCase()}
                    </span>
                  )}
                </div>

                <h2 className="text-base font-bold text-[var(--ink)] tracking-tight truncate max-w-full">
                  {displayName}
                </h2>
                <p className="text-xs font-mono text-[var(--ink-3)] truncate max-w-full">
                  @{displayUser}
                </p>

                {displayUser && (
                  <Link
                    href={`/u/${displayUser}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-ink)] hover:underline"
                  >
                    <span>Ver mi perfil público</span>
                    <IconoFlechaDerecha size={12} />
                  </Link>
                )}
              </div>

              {/* Menú de Secciones */}
              <nav className="flex flex-col gap-1 pt-3 border-t border-[var(--line)]" aria-label="Navegación de perfil">
                {NAV_ITEMS.map((item) => {
                  const active = isCurrent(item.href, item.exact);
                  const { Icon } = item;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center justify-between py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? "bg-[var(--surface-solid)] text-[var(--ink)] shadow-sm border border-[var(--line)] font-bold"
                          : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={17} className={active ? "text-[var(--accent)]" : "text-[var(--ink-3)]"} />
                        <span>{item.label}</span>
                      </div>

                      {active && (
                        <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[var(--accent)]" />
                      )}

                      {item.href === "/perfil" && !hasPhone && (
                        <span
                          aria-label="Tienes datos pendientes"
                          className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Botón Cerrar Sesión en Barra Lateral */}
              <div className="pt-3 border-t border-[var(--line)]">
                <a
                  href="/auth/signout"
                  className="w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                >
                  <IconoSalir size={17} className="text-rose-400" />
                  <span>Cerrar sesión</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Columna Derecha: Contenido de la Sección */}
          <main className="flex-1 min-w-0 max-w-[920px]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
