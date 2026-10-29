export type VerificationNormalizedStatus =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "en_revision"
  | "vencida";

export interface CreateSessionParams {
  userId: string;
  callbackUrl?: string;
}

export interface CreateSessionResult {
  url: string;
  sessionId: string;
}

export interface ParsedVerificationEvent {
  eventId?: string;
  sessionId: string;
  /** Estado tal como lo escribe Didit ("Approved", "Declined", "In Review"…). */
  rawStatus: string;
  userId: string;
  status: VerificationNormalizedStatus;
  verifiedFullName?: string;
  /** Nombres y apellidos por separado, tal como los lee Didit del documento. */
  givenNames?: string;
  lastNames?: string;
  documentCountry?: string;
  documentNumber?: string;
  declineReason?: string;
}

export interface IdentityProvider {
  crearSesion(params: CreateSessionParams): Promise<CreateSessionResult>;
  verificarFirma(
    cuerpoCrudo: string,
    cabeceras: Record<string, string | string[] | undefined> | Headers
  ): Record<string, unknown> | null;
  obtenerDecision(sessionId: string): Promise<ParsedVerificationEvent>;
}
