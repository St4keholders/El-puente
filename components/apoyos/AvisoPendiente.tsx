"use client";

import React, { useState } from "react";
import Link from "next/link";
import { confirmarAvisoAction, rechazarAvisoAction } from "@/app/actions/apoyos";
import { describirApoyo, type InsumoRef } from "@/lib/apoyos";
import { formatDistanceToNow } from "@/lib/utils/date";
import { IconoCargando, IconoCheckCirculo, IconoAlerta } from "@/components/iconos";
import type { Json } from "@/lib/database.types";

export interface AvisoRecibido {
  id: string;
  cause_id: string;
  kind: "dinero" | "insumos";
  amount: number | null;
  currency: string;
  items: Json | null;
  message: string | null;
  is_anonymous: boolean;
  created_at: string;
  donor: { full_name: string; public_id: string } | null;
}

interface AvisoPendienteProps {
  aviso: AvisoRecibido;
  insumos: InsumoRef[];
  /** Título de la causa (en el perfil, donde se mezclan varias). */
  causeTitle?: string | null;
  onResolved: (id: string, estado: "confirmado" | "no_recibido") => void;
}

/** Aviso pendiente para quien publicó: confirmar con agradecimiento o marcar que no llegó. */
export function AvisoPendiente({ aviso, insumos, causeTitle, onResolved }: AvisoPendienteProps) {
  const [confirming, setConfirming] = useState(false);
  const [thanks, setThanks] = useState("");
  const [busy, setBusy] = useState<"confirmar" | "rechazar" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = async (accion: "confirmar" | "rechazar") => {
    setBusy(accion);
    setErrorMsg(null);
    try {
      const res =
        accion === "confirmar"
          ? await confirmarAvisoAction(aviso.id, aviso.cause_id, thanks.trim() || null)
          : await rechazarAvisoAction(aviso.id, aviso.cause_id);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      onResolved(aviso.id, accion === "confirmar" ? "confirmado" : "no_recibido");
    } catch (err: any) {
      console.error(`Aviso ${accion}:`, err?.code, err?.message);
      setErrorMsg(`No se pudo guardar: ${err?.message || "error de conexión"}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--field)] space-y-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-[var(--ink)]">{describirApoyo(aviso, insumos)}</p>
          <p className="text-[var(--ink-2)]">
            {aviso.donor ? (
              <Link href={`/u/${aviso.donor.public_id}`} className="font-medium hover:underline">
                {aviso.donor.full_name}
              </Link>
            ) : (
              "Persona sin perfil"
            )}
            {aviso.is_anonymous && <span className="text-[var(--ink-3)]"> · pidió aparecer como anónimo</span>}
            <span className="text-[var(--ink-3)]"> · {formatDistanceToNow(aviso.created_at)}</span>
          </p>
          {causeTitle && (
            <Link href={`/causa/${aviso.cause_id}`} className="text-[var(--accent-ink)] hover:underline block truncate">
              {causeTitle}
            </Link>
          )}
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex-shrink-0">
          Pendiente
        </span>
      </div>

      {aviso.message && (
        <p className="text-[var(--ink)] whitespace-pre-wrap leading-relaxed">“{aviso.message}”</p>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-start gap-2">
          <IconoAlerta size={14} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {confirming && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-[var(--ink-2)]">Agradecimiento (público, opcional)</label>
            <span className="text-[10px] font-mono text-[var(--ink-3)]">{thanks.length}/500</span>
          </div>
          <textarea
            rows={2}
            maxLength={500}
            value={thanks}
            onChange={(e) => setThanks(e.target.value)}
            placeholder="¡Gracias por tu apoyo!"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] py-2 px-3 text-xs text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none resize-none"
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
              className="px-3.5 py-2 rounded-xl text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--line)] font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => run("confirmar")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {busy === "confirmar" ? <IconoCargando size={13} className="animate-spin" /> : <IconoCheckCirculo size={13} />}
              <span>Confirmar que lo recibí</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => run("rechazar")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy === "rechazar" && <IconoCargando size={13} className="animate-spin" />}
              <span>No lo recibí</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] text-white font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <IconoCheckCirculo size={13} />
              <span>Confirmar</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
