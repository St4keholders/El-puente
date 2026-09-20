"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Glass } from "@/components/ui/Glass";
import {
  IconoMas,
  IconoEditar,
  IconoBorrar,
  IconoCheckCirculo,
  IconoAlerta,
  IconoX,
  IconoOjo,
  IconoOjoTachado,
} from "@/components/iconos";
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
  reorderPaymentMethodsAction,
} from "./actions";
import type { Database } from "@/lib/database.types";

type ProfileDonationMethod = Database["public"]["Tables"]["profile_donation_methods"]["Row"];
type MethodKind = Database["public"]["Enums"]["donation_method_kind"];

const KIND_LABELS: Record<MethodKind, string> = {
  transferencia_bancaria: "Transferencia bancaria",
  billetera_digital: "Billetera digital",
  paypal: "PayPal",
  enlace_de_pago: "Enlace de pago",
  otro: "Otro método",
};

interface MetodosPagoClientProps {
  userId: string;
  initialMethods: ProfileDonationMethod[];
  initialError: string | null;
}

export function MetodosPagoClient({
  userId,
  initialMethods,
  initialError,
}: MetodosPagoClientProps) {
  const supabase = createClient();

  const router = useRouter();
  const [methods, setMethods] = useState<ProfileDonationMethod[]>(initialMethods);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);

  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});

  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ProfileDonationMethod | null>(null);
  const [syncActiveCauses, setSyncActiveCauses] = useState(true);
  const [affectedCausesCount, setAffectedCausesCount] = useState<number>(0);

  // Campos de formulario
  const [kind, setKind] = useState<MethodKind>("billetera_digital");
  const [provider, setProvider] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountValue, setAccountValue] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Diálogo de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleVisibility = (id: string) => {
    setVisibleValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskValue = (val: string, show: boolean) => {
    if (show || val.length <= 4) return val;
    const last4 = val.slice(-4);
    return `•••• •••• ${last4}`;
  };

  const handleOpenCreate = () => {
    if (methods.length >= 10) return;
    setEditingMethod(null);
    setKind("billetera_digital");
    setProvider("");
    setAccountHolder("");
    setAccountValue("");
    setDetails("");
    setSyncActiveCauses(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (m: ProfileDonationMethod) => {
    setEditingMethod(m);
    setKind(m.kind);
    setProvider(m.provider);
    setAccountHolder(m.account_holder);
    setAccountValue(m.account_value);
    setDetails(m.details || "");
    setSyncActiveCauses(true);
    setModalError(null);

    // Contar causas activas/borradores asociadas a este método
    try {
      const { count } = await supabase
        .from("donation_methods")
        .select("id, causes!inner(status)", { count: "exact", head: true })
        .eq("profile_method_id", m.id)
        .in("causes.status", ["borrador", "activa"]);
      setAffectedCausesCount(count || 0);
    } catch {
      setAffectedCausesCount(0);
    }
    setIsModalOpen(true);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= methods.length) return;

    const newMethods = [...methods];
    const [moved] = newMethods.splice(index, 1);
    newMethods.splice(targetIndex, 0, moved);

    setMethods(newMethods);

    try {
      await reorderPaymentMethodsAction(newMethods.map((m) => m.id));
      router.refresh();
    } catch (e) {
      console.warn("Error reordering:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deletePaymentMethodAction(id);
      if (res.success) {
        setMethods((prev) => prev.filter((m) => m.id !== id));
        setDeletingId(null);
        setSuccessNotice("Método eliminado con éxito.");
        router.refresh();
        setTimeout(() => setSuccessNotice(null), 3000);
      } else {
        setErrorMsg(res.error || "No pudimos eliminar el método.");
      }
    } catch {
      setErrorMsg("No pudimos eliminar el método.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (provider.trim().length < 2) {
      setModalError("Ingresa el banco o plataforma (ej. Bancolombia, Nequi, etc.).");
      return;
    }
    if (accountHolder.trim().length < 2) {
      setModalError("Ingresa el nombre de la persona titular de la cuenta.");
      return;
    }
    if (accountValue.trim().length < 3) {
      setModalError("Ingresa el número de cuenta, teléfono o enlace de pago.");
      return;
    }

    setSaving(true);

    try {
      if (editingMethod) {
        // Actualizar método existente
        const res = await updatePaymentMethodAction(editingMethod.id, {
          kind,
          provider: provider.trim(),
          account_holder: accountHolder.trim(),
          account_value: accountValue.trim(),
          details: details.trim() || null,
          syncActiveCauses,
        });

        if (!res.success) {
          throw new Error(res.error || "Error al actualizar método.");
        }

        setMethods((prev) =>
          prev.map((m) =>
            m.id === editingMethod.id
              ? {
                  ...m,
                  kind,
                  provider: provider.trim(),
                  account_holder: accountHolder.trim(),
                  account_value: accountValue.trim(),
                  details: details.trim() || null,
                }
              : m
          )
        );

        setSuccessNotice("Método actualizado con éxito.");
      } else {
        // Crear nuevo método
        const nextPos = methods.length;
        const res = await createPaymentMethodAction({
          kind,
          provider: provider.trim(),
          account_holder: accountHolder.trim(),
          account_value: accountValue.trim(),
          details: details.trim() || null,
          position: nextPos,
        });

        if (!res.success) {
          if (res.error?.includes("10")) {
            setModalError("Llegaste al máximo de 10 métodos permitidos.");
            setSaving(false);
            return;
          }
          throw new Error(res.error || "Error al crear método.");
        }

        if (res.method) {
          setMethods((prev) => [...prev, res.method]);
        }
        setSuccessNotice("Método agregado con éxito.");
      }

      router.refresh();
      setIsModalOpen(false);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      console.error("Error saving method:", err);
      setModalError(err.message || "Error al guardar el método.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Métodos de pago
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-2)] mt-1">
            Guárdalos aquí para usarlos al crear una causa. Solo se muestran dentro de las causas donde los agregues.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={methods.length >= 10}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"
        >
          <IconoMas size={16} />
          <span>{methods.length >= 10 ? "Llegaste al máximo de 10 métodos" : "Agregar método"}</span>
        </button>
      </div>

      {/* Avisos */}
      {successNotice && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-600 border border-emerald-500/20 animate-fade-in">
          <IconoCheckCirculo size={18} className="flex-shrink-0" />
          <span className="font-semibold">{successNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-red-500/10 p-4 text-xs sm:text-sm text-red-500 border border-red-500/20">
          <IconoAlerta size={18} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lista de Métodos */}
      {methods.length > 0 ? (
        <div className="space-y-3.5">
          {methods.map((m, index) => {
            const isVisible = Boolean(visibleValues[m.id]);
            return (
              <div
                key={m.id}
                className="p-5 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[var(--glass-edge)] transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--accent-ink)]">
                      {KIND_LABELS[m.kind] || m.kind}
                    </span>
                    <span className="text-xs text-[var(--ink-3)]">·</span>
                    <span className="text-sm font-semibold text-[var(--ink)] truncate">
                      {m.provider}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--ink-2)] truncate">
                    Titular: <strong className="text-[var(--ink)]">{m.account_holder}</strong>
                  </p>

                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-xs font-mono text-[var(--ink)] font-medium">
                      {maskValue(m.account_value, isVisible)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleVisibility(m.id)}
                      className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1 rounded transition-colors cursor-pointer"
                      title={isVisible ? "Ocultar número" : "Mostrar número completo"}
                    >
                      {isVisible ? <IconoOjoTachado size={14} /> : <IconoOjo size={14} />}
                    </button>
                  </div>

                  {m.details && (
                    <p className="text-[11px] text-[var(--ink-3)] mt-1 line-clamp-1 italic">
                      "{m.details}"
                    </p>
                  )}
                </div>

                {/* Acciones del método */}
                <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                  {/* Botones accesibles Subir / Bajar */}
                  <div className="flex items-center border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface-solid)] mr-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                      aria-label="Subir método en la lista"
                      className="px-2.5 py-1.5 text-xs text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      ▲
                    </button>
                    <div className="w-[1px] h-4 bg-[var(--line)]" />
                    <button
                      type="button"
                      disabled={index === methods.length - 1}
                      onClick={() => handleMove(index, "down")}
                      aria-label="Bajar método en la lista"
                      className="px-2.5 py-1.5 text-xs text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      ▼
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(m)}
                    className="p-2 rounded-xl border border-[var(--line)] text-xs text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                    title="Editar método"
                  >
                    <IconoEditar size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingId(m.id)}
                    className="p-2 rounded-xl border border-[var(--line)] text-xs text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Eliminar método"
                  >
                    <IconoBorrar size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Estado vacío */
        <div className="p-12 rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] flex flex-col items-center justify-center text-center">
          <svg viewBox="0 0 160 120" className="w-28 h-20 mb-4 stroke-[var(--line-strong)] fill-none" aria-hidden="true">
            <rect x="25" y="30" width="110" height="70" rx="12" strokeWidth="1.6" />
            <line x1="25" y1="52" x2="135" y2="52" strokeWidth="1.6" />
            <circle cx="110" cy="78" r="8" strokeWidth="1.4" className="stroke-[var(--accent)]" />
            <path d="M 50 78 L 85 78" strokeWidth="1.4" strokeLinecap="round" />
          </svg>

          <h3 className="text-base font-bold text-[var(--ink)] mb-1">
            Aún no tienes métodos guardados
          </h3>
          <p className="text-xs text-[var(--ink-2)] max-w-sm mb-6">
            Guarda tus cuentas de banco o billeteras digitales para agregarlas en un solo clic cada vez que crees una causa.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="py-2.5 px-5 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Agregar método
          </button>
        </div>
      )}

      {/* Modal Agregar / Editar */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <Glass
            variant="panel"
            className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border border-[var(--line)]"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] mb-5">
              <h2 className="text-lg font-bold text-[var(--ink)]">
                {editingMethod ? "Editar método de pago" : "Agregar método de pago"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
              >
                <IconoX size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3 text-xs text-red-500 border border-red-500/20">
                <IconoAlerta size={16} className="flex-shrink-0 mt-0.5" />
                <p>{modalError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
                  Tipo de método
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as MethodKind)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none cursor-pointer"
                >
                  <option value="billetera_digital">Billetera digital (Nequi, Daviplata, MercadoPago, etc.)</option>
                  <option value="transferencia_bancaria">Transferencia bancaria / Cuenta de ahorros o corriente</option>
                  <option value="paypal">PayPal</option>
                  <option value="enlace_de_pago">Enlace de pago (Wompi, Stripe, Bold, etc.)</option>
                  <option value="otro">Otro método</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
                  Banco o Plataforma
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Ej. Bancolombia, Nequi, BBVA, etc."
                  required
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
                  Titular de la cuenta
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Nombre y apellido de quien recibe"
                  required
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
                  Número de cuenta, teléfono o enlace
                </label>
                <input
                  type="text"
                  value={accountValue}
                  onChange={(e) => setAccountValue(e.target.value)}
                  placeholder="Ej. 3001234567 o 123-456789-00"
                  required
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-xs font-mono text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
                  Indicaciones adicionales <span className="font-normal lowercase text-[var(--ink-3)]">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 300))}
                  placeholder="Ej. Cuenta de ahorros, enviar comprobante por WhatsApp, etc."
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--field)] py-2.5 px-3 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {editingMethod && (
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncActiveCauses}
                      onChange={(e) => setSyncActiveCauses(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--line)] bg-[var(--field)] cursor-pointer"
                    />
                    <span className="text-xs text-[var(--ink-2)] leading-tight">
                      Actualizar también en mis causas activas y borradores ({affectedCausesCount})
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-3.5 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="py-2 px-4 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold tracking-wide shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editingMethod ? "Guardar cambios" : "Agregar método"}
                </button>
              </div>
            </form>
          </Glass>
        </div>
      )}

      {/* Modal Eliminación */}
      {deletingId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <Glass
            variant="panel"
            className="w-full max-w-sm p-6 rounded-3xl shadow-2xl border border-[var(--line)] text-center space-y-4"
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <IconoBorrar size={22} />
            </div>

            <h3 className="text-base font-bold text-[var(--ink)]">
              ¿Eliminar este método de pago?
            </h3>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              Las causas donde ya lo usaste lo conservan para garantizar la rendición de cuentas con los donantes.
            </p>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="py-2 px-4 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
              >
                Conservar
              </button>

              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide shadow-md transition-all cursor-pointer"
              >
                Eliminar método
              </button>
            </div>
          </Glass>
        </div>
      )}
    </div>
  );
}
