"use client";

import { usePathname } from "next/navigation";
import { FondoConstelacion } from "./FondoConstelacion";

/**
 * Renders the constellation background on all pages EXCEPT the home page ("/"),
 * where the planet globe already provides its own sky background.
 */
export function FondoGlobal() {
  const pathname = usePathname();
  // Home page uses the planet globe — skip to avoid double backgrounds
  if (pathname === "/") return null;

  return (
    <>
      <FondoConstelacion />
      <div className="fondo-grano" aria-hidden="true" />
      <div className="fondo-resplandor" aria-hidden="true" />
    </>
  );
}
