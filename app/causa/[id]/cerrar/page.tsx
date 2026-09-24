"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconoArchivo,
  IconoAlerta,
  IconoCheckCirculo,
  IconoEstrellas,
  IconoFlechaIzquierda,
  IconoCargando,
} from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";

export default function CerrarCausaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { user, loading: userLoading } = useUser();
  const supabase = createClient();

  const [cause, setCause] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [raisedReported, setRaisedReported] = useState<number | "">("");
  const [closingNote, setClosingNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosedSuccess, setIsClosedSuccess] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push(`/entrar?next=/causa/${id}/cerrar`);
      return;
    }

    async function loadCause() {
      const { data, error } = await supabase
        .from("causes")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("Causa no encontrada");
        router.push("/explorar");
        return;
      }

      if (data.author_id !== user!.id) {
        alert("No tienes permiso para cerrar esta causa.");
        router.push(`/causa/${id}`);
        return;
      }

      if (data.status === "cerrada" || data.status === "finalizada") {
        setIsClosedSuccess(true);
      }

      setCause(data);
      if (data.raised_reported) {
        setRaisedReported(data.raised_reported);
      }
      if (data.closing_note) {
        setClosingNote(data.closing_note);
      }
      setLoading(false);
    }

    loadCause();
  }, [id, user, userLoading]);

  const handleCloseCause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cause || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("causes")
        .update({
          status: "cerrada",
          raised_reported: typeof raisedReported === "number" ? raisedReported : null,
          closing_note: closingNote.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;
      setIsClosedSuccess(true);
    } catch (err: any) {
      alert("Error al cerrar la causa: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <IconoCargando className="animate-spin text-accent mb-4" size={36} />
        <p className="text-text-secondary text-sm">Cargando causa...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Link
        href={`/causa/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <IconoFlechaIzquierda size={16} /> Volver a la causa
      </Link>

      <Glass variant="card" className="rounded-3xl p-6 sm:p-8 space-y-6">
        {isClosedSuccess ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <IconoCheckCirculo size={36} />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-text-primary">Tu causa ha sido cerrada</h2>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Ya no recibirás más donaciones. Para completar el ciclo de transparencia, comparte los
                resultados con la comunidad.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/causa/${id}/resultados`}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
              >
                <IconoEstrellas size={16} /> Publicar resultados ahora
              </Link>
              <Link
                href={`/causa/${id}`}
                className="w-full sm:w-auto px-6 py-3 rounded-full glass-surface text-text-primary hover:bg-glass-surface/80 text-xs font-semibold text-center border border-glass-tint"
              >
                Ver causa cerrada
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCloseCause} className="space-y-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                <IconoArchivo size={24} />
              </div>
              <h1 className="text-2xl font-bold text-text-primary">Cerrar Causa Solidaria</h1>
              <p className="text-xs text-text-secondary">
                Estás por cerrar <strong className="text-text-primary">"{cause.title}"</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-3">
              <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¿Qué sucede al cerrar tu causa?</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 opacity-90">
                  <li>Tus medios de donación se ocultarán y dejarás de recibir aportes.</li>
                  <li>La luz de tu país se ajustará en el planeta 3D.</li>
                  <li>Podrás compartir fotos del antes y el después de lo alcanzado.</li>
                </ul>
              </div>
            </div>

            {/* Optional amount received */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary block">
                Monto total recibido ({cause.currency || "USD"}) (opcional)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={raisedReported}
                onChange={(e) =>
                  setRaisedReported(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="Ej: 3500"
                className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm"
              />
              <span className="text-[11px] text-text-secondary block">
                Puedes dejarlo vacío o indicarlo para informar a quienes colaboraron.
              </span>
            </div>

            {/* Optional closing note */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary block">
                Mensaje o nota de cierre (opcional)
              </label>
              <textarea
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                rows={3}
                placeholder="Agradece a quienes te apoyaron o comparte un mensaje final..."
                className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Link
                href={`/causa/${id}`}
                className="px-5 py-2.5 rounded-full glass-surface text-text-secondary hover:text-text-primary text-xs font-semibold"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? (
                  <>
                    <IconoCargando size={14} className="animate-spin" />
                    <span>Cerrando...</span>
                  </>
                ) : (
                  <>
                    <IconoArchivo size={14} />
                    <span>Confirmar y Cerrar Causa</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Glass>
    </div>
  );
}
