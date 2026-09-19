"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  IconoUsuario,
  IconoCamara,
  IconoSalir,
  IconoCheckCirculo,
  IconoAlerta,
  IconoCargando,
  IconoGuardarDisco,
  IconoGlobo,
} from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { compressImageToWebP } from "@/lib/utils/media";
import mundoData from "@/lib/geo/mundo.json";

export default function AjustesPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [countryCode, setCountryCode] = useState("CO");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const countries = ((mundoData as any).countries || []) as Array<{ id: string; n: string }>;

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push("/entrar?next=/ajustes");
      return;
    }

    if (profile) {
      setFullName(profile.full_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setCountryCode(profile.country_code || "CO");
      setCity(profile.city || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [user, profile, userLoading, router]);

  // Handle avatar upload
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);
    setErrorMsg(null);

    try {
      const processed = await compressImageToWebP(file, 600, 0.85);
      const storagePath = `${user.id}/avatar_${Date.now()}.webp`;

      const { error: uploadErr } = await supabase.storage
        .from("avatares")
        .upload(storagePath, processed.blob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage
        .from("avatares")
        .getPublicUrl(storagePath);

      const newAvatarUrl = publicData.publicUrl;
      setAvatarUrl(newAvatarUrl);

      // Update in profiles
      await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", user.id);

      refreshProfile();
    } catch (err: any) {
      setErrorMsg("Error al actualizar avatar: " + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle form save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setErrorMsg("Tu nombre debe tener al menos 2 caracteres.");
      return;
    }

    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (trimmedUsername.length < 3) {
      setErrorMsg("El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          username: trimmedUsername,
          bio: bio.trim() || null,
          country_code: countryCode,
          city: city.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        if (error.message.includes("profiles_username_key")) {
          throw new Error("Ese nombre de usuario ya está en uso. Por favor elige otro.");
        }
        throw error;
      }

      setSuccessMsg(true);
      refreshProfile();
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (userLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <IconoCargando className="animate-spin text-accent mb-4" size={36} />
        <p className="text-text-secondary text-sm">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
          Ajustes de Perfil
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Gestiona tu identidad en Puente. Un perfil completo y verídico genera confianza en la
          comunidad.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <IconoCheckCirculo size={16} />
          <span>¡Perfil actualizado con éxito!</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <IconoAlerta size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <Glass variant="card" className="p-6 sm:p-8 rounded-3xl space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-glass-surface flex items-center justify-center text-accent font-black text-2xl border-2 border-glass-tint">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                fullName.charAt(0).toUpperCase() || <IconoUsuario size={32} />
              )}
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-accent text-white hover:bg-accent/90 shadow-md shadow-accent/30 transition-transform active:scale-95"
              title="Cambiar foto de perfil"
            >
              {isUploadingAvatar ? <IconoCargando size={14} className="animate-spin" /> : <IconoCamara size={14} />}
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarSelect}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-text-primary text-sm">Foto de Perfil</h3>
            <p className="text-xs text-text-secondary">
              Se comprime automáticamente a formato WebP.
            </p>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-text-primary block mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre y apellido"
              className="w-full px-4 py-2.5 rounded-xl glass-surface border border-glass-tint text-text-primary text-sm outline-none focus:border-accent"
            />
            <span className="text-[11px] text-text-secondary mt-0.5 block">
              Obligatorio para poder publicar causas.
            </span>
          </div>

          <div>
            <label className="font-semibold text-text-primary block mb-1">Nombre de Usuario (@) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary font-mono">
                @
              </span>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl glass-surface border border-glass-tint text-text-primary text-sm outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-text-primary block mb-1">Biografía breve</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Cuéntale a la comunidad quién eres o cuál es tu vocación comunitaria..."
              className="w-full px-4 py-2.5 rounded-xl glass-surface border border-glass-tint text-text-primary text-sm outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-text-primary block mb-1">País</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl glass-surface border border-glass-tint text-text-primary text-sm outline-none bg-transparent"
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id} className="bg-background text-text-primary">
                    {c.n} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-text-primary block mb-1">Ciudad</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Tu ciudad"
                className="w-full px-4 py-2.5 rounded-xl glass-surface border border-glass-tint text-text-primary text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl glass-surface hover:bg-red-500/20 text-red-400 font-semibold text-xs flex items-center gap-1.5 transition-all border border-red-500/20"
            >
              <IconoSalir size={14} /> Cerrar sesión
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent/25 transition-transform active:scale-95"
            >
              {isSaving ? <IconoCargando size={14} className="animate-spin" /> : <IconoGuardarDisco size={14} />}
              <span>Guardar cambios</span>
            </button>
          </div>
        </form>
      </Glass>
    </div>
  );
}
