# Puente · AJUSTES-BUGS-4.md

> **Para Claude Code:** este documento manda sobre los anteriores. Dos bugs y dos funciones nuevas. Usa el **MCP de Supabase** para todo lo que toque tablas, políticas, funciones y permisos.

---

## 0. Reglas

1. **No rediseñes.** Los únicos cambios visuales permitidos son los que pide este documento, y se hacen **reutilizando componentes y estilos que ya existen** en el proyecto.
2. **Prohibido tapar errores.** Ningún cargador puede quedarse girando: o muestra el dato, o muestra el mensaje real del error con un botón para reintentar.
3. **Base de datos siempre por MCP:** `apply_migration` para esquema, `execute_sql` solo para consultar y probar, `get_advisors` al final y `generate_typescript_types` después de cada migración.
4. **Las pruebas de escritura van dentro de una transacción con `rollback`,** como en la ronda pasada.
5. **No abras navegadores.** Verificas con `npx tsc --noEmit`, `npm run lint`, `npm run build`, consultas por MCP y `curl` contra el sitio.
6. **Entrega:** un commit por bloque, push a `main` de `https://github.com/St4keholders/El-puente` y reporte final.

---

## 1. Bug · Selector de país y lista de ciudades

### 1.1 El selector de país no se lee

Es un `<select>` nativo. En modo oscuro, el sistema dibuja la lista desplegable con sus propios colores y queda ilegible.

**Arreglo, en este orden:**

1. **Reutiliza el selector de país que ya existe** en la columna de filtros de los feeds. Ese tiene buscador, muestra los nombres en español y ya está con el estilo del sitio. Es el mismo dato, `mundo.json`. **No inventes un componente nuevo.**
2. **Si por alguna razón hay que dejar el `<select>` nativo**, entonces declara `color-scheme` acorde al tema en la raíz del documento y define color de fondo y de texto en `option`. Es lo mínimo para que el sistema dibuje la lista legible.

### 1.2 La lista de ciudades se monta encima de los botones

En la captura, las sugerencias se cruzan con los botones `Anterior` y `Siguiente`, y el texto queda ilegible.

**Cómo debe quedar la lista:**
- **Flotante y por encima de todo lo demás:** posición absoluta respecto al campo, con fondo opaco (no traslúcido), borde y sombra, y un `z-index` mayor que el de los botones del asistente.
- **Nunca empuja ni tapa** los botones del paso: la lista se dibuja encima, y al cerrarse todo queda igual.
- **Altura máxima con scroll propio**, para listas largas.
- **Cada fila en dos partes:**
  - a la izquierda, el nombre de la ciudad y debajo, más pequeño, la región o departamento si el proveedor lo entrega;
  - a la derecha, **el país** en español, por ejemplo `Colombia` o `España`.
- **Fuera las coordenadas de la vista.** Se siguen guardando, pero no se muestran. Hoy aparece `5.69°, -76.65°`, que no le dice nada a nadie.
- **La opción de escribir a mano** va siempre al final, separada por una línea, con el texto que ya tiene.

**Por qué el país y no la latitud:** hay muchas ciudades con el mismo nombre. Buscando "Madrid" deben poder distinguirse `Madrid · España`, `Madrid · Colombia` y `Madrid · Estados Unidos`.

**Nota:** el nombre del país sale de `mundo.json`, a partir del código que ya devuelve el geocoder. Si un resultado viene sin código de país, muestra solo la ciudad.

**Criterio de aceptación:** buscando "madrid" sin filtrar país se distinguen los distintos Madrid por su país, y la lista no se cruza con ningún botón.

---

## 2. Bug · "Registrar apoyo recibido" no guarda

En la captura, el botón se queda en "Guardando…" y el monto no se guarda.

### 2.1 Causa muy probable

`confirm_support` es `security invoker`, así que corre con los permisos de la persona. En la ronda pasada dejamos **permisos por columna** en `causes`, y `first_support_confirmed_at` **no está** entre las columnas que `authenticated` puede actualizar. El `update` falla con `42501` y, como el error no se muestra, el botón se queda girando.

