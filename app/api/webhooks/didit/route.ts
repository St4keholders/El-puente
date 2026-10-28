import { NextRequest, NextResponse } from "next/server";
import { diditProvider } from "@/lib/identity/didit";
import { sincronizarSesionDidit } from "@/lib/identity/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error("[Webhook Didit] No se pudo leer el cuerpo:", err);
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  // 1. Firma X-Signature-V2 sobre el JSON canonicalizado + frescura del timestamp firmado
  const evento = diditProvider.verificarFirma(rawBody, request.headers);
  if (!evento) {
    console.warn("[Webhook Didit] Firma inválida o evento vencido (401)");
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const sessionId = typeof evento.session_id === "string" ? evento.session_id : "";
  const eventId = typeof evento.event_id === "string" ? evento.event_id : undefined;
  if (!sessionId) {
    return NextResponse.json({ received: true });
  }

  // 2. Los datos se leen siempre desde la API de Didit con nuestra clave,
  //    igual que en el plan B de la pantalla de resultado.
  const res = await sincronizarSesionDidit(sessionId, { eventId });

  if (!res.ok) {
    // 500 solo si vale la pena que Didit reintente (fallo nuestro o de la API).
    const reintentable = res.error === "DIDIT_NO_RESPONDE" || res.error === "ERROR_BASE_DATOS";
    console.error("[Webhook Didit] No se pudo guardar la sesión", sessionId, res.error);
    return NextResponse.json({ error: res.error }, { status: reintentable ? 500 : 200 });
  }

  return NextResponse.json({ received: true, guardado: res.guardado });
}
