import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente con la clave secreta de Supabase: salta RLS.
 * Solo para el servidor (webhook de Didit, sincronización de verificaciones).
 *
 * Nunca cae a la clave pública: si falta la secreta, falla con un error claro.
 * Antes caía a NEXT_PUBLIC_SUPABASE_ANON_KEY y todas las escrituras fallaban en silencio.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en el servidor.");
  }
  if (!secretKey) {
    throw new Error("Falta SUPABASE_SECRET_KEY en el servidor.");
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
