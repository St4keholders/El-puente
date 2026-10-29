/**
 * Solo permite volver a rutas internas de Puente ("/perfil", "/causa/nueva?…").
 * Bloquea "//otro.com", "/\otro.com", "https://…", "javascript:…" y caracteres de control,
 * que permitirían mandar a la persona a un sitio falso después de iniciar sesión.
 */
export function destinoSeguro(valor: string | null | undefined, defecto = "/"): string {
  const n = (valor || "").trim();
  if (!n.startsWith("/") || n.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(n)) return defecto;
  try {
    const base = "https://puente.local";
    const url = new URL(n, base);
    if (url.origin !== base) return defecto;
    return url.pathname + url.search + url.hash;
  } catch {
    return defecto;
  }
}
