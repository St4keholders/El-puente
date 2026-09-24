"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvisoPendiente } from "@/components/apoyos/AvisoPendiente";
import { eliminarAvisoAction } from "@/app/actions/apoyos";
import { describirApoyo, ETIQUETA_ESTADO, CLASE_ESTADO, type EstadoAviso, type InsumoRef } from "@/lib/apoyos";
import { formatDistanceToNow } from "@/lib/utils/date";
import { avisarPerfilActualizado } from "@/lib/hooks/useUser";
import { IconoCargando, IconoBasura, IconoAlerta } from "@/components/iconos";
import type { Json } from "@/lib/database.types";

interface AvisoBase {
  id: string;
  cause_id: string;
  kind: "dinero" | "insumos";
  amount: number | null;
  currency: string;
  items: Json | null;
  message: string | null;
  is_anonymous: boolean;
  status: EstadoAviso;
  thanks_message: string | null;
  created_at: string;
  confirmed_at: string | null;
  cause: { title: string | null } | null;
}

interface AvisoRecibidoRow extends AvisoBase {
  donor: { full_name: string; public_id: string } | null;
}

type Tab = "recibidos" | "enviados";

interface ApoyosClientProps {
  recibidos: AvisoRecibidoRow[];
  enviados: AvisoBase[];
  insumos: InsumoRef[];
}

export function ApoyosClient({ recibidos: recibidosIniciales, enviados: enviadosIniciales, insumos }: ApoyosClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("recibidos");
  const [recibidos, setRecibidos] = useState(recibidosIniciales);
  const [enviados, setEnviados] = useState(enviadosIniciales);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pendientes = recibidos.filter((r) => r.status === "reportado");
  const resueltos = recibidos.filter((r) => r.status !== "reportado");

  const handleResolved = (id: string, estado: "confirmado" | "no_recibido") => {
    setRecibidos((prev) => prev.map((r) => (r.id === id ? { ...r, status: estado } : r)));
    avisarPerfilActualizado(); // el punto del header se apaga si no quedan pendientes
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Borrar este aviso? Quien publicó la causa ya no lo verá.")) return;
    setDeletingId(id);
    setErrorMsg(null);
    try {
      const res = await eliminarAvisoAction(id);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setEnviados((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error("Borrar aviso:", err?.code, err?.message);
      setErrorMsg(`No se pudo borrar el aviso: ${err?.message || "error de conexión"}`);
    } finally {
      setDeletingId(null);
    }
  };

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "recibidos", label: "Recibidos", count: recibidos.length },
    { key: "enviados", label: "Enviados", count: enviados.length },
  ];

  const vacio = (texto: string) => (
    <div className="py-16 px-6 text-center rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/40 backdrop-blur-md">
      <p className="text-sm text-[var(--ink-2)]">{texto}</p>
    </div>
  );

  const fila = (aviso: AvisoBase, extra?: React.ReactNode) => (
    <div key={aviso.id} className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--field)] space-y-2 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-[var(--ink)]">{describirApoyo(aviso, insumos)}</p>
          <Link href={`/causa/${aviso.cause_id}`} className="text-[var(--accent-ink)] hover:underline block truncate">
            {aviso.cause?.title || "Causa"}
          </Link>
          {extra}
          <p className="text-[var(--ink-3)]">
            Avisado {formatDistanceToNow(aviso.created_at)}
            {aviso.is_anonymous && " · como anónimo"}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${CLASE_ESTADO[aviso.status]}`}>
          {ETIQUETA_ESTADO[aviso.status]}
        </span>
      </div>
      {aviso.message && <p className="text-[var(--ink)] whitespace-pre-wrap">“{aviso.message}”</p>}
      {aviso.thanks_message && (
        <p className="text-[var(--ink-2)] whitespace-pre-wrap">
          <span className="font-semibold text-[var(--ink)]">Agradecimiento:</span> {aviso.thanks_message}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Apoyos</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Los avisos de donación que recibes en tus causas y los que enviaste a otras.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2">
          <IconoAlerta size={14} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs (mismo estilo que Mis causas) */}
      <div
        role="tablist"
        aria-label="Apoyos"
        className="flex items-center gap-2 border-b border-[var(--line)] overflow-x-auto pb-px scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-[var(--accent)] text-[var(--ink)] font-semibold"
                  : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold transition-colors ${
                  isActive ? "bg-[var(--accent)]/15 text-[var(--accent-ink)]" : "bg-[var(--track)] text-[var(--ink-3)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="space-y-4">
        {activeTab === "recibidos" ? (
          recibidos.length === 0 ? (
            vacio("Todavía no has recibido avisos de donación en tus causas.")
          ) : (
            <>
              {pendientes.map((aviso) => (
                <AvisoPendiente
                  key={aviso.id}
                  aviso={aviso}
                  insumos={insumos}
                  causeTitle={aviso.cause?.title}
                  onResolved={handleResolved}
                />
              ))}
              {resueltos.map((aviso) =>
                fila(
                  aviso,
                  <p className="text-[var(--ink-2)]">
                    De{" "}
                    {aviso.donor ? (
                      <Link href={`/u/${aviso.donor.public_id}`} className="font-medium hover:underline">
                        {aviso.donor.full_name}
                      </Link>
                    ) : (
                      "una persona sin perfil"
                    )}
                  </p>
                )
              )}
            </>
          )
        ) : enviados.length === 0 ? (
          vacio("Todavía no has avisado ninguna donación. Usa “Ya hice mi donación” en la causa que apoyaste.")
        ) : (
          enviados.map((aviso) =>
            fila(
              aviso,
              aviso.status === "reportado" ? (
                <button
                  type="button"
                  onClick={() => handleDelete(aviso.id)}
                  disabled={deletingId === aviso.id}
                  className="inline-flex items-center gap-1 text-rose-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  {deletingId === aviso.id ? <IconoCargando size={12} className="animate-spin" /> : <IconoBasura size={12} />}
                  <span>Borrar aviso</span>
                </button>
              ) : undefined
            )
          )
        )}
      </div>
    </div>
  );
}
