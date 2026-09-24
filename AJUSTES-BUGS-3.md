# Puente · AJUSTES-BUGS-3.md

> **Para Claude Code:** este documento manda sobre los anteriores. Son cuatro arreglos concretos más una barrida de bugs. **Nada de cambios estéticos**, nada de funciones nuevas. Usa el **MCP de Supabase** para todo lo que toque tablas, columnas, políticas, funciones y permisos.

---

## 0. Reglas

1. **No cambies el diseño.** Ni colores, ni tipografías, ni espaciados, ni la estructura de ninguna pantalla. Los dos cambios visuales permitidos son los que pide este documento: quitar el nombre de usuario y quitar el bloque de "Requisitos de activación". Cuando reemplaces algo, usa el mismo estilo del elemento que quitas.
2. **Nada de funciones nuevas.** Solo lo que está aquí.
3. **Base de datos, siempre con el MCP de Supabase:** `apply_migration` para cambios de esquema, `execute_sql` solo para consultar y para datos, `get_advisors` al terminar y `generate_typescript_types` después de cada migración.
4. **Prohibido tapar errores.** Nada de `catch` vacíos, ni temporizadores que digan "tardó demasiado", ni valores de relleno. Cuando algo falle, muestra el mensaje y manda `error.code` y `error.message` a la consola.
5. **No abras navegadores.** Verifica con: `npx tsc --noEmit`, `npm run lint`, `npm run build`, consultas por MCP y `curl` contra el sitio desplegado.
6. **Entrega:** un commit por bloque, push a `main` de `https://github.com/St4keholders/El-puente`, y un reporte final con el resultado de cada verificación.

---

## 1. Bug · La foto de perfil no cambia

**Síntoma:** en `Mis datos` se sube una foto con `Cambiar foto`, pero sigue apareciendo el círculo con las iniciales, tanto ahí como en el header y en las tarjetas.

### 1.1 Revisa los seis puntos de la cadena, en orden

1. **¿La subida llega al bucket?** La ruta debe empezar con el id de la persona: `{uid}/avatar-{timestamp}.webp` en el bucket `avatares`. Si la ruta no empieza por el uid, la política de Storage la rechaza.
2. **¿El nombre del archivo cambia en cada subida?** Si siempre se llama igual y se sube con `cacheControl` largo, el CDN y el navegador siguen mostrando la anterior. Por eso lleva `timestamp`. Borra el archivo anterior después de guardar el nuevo.
3. **¿Se actualiza la fila en `profiles`?** Comprueba con el MCP que `avatar_url` cambió de verdad:
   ```sql
   select id, full_name, avatar_url from public.profiles;
   ```
4. **¿Los permisos por columna incluyen `avatar_url`?** Si no está en el `grant update`, el update falla con "permission denied for column". Debe existir:
   ```sql
   grant update (full_name, avatar_url, bio, country_code, city) on public.profiles to authenticated;
   ```
5. **¿Todos leen el mismo campo?** El header, la barra lateral, `Mis datos`, las tarjetas y los comentarios tienen que usar **una sola** función para armar la URL.
6. **¿El dominio de Supabase está permitido para imágenes?** Si usas `next/image`, el host de Storage debe estar en `remotePatterns` de `next.config`. Si no, la imagen falla y se cae al círculo de iniciales.

### 1.2 Cómo debe quedar

- **Una sola función**, `urlDeAvatar(valor)` en `src/lib/media.ts`:
  - si el valor empieza por `http`, lo devuelve tal cual (es la foto de Google);
  - si no, arma la URL pública del bucket a partir de la ruta guardada.
- **La foto se procesa antes de subir:** recorte cuadrado, 512 px, WebP calidad 0,85. Eso también borra los metadatos EXIF.
- **Orden de la operación,** dentro de una Server Action:
  1. sube el archivo nuevo;
  2. actualiza `profiles.avatar_url`;
  3. borra el archivo anterior si era del propio bucket;
  4. llama a `revalidatePath('/perfil')` y refresca, para que el header y la barra lateral muestren la foto nueva sin recargar a mano.
- **Si cualquiera de los pasos falla,** la interfaz lo dice y no se queda "guardando".
- **Botón `Quitar foto`:** deja `avatar_url` en `null` y vuelve a las iniciales.

**Criterio de aceptación:** después de cambiar la foto, la consulta del punto 3 muestra la ruta nueva, y la foto se ve en `Mis datos`, en el header, en el perfil público y en las tarjetas.

---

## 2. Cambio · Se elimina el nombre de usuario y entra un ID público

