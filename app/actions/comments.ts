"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const COMMENTS_PAGE_SIZE = 10;

const COMMENT_SELECT = `
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
    public_id,
    avatar_url
  )
`;

type Thread = "causa" | "resultado";

/**
 * Comentarios raíz de una causa, del más reciente al más antiguo, de 10 en 10.
 * `antesDe` es el `created_at` del último comentario ya mostrado.
 * Se leen con la sesión del servidor: sin cuenta también se ven.
 */
export async function cargarComentariosAction(causeId: string, thread: Thread, antesDe?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("cause_id", causeId)
    .eq("thread", thread)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(COMMENTS_PAGE_SIZE + 1);

  if (antesDe) {
    query = query.lt("created_at", antesDe);
  }

  const { data, error } = await query;
  if (error) {
    console.error("cargarComentariosAction:", error.code, error.message);
    return { success: false as const, error: `No pudimos cargar los comentarios: ${error.message}` };
  }

  const rows = data || [];
  return {
    success: true as const,
    comments: rows.slice(0, COMMENTS_PAGE_SIZE),
    hasMore: rows.length > COMMENTS_PAGE_SIZE,
  };
}

/** Total de comentarios (raíz y respuestas) de la causa en ese hilo. */
export async function contarComentariosAction(causeId: string, thread: Thread) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("cause_id", causeId)
    .eq("thread", thread);

  if (error) {
    console.error("contarComentariosAction:", error.code, error.message);
    return { success: false as const, error: `No pudimos contar los comentarios: ${error.message}` };
  }
  return { success: true as const, count: count ?? 0 };
}

/** Respuestas de un comentario raíz, en orden cronológico. */
export async function cargarRespuestasAction(causeId: string, rootId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("cause_id", causeId)
    .eq("parent_id", rootId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("cargarRespuestasAction:", error.code, error.message);
    return { success: false as const, error: `No pudimos cargar las respuestas: ${error.message}` };
  }
  return { success: true as const, replies: data || [] };
}

export interface CreateCommentInput {
  causeId: string;
  body: string;
  parentId?: string | null;
  thread?: Thread;
}

export async function createCommentAction(data: CreateCommentInput) {
  const trimmed = (data.body || "").trim();
  if (!trimmed || trimmed.length > 1000) {
    return { success: false, error: "El comentario debe tener entre 1 y 1000 caracteres." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return {
      success: false,
      error: "Debes iniciar sesión para comentar.",
      redirect: `/entrar?next=/causa/${data.causeId}#comentarios`,
    };
  }

  const { data: perfil, error: perfilErr } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilErr) {
    console.error("createCommentAction perfil:", perfilErr.code, perfilErr.message);
    return { success: false, error: `No pudimos verificar tu perfil: ${perfilErr.message}` };
  }
  if (!perfil?.onboarding_completed_at) {
    return { success: false, error: "Completa tu registro para comentar.", redirect: "/bienvenida" };
  }

  // Un solo nivel: responder a una respuesta cuelga del comentario raíz.
  let parentId = data.parentId || null;
  if (parentId) {
    const { data: padre, error: padreErr } = await supabase
      .from("comments")
      .select("id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (padreErr) {
      console.error("createCommentAction padre:", padreErr.code, padreErr.message);
      return { success: false, error: `No encontramos el comentario al que respondes: ${padreErr.message}` };
    }
    if (!padre) {
      return { success: false, error: "El comentario al que respondes ya no existe." };
    }
    parentId = padre.parent_id || padre.id;
  }

  const { data: created, error } = await supabase
    .from("comments")
    .insert({
      cause_id: data.causeId,
      author_id: user.id,
      body: trimmed,
      parent_id: parentId,
      thread: data.thread || "causa",
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    console.error("createCommentAction insert:", error.code, error.message);
    if (error.code === "42501") {
      // RLS rechazó el insert: normalmente falta completar el registro.
      return { success: false, error: "Completa tu registro para comentar.", redirect: "/bienvenida" };
    }
    return { success: false, error: `No pudimos publicar el comentario: ${error.message}` };
  }

  revalidatePath(`/causa/${data.causeId}`);
  return { success: true, comment: created };
}

export async function editCommentAction(commentId: string, causeId: string, body: string) {
  const trimmed = (body || "").trim();
  if (!trimmed || trimmed.length > 1000) {
    return { success: false, error: "El comentario debe tener entre 1 y 1000 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ body: trimmed })
    .eq("id", commentId)
    .select("edited_at")
    .maybeSingle();

  if (error) {
    console.error("editCommentAction:", error.code, error.message);
    return { success: false, error: `No pudimos guardar el cambio: ${error.message}` };
  }
  if (!data) {
    return { success: false, error: "No puedes editar este comentario." };
  }

  revalidatePath(`/causa/${causeId}`);
  return { success: true, editedAt: data.edited_at };
}

export async function deleteCommentAction(commentId: string, causeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select("id");

  if (error) {
    console.error("deleteCommentAction:", error.code, error.message);
    return { success: false, error: `No pudimos eliminar el comentario: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { success: false, error: "No puedes eliminar este comentario." };
  }

  revalidatePath(`/causa/${causeId}`);
  return { success: true };
}
