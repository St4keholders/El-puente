"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleFollowAction(
  targetUserId: string
): Promise<{ success: boolean; isFollowing?: boolean; error?: string }> {
  if (!targetUserId) {
    return { success: false, error: "Usuario inválido" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "SIN_SESION" };
    }

    if (user.id === targetUserId) {
      return { success: false, error: "No puedes seguirte a ti mismo" };
    }

    // Check existing follow
    const { data: existing } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    // ID público de la persona para revalidar su perfil
    const { data: targetProf } = await supabase
      .from("profiles")
      .select("public_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (existing) {
      // Unfollow
      const { error: delErr } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);

      if (delErr) throw delErr;
      if (targetProf?.public_id) {
        revalidatePath(`/u/${targetProf.public_id}`);
      }
      revalidatePath("/explorar");
      revalidatePath("/");
      return { success: true, isFollowing: false };
    } else {
      // Follow
      const { error: insErr } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetUserId,
      });

      if (insErr) throw insErr;
      if (targetProf?.public_id) {
        revalidatePath(`/u/${targetProf.public_id}`);
      }
      revalidatePath("/explorar");
      revalidatePath("/");
      return { success: true, isFollowing: true };
    }
  } catch (err: any) {
    console.error("Error in toggleFollowAction:", err);
    return { success: false, error: err?.message || "Error al actualizar seguimiento" };
  }
}
