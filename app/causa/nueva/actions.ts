"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CauseCategory = Database["public"]["Enums"]["cause_category"];
type CollectionType = Database["public"]["Enums"]["collection_type"];
type DonationMethodKind = Database["public"]["Enums"]["donation_method_kind"];

type Fallo = { success: false; error: string; code?: string };

/** Registra el error de Postgres/Storage completo y devuelve un mensaje legible. */
function fallo(contexto: string, err: { code?: string; message: string }, mensaje: string): Fallo {
  console.error(`[causa/nueva] ${contexto}:`, err.code, err.message);
  return { success: false, error: `${mensaje}: ${err.message}`, code: err.code };
}

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

type InitDraftResult =
  | { success: false; error?: string; code?: string; redirect?: string }
  | {
      success: true;
      redirect?: undefined;
      draft: Database["public"]["Tables"]["causes"]["Row"];
      supplies: Database["public"]["Tables"]["cause_supplies"]["Row"][];
      media: Database["public"]["Tables"]["cause_media"]["Row"][];
      methods: Database["public"]["Tables"]["donation_methods"]["Row"][];
      profileMethods: Database["public"]["Tables"]["profile_donation_methods"]["Row"][];
      prevMethods: Database["public"]["Tables"]["donation_methods"]["Row"][];
    };

export async function initDraftAction(params?: {
  draftParam?: string | null;
  defaultCountry?: string | null;
}): Promise<InitDraftResult> {
  const { supabase, user } = await sesion();

  if (!user) {
    return { success: false, redirect: "/entrar?next=/causa/nueva" };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, country_code")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return fallo("init perfil", profileErr, "No pudimos leer tu perfil");
  }
  if (!profile?.onboarding_completed_at) {
    return { success: false, redirect: "/bienvenida?next=/causa/nueva" };
  }

  let draft: Database["public"]["Tables"]["causes"]["Row"] | null = null;

  if (params?.draftParam) {
    const { data: specifiedCause, error } = await supabase
      .from("causes")
      .select("*")
      .eq("id", params.draftParam)
      .eq("author_id", user.id)
      .maybeSingle();
    if (error) return fallo("init borrador indicado", error, "No pudimos abrir el borrador");
    draft = specifiedCause;
  }

  if (!draft) {
    const { data: existingDrafts, error } = await supabase
      .from("causes")
      .select("*")
      .eq("author_id", user.id)
      .eq("status", "borrador")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) return fallo("init borradores", error, "No pudimos buscar tus borradores");
    draft = existingDrafts?.[0] ?? null;
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

    if (createError) return fallo("init crear borrador", createError, "No pudimos crear el borrador");
    draft = newDraft;
  }
  if (!draft) {
    return { success: false, error: "No pudimos crear el borrador." };
  }
  const draftId = draft.id;

  const [suppliesRes, mediaRes, methodsRes, pMethodsRes, prevMethodsRes] = await Promise.all([
    supabase.from("cause_supplies").select("*").eq("cause_id", draftId).order("position", { ascending: true }),
    supabase.from("cause_media").select("*").eq("cause_id", draftId).order("position", { ascending: true }),
    supabase.from("donation_methods").select("*").eq("cause_id", draftId).order("position", { ascending: true }),
    supabase.from("profile_donation_methods").select("*").eq("owner_id", user.id).order("position", { ascending: true }),
    supabase.from("donation_methods").select("*").eq("owner_id", user.id).neq("cause_id", draftId).limit(5),
  ]);

  for (const [nombre, res] of [
    ["insumos", suppliesRes],
    ["fotos", mediaRes],
    ["métodos", methodsRes],
    ["métodos del perfil", pMethodsRes],
    ["métodos anteriores", prevMethodsRes],
  ] as const) {
    if (res.error) return fallo(`init ${nombre}`, res.error, `No pudimos cargar ${nombre}`);
  }

  return {
    success: true,
    draft,
    supplies: suppliesRes.data || [],
    media: mediaRes.data || [],
    methods: methodsRes.data || [],
    profileMethods: pMethodsRes.data || [],
    prevMethods: prevMethodsRes.data || [],
  };
}

export interface DraftFields {
  title: string | null;
  category: CauseCategory;
  description: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  goal_amount: number | null;
  currency: string;
  collection_type: CollectionType;
  supplies_instructions: string | null;
}

