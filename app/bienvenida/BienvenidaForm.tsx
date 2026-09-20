"use client";

import React, { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import {
  IconoCamara,
  IconoBasura,
  IconoCargando,
  IconoAlerta,
  IconoCheckCirculo,
} from "@/components/iconos";
import { parsePhoneNumber, CountryCode } from "libphonenumber-js";
import { comprimirFotoPerfil } from "@/lib/media/comprimir";
import { createClient } from "@/lib/supabase/client";
import { defaultGeocoder, type GeocodedCity } from "@/lib/geo/geocoder";
import mundoData from "@/lib/geo/mundo.json";
import { completeOnboardingAction } from "./actions";

interface BienvenidaFormProps {
  userId: string;
  userEmail: string;
  assignedId: string;
  initialName: string;
  initialAvatar: string | null;
  initialCountry: string;
  initialCity: string;
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
  userId,
  userEmail,
  assignedId,
  initialName,
  initialAvatar,
  initialCountry,
  initialCity,
  next,
}: BienvenidaFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [compressingAvatar, setCompressingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [phoneCountry, setPhoneCountry] = useState(initialCountry || "CO");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Ubicación
  const [countryCode, setCountryCode] = useState(initialCountry || "CO");
  const [city, setCity] = useState(initialCity || "");
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<GeocodedCity[]>([]);
  const [searchingCities, setSearchingCities] = useState(false);
  const cityDebounceRef = useRef<any>(null);

  const countries = useMemo(() => {
    return ((mundoData as any).countries || []) as Array<{
      id: string;
      n: string;
      en: string;
      lat: number;
      lng: number;
    }>;
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingAvatar(true);
      setErrorMsg(null);
      const compressed = await comprimirFotoPerfil(file);
      setAvatarFile(compressed.file);
      setAvatarPreview(compressed.previewUrl);
      setAvatarRemoved(false);
    } catch (err: any) {
      console.error("Error al comprimir foto de perfil:", err);
      setErrorMsg(err.message || "No se pudo procesar la foto seleccionada.");
    } finally {
      setCompressingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarRemoved(true);
    setAvatarPreview(null);
    setAvatarFile(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleCitySearchChange = (query: string) => {
    setCitySearchQuery(query);
    setCity("");
    clearTimeout(cityDebounceRef.current);

    if (!query || query.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }

    setSearchingCities(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const results = await defaultGeocoder.searchCities(query, countryCode);
        setCitySuggestions(results);
      } catch (err) {
        console.warn("Error buscando ciudades:", err);
      } finally {
        setSearchingCities(false);
      }
    }, 300);
  };

  const handleSelectCity = (item: GeocodedCity) => {
    setCity(item.name);
    setCitySearchQuery("");
    setCitySuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg("Escribe tu nombre completo (mínimo 2 caracteres).");
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
      let finalAvatarUrl: string | null = avatarRemoved ? null : initialAvatar;

      // Subir archivo de foto si se seleccionó uno nuevo
      if (avatarFile && userId) {
        try {
          const supabase = createClient();
          const fileName = `${userId}/avatar_${Date.now()}.webp`;
          const { error: uploadErr } = await supabase.storage
            .from("avatares")
            .upload(fileName, avatarFile, {
              cacheControl: "31536000",
              contentType: "image/webp",
              upsert: true,
            });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from("avatares")
              .getPublicUrl(fileName);
            finalAvatarUrl = publicUrlData?.publicUrl || null;
          }
        } catch (storageErr) {
          console.warn("Storage upload error:", storageErr);
        }
      }

      // Llamar al Server Action seguro
      const res = await completeOnboardingAction({
        fullName: fullName.trim(),
        phoneNumber: formattedPhone,
        countryCode: countryCode || null,
        city: city.trim() || null,
        avatarUrl: finalAvatarUrl,
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

      // Redirigir al destino de inmediato
      window.location.href = res.redirect || "/";
    } catch (err: any) {
      console.error("Error submitting onboarding:", err);
      setErrorMsg("Ocurrió un error inesperado al guardar. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  const initials =
    (fullName || userEmail || "U")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-4 py-20 sm:py-24">
      <Glass
        variant="panel"
        className="w-full max-w-[480px] shadow-2xl p-7 sm:p-9 border border-[var(--line)] rounded-3xl"
      >
        {/* Cabecera con Foto */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 group">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent)]/15 border-2 border-[var(--glass-edge)] overflow-hidden shadow-lg">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={fullName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-[var(--accent)] font-mono">
                  {initials}
                </span>
              )}

              {compressingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <IconoCargando size={18} className="animate-spin text-white" />
                </div>
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={compressingAvatar || submitting}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--line)] bg-[var(--surface-solid)] text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
            >
              <IconoCamara size={12} />
              <span>{avatarPreview ? "Cambiar foto" : "Subir foto"}</span>
            </button>

            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--line)] bg-red-500/10 text-[11px] font-semibold text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                title="Quitar foto"
              >
                <IconoBasura size={12} />
              </button>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Hola, {fullName.split(" ")[0] || "bienvenido"}
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-2)]">
            Completa tu perfil para continuar.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-3.5 text-xs text-red-500 border border-red-500/20 animate-fade-in">
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

          {/* ID público asignado (sin campo de username editable) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="userAssignedId"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Tu ID en Puente
              </label>
              <span className="text-[10px] font-mono text-[var(--ink-3)]">
                Identificador único para compartir y encontrarte
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[var(--accent-ink)] font-bold">
                  @
                </span>
                <input
                  id="userAssignedId"
                  type="text"
                  readOnly
                  disabled
                  value={assignedId}
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--track)] py-2.5 pl-8 pr-3 text-sm font-mono font-semibold text-[var(--accent-ink)] select-all cursor-not-allowed opacity-90"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`@${assignedId}`);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                className="px-3.5 py-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer flex-shrink-0"
              >
                {copiedId ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Teléfono de contacto */}
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

          {/* País y Ciudad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="countrySelect"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                País <span className="text-[var(--ink-3)]">(opcional)</span>
              </label>
              <select
                id="countrySelect"
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setCity("");
                  setCitySearchQuery("");
                }}
                disabled={submitting}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-all"
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.n} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label
                htmlFor="citySearch"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                Ciudad <span className="text-[var(--ink-3)]">(opcional)</span>
              </label>
              <input
                id="citySearch"
                type="text"
                value={citySearchQuery || city}
                onChange={(e) => handleCitySearchChange(e.target.value)}
                placeholder="Ej. Medellín, Cali..."
                disabled={submitting}
                autoComplete="off"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-all"
              />

              {searchingCities && (
                <div className="absolute right-3 top-9">
                  <IconoCargando size={14} className="animate-spin text-[var(--ink-3)]" />
                </div>
              )}

              {citySuggestions.length > 0 && (
                <ul className="absolute z-20 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] shadow-xl py-1 text-xs">
                  {citySuggestions.map((item) => (
                    <li key={`${item.name}-${item.lat}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectCity(item)}
                        className="w-full text-left px-3 py-1.5 hover:bg-[var(--hover)] text-[var(--ink)] flex items-center justify-between cursor-pointer"
                      >
                        <span>{item.name}</span>
                        <span className="text-[10px] text-[var(--ink-3)]">{item.countryCode}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                  <span>Guardando tu perfil...</span>
                </>
              ) : (
                <>
                  <IconoCheckCirculo size={16} />
                  <span>Listo, entrar al Puente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Glass>
    </div>
  );
}