**Cómo queda la identidad de una persona:**
- **Nombre y apellidos:** es lo que ven los demás. Obligatorio, mínimo dos palabras.
- **ID público:** un código alfanumérico corto, único, que se genera solo y **no se puede editar**. Sirve para identificar a alguien y para la dirección de su perfil.
- **El `@usuario` desaparece** de toda la interfaz y de la base.

**Formato del ID:** `PNT-XXXXXX`, con seis caracteres de un alfabeto sin letras confundibles (sin `O`, `0`, `I`, `1`, `L`).

### 2.1 Migración `014_id_publico`

```sql
-- Generador
create or replace function public.gen_public_id()
returns text language sql volatile set search_path = '' as $$
  select 'PNT-' || string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1), ''
  ) from generate_series(1, 6);
$$;

alter table public.profiles add column if not exists public_id text;

-- Relleno con reintento por si hay colisión
do $$
declare r record; nuevo text;
begin
  for r in select id from public.profiles where public_id is null loop
    loop
      nuevo := public.gen_public_id();
      exit when not exists (select 1 from public.profiles where public_id = nuevo);
    end loop;
    update public.profiles set public_id = nuevo where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_public_id_key on public.profiles (public_id);
alter table public.profiles alter column public_id set not null;
alter table public.profiles alter column public_id set default public.gen_public_id();
```

**El ID nunca lo edita la persona:** no lo incluyas en ningún `grant update`. Agrega además un trigger `before update` que lance `ID_INMUTABLE` si alguien intenta cambiarlo.

### 2.2 Limpieza del nombre de usuario

**Primero cambia el código, después borra la columna.** Orden:

1. Busca todo lo que use el usuario:
   ```bash
   grep -rn "username" src app 2>/dev/null
   ```
2. Reemplaza:
   - **el perfil público** pasa de `/u/[username]` a `/u/[publicId]`;
   - **la barra lateral y el header** muestran el nombre y, debajo, el ID con el botón `Copiar` que ya existe;
   - **las tarjetas, comentarios e historias** muestran solo el nombre;
   - **el buscador** busca por nombre y por ID.
3. **Formulario de bienvenida:** quita el campo de usuario. Quedan foto, nombre y apellidos, teléfono, país y ciudad, y la casilla de términos. Debajo del nombre, un texto pequeño: "Tu ID será **PNT-XXXXXX**. Sirve para que te identifiquen y no se puede cambiar."
4. **`Mis datos`:** el campo `Nombre de usuario` se reemplaza, **en el mismo lugar y con el mismo estilo**, por `ID público`, de solo lectura y con su botón `Copiar`.
5. **Funciones de la base que sobran:** elimina `username_available`, `username_is_valid` y el trigger que validaba el usuario al actualizar.
6. **`complete_onboarding`:** deja **una sola** versión, ahora con tres parámetros: `p_full_name`, `p_phone`, `p_terms_version`. Antes de crearla, lista y borra todas las versiones anteriores:
   ```sql
   select p.proname, pg_get_function_identity_arguments(p.oid)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_onboarding';
   ```
   La nueva versión valida que el nombre tenga al menos dos palabras y entre 5 y 80 caracteres, y lanza `REG_NOMBRE` si no.
7. **`handle_new_user`:** ya no inventa un usuario. Solo crea el perfil con el nombre que venga de Google y la fila en `profile_private`. El ID lo pone el `default`.
8. **Solo cuando no quede ninguna referencia en el código:**
   ```sql
   alter table public.profiles drop column username;
   ```
9. **Regenera los tipos.**

**Criterio de aceptación:** `grep -rn "username" src app` no devuelve nada, `/u/PNT-XXXXXX` abre el perfil, y en ninguna pantalla aparece un `@`.

---

## 3. Bug · Comentarios

**Cómo debe funcionar:**

- **Todo el mundo ve todos los comentarios**, con o sin cuenta. También las respuestas.
- **Solo con cuenta** se puede escribir, responder o borrar.
- **Cada comentario tiene su botón `Responder`.** Las respuestas son de un solo nivel: responder a una respuesta cuelga del comentario raíz y antepone el nombre de la persona a la que se responde.

### 3.1 Qué revisar

1. **Política de lectura.** Debe permitir leer a cualquiera cuando la causa es visible:
   ```sql
   select tablename, policyname, cmd, roles, qual
   from pg_policies where schemaname = 'public' and tablename = 'comments';
   ```
   La de `select` debe aplicar a `anon` y `authenticated`.
2. **Prueba real de lectura sin cuenta**, sin navegador:
   ```bash
   curl -s "https://aeqqnzqcxurnpbkkahvl.supabase.co/rest/v1/comments?select=id,body,parent_id&limit=5" \
     -H "apikey: <NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>"
   ```
   Si devuelve `[]` teniendo comentarios en la base, el problema es de política.
