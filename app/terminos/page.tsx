import { Metadata } from "next";
import { Glass } from "@/components/ui/Glass";

export const metadata: Metadata = {
  title: "Términos y Condiciones | Puente",
  description: "Términos de uso de la plataforma solidaria Puente.",
};

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-bold text-xs uppercase tracking-wider">
          Pendiente de revisión legal
        </span>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Términos y Condiciones de Uso
        </h1>
        <p className="text-xs text-text-secondary">Última actualización: Septiembre 2026</p>
      </div>

      <Glass variant="card" className="rounded-3xl p-6 sm:p-8 space-y-6 text-sm text-text-secondary leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">1. Naturaleza de la Plataforma</h2>
          <p>
            Puente es una red comunitaria sin ánimo de lucro destinada a facilitar la comunicación y
            visibilidad entre personas que enfrentan situaciones de emergencia o necesidad y personas
            dispuestas a brindar apoyo solidario.
          </p>
          <p>
            Puente no actúa como entidad bancaria, pasarela de cobro, procesador de pagos, intermediario
            financiero ni custodio de fondos. Las transferencias se realizan de forma externa y directa
            entre las partes interesadas.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">2. Responsabilidad de quien publica</h2>
          <p>
            La persona que publica una causa declara bajo su exclusiva responsabilidad que la información,
            fotografías, ubicación y medios de recepción de fondos suministrados son verídicos, exactos y
            corresponden a una necesidad real. Está prohibido el uso de la plataforma con fines fraudulentos,
            suplantación de identidad o engaño a la comunidad.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">3. Responsabilidad de quien dona</h2>
          <p>
            Quienes decidan realizar donaciones reconocen que lo hacen de manera voluntaria, directa y bajo
            su propio criterio y riesgo. Recomendamos verificar minuciosamente la identidad del titular,
            el historial de causas y los comentarios comunitarios antes de efectuar transferencias.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">4. Moderación y Reportes</h2>
          <p>
            Cualquier miembro de la comunidad puede reportar causas o comentarios sospechosos. Puente se
            reserva el derecho de ocultar o suspender publicaciones que infrinjan estas normas o que sean
            objeto de múltiples reportes fundamentados de fraude.
          </p>
        </section>
      </Glass>
    </div>
  );
}
