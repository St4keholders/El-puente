"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import {
  IconoCheckCirculo,
  IconoAlerta,
  IconoCamara,
  IconoCandado,
  IconoCargando,
  IconoOjo,
  IconoOjoTachado,
} from "@/components/iconos";
import { enFormaTitulo } from "@/lib/identity/nombre";
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
import { SelectorIndicativo } from "@/components/ui/SelectorIndicativo";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];



interface MisDatosClientProps {
  userId: string;
  userEmail: string;
  initialProfile: Profile | null;
  initialPhone: string | null;
  initialVerification?: {
    status: "pendiente" | "aprobada" | "rechazada" | "en_revision" | "vencida";
    verified_at: string | null;
    expires_at: string | null;
    decline_reason: string | null;
    verified_full_name?: string | null;
    verified_given_names?: string | null;
    verified_last_names?: string | null;
    document_country?: string | null;
    document_last4?: string | null;
  } | null;
}

export function MisDatosClient({
  userId,
  userEmail,
  initialProfile,
  initialPhone,
  initialVerification,
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

  const isProfileVerified = Boolean((initialProfile as any)?.identity_verified);
  const verifStatus = initialVerification?.status;
  const isExpired =
    initialVerification?.expires_at &&
    new Date(initialVerification.expires_at) <= new Date();
  const isVerified = (isProfileVerified || verifStatus === "aprobada") && !isExpired;
  const isEnRevision = verifStatus === "en_revision";
  const isPendiente = verifStatus === "pendiente";
  const isRechazada = verifStatus === "rechazada";
  const isVencida = Boolean(isExpired);

  const expDate = initialVerification?.expires_at
    ? new Date(initialVerification.expires_at).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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
  const [mostrarDocumento, setMostrarDocumento] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const countries = getAllCountries();

  // Datos que vienen del documento verificado: fijos, no se editan.
  const nombreLegal = enFormaTitulo(
    initialVerification?.verified_full_name ||
      [initialVerification?.verified_given_names, initialVerification?.verified_last_names]
        .filter(Boolean)
        .join(" ")
  );
  const ultimos4 = initialVerification?.document_last4 || null;
  const paisDocumento = initialVerification?.document_country
    ? countries.find((c) => c.id === initialVerification.document_country)?.name ||
      initialVerification.document_country
    : null;

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
    if (!isVerified && cleanName.length < 2) {
      setErrorMsg("Escribe tu nombre completo (mínimo 2 caracteres).");
      return;
    }

    let formattedPhone: string | null = null;
    if (!phoneRaw.trim()) {
      setErrorMsg("Tu número de contacto es obligatorio.");
      return;
    }
    {
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
          {/* Estado de Verificación de Identidad (Sección 9.2) */}
          <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--field)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  isVerified
                    ? "bg-emerald-500/15 text-emerald-500"
                    : isEnRevision
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-[var(--hover)] text-[var(--ink-3)]"
                }`}
              >
                <IconoCheckCirculo size={20} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {isVerified
                      ? "Identidad verificada"
                      : isEnRevision
                      ? "Verificación en revisión"
                      : isPendiente
                      ? "Verificación en curso"
                      : isRechazada
                      ? "Verificación rechazada"
                      : isVencida
                      ? "Verificación vencida"
                      : "Identidad no verificada"}
                  </span>
                  {isVerified && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                      Nivel 1
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  {isVerified && expDate
                    ? `Vigente hasta el ${expDate}`
                    : "Obligatoria para publicar causas y dar confianza a los donantes."}
                </p>
              </div>
            </div>
            <Link
              href="/verificacion"
              className="py-2 px-4 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
            >
              {isVerified ? "Ver estado" : isVencida ? "Renovar" : isRechazada ? "Reintentar" : "Verificar ahora"}
            </Link>
          </div>

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
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white">
                  <IconoCargando size={22} className="animate-spin" />
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
                {uploadingAvatar ? <IconoCargando size={14} className="animate-spin" /> : <IconoCamara size={14} />}
                <span>{uploadingAvatar ? "Procesando…" : "Cambiar foto"}</span>
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

          {/* Nombre */}
          {isVerified ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                    Nombre público
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                    Público
                  </span>
                </div>
                <div className="flex items-center gap-2.5 w-full rounded-xl border border-[var(--line)] bg-[var(--track)] py-2.5 px-3.5 text-sm text-[var(--ink)]">
                  <IconoCandado size={15} className="flex-shrink-0 text-[var(--ink-3)]" />
                  <span className="truncate">{fullName}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
                  Así te ven en Puente: tus nombres y la inicial de tu apellido.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--field)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                    Datos de tu documento
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--hover)] text-[var(--ink-3)] font-semibold">
                    Privado
                  </span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-[11px] text-[var(--ink-3)]">Nombre completo</dt>
                    <dd className="font-medium text-[var(--ink)] truncate">{nombreLegal || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] text-[var(--ink-3)]">Identificación</dt>
                    <dd className="flex items-center gap-2">
                      <span className="font-mono text-[var(--ink)] tracking-wider">
                        {mostrarDocumento && ultimos4 ? `•••• ${ultimos4}` : "•••• ••••"}
                      </span>
                      {ultimos4 && (
                        <button
                          type="button"
                          onClick={() => setMostrarDocumento((v) => !v)}
                          aria-label={mostrarDocumento ? "Ocultar identificación" : "Mostrar últimos 4 dígitos"}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
                        >
                          {mostrarDocumento ? <IconoOjoTachado size={15} /> : <IconoOjo size={15} />}
                        </button>
                      )}
                    </dd>
                  </div>
                  {paisDocumento && (
                    <div className="min-w-0">
                      <dt className="text-[11px] text-[var(--ink-3)]">País del documento</dt>
                      <dd className="font-medium text-[var(--ink)]">{paisDocumento}</dd>
                    </div>
                  )}
                </dl>
                <p className="text-[11px] text-[var(--ink-3)] flex items-start gap-1.5">
                  <IconoCandado size={12} className="flex-shrink-0 mt-0.5" />
                  Vienen de tu documento verificado y no se pueden cambiar. Solo guardamos los últimos 4
                  dígitos de tu identificación.
                </p>
              </div>
            </div>
          ) : (
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
                autoComplete="name"
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
              <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
                Al verificar tu identidad, tu nombre se tomará de tu documento y quedará fijo.
              </p>
            </div>
          )}

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
              <SelectorIndicativo value={phoneCountry} onChange={setPhoneCountry} disabled={saving} />
              <input
                id="profile_phone"
                type="tel"
                value={phoneRaw}
                onChange={(e) => setPhoneRaw(e.target.value)}
                placeholder="300 123 4567"
                disabled={saving}
                className="w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
              Obligatorio y completamente privado. Solo se usa para coordinar apoyo en causas que publiques.
            </p>
          </div>

          {/* Botón Guardar */}
          <div className="flex justify-end pt-4 border-t border-[var(--line)]">
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--cta)] text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-wait transition-all cursor-pointer"
            >
              {saving && <IconoCargando size={15} className="animate-spin" />}
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