**Compruébalo antes de cambiar nada:**

```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'causes' and privilege_type = 'UPDATE'
order by grantee, column_name;
```

### 2.2 Arreglo

- **`confirm_support` pasa a `security definer`,** con sus verificaciones explícitas dentro: que haya sesión, que la causa sea de quien llama y que esté en `activa` o `cerrada`. Así puede escribir `first_support_confirmed_at` sin que esa columna quede abierta al cliente, que es justo lo que queremos.
- **No agregues `first_support_confirmed_at` a los permisos por columna.** Esa fecha solo la escribe la función.
- **El diálogo muestra el error real** si la llamada falla, y el botón vuelve a estar disponible.

**Verificación:** dentro de una transacción con `rollback`, haciéndote pasar por la autora de una causa, llama a `confirm_support` con un monto y con un insumo, y comprueba que `raised_reported`, `quantity_received` y `first_support_confirmed_at` cambian. Pégame el resultado.

---

## 3. Nuevo · Avisos de donación y agradecimiento

La idea: quien dona avisa cuánto envió, quien publica confirma que lo recibió y le responde con un agradecimiento público. Sin pasarelas, sin plazos, sin que la plataforma toque el dinero.

### 3.1 El flujo

1. **En la causa, quien quiera donar** ve el botón `Ya hice mi donación`, junto a los métodos de pago.
2. **Formulario corto:**
   - si la causa pide dinero: monto y moneda;
   - si pide insumos: qué entregó, eligiendo de la lista de insumos de la causa y su cantidad;
   - mensaje opcional de hasta 500 caracteres;
   - casilla `Prefiero aparecer como anónimo`.
3. **Queda como aviso pendiente.** No aparece en público y no suma nada todavía.
4. **Quien publicó la causa lo ve** en su perfil, en una sección nueva llamada `Apoyos`, y en la propia causa. El botón `Perfil` del header muestra el punto azul que ya existe cuando hay avisos pendientes.
5. **Puede hacer dos cosas:**
   - **Confirmar que lo recibió**, y escribir un agradecimiento de hasta 500 caracteres;
   - **marcar que no lo recibió**, y el aviso se archiva sin sumar nada.
6. **Al confirmar:**
   - el monto se suma al total reportado, o la cantidad se suma al insumo correspondiente;
   - la causa queda marcada con apoyo confirmado, así que ya solo se puede cerrar, no borrar;
   - **el apoyo aparece en público** en la causa, en una sección `Apoyos confirmados`: nombre de quien donó, o "Anónimo", lo que aportó, cuándo, su mensaje y el agradecimiento.
7. **Quien donó ve el estado de su aviso** en `Apoyos`, dentro de su perfil.

### 3.2 Reglas y límites

- **Solo con cuenta registrada.** Quien no tenga cuenta ve el botón, y al tocarlo va a `/entrar`.
- **Nadie puede reportarse apoyo a sí mismo:** si quien avisa es la autora de la causa, se rechaza.
- **Solo en causas activas.**
- **Máximo 5 avisos por persona y por causa en 24 horas**, para frenar el spam.
- **Mientras está pendiente,** quien avisó puede borrar su propio aviso. Después de confirmado, no.
- **Todo es declarado por las personas.** En la sección pública va esta línea, con el mismo estilo de los avisos que ya existen: "Los apoyos los reportan y confirman las propias personas. Puente no verifica los pagos ni las entregas."
- **El botón `Registrar apoyo recibido`** que ya existe se queda: sirve para donaciones que llegaron sin aviso.

### 3.3 Esquema

