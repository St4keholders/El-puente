const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqqnzqcxurnpbkkahvl.supabase.co"
).replace(/\/$/, "");

/** Archivos propios de la app (no del almacenamiento): /ejemplo/… y /marca/… */
const RUTA_EJEMPLO = /^\/ejemplo\/[a-z0-9-]+\.(webp|jpg|png)$/;
const RUTA_MARCA = /^\/marca\/[a-z0-9-]+\.(webp|png|svg)$/;

/** Bucket donde viven las fotos de perfil: `{uid}/avatar-{timestamp}.webp`. */
export const BUCKET_AVATARES = "avatares";

/**
 * Retorna la URL pública de un medio almacenado en Supabase Storage.
 * Centraliza la construcción de URLs para no escribir dominios a mano
 * y facilitar migraciones futuras.
 */
export function urlDeMedio(bucket: string, storagePath: string | null | undefined): string {
  if (!storagePath) return "";
  // Solo URLs de nuestro propio almacenamiento (nada de imágenes externas puestas a mano)
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`) ? storagePath : "";
  }
  if (storagePath.startsWith("blob:") || storagePath.startsWith("data:")) {
    return storagePath;
  }
  // Fotos de la causa de ejemplo del tutorial: viven en /public/ejemplo de la app
  if (RUTA_EJEMPLO.test(storagePath)) {
    return storagePath;
  }
  // Rutas de ejemplo viejas/placeholders
  if (storagePath.startsWith("ejemplo/") || storagePath.startsWith("/")) {
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
  if (valor.startsWith("http")) {
    // Solo fotos de Google o de nuestro propio almacenamiento: nada de URLs puestas a mano.
    try {
      const url = new URL(valor);
      const permitido =
        url.protocol === "https:" &&
        (url.hostname.endsWith(".googleusercontent.com") || valor.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`));
      return permitido ? valor : null;
    } catch {
      return null;
    }
  }
  // Logo de cuentas oficiales (la base no deja que nadie más ponga rutas internas)
  if (valor.startsWith("/")) return RUTA_MARCA.test(valor) ? valor : null;
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
