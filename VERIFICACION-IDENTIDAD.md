# Puente · VERIFICACION-IDENTIDAD.md

> **Para Claude Code:** función nueva, encima de lo que ya existe. Usa el **MCP de Supabase** para tablas, políticas y funciones. **No rediseñes nada:** toda la interfaz nueva se arma con los componentes y estilos que ya tiene el proyecto.

---

## 0. Prompt de integración de Didit

Este documento tiene dos partes:
- **El prompt de Didit (abajo):** manda en todo lo técnico de su API: crear la sesión, abrir la verificación con el SDK web, verificar la firma `X-Signature-V2` del webhook, los nombres exactos de los estados y la forma del evento.
- **El resto de este documento:** manda en todo lo de Puente: tablas en Supabase, comparación del titular, bloqueo al publicar, aviso emergente, teléfono obligatorio y privacidad.

**Reglas que resuelven los choques entre los dos:**
- `workflow_id` va **en el código** como constante, no en variables de entorno: `db13ea38-f263-4bd1-814b-9a8a1fa106b1`.
- El webhook vive en **`/api/webhooks/didit`**.
- La verificación se abre con el **modal del SDK web** (`@didit-protocol/sdk-web`).
- `vendor_data` es el **id de la persona en Supabase**, tomado de la sesión en el servidor, **nunca** de lo que mande el navegador.
- `callback`: `https://www.elpuentesh.org/verificacion/resultado`.
- Deduplica los webhooks por `event_id` con una tabla en Supabase con restricción única, no en memoria.
- **Las variables NO vienen en el prompt de Didit.** La persona dueña del proyecto ya las dejó en `.env.local` y en las variables de entorno de Vercel: `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET` y `VERIFICATION_PEPPER`. Léelas siempre con `process.env`, solo en el servidor, nunca con prefijo `NEXT_PUBLIC_`. Comprueba que existan **sin imprimir su valor**, y si falta alguna, detente y avisa.
- Si el prompt de Didit trae una clave real escrita, **ignórala y no la copies a ningún archivo**.

### Prompt de Didit (pegado por la persona dueña del proyecto)

```
PEGA AQUÍ EL PROMPT QUE GENERA DIDIT EN "INTEGRAR", SIN LA CLAVE DE API
```

---

## 1. Qué problema resuelve

Puente no recibe dinero ni intermedia: cada persona publica su causa y recibe las donaciones directo en sus propios medios de pago. Eso significa que **no estamos obligados a hacer KYC como una fintech**, pero también que el riesgo está en otro lado: alguien publica una causa falsa y el donante le transfiere directamente a un estafador.

Por eso la verificación no busca probar "esta persona existe", sino dos cosas:

1. **Quien publica es una persona real e identificable.**
2. **El titular de la cuenta que recibe el dinero es esa misma persona.**

La segunda es la que de verdad frena el fraude, y es la que hoy no existe.

---

## 2. Decisiones tomadas

Cámbialas aquí antes de ejecutar si no estás de acuerdo.

| # | Decisión |
|---|---|
| 0 | **El teléfono es obligatorio desde el registro**, sin código por SMS. Es un dato de contacto privado, no una verificación |
| 0b | **Recordatorio emergente al entrar:** si la persona no está verificada, al iniciar cada sesión le aparece un aviso para verificarse, que puede cerrar con `Ahora no` (sección 9.1) |
| 1 | **Verificar identidad sigue siendo obligatorio para publicar una causa,** aunque el aviso se haya cerrado. El aviso invita; el bloqueo al publicar es lo que protege. No hace falta para navegar, comentar, guardar ni avisar una donación |
| 2 | **Proveedor: Didit**, encapsulado detrás de una interfaz propia para poder cambiarlo sin tocar el resto |
| 3 | **Nunca guardamos fotos de documentos ni selfies.** Solo el resultado y metadatos |
| 4 | **El nombre verificado no es público.** Lo que ve el donante es una insignia y la frase de coincidencia, no el nombre del documento |
| 5 | **Un documento, una cuenta.** Se guarda un hash del número para impedir diez cuentas con la misma cédula |
| 6 | **La verificación vence a los 24 meses** |
| 7 | **Si el titular de la cuenta no coincide con el nombre verificado, la causa no se publica:** queda en revisión manual |
| 8 | **Nivel 2 (evidencia de la causa) y nivel 3 (organizaciones) quedan fuera de esta entrega.** Solo se deja el campo preparado |