/** Guarda los campos del borrador. Devuelve el error real de Postgres si falla. */
export async function guardarBorradorAction(
  causeId: string,
  fields: DraftFields
): Promise<{ success: true; savedAt: string } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };

  const goal =
    typeof fields.goal_amount === "number" && Number.isFinite(fields.goal_amount) && fields.goal_amount > 0
      ? fields.goal_amount
      : null;

  const { data, error } = await supabase
    .from("causes")
    .update({
      title: fields.title?.trim() || null,
      category: fields.category,
      description: fields.description?.trim() || null,
      country_code: fields.country_code || null,
      city: fields.city?.trim() || null,
      region: fields.region?.trim() || null,
      lat: fields.lat,
      lng: fields.lng,
      goal_amount: goal,
      currency: fields.currency,
      collection_type: fields.collection_type,
      supplies_instructions: fields.supplies_instructions?.trim() || null,
    })
    .eq("id", causeId)
    .eq("author_id", user.id)
    .select("updated_at")
    .maybeSingle();

  if (error) return fallo("guardar borrador", error, "No se pudo guardar el borrador");
  if (!data) {
    return { success: false, error: "No encontramos este borrador o no es tuyo.", code: "SIN_FILA" };
  }
  return { success: true, savedAt: data.updated_at };
}

export interface SupplyInput {
  id?: string;
  name: string;
  unit: string;
  quantity_needed: number | null;
}

/** Sincroniza la lista de insumos con la base. Devuelve los ids en el mismo orden. */
export async function guardarInsumosAction(
  causeId: string,
  supplies: SupplyInput[]
): Promise<{ success: true; ids: string[] } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };

  const ids: string[] = [];
  for (const [idx, item] of supplies.entries()) {
    const payload = {
      name: item.name.trim(),
      unit: item.unit.trim() || null,
      quantity_needed: item.quantity_needed,
      position: idx,
    };
    if (item.id) {
      const { error } = await supabase
        .from("cause_supplies")
        .update(payload)
        .eq("id", item.id)
        .eq("cause_id", causeId);
      if (error) return fallo("actualizar insumo", error, `No se pudo guardar el insumo "${payload.name}"`);
      ids.push(item.id);
    } else {
      const { data, error } = await supabase
        .from("cause_supplies")
        .insert({ ...payload, cause_id: causeId, owner_id: user.id })
        .select("id")
        .single();
      if (error) return fallo("crear insumo", error, `No se pudo guardar el insumo "${payload.name}"`);
      ids.push(data.id);
    }
  }
  return { success: true, ids };
}

export async function eliminarInsumoAction(supplyId: string): Promise<{ success: true } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };
  const { error } = await supabase.from("cause_supplies").delete().eq("id", supplyId).eq("owner_id", user.id);
  if (error) return fallo("eliminar insumo", error, "No se pudo eliminar el insumo");
  return { success: true };
}

export interface MethodInput {
  kind: DonationMethodKind;
  provider: string;
  account_holder: string;
  account_value: string;
  details: string | null;
  profile_method_id: string | null;
}

export async function agregarMetodoAction(
  causeId: string,
  method: MethodInput,
  position: number,
  guardarEnPerfil: boolean
) {
  const { supabase, user } = await sesion();
  if (!user) return { success: false as const, error: "Tu sesión expiró. Inicia sesión de nuevo." };

  let profileMethodId = method.profile_method_id;
  let profileMethod: Database["public"]["Tables"]["profile_donation_methods"]["Row"] | null = null;

  if (guardarEnPerfil && !profileMethodId) {
    const { count, error: countErr } = await supabase
      .from("profile_donation_methods")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if (countErr) return fallo("contar métodos del perfil", countErr, "No se pudo guardar el método en tu perfil");

    const { data, error } = await supabase
      .from("profile_donation_methods")
      .insert({
        owner_id: user.id,
        kind: method.kind,
        provider: method.provider,
        account_holder: method.account_holder,
        account_value: method.account_value,
        details: method.details,
        position: count ?? 0,
      })
      .select()
      .single();
    if (error) return fallo("guardar método en perfil", error, "No se pudo guardar el método en tu perfil");
    profileMethod = data;
    profileMethodId = data.id;
  }

  const { data: created, error } = await supabase
    .from("donation_methods")
    .insert({
      cause_id: causeId,
      owner_id: user.id,
      kind: method.kind,
      provider: method.provider,
      account_holder: method.account_holder,
      account_value: method.account_value,
      details: method.details,
      position,
      profile_method_id: profileMethodId,
    })
    .select()
    .single();

  if (error) return fallo("agregar método", error, "No se pudo guardar el método de donación");
  return { success: true as const, method: created, profileMethod };
}

