"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import {
  IconoEscudo,
  IconoCheckCirculo,
  IconoAlerta,
  IconoCargando,
  IconoFlechaDerecha,
} from "@/components/iconos";
import { iniciarVerificacionAction } from "@/lib/actions/identity";

interface VerificationData {
  id: string;
  status: "pendiente" | "aprobada" | "rechazada" | "en_revision" | "vencida";
  verified_at: string | null;
  expires_at: string | null;
  decline_reason: string | null;
  created_at: string;
}

interface VerificacionClientProps {
  userId: string;
  initialVerification: VerificationData | null;
  isProfileVerified: boolean;
  verifiedAt: string | null;
  userName: string;
  nextUrl: string;
}

export function VerificacionClient({
  userId,
  initialVerification,
  isProfileVerified,
  verifiedAt,
  userName,
  nextUrl,
}: VerificacionClientProps) {
  const router = useRouter();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);

  const status = initialVerification?.status;
  const isExpired =
    initialVerification?.expires_at &&
    new Date(initialVerification.expires_at) <= new Date();

  const handleStartVerification = async () => {
    if (!consentAccepted && status !== "rechazada" && !isExpired) {
      setErrorMsg("Debes aceptar el consentimiento de tratamiento de datos para continuar.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await iniciarVerificacionAction();
      if (!res.success) {
        setErrorMsg(res.error || "No se pudo iniciar la verificación.");
        setLoading(false);
        return;
      }

      if (res.alreadyVerified) {
        router.refresh();
        setLoading(false);
        return;
      }

      if (res.url) {
        setSessionUrl(res.url);

        // Intentar abrir el modal con el SDK web de Didit
        try {
          const { DiditSdk } = await import("@didit-protocol/sdk-web");
          if (DiditSdk?.shared) {
            DiditSdk.shared.onComplete = () => {
              window.location.href = `/verificacion/resultado?next=${encodeURIComponent(nextUrl)}`;
            };

            DiditSdk.shared.startVerification({
              url: res.url,
            });
            setLoading(false);
            return;
          }
        } catch (sdkErr) {
          console.warn("No se pudo iniciar el modal de Didit, redirigiendo a la URL directa:", sdkErr);
        }

        // Fallback: redirigir a la URL de Didit directamente
        window.location.href = res.url;
      }
    } catch (err: any) {
      console.error("Error al iniciar verificación:", err);
      setErrorMsg(err.message || "Ocurrió un error inesperado al conectar con el servicio.");
      setLoading(false);
    }
  };

  // 1. Estado: Aprobada y vigente
  if ((isProfileVerified || status === "aprobada") && !isExpired) {
    const expDate = initialVerification?.expires_at
      ? new Date(initialVerification.expires_at).toLocaleDateString("es-ES", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    return (
      <Glass className="p-6 md:p-10 rounded-3xl border border-[var(--line)] shadow-xl space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
          <IconoCheckCirculo size={36} />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Identidad verificada
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Tu cuenta está verificada
          </h1>
          <p className="text-sm text-[var(--ink-2)] max-w-md mx-auto">
            Puedes publicar y administrar tus causas sin restricciones. Tu identidad brinda confianza y transparencia a toda la comunidad.
          </p>
          {expDate && (
            <p className="text-xs text-[var(--ink-3)] pt-2">
              Verificación vigente hasta el {expDate}.
            </p>
          )}
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={nextUrl || "/perfil"}
            className="py-3 px-6 rounded-2xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
          >
            <span>Continuar</span>
            <IconoFlechaDerecha size={16} />
          </Link>
          <Link
            href="/perfil"
            className="py-3 px-6 rounded-2xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--line)] transition-all"
          >
            Ir a mi perfil
          </Link>
        </div>
      </Glass>
    );
  }

  // 2. Estado: En revisión manual
  if (status === "en_revision") {
    return (
      <Glass className="p-6 md:p-10 rounded-3xl border border-[var(--line)] shadow-xl space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
          <IconoAlerta size={36} />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
            En revisión
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Tu verificación está en revisión
          </h1>
          <p className="text-sm text-[var(--ink-2)] max-w-md mx-auto">
            Hemos recibido tus datos y nuestro equipo está confirmando tu documentación. Te avisaremos en cuanto esté lista.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/perfil"
            className="py-3 px-6 rounded-2xl bg-[var(--hover)] border border-[var(--line)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--line)] transition-all inline-block"
          >
            Volver a mi perfil
          </Link>
        </div>
      </Glass>
    );
  }

  // 3. Formulario principal para iniciar o reintentar
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-3xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center mb-4">
          <IconoEscudo size={30} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--ink)]">
          {status === "rechazada"
            ? "Reintentar verificación de identidad"
            : isExpired
            ? "Renovar verificación de identidad"
            : "Verifica tu identidad"}
        </h1>
        <p className="text-sm text-[var(--ink-2)] max-w-lg mx-auto">
          Para publicar causas en Puente y garantizar la seguridad de los donantes, validamos que cada persona sea real y que el titular de la cuenta receptora coincida con su documento.
        </p>
      </div>

      {/* Alerta de rechazo si aplica */}
      {status === "rechazada" && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-3 text-sm">
          <IconoAlerta size={20} className="flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">La verificación anterior no fue aprobada</p>
            <p className="text-xs opacity-90">
              {initialVerification?.decline_reason ||
                "No pudimos comprobar la autenticidad de tu documento o coincidencia facial. Por favor asegúrate de que el documento esté bien iluminado y sea legible."}
            </p>
          </div>
        </div>
      )}

      {/* Tarjeta de pasos y requerimientos */}
      <Glass className="p-6 md:p-8 rounded-3xl border border-[var(--line)] shadow-lg space-y-6">
        <div className="space-y-4">
          <h2 className="text-base font-bold text-[var(--ink)]">¿Qué necesitas? (Toma unos 2 minutos)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-2xl bg-[var(--hover)] border border-[var(--line)] space-y-1.5">
              <span className="text-xs font-mono font-semibold text-[var(--accent)]">Paso 1</span>
              <p className="text-sm font-semibold text-[var(--ink)]">Foto de tu documento oficial</p>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Cédula de ciudadanía, DNI o pasaporte vigente, por ambas caras.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--hover)] border border-[var(--line)] space-y-1.5">
              <span className="text-xs font-mono font-semibold text-[var(--accent)]">Paso 2</span>
              <p className="text-sm font-semibold text-[var(--ink)]">Video corto de tu cara</p>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Prueba de vida rápida y coincidencia facial 1:1 con la foto de tu documento.
              </p>
            </div>
          </div>
        </div>

        {/* Garantías de privacidad */}
        <div className="p-4 rounded-2xl bg-[var(--field)] border border-[var(--line)] space-y-2 text-xs text-[var(--ink-2)]">
          <p className="font-semibold text-[var(--ink)]">Privacidad y confidencialidad garantizada</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Puente <strong>nunca guarda fotos de tus documentos ni selfies</strong> en sus servidores.</li>
            <li>Tu número de documento se cifra mediante un hash unidireccional y tu nombre verificado se mantiene estrictamente privado.</li>
            <li>Los donantes solo verán la insignia de verificación y la confirmación de coincidencia de titularidad.</li>
          </ul>
        </div>

        {/* Consentimiento obligatorio */}
        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-xs text-[var(--ink-2)] leading-relaxed">
              Autorizo de forma expresa el tratamiento de mis datos de identificación y biométricos a través de la plataforma <strong>Didit</strong> (procesados de manera segura en España, Unión Europea conforme al RGPD) exclusivamente para la verificación de mi identidad en Puente, de acuerdo con la{" "}
              <Link href="/privacidad" target="_blank" className="text-[var(--accent)] underline hover:opacity-80">
                Política de Privacidad
              </Link>.
            </span>
          </label>
        </div>

        {/* Mensaje de error si hubo */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <IconoAlerta size={16} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Botón de acción */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleStartVerification}
            disabled={loading || (!consentAccepted && status !== "rechazada" && !isExpired)}
            className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <IconoCargando size={18} className="animate-spin" />
                <span>Iniciando verificación segura...</span>
              </>
            ) : (
              <>
                <span>
                  {status === "rechazada"
                    ? "Comenzar nuevo intento"
                    : isExpired
                    ? "Renovar verificación"
                    : "Verificar mi identidad"}
                </span>
                <IconoFlechaDerecha size={16} />
              </>
            )}
          </button>

          {sessionUrl && (
            <p className="text-center text-xs text-[var(--ink-3)]">
              ¿No se abrió la ventana emergente?{" "}
              <a
                href={sessionUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent)] underline font-medium"
              >
                Haz clic aquí para abrir Didit directamente
              </a>
            </p>
          )}
        </div>
      </Glass>
    </div>
  );
}
