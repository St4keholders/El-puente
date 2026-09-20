import React from "react";

export default function FeedsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // FondoConstelacion + grano + resplandor are rendered globally
  // by FondoGlobal in the root layout — no need to duplicate here.
  return (
    <div className="relative min-h-screen w-full pt-24 sm:pt-28 lg:pt-32">
      {/* Contenido en capa superior */}
      <div className="relative z-[2] w-full">
        {children}
      </div>
    </div>
  );
}
