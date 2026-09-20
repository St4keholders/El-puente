"use server";

import { createClient } from "@/lib/supabase/server";

export async function initDraftAction(params?: {
  draftParam?: string | null;
  defaultCountry?: string | null;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, redirect: "/entrar?next=/causa/nueva" };
    }

    // Verificar si está onboarded
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at, country_code")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed_at) {
      return { success: false, redirect: "/bienvenida?next=/causa/nueva" };
    }

    let draft: any = null;

    if (params?.draftParam) {
      const { data: specifiedCause } = await supabase
        .from("causes")
        .select("*")
        .eq("id", params.draftParam)
        .eq("author_id", user.id)
        .maybeSingle();
      if (specifiedCause) {
        draft = specifiedCause;
      }
    }

    if (!draft) {
      const { data: existingDrafts } = await supabase
        .from("causes")
        .select("*")
        .eq("author_id", user.id)
        .eq("status", "borrador")
        .order("updated_at", { ascending: false })
        .limit(1);

      draft = existingDrafts && existingDrafts[0];
    }

    if (!draft) {
      const country = params?.defaultCountry || profile.country_code || "CO";
      const { data: newDraft, error: createError } = await supabase
        .from("causes")
        .insert({
          author_id: user.id,
          status: "borrador",
          country_code: country,
          category: "otra",
          currency: "USD",
        })
        .select()
        .single();

      if (createError) throw createError;
      draft = newDraft;
    }

    // Load supplies, media, donation methods and profile methods in parallel
    const [suppliesRes, mediaRes, methodsRes, pMethodsRes, prevMethodsRes] =
      await Promise.all([
        supabase
          .from("cause_supplies")
          .select("*")
          .eq("cause_id", draft.id)
          .order("position", { ascending: true }),
        supabase
          .from("cause_media")
          .select("*")
          .eq("cause_id", draft.id)
          .order("position", { ascending: true }),
        supabase
          .from("donation_methods")
          .select("*")
          .eq("cause_id", draft.id)
          .order("position", { ascending: true }),
        supabase
          .from("profile_donation_methods")
          .select("*")
          .eq("owner_id", user.id)
          .order("position", { ascending: true }),
        supabase
          .from("donation_methods")
          .select("*")
          .eq("owner_id", user.id)
          .neq("cause_id", draft.id)
          .limit(5),
      ]);

    return {
      success: true,
      draft,
      supplies: suppliesRes.data || [],
      media: mediaRes.data || [],
      methods: methodsRes.data || [],
      profileMethods: pMethodsRes.data || [],
      prevMethods: prevMethodsRes.data || [],
    };
  } catch (err: any) {
    console.error("Fatal in initDraftAction:", err);
    return {
      success: false,
      error: err?.message || "No pudimos inicializar el borrador.",
    };
  }
}

export async function uploadCauseMediaAction(formData: FormData): Promise<{
  success: boolean;
  mediaItem?: any;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Debes iniciar sesión para subir archivos." };
    }

    const causeId = formData.get("causeId") as string;
    const file = formData.get("file") as File;
    const kind = (formData.get("kind") as string) || "imagen";
    const position = parseInt((formData.get("position") as string) || "0", 10);
    const width = formData.get("width") ? parseInt(formData.get("width") as string, 10) : null;
    const height = formData.get("height") ? parseInt(formData.get("height") as string, 10) : null;

    if (!causeId || !file) {
      return { success: false, error: "Archivo o causa no válidos." };
    }

    // Verify cause ownership
    const { data: cause } = await supabase
      .from("causes")
      .select("id, author_id")
      .eq("id", causeId)
      .eq("author_id", user.id)
      .maybeSingle();

    if (!cause) {
      return { success: false, error: "No tienes permiso para editar esta causa." };
    }

    const isVideo = kind === "video";
    const bucket = isVideo ? "causas-videos" : "causas-imagenes";
    const fileUuid = crypto.randomUUID();
    const rawName = file.name || (isVideo ? "video.mp4" : "imagen.webp");
    const rawExt = rawName.includes(".") ? rawName.split(".").pop()?.toLowerCase() : null;
    const ext = rawExt || (isVideo ? "mp4" : "webp");
    const storagePath = `${user.id}/${causeId}/${fileUuid}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type || (isVideo ? "video/mp4" : "image/webp"),
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return { success: false, error: `Error de almacenamiento: ${uploadErr.message}` };
    }

    const { data: dbItem, error: dbErr } = await supabase
      .from("cause_media")
      .insert({
        cause_id: causeId,
        owner_id: user.id,
        storage_path: storagePath,
        bucket,
        kind: isVideo ? "video" : "imagen",
        phase: "causa",
        position,
        width,
        height,
        bytes: file.size,
      })
      .select()
      .single();

    if (dbErr) {
      console.error("DB insert error for media:", dbErr);
      await supabase.storage.from(bucket).remove([storagePath]);
      return { success: false, error: `Error en base de datos: ${dbErr.message}` };
    }

    return { success: true, mediaItem: dbItem };
  } catch (err: any) {
    console.error("Fatal in uploadCauseMediaAction:", err);
    return { success: false, error: err?.message || "Error al procesar el archivo." };
  }
}

export async function deleteCauseMediaAction(mediaId: string, causeId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "No autenticado" };
    }

    const { data: item } = await supabase
      .from("cause_media")
      .select("id, storage_path, bucket, owner_id")
      .eq("id", mediaId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!item) {
      return { success: true };
    }

    await supabase.storage.from(item.bucket).remove([item.storage_path]);
    await supabase.from("cause_media").delete().eq("id", mediaId).eq("owner_id", user.id);

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting media:", err);
    return { success: false, error: err?.message || "Error al eliminar archivo." };
  }
}