3. **La lista se carga en el servidor** y llega ya resuelta. No decide en el navegador si hay sesión: eso viene del servidor.
4. **Los contadores.** Verifica que el trigger de `comments_count` y el de `replies_count` existan y estén activos. Si no, créalos.

### 3.2 Cómo queda la sección

- **Encabezado:** "Comentarios (N)" con el número real.
- **Lista:** comentarios raíz del más reciente al más antiguo, de 10 en 10, con botón `Ver más`.
- **Cada comentario:** foto, nombre que enlaza a `/u/{ID}`, hace cuánto, texto, y los botones `Responder` y, si corresponde, `Eliminar`.
- **Respuestas:** colapsadas tras "Ver N respuestas"; al abrir, se muestran en orden cronológico.
- **Sin sesión:** los comentarios se ven igual, y donde va el campo de escritura aparece el enlace a `/entrar?next=…`.
- **Al enviar:** el comentario aparece de inmediato y, si falla, se revierte con un aviso.
- **Si el insert falla por falta de registro**, lleva a `/bienvenida` en vez de mostrar un error técnico.

**Criterio de aceptación:** con sesión se comenta y se responde; al cerrar sesión, esos comentarios siguen visibles y el campo de escritura se reemplaza por el enlace para entrar.

---

## 4. Bug · No se pueden crear causas

**Síntomas:** el paso 1 se queda en "Guardando borrador…", y en el paso 5 el bloque de requisitos muestra todo en cero (título 0 caracteres, historia 0, métodos 0) aunque la persona ya llenó los pasos anteriores.

**Lectura:** las fotos sí se guardan, pero **el resto del borrador no se está guardando en la base**. El paso 5 lee de la base, por eso muestra ceros.

### 4.1 Encuentra el error real del guardado

El guardado automático está fallando y el error se está perdiendo. Haz que ese `update` **imprima el error de Postgres** y revisa estas causas, que son las más probables:

1. **Restricciones que rechazan valores vacíos.** `supplies_instructions` tiene `check (char_length(...) between 20 and 600)`. Si el borrador guarda una cadena vacía, **cada guardado falla**. Cámbiala para que solo limite el máximo, y deja el mínimo de 20 para el momento de publicar, que ya lo valida el trigger:
   ```sql
   alter table public.causes drop constraint if exists causes_supplies_instructions_check;
   alter table public.causes add constraint causes_supplies_instructions_check
     check (supplies_instructions is null or char_length(supplies_instructions) <= 600);
   ```
2. **`goal_amount` con `check (> 0)`.** Si el formulario manda `0` mientras la persona escribe, el guardado falla. Guarda `null` cuando el campo esté vacío.
3. **Permisos por columna.** Revisa que el `grant update` de `causes` incluya **todas** las columnas que toca el borrador, incluidas `collection_type` y `supplies_instructions`. Si falta una, todo el update se rechaza.
4. **RLS.** La política de `update` debe permitir a la autora editar su borrador.
5. **Tablas hijas.** Los métodos de donación y los insumos se guardan en `donation_methods` y `cause_supplies`. Comprueba que se estén insertando de verdad:
   ```sql
   select c.id, c.title, c.status,
          (select count(*) from public.cause_media m where m.cause_id = c.id) as fotos,
          (select count(*) from public.donation_methods d where d.cause_id = c.id) as metodos,
          (select count(*) from public.cause_supplies s where s.cause_id = c.id) as insumos
   from public.causes c where c.status = 'borrador' order by c.created_at desc;
   ```

### 4.2 Cómo debe guardar el asistente

- **Cada paso guarda al salir de él**, además del guardado automático con 800 ms de espera.
- **El indicador dice tres cosas:** "Guardando…", "Guardado" con la hora, o "No se pudo guardar" con el botón `Reintentar`. **Nunca se queda girando.**
- **No se avanza de paso si el guardado falló.**

### 4.3 Fuera el bloque de "Requisitos de activación"

Quítalo del paso 5. En su lugar, **cada paso valida lo suyo**:

| Paso | Obligatorio |
|---|---|
| 1 · Fotos y videos | Mínimo 2 fotos |
| 2 · Historia | Título de 10 a 90, descripción de mínimo 80, categoría |
| 3 · Ubicación | País y ciudad |
| 4 · Qué necesitas | Si incluye dinero: al menos 1 método. Si incluye insumos: al menos 1 insumo y las instrucciones de entrega, de mínimo 20 caracteres |
| 5 · Revisar | Teléfono de contacto, que se pide ahí mismo si falta |

