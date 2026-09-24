const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqqnzqcxurnpbkkahvl.supabase.co"
).replace(/\/$/, "");

/** Bucket donde viven las fotos de perfil: `{uid}/avatar-{timestamp}.webp`. */
export const BUCKET_AVATARES = "avatares";

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

  const cleanPath = storagePath.replace(/^\//, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Única función para armar la URL de una foto de perfil (`profiles.avatar_url`).
 * - Si el valor empieza por `http`, es la foto de Google: se devuelve tal cual.
 * - Si no, es una ruta del bucket `avatares` y se arma su URL pública.
 * Devuelve `null` cuando no hay foto, para mostrar las iniciales.
 */
export function urlDeAvatar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (valor.startsWith("http")) return valor;
  return urlDeMedio(BUCKET_AVATARES, valor) || null;
}

/**
 * Si `avatar_url` apunta a un archivo propio del bucket `avatares`, devuelve su
 * ruta dentro del bucket (para poder borrarlo). Acepta tanto rutas guardadas
 * como URLs públicas antiguas del mismo bucket. Para fotos externas devuelve null.
 */
export function rutaDeAvatarPropio(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const prefijo = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_AVATARES}/`;
  if (valor.startsWith(prefijo)) return valor.slice(prefijo.length).split("?")[0];
  if (valor.startsWith("http")) return null;
  return valor.replace(/^\//, "");
}
