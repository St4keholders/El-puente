"use client";

import React, { useState } from "react";
import { IconoAlerta, IconoCheckCirculo, IconoCargando, IconoCerrar } from "@/components/iconos";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import type { Database } from "@/lib/database.types";

type ReportReason = Database["public"]["Enums"]["report_reason"];

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  causeId?: string;
  commentId?: string;
}

const REPORT_REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: "fraude", label: "Sospecha de fraude o estafa" },
  { id: "informacion_falsa", label: "Información o fotos falsas / desactualizadas" },
  { id: "contenido_inapropiado", label: "Contenido violento, explícito o inapropiado" },
  { id: "spam", label: "Spam, publicidad o recaudación no autorizada" },
  { id: "otro", label: "Otro motivo" },
];

export function ReportModal({ isOpen, onClose, causeId, commentId }: ReportModalProps) {
  const { user } = useUser();
  const supabase = createClient();

  const [reason, setReason] = useState<ReportReason>("fraude");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Debes iniciar sesión para enviar un reporte.");
      return;
    }
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        cause_id: causeId || null,
        comment_id: commentId || null,
        reason,
        details: details.trim() || null,
      });

      if (error) throw error;
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      alert("Error al enviar reporte: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4 border border-glass-tint">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
            <IconoAlerta size={18} />
            <span>Reportar a la Comunidad</span>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <IconoCerrar size={16} />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-6 text-center space-y-2">
            <IconoCheckCirculo size={32} className="mx-auto text-emerald-400" />
            <p className="font-bold text-text-primary text-sm">Reporte recibido</p>
            <p className="text-xs text-text-secondary">
              Gracias por colaborar con la seguridad y transparencia de Puente.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <p className="text-text-secondary">
              Indica la razón por la que consideras que esta publicación infringe las normas:
            </p>

            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all border ${
                    reason === r.id
                      ? "bg-accent/15 border-accent text-accent font-semibold"
                      : "glass-surface border-glass-tint text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-accent"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="font-semibold text-text-primary block mb-1">
                Detalles adicionales (opcional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Añade enlaces o información que ayude a verificar el reporte..."
                className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl glass-surface text-text-secondary font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold"
              >
                {isSubmitting ? <IconoCargando size={14} className="animate-spin" /> : "Enviar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
