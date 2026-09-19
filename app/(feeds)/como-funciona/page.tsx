import { Metadata } from "next";
import Link from "next/link";
import {
  IconoFlechaDerecha,
  IconoCheckCirculo,
  IconoAlerta,
  IlustracionPasoPublica,
  IlustracionPasoRecibe,
  IlustracionPasoResultados,
} from "@/components/iconos";

export const metadata: Metadata = {
  title: "Cómo Funciona | Puente",
  description:
    "Conoce cómo funciona Puente: la red comunitaria de ayuda directa entre personas, sin pasarelas de pago, sin intermediarios y con 0% de comisiones.",
};

export default function ComoFuncionaPage() {
  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-4 pb-24 lg:pb-32 space-y-16 sm:space-y-20">
      {/* Header Principal */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold px-3 py-1 rounded-full bg-[var(--hover)] border border-[var(--line)]">
          RED SOLIDARIA DIRECTA
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--ink)] tracking-tight">
          ¿Cómo funciona Puente?
        </h1>
        <p className="text-sm sm:text-base text-[var(--ink-2)] leading-relaxed max-w-2xl mx-auto">
          Un canal directo entre quienes afrontan una emergencia y quienes desean apoyar.
          Sin pasarelas de pago, sin retención de fondos y con cero comisiones.
        </p>
      </div>

      {/* 3 Pasos con Separadores de 1px (Estilo Stakeholders .features) */}
      <div className="rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
        {/* PASO 01 */}
        <div className="p-8 sm:p-10 flex flex-col justify-between group transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]">
          <div className="space-y-6">
            <span className="font-mono text-[0.75rem] uppercase tracking-wider text-[var(--accent)] font-semibold block">
              PASO 01 · PUBLICA
            </span>

            <div className="flex items-center justify-center py-4">
              <IlustracionPasoPublica className="w-48 h-48 sm:w-56 sm:h-56 transition-transform duration-500 group-hover:scale-105" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[var(--ink)] tracking-tight">
                Publica tu causa
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                Cuenta qué ocurrió con claridad. Añade fotos de evidencia, indica tu ciudad y
                registra tus cuentas bancarias o billeteras digitales directas para recibir aportes sin intermediarios.
              </p>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-[var(--line)] flex items-center gap-2 text-xs font-mono text-[var(--ink-3)]">
            <IconoCheckCirculo size={15} className="text-[var(--accent)]" />
            <span>Fotos de respaldo y ciudad</span>
          </div>
        </div>

        {/* PASO 02 */}
        <div className="p-8 sm:p-10 flex flex-col justify-between group transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]">
          <div className="space-y-6">
            <span className="font-mono text-[0.75rem] uppercase tracking-wider text-[var(--accent)] font-semibold block">
              PASO 02 · APOYO DIRECTO
            </span>

            <div className="flex items-center justify-center py-4">
              <IlustracionPasoRecibe className="w-48 h-48 sm:w-56 sm:h-56 transition-transform duration-500 group-hover:scale-105" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[var(--ink)] tracking-tight">
                Recibe apoyo directo
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                Los donantes te transfieren directamente a tus métodos de pago. Puente no toca,
                no custodia y no cobra ningún porcentaje de lo donado. El 100% llega a la comunidad.
              </p>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-[var(--line)] flex items-center gap-2 text-xs font-mono text-[var(--ink-3)]">
            <IconoCheckCirculo size={15} className="text-[var(--accent)]" />
            <span>0% de comisiones o retenciones</span>
          </div>
        </div>

        {/* PASO 03 */}
        <div className="p-8 sm:p-10 flex flex-col justify-between group transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]">
          <div className="space-y-6">
            <span className="font-mono text-[0.75rem] uppercase tracking-wider text-[var(--accent)] font-semibold block">
              PASO 03 · RESULTADOS
            </span>

            <div className="flex items-center justify-center py-4">
              <IlustracionPasoResultados className="w-48 h-48 sm:w-56 sm:h-56 transition-transform duration-500 group-hover:scale-105" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[var(--ink)] tracking-tight">
                Cierra y muestra resultados
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                Al completar la meta o concluir la emergencia, cierra la causa y publica la evidencia del antes y
                después con el monto utilizado. La rendición de cuentas construye confianza comunitaria.
              </p>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-[var(--line)] flex items-center gap-2 text-xs font-mono text-[var(--ink-3)]">
            <IconoCheckCirculo size={15} className="text-emerald-400" />
            <span>Rendición de cuentas pública</span>
          </div>
        </div>
      </div>

      {/* Aviso de Responsabilidad Comunitaria */}
      <div className="p-6 sm:p-8 rounded-3xl border border-amber-500/25 bg-amber-500/5 space-y-2 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
          <IconoAlerta size={18} />
          <span>Aviso legal y de responsabilidad comunitaria</span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
          Puente es una plataforma tecnológica que facilita la visibilidad y conexión solidaria entre personas.
          No procesamos pagos ni auditamos físicamente el destino de los fondos. Antes de donar, te invitamos a
          revisar las fotos, los datos del autor y los resultados de sus causas anteriores. Si detectas alguna anomalía,
          utiliza la opción de reporte.
        </p>
      </div>

      {/* Botones de Acción */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <Link
          href="/causa/nueva"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[var(--cta)] hover:bg-[var(--accent)] text-white font-semibold text-sm text-center transition-all shadow-lg active:scale-95"
        >
          Crear una causa
        </Link>
        <Link
          href="/explorar"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-solid)] hover:bg-[var(--hover)] text-[var(--ink)] font-semibold text-sm text-center transition-all flex items-center justify-center gap-2"
        >
          <span>Explorar causas activas</span>
          <IconoFlechaDerecha size={16} />
        </Link>
      </div>
    </div>
  );
}
