# Puente · Ajustes, ronda 2 (final): acceso con Google, perfil y planeta

> **Para el agente:** este es el último documento de ajustes antes de pasar a revisar los paneles. Complementa a `PLAN-VERSION-DEFINITIVA.md` y `AJUSTES-RONDA-1.md`; **si algo choca, manda este documento**. Reemplaza por completo cualquier versión anterior de este archivo que hablara de registro con contraseña. Lee todo antes de empezar y sigue el orden de la sección 9. No rompas lo que ya funciona: planeta, feeds, historias, publicación, comentarios, Realtime, fondo de estrellas.

## 0. Qué cambia

1. **Se entra únicamente con Google.** El mismo botón sirve para crear la cuenta y para volver a entrar:
   - sin contraseñas;
   - sin correos de confirmación;
   - sin revisar registros a mano.
2. **Paso único de bienvenida.** La primera vez, la persona ve una sola pantalla corta para elegir su nombre de usuario y aceptar los términos. El número de contacto se puede dejar ahí, pero **no es obligatorio para entrar**; solo se pide al publicar una causa.
3. **Con sesión iniciada no hay un panel distinto.** El sitio se ve igual, con las mismas opciones, y solo se agrega **Perfil** (en lugar de `Entrar`). En Perfil la persona gestiona:
   - sus datos de contacto;
   - sus métodos de pago guardados;
   - sus causas;
   - sus guardadas;
   - su cuenta y privacidad.
4. **Protección de datos** como requisito explícito (sección 7).
5. **Bug del planeta en modo claro.** El océano se ve negro en lugar de azul. La corrección está en la sección 8.

### Qué garantiza Google y qué no

Este límite debe quedar claro en la interfaz y en la política de privacidad.

- **Sí garantiza:** que la persona controla esa cuenta de Google y que su correo es real. Por eso no hacen falta correos de confirmación ni un servidor de correo propio para el acceso.
- **No garantiza:** la identidad real de la persona. Cualquiera puede crear una cuenta de Google. La protección contra estafas sigue dependiendo de los reportes, los comentarios y los resultados publicados.
- **Futuro:** si más adelante se necesita más confianza, se agrega una verificación de identidad aparte, como una insignia opcional.

### Decisiones tomadas

La persona dueña del proyecto puede cambiarlas antes de ejecutar.

| Decisión | Valor |
|---|---|
| Formas de entrar | **Solo Google.** Se desactivan correo y contraseña, enlace mágico, teléfono y acceso anónimo |
| Qué se pide a Google | Solo nombre, correo y foto (`openid`, `email`, `profile`). Ningún otro permiso |
| Datos en la bienvenida | Nombre (viene de Google, editable), usuario (sugerido, editable) y aceptación de términos. Teléfono opcional |
| Número de contacto | Privado siempre. Obligatorio **solo para publicar una causa** |
| Métodos de pago guardados | Privados. Solo se hacen públicos cuando la persona los usa en una causa |
| Guardadas | Dentro de Perfil. `/guardadas` redirige a `/perfil/guardadas` |
| Personas sin cuenta de Google | No pueden entrar por ahora. Pueden ver todo el sitio sin sesión |

### Si ya se aplicó una versión anterior de este documento

- Quita las pantallas de registro con contraseña, confirmación de correo, recuperación de contraseña y el widget de Turnstile.
- Revierte la función `handle_new_user` a la de la sección 3.3.
- Si se creó la columna `username_needs_change`, puede eliminarse.

---

## 1. Entrar con Google

### 1.1 Pantalla `/entrar`

Lleva el mismo header y el mismo fondo de estrellas del sitio. Al centro, una tarjeta de vidrio líquido de máximo 420 px:

1. **Logo de Puente** en línea, al estilo Stakeholders.
2. **Título:** "Entra a Puente".
3. **Texto:** "Usa tu cuenta de Google. Si es tu primera vez, tu cuenta se crea en este mismo paso."
4. **Botón `Continuar con Google`:**
   - sigue las **pautas de marca oficiales de Google** para el botón de acceso;
   - usa su recurso oficial con la "G" de colores; es la única excepción a la regla de iconos de línea, porque Google lo exige;
   - no dibujes el logo a mano ni lo cambies de color.
5. **Texto pequeño debajo:** "Solo recibimos tu nombre, tu correo y tu foto. Nunca publicamos tu correo." Con enlaces a `Términos` y `Privacidad`.
6. **Si llega `?error=google`:** aviso arriba del botón con el texto "No pudimos entrar con Google. Intenta de nuevo."

**Botones que llevan aquí sin sesión:** `Crear una causa`, `Seguir`, `Guardar`, comentar y ver métodos de donación. Todos llevan a `/entrar?next={ruta actual}`.

