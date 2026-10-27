import { NextRequest, NextResponse } from "next/server";
import { diditProvider, hashDocumentNumber } from "@/lib/identity/didit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error("[Webhook Didit] Error al leer cuerpo crudo:", err);
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  // 1. Verificación de firma HMAC en tiempo constante
  const isValid = diditProvider.verificarFirma(rawBody, request.headers);
  if (!isValid) {
    console.warn("[Webhook Didit] Firma inválida rechazada (401)");
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // 2. Extraer y procesar evento
  try {
    const event = await diditProvider.leerEvento(rawBody);

    if (!event.sessionId) {
      console.warn("[Webhook Didit] Evento sin sessionId, ignorando.");
      return NextResponse.json({ received: true });
    }

    const admin = createAdminClient();

    // Obtener userId si no vino en el evento (por ejemplo buscando por session_id)
    let targetUserId = event.userId;
    if (!targetUserId) {
      const { data: existing } = await admin
        .from("identity_verifications")
        .select("user_id")
        .eq("provider_session_id", event.sessionId)
        .maybeSingle();

      if (existing?.user_id) {
        targetUserId = existing.user_id;
      }
    }

    if (!targetUserId) {
      console.warn("[Webhook Didit] No se pudo vincular la sesión con un usuario:", event.sessionId);
      return NextResponse.json({ received: true });
    }

    // Calcular hash del documento si está disponible
    const documentHash = event.documentNumber ? hashDocumentNumber(event.documentNumber) : null;

    // Procesar con la función SQL segura
    const { data: rpcResult, error: rpcErr } = await admin.rpc(
      "procesar_verificacion_didit",
      {
        p_event_id: event.eventId || `evt_${event.sessionId}_${Date.now()}`,
        p_session_id: event.sessionId,
        p_user_id: targetUserId,
        p_status: event.status,
        p_full_name: event.verifiedFullName || undefined,
        p_country: event.documentCountry || undefined,
        p_document_hash: documentHash || undefined,
        p_decline_reason: event.declineReason || undefined,
      }
    );

    if (rpcErr) {
      console.error("[Webhook Didit] Error al ejecutar procesar_verificacion_didit:", rpcErr);
      return NextResponse.json(
        { error: "Error al registrar verificación en base de datos" },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, result: rpcResult });
  } catch (err) {
    console.error("[Webhook Didit] Error procesando webhook:", err);
    return NextResponse.json({ received: true });
  }
}