---

## 3. Niveles

| Nivel | Qué se verifica | Qué permite | Insignia |
|---|---|---|---|
| 0 | Cuenta de Google y teléfono (ya existe) | Ver, comentar, guardar, avisar una donación | — |
| 1 | **Documento oficial + prueba de vida + coincidencia facial** | **Publicar una causa** | "Identidad verificada" |
| 2 | Evidencia de la causa revisada a mano | Destacar en Explorar | "Causa revisada" |
| 3 | Organizaciones: NIT o RUT en Colombia, CIF en España | Perfil de organización | "Organización verificada" |

En esta entrega se implementa el **nivel 1** completo, y la base de datos queda preparada para los otros dos.

---

## 4. Proveedor

**Didit**, por costo y porque cubre documento, prueba de vida y coincidencia facial en una sola llamada.

Dos avisos de tiempo, que importan porque hoy es 27 de octubre de 2026:

- Didit **cambia de precios el 1 de noviembre de 2026**. Hasta entonces el plan gratuito da 500 verificaciones al mes. Desde esa fecha pasa a un plan `Free` sin cuota mensual ni mínimo, con **10 dólares de crédito gratis al mes** y pago por uso al precio de lista.
- Didit calcula que un flujo completo de KYC (documento, prueba de vida pasiva, coincidencia facial 1:1 y análisis de IP) cuesta unos **0,33 dólares**. Es su propio dato, así que tómalo como referencia, no como garantía.

Con esos números, los 10 dólares mensuales dan para unas 30 verificaciones, que para el volumen de hoy alcanza de sobra. **Antes de integrar, el agente debe leer la documentación y la página de precios vigentes**, porque esto cambia en cinco días.

**Alternativa si Didit no sirve:** Stripe Identity, más caro pero muy estable. Por eso todo va detrás de una interfaz propia.

---

## 5. Base de datos · migración `016_verificacion_identidad`

```sql
create type public.verification_status as enum
  ('pendiente', 'aprobada', 'rechazada', 'en_revision', 'vencida');

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'didit',
  provider_session_id text unique,
  status public.verification_status not null default 'pendiente',
  level smallint not null default 1,
  verified_full_name text,       -- privado, nunca público
  document_country text,         -- ISO alfa-2
  document_hash text,            -- sha256(numero + PEPPER). Nunca el número
  decline_reason text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index on public.identity_verifications (user_id, created_at desc);
-- Un documento, una cuenta
create unique index identidad_documento_unico
  on public.identity_verifications (document_hash)
  where status = 'aprobada' and document_hash is not null;

-- Bandera pública derivada: lo único que ve el resto del mundo
alter table public.profiles
  add column if not exists identity_verified boolean not null default false,
  add column if not exists identity_verified_at timestamptz;

-- Resultado de la comparación de titularidad, por causa
alter table public.causes
  add column if not exists holder_match boolean,
  add column if not exists holder_checked_at timestamptz;
```

**RLS y permisos:**
- `identity_verifications`: `select` **solo la dueña**. Ni `insert`, ni `update`, ni `delete` desde el cliente: todo lo escribe el webhook con la llave secreta del servidor.
- `profiles.identity_verified` e `identity_verified_at`: públicos de lectura, **fuera** de cualquier `grant update`. Solo los escribe el webhook.
- `causes.holder_match` y `holder_checked_at`: públicos de lectura, fuera de los `grant update`. Solo los escribe la función de comparación.

---

## 6. Comparar el titular de la cuenta con el nombre verificado

Es el corazón del sistema.

