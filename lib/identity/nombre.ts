/**
 * Nombre que se muestra en público después de verificar la identidad:
 * nombres completos + inicial del primer apellido ("Juan Andrés V.").
 * El nombre legal completo queda guardado aparte y solo lo ve la persona dueña.
 */

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "das", "do", "dos", "van", "von"]);

function limpiar(texto: string | null | undefined): string {
  return (texto || "").normalize("NFC").replace(/\s+/g, " ").trim();
}

/** "JUAN ANDRÉS DE LA CRUZ" → "Juan Andrés de la Cruz" */
export function enFormaTitulo(texto: string | null | undefined): string {
  return limpiar(texto)
    .toLocaleLowerCase("es")
    .split(" ")
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra;
      return palabra
        .split("-")
        .map((parte) => parte.charAt(0).toLocaleUpperCase("es") + parte.slice(1))
        .join("-");
    })
    .join(" ");
}

function inicialDelApellido(apellidos: string): string {
  const palabra = limpiar(apellidos)
    .split(" ")
    .find((p) => p && !PARTICULAS.has(p.toLocaleLowerCase("es")));
  return palabra ? `${palabra.charAt(0).toLocaleUpperCase("es")}.` : "";
}

/**
 * Sin nombres y apellidos por separado, reparte el nombre completo:
 * 4 o más palabras → 2 nombres; 2 o 3 palabras → 1 nombre. El resto son apellidos.
 */
export function repartirNombre(nombreCompleto: string | null | undefined): { nombres: string; apellidos: string } {
  const partes = limpiar(nombreCompleto).split(" ").filter(Boolean);
  if (partes.length < 2) return { nombres: partes[0] || "", apellidos: "" };
  const corte = partes.length >= 4 ? 2 : 1;
  return { nombres: partes.slice(0, corte).join(" "), apellidos: partes.slice(corte).join(" ") };
}

export function nombrePublico(params: {
  nombres?: string | null;
  apellidos?: string | null;
  nombreCompleto?: string | null;
}): string | null {
  let nombres = limpiar(params.nombres);
  let apellidos = limpiar(params.apellidos);

  if (!nombres || !apellidos) {
    ({ nombres, apellidos } = repartirNombre(params.nombreCompleto));
    if (!nombres) return null;
  }

  const inicial = inicialDelApellido(apellidos);
  return [enFormaTitulo(nombres), inicial].filter(Boolean).join(" ").slice(0, 80);
}

/** Últimos 4 caracteres del documento, sin espacios ni guiones. Nunca se guarda el resto. */
export function ultimosCuatro(numero: string | null | undefined): string | null {
  const limpio = (numero || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return limpio ? limpio.slice(-4) : null;
}
