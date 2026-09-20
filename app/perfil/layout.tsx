"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
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

const NAV_ITEMS = [
  { href: "/perfil", label: "Mis datos", Icon: IconoUsuario, exact: true },
  { href: "/perfil/metodos", label: "Métodos de pago", Icon: IconoBilletera },
  { href: "/perfil/causas", label: "Mis causas", Icon: IconoArchivo },
  { href: "/perfil/guardadas", label: "Guardadas", Icon: IconoGuardar },
  { href: "/perfil/cuenta", label: "Cuenta y privacidad", Icon: IconoAjustes },
];

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, hasPhone, loading } = useUser();

  const isCurrent = (itemHref: string, exact?: boolean) => {
    if (exact) return pathname === itemHref;
    return pathname.startsWith(itemHref);
  };

  return (
    <div className="relative min-h-screen w-full pt-24 sm:pt-28 lg:pt-32 pb-24">
      <div className="relative z-[2] w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-2 sm:py-4">
        {/* ==========================================================
            BARRA DE PESTAÑAS HORIZONTAL PARA MÓVIL Y TABLET (< 1024px)
            ========================================================== */}
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

        {/* ==========================================================
            DISTRIBUCIÓN DE 2 COLUMNAS EN COMPUTADOR (>= 1024px)
            ========================================================== */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
          {/* Columna Izquierda: Tarjeta de Navegación Fija */}
          <aside className="hidden lg:block w-[280px] xl:w-[310px] flex-shrink-0 sticky top-28 xl:top-32">
            <div className="p-6 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] shadow-sm space-y-6">
              {/* Identidad del usuario (PLAN.md 4.1) */}
              <div className="flex flex-col items-center text-center">
                {loading && !user ? (
                  <div className="flex flex-col items-center space-y-2 animate-pulse w-full">
                    <div className="w-[72px] h-[72px] rounded-full bg-[var(--line)] mb-2" />
                    <div className="w-32 h-4 rounded bg-[var(--line)]" />
                    <div className="w-20 h-3 rounded bg-[var(--line)]" />
                  </div>
                ) : (
                  <>
                    <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-[var(--line)] bg-[var(--avatar)] mb-3 shadow-md flex items-center justify-center">
                      {profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                        <img
                          src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                          alt={profile?.full_name || "Foto de perfil"}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-bold text-[var(--ink)]">
                          {(profile?.full_name || user?.user_metadata?.full_name || user?.email || "P")[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-[var(--ink)] tracking-tight truncate max-w-full">
                      {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Mi perfil"}
                    </h2>
                    <p className="text-xs font-mono text-[var(--ink-3)] truncate max-w-full">
                      @{profile?.username || (user ? `id_${user.id.replace(/-/g, "").slice(0, 10)}` : "")}
                    </p>

                    {(profile?.username || user?.id) && (
                      <Link
                        href={`/u/${profile?.username || `id_${user?.id.replace(/-/g, "").slice(0, 10)}`}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-ink)] hover:underline"
                      >
                        <span>Ver mi perfil público</span>
                        <IconoFlechaDerecha size={12} />
                      </Link>
                    )}
                  </>
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

                      {/* Barra azul de 2px cuando está activo */}
                      {active && (
                        <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[var(--accent)]" />
                      )}

                      {/* Indicador de teléfono pendiente */}
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
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                    } catch (err) {
                      console.warn("Client signOut error:", err);
                    }
                    try {
                      await signOutAction();
                    } catch (err) {
                      console.warn("Server signOutAction error:", err);
                    }
                    window.location.href = "/";
                  }}
                  className="w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                >
                  <IconoSalir size={17} className="text-rose-400" />
                  <span>Cerrar sesión</span>
                </button>
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
