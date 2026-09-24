"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvisoPendiente, type AvisoRecibido } from "@/components/apoyos/AvisoPendiente";
import { describirApoyo, type InsumoRef } from "@/lib/apoyos";
import { formatDistanceToNow } from "@/lib/utils/date";
import { urlDeAvatar } from "@/lib/media";
import { IconoCorazon, IconoInfo } from "@/components/iconos";
import type { Json } from "@/lib/database.types";

export interface ApoyoConfirmado {
  id: string;
  kind: "dinero" | "insumos";
  amount: number | null;
  currency: string;
  items: Json | null;
  message: string | null;
  thanks_message: string | null;
  confirmed_at: string;
  is_anonymous: boolean;
  donor_name: string | null;
  donor_public_id: string | null;
  donor_avatar_url: string | null;
}

interface SeccionApoyosProps {
  confirmados: ApoyoConfirmado[];
  /** Solo llegan si quien mira es la autora de la causa. */
  pendientes: AvisoRecibido[];
  insumos: InsumoRef[];
  authorName: string;
}

export function SeccionApoyos({ confirmados, pendientes: iniciales, insumos, authorName }: SeccionApoyosProps) {
  const router = useRouter();
  const [pendientes, setPendientes] = useState(iniciales);

  if (confirmados.length === 0 && pendientes.length === 0) return null;

  const handleResolved = (id: string) => {
    setPendientes((prev) => prev.filter((p) => p.id !== id));
    // Trae el total y la lista pública actualizados desde el servidor
    router.refresh();
  };

  return (
    <section className="space-y-4">
      {pendientes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconoCorazon size={20} className="text-accent" />
            <h3 className="font-bold text-lg text-text-primary">Avisos por confirmar ({pendientes.length})</h3>
          </div>
          <p className="text-xs text-text-secondary">
            Solo tú los ves. Confirma los que recibiste para sumarlos al total y mostrarlos en público.
          </p>
          {pendientes.map((aviso) => (
            <AvisoPendiente key={aviso.id} aviso={aviso} insumos={insumos} onResolved={handleResolved} />
          ))}
        </div>
      )}

      {confirmados.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconoCorazon size={20} className="text-accent" />
            <h3 className="font-bold text-lg text-text-primary">Apoyos confirmados ({confirmados.length})</h3>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-3">
            <IconoInfo size={18} className="flex-shrink-0 mt-0.5" />
            <p className="font-semibold">
              Los apoyos los reportan y confirman las propias personas. Puente no verifica los pagos ni las entregas.
            </p>
          </div>

          {confirmados.map((apoyo) => {
            const avatar = apoyo.is_anonymous ? null : urlDeAvatar(apoyo.donor_avatar_url);
            const nombre = apoyo.is_anonymous ? "Anónimo" : apoyo.donor_name || "Persona";
            return (
              <div key={apoyo.id} className="glass-surface p-4 rounded-2xl space-y-2 border border-glass-tint">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-glass-tint flex items-center justify-center text-xs font-bold text-accent overflow-hidden flex-shrink-0">
                      {avatar ? (
                        <img src={avatar} alt={nombre} className="w-full h-full object-cover" />
                      ) : (
                        nombre.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="text-xs min-w-0">
                      {!apoyo.is_anonymous && apoyo.donor_public_id ? (
                        <Link href={`/u/${apoyo.donor_public_id}`} className="font-semibold text-text-primary hover:underline">
                          {nombre}
                        </Link>
                      ) : (
                        <span className="font-semibold text-text-primary">{nombre}</span>
                      )}
                      <span className="text-text-secondary"> · {formatDistanceToNow(apoyo.confirmed_at)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-text-primary text-right">{describirApoyo(apoyo, insumos)}</span>
                </div>
                {apoyo.message && (
                  <p className="text-sm text-text-primary whitespace-pre-wrap pl-9">“{apoyo.message}”</p>
                )}
                {apoyo.thanks_message && (
                  <p className="text-xs text-text-secondary whitespace-pre-wrap pl-9">
                    <span className="font-semibold text-text-primary">{authorName}:</span> {apoyo.thanks_message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
