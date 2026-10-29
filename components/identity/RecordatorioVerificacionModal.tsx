"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { Glass } from "@/components/ui/Glass";
import { IconoCheckCirculo, IconoCerrar } from "@/components/iconos";
import { createClient } from "@/lib/supabase/client";
import { avisarNavegacion } from "@/components/layout/BarraNavegacion";

const STORAGE_KEY = "puente:verificacion-recordatorio-visto";

export function RecordatorioVerificacionModal() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setIsOpen(false);
      setCheckingStatus(false);
      return;
    }

    // Rutas exentas
    const isExempt =
      pathname.startsWith("/bienvenida") ||
      pathname.startsWith("/verificacion") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/terminos") ||
      pathname.startsWith("/privacidad");

    if (isExempt) {
      setIsOpen(false);
      setCheckingStatus(false);
      return;
    }

    // Ya verificado a nivel de perfil
    if ((profile as any)?.identity_verified) {
      setIsOpen(false);
      setCheckingStatus(false);
      return;
    }

    // Comprobar si ya fue visto en esta sesión
    try {
      const visto = sessionStorage.getItem(STORAGE_KEY);
      if (visto) {
        setIsOpen(false);
        setCheckingStatus(false);
        return;
      }
    } catch {
      // Si sessionStorage falla, continuar
    }

    // Comprobar si tiene verificación en curso (pendiente o en_revision)
    const checkVerificationState = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("identity_verifications")
          .select("status, expires_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          if (data.status === "pendiente" || data.status === "en_revision") {
            setIsOpen(false);
            setCheckingStatus(false);
            return;
          }
          if (data.status === "aprobada") {
            const isExpired = data.expires_at && new Date(data.expires_at) <= new Date();
            if (!isExpired) {
              setIsOpen(false);
              setCheckingStatus(false);
              return;
            }
          }
        }

        // Si no está verificada ni en curso, mostrar aviso una vez por sesión
        setIsOpen(true);
      } catch (err) {
        console.error("Error comprobando estado de verificación para recordatorio:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkVerificationState();
  }, [user, profile, loading, pathname]);

  const cerrarAviso = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignorar
    }
    setIsOpen(false);
  };

  const irAVerificacion = () => {
    cerrarAviso();
    avisarNavegacion();
    router.push("/verificacion");
  };

  // Manejo de tecla Escape y foco
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cerrarAviso();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    primaryButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || checkingStatus) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verif-modal-title"
    >
      <div ref={modalRef} className="w-full max-w-md">
        <Glass
          variant="panel"
          className="relative p-6 md:p-8 rounded-3xl border border-[var(--line)] shadow-2xl space-y-5"
        >
          {/* Botón cerrar X */}
          <button
            onClick={cerrarAviso}
            className="absolute top-4 right-4 p-2 rounded-full text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-all"
            aria-label="Cerrar aviso"
          >
            <IconoCerrar size={18} />
          </button>

          {/* Icono e encabezado */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconoCheckCirculo size={24} />
            </div>
            <div>
              <h2
                id="verif-modal-title"
                className="text-lg font-bold tracking-tight text-[var(--ink)]"
              >
                Verifica tu identidad
              </h2>
              <span className="text-xs text-[var(--ink-3)]">Seguridad y confianza en Puente</span>
            </div>
          </div>

          {/* Texto explicativo */}
          <p className="text-sm leading-relaxed text-[var(--ink-2)]">
            Toma unos 2 minutos: una foto de tu documento y un video corto de tu cara. Lo necesitas
            para publicar causas y da confianza a quienes te apoyan.
          </p>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              ref={primaryButtonRef}
              onClick={irAVerificacion}
              className="flex-1 py-3 px-5 rounded-2xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all text-center"
            >
              Verificar ahora
            </button>
            <button
              onClick={cerrarAviso}
              className="py-3 px-5 rounded-2xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink-2)] hover:text-[var(--ink)] text-sm font-medium transition-all text-center"
            >
              Ahora no
            </button>
          </div>
        </Glass>
      </div>
    </div>
  );
}