```sql
create type public.support_kind   as enum ('dinero', 'insumos');
create type public.support_status as enum ('reportado', 'confirmado', 'no_recibido');

create table public.support_reports (
  id uuid primary key default gen_random_uuid(),
  cause_id uuid not null references public.causes(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  kind public.support_kind not null,
  amount numeric(12,2) check (amount is null or amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  items jsonb,                                   -- [{ "supply_id": "...", "quantity": 5 }]
  message text check (message is null or char_length(message) <= 500),
  is_anonymous boolean not null default false,
  status public.support_status not null default 'reportado',
  thanks_message text check (thanks_message is null or char_length(thanks_message) <= 500),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint aviso_coherente check (
    (kind = 'dinero'  and amount is not null) or
    (kind = 'insumos' and items is not null)
  )
);
create index on public.support_reports (cause_id, status, created_at desc);
create index on public.support_reports (donor_id, created_at desc);

alter table public.support_reports enable row level security;
```

**Políticas, una por comando:**

| Comando | Quién |
|---|---|
| `select` | Quien avisó, la autora de la causa, y **cualquiera** si el estado es `confirmado` y la causa es visible |
| `insert` | Con sesión y registro completo, `donor_id` propio, causa en `activa` y **no** ser la autora |
| `update` | Nadie desde el cliente: los cambios de estado pasan por las funciones |
| `delete` | Quien avisó, solo mientras el estado sea `reportado` |

**Permisos por columna en `insert`:** `cause_id`, `donor_id`, `kind`, `amount`, `currency`, `items`, `message`, `is_anonymous`. Nada más.

**Trigger antispam:** `before insert`, si ya hay 5 avisos de esa persona en esa causa en las últimas 24 horas, lanza `LIMITE_AVISOS`.

### 3.4 Funciones

Las dos son `security definer`, con sus verificaciones dentro, y solo para `authenticated`.

**`confirmar_aviso(p_report_id uuid, p_thanks text default null)`**
1. Bloquea la fila del aviso y trae la causa.
2. Falla si quien llama no es la autora (`NO_ES_TU_CAUSA`) o si el aviso ya se resolvió (`AVISO_YA_RESUELTO`).
3. Marca `status = 'confirmado'`, `confirmed_at = now()` y guarda el agradecimiento.
4. Si es dinero: `raised_reported = coalesce(raised_reported, 0) + amount`.
5. Si son insumos: suma cada cantidad al `quantity_received` del insumo, sin pasarse de lo necesario si hay meta.
6. En ambos casos: `first_support_confirmed_at = coalesce(first_support_confirmed_at, now())`.

**`rechazar_aviso(p_report_id uuid)`**
- Mismas verificaciones, deja `status = 'no_recibido'` y no suma nada.

### 3.5 Interfaz

Todo con componentes que ya existen: las hojas de vidrio de los formularios, las tarjetas y los avisos.

- **Causa:** botón `Ya hice mi donación` junto a los métodos, y la sección `Apoyos confirmados` debajo, antes de los comentarios.
- **Perfil → `Apoyos`:** dos pestañas, `Recibidos` con los avisos de sus causas (pendientes arriba, con `Confirmar` y `No lo recibí`) y `Enviados` con los propios y su estado.
- **Punto azul en `Perfil`** cuando hay avisos pendientes. Es el indicador que ya existe; no agregues una campana ni cambies el header.

---

## 4. Nuevo · Fotos en comentarios y ventana de una hora

### 4.1 Fotos

- **Hasta 2 imágenes por comentario.** Sin videos.
- Se comprimen en el navegador antes de subir: lado mayor 1200 px, WebP calidad 0,8. Eso también borra los metadatos EXIF.
- Se guardan en el bucket `causas-imagenes`, en `{uid}/comentarios/{comment_id}/{uuid}.webp`, así siguen valiendo las políticas de Storage que ya existen.
- En el comentario se ven como miniaturas; al tocarlas se abre el visor que ya usa la galería de la causa.
- Si la subida falla, el comentario se publica igual y se avisa que la foto no se pudo subir.

```sql
create table public.comment_media (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null default 'causas-imagenes',
  storage_path text not null unique,
  width int, height int, bytes int,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index on public.comment_media (comment_id, position);
alter table public.comment_media enable row level security;
```

**Políticas:** se lee si su comentario es visible; inserta y borra solo la dueña, y solo dentro de la ventana de una hora del comentario. Máximo 2 por comentario, con un trigger.

