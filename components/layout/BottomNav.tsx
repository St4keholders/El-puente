"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { IconoGlobo, IconoBrujula, IconoMas, IconoGuardar, IconoUsuario } from "@/components/iconos";
import { useUser } from "@/lib/hooks/useUser";

export function BottomNav() {
  const pathname = usePathname();
  const { user, profile, hasPhone } = useUser();

  const profileHref = user ? "/perfil" : "/entrar";

  const links = [
    { href: "/", label: "Planeta", Icon: IconoGlobo },
    { href: "/explorar", label: "Explorar", Icon: IconoBrujula },
    { href: "/causa/nueva", label: "Crear", Icon: IconoMas, isCta: true },
    { href: user ? "/perfil/guardadas" : "/entrar?next=/perfil/guardadas", label: "Guardadas", Icon: IconoGuardar },
    { href: profileHref, label: "Perfil", Icon: IconoUsuario, hasBadge: user && !hasPhone },
  ];

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 md:hidden pointer-events-none">
      <Glass
        variant="bar"
        className="pointer-events-auto flex w-full max-w-md items-center justify-around py-2 px-2 shadow-2xl"
      >
        {links.map((link) => {
          const isActive = pathname === link.href;
          const { Icon } = link;

          if (link.isCta) {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cta)] text-white shadow-lg transition-transform active:scale-95"
                aria-label="Crear causa"
              >
                <IconoMas size={24} />
              </Link>
            );
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                isActive
                  ? "text-[var(--accent-ink)] font-semibold"
                  : "text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              <div className="relative">
                <Icon size={20} />
                {link.hasBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-solid)]"
                  />
                )}
              </div>
              <span className="text-[11px]">{link.label}</span>
            </Link>
          );
        })}
      </Glass>
    </div>
  );
}