```sql
create or replace function public.titular_coincide(p_verificado text, p_titular text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  a text; b text; toks_a text[]; toks_b text[]; comunes int;
begin
  if p_verificado is null or p_titular is null then return false; end if;
  a := lower(extensions.unaccent(trim(p_verificado)));
  b := lower(extensions.unaccent(trim(p_titular)));
  a := regexp_replace(a, '\m(de|del|la|las|los|y|da|dos)\M', ' ', 'g');
  b := regexp_replace(b, '\m(de|del|la|las|los|y|da|dos)\M', ' ', 'g');
  toks_a := array(select t from unnest(regexp_split_to_array(a, '\s+')) t where length(t) >= 3);
  toks_b := array(select t from unnest(regexp_split_to_array(b, '\s+')) t where length(t) >= 3);
  if array_length(toks_a, 1) is null or array_length(toks_b, 1) is null then return false; end if;
  select count(*) into comunes from unnest(toks_b) t where t = any (toks_a);
  -- Coincide si al menos 2 palabras largas son iguales, o si el titular es un subconjunto del nombre
  return comunes >= 2 or comunes = array_length(toks_b, 1);
end $$;
```

**Función que revisa toda la causa:**

`public.revisar_titularidad(p_cause_id uuid)`, `security definer`:
1. Trae el nombre verificado vigente de la autora.
2. Compara contra el `account_holder` de **cada** método de pago de la causa.
3. Guarda `holder_match = true` solo si **todos** coinciden, y `holder_checked_at = now()`.
4. Devuelve el resultado.

**Cuándo se ejecuta:**
- Al publicar la causa, dentro de `enforce_cause_status`.
- Cada vez que se agrega, edita o borra un método de pago de una causa activa, con un trigger. Si deja de coincidir, la causa pasa a revisión (sección 7).

---

## 7. Qué bloquea qué

**Publicar una causa** exige dos cosas, y las dos se comprueban en el trigger `enforce_cause_status`, no solo en la interfaz:

```sql
-- Dentro de la transición borrador → activa
if not exists (
  select 1 from public.identity_verifications v
  where v.user_id = new.author_id and v.status = 'aprobada'
    and (v.expires_at is null or v.expires_at > now())
) then
  raise exception 'REQ_VERIFICACION' using errcode = 'P0001';
end if;

if not public.revisar_titularidad(new.id) then
  raise exception 'REQ_TITULAR' using errcode = 'P0001';
end if;
```

**Mensajes en la interfaz:**

| Código | Mensaje | A dónde lleva |
|---|---|---|
| `REQ_VERIFICACION` | Verifica tu identidad para publicar tu causa. Toma unos 2 minutos. | `/verificacion?next=/causa/nueva` |
| `REQ_TITULAR` | El titular de tu cuenta debe coincidir con el nombre de tu documento. Revisa tus métodos de pago. | Paso 4 del asistente |

**Si una causa ya publicada cambia de método de pago y deja de coincidir:** no se oculta sola, pero deja de mostrar la frase de coincidencia y aparece, en la causa y en `Mis causas`, un aviso para la autora: "Revisa tus métodos de pago: el titular no coincide con tu identidad verificada."

---

## 8. Integración con el proveedor

### 8.1 Adaptador

`src/lib/identity/provider.ts`, una interfaz con tres métodos:
- `crearSesion({ userId, callbackUrl })` → `{ url, sessionId }`
- `verificarFirma(cuerpoCrudo, cabeceras)` → `boolean`
- `leerEvento(cuerpoCrudo)` → estado normalizado, nombre, país y número de documento

`src/lib/identity/didit.ts` implementa la interfaz. **Ningún otro archivo del proyecto habla con Didit.**

### 8.2 Iniciar la verificación

Server Action, nunca desde el navegador:
1. Comprueba sesión y registro completo.
2. Si ya hay una verificación aprobada y vigente, no crea otra.
3. Crea la sesión con el proveedor, guarda la fila en `pendiente` y devuelve la URL.
4. La persona va al flujo del proveedor y vuelve a `/verificacion/resultado`.

### 8.3 Webhook, la única fuente de verdad

