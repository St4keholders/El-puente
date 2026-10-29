import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { diditProvider, hashDocumentNumber } from "@/lib/identity/didit";
import type { ParsedVerificationEvent } from "@/lib/identity/provider";
import { nombrePublico, repartirNombre, ultimosCuatro } from "@/lib/identity/nombre";
import { paisIso2 } from "@/lib/geo/paises-iso";

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
    p_country: paisIso2(decision.documentCountry) || undefined,
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

  const estadoFinal = (data as { status?: string } | null)?.status;
  if (estadoFinal === "aprobada") {
    await guardarDatosIdentidad(admin, sessionId, userId, decision);
  }

  return { ok: true, guardado: true, estadoDidit: decision.rawStatus, resultado: data };
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Guarda lo que se muestra de la identidad: últimos 4 del documento, nombres y apellidos
 * por separado y el país en alfa-2. Deja el nombre público fijo ("Juan Andrés V.").
 * Si algo falla se registra, pero no tumba la verificación ya aprobada.
 */
async function guardarDatosIdentidad(
  admin: Admin,
  sessionId: string,
  userId: string,
  decision: ParsedVerificationEvent
) {
  const repartido = repartirNombre(decision.verifiedFullName);
  const { error: verifErr } = await admin
    .from("identity_verifications")
    .update({
      document_last4: ultimosCuatro(decision.documentNumber),
      verified_given_names: decision.givenNames?.trim() || repartido.nombres || null,
      verified_last_names: decision.lastNames?.trim() || repartido.apellidos || null,
      document_country: paisIso2(decision.documentCountry),
    })
    .eq("provider_session_id", sessionId)
    .eq("user_id", userId);
  if (verifErr) {
    console.error("[guardarDatosIdentidad] verificación:", verifErr.code, verifErr.message);
  }

  const publico = nombrePublico({
    nombres: decision.givenNames,
    apellidos: decision.lastNames,
    nombreCompleto: decision.verifiedFullName,
  });
  if (publico) {
    const { error: perfilErr } = await admin.from("profiles").update({ full_name: publico }).eq("id", userId);
    if (perfilErr) {
      console.error("[guardarDatosIdentidad] perfil:", perfilErr.code, perfilErr.message);
    }
  }
}

/**
 * Para cuentas verificadas antes de este cambio: si a la verificación vigente le faltan
 * los últimos 4 o los nombres, se los pide a Didit una sola vez y los guarda.
 */
export async function completarDatosIdentidad(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: verif, error } = await admin
      .from("identity_verifications")
      .select("provider_session_id, document_last4, verified_given_names, document_country")
      .eq("user_id", userId)
      .eq("status", "aprobada")
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[completarDatosIdentidad] leer:", error.code, error.message);
      return;
    }
    if (!verif?.provider_session_id) return;
    // Ya se completó antes (aunque Didit no hubiera devuelto todos los datos): no se repite.
    if (verif.document_last4 || verif.verified_given_names) return;

    const decision = await diditProvider.obtenerDecision(verif.provider_session_id);
    if (decision.userId && decision.userId !== userId) return;
    await guardarDatosIdentidad(admin, verif.provider_session_id, userId, decision);
  } catch (err) {
    console.error("[completarDatosIdentidad]", err);
  }
}
