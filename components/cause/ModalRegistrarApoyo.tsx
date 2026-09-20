"use client";

import React, { useState, useEffect } from "react";
import { Glass } from "@/components/ui/Glass";
import { createClient } from "@/lib/supabase/client";
import {
  IconoX,
  IconoCargando,
  IconoCheckCirculo,
  IconoAlerta,
  IconoInfo,
} from "@/components/iconos";

export interface ModalSupplyItem {
  id: string;
  name: string;
  unit?: string | null;
  quantity_needed?: number | null;
  quantity_received: number;
  position?: number;
}

interface ModalRegistrarApoyoProps {
  isOpen: boolean;
  onClose: () => void;
  causeId: string;
  collectionType: "dinero" | "insumos" | "ambas";
  currency: string;
  currentRaised: number;
  supplies: ModalSupplyItem[];
  onSuccess: (newAmount?: number, newSupplies?: ModalSupplyItem[]) => void;
}

export function ModalRegistrarApoyo({
  isOpen,
  onClose,
  causeId,
  collectionType,
  currency,
  currentRaised,
  supplies: initialSupplies,
  onSuccess,
}: ModalRegistrarApoyoProps) {
  const [amount, setAmount] = useState<number | "">(currentRaised || "");
  const [supplies, setSupplies] = useState<ModalSupplyItem[]>(initialSupplies || []);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setAmount(currentRaised || "");
    setSupplies(initialSupplies || []);
    setErrorMsg(null);
  }, [currentRaised, initialSupplies, isOpen]);

  if (!isOpen) return null;

  const includesMoney = collectionType === "dinero" || collectionType === "ambas";
  const includesSupplies = collectionType === "insumos" || collectionType === "ambas";

  const handleSupplyChange = (id: string, val: string) => {
    const num = val === "" ? 0 : Math.max(0, Number(val));
    setSupplies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, quantity_received: num } : s))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);

    try {
      const supabase = createClient();

      const suppliesPayload = includesSupplies && supplies.length > 0
        ? supplies.map((s) => ({
            id: s.id,
            received: Number(s.quantity_received) || 0,
          }))
        : null;

      const numericAmount = includesMoney && amount !== "" ? Number(amount) : undefined;

      const { error } = await supabase.rpc("confirm_support", {
        p_cause_id: causeId,
        p_amount: numericAmount,
        p_supplies: (suppliesPayload as any) ?? undefined,
      });

      if (error) {
        throw error;
      }

      onSuccess(numericAmount ?? undefined, supplies);
      onClose();
    } catch (err: any) {
      console.error("Error confirming support:", err);
      setErrorMsg(err?.message || "No se pudo registrar el apoyo recibido.");
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
              <h3 className="text-lg font-bold text-[var(--ink)]">
                Registrar apoyo recibido
              </h3>
              <p className="text-xs text-[var(--ink-2)] mt-0.5">
                Actualiza el progreso real de tu recaudación.
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

          {/* Formulario */}
          <form onSubmit={handleSave} className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2">
                <IconoAlerta size={16} className="flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Aviso de transparencia y bloqueo de borrado (PLAN.md 6.3) */}
            <div className="p-3.5 rounded-xl bg-[var(--field)] border border-[var(--line)] flex items-start gap-2.5 text-xs text-[var(--ink-2)]">
              <IconoInfo size={16} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Por transparencia con la comunidad, al registrar apoyo confirmado la causa no podrá eliminarse, únicamente cerrarse al concluir.
              </p>
            </div>

            {/* Sección de Dinero */}
            {includesMoney && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1.5">
                  Monto total recaudado ({currency})
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
                  Ingresa el total acumulado que has recibido hasta hoy en tus medios de pago.
                </p>
              </div>
            )}

            {/* Sección de Insumos */}
            {includesSupplies && supplies.length > 0 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                  Insumos recibidos
                </label>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {supplies.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-[var(--line)] bg-[var(--field)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--ink)] truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-[var(--ink-3)]">
                          Meta: {item.quantity_needed ? `${item.quantity_needed} ${item.unit || "unidades"}` : "Sin límite"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity_received}
                          onChange={(e) => handleSupplyChange(item.id, e.target.value)}
                          className="w-20 px-2 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-solid)] text-right font-mono text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                        />
                        <span className="text-[11px] text-[var(--ink-3)] w-12 truncate">
                          {item.unit || "uds"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <IconoCheckCirculo size={14} />
                    <span>Guardar apoyo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Glass>
      </div>
    </div>
  );
}