`src/app/api/webhooks/didit/route.ts` (firma `X-Signature-V2` como indica el prompt de Didit):
- **Nunca** marques a nadie como verificado por la vuelta del redirect: eso se falsifica.
- Verifica la firma HMAC con comparación en tiempo constante, leyendo el **cuerpo crudo**.
- `export const runtime = 'nodejs'` y `export const dynamic = 'force-dynamic'`.
- **Exclúyelo de `proxy.ts`:** el webhook no trae sesión.
- Usa `SUPABASE_SECRET_KEY`, en un módulo con `import 'server-only'`.
- **Idempotente:** si el mismo `provider_session_id` llega dos veces, no duplica nada.
- Al aprobar:
  1. guarda estado, nombre verificado, país, `document_hash` y `expires_at = now() + 24 meses`;
  2. si el hash ya estaba aprobado para **otra** persona, deja la verificación en `en_revision` y no aprueba;
  3. marca `profiles.identity_verified = true`;
  4. vuelve a ejecutar `revisar_titularidad` sobre los borradores de esa persona.
- Responde `200` siempre que haya procesado, aunque el evento sea de un estado que no manejas.

### 8.4 Variables de entorno

Las agrega la persona dueña del proyecto en `.env.local` y en Vercel. Ninguna lleva `NEXT_PUBLIC_`:

```
DIDIT_API_KEY=
DIDIT_WEBHOOK_SECRET=
VERIFICATION_PEPPER=     # cadena larga y aleatoria, no se cambia nunca
```

El flujo de Didit ya existe ("Free KYC") y lo configuró la persona dueña del proyecto. **No crees otro por API.** Su `workflow_id` va como constante en el código (sección 0).

La URL del webhook ya registrada en Didit es: `https://www.elpuentesh.org/api/webhooks/didit`.

---

## 9. Interfaz

Todo con componentes existentes.

### 9.1 Recordatorio emergente al entrar

- **Cuándo aparece:** una vez por sesión, en la primera página que cargue la persona después de iniciar sesión, si no tiene una verificación `aprobada` y vigente. No en cada cambio de página.
- **Cómo se decide:** el layout raíz ya consulta el perfil en el servidor; agrega `identity_verified` a esa consulta y pásalo al cliente. El aviso se marca como visto en `sessionStorage` (dentro de `try/catch`), así reaparece en la siguiente sesión.
- **Dónde no aparece:** `/bienvenida`, `/verificacion`, `/verificacion/resultado`, `/auth/**`, `/terminos` y `/privacidad`. Tampoco si la verificación está `pendiente` o `en_revision`: en ese caso, si acaso, una línea en el perfil diciendo que está en curso.
- **Contenido:** usa la hoja o modal de vidrio que ya existe.
  - Título: "Verifica tu identidad".
  - Texto: "Toma unos 2 minutos: una foto de tu documento y un video corto de tu cara. Lo necesitas para publicar causas y da confianza a quienes te apoyan."
  - Botones: `Verificar ahora`, que lleva a `/verificacion`, y `Ahora no`, que lo cierra.
- **Accesibilidad:** `role="dialog"`, foco atrapado, Escape cierra.

### 9.2 Pantallas

**`/verificacion`:**
- qué se va a pedir y cuánto tarda;
- **consentimiento obligatorio**, con el nombre del proveedor, el país donde procesa los datos y el enlace a la política de privacidad;
- botón `Verificar mi identidad`;
- estados: pendiente, aprobada, rechazada con su motivo, en revisión.

**`/verificacion/resultado`:** no decide nada. Muestra "Estamos confirmando tu verificación" y consulta el estado real, que llega por el webhook.

**Perfil → `Mis datos`:** una línea con el estado y la fecha de vencimiento, y el botón para verificar o renovar.

**Causa, junto a los métodos de pago:** cuando `identity_verified` y `holder_match` son ciertos, la frase: "Identidad verificada. El titular de esta cuenta coincide con el documento verificado." Si no, no se muestra nada: **no inventes una insignia negativa**, basta con la ausencia.

**Tarjetas y perfil público:** la insignia "Identidad verificada" junto al nombre, con el icono de verificado que ya existe.

**Aviso permanente, donde ya está el de no procesar pagos:** "Puente verifica identidades, pero no garantiza el uso de los fondos."

---

