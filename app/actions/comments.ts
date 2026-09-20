"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateCommentInput {
  causeId: string;
  body: string;
  parentId?: string | null;
  thread?: "causa" | "resultado";
}

export async function createCommentAction(data: CreateCommentInput) {
  const trimmed = (data.body || "").trim();
  if (!trimmed || trimmed.length > 1000) {
    return { success: false, error: "El comentario debe tener entre 1 y 1000 caracteres." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Debes iniciar sesión para comentar." };
    }

    const { data: created, error } = await supabase
      .from("comments")
      .insert({
        cause_id: data.causeId,
        author_id: user.id,
        body: trimmed,
        parent_id: data.parentId || null,
        thread: data.thread || "causa",
      })
      .select(
        `
        id,
        cause_id,
        parent_id,
        body,
        created_at,
        edited_at,
        author_id,
        replies_count,
        author:profiles!comments_author_id_fkey(
          id,
          full_name,
          username,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating comment:", error);
      return { success: false, error: error.message || "Error al publicar el comentario." };
    }

    revalidatePath(`/causa/${data.causeId}`);
    return { success: true, comment: created };
  } catch (err: any) {
    console.error("Fatal creating comment:", err);
    return { success: false, error: err?.message || "Error inesperado al publicar." };
  }
}

export async function deleteCommentAction(commentId: string, causeId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) throw error;

    revalidatePath(`/causa/${causeId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error deleting comment:", err);
    return { success: false, error: err?.message || "Error al eliminar." };
  }
}
