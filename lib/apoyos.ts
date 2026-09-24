import type { Json } from "@/lib/database.types";

export type EstadoAviso = "reportado" | "confirmado" | "no_recibido";

export interface InsumoRef {
  id: string;
  name: string;
  unit?: string | null;
}

/** Items de un aviso de insumos: [{ supply_id, quantity }]. */
export function itemsDeAviso(items: Json | null | undefined): Array<{ supply_id: string; quantity: number }> {
  if (!Array.isArray(items)) return [];
  return items
    .map((it: any) => ({ supply_id: String(it?.supply_id ?? ""), quantity: Number(it?.quantity ?? 0) }))
    .filter((it) => it.supply_id && it.quantity > 0);
}

/** Texto de lo que aportó: "USD 50" o "5 unidades de Colchonetas, 2 Mercados". */
export function describirApoyo(
  aviso: { kind: "dinero" | "insumos"; amount: number | null; currency: string; items: Json | null },
  insumos: InsumoRef[]
): string {
  if (aviso.kind === "dinero") {
    return `${aviso.currency} ${Number(aviso.amount || 0).toLocaleString()}`;
  }
  const porId = new Map(insumos.map((s) => [s.id, s]));
  return itemsDeAviso(aviso.items)
    .map((it) => {
      const s = porId.get(it.supply_id);
      const nombre = s?.name || "insumo";
      return s?.unit ? `${it.quantity} ${s.unit} de ${nombre}` : `${it.quantity} ${nombre}`;
    })
    .join(", ");
}

export const ETIQUETA_ESTADO: Record<EstadoAviso, string> = {
  reportado: "Pendiente",
  confirmado: "Confirmado",
  no_recibido: "No recibido",
};

/** Mismas pastillas de estado que ya usa el perfil (verde, ámbar, gris). */
export const CLASE_ESTADO: Record<EstadoAviso, string> = {
  reportado: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
  confirmado: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  no_recibido: "bg-[var(--hover)] text-[var(--ink-3)] border border-[var(--line)]",
};
