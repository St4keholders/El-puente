import { IconoAlerta, IconoCheckCirculo } from "@/components/iconos";

/**
 * Etiqueta para cuentas de empresa: "Empresa verificada" o "Empresa sin verificar".
 * La persona que responde sí tiene la identidad verificada; esto habla solo de la empresa.
 */
export function InsigniaEmpresa({
  verificada,
  className = "",
}: {
  verificada?: boolean | null;
  className?: string;
}) {
  return verificada ? (
    <span
      title="Puente confirmó que esta empresa está constituida"
      className={`inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 border border-sky-500/20 whitespace-nowrap ${className}`}
    >
      <IconoCheckCirculo size={11} />
      Empresa verificada
    </span>
  ) : (
    <span
      title="La persona que responde está verificada; la empresa aún no"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap ${className}`}
    >
      <IconoAlerta size={11} />
      Empresa sin verificar
    </span>
  );
}
