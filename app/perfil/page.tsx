"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { IconoCheckCirculo, IconoAlerta, IconoCamara } from "@/components/iconos";
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from "libphonenumber-js";
import { getAllCountries } from "@/lib/geo/countries";
import { comprimirFotoPerfil } from "@/lib/media/comprimir";


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

export default function MisDatosPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form values
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Original state for change tracking
  const [initialData, setInitialData] = useState<any>(null);

  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load private data once user is available
  useEffect(() => {
    if (userLoading) return; // wait for auth

    if (!user) {
      router.push("/entrar?next=/perfil");
      return;
    }

    async function loadPrivateData() {
      if (!user) return;

      // Safety timeout: if something hangs, stop the spinner
      const timeout = setTimeout(() => {
        setLoadError("No pudimos cargar tus datos. Comprueba tu conexión.");
        setLoading(false);
      }, 6000);

      try {
        let currentProfile = profile;

        // Si el perfil aún no está en memoria, consultarlo directamente
        if (!currentProfile) {
          const { data: directProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          currentProfile = directProfile;
        }

        // Si aún no existe la fila de perfil en la base de datos, auto-sanarla
        if (!currentProfile) {
          const meta = user.user_metadata || {};
          const fName = meta.full_name || meta.name || user.email?.split("@")[0] || "Usuario";
          const uName = `usuario_${user.id.substring(0, 6)}`;
          try {
            await supabase.from("profiles").upsert({
              id: user.id,
              full_name: fName,
              username: uName,
              avatar_url: meta.avatar_url || meta.picture || null,
            });
          } catch {}

          const { data: healedProf } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          currentProfile = healedProf;
        }

        const { data: privData, error: privErr } = await supabase
          .from("profile_private")
          .select("phone")
          .eq("id", user.id)
          .maybeSingle();

        let priv = privData;
        // Si no existe la fila privada, crearla
        if (!priv && !privErr) {
          try {
            await supabase.from("profile_private").upsert({ id: user.id });
          } catch {}
          priv = { phone: null };
        }

        let country = "CO";
        let numberPart = "";

        if (priv?.phone) {
          try {
            const parsed = parsePhoneNumber(priv.phone);
            if (parsed) {
              country = parsed.country || "CO";
              numberPart = parsed.nationalNumber;
            }
          } catch {
            numberPart = priv.phone ?? "";
          }
        }

        const initial = {
          avatar_url: currentProfile?.avatar_url || "",
          full_name: currentProfile?.full_name || "",
          username: currentProfile?.username || "",
          bio: currentProfile?.bio || "",
          country_code: currentProfile?.country_code || "",
          city: currentProfile?.city || "",
          phone_country: country,
          phone_raw: numberPart,
        };

        setAvatarUrl(initial.avatar_url);
        setFullName(initial.full_name);
        setUsername(initial.username);
        setBio(initial.bio);
        setCountryCode(initial.country_code);
        setCity(initial.city);
        setPhoneCountry(country);
        setPhoneRaw(numberPart);
        setInitialData(initial);
        setLoadError(null);
      } catch (err: any) {
        console.error("[perfil] Error cargando datos privados:", err?.code, err?.message);
        setLoadError("No pudimos cargar esta sección. Intenta de nuevo.");
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    loadPrivateData();
  }, [userLoading, user, profile]);


  // Track if changes were made
  const hasChanges = initialData && (
    avatarUrl !== initialData.avatar_url ||
    fullName !== initialData.full_name ||
    username !== initialData.username ||
    bio !== initialData.bio ||
    countryCode !== initialData.country_code ||
    city !== initialData.city ||
    phoneCountry !== initialData.phone_country ||
    phoneRaw !== initialData.phone_raw
  );

  // Warn before leaving if changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("La imagen no debe superar los 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);

    try {
      const compressed = await comprimirFotoPerfil(file);
      const path = `${user.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage
        .from("avatares")
        .upload(path, compressed.file, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from("avatares")
        .getPublicUrl(path);

      // Append timestamp to bust cache
      const freshUrl = `${publicData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(freshUrl);
    } catch (err: any) {
      console.error("Error uploading avatar:", err);
      setErrorMsg("No pudimos subir la foto. Intenta de nuevo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDiscard = () => {
    if (!initialData) return;
    setAvatarUrl(initialData.avatar_url);
    setFullName(initialData.full_name);
    setUsername(initialData.username);
    setBio(initialData.bio);
    setCountryCode(initialData.country_code);
    setCity(initialData.city);
    setPhoneCountry(initialData.phone_country);
    setPhoneRaw(initialData.phone_raw);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg(null);
    setSaveNotice(false);

    if (fullName.trim().length < 2) {
      setErrorMsg("Escribe tu nombre completo (mínimo 2 caracteres).");
      return;
    }

    let formattedPhone: string | null = null;
    if (phoneRaw.trim()) {
      try {
        const parsed = parsePhoneNumber(phoneRaw, phoneCountry as CountryCode);
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

    setSaving(true);

    try {
      // 1. Actualizar perfil público
      const { error: profError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          username: username.toLowerCase().trim(),
          bio: bio.trim() || null,
          country_code: countryCode || null,
          city: city.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", user.id);

      if (profError) {
        if (profError.message.includes("profiles_username_key")) {
          setErrorMsg("Ese usuario ya lo tomó otra persona. Prueba con otro.");
        } else {
          setErrorMsg("Error al guardar los datos del perfil.");
        }
        setSaving(false);
        return;
      }

      // 2. Actualizar datos privados
      const { error: privError } = await supabase
        .from("profile_private")
        .update({
          phone: formattedPhone,
        })
        .eq("id", user.id);

      if (privError) {
        setErrorMsg("Error al guardar el número de teléfono.");
        setSaving(false);
        return;
      }

      await refreshProfile();
      setInitialData({
        avatar_url: avatarUrl,
        full_name: fullName,
        username: username,
        bio: bio,
        country_code: countryCode,
        city: city,
        phone_country: phoneCountry,
        phone_raw: phoneRaw,
      });

      setSaveNotice(true);
      setTimeout(() => setSaveNotice(false), 4000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setErrorMsg("Ocurrió un error inesperado al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-sm text-[var(--ink-2)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <span>Cargando tus datos...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-sm">
        <IconoAlerta size={28} className="text-red-500" />
        <p className="text-[var(--ink-2)] text-center max-w-xs">{loadError}</p>
        <button
          onClick={() => { setLoading(true); setLoadError(null); }}
          className="px-4 py-2 rounded-xl bg-[var(--cta)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const allCountries = getAllCountries();

  return (
    <div className="space-y-6">
      {/* Cabecera de la sección */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Mis datos
        </h1>
        <p className="text-xs sm:text-sm text-[var(--ink-2)] mt-1">
          Gestiona tu información pública para la comunidad y tus datos privados de contacto.
        </p>
      </div>

      {/* Alertas */}
      {saveNotice && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-600 border border-emerald-500/20 animate-fade-in">
          <IconoCheckCirculo size={18} className="flex-shrink-0" />
          <span className="font-semibold">Cambios guardados con éxito.</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-4 text-xs sm:text-sm text-red-500 border border-red-500/20 animate-fade-in">
          <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSave}>
        <div className="p-6 sm:p-8 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] shadow-sm space-y-6">
          {/* 1. Foto de Perfil (Público) */}
          <div className="flex items-center gap-6 pb-6 border-b border-[var(--line)]">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--line)] bg-[var(--avatar)] flex items-center justify-center flex-shrink-0 shadow-md">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-[var(--ink)]">
                  {(fullName || user?.email || "P")[0].toUpperCase()}
                </span>
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-mono animate-pulse">
                  Subiendo...
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink)]">
                  Foto de perfil
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                  Público
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] hover:border-[var(--glass-edge)] transition-colors cursor-pointer"
              >
                <IconoCamara size={14} />
                <span>{uploadingAvatar ? "Subiendo foto..." : "Cambiar foto"}</span>
              </button>
            </div>
          </div>

          {/* 2. Nombre Completo (Público) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_fullname"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Nombre completo
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                Público
              </span>
            </div>
            <input
              id="profile_fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
            />
          </div>

          {/* 3. Tu ID en Puente (Público - Asignado para compartir) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_username"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Tu ID en Puente
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                Público
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[var(--ink-3)]">
                  @
                </span>
                <input
                  id="profile_username"
                  type="text"
                  readOnly
                  disabled
                  value={username}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--track)] py-2.5 pl-8 pr-3.5 text-sm font-mono text-[var(--ink)] opacity-90 cursor-not-allowed select-all"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(username ? `@${username}` : "");
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer flex-shrink-0"
              >
                {copiedId ? "¡Copiado!" : "Copiar ID"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Identificador único para compartir y encontrarte en la red social.
            </p>
          </div>

          {/* 4. Biografía (Público) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_bio"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Biografía
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--ink-3)]">
                  {bio.length}/280
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                  Público
                </span>
              </div>
            </div>
            <textarea
              id="profile_bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              placeholder="Cuéntale a la comunidad sobre ti o las causas que apoyas..."
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all resize-none"
            />
          </div>

          {/* 5. País y Ciudad (Público) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="profile_country"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
                >
                  País
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                  Público
                </span>
              </div>
              <select
                id="profile_country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">Selecciona tu país</option>
                {allCountries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="profile_city"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
                >
                  Ciudad
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                  Público
                </span>
              </div>
              <input
                id="profile_city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej. Medellín, Oaxaca, etc."
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
          </div>

          {/* 6. Número de contacto (Privado) */}
          <div className="pt-4 border-t border-[var(--line)]">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_phone"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Número de contacto
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-[var(--accent)] font-semibold border border-blue-500/20">
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
                id="profile_phone"
                type="tel"
                value={phoneRaw}
                onChange={(e) => setPhoneRaw(e.target.value)}
                placeholder="Número de celular"
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
              {phoneRaw ? "Privado. Solo se usa para verificar causas que publiques." : "Lo necesitas para publicar una causa. No se muestra públicamente."}
            </p>
          </div>

          {/* 7. Correo (Privado - Solo lectura de Google) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Correo electrónico
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-[var(--accent)] font-semibold border border-blue-500/20">
                Privado
              </span>
            </div>
            <input
              id="profile_email"
              type="text"
              readOnly
              disabled
              value={user?.email || ""}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--track)] py-2.5 px-3.5 text-sm text-[var(--ink-2)] opacity-80 cursor-not-allowed select-none"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">
              Correo de tu cuenta de Google. No se puede cambiar desde Puente.
            </p>
          </div>

          {/* Barra inferior fija de Descartar / Guardar cambios */}
          <div className="pt-6 border-t border-[var(--line)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!hasChanges || saving}
              className="py-2.5 px-4 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              Descartar
            </button>

            <button
              type="submit"
              disabled={!hasChanges || saving}
              className="py-2.5 px-5 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
