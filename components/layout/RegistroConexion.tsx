"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { registrarConexionAction } from "@/lib/actions/conexion";

const CLAVE = "puente:conexion-registrada";
const CADA_MS = 20 * 60 * 1000;

/**
 * Mientras la persona usa Puente con sesión iniciada, avisa cada 20 minutos desde qué país
 * se conecta. Con eso se suman las 6 horas que pide la regla para publicar fuera del país
 * del documento. No muestra nada.
 */
export function RegistroConexion() {
  useEffect(() => {
    let cancelado = false;

    const registrar = async () => {
      if (cancelado || document.visibilityState !== "visible") return;
      let ultima = 0;
      try {
        ultima = Number(sessionStorage.getItem(CLAVE) || 0);
      } catch {}
      if (Date.now() - ultima < CADA_MS) return;

      const { data } = await createClient().auth.getSession();
      if (!data.session || cancelado) return;
      try {
        sessionStorage.setItem(CLAVE, String(Date.now()));
      } catch {}
      registrarConexionAction().catch(() => {});
    };

    registrar();
    const intervalo = window.setInterval(registrar, 60 * 1000);
    document.addEventListener("visibilitychange", registrar);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", registrar);
    };
  }, []);

  return null;
}
