import { Metadata } from "next";
import { Glass } from "@/components/ui/Glass";

export const metadata: Metadata = {
  title: "Política de Privacidad | Puente",
  description: "Política de privacidad y protección de datos en Puente.",
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-bold text-xs uppercase tracking-wider">
          Pendiente de revisión legal
        </span>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Política de Privacidad
        </h1>
        <p className="text-xs text-text-secondary">Última actualización: Septiembre 2026</p>
      </div>

      <Glass variant="card" className="rounded-3xl p-6 sm:p-8 space-y-6 text-sm text-text-secondary leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">1. Principio de Privacidad por Diseño</h2>
          <p>
            En Puente protegemos la seguridad de las personas afectadas por emergencias y desastres. Por
            ello:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Eliminación de metadatos EXIF y GPS:</strong> Todas las fotos cargadas a una causa
              se re-codifican en el navegador antes de subirse, eliminando cualquier dato de ubicación
              satelital o metadatos de cámara por estricta seguridad personal.
            </li>
            <li>
              <strong>Ubicación solo a nivel ciudad:</strong> Nunca solicitamos dirección exacta, calle ni
              barrio. Las coordenadas en el globo 3D corresponden al centroide general de la ciudad
              redondeado a 2 decimales.
            </li>
            <li>
              <strong>Protección contra raspados:</strong> Los métodos de pago y datos de transferencia solo
              son visibles para personas registradas e identificadas en la plataforma, previniendo la
              recolección automática no autorizada.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">2. Datos que recibimos de Google</h2>
          <p>
            Al ingresar mediante Google, solicitamos únicamente los permisos mínimos necesarios:{" "}
            <code>openid</code>, <code>email</code> y <code>profile</code> (nombre y foto). Nunca solicitamos
            contactos, archivos de Google Drive ni permisos adicionales. No almacenamos tokens ni credenciales
            de terceros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">3. Para qué se usa el número de teléfono</h2>
          <p>
            El número de teléfono se almacena en una tabla protegida por seguridad de nivel de fila (RLS),
            inaccesible para otros usuarios y motores de búsqueda. Se requiere únicamente para activar la
            publicación de causas comunitarias como medida antifraude y verificación de contacto directo en
            situaciones de soporte. Nunca se muestra públicamente.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">4. Puente no procesa pagos ni retiene fondos</h2>
          <p>
            Puente es una plataforma de visibilidad solidaria. No somos una pasarela de pago, banco ni custodio.
            Los métodos de pago guardados son ingresados por quien publica para que los donantes transfieran de
            forma directa. Puente nunca procesa transferencias ni cobra comisiones de ningún tipo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">5. Cómo eliminar tu cuenta definitivamente</h2>
          <p>
            Tienes derecho total a la eliminación de tu información. Puedes eliminar tu cuenta de forma autónoma
            e inmediata desde <strong>Perfil → Cuenta y privacidad → Zona de peligro</strong>. Al confirmar con
            tu nombre de usuario, el sistema elimina en cascada tu perfil, tu número de contacto, tus causas, tus
            comentarios, tus métodos guardados y todos los archivos subidos a nuestro almacenamiento.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">6. No venta ni cesión de datos</h2>
          <p>
            Puente no comercializa, no alquila y no comparte tus datos personales con terceros con fines
            publicitarios o comerciales. No utilizamos rastreadores de terceros invasivos.
          </p>
        </section>
      </Glass>
    </div>
  );
}