### 4.2 Una hora para editar o borrar

- **Quien comentó** puede editar o borrar su comentario **durante una hora** desde que lo publicó. Después, no.
- **La autora de la causa** puede borrar cualquier comentario de su causa **en cualquier momento**. Es su única herramienta de moderación y se queda.
- La regla vive en las políticas y además en un trigger, para que no dependa solo de la interfaz:
  - `update`: `author_id = uid and created_at > now() - interval '1 hour'`;
  - `delete`: lo anterior, **o** ser la autora de la causa.
- **En la interfaz:** los botones `Editar` y `Eliminar` solo aparecen dentro de la hora. Debajo del campo de escribir, una línea pequeña: "Puedes editar o borrar tu comentario durante una hora."
- **Si alguien lo intenta fuera de plazo,** el mensaje es: "Ya pasó la hora para editar o borrar este comentario."

---

## 5. Migración `015_apoyos_y_comentarios`

Una sola migración con todo lo de las secciones 2, 3 y 4:
1. `confirm_support` pasa a `security definer` con sus verificaciones.
2. Tipos, tabla, índices, políticas y trigger antispam de `support_reports`.
3. Funciones `confirmar_aviso` y `rechazar_aviso`.
4. Tabla `comment_media` con sus políticas y su límite de 2.
5. Políticas de `comments` con la ventana de una hora, y el trigger que la respalda.
6. `set_updated_at` donde haga falta.

Al terminar: `get_advisors` de seguridad y rendimiento, y `generate_typescript_types`.

---

## 6. Verificación antes del push

**Con transacción y `rollback`, haciéndote pasar por usuarias reales:**
1. `confirm_support` con monto y con insumos actualiza los tres campos.
2. Una persona registra un aviso en una causa ajena: entra como `reportado` y **no** cambia el total público.
3. La misma persona intenta un sexto aviso en 24 horas: falla con `LIMITE_AVISOS`.
4. La autora llama a `confirmar_aviso` con agradecimiento: el aviso queda `confirmado`, el total sube y `first_support_confirmed_at` queda con fecha.
5. Alguien que no es la autora llama a `confirmar_aviso`: falla con `NO_ES_TU_CAUSA`.
6. Editar un comentario de hace dos horas: rechazado. Editar uno recién creado: permitido.
7. Borrar un comentario ajeno siendo la autora de la causa: permitido.

**Con `curl`, sin sesión:**
- `support_reports` solo devuelve los confirmados;
- los comentarios se siguen viendo;
- `donation_methods` sigue sin devolver datos.

**Local:** `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## 7. Decisiones tomadas

Cámbialas aquí si no estás de acuerdo:

1. **La autora de la causa puede borrar comentarios sin límite de tiempo.** Sin eso, no tendría cómo quitar un comentario abusivo pasada una hora.
2. **Los avisos pendientes no son públicos.** Solo los ve quien avisó y la autora. Si fueran públicos, cualquiera podría inflar una causa con avisos falsos.
3. **Confirmar suma al total.** El botón `Registrar apoyo recibido` sigue existiendo para lo que llegó sin aviso, y ahí el monto se escribe completo, no se suma.
4. **Los avisos no se pueden editar,** solo borrar mientras están pendientes. Es más simple y evita que alguien cambie el monto después de confirmado.
5. **Anónimo significa que no se muestra el nombre en público.** La autora sí sabe quién fue: necesita poder cruzarlo con lo que recibió.

---

## 8. Orden de trabajo

1. Bug del selector de país y la lista de ciudades (sección 1).
2. Bug de `Registrar apoyo recibido` (sección 2), con su verificación.
3. Migración `015` completa (sección 5).
4. Avisos de donación: causa y perfil (sección 3.5).
5. Fotos en comentarios y ventana de una hora (sección 4).
6. Verificación (sección 6), commit y push.

**Reporte final:** qué estaba mal en `Registrar apoyo recibido`, qué migraciones aplicaste, el resultado de cada prueba de la sección 6 pegado tal cual, y la lista de lo que debo probar en línea.
