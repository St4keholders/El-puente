import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { diditProvider, hashDocumentNumber } from "@/lib/identity/didit";

/** Estados de Didit que ya son una decisión y vale la pena guardar. */
const ESTADOS_FINALES = new Set(["Approved", "Declined", "In Review", "Expired", "Kyc Expired"]);

export type SyncResult =
  | { ok: true; guardado: boolean; estadoDidit: string; resultado?: unknown }
  | { ok: false; error: string };

/**
 * Consulta a Didit cómo quedó una sesión y la guarda en Supabase.
 * La usan el webhook (camino normal) y la pantalla de resultado (plan B si el webhook no llegó).
 *
 * @param sessionId     sesión de Didit
 * @param userIdEsperado si se pasa, la sesión debe pertenecer a esa persona (vendor_data)
 * @param eventId       id del evento del webhook, para no procesarlo dos veces
 */
export async function sincronizarSesionDidit(
  sessionId: string,
  opciones: { userIdEsperado?: string; eventId?: string } = {}
): Promise<SyncResult> {
  let decision;
  try {
    decision = await diditProvider.obtenerDecision(sessionId);
  } catch (err) {
    console.error("[sincronizarSesionDidit] No se pudo consultar a Didit:", err);
    return { ok: false, error: "DIDIT_NO_RESPONDE" };
  }

  const userId = decision.userId;
  if (!userId) {
    console.error("[sincronizarSesionDidit] La sesión no trae vendor_data:", sessionId);
    return { ok: false, error: "SESION_SIN_PERSONA" };
  }
  if (opciones.userIdEsperado && opciones.userIdEsperado !== userId) {
    console.error("[sincronizarSesionDidit] La sesión pertenece a otra persona:", sessionId);
    return { ok: false, error: "SESION_AJENA" };
  }

  // Mientras la persona no termine, no hay nada que guardar.
  if (!ESTADOS_FINALES.has(decision.rawStatus)) {
    return { ok: true, guardado: false, estadoDidit: decision.rawStatus };
  }

  const admin = createAdminClient();

  const { data: perfil, error: perfilErr } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (perfilErr) {
    console.error("[sincronizarSesionDidit] Error buscando el perfil:", perfilErr.code, perfilErr.message);
    return { ok: false, error: "ERROR_BASE_DATOS" };
  }
  if (!perfil) {
    console.error("[sincronizarSesionDidit] vendor_data no corresponde a ningún perfil:", userId);
    return { ok: false, error: "PERSONA_INEXISTENTE" };
  }

  const documentHash = decision.documentNumber ? hashDocumentNumber(decision.documentNumber) : null;

  const { data, error } = await admin.rpc("procesar_verificacion_didit", {
    p_event_id: opciones.eventId || `sync_${sessionId}_${decision.rawStatus}`,
    p_session_id: sessionId,
    p_user_id: userId,
    p_status: decision.rawStatus,
    p_full_name: decision.verifiedFullName || undefined,
    p_country: decision.documentCountry || undefined,
    p_document_hash: documentHash || undefined,
    p_decline_reason: decision.declineReason || undefined,
  });

  if (error) {
    console.error(
      "[sincronizarSesionDidit] Error en procesar_verificacion_didit:",
      error.code,
      error.message
    );
    return { ok: false, error: "ERROR_BASE_DATOS" };
  }

  return { ok: true, guardado: true, estadoDidit: decision.rawStatus, resultado: data };
}
