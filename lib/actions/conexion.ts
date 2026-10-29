"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarConexion } from "@/lib/identity/ubicacion";

/**
 * La llama la app de vez en cuando mientras la persona navega, para ir sumando
 * las horas que lleva conectada desde el mismo país.
 */
export async function registrarConexionAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await registrarConexion(user.id);
}
