"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import { createClient } from "@/lib/supabase/client";
import {
  copyGoogleAvatarToStorage,
  setOnboardingCompletedCookie,
  clearOnboardingCookie,
} from "@/lib/actions/auth";
import { IconoCheckCirculo, IconoAlerta } from "@/components/iconos";
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from "libphonenumber-js";

const COUNTRIES = [
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

function cleanUsernameSuggestion(fullName: string): string {
  if (!fullName) return "usuario";
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "usuario";
  }
  const candidate = `${parts[0]}_${parts[1]}`.replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return candidate.length >= 3 ? candidate : "usuario";
}

function BienvenidaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"checking" | "available" | "taken" | "invalid" | null>(null);
  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.replace(`/entrar?next=${encodeURIComponent(next)}`);
        return;
      }

      setUser(currentUser);

      // Si ya completó el onboarding, redirigir
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at, full_name, username")
        .eq("id", currentUser.id)
        .single();

      if (profile?.onboarding_completed_at) {
        await setOnboardingCompletedCookie();
        router.replace(next);
        return;
      }

      const meta = currentUser.user_metadata || {};
      const initialName = meta.full_name || meta.name || profile?.full_name || "";
      setFullName(initialName);

      // Sugerir nombre de usuario disponible
      let baseUser = cleanUsernameSuggestion(initialName);
      let candidate = baseUser;
      let found = false;

      for (let i = 0; i < 5; i++) {
        const { data: isAvail } = await supabase.rpc("username_available", {
          p_username: candidate,
        });
        if (isAvail) {
          found = true;
          break;
        }
        candidate = `${baseUser}_${Math.floor(10 + Math.random() * 90)}`;
      }

      setUsername(candidate);
      setUsernameStatus(found ? "available" : "checking");
      setLoading(false);
    }

    loadUser();
  }, [router, next]);

  // Comprobación en vivo del nombre de usuario (400 ms)
  const checkUsername = (val: string) => {
    const trimmed = val.toLowerCase().trim();
    if (!trimmed) {
      setUsernameStatus(null);
      return;
    }
    const validRegex = /^[a-z0-9_]{3,24}$/;
    if (!validRegex.test(trimmed)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data: isAvail } = await supabase.rpc("username_available", {
        p_username: trimmed,
      });
      setUsernameStatus(isAvail ? "available" : "taken");
    }, 400);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearOnboardingCookie();
    router.replace("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg("Escribe tu nombre completo (mínimo 2 caracteres).");
      return;
    }

    if (usernameStatus === "invalid" || !/^[a-z0-9_]{3,24}$/.test(username.toLowerCase().trim())) {
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
      const supabase = createClient();
      const { error } = await supabase.rpc("complete_onboarding", {
        p_full_name: fullName.trim(),
        p_username: username.toLowerCase().trim(),
        p_phone: formattedPhone || "",
        p_terms_version: "v1.0",
      });

      if (error) {
        if (error.message.includes("USUARIO_EN_USO")) {
          setErrorMsg("Ese usuario ya lo tomó otra persona. Prueba con otro.");
        } else if (error.message.includes("USUARIO_INVALIDO")) {
          setErrorMsg("Solo minúsculas, números y _, entre 3 y 24 caracteres.");
        } else if (error.message.includes("REG_TELEFONO")) {
          setErrorMsg("Revisa el número, parece incompleto.");
        } else if (error.message.includes("REG_TERMINOS")) {
          setErrorMsg("Acepta los términos para continuar.");
        } else {
          setErrorMsg("No pudimos completar tu registro. Intenta de nuevo.");
        }
        setSubmitting(false);
        return;
      }

      // Copiar foto de Google a bucket propio en segundo plano (Sección 7)
      const googlePhoto =
        user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
      if (googlePhoto) {
        copyGoogleAvatarToStorage(googlePhoto).catch(() => {});
      }

      // Marcar cookie de bienvenida completada (Sección 1.5)
      await setOnboardingCompletedCookie();

      router.replace(next);
    } catch (err: any) {
      console.error("Error completing onboarding:", err);
      setErrorMsg("Ocurrió un error inesperado. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center text-sm text-[var(--ink-2)]">
        Preparando tu bienvenida...
      </div>
    );
  }

  const firstName = fullName.split(/\s+/)[0] || "amigo";
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-4 py-20 sm:py-24">
      <Glass
        variant="panel"
        className="w-full max-w-[460px] shadow-2xl p-7 sm:p-9 border border-[var(--line)] rounded-3xl"
      >
        {/* Cabecera */}
        <div className="text-center mb-8 flex flex-col items-center">
          {avatarUrl ? (
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--line)] mb-4 bg-[var(--avatar)] shadow-md">
              <img
                src={avatarUrl}
                alt={firstName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--accent)] text-white font-bold text-xl mb-4 shadow-md">
              {firstName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            Hola, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ink-2)] font-medium">
            Un último paso y listo.
          </p>
        </div>

        {/* Alerta de error */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-500 border border-red-500/20 animate-fade-in">
            <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Nombre Completo */}
          <div>
            <label
              htmlFor="full_name"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
            >
              Nombre completo
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              placeholder="Tu nombre y apellido"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Así te verán quienes apoyen tu causa.
            </p>
          </div>

          {/* 2. Nombre de Usuario */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Nombre de usuario
              </label>
              {usernameStatus === "checking" && (
                <span className="text-[11px] text-[var(--ink-3)] animate-pulse font-mono">
                  Comprobando...
                </span>
              )}
              {usernameStatus === "available" && (
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <IconoCheckCirculo size={12} />
                  Disponible
                </span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-[11px] text-rose-500 font-medium">
                  Ya está en uso
                </span>
              )}
              {usernameStatus === "invalid" && (
                <span className="text-[11px] text-amber-500 font-medium">
                  Solo minúsculas, números y _
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
                value={username}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/\s+/g, "_");
                  setUsername(val);
                  checkUsername(val);
                }}
                required
                minLength={3}
                maxLength={24}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 pl-8 pr-3.5 text-sm font-mono text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Tu identificador único en Puente: puente.org/u/{username || "tu_usuario"}
            </p>
          </div>

          {/* 3. Número de contacto (opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="phone_number"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Número de contacto <span className="font-normal lowercase text-[var(--ink-3)]">(opcional)</span>
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--track)] text-[var(--ink-3)]">
                Privado
              </span>
            </div>

            <div className="flex gap-2">
              <select
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                className="w-[110px] flex-shrink-0 rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-2 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-colors cursor-pointer"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.dial} ({c.code})
                  </option>
                ))}
              </select>

              <input
                id="phone_number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Número de celular"
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Privado. Lo necesitarás si publicas una causa.
            </p>
          </div>

          {/* 4. Términos y privacidad */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                className="w-4 h-4 mt-0.5 rounded text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--line)] bg-[var(--field)] cursor-pointer"
              />
              <span className="text-xs text-[var(--ink-2)] leading-relaxed">
                Acepto los{" "}
                <Link
                  href="/terminos"
                  target="_blank"
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  Términos
                </Link>{" "}
                y autorizo el tratamiento de mis datos según la{" "}
                <Link
                  href="/privacidad"
                  target="_blank"
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  Política de privacidad
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Botón de acción */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting || !acceptTerms}
              className="w-full py-3.5 px-4 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-sm font-semibold tracking-wide shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? "Guardando datos..." : "Listo, entrar"}
            </button>
          </div>

          {/* Enlace pequeño Salir */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-[var(--ink-3)] hover:text-rose-500 transition-colors underline cursor-pointer"
            >
              Salir
            </button>
          </div>
        </form>
      </Glass>
    </div>
  );
}

export default function BienvenidaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--ink-2)]">
          Cargando...
        </div>
      }
    >
      <BienvenidaContent />
    </Suspense>
  );
}
