"use server";

import { createClient } from "@/lib/supabase/server";

export interface UpdateProfileInput {
  fullName: string;
  bio?: string | null;
  countryCode?: string | null;
  city?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export async function updateProfileAction(data: UpdateProfileInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "SIN_SESION" };
    }

    const cleanName = (data.fullName || "").trim();
    if (cleanName.length < 2) {
      return { success: false, error: "El nombre completo debe tener al menos 2 caracteres." };
    }

    // 1. Actualizar profiles
    const profileUpdate: Record<string, any> = {
      full_name: cleanName,
      bio: data.bio ? data.bio.trim() : null,
      country_code: data.countryCode || null,
      city: data.city ? data.city.trim() : null,
      updated_at: new Date().toISOString(),
    };

    if (data.avatarUrl !== undefined) {
      profileUpdate.avatar_url = data.avatarUrl;
    }

    const { error: profErr } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (profErr) {
      console.error("Error updating profile:", profErr);
      return { success: false, error: "No pudimos guardar tu perfil." };
    }

    // 2. Actualizar o crear profile_private (on conflict do update / nothing)
    if (data.phone !== undefined) {
      const { error: privErr } = await supabase
        .from("profile_private")
        .upsert(
          {
            id: user.id,
            phone: data.phone ? data.phone.trim() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (privErr) {
        console.error("Error updating profile_private:", privErr);
        return { success: false, error: "No pudimos guardar tu teléfono." };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Fatal in updateProfileAction:", err);
    return { success: false, error: "Error inesperado al guardar." };
  }
}
