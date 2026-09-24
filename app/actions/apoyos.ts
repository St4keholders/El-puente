"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Resultado = { success: true } | { success: false; error: string; code?: string };

const MENSAJES: Record<string, string> = {
  SIN_SESION: "Tu sesión expiró. Inicia sesión de nuevo.",
  CAUSA_NO_ENCONTRADA: "No encontramos esta causa entre las tuyas, o ya no está activa ni cerrada.",
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
