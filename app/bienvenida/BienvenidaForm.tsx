"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import {
  IconoCargando,
  IconoAlerta,
  IconoCheckCirculo,
} from "@/components/iconos";
import { parsePhoneNumber, CountryCode } from "libphonenumber-js";
import { completeOnboardingAction, checkUsernameAction } from "./actions";

interface BienvenidaFormProps {
  userId: string;
  userEmail: string;
  initialName: string;
  suggestedUsername: string;
  avatarUrl: string | null;
  next: string;
}

const PHONE_COUNTRIES = [
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "MX", name: "México", dial: "+52" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "PE", name: "Perú", dial: "+51" },
  { code: "ES", name: "España", dial: "+34" },
  { code: "US", name: "Estados Unidos", dial: "+1" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "DO", name: "Rep. Dominicana", dial: "+1" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "PA", name: "Panamá", dial: "+507" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "PY", name: "Paraguay", dial: "+595" },
];

export function BienvenidaForm({
  userEmail,
  initialName,
  suggestedUsername,
  avatarUrl,
  next,
}: BienvenidaFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [username, setUsername] = useState(suggestedUsername);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkDebounceRef = useRef<any>(null);

  // Comprobación en vivo del nombre de usuario mediante Server Action (300 ms debounce)
  useEffect(() => {
    const cleanUser = username.trim().toLowerCase();
    clearTimeout(checkDebounceRef.current);

    if (!cleanUser) {
      setUsernameStatus("idle");
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUser)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    checkDebounceRef.current = setTimeout(async () => {
      try {
        // Ejecutar Server Action con tiempo límite de seguridad de 2s
        const checkPromise = checkUsernameAction(cleanUser);
        const timeoutPromise = new Promise<{ available: boolean }>((resolve) =>
          setTimeout(() => resolve({ available: true }), 2000)
        );

        const res = await Promise.race([checkPromise, timeoutPromise]);
        if (res.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 300);

    return () => clearTimeout(checkDebounceRef.current);
  }, [username]);

  const handleSignOut = () => {
    window.location.href = "/auth/signout";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg("Escribe tu nombre completo (mínimo 2 caracteres).");
      return;
    }

    const cleanUser = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUser)) {
      setErrorMsg("Solo minúsculas, números y _, entre 3 y 24 caracteres.");
      return;
    }

    if (usernameStatus === "taken") {
      setErrorMsg("Ese usuario ya lo tomó otra persona. Prueba con otro.");
      return;
    }

    let formattedPhone: string | null = null;
    if (phoneNumber.trim()) {
      try {
        const parsed = parsePhoneNumber(phoneNumber, phoneCountry as CountryCode);
        if (!parsed || !parsed.isValid()) {
          setErrorMsg("Revisa el número, parece incompleto.");
          return;
        }
        formattedPhone = parsed.format("E.164");
      } catch {
        setErrorMsg("Revisa el número, parece incompleto.");
        return;
      }
    }

    if (!acceptTerms) {
      setErrorMsg("Acepta los términos para continuar.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await completeOnboardingAction({
        fullName: fullName.trim(),
        username: cleanUser,
        phoneNumber: formattedPhone,
        termsVersion: "v1.0",
        acceptTerms,
        next,
      });

      if (!res.success) {
        setErrorMsg(res.error || "No pudimos completar tu registro.");
        setSubmitting(false);
        if (res.redirect) {
          window.location.href = res.redirect;
        }
        return;
      }

      window.location.href = res.redirect || "/";
    } catch (err: any) {
      console.error("Error submitting onboarding:", err);
      setErrorMsg("Ocurrió un error inesperado al guardar. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  const firstName = fullName.split(" ")[0] || "bienvenido";
  const initials = (fullName || userEmail || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "U";

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-4 py-16 sm:py-24">
      <Glass
        variant="panel"
        className="w-full max-w-[460px] shadow-2xl p-7 sm:p-9 border border-[var(--line)] rounded-3xl"
      >
        {/* Cabecera (Sección 1.4) */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3.5">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/15 border-2 border-[var(--glass-edge)] overflow-hidden shadow-md">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-[var(--accent)] font-mono">
                  {initials}
                </span>
              )}
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Hola, {firstName}
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-2)]">
            Un último paso y listo.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-3.5 text-xs text-red-500 border border-red-500/20">
            <IconoAlerta size={16} className="flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre completo */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
            >
              Nombre completo *
            </label>
            <input
              id="fullName"
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Ana Pérez"
              disabled={submitting}
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Así te verán quienes apoyen tu causa.
            </p>
          </div>

          {/* Nombre de usuario (Sección 1.4: sugerido, con comprobación en vivo) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Nombre de usuario *
              </label>
              {usernameStatus === "checking" && (
                <span className="text-[11px] text-[var(--ink-3)] font-mono flex items-center gap-1">
                  <IconoCargando size={11} className="animate-spin" />
                  Comprobando...
                </span>
              )}
              {usernameStatus === "available" && (
                <span className="text-[11px] text-emerald-500 font-semibold font-mono flex items-center gap-1">
                  <IconoCheckCirculo size={12} />
                  Disponible
                </span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-[11px] text-red-500 font-semibold font-mono">
                  Ya está en uso
                </span>
              )}
              {usernameStatus === "invalid" && (
                <span className="text-[11px] text-amber-500 font-mono">
                  3 a 24 caract., a-z, 0-9, _
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[var(--ink-3)]">
                @
              </span>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                placeholder="usuario"
                disabled={submitting}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--field)] py-2.5 pl-8 pr-3 text-sm font-mono text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Solo minúsculas, números y _, entre 3 y 24 caracteres.
            </p>
          </div>

          {/* Número de contacto (opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="phoneNumber"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Número de contacto <span className="text-[var(--ink-3)]">(opcional)</span>
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--hover)] text-[var(--ink-3)]">
                Privado
              </span>
            </div>
            <div className="flex gap-2">
              <select
                aria-label="Código de país"
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                disabled={submitting}
                className="w-[125px] flex-shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-all"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.dial} ({c.code})
                  </option>
                ))}
              </select>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="300 123 4567"
                disabled={submitting}
                className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Privado. Lo necesitarás si publicas una causa.
            </p>
          </div>

          {/* Términos y privacidad */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={submitting}
                className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-xs text-[var(--ink-2)] leading-relaxed">
                Acepto los{" "}
                <Link
                  href="/terminos"
                  target="_blank"
                  className="text-[var(--accent-ink)] font-semibold hover:underline"
                >
                  Términos
                </Link>{" "}
                y autorizo el tratamiento de mis datos según la{" "}
                <Link
                  href="/privacidad"
                  target="_blank"
                  className="text-[var(--accent-ink)] font-semibold hover:underline"
                >
                  Política de privacidad
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Botón de envío */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={
                submitting ||
                !acceptTerms ||
                usernameStatus === "taken" ||
                usernameStatus === "invalid" ||
                username.trim().length < 3
              }
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {submitting ? (
                 <>
                   <IconoCargando size={16} className="animate-spin" />
                   <span>Guardando...</span>
                 </>
               ) : (
                 <span>Listo, entrar</span>
               )}
            </button>
          </div>

          {/* Salida pequeña (Sección 1.4) */}
          <div className="text-center pt-2">
            <a
              href="/auth/signout"
              className="inline-block text-xs text-[var(--ink-3)] hover:text-red-400 transition-colors cursor-pointer py-1"
            >
              Salir (cerrar sesión)
            </a>
          </div>
        </form>
      </Glass>
    </div>
  );
}
