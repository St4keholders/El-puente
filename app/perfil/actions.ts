"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { BUCKET_AVATARES, rutaDeAvatarPropio } from "@/lib/media";

export interface UpdateProfileInput {
  fullName: string;
  bio?: string | null;
  countryCode?: string | null;
  city?: string | null;
  phone?: string | null;
}

function revalidarPerfil(publicId?: string | null) {
  revalidatePath("/perfil", "layout");
  if (publicId) revalidatePath(`/u/${publicId}`);
  revalidatePath("/", "layout");
}

export async function updateProfileAction(data: UpdateProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo." };
  }

  const cleanName = (data.fullName || "").trim();
  if (cleanName.length < 2) {
    return { success: false, error: "El nombre completo debe tener al menos 2 caracteres." };
  }

  // Sanitize country code (must match ^[A-Z]{2}$ or null)
  let cleanCountry: string | null = null;
  if (data.countryCode && /^[a-zA-Z]{2}$/.test(data.countryCode.trim())) {
    cleanCountry = data.countryCode.trim().toUpperCase();
  }

  // 1. Actualizar profiles (solo columnas editables; updated_at lo pone el trigger)
  const { data: updatedProfile, error: profErr } = await supabase
    .from("profiles")
    .update({
      full_name: cleanName,
      bio: data.bio ? data.bio.trim() : null,
      country_code: cleanCountry,
      city: data.city ? data.city.trim() : null,
    })
    .eq("id", user.id)
    .select("public_id")
    .single();

  if (profErr) {
    console.error("updateProfileAction profiles:", profErr.code, profErr.message);
    return { success: false, error: `No pudimos guardar tu perfil: ${profErr.message}` };
  }

  // 2. Actualizar o crear profile_private si se proporcionó teléfono
  if (data.phone !== undefined) {
    let cleanPhone: string | null = null;
    if (data.phone && /^\+[1-9][0-9]{7,14}$/.test(data.phone.trim())) {
      cleanPhone = data.phone.trim();
    }

    const { error: privErr } = await supabase
      .from("profile_private")
      .upsert({ id: user.id, phone: cleanPhone }, { onConflict: "id" });

    if (privErr) {
      console.error("updateProfileAction profile_private:", privErr.code, privErr.message);
      return { success: false, error: `No pudimos guardar tu teléfono: ${privErr.message}` };
    }
  }

  revalidarPerfil(updatedProfile?.public_id);
  return { success: true };
}

/**
 * Cambia la foto de perfil. Orden:
 * 1. sube el archivo nuevo a `avatares/{uid}/avatar-{timestamp}.webp`;
 * 2. actualiza `profiles.avatar_url` con esa ruta;
 * 3. borra el archivo anterior si era del propio bucket;
 * 4. revalida `/perfil` para que el header y la barra lateral la muestren.
 * El cliente ya la procesa: recorte cuadrado 512 px, WebP 0,85, sin EXIF.
 */
export async function cambiarFotoPerfilAction(
  formData: FormData
): Promise<{ success: true; avatarUrl: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No recibimos la imagen." };
  }
  if (file.type !== "image/webp") {
    return { success: false, error: "La foto debe procesarse como WebP antes de subirla." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: "La foto procesada supera los 2 MB." };
  }

  const { data: actual, error: leerErr } = await supabase
    .from("profiles")
    .select("avatar_url, public_id")
    .eq("id", user.id)
    .single();

  if (leerErr) {
    console.error("cambiarFotoPerfilAction leer perfil:", leerErr.code, leerErr.message);
    return { success: false, error: `No pudimos leer tu perfil: ${leerErr.message}` };
  }

  // 1. Subir
  const ruta = `${user.id}/avatar-${Date.now()}.webp`;
  const { error: subirErr } = await supabase.storage
    .from(BUCKET_AVATARES)
    .upload(ruta, Buffer.from(await file.arrayBuffer()), {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (subirErr) {
    console.error("cambiarFotoPerfilAction subir:", subirErr.name, subirErr.message);
    return { success: false, error: `No pudimos subir la foto: ${subirErr.message}` };
  }

  // 2. Guardar la ruta en el perfil
  const { error: guardarErr } = await supabase
    .from("profiles")
    .update({ avatar_url: ruta })
    .eq("id", user.id);

  if (guardarErr) {
    console.error("cambiarFotoPerfilAction guardar:", guardarErr.code, guardarErr.message);
    const { error: limpiarErr } = await supabase.storage.from(BUCKET_AVATARES).remove([ruta]);
    if (limpiarErr) {
      console.error("cambiarFotoPerfilAction limpiar:", limpiarErr.name, limpiarErr.message);
    }
    return { success: false, error: `No pudimos guardar la foto en tu perfil: ${guardarErr.message}` };
  }

  // 3. Borrar la anterior si era nuestra
  const anterior = rutaDeAvatarPropio(actual?.avatar_url);
  if (anterior && anterior !== ruta && anterior.startsWith(`${user.id}/`)) {
    const { error: borrarErr } = await supabase.storage.from(BUCKET_AVATARES).remove([anterior]);
    if (borrarErr) {
      // La foto nueva ya quedó guardada; el archivo viejo solo queda huérfano.
      console.error("cambiarFotoPerfilAction borrar anterior:", borrarErr.name, borrarErr.message);
    }
  }

  // 4. Revalidar
  revalidarPerfil(actual?.public_id);
  return { success: true, avatarUrl: ruta };
}

/** Quita la foto: deja `avatar_url` en null (vuelven las iniciales) y borra el archivo propio. */
export async function quitarFotoPerfilAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo." };
  }

  const { data: actual, error: leerErr } = await supabase
    .from("profiles")
    .select("avatar_url, public_id")
    .eq("id", user.id)
    .single();

  if (leerErr) {
    console.error("quitarFotoPerfilAction leer perfil:", leerErr.code, leerErr.message);
    return { success: false, error: `No pudimos leer tu perfil: ${leerErr.message}` };
  }

  const { error: guardarErr } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (guardarErr) {
    console.error("quitarFotoPerfilAction guardar:", guardarErr.code, guardarErr.message);
    return { success: false, error: `No pudimos quitar la foto: ${guardarErr.message}` };
  }

  const anterior = rutaDeAvatarPropio(actual?.avatar_url);
  if (anterior && anterior.startsWith(`${user.id}/`)) {
    const { error: borrarErr } = await supabase.storage.from(BUCKET_AVATARES).remove([anterior]);
    if (borrarErr) {
      console.error("quitarFotoPerfilAction borrar archivo:", borrarErr.name, borrarErr.message);
    }
  }

  revalidarPerfil(actual?.public_id);
  return { success: true };
}
