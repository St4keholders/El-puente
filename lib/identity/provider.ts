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
  userId: string;
  status: VerificationNormalizedStatus;
  verifiedFullName?: string;
  documentCountry?: string;
  documentNumber?: string;
  declineReason?: string;
}

export interface IdentityProvider {
  crearSesion(params: CreateSessionParams): Promise<CreateSessionResult>;
  verificarFirma(
    cuerpoCrudo: string,
    cabeceras: Record<string, string | string[] | undefined> | Headers
  ): boolean;
  leerEvento(cuerpoCrudo: string): Promise<ParsedVerificationEvent>;
}
