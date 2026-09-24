"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Resultado = { success: true } | { success: false; error: string; code?: string };

const MENSAJES: Record<string, string> = {
  SIN_SESION: "Tu sesión expiró. Inicia sesión de nuevo.",
  CAUSA_NO_ENCONTRADA: "No encontramos esta causa entre las tuyas, o ya no está activa ni cerrada.",
  MONTO_INVALIDO: "El monto debe ser un número mayor o igual a 0.",
  LIMITE_AVISOS: "Ya enviaste 5 avisos a esta causa en las últimas 24 horas. Intenta más tarde.",
  AUTOAPOYO: "No puedes avisar un apoyo a tu propia causa.",
  CAUSA_NO_ACTIVA: "Esta causa ya no recibe apoyos.",
  TIPO_NO_ADMITIDO: "Esta causa no recibe ese tipo de apoyo.",
  ITEMS_INVALIDOS: "Elige al menos un insumo de la lista, con una cantidad mayor que 0.",
  NO_ES_TU_CAUSA: "Solo quien publicó la causa puede resolver este aviso.",
  AVISO_YA_RESUELTO: "Este aviso ya estaba resuelto.",
  AVISO_NO_ENCONTRADO: "Este aviso ya no existe.",
  AGRADECIMIENTO_LARGO: "El agradecimiento puede tener hasta 500 caracteres.",
};

function traducir(err: { code?: string; message: string }, contexto: string): Resultado {
  console.error(`[apoyos] ${contexto}:`, err.code, err.message);
  const codigo = err.message.match(/[A-Z][A-Z_]{3,}/)?.[0];
  if (codigo && MENSAJES[codigo]) return { success: false, error: MENSAJES[codigo], code: codigo };
  return { success: false, error: `No se pudo guardar: ${err.message}`, code: err.code };
}

/**
 * "Registrar apoyo recibido": la autora escribe el total recibido (no se suma) y las
 * cantidades recibidas de cada insumo. Corre en el servidor: el cliente de Supabase del
 * navegador podía quedarse esperando la sesión y dejar el botón en "Guardando…".
 */
export async function registrarApoyoAction(
  causeId: string,
  amount: number | null,
  supplies: Array<{ id: string; received: number }> | null
): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return { success: false, error: MENSAJES.SIN_SESION, code: "SIN_SESION" };

  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return { success: false, error: "El monto debe ser un número mayor o igual a 0." };
  }

  const { error } = await supabase.rpc("confirm_support", {
    p_cause_id: causeId,
    p_amount: amount ?? undefined,
    p_supplies: supplies ?? undefined,
  });
  if (error) return traducir(error, "confirm_support");

  revalidatePath(`/causa/${causeId}`);
  revalidatePath("/perfil/causas");
  return { success: true };
}

export interface AvisoInput {
  causeId: string;
  kind: "dinero" | "insumos";
  amount?: number | null;
  items?: Array<{ supply_id: string; quantity: number }> | null;
  message?: string | null;
  isAnonymous: boolean;
}

/** "Ya hice mi donación": queda como aviso pendiente, no público y sin sumar nada. */
export async function crearAvisoAction(
  data: AvisoInput
): Promise<Resultado | { success: false; error: string; redirect: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: MENSAJES.SIN_SESION, redirect: `/entrar?next=/causa/${data.causeId}` };
  }

  const { data: perfil, error: perfilErr } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (perfilErr) return traducir(perfilErr, "crear aviso: perfil");
  if (!perfil?.onboarding_completed_at) {
    return { success: false, error: "Completa tu registro para avisar un apoyo.", redirect: "/bienvenida" };
  }

  const message = data.message?.trim() || null;
  if (message && message.length > 500) {
    return { success: false, error: "El mensaje puede tener hasta 500 caracteres." };
  }
  if (data.kind === "dinero" && !(typeof data.amount === "number" && data.amount > 0)) {
    return { success: false, error: "Escribe el monto que enviaste." };
  }
  const items = (data.items || []).filter((i) => i.supply_id && i.quantity > 0);
  if (data.kind === "insumos" && items.length === 0) {
    return { success: false, error: MENSAJES.ITEMS_INVALIDOS, code: "ITEMS_INVALIDOS" };
  }

  const { error } = await supabase.from("support_reports").insert({
    cause_id: data.causeId,
    donor_id: user.id,
    kind: data.kind,
    amount: data.kind === "dinero" ? data.amount : null,
    items: data.kind === "insumos" ? items : null,
    message,
    is_anonymous: data.isAnonymous,
  });
  if (error) return traducir(error, "crear aviso");

  revalidatePath("/perfil/apoyos");
  return { success: true };
}

/** Quien avisó puede borrar su aviso mientras siga pendiente. */
export async function eliminarAvisoAction(reportId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_reports")
    .delete()
    .eq("id", reportId)
    .eq("status", "reportado")
    .select("id");
  if (error) return traducir(error, "eliminar aviso");
  if (!data || data.length === 0) {
    return { success: false, error: "Solo puedes borrar tus avisos mientras están pendientes." };
  }
  revalidatePath("/perfil/apoyos");
  return { success: true };
}

export async function confirmarAvisoAction(
  reportId: string,
  causeId: string,
  thanks: string | null
): Promise<Resultado> {
  const supabase = await createClient();
  const text = thanks?.trim() || null;
  if (text && text.length > 500) {
    return { success: false, error: MENSAJES.AGRADECIMIENTO_LARGO, code: "AGRADECIMIENTO_LARGO" };
  }
  const { error } = await supabase.rpc("confirmar_aviso", {
    p_report_id: reportId,
    p_thanks: text ?? undefined,
  });
  if (error) return traducir(error, "confirmar aviso");
  revalidatePath("/perfil/apoyos");
  revalidatePath(`/causa/${causeId}`);
  return { success: true };
}

export async function rechazarAvisoAction(reportId: string, causeId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_aviso", { p_report_id: reportId });
  if (error) return traducir(error, "rechazar aviso");
  revalidatePath("/perfil/apoyos");
  revalidatePath(`/causa/${causeId}`);
  return { success: true };
}
