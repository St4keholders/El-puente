"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import { IconoCargando, IconoAlerta } from "@/components/iconos";
import { parsePhoneNumber, CountryCode } from "libphonenumber-js";
import { getAllCountries } from "@/lib/geo/countries";
import { completeOnboardingAction } from "./actions";

interface BienvenidaFormProps {
  userEmail: string;
  initialName: string;
  publicId: string | null;
  initialCountry: string;
  initialCity: string;
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
  publicId,
  initialCountry,
  initialCity,
  avatarUrl,
  next,
}: BienvenidaFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [countryCode, setCountryCode] = useState(initialCountry);
  const [city, setCity] = useState(initialCity);
  const countries = getAllCountries();
  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim().replace(/\s+/g, " ");
    if (cleanName.length < 5 || cleanName.length > 80 || cleanName.split(" ").length < 2) {
      setErrorMsg("Escribe tu nombre y apellidos (mínimo dos palabras, entre 5 y 80 caracteres).");
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
        fullName: cleanName,
        phoneNumber: formattedPhone,
        countryCode: countryCode || null,
        city: city.trim() || null,
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
      console.error("Error submitting onboarding:", err?.code, err?.message);
      setErrorMsg(`Ocurrió un error inesperado al guardar: ${err?.message || "error desconocido"}`);
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
              Nombre y apellidos *
            </label>
            <input
              id="fullName"
              type="text"
              required
              minLength={5}
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
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Tu ID será <strong className="font-mono text-[var(--ink)]">{publicId || "PNT-XXXXXX"}</strong>. Sirve para que te identifiquen y no se puede cambiar.
            </p>
          </div>

          {/* País y ciudad (opcionales) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="countryCode"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                País
              </label>
              <select
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={submitting}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-all"
              >
                <option value="">Selecciona un país</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="city"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                Ciudad
              </label>
              <input
                id="city"
                type="text"
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej. Medellín"
                disabled={submitting}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
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
              disabled={submitting || !acceptTerms}
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
