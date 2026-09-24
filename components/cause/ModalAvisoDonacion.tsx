"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { crearAvisoAction } from "@/app/actions/apoyos";
import { IconoX, IconoCargando, IconoCheckCirculo, IconoAlerta, IconoInfo } from "@/components/iconos";

interface ModalAvisoDonacionProps {
  isOpen: boolean;
  onClose: () => void;
  causeId: string;
  collectionType: "dinero" | "insumos" | "ambas";
  currency: string;
  supplies: Array<{ id: string; name: string; unit?: string | null }>;
}

/**
 * "Ya hice mi donación": quien donó avisa lo que envió. Queda pendiente hasta que
 * quien publicó lo confirme; mientras tanto no es público ni suma nada.
 */
export function ModalAvisoDonacion({
  isOpen,
  onClose,
  causeId,
  collectionType,
  currency,
  supplies,
}: ModalAvisoDonacionProps) {
  const router = useRouter();
  const includesMoney = collectionType === "dinero" || collectionType === "ambas";
  const includesSupplies = (collectionType === "insumos" || collectionType === "ambas") && supplies.length > 0;

  const [kind, setKind] = useState<"dinero" | "insumos">(includesMoney ? "dinero" : "insumos");
  const [amount, setAmount] = useState<number | "">("");
  const [quantities, setQuantities] = useState<Record<string, number | "">>({});
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKind(includesMoney ? "dinero" : "insumos");
      setAmount("");
      setQuantities({});
      setMessage("");
      setIsAnonymous(false);
      setErrorMsg(null);
      setSent(false);
    }
  }, [isOpen, includesMoney]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (kind === "dinero" && !(typeof amount === "number" && amount > 0)) {
      setErrorMsg("Escribe el monto que enviaste.");
      return;
    }
    const items = Object.entries(quantities)
      .filter(([, q]) => typeof q === "number" && q > 0)
      .map(([supply_id, q]) => ({ supply_id, quantity: q as number }));
    if (kind === "insumos" && items.length === 0) {
      setErrorMsg("Indica al menos un insumo que entregaste y su cantidad.");
      return;
    }

    setSaving(true);
    try {
      const res = await crearAvisoAction({
        causeId,
        kind,
        amount: kind === "dinero" ? (amount as number) : null,
        items: kind === "insumos" ? items : null,
        message: message.trim() || null,
        isAnonymous,
      });
      if (!res.success) {
        setErrorMsg(res.error);
        if ("redirect" in res && res.redirect) router.push(res.redirect);
        return;
      }
      setSent(true);
    } catch (err: any) {
      console.error("Error enviando aviso de donación:", err?.code, err?.message);
      setErrorMsg(`No pudimos enviar el aviso: ${err?.message || "error de conexión"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col">
        <Glass
          variant="panel"
          className="p-6 sm:p-7 rounded-3xl border border-[var(--line)] shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div>
              <h3 className="text-lg font-bold text-[var(--ink)]">Ya hice mi donación</h3>
              <p className="text-xs text-[var(--ink-2)] mt-0.5">
                Avisa lo que enviaste para que quien publicó pueda confirmarlo.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              <IconoX size={18} />
            </button>
          </div>

          {sent ? (
            <div className="py-6 space-y-4 text-center">
              <IconoCheckCirculo size={32} className="mx-auto text-emerald-500" />
              <p className="text-sm font-semibold text-[var(--ink)]">Aviso enviado.</p>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Quedó pendiente hasta que quien publicó la causa confirme que lo recibió. Puedes ver su
                estado en tu perfil, en Apoyos.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Listo
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2">
                  <IconoAlerta size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[var(--field)] border border-[var(--line)] flex items-start gap-2.5 text-xs text-[var(--ink-2)]">
                <IconoInfo size={16} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Tu aviso no se publica hasta que quien recibe lo confirme. Puente no verifica los pagos
                  ni las entregas.
                </p>
              </div>

              {/* Qué aportó (solo si la causa recibe dinero e insumos) */}
              {includesMoney && includesSupplies && (
                <div className="grid grid-cols-2 gap-2">
                  {(["dinero", "insumos"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        kind === k
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]"
                          : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                      }`}
                    >
                      {k === "dinero" ? "Envié dinero" : "Entregué insumos"}
                    </button>
                  ))}
                </div>
              )}

              {kind === "dinero" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                    Monto enviado ({currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--ink-3)]">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 pl-14 pr-3.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ink-3)] mt-1">
                    En la moneda de la causa, para que se pueda sumar a su total.
                  </p>
                </div>
              )}

              {kind === "insumos" && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                    Insumos que entregaste
                  </label>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {supplies.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-[var(--line)] bg-[var(--field)] flex items-center justify-between gap-3 text-xs"
                      >
                        <p className="font-semibold text-[var(--ink)] truncate min-w-0 flex-1">{item.name}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={quantities[item.id] ?? ""}
                            onChange={(e) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [item.id]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                              }))
                            }
                            placeholder="0"
                            className="w-20 px-2 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-solid)] text-right font-mono text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                          />
                          <span className="text-[11px] text-[var(--ink-3)] w-12 truncate">{item.unit || "uds"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                    Mensaje (opcional)
                  </label>
                  <span className="text-[10px] font-mono text-[var(--ink-3)]">{message.length}/500</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Unas palabras de ánimo para quien publicó la causa…"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-[var(--ink-2)]">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]"
                />
                <span>Prefiero aparecer como anónimo</span>
              </label>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <IconoCargando size={14} className="animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <IconoCheckCirculo size={14} />
                      <span>Enviar aviso</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Glass>
      </div>
    </div>
  );
}
