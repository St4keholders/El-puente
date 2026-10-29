import "server-only";
import crypto from "crypto";
import type {
  IdentityProvider,
  CreateSessionParams,
  CreateSessionResult,
  ParsedVerificationEvent,
  VerificationNormalizedStatus,
} from "./provider";

const DIDIT_WORKFLOW_ID = "db13ea38-f263-4bd1-814b-9a8a1fa106b1";
const DEFAULT_CALLBACK_URL = "https://www.elpuentesh.org/verificacion/resultado";

function getApiKey(): string {
  const key = process.env.DIDIT_API_KEY;
  if (!key) {
    throw new Error("DIDIT_API_KEY no está configurada.");
  }
  return key;
}

function getWebhookSecret(): string {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("DIDIT_WEBHOOK_SECRET no está configurada.");
  }
  return secret;
}

function getPepper(): string {
  const pepper = process.env.VERIFICATION_PEPPER;
  if (!pepper) {
    throw new Error("VERIFICATION_PEPPER no está configurada.");
  }
  return pepper;
}

/**
 * Calcula el hash SHA-256 de un número de documento más el PEPPER secreto.
 * Nunca guarda el número real en la base de datos.
 */
export function hashDocumentNumber(rawNumber: string): string {
  const pepper = getPepper();
  const cleaned = rawNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHash("sha256").update(`${cleaned}${pepper}`).digest("hex");
}

function normalizeDiditStatus(statusStr: string): VerificationNormalizedStatus {
  const s = (statusStr || "").toLowerCase().trim();
  if (s === "approved") return "aprobada";
  if (s === "declined") return "rechazada";
  if (s === "in review" || s === "in_review") return "en_revision";
  if (s === "kyc expired" || s === "expired") return "vencida";
  if (s === "pendiente" || s === "aprobada" || s === "rechazada" || s === "en_revision" || s === "vencida") {
    return s as VerificationNormalizedStatus;
  }
  return "pendiente";
}

function getHeaderValue(
  cabeceras: Record<string, string | string[] | undefined> | Headers,
  headerName: string
): string | undefined {
  if (cabeceras instanceof Headers) {
    return cabeceras.get(headerName) || cabeceras.get(headerName.toLowerCase()) || undefined;
  }
  const keyLower = headerName.toLowerCase();
  for (const [k, v] of Object.entries(cabeceras)) {
    if (k.toLowerCase() === keyLower) {
      if (Array.isArray(v)) return v[0];
      return v;
    }
  }
  return undefined;
}

// Canonicalización de Didit para X-Signature-V2.
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)])
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

export class DiditProvider implements IdentityProvider {
  /**
   * Crea una sesión de verificación en Didit v3.
   */
  async crearSesion(params: CreateSessionParams): Promise<CreateSessionResult> {
    const apiKey = getApiKey();
    const payload = {
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: params.userId,
      callback: params.callbackUrl || DEFAULT_CALLBACK_URL,
    };

    const res = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[DiditProvider] Error al crear sesión:", res.status, errorText);
      throw new Error(`Didit API error ${res.status}`);
    }

    const data = await res.json();
    const sessionId = data.session_id || data.id;
    const url = data.url;

    if (!sessionId || !url) {
      throw new Error("Respuesta inválida al crear sesión en Didit.");
    }

    return { sessionId, url };
  }

  /**
   * Verifica X-Signature-V2 tal como lo documenta Didit: HMAC-SHA256 sobre el JSON
   * canonicalizado (enteros sin decimales y claves ordenadas), no sobre el cuerpo crudo.
   * La frescura se mide con el campo `timestamp` del cuerpo, que sí está firmado.
   * Devuelve el cuerpo ya parseado si todo es válido; si no, null.
   */
  verificarFirma(
    cuerpoCrudo: string,
    cabeceras: Record<string, string | string[] | undefined> | Headers
  ): Record<string, unknown> | null {
    const secret = getWebhookSecret();
    const signature = getHeaderValue(cabeceras, "x-signature-v2") ?? "";
    if (!signature) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cuerpoCrudo);
    } catch {
      return null;
    }

    const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
    const expected = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

    const ts = Number(parsed.timestamp);
    if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
      console.warn("[DiditProvider] Webhook fuera de la ventana de 5 minutos:", ts);
      return null;
    }

    return parsed;
  }

  /**
   * Busca la sesión más reciente de una persona en Didit (por vendor_data).
   * Sirve para recuperar verificaciones cuya fila "pendiente" nunca llegó a guardarse.
   */
  async buscarUltimaSesion(userId: string): Promise<string | null> {
    const res = await fetch(
      `https://verification.didit.me/v3/sessions?vendor_data=${encodeURIComponent(userId)}`,
      { method: "GET", headers: { "x-api-key": getApiKey() }, cache: "no-store" }
    );
    if (!res.ok) {
      console.error("[DiditProvider] No se pudieron listar las sesiones:", res.status);
      return null;
    }
    const body = await res.json();
    const lista: Array<{ session_id?: string; vendor_data?: string; created_at?: string }> =
      Array.isArray(body) ? body : body.results || body.data || body.sessions || [];
    const propias = lista
      .filter((x) => x.session_id && (!x.vendor_data || x.vendor_data === userId))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return propias[0]?.session_id || null;
  }

  /**
   * Pregunta a Didit, con nuestra propia clave, cómo quedó una sesión.
   * Es la fuente de datos tanto para el webhook como para el plan B al volver de Didit.
   */
  async obtenerDecision(sessionId: string): Promise<ParsedVerificationEvent> {
    const res = await fetch(
      `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
      { method: "GET", headers: { "x-api-key": getApiKey() }, cache: "no-store" }
    );

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Didit respondió ${res.status} al consultar la sesión ${sessionId}: ${detalle.slice(0, 200)}`);
    }

    const d = await res.json();
    const rawStatus: string = d.status || "In Progress";

    const idv = Array.isArray(d.id_verifications) ? d.id_verifications[0] : d.id_verification;
    const verifiedFullName =
      idv?.full_name ||
      [idv?.first_name, idv?.last_name].filter(Boolean).join(" ") ||
      undefined;

    let declineReason: string | undefined = d.decline_reason || undefined;
    if (!declineReason && rawStatus === "Declined") {
      const warnings = [
        ...(idv?.warnings || []),
        ...((Array.isArray(d.liveness_checks) && d.liveness_checks[0]?.warnings) || []),
        ...((Array.isArray(d.face_matches) && d.face_matches[0]?.warnings) || []),
      ];
      declineReason =
        warnings
          .map((w: { short_description?: string; description?: string; risk?: string }) =>
            w.short_description || w.description || w.risk
          )
          .filter(Boolean)
          .join(", ") || undefined;
    }

    return {
      sessionId: d.session_id || sessionId,
      userId: d.vendor_data || "",
      rawStatus,
      status: normalizeDiditStatus(rawStatus),
      verifiedFullName,
      givenNames: idv?.first_name || undefined,
      lastNames: idv?.last_name || undefined,
      documentCountry: idv?.issuing_state || idv?.issuing_country || idv?.country || undefined,
      documentNumber: idv?.document_number || idv?.personal_number || undefined,
      declineReason,
    };
  }
}

export const diditProvider = new DiditProvider();
