import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { paisIso2 } from "@/lib/geo/paises-iso";

/** Horas seguidas que hay que llevar conectado desde un país distinto al del documento. */
export const HORAS_CONFIRMACION = 6;

export interface EstadoPaisPublicacion {
  /** Tiene una verificación de identidad aprobada y vigente. */
  verificado: boolean;
  paisDocumento: string | null;
  /** País desde donde se conecta ahora (alfa-2), según Vercel. */
  paisConexion: string | null;
  /** Países que puede elegir para la causa. Vacío si no está verificado (aún no aplica). */
  opciones: string[];
  /** Puede publicar ya en alguno de esos países. */
  listo: boolean;
  /** Si está confirmando ubicación en otro país, cuánto falta (en minutos). */
  minutosRestantes: number;
}

/** País de la conexión actual. Vercel lo pone en cada petición y el navegador no lo puede cambiar. */
async function paisDeLaConexion(): Promise<string> {
  const h = await headers();
  const pais = (h.get("x-vercel-ip-country") || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(pais)) return pais;
  // En local no hay cabecera de Vercel: se puede simular con PAIS_CONEXION_DEV.
  if (process.env.NODE_ENV !== "production" && process.env.PAIS_CONEXION_DEV) {
    return process.env.PAIS_CONEXION_DEV.toUpperCase();
  }
  return "XX";
}

/**
 * Guarda el país desde donde se conecta la persona. Si cambió desde la última vez,
 * el reloj de las 6 horas vuelve a empezar (así una VPN no sirve para publicar en otro país).
 */
export async function registrarConexion(userId: string): Promise<{ pais: string; desde: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("registrar_conexion", {
      p_user_id: userId,
      p_pais: await paisDeLaConexion(),
    });
    if (error) {
      console.error("[registrarConexion]", error.code, error.message);
      return null;
    }
    const fila = Array.isArray(data) ? data[0] : data;
    return fila ? { pais: fila.pais, desde: fila.desde } : null;
  } catch (err) {
    console.error("[registrarConexion]", err);
    return null;
  }
}

/** Registra la conexión y calcula en qué países puede publicar. La base aplica la misma regla. */
export async function estadoPaisPublicacion(userId: string): Promise<EstadoPaisPublicacion> {
  const conexion = await registrarConexion(userId);
  const admin = createAdminClient();
  const { data: verif } = await admin
    .from("identity_verifications")
    .select("document_country, expires_at")
    .eq("user_id", userId)
    .eq("status", "aprobada")
    .order("verified_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const vigente = Boolean(verif) && (!verif?.expires_at || new Date(verif.expires_at) > new Date());
  const paisDocumento = vigente ? paisIso2(verif?.document_country) : null;
  const paisConexion = conexion && /^[A-Z]{2}$/.test(conexion.pais) && conexion.pais !== "XX" ? conexion.pais : null;

  if (!vigente) {
    return { verificado: false, paisDocumento: null, paisConexion, opciones: [], listo: false, minutosRestantes: 0 };
  }

  // Conectado desde el país del documento: solo ese país y sin espera.
  if (paisDocumento && paisConexion === paisDocumento) {
    return { verificado: true, paisDocumento, paisConexion, opciones: [paisDocumento], listo: true, minutosRestantes: 0 };
  }

  const opciones = [paisDocumento, paisConexion].filter((p): p is string => Boolean(p));
  const desde = conexion ? new Date(conexion.desde).getTime() : Date.now();
  const transcurrido = (Date.now() - desde) / 60000;
  const minutosRestantes = Math.max(0, Math.ceil(HORAS_CONFIRMACION * 60 - transcurrido));

  return {
    verificado: true,
    paisDocumento,
    paisConexion,
    opciones,
    listo: minutosRestantes === 0 && opciones.length > 0,
    minutosRestantes,
  };
}
