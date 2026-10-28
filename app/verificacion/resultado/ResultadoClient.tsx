"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import {
  IconoCheckCirculo,
  IconoAlerta,
  IconoCargando,
  IconoFlechaDerecha,
} from "@/components/iconos";
import { consultarEstadoVerificacionAction } from "@/lib/actions/identity";

interface ResultadoClientProps {
  nextUrl: string;
}

type ResultStatus = "cargando" | "aprobada" | "rechazada" | "en_revision" | "demorado";

export function ResultadoClient({ nextUrl }: ResultadoClientProps) {
  const [status, setStatus] = useState<ResultStatus>("cargando");
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const res = await consultarEstadoVerificacionAction();
        if (isCancelled) return;

        if (res.success) {
          if (res.profileVerified || res.verification?.status === "aprobada") {
            setStatus("aprobada");
            return;
          }

          if (res.verification?.status === "rechazada") {
            setStatus("rechazada");
            setDeclineReason(res.verification.decline_reason);
            return;
          }

          if (res.verification?.status === "en_revision") {
            setStatus("en_revision");
            return;
          }
        }

        // Si aún está pendiente o cargando y no hemos llegado a 10 intentos
        setAttempts((prev) => {
          const nextAttempt = prev + 1;
          if (nextAttempt >= 10) {
            setStatus("demorado");
          } else {
            timer = setTimeout(checkStatus, 2500);
          }
          return nextAttempt;
        });
      } catch (err) {
        console.error("Error al consultar estado de verificación:", err);
        setAttempts((prev) => {
          if (prev >= 10) {
            setStatus("demorado");
          } else {
            timer = setTimeout(checkStatus, 3000);
          }
          return prev + 1;
        });
      }
    };

    checkStatus();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (status === "cargando") {
    return (
      <Glass className="p-8 md:p-12 rounded-3xl border border-[var(--line)] shadow-xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
          <IconoCargando size={32} className="animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--ink)]">
            Estamos confirmando tu verificación
          </h1>
          <p className="text-sm text-[var(--ink-2)] max-w-sm mx-auto">
            Recibiendo la confirmación segura de Didit. Esto toma solo unos segundos...
          </p>
        </div>
      </Glass>
    );
  }

  if (status === "aprobada") {
    return (
      <Glass className="p-8 md:p-12 rounded-3xl border border-[var(--line)] shadow-xl text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
          <IconoCheckCirculo size={36} />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            ¡Completado con éxito!
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Tu identidad ha sido verificada
          </h1>
          <p className="text-sm text-[var(--ink-2)] max-w-sm mx-auto">
            Hemos comprobado tu documentación oficial y prueba biométrica. Tu cuenta ya cuenta con la insignia de confianza de Puente.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href={nextUrl}
            className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
          >
            <span>Continuar</span>
            <IconoFlechaDerecha size={16} />
          </Link>
        </div>
      </Glass>
    );
  }

  if (status === "rechazada") {
    return (
      <Glass className="p-8 md:p-12 rounded-3xl border border-[var(--line)] shadow-xl text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-red-500/15 text-red-500 flex items-center justify-center">
          <IconoAlerta size={36} />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400">
            Verificación no aprobada
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            No se pudo validar tu identidad
          </h1>
          <p className="text-sm text-[var(--ink-2)] max-w-sm mx-auto">
            {declineReason ||
              "Los datos del documento o la prueba biométrica no pudieron ser confirmados. Puedes intentarlo nuevamente asegurándote de contar con buena iluminación."}
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/verificacion"
            className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
          >
            <span>Intentar de nuevo</span>
            <IconoFlechaDerecha size={16} />
          </Link>
          <Link
            href="/perfil"
            className="w-full py-3 px-6 rounded-2xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] hover:text-[var(--ink)] text-sm font-medium transition-all"
          >
            Ir a mi perfil
          </Link>
        </div>
      </Glass>
    );
  }

  if (status === "en_revision") {
    return (
      <Glass className="p-8 md:p-12 rounded-3xl border border-[var(--line)] shadow-xl text-center space-y-6 animate-fade-in">
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
          <p className="text-sm text-[var(--ink-2)] max-w-sm mx-auto">
            Tu documentación ha sido recibida y nuestro equipo la revisará de forma personalizada. Te notificaremos en cuanto el proceso concluya.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/perfil"
            className="w-full py-3.5 px-6 rounded-2xl bg-[var(--hover)] border border-[var(--line)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--line)] transition-all inline-block"
          >
            Ir a mi perfil
          </Link>
        </div>
      </Glass>
    );
  }

  // status === "demorado"
  return (
    <Glass className="p-8 md:p-12 rounded-3xl border border-[var(--line)] shadow-xl text-center space-y-6 animate-fade-in">
      <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
        <IconoCheckCirculo size={36} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Procesando verificación
        </h1>
        <p className="text-sm text-[var(--ink-2)] max-w-sm mx-auto">
          El proceso está tardando unos minutos adicionales en completarse. Puedes continuar navegando; tu cuenta se actualizará automáticamente en cuanto se reciba el resultado final.
        </p>
      </div>
      <div className="pt-2 flex flex-col gap-2.5">
        <Link
          href={nextUrl}
          className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
        >
          <span>Continuar</span>
          <IconoFlechaDerecha size={16} />
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-3 px-6 rounded-2xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] hover:text-[var(--ink)] text-sm font-medium transition-all"
        >
          Volver a comprobar
        </button>
        <Link
          href="/perfil"
          className="w-full py-3 px-6 rounded-2xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] hover:text-[var(--ink)] text-sm font-medium transition-all"
        >
          Ir a mi perfil
        </Link>
      </div>
    </Glass>
  );
}