## 9.3 Teléfono obligatorio desde el registro

- En `/bienvenida`, el número de contacto pasa de opcional a **obligatorio**, con el mismo selector de país y la validación de `libphonenumber-js`. Texto de ayuda: "Privado. Solo lo usamos para contactarte sobre tu cuenta o tus causas."
- **Sin código por SMS.** No se verifica el número; por eso nunca se muestra como "verificado".
- `complete_onboarding`: el parámetro `p_phone` deja de aceptar nulo y lanza `REG_TELEFONO` si falta o es inválido. Deja **una sola versión** de la función.
- **Cuentas existentes sin teléfono:** el layout raíz las manda a `/bienvenida` para completarlo, igual que a quien no terminó el registro.
- Comprueba con SQL cuántas cuentas no tienen teléfono antes y después, y repórtalo.

## 10. Suspensión por reportes

Barato y complementa la verificación. Con la tabla `reports` que ya existe:
- al llegar **3 reportes de personas distintas** sobre la misma causa, la causa pasa a `oculta` automáticamente;
- la autora lo ve en `Mis causas` con el motivo;
- se levanta solo a mano, desde la base.

---

## 11. Privacidad y aspectos legales

- **Nunca** guardes imágenes de documentos ni selfies. Solo el resultado.
- `verified_full_name` y `document_hash` **no salen** en ninguna respuesta pública ni en el perfil público.
- Al eliminar la cuenta se borran también las filas de verificación.
- La política de privacidad debe decir qué proveedor procesa los datos, en qué país, qué se guarda y por cuánto tiempo.
- **Esto no es asesoría legal.** Antes de lanzar en Colombia y España conviene que un abogado revise la política de tratamiento de datos, el registro ante la SIC si aplica y el contrato de encargado de tratamiento con el proveedor, porque los datos biométricos tienen protección especial bajo el RGPD.

---

## 12. Verificación antes del push

Sin navegador.

**Con transacción y `rollback`:**
1. Publicar sin verificación aprobada falla con `REQ_VERIFICACION`.
2. Con verificación aprobada pero titular distinto, falla con `REQ_TITULAR`.
3. Con verificación aprobada y titular coincidente, publica y deja `holder_match = true`.
4. `titular_coincide` devuelve cierto para "Juan Andrés Vásquez Mena" contra "JUAN VASQUEZ", y falso contra "María Gómez".
5. Una verificación vencida no habilita publicar.
6. Un `document_hash` ya aprobado en otra cuenta no aprueba la segunda.

**Webhook, con `curl` contra producción:**
- con firma inválida → `401` y nada cambia en la base;
- con firma válida y evento de prueba → la fila pasa a `aprobada` y `profiles.identity_verified` queda en cierto;
- el mismo evento repetido no duplica nada.

**Lectura pública, con `curl` y la llave pública:**
- `identity_verifications` no devuelve nada;
- `profiles?select=identity_verified` sí; `profiles?select=verified_full_name` no existe.

**Local:** `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## 13. Orden de trabajo

1. **Leer la documentación y los precios vigentes de Didit** y confirmar el nombre exacto de la cabecera de firma y el formato de sus eventos. Reportar lo que encuentre antes de codificar.
2. Migración `016` completa, advisors y tipos.
3. Adaptador y webhook.
4. Pantallas de `/verificacion` y el estado en el perfil.
5. Bloqueo al publicar y comparación de titularidad.
6. Insignias y frase de coincidencia.
7. Suspensión por reportes.
8. Verificación de la sección 12, commit y push.

**Las claves no se pegan en el chat.** La persona dueña del proyecto las pone directamente en `.env.local` y en las variables de entorno de Vercel, y avisa cuando estén. El agente solo comprueba que existan, sin imprimir su valor.

**Paso adicional, antes del 4:** teléfono obligatorio en la bienvenida (sección 9.3). **Paso adicional, después del 4:** recordatorio emergente (sección 9.1).

**Reporte final:** precios y documentación confirmados, migraciones aplicadas, resultado de cada prueba de la sección 12 pegado tal cual, y la lista de lo que debe probarse en línea.
