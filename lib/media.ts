import { createClient } from "@/lib/supabase/client";

/**
 * Retorna la URL pública de un medio almacenado en Supabase Storage.
 * Centraliza la construcción de URLs para no escribir dominios a mano
 * y facilitar migraciones futuras.
 */
export function urlDeMedio(bucket: string, storagePath: string | null | undefined): string {
  if (!storagePath) return "";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  if (storagePath.startsWith("blob:") || storagePath.startsWith("data:")) {
    return storagePath;
  }
  // Rutas de ejemplo locales/placeholders
  if (storagePath.startsWith("ejemplo/")) {
    return "";
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const cleanBase = supabaseUrl.replace(/\/$/, "");
  const cleanPath = storagePath.replace(/^\//, "");
  return `${cleanBase}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Consulta la suma de bytes consumidos por un usuario en sus medios.
 * Límite máximo: 60 MB (62,914,560 bytes).
 */
export const MAX_USER_STORAGE_BYTES = 60 * 1024 * 1024; // 60 MB

export async function getUserStorageUsage(userId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cause_media")
    .select("bytes")
    .eq("owner_id", userId);

  if (error || !data) return 0;
  return data.reduce((acc, row) => acc + (row.bytes || 0), 0);
}