- **Todo es obligatorio.** El botón `Siguiente` no avanza si falta algo, y el error aparece **debajo del campo** que falta, no en una lista aparte.
- **El paso 5 queda como vista previa** más el botón `Publicar causa`.
- **Si la publicación falla,** traduce el código y **lleva al paso que corresponde**:

| Código | Mensaje | Paso |
|---|---|---|
| `REQ_IMAGENES` | Agrega al menos 2 fotos. | 1 |
| `REQ_TITULO` | El título debe tener entre 10 y 90 caracteres. | 2 |
| `REQ_DESCRIPCION` | La historia necesita al menos 80 caracteres. | 2 |
| `REQ_UBICACION` | Elige tu país y tu ciudad. | 3 |
| `REQ_METODOS` | Agrega al menos un medio para recibir donaciones. | 4 |
| `REQ_INSUMOS` | Agrega al menos un insumo. | 4 |
| `REQ_ENTREGA` | Explica cómo pueden entregarte los insumos. | 4 |
| `REQ_TELEFONO` | Agrega tu número de contacto. | 5 |

**Criterio de aceptación:** se crea una causa completa de principio a fin, queda en estado `activa`, aparece en Explorar y enciende la luz de su país en el planeta.

---

## 5. Barrida de bugs

Después de los cuatro arreglos, revisa y corrige lo que encuentres, **sin tocar el diseño**:

1. **Sobras del nombre de usuario** en código, tipos, consultas o textos.
2. **Pantallas sin estado de error.** Toda carga tiene tres estados: cargando, error con `Reintentar`, y vacío. Ningún cargador dura más de 10 segundos.
3. **Permisos de lectura.** Confirma que siga esta matriz y corrige lo que se haya abierto de más:
   - públicos: `profiles`, `causes` visibles, `cause_media`, `cause_supplies`, `cause_results`, `comments`, `follows`, `activity_events`, `country_cause_counts`;
   - **solo con sesión:** `donation_methods`;
   - solo la dueña: `profile_private`, `profile_donation_methods`, `saves`, `reports`.
   ```bash
   curl -s "https://aeqqnzqcxurnpbkkahvl.supabase.co/rest/v1/donation_methods?select=id" \
     -H "apikey: <LLAVE_PUBLICA>"
   ```
   Debe devolver `[]`.
4. **Funciones duplicadas en la base.** Una sola versión de cada una.
5. **Contadores** de comentarios, respuestas, guardados, seguidores y causas: que sus triggers existan y cuadren con la realidad.
6. **Páginas dinámicas.** Las que dependen de sesión o de datos que cambian no deben quedar generadas al compilar.
7. **Enlaces rotos** hacia rutas que ya no existen.
8. **`get_advisors`** de seguridad y rendimiento, sin advertencias nuevas.

---

## 6. Verificación antes del push

```sql
-- Identidad
select id, full_name, public_id, avatar_url, onboarding_completed_at from public.profiles;

-- Borradores y causas
select id, title, status, collection_type, country_code, city from public.causes order by created_at desc;

-- Funciones: una sola versión de cada una
select p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1, 2;
```

```bash
npx tsc --noEmit
npm run lint
npm run build
grep -rn "username" src app 2>/dev/null   # no debe devolver nada
```

Y después del despliegue:

```bash
curl -s https://el-puente-five.vercel.app/explorar | grep -c "Ejemplo"
curl -s "https://aeqqnzqcxurnpbkkahvl.supabase.co/rest/v1/comments?select=id&limit=1" -H "apikey: <LLAVE_PUBLICA>"
curl -s "https://aeqqnzqcxurnpbkkahvl.supabase.co/rest/v1/donation_methods?select=id" -H "apikey: <LLAVE_PUBLICA>"
```

---

## 7. Orden de trabajo

1. **Bug de la creación de causas** (sección 4). Es el que impide probar todo lo demás. Empieza por encontrar el error real del guardado y pégalo en tu reporte.
2. **Foto de perfil** (sección 1).
3. **ID público y eliminación del usuario** (sección 2).
4. **Comentarios** (sección 3).
5. **Barrida** (sección 5).
6. **Verificación** (sección 6) y push.

**Reporte final:**
- el error exacto que estaba rompiendo el guardado del borrador;
- qué cambiaste, archivo por archivo, y las migraciones aplicadas;
- el resultado de cada comando de la sección 6, pegado tal cual;
- qué debe probar la persona en línea, en orden:
  1. cambiar su foto de perfil y verla en el header;
  2. ver su ID público y copiarlo;
  3. crear una causa completa y verla en Explorar y en el planeta;
  4. comentar y responder un comentario;
  5. cerrar sesión y comprobar que los comentarios se siguen viendo y que los métodos de pago piden iniciar sesión.
