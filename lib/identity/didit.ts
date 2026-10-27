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
   * Verifica la firma HMAC-SHA256 en tiempo constante usando el encabezado X-Signature-V2.
   */
  verificarFirma(
    cuerpoCrudo: string,
    cabeceras: Record<string, string | string[] | undefined> | Headers
  ): boolean {
    const secret = getWebhookSecret();
    const signature =
      getHeaderValue(cabeceras, "x-signature-v2") ||
      getHeaderValue(cabeceras, "X-Signature-V2") ||
      getHeaderValue(cabeceras, "x-signature");

    const previousSignature =
      getHeaderValue(cabeceras, "x-signature-v2-previous") ||
      getHeaderValue(cabeceras, "X-Signature-V2-Previous");

    const timestampStr =
      getHeaderValue(cabeceras, "x-timestamp") || getHeaderValue(cabeceras, "X-Timestamp");

    if (!signature) {
      return false;
    }

    // Replay protection: verificar ventana de 5 minutos si viene timestamp
    if (timestampStr) {
      const ts = parseInt(timestampStr, 10);
      if (!isNaN(ts)) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - ts) > 300) {
          console.warn("[DiditProvider] Webhook timestamp fuera de ventana tolerada:", ts, nowSec);
          return false;
        }
      }
    }

    // Calcular firma computada
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(cuerpoCrudo)
      .digest("hex");

    const checkSig = (targetSig: string): boolean => {
      try {
        const bufComputed = Buffer.from(computedSignature, "hex");
        const bufTarget = Buffer.from(targetSig, "hex");
        if (bufComputed.length !== bufTarget.length) {
          return false;
        }
        return crypto.timingSafeEqual(bufComputed, bufTarget);
      } catch {
        return false;
      }
    };

    if (checkSig(signature)) {
      return true;
    }

    if (previousSignature && checkSig(previousSignature)) {
      return true;
    }

    return false;
  }

  /**
   * Lee el evento del webhook y recupera los datos de decisión si están listos.
   */
  async leerEvento(cuerpoCrudo: string): Promise<ParsedVerificationEvent> {
    const payload = JSON.parse(cuerpoCrudo);
    const eventId = payload.event_id;
    const sessionId = payload.session_id || payload.id;
    const rawStatus = payload.status || "In Progress";
    let normalizedStatus = normalizeDiditStatus(rawStatus);
    const userId = payload.vendor_data || "";

    let verifiedFullName: string | undefined = undefined;
    let documentCountry: string | undefined = undefined;
    let documentNumber: string | undefined = undefined;
    let declineReason: string | undefined = undefined;

    // Si viene la decisión o es un estado resolutivo, consultar /decision/
    const apiKey = getApiKey();
    try {
      const decisionRes = await fetch(
        `https://verification.didit.me/v3/session/${sessionId}/decision/`,
        {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
        }
      );

      if (decisionRes.ok) {
        const decisionData = await decisionRes.json();
        const decisionStatus = decisionData.status || rawStatus;
        normalizedStatus = normalizeDiditStatus(decisionStatus);

        const idVerification = Array.isArray(decisionData.id_verifications)
          ? decisionData.id_verifications[0]
          : undefined;

        if (idVerification) {
          verifiedFullName =
            idVerification.full_name ||
            [idVerification.first_name, idVerification.last_name].filter(Boolean).join(" ") ||
            undefined;
          documentCountry = idVerification.issuing_country || idVerification.country || undefined;
          documentNumber = idVerification.document_number || undefined;
          if (idVerification.status === "Declined" && Array.isArray(idVerification.warnings)) {
            declineReason = idVerification.warnings.map((w: any) => w.message || w.feature).join(", ");
          }
        }

        if (decisionData.decline_reason) {
          declineReason = decisionData.decline_reason;
        }
      }
    } catch (err) {
      console.warn("[DiditProvider] No se pudo obtener la decisión extendida:", err);
    }

    return {
      eventId,
      sessionId,
      userId,
      status: normalizedStatus,
      verifiedFullName,
      documentCountry,
      documentNumber,
      declineReason,
    };
  }
}

export const diditProvider = new DiditProvider();
