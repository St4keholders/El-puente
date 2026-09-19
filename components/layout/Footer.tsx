import React from "react";
import Link from "next/link";


export function Footer() {
  return (
    <footer className="mt-auto border-t border-glass-tint/40 py-10 px-4 text-xs text-text-secondary">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-primary text-sm tracking-tight">Puente</span>
            <span>•</span>
            <span>Red comunitaria de ayuda directa</span>
          </div>
          <p className="text-[11px] opacity-70">
            Sin pasarelas de pago. Sin retención de fondos. 0% comisiones.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium">
          <Link href="/como-funciona" className="hover:text-text-primary transition-colors">
            Cómo funciona
          </Link>
          <Link href="/explorar" className="hover:text-text-primary transition-colors">
            Explorar
          </Link>
          <Link href="/cerradas" className="hover:text-text-primary transition-colors">
            Cerradas
          </Link>
          <Link href="/finalizadas" className="hover:text-text-primary transition-colors">
            Finalizadas
          </Link>
          <Link href="/terminos" className="hover:text-text-primary transition-colors">
            Términos
          </Link>
          <Link href="/privacidad" className="hover:text-text-primary transition-colors">
            Privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}
