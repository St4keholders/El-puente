"use client";

import React, { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import { createClient } from "@/lib/supabase/client";
import {
  setOnboardingCompletedCookie,
  signOutAction,
} from "@/lib/actions/auth";
import {
  IconoAlerta,
  IconoFoto,
  IconoMarcador,
  IconoCargando,
  IconoBasura,
} from "@/components/iconos";
import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";
import { comprimirFotoPerfil } from "@/lib/media/comprimir";
import { defaultGeocoder, type GeocodedCity } from "@/lib/geo/geocoder";
import mundoData from "@/lib/geo/mundo.json";

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

function BienvenidaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [compressingAvatar, setCompressingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Location state
  const [countryCode, setCountryCode] = useState("CO");
  const [city, setCity] = useState("");
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<GeocodedCity[]>([]);
  const [searchingCities, setSearchingCities] = useState(false);

  const countries = useMemo(() => {
    return ((mundoData as any).countries || []) as Array<{
      id: string;
      n: string;
      en: string;
      lat: number;
      lng: number;
    }>;
  }, []);

  const cityDebounceRef = useRef<any>(null);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    async function loadUser() {
      try {
        const supabase = createClient();
        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !currentUser) {
          if (
            userErr?.message?.includes("claim in JWT") ||
            userErr?.status === 403 ||
            userErr?.status === 401
          ) {
            await supabase.auth.signOut().catch(() => {});
            await signOutAction().catch(() => {});
          }
          router.replace(`/entrar?next=${encodeURIComponent(next)}`);
          return;
        }

        setUser(currentUser);

        // Consultar perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed_at, full_name, username, avatar_url, country_code, city")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (profile?.onboarding_completed_at) {
          document.cookie = "puente-bienvenida=1; path=/; max-age=31536000; SameSite=Lax";
          await setOnboardingCompletedCookie().catch(() => {});
          const target = (!next || next === "/bienvenida") ? "/" : next;
          window.location.href = target;
          return;
        }

        const meta = currentUser.user_metadata || {};
        const initialName = profile?.full_name || meta.full_name || meta.name || currentUser.email?.split("@")[0] || "";
        setFullName(initialName);

        const initialAvatar =
          profile?.avatar_url || meta.avatar_url || meta.picture || null;
        setAvatarUrl(initialAvatar);

        if (profile?.country_code) {
          setCountryCode(profile.country_code);
        }
        if (profile?.city) {
          setCity(profile.city);
        }
      } catch (e) {
        console.error("Error loading user in bienvenida:", e);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    }

    loadUser();

    return () => clearTimeout(safetyTimer);
  }, [router, next]);

  // Manejo de avatar
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
    setAvatarUrl(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  // Manejo de búsqueda de ciudad
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

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Client signOut error:", err);
    }
    try {
      await signOutAction();
    } catch (err) {
      console.warn("Server signOutAction error:", err);
    }
    window.location.href = "/";
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

    const submitTimeout = setTimeout(() => {
      setSubmitting(false);
      setErrorMsg("La operación tardó demasiado. Por favor intenta de nuevo.");
    }, 12000);

    try {
      const supabase = createClient();

      // 1. Subir avatar si el usuario seleccionó un archivo nuevo
      let finalAvatarUrl: string | null = avatarUrl;

      if (avatarRemoved) {
        finalAvatarUrl = null;
      } else if (avatarFile && user?.id) {
        const fileName = `${user.id}/avatar_${Date.now()}.webp`;
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
      }

      // 2. Completar registro atómicamente en la base de datos (con ID asignado automáticamente)
      const userAssignedId = user?.id ? `id_${user.id.replace(/-/g, "").slice(0, 10)}` : "";
      const { error: rpcError } = await (supabase.rpc as any)("complete_onboarding", {
        p_full_name: fullName.trim(),
        p_username: userAssignedId,
        p_phone: formattedPhone || "",
        p_terms_version: "v1.0",
        p_country_code: countryCode || null,
        p_city: city.trim() || null,
        p_avatar_url: finalAvatarUrl || null,
      });

      if (rpcError) {
        clearTimeout(submitTimeout);
        if (rpcError.message?.includes("REG_TELEFONO")) {
          setErrorMsg("Revisa el número, parece incompleto.");
        } else if (rpcError.message?.includes("REG_TERMINOS")) {
          setErrorMsg("Acepta los términos para continuar.");
        } else if (
          rpcError.message?.includes("claim in JWT") ||
          rpcError.message?.includes("JWT") ||
          (rpcError as any).status === 403 ||
          (rpcError as any).code === "42501"
        ) {
          // Sesión huérfana de cuenta previa: limpiar cookies y enviar a entrar
          await supabase.auth.signOut().catch(() => {});
          await signOutAction().catch(() => {});
          window.location.href = `/entrar?next=${encodeURIComponent(next)}`;
          return;
        } else {
          setErrorMsg("No pudimos completar tu registro: " + rpcError.message);
        }
        setSubmitting(false);
        return;
      }

      // 3. Marcar cookie en cliente al instante y en servidor
      document.cookie = "puente-bienvenida=1; path=/; max-age=31536000; SameSite=Lax";
      setOnboardingCompletedCookie().catch(() => {});
      clearTimeout(submitTimeout);

      const targetUrl = (!next || next === "/bienvenida") ? "/" : next;
      window.location.href = targetUrl;
    } catch (err: any) {
      clearTimeout(submitTimeout);
      console.error("Error completing onboarding:", err);
      setErrorMsg("Ocurrió un error inesperado al guardar. Intenta de nuevo.");
      setSubmitting(false);
    } finally {
      clearTimeout(submitTimeout);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center text-sm text-[var(--ink-2)]">
        <div className="flex flex-col items-center gap-3">
          <IconoCargando size={24} className="animate-spin text-[var(--accent)]" />
          <span>Preparando tu bienvenida...</span>
        </div>
      </div>
    );
  }

  const firstName = fullName.split(/\s+/)[0] || "amigo";
  const effectiveAvatar = avatarPreview || (!avatarRemoved ? avatarUrl : null);
  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "U";

  const assignedIdPreview = user?.id
    ? `id_${user.id.replace(/-/g, "").slice(0, 10)}`
    : "id_asignado";

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-4 py-20 sm:py-24">
      <Glass
        variant="panel"
        className="w-full max-w-[480px] shadow-2xl p-7 sm:p-9 border border-[var(--line)] rounded-3xl"
      >
        {/* Cabecera con Foto */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative mb-3 group">
            {effectiveAvatar ? (
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[var(--line)] bg-[var(--avatar)] shadow-lg">
                <img
                  src={effectiveAvatar}
                  alt={fullName || "Perfil"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[var(--accent)] text-white font-bold text-2xl shadow-lg">
                {initials}
              </div>
            )}

            {compressingAvatar && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <IconoCargando size={24} className="animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Botones Cambiar foto y Quitar foto */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />

          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={compressingAvatar || submitting}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--field)] hover:bg-[var(--line)] text-[var(--ink)] border border-[var(--line)] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <IconoFoto size={14} />
              <span>Cambiar foto</span>
            </button>

            {effectiveAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={compressingAvatar || submitting}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-1"
                title="Quitar foto y usar iniciales"
              >
                <IconoBasura size={13} />
                <span>Quitar foto</span>
              </button>
            )}
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            Hola, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)] font-medium">
            Completa tu perfil para continuar.
          </p>
        </div>

        {/* Alerta de error */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-500 border border-red-500/20 animate-fade-in">
            <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Nombre Completo */}
          <div>
            <label
              htmlFor="full_name"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
            >
              Nombre completo *
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

          {/* 2. Tu ID único en Puente (Asignado automáticamente para compartir en red social) */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--field)] p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-0.5">
                Tu ID en Puente
              </span>
              <span className="text-xs font-mono text-[var(--accent-ink)] font-bold truncate block">
                {assignedIdPreview}
              </span>
            </div>
            <span className="text-[11px] text-[var(--ink-3)] text-right flex-shrink-0 max-w-[170px] leading-tight">
              Identificador único para compartir y encontrarte
            </span>
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
                {PHONE_COUNTRIES.map((c) => (
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

          {/* 4. País y ciudad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor="country_code"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                País <span className="font-normal lowercase text-[var(--ink-3)]">(opcional)</span>
              </label>
              <select
                id="country_code"
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setCity("");
                  setCitySuggestions([]);
                }}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-colors cursor-pointer"
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
                htmlFor="city_input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                Ciudad <span className="font-normal lowercase text-[var(--ink-3)]">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  id="city_input"
                  type="text"
                  value={city || citySearchQuery}
                  onChange={(e) => handleCitySearchChange(e.target.value)}
                  placeholder="Buscar ciudad..."
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 pl-8 pr-7 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-all"
                />
                <IconoMarcador
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
                />
                {searchingCities && (
                  <IconoCargando
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--accent)]"
                  />
                )}
              </div>

              {/* Sugerencias de ciudad */}
              {citySuggestions.length > 0 && !city && (
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-[var(--field)] border border-[var(--line)] shadow-xl z-30 overflow-hidden py-1 max-h-40 overflow-y-auto">
                  {citySuggestions.map((item, idx) => (
                    <button
                      key={`${item.name}-${idx}`}
                      type="button"
                      onClick={() => handleSelectCity(item)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--line)] flex items-center justify-between text-[var(--ink)] transition-colors cursor-pointer"
                    >
                      <span className="font-medium">{item.name}</span>
                      {item.region && (
                        <span className="text-[10px] text-[var(--ink-3)]">{item.region}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. Términos y privacidad */}
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
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !acceptTerms || compressingAvatar}
              className="w-full py-3.5 px-4 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-sm font-semibold tracking-wide shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? "Guardando tus datos..." : "Listo, entrar"}
            </button>
          </div>

          {/* Enlace pequeño Salir */}
          <div className="text-center pt-1">
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