### 1.2 Iniciar el acceso

Desde el navegador, con el cliente de `src/lib/supabase/client.ts`:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    queryParams: { prompt: 'select_account' }, // deja elegir cuenta si tiene varias
  },
});
```

**No agregues `scopes`.** Los que usa Supabase por defecto son justo los necesarios.

### 1.3 Ruta de regreso `/auth/callback`

`src/app/auth/callback/route.ts` intercambia el código por la sesión (flujo PKCE, con cookies) y decide a dónde enviar a la persona:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const destinoSeguro = (n: string | null) =>
  n && n.startsWith('/') && !n.startsWith('//') ? n : '/';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = destinoSeguro(url.searchParams.get('next'));
  if (!code) return NextResponse.redirect(new URL('/entrar?error=google', url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/entrar?error=google', url.origin));

  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims.sub;
  const { data: perfil } = await supabase
    .from('profiles').select('onboarding_completed_at').eq('id', uid!).single();

  const destino = perfil?.onboarding_completed_at
    ? next
    : `/bienvenida?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(destino, url.origin));
}
```

- **En producción detrás de un proxy (por ejemplo Vercel),** calcula el origen con el encabezado `x-forwarded-host`, como en el ejemplo oficial de Supabase.
- **Protección contra redirecciones abiertas:** `destinoSeguro` solo acepta rutas internas.

### 1.4 Bienvenida `/bienvenida`

Solo aparece la primera vez. Tarjeta de vidrio de máximo 460 px:

**Cabecera:**
- foto de Google en círculo de 64 px, cargada con `<img referrerPolicy="no-referrer">`;
- "Hola, {primer nombre}";
- texto: "Un último paso y listo."

**Campos:**

| Campo | Comportamiento |
|---|---|
| Nombre completo | Viene prellenado desde Google. Editable, de 2 a 80 caracteres. Texto de ayuda: "Así te verán quienes apoyen tu causa." |
| Nombre de usuario | Viene **sugerido**: primer nombre y primer apellido sin tildes, en minúsculas y unidos por `_`. Si está ocupado, se agregan 2 números; se prueban hasta 5 variantes con `username_available`. Editable, con comprobación en vivo (400 ms): "Disponible", "Ya está en uso" o "Solo minúsculas, números y _" |
| Número de contacto (opcional) | Selector de país con indicativo más el número, validado con `libphonenumber-js` y guardado en formato E.164. Texto de ayuda: "Privado. Lo necesitarás si publicas una causa." |
| Términos | Casilla obligatoria: "Acepto los [Términos] y autorizo el tratamiento de mis datos según la [Política de privacidad]." |

**Botón:** `Listo, entrar`. Llama a la función `complete_onboarding` (sección 3.4) y, al terminar:
1. copia la foto de Google al almacenamiento propio (sección 7);
2. crea la cookie de bienvenida completada (sección 1.5);
3. lleva a `next`, o a `/` si no hay.

**Errores de la función:**

| Código | Mensaje |
|---|---|
| `USUARIO_EN_USO` | Ese usuario ya lo tomó otra persona. Prueba con otro. |
| `USUARIO_INVALIDO` | Solo minúsculas, números y _, entre 3 y 24 caracteres. |
| `REG_TELEFONO` | Revisa el número, parece incompleto. |
| `REG_TERMINOS` | Acepta los términos para continuar. |

**Salida:** un enlace pequeño `Salir`, que cierra la sesión.

**Tiempo objetivo:** menos de 20 segundos desde que la persona toca `Continuar con Google` hasta que está dentro.

### 1.5 La bienvenida no se puede saltar

**En la interfaz, desde `proxy.ts`:** si hay sesión y la cookie `puente-bienvenida` no existe:
1. consulta una sola vez `profiles.onboarding_completed_at`;
2. si ya está completa, crea la cookie (`httpOnly`, `sameSite=lax`, duración de 1 año) y deja pasar;
3. si no, redirige a `/bienvenida?next={ruta}`.

**Rutas que no se redirigen:** `/bienvenida`, `/auth/**`, `/terminos`, `/privacidad` y los archivos estáticos.

**Al cerrar sesión,** borra la cookie.

**En los datos, con RLS (sección 3.5):** aunque alguien salte la interfaz, sin bienvenida completa no puede:
- publicar;
- comentar;
- seguir;
- guardar;
- reportar;
- guardar métodos de pago.

La cookie solo evita consultas repetidas; **la seguridad real está en la base de datos.**

### 1.6 Quitar el resto de accesos

Elimina todo el código, las pantallas y los textos de:
- correo y contraseña;
- enlace mágico;
- confirmación de correo;
- recuperación de contraseña;
- Turnstile.

---

## 2. Configuración de Google y Supabase

La hace la persona dueña del proyecto. El agente la entrega como una lista, **espera su confirmación** y después prueba el acceso real.

### 2.1 Google Cloud (`console.cloud.google.com`)

1. **Proyecto.** Crea un proyecto, por ejemplo "Puente".
2. **Google Auth Platform → Branding.** Completa:
   - nombre de la app;
   - correo de soporte;
   - página principal;
   - URL de la política de privacidad y URL de los términos;
   - dominios autorizados (el dominio del sitio).
3. **Audience.** Tipo *External*.
   - Mientras está en modo de prueba, solo pueden entrar las cuentas agregadas como usuarios de prueba.
   - Para abrirlo al público, publícalo en producción.
4. **Data Access (Scopes).** Solo `openid` (se agrega a mano), `.../auth/userinfo.email` y `.../auth/userinfo.profile`. **No agregues otros permisos:** los sensibles obligan a una verificación larga de Google.
5. **Clients → Crear cliente → Web application:**
   - Authorized JavaScript origins: `http://localhost:3000` y `https://{dominio}`;
   - Authorized redirect URIs: la **Callback URL** que muestra Supabase en su página del proveedor Google (`https://{ref}.supabase.co/auth/v1/callback`).
6. **Guarda el Client ID y el Client Secret.** No van en el repositorio.

### 2.2 Supabase

1. **Authentication → Sign In / Providers → Google:**
   - activar;
   - pegar el Client ID y el Client Secret;
   - dejar **desactivado** "Skip nonce check".
2. **Authentication → Sign In / Providers:** desactiva **Email**, **Phone** y **Anonymous**. Así nadie crea cuentas con correo y contraseña llamando a la API directamente.
3. **Authentication → URL Configuration:**
   - Site URL: el dominio de producción;
   - Redirect URLs: `http://localhost:3000/auth/callback` y `https://{dominio}/auth/callback`.

### 2.3 El dominio que ve la persona en la pantalla de Google

**Por defecto,** Google muestra "continuar a `{ref}.supabase.co`". Eso genera desconfianza y facilita que alguien imite la página.

**Opciones, de menor a mayor esfuerzo:**
1. **Dejarlo así en pruebas y lanzamiento inicial.**
2. **Dominio propio para Supabase** (por ejemplo `auth.{dominio}`). Es un complemento pago de Supabase.
   - Con él, la pantalla de Google muestra el dominio del sitio.
   - Después hay que agregar la nueva Callback URL en Google, **junto a la anterior**.
3. **Verificar la marca en Google** (nombre y logo).
   - Tarda unos días hábiles y exige demostrar la propiedad de los dominios en Google Search Console.
   - Sin dominio propio en Supabase no se puede verificar `supabase.co`, así que esta opción sirve junto con la 2.

---

## 3. Base de datos: migración `012_acceso_google_y_perfil`

Aplica todo con `apply_migration` del MCP de Supabase. Después ejecuta `get_advisors` (seguridad y rendimiento), corrige lo que aparezca y ejecuta `generate_typescript_types`.

### 3.1 Nombres de usuario

```sql
create or replace function public.username_is_valid(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p ~ '^[a-z0-9_]{3,24}$'
     and p <> all (array[
       'admin','administrador','puente','soporte','ayuda','sistema','moderador','moderacion',
       'root','api','auth','entrar','bienvenida','perfil','explorar','cerradas','finalizadas',
       'causa','causas','terminos','privacidad','como_funciona','null','undefined'
     ]);
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.username_is_valid(lower(trim(p_username)))
     and not exists (select 1 from public.profiles where username = lower(trim(p_username)));
$$;

grant execute on function public.username_available(text) to anon, authenticated;
```

Crea también un trigger `before update of username` en `profiles`, que lanza `USUARIO_INVALIDO` si el nuevo valor no pasa `public.username_is_valid`.

### 3.2 Estado de bienvenida y datos privados

```sql
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

create policy "ver mis datos privados" on public.profile_private
  for select to authenticated using (id = (select auth.uid()));
create policy "editar mis datos privados" on public.profile_private
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on public.profile_private from anon;
revoke insert, update, delete on public.profile_private from authenticated;
grant update (phone) on public.profile_private to authenticated;

-- Cuentas existentes (incluidas las de prueba)
insert into public.profile_private (id) select id from public.profiles on conflict (id) do nothing;
update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null;
```

**Triggers de `profile_private`:**
- `set_updated_at`;
- cuando cambia `phone`, pone `phone_verified_at` en `null`.

### 3.3 `handle_new_user` para cuentas de Google

Nunca bloquea el acceso: crea un perfil con un usuario temporal único, que la persona reemplaza en la bienvenida.

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text  := left(trim(coalesce(meta->>'full_name', meta->>'name', '')), 80);
  v_base text;
begin
  v_base := lower(extensions.unaccent(coalesce(nullif(v_name, ''), split_part(coalesce(new.email, ''), '@', 1))));
  v_base := trim(both '_' from regexp_replace(v_base, '[^a-z0-9]+', '_', 'g'));
  if char_length(v_base) < 3 then v_base := 'persona'; end if;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    left(v_base, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    v_name,
    coalesce(meta->>'avatar_url', meta->>'picture')
  );

  insert into public.profile_private (id) values (new.id);
  return new;
end $$;
```

**Script de datos de prueba:** las cuentas de `scripts/seed.ts` se crean con `user_metadata.full_name`. Después, con la llave secreta, el script completa `onboarding_completed_at`, el usuario y un teléfono ficticio (por ejemplo `+15550000001`).

### 3.4 Completar la bienvenida

```sql
create or replace function public.complete_onboarding(
  p_full_name text, p_username text, p_phone text, p_terms_version text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_name  text := left(trim(coalesce(p_full_name, '')), 80);
  v_user  text := lower(trim(coalesce(p_username, '')));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_terms text := nullif(trim(coalesce(p_terms_version, '')), '');
begin
  if v_uid is null then raise exception 'SIN_SESION' using errcode = 'P0001'; end if;
  if char_length(v_name) < 2 then raise exception 'REG_NOMBRE' using errcode = 'P0001'; end if;
  if not public.username_is_valid(v_user) then raise exception 'USUARIO_INVALIDO' using errcode = 'P0001'; end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'REG_TELEFONO' using errcode = 'P0001'; end if;
  if v_terms is null then raise exception 'REG_TERMINOS' using errcode = 'P0001'; end if;

  begin
    update public.profiles
       set full_name = v_name,
           username = v_user,
           onboarding_completed_at = coalesce(onboarding_completed_at, now())
     where id = v_uid;
  exception when unique_violation then
    raise exception 'USUARIO_EN_USO' using errcode = 'P0001';
  end;

  update public.profile_private
     set phone = coalesce(v_phone, phone),
         terms_version = v_terms,
         terms_accepted_at = now()
   where id = v_uid;
end $$;

revoke execute on function public.complete_onboarding(text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text) to authenticated;
```

### 3.5 Sin bienvenida no hay acciones

```sql
create or replace function public.is_onboarded()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and onboarding_completed_at is not null
  );
$$;
```

Agrega `and (select public.is_onboarded())` al `with check` de las políticas `insert` de estas tablas:
- `causes`
- `comments`
- `follows`
- `saves`
- `reports`
- `profile_donation_methods`

**Teléfono para publicar.** En el trigger `enforce_cause_status`, dentro de la transición `borrador → activa`, agrega esta validación:

```sql
if not exists (select 1 from public.profile_private where id = new.author_id and phone is not null) then
  raise exception 'REQ_TELEFONO' using errcode = 'P0001';
end if;
```

### 3.6 Métodos de pago guardados en el perfil

```sql
create table public.profile_donation_methods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind public.donation_method_kind not null,
  provider text not null check (char_length(provider) between 2 and 60),
  account_holder text not null check (char_length(account_holder) between 2 and 80),
  account_value text not null check (char_length(account_value) between 3 and 200),
  details text check (details is null or char_length(details) <= 300),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.profile_donation_methods (owner_id, position);

alter table public.profile_donation_methods enable row level security;
create policy "mis métodos: ver"      on public.profile_donation_methods for select to authenticated using (owner_id = (select auth.uid()));
create policy "mis métodos: crear"    on public.profile_donation_methods for insert to authenticated with check (owner_id = (select auth.uid()) and (select public.is_onboarded()));
create policy "mis métodos: editar"   on public.profile_donation_methods for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "mis métodos: eliminar" on public.profile_donation_methods for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.profile_donation_methods from anon;
revoke insert, update on public.profile_donation_methods from authenticated;
grant insert (owner_id, kind, provider, account_holder, account_value, details, position) on public.profile_donation_methods to authenticated;
grant update (kind, provider, account_holder, account_value, details, position) on public.profile_donation_methods to authenticated;

alter table public.donation_methods
  add column if not exists profile_method_id uuid references public.profile_donation_methods(id) on delete set null;
grant insert (profile_method_id) on public.donation_methods to authenticated;

create or replace function public.sync_profile_method(p_method_id uuid)
returns int language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  update public.donation_methods d
     set kind = pm.kind, provider = pm.provider, account_holder = pm.account_holder,
         account_value = pm.account_value, details = pm.details
    from public.profile_donation_methods pm, public.causes c
   where pm.id = p_method_id
     and pm.owner_id = (select auth.uid())
     and d.profile_method_id = pm.id
     and c.id = d.cause_id
     and c.status in ('borrador', 'activa');
  get diagnostics n = row_count;
  return n;
end $$;
```

**Triggers y políticas adicionales:**
- `set_updated_at` en `profile_donation_methods`.
- **Límite de 10 métodos por persona:** trigger `before insert` que lanza `LIMITE_METODOS`.
- **Amplía la política `insert` de `donation_methods`:** `profile_method_id` debe ser nulo o pertenecer a la misma persona.
- **Solo borradores y activas se sincronizan:** las causas cerradas y finalizadas conservan los datos con los que recibieron donaciones.

### 3.7 Criterios de aceptación de la base de datos

- Un usuario anónimo no puede leer `profile_private` ni `profile_donation_methods`.
- Una persona no puede leer el teléfono de otra.
- Una cuenta recién creada con Google tiene perfil y fila privada, con `onboarding_completed_at` nulo.
- Esa cuenta **no puede** comentar ni seguir hasta completar la bienvenida, aunque llame a la API directamente.
- Publicar una causa sin teléfono falla con `REQ_TELEFONO`.
- `username_available('admin')` devuelve `false`.

---

## 4. Navegación con sesión: el mismo sitio, más Perfil

**No existe un "dashboard".** Con sesión, la persona ve el mismo sitio:
- el mismo header y el mismo fondo;
- las mismas opciones: `Explorar causas`, `Cerradas`, `Finalizadas`, `Cómo funciona`, tema y `Crear una causa`.

| Sin sesión | Con sesión |
|---|---|
| Botón `Entrar` | Botón `Perfil`, con el mismo estilo y un avatar circular de 24 px a la izquierda (foto o iniciales) |

**Detalles:**
- **Móvil:** las mismas opciones que sin sesión, con `Perfil` en el lugar de `Entrar`.
- **Aviso:** si no hay teléfono guardado, el botón `Perfil` lleva un punto azul de 8 px con `aria-label="Perfil, tienes datos pendientes"`.
- **Redirecciones:** `/guardadas` → `/perfil/guardadas` y `/ajustes` → `/perfil`.
- **Cerrar sesión** vive dentro de Perfil (sección 5.6).
- **Rutas protegidas:** `/perfil/**`, `/bienvenida` y `/causa/nueva` exigen sesión. Sin sesión, redirigen a `/entrar?next={ruta}`. La comprobación en el servidor usa `getClaims()`.

---

## 5. Área de Perfil (`/perfil`)

### 5.1 Distribución

Usa la misma estructura de dos columnas de los feeds (ronda 1, sección 3.1), con el fondo de estrellas y el vidrio.

**Columna izquierda en computador**, fija al hacer scroll:
- avatar de 72 px, nombre y `@usuario`;
- enlace `Ver mi perfil público`;
- navegación de secciones:
  - `Mis datos` (`/perfil`)
  - `Métodos de pago` (`/perfil/metodos`)
  - `Mis causas` (`/perfil/causas`)
  - `Guardadas` (`/perfil/guardadas`)
  - `Cuenta y privacidad` (`/perfil/cuenta`)
- la sección activa se marca con `aria-current="page"` y la barra azul de 2 px.

**Tableta y móvil:** esa navegación pasa a una fila de pestañas desplazable.

### 5.2 Mis datos (`/perfil`)

Formulario en una tarjeta. Cada campo lleva la marca **Público** o **Privado** junto a su etiqueta.

| Campo | Visibilidad | Comportamiento |
|---|---|---|
| Foto | Público | La copiada desde Google o una nueva, subida al bucket `avatares` (recorte cuadrado, 512 px, WebP) |
| Nombre completo | Público | De 2 a 80 caracteres |
| Nombre de usuario | Público | Comprobación en vivo con `username_available` |
| Biografía | Público | Hasta 280 caracteres |
| País y ciudad | Público | Opcionales |
| Número de contacto | Privado | Selector de país y número. Se guarda en `profile_private.phone`. Si falta: "Lo necesitas para publicar una causa." |
| Correo | Privado | Solo lectura: "Correo de tu cuenta de Google". No se puede cambiar desde Puente |

**Guardar:**
- barra inferior fija dentro de la tarjeta con `Descartar` y `Guardar cambios`, activa solo si hubo cambios;
- al guardar, aviso "Cambios guardados".

**Salir con cambios sin guardar:** pide confirmación antes de salir.

### 5.3 Métodos de pago (`/perfil/metodos`)

**Cabecera:**
- título "Métodos de pago";
- texto: "Guárdalos aquí para usarlos al crear una causa. Solo se muestran dentro de las causas donde los agregues."

**Lista:**
- una tarjeta por método con tipo, proveedor, titular y número o enlace;
- el número se ve oculto salvo los últimos 4 caracteres, con botón para mostrar;
- botones `Editar` y `Eliminar`;
- botones `Subir` y `Bajar` para ordenar; son accesibles con teclado, a diferencia de arrastrar.

**Agregar:**
- `Agregar método` abre una hoja de vidrio con los mismos campos del paso 4 de publicar;
- al llegar a 10, el botón se deshabilita con el texto "Llegaste al máximo de 10 métodos.".

**Editar:**
- misma hoja;
- si el método se usa en borradores o causas activas, aparece una casilla marcada por defecto: "Actualizar también en mis causas activas y borradores ({N})";
- con la casilla marcada, al guardar se llama a `sync_profile_method`.

**Eliminar:** confirmación: "¿Eliminar este método? Las causas donde ya lo usaste lo conservan."

**Estado vacío:**
- ilustración de línea (una tarjeta y una billetera, con el cierre en azul);
- texto "Aún no tienes métodos guardados.";
- botón `Agregar método`.

### 5.4 Mis causas (`/perfil/causas`)

- **Pestañas con conteo:** `Borradores`, `Activas`, `Cerradas`, `Finalizadas`.
- **Tarjetas:** las mismas tarjetas horizontales de los feeds, con las acciones de la autora:
  - borradores: `Continuar` y `Eliminar`;
  - activas: `Editar` y `Cerrar causa`;
  - cerradas: `Publicar resultados`.
- **Paginación:** scroll infinito con cursor.

### 5.5 Guardadas (`/perfil/guardadas`)

Feed con tarjetas horizontales, en cualquier estado, del guardado más reciente al más antiguo.

### 5.6 Cuenta y privacidad (`/perfil/cuenta`)

1. **Cuenta vinculada:** "Entras con Google: {correo}".
2. **Qué datos guardamos:** una lista corta y clara, con enlace a la política de privacidad.
   - **Nombre, usuario, foto, biografía y ciudad:** públicos.
   - **Correo y teléfono:** privados.
   - **Métodos de pago guardados:** privados, hasta que los usas en una causa.
3. **`Cerrar sesión`:** llama a `signOut()`, borra la cookie `puente-bienvenida` y lleva a `/`.
4. **`Cerrar sesión en todos los dispositivos`:** llama a `signOut({ scope: 'global' })`, con confirmación.
5. **`Eliminar mi cuenta`:**
   - **Confirmación:** abre una hoja de confirmación.
     - Explica que se borran el perfil, las causas, los comentarios, los métodos guardados y los archivos.
     - Pide escribir el nombre de usuario para confirmar.
   - **Ejecución:** una Server Action en un módulo con `import 'server-only'`:
     1. obtiene el `uid` con `getClaims()`;
     2. valida el usuario escrito;
     3. borra los archivos de la persona en los buckets (`{uid}/...`) con un cliente creado con `SUPABASE_SECRET_KEY`;
     4. llama a `auth.admin.deleteUser(uid)`; el borrado en cascada elimina el resto;
     5. cierra la sesión y lleva a `/` con el aviso "Tu cuenta fue eliminada."

### 5.7 Perfil público (`/u/[username]`)

- **Muestra:** foto, nombre, `@usuario`, biografía, país y ciudad, seguidores y seguidos, y las causas publicadas.
- **Nunca muestra:** correo, teléfono ni métodos guardados.

---

## 6. Publicar una causa: teléfono y métodos guardados

**Teléfono:**
- Si la persona no tiene teléfono guardado, el paso 5 (`Revisar y publicar`) muestra arriba un campo "Tu número de contacto (privado)", con el mismo selector de país.
- Se guarda en `profile_private.phone` antes de publicar.
- Si aun así llega `REQ_TELEFONO`, el mensaje es: "Agrega tu número de contacto para publicar. No se muestra públicamente."

**Métodos en el paso 4 (`Cómo recibir donaciones`):**
1. **Si hay métodos guardados:**
   - aparecen primero como tarjetas seleccionables con casilla, bajo "Tus métodos guardados";
   - al marcar uno, se crea la fila en `donation_methods` copiando los datos y guardando `profile_method_id`.
2. **`Agregar otro método`:**
   - la casilla "Guardarlo también en mi perfil" viene marcada por defecto;
   - si está marcada, primero se crea en `profile_donation_methods` y luego se copia a la causa con el vínculo.
3. **Límites:** al menos 1 método para publicar y máximo 5 por causa.

---

## 7. Protección de los datos

Estas reglas son obligatorias en todo el proyecto.

**Lo que se pide a Google:**
- **Mínimo de datos:** solo `openid`, `email` y `profile`. Nunca se piden contactos, archivos ni otros permisos.
- **Tokens de Google:** la sesión puede incluir tokens del proveedor (`provider_token`). **No se guardan** en la base de datos, en `localStorage` ni en logs.

**Qué es público y qué es privado:**
- **Separación de datos:** lo público vive en `profiles`; lo privado vive en `profile_private` y `profile_donation_methods`, con RLS solo para la dueña.
- **Correo:** vive únicamente en `auth.users`. **Nunca** se copia a `profiles` ni a ninguna tabla pública.
- **Foto de perfil:** al completar la bienvenida, una Server Action descarga la foto de Google y la sube a `avatares/{uid}/avatar.webp`. Condiciones: solo URLs `https`, del dominio de imágenes de Google, y máximo 2 MB. Así el sitio no carga imágenes desde Google en cada visita, y la foto no se rompe si Google cambia la URL.

**En el código:**
- **Nada privado en cachés compartidas:** no uses `'use cache'` ni cachés de datos en funciones que lean `profile_private`, métodos guardados o datos de la sesión. Esas páginas son dinámicas.
- **Nada privado en logs:** ni `console.log` ni herramientas de analítica reciben correo, teléfono ni métodos de pago.
- **Llave secreta:** `SUPABASE_SECRET_KEY` solo se usa en módulos marcados con `import 'server-only'`: eliminar cuenta y script de datos de prueba.

**Derechos de la persona:**
- **Consentimiento registrado:** versión de los términos y fecha de aceptación en `profile_private`.
- **Eliminación:** la persona puede borrar su cuenta sola (sección 5.6).

**Textos legales:** la política de privacidad debe explicar:
- qué datos se reciben de Google;
- para qué se usa el teléfono;
- que Puente no procesa pagos;
- cómo eliminar la cuenta.

Marca `/terminos` y `/privacidad` como "Pendiente de revisión legal" hasta que un abogado los revise.

**Revisión final:** ejecuta `get_advisors` de seguridad y confirma cero advertencias nuevas.

---

## 8. Bug: océano negro en el planeta en modo claro

### 8.1 Causa

El síntoma (países verdes, océano negro) se reprodujo en una prueba aislada con globe.gl 2.46.2.

**Por qué los países sí cambian y el océano no:** son materiales distintos.
- Los países reciben su color con `polygonCapColor`, que se aplica tal cual.
- El océano es el **material de la esfera** (`globeMaterial()`, un `MeshPhongMaterial`). Depende de su color, de las texturas y de la iluminación.

**Hay tres formas de terminar con el océano negro.** Revisa las tres:

1. **Se usó una textura en algún momento** (`globeImageUrl`, por ejemplo una imagen de la Tierra oscura de los ejemplos de globe.gl).
   - Cuando carga una textura, globe.gl pone `globeMaterial().color = null`.
   - Después, `m.color.set(...)` lanza `TypeError: Cannot read properties of null (reading 'set')`, la función del tema se detiene y la textura oscura sigue ahí.
   - **Es la causa más probable:** en la prueba reproduce exactamente la captura.
2. **La variable `--g-ocean` llega vacía** (por ejemplo, porque está definida con un selector de tema distinto al que usa el proyecto). `color.set('')` no cambia nada y la esfera se queda con el negro inicial.
3. **La escena no tiene luces** (`globe.lights([])`). Sin luz, el material se ve negro.

**Diagnóstico rápido.** En la consola, con el planeta en modo claro, revisa:
- `globe.globeImageUrl()`
- `globe.globeMaterial().color`
- `globe.globeMaterial().map`
- `globe.lights().length`
- `getComputedStyle(document.documentElement).getPropertyValue('--g-ocean')`

### 8.2 Corrección

```ts
import type { GlobeInstance } from 'globe.gl';

type MaterialOceano = {
  color: { set(c: string): void } | null;
  emissive: { set(c: string): void; clone(): { set(c: string): void } };
  emissiveIntensity: number;
  specular?: { set(c: string): void };
  shininess: number;
  map: { dispose(): void } | null;
  bumpMap: unknown;
  needsUpdate: boolean;
};

export function aplicarOceano(globe: GlobeInstance, tema: 'light' | 'dark') {
  const cs = getComputedStyle(document.documentElement);
  const leer = (nombre: string, respaldo: string) => cs.getPropertyValue(nombre).trim() || respaldo;

  const oceano = leer('--g-ocean', tema === 'light' ? '#3F7FE8' : '#050912');
  const emisivoOscuro = leer('--g-ocean-emissive', '#03060D');

  // 1. Sin texturas: una textura oscura tapa el color del océano
  if (globe.globeImageUrl()) globe.globeImageUrl('');
  if (globe.bumpImageUrl()) globe.bumpImageUrl('');

  const m = globe.globeMaterial() as unknown as MaterialOceano;
  if (m.map) { m.map.dispose(); m.map = null; }
  m.bumpMap = null;

  // 2. globe.gl deja color en null cuando alguna vez hubo textura
  if (!m.color) m.color = m.emissive.clone();
  m.color.set(oceano);

  // 3. Luz propia mínima: el océano nunca queda negro aunque falte iluminación
  const sinLuces = globe.lights().length === 0;
  if (tema === 'light') {
    m.emissive.set(oceano);
    m.emissiveIntensity = sinLuces ? 0.85 : 0.28;
    m.specular?.set('#2a3350');
    m.shininess = 10;
  } else {
    m.emissive.set(emisivoOscuro);
    m.emissiveIntensity = 1;
    m.specular?.set('#101a38');
    m.shininess = 14;
  }
  m.needsUpdate = true;
}
```

**Además:**
- **Llama a `aplicarOceano`** en `onGlobeReady`, al montar y en **cada** cambio de tema, antes de reasignar los colores de los polígonos y la atmósfera.
- **Busca y elimina** cualquier uso de `globeImageUrl`, `bumpImageUrl` o `lights([])` en el código del planeta.
- **Revisa las variables:** `--g-ocean` debe estar definida para ambos temas con el mismo selector que usa el proyecto para marcar el tema.
- **El valor `0.85` sin luces es solo un punto de partida.** Lo correcto es no quitar las luces por defecto de globe.gl.

**Resultado de la prueba aislada con esta corrección:** en el escenario de la textura, el océano pasó de negro (`#03050C`) a azul (`#3B78DC`), muy cerca del color de diseño `#3F7FE8`, con los países verdes intactos. El modo oscuro se ve igual que antes.

### 8.3 Criterios de aceptación

- **En modo claro:** océano azul con leve degradado de luz, países verdes con fronteras blancas, luces visibles.
- **Al cambiar de tema varias veces seguidas,** el océano cambia al instante y sin errores en la consola.
- **Al recargar directamente en modo claro,** el océano es azul desde el primer cuadro (el poster también es azul).
- **El modo oscuro** no cambia.

---

## 9. Orden de trabajo

1. **Bug del océano (sección 8).**
2. **Entregar a la persona la lista de la sección 2** (Google Cloud y Supabase). Mientras la completa, avanza con los pasos 3 a 5, pero **no pruebes el acceso real hasta que confirme**.
3. **Migración `012_acceso_google_y_perfil`** (sección 3): `get_advisors`, tipos y actualización del script de datos de prueba.
4. **`/entrar`, `/auth/callback`, `/bienvenida` y el control de bienvenida** (secciones 1.1 a 1.5). Quitar los demás accesos (1.6).
5. **Navegación con sesión** (sección 4).
6. **Área de Perfil** (secciones 5.1 a 5.7).
7. **Publicar con teléfono y métodos guardados** (sección 6).
8. **Revisión de protección de datos** (sección 7).
9. **Revisión final:** capturas en 1920 × 1080, 1440 × 900 y 390 × 844, en ambos temas, con y sin sesión. Además, `next build` sin errores.

## 10. Criterios finales

- [ ] Una persona nueva toca `Continuar con Google`, completa la bienvenida en menos de 20 segundos y queda dentro, sin correos ni contraseñas.
- [ ] Una persona que ya completó la bienvenida vuelve a entrar con un solo toque y regresa a la página donde estaba.
- [ ] Nadie puede comentar, seguir, guardar ni publicar sin completar la bienvenida, ni siquiera llamando a la API.
- [ ] Con sesión, el header es idéntico al de sin sesión, salvo `Perfil` en lugar de `Entrar`.
- [ ] El correo, el teléfono y los métodos guardados no aparecen en ninguna vista pública ni en respuestas de la API para otras personas.
- [ ] Publicar exige teléfono y lo pide dentro del mismo flujo si falta.
- [ ] Editar un método guardado con la casilla marcada actualiza causas activas y borradores, no cerradas ni finalizadas.
- [ ] Eliminar la cuenta borra perfil, datos privados, causas y archivos.
- [ ] En Supabase solo está activo el proveedor Google.
- [ ] El océano del modo claro es azul.
- [ ] `get_advisors` de seguridad sin advertencias nuevas.
