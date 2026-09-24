"use server";

import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Copia la foto de Google de forma segura al almacenamiento propio en el bucket `avatares` (Sección 7).
 * Restricciones de seguridad:
 * - Solo URLs HTTPS.
 * - Solo dominio googleusercontent.com.
 * - Máximo 2 MB.
 */
export async function copyGoogleAvatarToStorage(googleAvatarUrl?: string | null): Promise<string | null> {
  if (!googleAvatarUrl) return null;

  try {
    const parsed = new URL(googleAvatarUrl);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname.endsWith(".googleusercontent.com")) return null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
    const uid = user.id;

    const res = await fetch(googleAvatarUrl, {
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Error downloading Google avatar:", res.status, res.statusText);
      return null;
    }
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 2 * 1024 * 1024) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) return null;

    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const storagePath = `${uid}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatares")
      .upload(storagePath, buffer, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading avatar to storage:", uploadError);
      return null;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: storagePath })
      .eq("id", uid);

    if (updateError) {
      console.error("Error saving copied avatar:", updateError.code, updateError.message);
      return null;
    }

    return storagePath;
  } catch (err: any) {
    console.error("Error copying Google avatar:", err?.code, err?.message);
    return null;
  }
}

/**
 * Cierra sesión completamente en el servidor, limpiando cookies de auth.
 */
export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Error calling supabase.auth.signOut on server:", err);
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    if (
      c.name.startsWith("sb-") ||
      c.name.includes("auth-token") ||
      c.name.includes("supabase") ||
      c.name.startsWith("puente")
    ) {
      try {
        cookieStore.set(c.name, "", { path: "/", maxAge: 0, expires: new Date(0) });
        cookieStore.delete(c.name);
      } catch (err: any) {
        console.error("signOutAction cookie:", c.name, err?.message);
      }
    }
  }
}

/**
 * Elimina la cuenta y todos sus datos en cascada (Sección 5.6).
 */
export async function deleteUserAccount(confirmPublicId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "SIN_SESION" };
    }

    const uid = user.id;

    // Verificar ID público
    const { data: profile } = await supabase
      .from("profiles")
      .select("public_id")
      .eq("id", uid)
      .single();

    if (!profile || profile.public_id.toUpperCase() !== confirmPublicId.trim().toUpperCase()) {
      return { success: false, error: "El ID público escrito no coincide." };
    }

    const secretKey =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secretKey) {
      console.error("deleteUserAccount: falta SUPABASE_SECRET_KEY en el servidor");
      return {
        success: false,
        error: "No podemos eliminar la cuenta en este momento: falta configurar el servidor.",
      };
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      secretKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Borrar archivos en buckets
    const buckets = ["avatares", "causas-imagenes", "causas-videos"];
    for (const b of buckets) {
      try {
        const { data: files } = await admin.storage.from(b).list(uid);
        if (files && files.length > 0) {
          await admin.storage
            .from(b)
            .remove(files.map((f) => `${uid}/${f.name}`));
        }
      } catch (err) {
        console.warn(`Error deleting files in bucket ${b}:`, err);
      }
    }

    // Borrar auth user (cascada borra perfil y tablas relacionadas)
    const { error: delUserError } = await admin.auth.admin.deleteUser(uid);
    if (delUserError) {
      console.error("Error deleting auth user:", delUserError);
      return { success: false, error: delUserError.message };
    }

    // Cerrar sesión y limpiar cookies
    await supabase.auth.signOut();
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteUserAccount:", err);
    return { success: false, error: err.message || "Error al eliminar la cuenta" };
  }
}
