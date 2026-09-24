"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import {
  IconoCheckCirculo,
  IconoAlerta,
  IconoCamara,
} from "@/components/iconos";
import { parsePhoneNumber, CountryCode } from "libphonenumber-js";
import { getAllCountries } from "@/lib/geo/countries";
import { comprimirFotoPerfil } from "@/lib/media/comprimir";
import { urlDeAvatar } from "@/lib/media";
import { avisarPerfilActualizado } from "@/lib/hooks/useUser";
import {
  updateProfileAction,
  cambiarFotoPerfilAction,
  quitarFotoPerfilAction,
} from "./actions";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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

interface MisDatosClientProps {
  userId: string;
  userEmail: string;
  initialProfile: Profile | null;
  initialPhone: string | null;
}

export function MisDatosClient({
  userId,
  userEmail,
  initialProfile,
  initialPhone,
}: MisDatosClientProps) {
  let parsedCountry = "CO";
  let parsedNumber = "";
  if (initialPhone) {
    try {
      const p = parsePhoneNumber(initialPhone);
      if (p) {
        parsedCountry = p.country || "CO";
        parsedNumber = p.nationalNumber;
      }
    } catch {
      parsedNumber = initialPhone;
    }
  }

  const [avatarValue, setAvatarValue] = useState<string | null>(initialProfile?.avatar_url || null);
  const avatarUrl = urlDeAvatar(avatarValue);
  const [fullName, setFullName] = useState(initialProfile?.full_name || "");
  const publicId = initialProfile?.public_id || "";
  const [bio, setBio] = useState(initialProfile?.bio || "");
  const [countryCode, setCountryCode] = useState(initialProfile?.country_code || "");
  const [city, setCity] = useState(initialProfile?.city || "");
  const [phoneCountry, setPhoneCountry] = useState(parsedCountry);
  const [phoneRaw, setPhoneRaw] = useState(parsedNumber);

  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const countries = getAllCountries();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file || !userId) return;

    setUploadingAvatar(true);
    setErrorMsg(null);

    try {
      // Recorte cuadrado 512 px, WebP 0,85 (redibujar en canvas elimina el EXIF)
      const compressed = await comprimirFotoPerfil(file);
      const formData = new FormData();
      formData.append("file", compressed.file);

      const res = await cambiarFotoPerfilAction(formData);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }

      setAvatarValue(res.avatarUrl);
      avisarPerfilActualizado();
      router.refresh();
    } catch (err: any) {
      console.error("Error procesando la foto de perfil:", err?.code, err?.message);
      setErrorMsg(`No pudimos procesar la foto: ${err?.message || "error desconocido"}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setErrorMsg(null);
    try {
      const res = await quitarFotoPerfilAction();
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setAvatarValue(null);
      avisarPerfilActualizado();
      router.refresh();
    } catch (err: any) {
      console.error("Error quitando la foto de perfil:", err?.code, err?.message);
      setErrorMsg(`No pudimos quitar la foto: ${err?.message || "error desconocido"}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(publicId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err: any) {
      console.error("No se pudo copiar el ID:", err?.name, err?.message);
      setErrorMsg("No pudimos copiar el ID. Selecciónalo y cópialo a mano.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
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
      const res = await updateProfileAction({
        fullName: cleanName,
        bio: bio.trim() || null,
        countryCode: countryCode || null,
        city: city.trim() || null,
        phone: formattedPhone,
      });

      if (!res.success) {
        setErrorMsg(res.error || "No pudimos guardar los cambios.");
        return;
      }

      setSaveNotice(true);
      avisarPerfilActualizado();
      router.refresh();
      setTimeout(() => setSaveNotice(false), 4000);
    } catch (err: any) {
      console.error("Error saving profile:", err?.code, err?.message);
      setErrorMsg(`Ocurrió un error inesperado al guardar: ${err?.message || "error desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Título de la sección */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
          Mis datos
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--ink-2)]">
          Administra la información pública y privada de tu perfil.
        </p>
      </div>

      {saveNotice && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-600 border border-emerald-500/20">
          <IconoCheckCirculo size={18} className="flex-shrink-0" />
          <span className="font-semibold">Cambios guardados con éxito.</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-4 text-xs sm:text-sm text-red-500 border border-red-500/20">
          <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="p-6 sm:p-8 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] shadow-sm space-y-6">
          {/* Foto de Perfil */}
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
                  {(fullName || userEmail || "P")[0].toUpperCase()}
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
                disabled={uploadingAvatar || saving}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] hover:border-[var(--glass-edge)] transition-colors cursor-pointer"
              >
                <IconoCamara size={14} />
                <span>{uploadingAvatar ? "Subiendo foto..." : "Cambiar foto"}</span>
              </button>

              {avatarValue && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar || saving}
                  className="ml-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] hover:border-[var(--glass-edge)] transition-colors cursor-pointer"
                >
                  <span>Quitar foto</span>
                </button>
              )}
            </div>
          </div>

          {/* Nombre Completo */}
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
              disabled={saving}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
            />
          </div>

          {/* ID público (solo lectura, no se puede cambiar) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_public_id"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                ID público
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                Público
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="profile_public_id"
                  type="text"
                  readOnly
                  disabled
                  value={publicId}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--track)] py-2.5 px-3.5 text-sm font-mono text-[var(--ink)] opacity-90 cursor-not-allowed select-all"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer flex-shrink-0"
              >
                {copiedId ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Biografía */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_bio"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Biografía
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                Público
              </span>
            </div>
            <textarea
              id="profile_bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="Cuéntale a la comunidad quién eres o qué te motiva..."
              disabled={saving}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-mono text-[var(--ink-3)]">
                {bio.length}/280
              </span>
            </div>
          </div>

          {/* Ubicación: País y Ciudad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="profile_country"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                País
              </label>
              <select
                id="profile_country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-all"
              >
                <option value="">Selecciona un país</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="profile_city"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5"
              >
                Ciudad
              </label>
              <input
                id="profile_city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                placeholder="Ej. Medellín, Cali..."
                disabled={saving}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
          </div>

          {/* Teléfono de Contacto (Privado) */}
          <div className="pt-4 border-t border-[var(--line)]">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile_phone"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]"
              >
                Número de contacto
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--hover)] text-[var(--ink-3)] font-semibold">
                Privado
              </span>
            </div>
            <div className="flex gap-2">
              <select
                aria-label="Código de país"
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                disabled={saving}
                className="w-[125px] flex-shrink-0 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-all"
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
                placeholder="300 123 4567"
                disabled={saving}
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
              Este número es completamente privado. Solo se utilizará para coordinar apoyo en causas que publiques.
            </p>
          </div>

          {/* Botón Guardar */}
          <div className="flex justify-end pt-4 border-t border-[var(--line)]">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[var(--cta)] text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
