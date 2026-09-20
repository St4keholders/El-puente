"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

    // Sanitize country code (must match ^[A-Z]{2}$ or null)
    let cleanCountry: string | null = null;
    if (data.countryCode && /^[a-zA-Z]{2}$/.test(data.countryCode.trim())) {
      cleanCountry = data.countryCode.trim().toUpperCase();
    }

    // 1. Actualizar profiles
    const profileUpdate: Record<string, any> = {
      full_name: cleanName,
      bio: data.bio ? data.bio.trim() : null,
      country_code: cleanCountry,
      city: data.city ? data.city.trim() : null,
      updated_at: new Date().toISOString(),
    };

    if (data.avatarUrl !== undefined) {
      profileUpdate.avatar_url = data.avatarUrl;
    }

    const { data: updatedProfile, error: profErr } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id)
      .select("username")
      .single();

    if (profErr) {
      console.error("Error updating profile:", profErr);
      return { success: false, error: profErr.message || "No pudimos guardar tu perfil." };
    }

    // 2. Actualizar o crear profile_private si se proporcionó teléfono
    if (data.phone !== undefined) {
      let cleanPhone: string | null = null;
      if (data.phone && /^\+[1-9][0-9]{7,14}$/.test(data.phone.trim())) {
        cleanPhone = data.phone.trim();
      }

      const { error: privErr } = await supabase
        .from("profile_private")
        .upsert(
          {
            id: user.id,
            phone: cleanPhone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (privErr) {
        console.error("Error updating profile_private:", privErr);
        return { success: false, error: "No pudimos guardar tu teléfono." };
      }
    }

    revalidatePath("/perfil");
    revalidatePath("/perfil/cuenta");
    if (updatedProfile?.username) {
      revalidatePath(`/u/${updatedProfile.username}`);
    }
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Fatal in updateProfileAction:", err);
    return { success: false, error: "Error inesperado al guardar." };
  }
}
