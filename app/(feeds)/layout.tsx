import React from "react";
import { FondoConstelacion } from "@/components/fondo/FondoConstelacion";

export default function FeedsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full pt-24 sm:pt-28 lg:pt-32">
      {/* Fondo Stakeholders: Nodos + Grano + Resplandor */}
      <FondoConstelacion />
      <div className="fondo-grano" aria-hidden="true" />
      <div className="fondo-resplandor" aria-hidden="true" />

      {/* Contenido en capa superior */}
      <div className="relative z-[2] w-full">
        {children}
      </div>
    </div>
  );
}