export async function quitarMetodoAction(methodId: string): Promise<{ success: true } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };
  const { error } = await supabase.from("donation_methods").delete().eq("id", methodId).eq("owner_id", user.id);
  if (error) return fallo("quitar método", error, "No se pudo quitar el método");
  return { success: true };
}

export async function reordenarMediosAction(
  causeId: string,
  orden: string[]
): Promise<{ success: true } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };
  for (const [position, id] of orden.entries()) {
    const { error } = await supabase
      .from("cause_media")
      .update({ position })
      .eq("id", id)
      .eq("cause_id", causeId)
      .eq("owner_id", user.id);
    if (error) return fallo("reordenar fotos", error, "No se pudo guardar el nuevo orden");
  }
  return { success: true };
}

export async function guardarTelefonoAction(phoneE164: string): Promise<{ success: true } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };
  if (!/^\+[1-9][0-9]{7,14}$/.test(phoneE164)) {
    return { success: false, error: "Escribe un número de teléfono válido.", code: "REQ_TELEFONO" };
  }
  const { error } = await supabase
    .from("profile_private")
    .upsert({ id: user.id, phone: phoneE164 }, { onConflict: "id" });
  if (error) return fallo("guardar teléfono", error, "No se pudo guardar el teléfono");
  return { success: true };
}

/** Publica la causa. El trigger de la base valida los requisitos y lanza REQ_*. */
export async function publicarCausaAction(causeId: string): Promise<{ success: true } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };

  const { data, error } = await supabase
    .from("causes")
    .update({ status: "activa" })
    .eq("id", causeId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[causa/nueva] publicar:", error.code, error.message);
    const req = error.message.match(/REQ_[A-Z_]+/)?.[0];
    return { success: false, error: error.message, code: req || error.code };
  }
  if (!data) {
    return { success: false, error: "No encontramos este borrador o no es tuyo.", code: "SIN_FILA" };
  }
  return { success: true };
}

export async function uploadCauseMediaAction(formData: FormData): Promise<{
  success: boolean;
  mediaItem?: Database["public"]["Tables"]["cause_media"]["Row"];
  error?: string;
}> {
  const { supabase, user } = await sesion();
  if (!user) {
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
  const { data: cause, error: causeErr } = await supabase
    .from("causes")
    .select("id, author_id")
    .eq("id", causeId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (causeErr) return fallo("subir foto: verificar causa", causeErr, "No pudimos verificar la causa");
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

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: file.type || (isVideo ? "video/mp4" : "image/webp"),
      upsert: false,
    });

  if (uploadErr) {
    console.error("[causa/nueva] storage upload:", uploadErr.name, uploadErr.message);
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
    console.error("[causa/nueva] cause_media insert:", dbErr.code, dbErr.message);
    const { error: cleanErr } = await supabase.storage.from(bucket).remove([storagePath]);
    if (cleanErr) console.error("[causa/nueva] limpiar archivo:", cleanErr.name, cleanErr.message);
    return { success: false, error: `Error en base de datos: ${dbErr.message}` };
  }

  return { success: true, mediaItem: dbItem };
}

export async function deleteCauseMediaAction(mediaId: string): Promise<{ success: true } | Fallo> {
  const { supabase, user } = await sesion();
  if (!user) return { success: false, error: "Tu sesión expiró. Inicia sesión de nuevo.", code: "SIN_SESION" };

  const { data: item, error: readErr } = await supabase
    .from("cause_media")
    .select("id, storage_path, bucket, owner_id")
    .eq("id", mediaId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (readErr) return fallo("eliminar foto: leer", readErr, "No se pudo eliminar el archivo");
  if (!item) return { success: true };

  const { error: dbErr } = await supabase.from("cause_media").delete().eq("id", mediaId).eq("owner_id", user.id);
  if (dbErr) return fallo("eliminar foto: fila", dbErr, "No se pudo eliminar el archivo");

  const { error: stErr } = await supabase.storage.from(item.bucket).remove([item.storage_path]);
  if (stErr) {
    // La fila ya no existe; el archivo queda huérfano pero no afecta a la causa.
    console.error("[causa/nueva] eliminar foto: storage:", stErr.name, stErr.message);
  }
  return { success: true };
}
