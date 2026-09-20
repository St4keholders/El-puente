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

    if (!res.ok) return null;
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 2 * 1024 * 1024) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) return null;

    const buffer = Buffer.from(arrayBuffer);
    const storagePath = `${uid}/avatar.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatares")
      .upload(storagePath, buffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading avatar to storage:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatares")
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl || null;
    if (publicUrl) {
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", uid);
    }

    return publicUrl;
  } catch (err) {
    console.error("Error copying Google avatar:", err);
    return null;
  }
}

/**
 * Marca la cookie puente-bienvenida (Sección 1.5).
 */
export async function setOnboardingCompletedCookie() {
  const cookieStore = await cookies();
  cookieStore.set("puente-bienvenida", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60, // 1 año
    path: "/",
  });
}

/**
 * Borra la cookie puente-bienvenida al cerrar sesión (Sección 1.5).
 */
export async function clearOnboardingCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("puente-bienvenida");
}

/**
 * Cierra sesión completamente en el servidor, limpiando cookies de auth y onboarding.
 */
export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Error calling supabase.auth.signOut on server:", err);
  }

  const cookieStore = await cookies();
  cookieStore.delete("puente-bienvenida");

  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    if (c.name.startsWith("sb-") || c.name.includes("auth-token")) {
      cookieStore.delete(c.name);
    }
  }
}

/**
 * Elimina la cuenta y todos sus datos en cascada (Sección 5.6).
 */
export async function deleteUserAccount(confirmUsername: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "SIN_SESION" };
    }

    const uid = user.id;

    // Verificar nombre de usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .single();

    if (!profile || profile.username.toLowerCase() !== confirmUsername.trim().toLowerCase()) {
      return { success: false, error: "USUARIO_NO_COINCIDE" };
    }

    const secretKey =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secretKey) {
      console.warn("SUPABASE_SECRET_KEY is missing. Using client delete where possible.");
      // Intentar borrado con el cliente autenticado si no hay service role key disponible
      await supabase.from("profiles").delete().eq("id", uid);
      await supabase.auth.signOut();
      await clearOnboardingCookie();
      return { success: true };
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
    await clearOnboardingCookie();

    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteUserAccount:", err);
    return { success: false, error: err.message || "Error al eliminar la cuenta" };
  }
}
