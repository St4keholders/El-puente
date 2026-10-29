import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { getCountryName } from "./countries";

export interface PaisTelefono {
  code: CountryCode;
  name: string;
  dial: string;
}

/** Países que más usan Puente: van primero en la lista. */
const PRIMERO: CountryCode[] = ["CO", "MX", "AR", "CL", "PE", "EC", "VE", "ES", "US", "PA", "CR", "DO", "GT", "BO", "UY", "PY"];

let cache: PaisTelefono[] | null = null;

/** Todos los países con su indicativo, con nombres en español. */
export function paisesTelefono(): PaisTelefono[] {
  if (cache) return cache;
  // Nombres de mundo.json (los mismos en servidor y navegador, así no hay diferencias al hidratar)
  const todos = getCountries().map((code) => ({
    code,
    name: getCountryName(code) || code,
    dial: `+${getCountryCallingCode(code)}`,
  }));
  const primeros = PRIMERO.map((c) => todos.find((t) => t.code === c)).filter((x): x is PaisTelefono => Boolean(x));
  const resto = todos
    .filter((t) => !PRIMERO.includes(t.code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  cache = [...primeros, ...resto];
  return cache;
}

/** Devuelve el código si libphonenumber lo conoce; si no, el de respaldo. */
export function paisTelefonoValido(code: string | null | undefined, respaldo: CountryCode = "CO"): CountryCode {
  const c = (code || "").toUpperCase();
  return (getCountries() as string[]).includes(c) ? (c as CountryCode) : respaldo;
}
