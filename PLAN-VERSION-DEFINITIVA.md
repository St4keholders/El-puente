# Puente · Plan de la versión definitiva

**Next.js + Supabase, con el planeta del prototipo como base**

> **Para el agente:** lee este documento completo antes de escribir código. Trabaja por fases (sección 14). Al terminar cada fase, cumple sus criterios de aceptación y resume lo hecho antes de seguir. Si algo de este documento choca con lo que encuentres en el proyecto, detente y pregunta; no improvises.

---

## 1. Qué estamos construyendo

Puente es una red social de ayuda. Una persona cuenta su caso (una causa) y otras personas le donan **directamente** a los medios de pago que ella misma publica. La idea nació de desastres como los terremotos, donde muchas personas quedan aisladas y la ayuda tiene que poder llegar desde cualquier parte del mundo.

**Principio no negociable:** la plataforma **no procesa, no recibe, no retiene y no cobra comisión sobre dinero**. No hay pasarela de pagos. Toda donación ocurre fuera de Puente, por los medios que publica cada persona.

---

## 2. Punto de partida en esta carpeta

### 2.1 Qué hay en la carpeta

1. **Un proyecto Next.js ya creado.**
2. **`planeta-hero.html`**, el prototipo funcional del hero. Es la **fuente de verdad visual y de interacción** del planeta. No lo borres ni lo modifiques; úsalo como referencia. Si no está en la raíz, búscalo en la carpeta.

### 2.2 Qué hay dentro del prototipo y qué hacer con cada parte

| Parte del prototipo (nombre en el código) | Qué hace | Qué hacer en la versión definitiva |
|---|---|---|
| `<script type="application/json" id="geo-data">` | Siluetas de 176 países en TopoJSON (ids ISO alfa‑2, más `XK` Kosovo, `XN` Chipre del Norte y `XS` Somalilandia), nombres en español, punto de la luz por país y unas 210 ciudades | Extraer tal cual a `src/lib/geo/mundo.json` e importarlo |
| `decodeTopo()` | Convierte el TopoJSON a GeoJSON sin librerías | Portar a `src/lib/geo/decodeTopo.ts`, tipado |
| Tokens CSS en `:root`, `@media (prefers-color-scheme: dark)` y `[data-theme="dark"]`, variables `--g-*` | Paleta clara y oscura, y colores del planeta | Llevar a `globals.css`; ampliar con los tokens de vidrio (sección 11) |
| `readPalette()`, `applyGlobeTheme()` | El planeta lee los colores desde CSS y se actualiza al cambiar el tema | Conservar la misma estrategia |
| `layout()`, `shiftStage()`, `flyAlt()` | Tamaño y posición del planeta, desplazamiento al abrir el panel, zoom por país | Portar **sin cambiar la matemática** |
| `buildStars()`, `drawStars()` | Cielo estrellado con constelaciones | Portar como componente de cliente |
| `makeLight()`, `updateLight()`, `bootLights()`, `ping()` | Luces por país, encendido inicial y pulso | Portar; alimentar con datos reales |
| `search()`, `score()`, `highlight()`, combobox accesible | Buscador de países, ciudades y personas | Países y ciudades siguen locales; personas y causas vienen de Supabase |
| `renderPanel()`, `selectCountry()`, `closePanel()` | Panel lateral (escritorio) u hoja inferior (móvil) con causas del país | Portar con datos reales y enlaces reales |
| IntersectionObserver, `visibilitychange`, presupuesto de píxeles, poster estático, fallback sin WebGL | Rendimiento y carga rápida | Conservar todo |
| `HAND`, `START_COUNTS`, `NAMES`, `TEMPLATES`, `ORGS`, `makeCause()`, `newCauseEvent()`, `donationEvent()`, `shootArc()`, `startSimulation()` | Datos inventados y simulación | **Eliminar.** Los arcos de donaciones también se eliminan, porque la plataforma no conoce las donaciones |

---

## 3. Stack y reglas técnicas

### 3.1 Versiones

- **Revisa `package.json` antes de instalar nada** y usa las versiones que ya existen.
- **Next.js:** si el proyecto está en la línea 16.x, actualiza como mínimo a **16.3.3**, que corrige vulnerabilidades críticas publicadas en agosto de 2026. Mejor aún, usa el último parche disponible de esa línea.
- Next.js 16 publica documentación ajustada a cada versión para agentes de código. Consúltala cuando dudes de una API.
- **globe.gl:** fija la versión exacta. El prototipo usa **2.46.2**.

### 3.2 Arquitectura

- **App Router, TypeScript en modo estricto.** Server Components por defecto; `"use client"` solo donde haya interactividad.
- **Mutaciones** (seguir, guardar, comentar, publicar, cerrar) con Server Actions o con el cliente de Supabase desde el navegador. RLS protege en ambos casos. Usa UI optimista en seguir, guardar y comentar.
- **Feeds infinitos y comentarios:** `@tanstack/react-query` (`useInfiniteQuery`).
- **Formularios:** `zod`, con el mismo esquema en cliente y servidor. `react-hook-form` si ayuda.
- **Imágenes:** `next/image`, con `remotePatterns` para el dominio de Storage de Supabase.
- **Tipografía:** Instrument Sans con `next/font/google`.
- **Estilos:**
  - Si el proyecto ya trae Tailwind, úsalo junto con las variables CSS.
  - Si no lo trae, usa CSS Modules y `globals.css`.
  - No mezcles tres sistemas de estilos.

### 3.3 Supabase en Next.js (sigue la guía oficial de SSR)

- **Paquete:** `@supabase/ssr`. Los paquetes `auth-helpers` están obsoletos.
- **Clientes:** crea dos, `src/lib/supabase/client.ts` (`createBrowserClient`) y `src/lib/supabase/server.ts` (`createServerClient` con `cookies()`).
- **`proxy.ts`:** en Next.js 16 el antiguo `middleware.ts` se llama `proxy.ts`. Úsalo para refrescar la sesión, con un `matcher` que excluya los archivos estáticos.
- **Proteger páginas y datos en el servidor:** usa `supabase.auth.getClaims()`. **Nunca** confíes en `getSession()` en código de servidor.
- **Variables de entorno** en `.env.local`, que **nunca** se sube al repositorio:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - Obtén ambas con las herramientas `get_project_url` y `get_publishable_keys` del MCP.
- **Nunca** uses la llave `service_role` en código que llegue al navegador.

### 3.4 El planeta dentro de Next.js

- globe.gl necesita `window`. Cárgalo solo en el cliente, dentro de un componente de cliente, con `import('globe.gl')` en un `useEffect`.
- **Al desmontar:**
  1. `pauseAnimation()`
  2. `renderer().dispose()`
  3. `renderer().forceContextLoss()`
  4. Quita los listeners de los controles.
  5. Vacía el contenedor.
- El poster estático (el círculo con brillo) debe renderizarse en el servidor, para que se vea al instante mientras carga la librería. Igual que en el prototipo.

---

## 4. Mapa del sitio

### 4.1 Rutas

| Ruta | Pantalla | Requiere sesión |
|---|---|---|
| `/` | Hero con el planeta (sección 5) | No |
| `/explorar` | Feed de causas activas (sección 6). Admite `?pais=CO`, `?categoria=salud` y `?siguiendo=1` | No, salvo el filtro "Siguiendo" |
| `/cerradas` | Feed de causas cerradas (sección 8) | No |
| `/finalizadas` | Feed de causas con resultados (sección 9) | No |
| `/como-funciona` | Los tres pasos (sección 7) | No |
| `/causa/[id]` | Página completa de la causa | No, aunque ver los métodos de donación sí la requiere (sección 13, decisión 2) |
| `/causa/nueva` | Publicar una causa (sección 10). Admite `?pais=XX` para precargar el país | Sí |
| `/causa/[id]/editar` | Editar mientras está activa | Sí, solo la autora |
| `/causa/[id]/cerrar` | Cerrar la causa | Sí, solo la autora |
| `/causa/[id]/resultados` | Publicar resultados | Sí, solo la autora |
| `/u/[username]` | Perfil: causas publicadas, seguidores y seguidos | No |
| `/guardadas` | Causas guardadas por la persona | Sí |
| `/ajustes` | Editar perfil | Sí |
| `/entrar` | Iniciar sesión o registrarse (sección 12) | No |
| `/auth/callback` | Retorno del enlace mágico y de Google | No |

### 4.2 Header

**Escritorio (1100 px o más):**
- A la izquierda, la marca.
- A la derecha: `Explorar causas` · `Cerradas` · `Finalizadas` · `Cómo funciona` · botón de tema · botón principal `Crear una causa` · avatar o `Entrar`.

**Tableta (721 a 1099 px):**
- Quedan visibles `Explorar causas` y `Crear una causa`.
- `Cerradas`, `Finalizadas` y `Cómo funciona` pasan a un menú "Más" en una hoja de vidrio.

**Móvil (720 px o menos):**
- Header mínimo: marca, tema y avatar.
- Barra inferior flotante de vidrio con `Planeta` (`/`), `Explorar`, `Crear` (botón central destacado), `Guardadas` y `Perfil`.
- `Cerradas`, `Finalizadas` y `Cómo funciona` quedan en el menú del avatar y también como pestañas en la parte superior de `/explorar`.

**En todos los tamaños:**
- El header es una pieza de vidrio líquido flotante (sección 11), separada del borde superior, no una barra pegada.
- Marca el enlace activo con `aria-current="page"`.

---

## 5. El hero con el planeta (ajustes sobre el prototipo)

Todo lo que no se menciona aquí se conserva igual que en `planeta-hero.html`. Eso incluye:
- el titular y el subtítulo;
- la matemática del tamaño del planeta;
- el zoom al país;
- el tooltip y el hover;
- el cielo estrellado;
- el modo claro y oscuro;
- el atajo `/`;
- Escape para cerrar;
- la accesibilidad del combobox;
- el respeto por `prefers-reduced-motion`;
- la pausa fuera de pantalla;
- el presupuesto de píxeles.

### 5.1 Datos reales

**Luces:**
- Una luz por país con **causas activas**.
- Al cargar, lee la vista `country_cause_counts` en un Server Component y pásala como prop.
- El tamaño de cada luz sigue la fórmula del prototipo (`lightSize`).

**Tiempo real:**
- Suscríbete con Supabase Realtime a los `INSERT` de la tabla `activity_events`.
- Cuando llega `causa_publicada`:
  - si el país no tenía luz, crea la luz con la animación `ignite`;
  - si ya la tenía, sube su conteo y repite `ignite`;
  - lanza `ping()`, actualiza las estadísticas y agrega el evento a la actividad reciente.
- Cuando llega `causa_cerrada`, resta 1 al conteo del país. Si llega a cero, apaga la luz con un fundido.

**Línea de estado:**
- Muestra "N causas activas en M países" con números reales.
- Quita el texto "Prototipo con datos simulados".

**Actividad reciente (abajo a la derecha):**
- Muestra los últimos 3 eventos reales:
  - "Nueva causa en Nepal"
  - "Resultados publicados en Chile"
- Al tocar un evento se abre ese país, como en el prototipo.

### 5.2 Panel del país

- **Contenido:** las 4 causas activas más recientes de ese país, cada una con primera imagen en miniatura, título, ciudad y nombre de quien publica.
- **Si la causa define meta,** se muestra la barra con el monto **reportado** (sección 13, decisión 3).
- **Botón `Donar`:** lleva a `/causa/[id]#donar`. Ya no muestra un aviso.
- **Tocar la tarjeta:** lleva a `/causa/[id]`.
- **Pie del panel:** `Ver las N causas de {país}`, que lleva a `/explorar?pais=XX`.
- **País sin causas:** se mantiene el estado vacío del prototipo, y `Crear una causa` lleva a `/causa/nueva?pais=XX`.

### 5.3 Buscador

- **Países y ciudades:** siguen siendo locales, desde `mundo.json`. Son instantáneos.
- **Personas y causas:**
  - Llama a la función `search_people_and_causes` (sección 12.6).
  - Espera 200 ms después de la última tecla y exige al menos 2 caracteres.
  - Cancela la petición anterior si llega una nueva.
- **Al elegir una persona,** se abre su perfil `/u/[username]`.
- **Al elegir una causa,** se abre el panel del país con esa causa resaltada, como en el prototipo.

### 5.4 Estilo

Pasa a vidrio líquido (sección 11):
- la barra de búsqueda;
- el menú de resultados;
- el panel del país;
- la hoja inferior en móvil;
- el tooltip del planeta.

El planeta en sí no cambia.

---

## 6. Explorar causas: el feed principal (punto 1)

Funciona como el feed de Instagram o Facebook: publicaciones una debajo de otra, con scroll infinito, ordenadas de la más reciente a la más antigua. Solo muestra causas en estado `activa`.

### 6.1 Tarjeta de publicación

La tarjeta es un solo componente con variantes: `activa`, `cerrada` y `finalizada`. Ancho máximo de unos 600 px en escritorio, centrada, y ancho completo en móvil. De arriba a abajo:

1. **Cabecera**
   - avatar;
   - nombre y `@usuario`, que enlazan al perfil;
   - "Ciudad, País" y hace cuánto se publicó;
   - botón `Seguir` / `Siguiendo`, que no aparece en las causas propias;
   - menú de tres puntos con `Copiar enlace` y `Reportar`.
2. **Carrusel de medios**
   - fotos y videos en orden;
   - deslizable con el dedo, con flechas en escritorio e indicador de posición;
   - proporción fija 4:5 con `object-fit: cover`;
   - los videos se reproducen sin sonido solo mientras están visibles, con un botón para activar el sonido.
3. **Acciones**
   - `Comentar`, que abre la página de la causa en la sección de comentarios;
   - `Guardar` / `Guardada`;
   - `Compartir`, que usa la Web Share API y copia el enlace si no está disponible.
4. **Contenido**
   - categoría;
   - título;
   - descripción cortada a 3 líneas con `más`, que expande en el mismo lugar.
5. **Progreso, solo si hay meta**
   - barra;
   - texto "US$ 4.320 reportados de US$ 10.000".
6. **Comentarios**
   - "Ver los 24 comentarios";
   - los 2 comentarios más recientes, en una línea cada uno.

Al tocar la imagen o el título, la persona entra a la página de la causa.

### 6.2 Scroll infinito

- **Paginación por cursor**, nunca con `offset`:
  - orden `published_at desc, id desc`;
  - páginas de 10;
  - el cursor es el par `(published_at, id)` de la última tarjeta.
- **Cómo pedir la página siguiente:** un sentinel al final de la lista con `IntersectionObserver` y `rootMargin: "800px"`.
- **Estados:**
  - carga inicial con 3 tarjetas esqueleto;
  - cargando más, con 1 esqueleto;
  - error, con el mensaje "No pudimos cargar más causas." y el botón `Reintentar`;
  - final, con el mensaje "Ya viste todas las causas activas.".
- **Primera página:** se renderiza en el servidor, para SEO y velocidad. Las siguientes se piden desde el cliente.
- **Evita consultas N+1.** Por cada página:
  - una consulta de causas con autor y medios anidados;
  - una consulta de `saves` para esos ids;
  - una consulta de `follows` para esos autores.
  - Las dos últimas solo si hay sesión.
- **Filtros** arriba del feed, como chips de vidrio sincronizados con la URL:
  - país, precargado desde el planeta;
  - categoría;
  - `Siguiendo` (con sesión), que muestra solo causas de las personas que sigue.
- **Botón volver:** restaura la posición del scroll.
- Si el feed supera unas 200 tarjetas en memoria, virtualiza la lista.

### 6.3 Seguir personas

- Se sigue a **personas**, no a causas. Aparece en la tarjeta y en el perfil.
- Nadie puede seguirse a sí misma.
- **Sin sesión,** el botón lleva a `/entrar?next={ruta actual}`.
- El perfil muestra el número de seguidores y seguidos, y la lista de cada uno con scroll infinito.

### 6.4 Comentarios y respuestas

- **Un solo nivel de respuestas,** como en Instagram:
  - una respuesta a otra respuesta se guarda colgando del comentario raíz;
  - la interfaz antepone `@usuario` automáticamente;
  - la base de datos aplana la jerarquía (sección 12.5).
- **Texto:** de 1 a 1.000 caracteres. Se muestra como texto plano; nunca se interpreta como HTML.
- **Borrar:**
  - la persona que comentó puede borrar su comentario;
  - la autora de la causa puede borrar cualquier comentario de su causa;
  - borrar un comentario raíz borra sus respuestas.
- **Editar:** solo la persona que comentó. Se muestra la marca "editado".
- **Orden:**
  - comentarios raíz del más reciente al más antiguo, con scroll infinito;
  - respuestas en orden cronológico, colapsadas tras "Ver N respuestas".
- **Dónde se puede comentar:** en causas `activa`, `cerrada` y `finalizada`. Las causas finalizadas tienen además un hilo propio de resultados (sección 9).
- Sin sesión, el campo de comentario lleva a `/entrar`.

### 6.5 Guardar causas

- El guardado es privado: solo la persona ve lo que guardó.
- `/guardadas` muestra sus causas guardadas con el mismo feed y scroll infinito, en cualquier estado.

### 6.6 Página de la causa `/causa/[id]`

Es el "feed de la causa": todo lo que subió quien la publicó.

1. **Galería completa**
   - todas las fotos y videos;
   - en escritorio, una imagen grande con miniaturas; en móvil, un carrusel;
   - al tocar, se abre un visor a pantalla completa con gestos.
2. **Cabecera**
   - título y categoría;
   - "Ciudad, País";
   - fecha de publicación;
   - estado con insignia.
3. **Quién publica**
   - avatar, nombre, `Seguir`, y enlace al perfil.
4. **Descripción completa**
   - respeta los saltos de línea;
   - enlaces sin convertir automáticamente, o con `rel="nofollow ugc noopener"`.
5. **Progreso**
   - si hay meta, la barra con el monto reportado y la etiqueta "Monto reportado por quien publica".
6. **Sección `#donar` "Cómo donar"**
   - una tarjeta por cada método, con tipo, proveedor, titular, número o enlace, y botón `Copiar`;
   - el aviso fijo: "Puente no procesa donaciones. Verifica los datos antes de enviar dinero y reporta cualquier irregularidad.";
   - sin sesión, un bloque que dice "Inicia sesión para ver cómo donar" (sección 13, decisión 2);
   - si la causa está cerrada o finalizada, esta sección se reemplaza por "Esta causa ya no recibe donaciones".
7. **Resultados, solo si está finalizada** (sección 9).
8. **Comentarios** (sección 6.4).
9. **Acciones de la autora**
   - `Editar` (solo activa);
   - `Cerrar causa` (solo activa);
   - `Publicar resultados` (solo cerrada).
10. **Metadatos para compartir**
    - `generateMetadata` con título, extracto de la descripción y la primera imagen como Open Graph;
    - así un enlace compartido en WhatsApp o redes se ve con foto.

### 6.7 Cerrar la causa y publicar resultados

**Cerrar (`/causa/[id]/cerrar`):**
- Pide confirmación.
- Pide opcionalmente el monto total recibido (`raised_reported`) y una nota breve (`closing_note`).
- Tras cerrar, la causa deja de aparecer en Explorar y en las luces del planeta, y pasa a `Cerradas`.
- La interfaz invita a la autora a publicar resultados.

**Publicar resultados (`/causa/[id]/resultados`):**
- **Obligatorio:**
  - monto recibido;
  - resumen de cómo se usó el dinero, entre 80 y 3.000 caracteres;
  - al menos 1 foto del "después".
- **Opcional:** más fotos y hasta 2 videos.
- Al publicar, la causa pasa a `finalizada` y aparece en `Finalizadas`.

---

## 7. Cómo funciona (punto 2)

**Página `/como-funciona`:** tres pasos, y el aviso legal visible. Los pasos sí son una secuencia, así que aquí la numeración está justificada. Texto propuesto (la persona dueña del proyecto puede ajustarlo):

1. **Publica tu causa.** Cuenta qué pasó, sube al menos dos fotos, indica tu ciudad y los medios por donde puedes recibir donaciones.
2. **Recibe apoyo directo.** Quienes quieran ayudarte te envían el dinero directamente a tus medios. Puente no recibe, no retiene y no cobra comisión sobre ninguna donación.
3. **Cierra y muestra resultados.** Cuando termines, cierra tu causa y comparte fotos del antes y el después para que quienes te apoyaron vean lo que lograron juntos.

**Aviso fijo al final de la página:**

> Puente es un espacio para conectar personas. No procesamos pagos ni verificamos que las donaciones se usen como se describe. Antes de donar, revisa el perfil, los comentarios y los resultados de causas anteriores de quien publica. Si algo no parece correcto, repórtalo.

**Tratamiento visual:**
- Tres bloques de vidrio con una ilustración simple, hecha en SVG propio.
- Al final, dos botones: `Crear una causa` y `Explorar causas`.
- **Móvil:** los bloques van en columna. **Escritorio:** en fila, conectados por un arco fino que recuerda al logo.

Crea también `/terminos` y `/privacidad` con texto provisional marcado como "Pendiente de revisión legal", y enlázalas desde el pie de página.

---

## 8. Cerradas (punto 3)

- **Qué muestra:** causas que ya no reciben donaciones, pero cuya autora aún no publicó resultados.
- **Feed:** mismo scroll infinito y misma tarjeta con la variante `cerrada`, ordenado por `closed_at desc`.
- **La tarjeta muestra:**
  - la insignia "Cerrada";
  - la fecha de cierre;
  - el monto reportado, si existe;
  - la línea "Esperando resultados".
- **La tarjeta no muestra** botones de donar.
- **Si la causa es propia,** aparece el botón `Publicar resultados`.
- Se puede comentar, guardar y seguir, igual que en Explorar.

---

## 9. Finalizadas (punto 4)

- **Qué muestra:** causas cuya autora publicó los resultados de las donaciones recibidas.
- **Feed:** misma tarjeta con la variante `finalizada`, ordenado por `finalized_at desc`.
- **La tarjeta muestra:**
  - la insignia "Finalizada";
  - el monto recibido;
  - un extracto del resumen de resultados;
  - como medio principal, un **par antes/después**: primera imagen de la causa y primera imagen de resultados, con un control deslizable para comparar; en móvil, dos imágenes que se alternan con un toque.
- **En la página de la causa finalizada,** la sección "Resultados" aparece **arriba** de la historia original, e incluye:
  - comparación antes/después;
  - galería de resultados;
  - monto recibido;
  - resumen;
  - un **hilo de comentarios de resultados**, separado del hilo original.
- Debajo sigue la causa original completa, con su hilo de comentarios.

---

## 10. Publicar una causa (punto 6)

**Requisitos para publicar:**
- mínimo **2 imágenes**;
- **descripción**;
- **ubicación**;
- **al menos 1 método** para recibir donaciones.

La validación se hace en tres lugares: en el formulario (zod), al intentar publicar, y en la base de datos, con un trigger que no se puede saltar (sección 12.5).

### 10.1 Flujo por pasos

Cada paso muestra su progreso, y se puede volver atrás sin perder datos.

**Paso 1 · Fotos y videos**
- Entre 2 y 10 imágenes (JPG, PNG, WebP, AVIF o HEIC), y hasta 2 videos (MP4, WebM o MOV) de máximo 50 MB y 90 segundos cada uno.
- Arrastrar para reordenar. La primera imagen es la portada.
- **Antes de subir, comprime cada imagen en el navegador:**
  - lado mayor de 2.000 px;
  - WebP con calidad aproximada de 0,82;
  - volver a codificarla en canvas también **elimina los metadatos EXIF, incluida la ubicación GPS**. Esto es obligatorio por privacidad.
- La duración del video se valida en el cliente leyendo sus metadatos.
- Cada archivo muestra su progreso, y un botón para reintentar si falla.

**Paso 2 · Tu historia**
- Título, de 10 a 90 caracteres.
- Categoría.
- Descripción, de 80 a 5.000 caracteres, con contador.
- Meta opcional, con monto y moneda (USD por defecto).

**Paso 3 · Ubicación**
- País: se selecciona de la lista de `mundo.json`. Si llega `?pais=XX`, viene precargado.
- Ciudad: con autocompletado, a través de un proveedor de geocodificación encapsulado detrás de una interfaz, `src/lib/geo/geocoder.ts`.
  - Opciones: MapTiler Geocoding (clave en `NEXT_PUBLIC_MAPTILER_KEY`) o Photon.
  - Revisa las condiciones de uso del proveedor elegido.
- Se guardan país, ciudad y las coordenadas del **centro de la ciudad**, redondeadas a 2 decimales.
- **Nunca** se pide dirección exacta, barrio ni punto en el mapa.
- **Texto de ayuda:** "Por tu seguridad solo mostramos tu ciudad."

**Paso 4 · Cómo recibir donaciones**
- Entre 1 y 5 métodos. Cada uno tiene:
  - tipo: transferencia bancaria, billetera digital, PayPal, enlace de pago u otro;
  - proveedor, por ejemplo el nombre del banco o de la billetera;
  - nombre del titular;
  - número de cuenta, teléfono, correo o enlace;
  - detalles opcionales.
- Si la persona ya publicó causas antes, puede copiar métodos de una causa anterior.
- **Aviso:** "Revisa bien estos datos. Las donaciones llegan directamente aquí."

**Paso 5 · Revisar y publicar**
- Vista previa exacta de la tarjeta del feed.
- Botón `Publicar causa`.

### 10.2 Guardado y subida

1. Al entrar al paso 1, crea la causa en estado `borrador`. Así existe un `id` para las rutas de Storage.
2. Guarda los cambios de cada paso automáticamente, con 800 ms de espera.
3. Sube los archivos a `{auth.uid()}/{cause_id}/{uuid}.{ext}`. Después inserta la fila en `cause_media` con dimensiones, duración y posición.
4. **Publicar** es un `update` de `status` a `activa`. Si el trigger rechaza la operación, traduce el código de error a un mensaje en español y lleva a la persona al paso que corresponde:

| Código del trigger | Mensaje | Paso |
|---|---|---|
| `REQ_IMAGENES` | Agrega al menos 2 fotos para publicar. | 1 |
| `REQ_TITULO` | El título debe tener entre 10 y 90 caracteres. | 2 |
| `REQ_DESCRIPCION` | Cuenta un poco más: la descripción necesita al menos 80 caracteres. | 2 |
| `REQ_UBICACION` | Elige tu país y tu ciudad. | 3 |
| `REQ_METODOS` | Agrega al menos un medio para recibir donaciones. | 4 |
| `REQ_PERFIL` | Completa tu nombre en tu perfil antes de publicar. | Enlace a `/ajustes` |

5. Los borradores de la persona aparecen en su perfil (visibles solo para ella), con `Continuar` y `Eliminar`.

---

## 11. Estilo visual: vidrio líquido (punto 7)

### 11.1 Qué cambia respecto al prototipo

El prototipo usa **glassmorfismo**: un panel translúcido con desenfoque. La versión definitiva debe sentirse como **vidrio líquido**, el lenguaje visual de Apple en sus sistemas 26. La diferencia está en cinco rasgos:

1. **Refracción en los bordes.** Lo que pasa por detrás se curva cerca del borde, como a través de un lente.
2. **Brillo especular.** Un borde de luz fino y desigual: más brillante arriba, más tenue abajo.
3. **Tinte que toma color del fondo.** Menos "gris lechoso" y más saturación de lo que hay detrás.
4. **Profundidad.** Sombra suave y un leve realce interior.
5. **Respuesta física.** Al presionar, el elemento se comprime un poco con una animación elástica, y el brillo se intensifica.

### 11.2 Paleta base

Viene del prototipo y no cambia.

| Token | Oscuro | Claro |
|---|---|---|
| Fondo | `#050505` | `#FFFFFF` |
| Texto | `#F5F5F0` | `#0A1633` |
| Texto secundario | `#A6A69F` | `#465170` |
| Azul de acento (luces, progreso) | `#4E80FF` | `#2E62F2` |
| Botón principal | `#2E62F2` | `#1F4FD8` |
| Océano del planeta | `#050912` | `#EEF3FC` |
| Tierra del planeta | `#0A1226` | `#0D2152` |

**Regla que se mantiene:** el azul se reserva para lo que significa ayuda (luces, progreso, botón principal, enlaces de acción). Lo demás es neutro.

### 11.3 Tokens de vidrio

Agrégalos a `globals.css`, con valores para ambos temas:

```css
:root {
  --glass-tint: rgba(255, 255, 255, 0.46);
  --glass-tint-strong: rgba(255, 255, 255, 0.72);   /* textos largos encima */
  --glass-blur: 18px;
  --glass-saturate: 180%;
  --glass-rim-top: rgba(255, 255, 255, 0.9);
  --glass-rim-bottom: rgba(255, 255, 255, 0.25);
  --glass-edge: rgba(10, 22, 51, 0.08);
  --glass-shadow: 0 18px 50px -24px rgba(10, 22, 51, 0.35);
  --glass-highlight: rgba(255, 255, 255, 0.55);
}
:root[data-theme="dark"] {                            /* repetir también en el @media oscuro */
  --glass-tint: rgba(14, 18, 32, 0.38);
  --glass-tint-strong: rgba(10, 13, 24, 0.72);
  --glass-rim-top: rgba(255, 255, 255, 0.22);
  --glass-rim-bottom: rgba(255, 255, 255, 0.04);
  --glass-edge: rgba(255, 255, 255, 0.07);
  --glass-shadow: 0 20px 60px -24px rgba(0, 0, 0, 0.85);
  --glass-highlight: rgba(140, 170, 255, 0.18);
}
```

### 11.4 Componente `<Glass>`

Construye un solo componente, `src/components/ui/Glass.tsx`, con variantes: `bar` (header y barra inferior), `panel`, `sheet`, `pill` (búsqueda, chips), `button` y `menu`. Se arma en capas, con **mejora progresiva**:

1. **Base (todos los navegadores)**
   - fondo `var(--glass-tint)`;
   - `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate))`, con su versión `-webkit-`;
   - `box-shadow: var(--glass-shadow)`.
2. **Borde de luz (todos)**
   - un pseudo‑elemento con un degradado lineal de `--glass-rim-top` a `--glass-rim-bottom`;
   - recortado con `mask` para dejar solo un borde de 1 px;
   - más `inset 0 1px 0 var(--glass-highlight)`.
3. **Refracción (solo Chromium: Chrome, Edge, Brave, Arc)**
   - un filtro SVG con `feImage` (mapa de desplazamiento generado en canvas al tamaño y radio del elemento) y `feDisplacementMap`;
   - se aplica con `backdrop-filter: url(#id) blur(...) saturate(...)`;
   - **Safari y Firefox no admiten filtros SVG en `backdrop-filter`.** Ahí se queda en las capas 1, 2 y 4, sin errores;
   - detecta Chromium con `navigator.userAgentData?.brands`, no con `CSS.supports`;
   - regenera el mapa cuando cambia el tamaño, con `ResizeObserver`;
   - amplía la región del filtro para que el desplazamiento no se corte en los bordes.
4. **Brillo que sigue el puntero (solo escritorio, con `hover: hover`)**
   - variables `--mx` y `--my` que mueven un `radial-gradient` muy sutil;
   - desactivado en táctil y con `prefers-reduced-motion`.
5. **Presión**
   - `:active` escala a 0,97 con una transición elástica (`cubic-bezier(.34,1.56,.64,1)`, 220 ms).

### 11.5 Dónde sí y dónde no

**Con refracción** (máximo unos 6 elementos visibles a la vez):
- header flotante;
- barra de búsqueda del hero;
- barra inferior en móvil;
- panel del país y hojas inferiores;
- modales;
- botón `Crear una causa`.

**Solo vidrio base, sin refracción:**
- chips de filtros;
- menús;
- tooltip del planeta;
- controles del carrusel;
- tarjetas de "Cómo funciona".

**Sin vidrio:**
- las tarjetas del feed: superficie sólida con un borde de luz fino, porque el vidrio en decenas de tarjetas durante el scroll arruina el rendimiento;
- formularios largos;
- textos extensos.

**El vidrio necesita algo detrás para lucirse.** Fuera del hero, pon en el fondo de la página un par de manchas de azul muy oscuro, grandes, desenfocadas y casi imperceptibles, fijas al viewport. En modo claro, azul muy pálido.

### 11.6 Accesibilidad del vidrio

- El texto sobre vidrio debe cumplir contraste 4,5:1. Si no llega, usa `--glass-tint-strong`.
- Con `@media (prefers-reduced-transparency: reduce)` o `(prefers-contrast: more)`, las superficies de vidrio se vuelven sólidas (`--surface-solid`), con borde visible.
- Foco visible siempre: anillo de 2 px con el azul de acento.
- Los botones de vidrio siguen siendo `<button>` con su etiqueta.

---

## 12. Base de datos con el MCP de Supabase (punto 5)

El IDE está conectado al MCP de Supabase. **Toda la base de datos se crea desde ahí**, con migraciones.

### 12.1 Procedimiento obligatorio

1. **Confirma el proyecto.** Usa `list_projects` / `get_project` y confirma con la persona cuál es. No crees proyectos nuevos sin preguntar.
2. **Revisa lo que ya existe** con `list_tables`, `list_extensions` y `list_migrations`. No borres tablas existentes sin preguntar.
3. **Aplica cada bloque con `apply_migration`,** con nombres descriptivos y en este orden:
   1. `001_extensiones_y_tipos`
   2. `002_perfiles`
   3. `003_causas`
   4. `004_medios_y_metodos`
   5. `005_resultados`
   6. `006_social`, con comentarios, seguidores, guardados y reportes
   7. `007_actividad_y_vistas`
   8. `008_rls`
   9. `009_storage`
   10. `010_funciones_busqueda`
   - **Usa `execute_sql` solo para consultas de verificación, nunca para cambiar el esquema.**
4. **Crea los buckets de Storage con SQL dentro de una migración.** El grupo de herramientas de Storage del MCP viene desactivado por defecto.
5. **Revisa advertencias.** Ejecuta `get_advisors` de seguridad y de rendimiento. Corrige todas las advertencias de seguridad antes de seguir.
6. **Genera los tipos.** Usa `generate_typescript_types` y guárdalos en `src/types/database.ts`. Repite este paso después de cada migración.
7. **Crea datos semilla solo en desarrollo.** Si la persona lo pide, crea 3 usuarios de prueba y unas 20 causas repartidas en varios países para ver el planeta encendido. Márcalos para poder borrarlos.

Todas las funciones llevan `set search_path = ''` y usan nombres calificados (`public.tabla`). Las funciones con `security definer` se usan solo donde se indica.

### 12.2 Extensiones y tipos

```sql
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.cause_status as enum ('borrador','activa','cerrada','finalizada','oculta');
create type public.cause_category as enum ('terremoto','inundacion','incendio','tormenta','sequia','salud','alimentacion','vivienda','educacion','otra');
create type public.media_phase as enum ('causa','resultado');
create type public.media_kind as enum ('imagen','video');
create type public.donation_method_kind as enum ('transferencia_bancaria','billetera_digital','paypal','enlace_de_pago','otro');
create type public.comment_thread as enum ('causa','resultado');
create type public.report_reason as enum ('fraude','informacion_falsa','contenido_inapropiado','spam','otro');
create type public.activity_kind as enum ('causa_publicada','causa_cerrada','causa_finalizada');
```

**Los estados de una causa:**

| Estado | Significado | Dónde aparece | Quién lo cambia |
|---|---|---|---|
| `borrador` | En preparación | Solo en el perfil de la autora | Estado inicial |
| `activa` | Recibe donaciones | Explorar, planeta, buscador | La autora, si cumple los requisitos |
| `cerrada` | Ya no recibe donaciones y no tiene resultados | Cerradas | La autora, solo desde `activa` |
| `finalizada` | Con resultados publicados | Finalizadas | La autora, solo desde `cerrada` y con resultados |
| `oculta` | Retirada por moderación | Ningún lugar público | Solo roles de servidor |

Transiciones válidas: `borrador → activa → cerrada → finalizada`. Cualquier otra se rechaza.

### 12.3 Tablas

Todas las tablas tienen `created_at timestamptz not null default now()`. Las que se editan tienen además `updated_at`, que se actualiza con un trigger `set_updated_at`.

**`profiles`**, una por usuario, creada automáticamente al registrarse:

| Columna | Tipo y reglas |
|---|---|
| `id` | `uuid` PK, `references auth.users(id) on delete cascade` |
| `username` | `text not null unique`, check `^[a-z0-9_]{3,24}$` |
| `full_name` | `text not null default ''`, máximo 80 |
| `avatar_url` | `text` |
| `bio` | `text`, máximo 280 |
| `country_code` / `city` | `text`, opcional |
| `followers_count`, `following_count`, `causes_count` | `int not null default 0`, solo los triggers lo cambian |

**`causes`:**

| Columna | Tipo y reglas |
|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` |
| `author_id` | `uuid not null references public.profiles(id) on delete cascade` |
| `status` | `public.cause_status not null default 'borrador'` |
| `title` | `text`, máximo 90 |
| `description` | `text`, máximo 5000 |
| `category` | `public.cause_category not null default 'otra'` |
| `country_code` | `text`, check `^[A-Z]{2}$` |
| `city`, `region` | `text` |
| `lat` | `numeric(5,2)`, centro de la ciudad, nunca exacto |
| `lng` | `numeric(6,2)`, centro de la ciudad, nunca exacto |
| `goal_amount` | `numeric(12,2)`, check `> 0`, opcional |
| `currency` | `text not null default 'USD'`, check `^[A-Z]{3}$` |
| `raised_reported` | `numeric(12,2)`, check `>= 0`, reportado por la autora |
| `closing_note` | `text`, máximo 500 |
| `comments_count`, `saves_count` | `int not null default 0` |
| `published_at`, `closed_at`, `finalized_at` | `timestamptz`, los asigna el trigger |

**Índices de `causes`:**
- `(status, published_at desc, id desc)`
- `(status, closed_at desc, id desc)`
- `(status, finalized_at desc, id desc)`
- `(country_code, status)`
- `(author_id, created_at desc)`
- GIN trigram sobre el título normalizado (sección 12.6)

**`cause_media`:**

| Columna | Tipo y reglas |
|---|---|
| `id` | `uuid` PK |
| `cause_id` | `uuid not null references public.causes(id) on delete cascade` |
| `owner_id` | `uuid not null references public.profiles(id)` |
| `phase` | `public.media_phase not null default 'causa'` |
| `kind` | `public.media_kind not null` |
| `bucket` | `text not null`, `'causas-imagenes'` o `'causas-videos'` |
| `storage_path` | `text not null unique` |
| `width`, `height` | `int` |
| `duration_seconds` | `numeric(6,2)`, check `<= 90` |
| `position` | `smallint not null default 0` |
| `alt` | `text`, máximo 200 |

Índice de `cause_media`: `(cause_id, phase, position)`.

**`donation_methods`**, los métodos de envío de donaciones de cada causa:

| Columna | Tipo y reglas |
|---|---|
| `id` | `uuid` PK |
| `cause_id` | `uuid not null references public.causes(id) on delete cascade` |
| `owner_id` | `uuid not null references public.profiles(id)` |
| `kind` | `public.donation_method_kind not null` |
| `provider` | `text not null`, máximo 60 |
| `account_holder` | `text not null`, máximo 80 |
| `account_value` | `text not null`, máximo 200 |
| `details` | `text`, máximo 300 |
| `position` | `smallint not null default 0` |

**`cause_results`**, uno por causa:

| Columna | Tipo y reglas |
|---|---|
| `cause_id` | `uuid` PK `references public.causes(id) on delete cascade` |
| `owner_id` | `uuid not null references public.profiles(id)` |
| `amount_received` | `numeric(12,2) not null`, check `>= 0` |
| `currency` | `text not null default 'USD'` |
| `summary` | `text not null`, entre 80 y 3000 caracteres |

**`comments`:**

| Columna | Tipo y reglas |
|---|---|
| `id` | `uuid` PK |
| `cause_id` | `uuid not null references public.causes(id) on delete cascade` |
| `author_id` | `uuid not null references public.profiles(id) on delete cascade` |
| `parent_id` | `uuid references public.comments(id) on delete cascade`, nulo si es raíz |
| `thread` | `public.comment_thread not null default 'causa'` |
| `body` | `text not null`, entre 1 y 1000 caracteres |
| `replies_count` | `int not null default 0` |
| `edited_at` | `timestamptz` |

Índices de `comments`:
- `(cause_id, thread, created_at desc) where parent_id is null`
- `(parent_id, created_at)`

**`follows`:** columnas `follower_id` y `following_id`, ambas `uuid` que referencian `profiles` con `on delete cascade`. PK compuesta. Check `follower_id <> following_id`. Índice en `following_id`.

**`saves`:** columnas `user_id` y `cause_id`. PK compuesta. Índice `(user_id, created_at desc)`.

**`reports`:**
- `id`, `reporter_id`;
- `cause_id`, `comment_id`, `profile_id`: exactamente uno debe ser no nulo, con un check;
- `reason public.report_reason not null`;
- `details` (máximo 500);
- `status text not null default 'pendiente'`, check sobre `pendiente`, `revisado` y `descartado`.

**`activity_events`**, que alimenta el planeta en tiempo real:
- `id bigint generated always as identity` PK;
- `kind public.activity_kind not null`;
- `cause_id uuid not null references public.causes(id) on delete cascade`;
- `country_code text not null`;
- `city text`;
- `actor_name text`.

### 12.4 Privilegios por columna

Evitan que el cliente altere contadores, fechas o la autoría:

```sql
revoke insert, update on public.causes from anon, authenticated;
grant insert (author_id, title, description, category, country_code, city, region, lat, lng, goal_amount, currency)
  on public.causes to authenticated;
grant update (status, title, description, category, country_code, city, region, lat, lng, goal_amount, currency, raised_reported, closing_note)
  on public.causes to authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (username, full_name, avatar_url, bio, country_code, city) on public.profiles to authenticated;

revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;
```

Aplica el mismo criterio a `cause_media`, `donation_methods` y `cause_results`: solo las columnas de contenido son editables.

### 12.5 Triggers

**1. Crear el perfil al registrarse**

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  base := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then base := 'persona'; end if;
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    left(base, 18) || '_' || substr(replace(new.id::text, '-', ''), 1, 5),
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 80),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
```

**2. Reglas de estado de la causa**

Es el corazón de los requisitos del punto 6. Trigger `before update` en `causes`, con `security invoker`:

```sql
create or replace function public.enforce_cause_status()
returns trigger language plpgsql set search_path = '' as $$
declare n_img int; n_met int; n_res_img int; author_name text;
begin
  if new.status = old.status then
    if old.status = 'finalizada' and (new.title, new.description, new.category, new.country_code, new.city)
       is distinct from (old.title, old.description, old.category, old.country_code, old.city) then
      raise exception 'CAUSA_BLOQUEADA' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Moderación: solo roles de servidor ocultan o restauran
  if new.status = 'oculta' or old.status = 'oculta' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status = 'borrador' and new.status = 'activa' then
    select count(*) into n_img from public.cause_media
      where cause_id = new.id and phase = 'causa' and kind = 'imagen';
    select count(*) into n_met from public.donation_methods where cause_id = new.id;
    select full_name into author_name from public.profiles where id = new.author_id;
    if n_img < 2 then raise exception 'REQ_IMAGENES' using errcode = 'P0001'; end if;
    if char_length(coalesce(new.title, '')) not between 10 and 90 then raise exception 'REQ_TITULO' using errcode = 'P0001'; end if;
    if char_length(coalesce(new.description, '')) < 80 then raise exception 'REQ_DESCRIPCION' using errcode = 'P0001'; end if;
    if new.country_code is null or new.city is null or new.lat is null or new.lng is null then
      raise exception 'REQ_UBICACION' using errcode = 'P0001';
    end if;
    if n_met < 1 then raise exception 'REQ_METODOS' using errcode = 'P0001'; end if;
    if char_length(coalesce(author_name, '')) < 2 then raise exception 'REQ_PERFIL' using errcode = 'P0001'; end if;
    new.published_at := now();
  elsif old.status = 'activa' and new.status = 'cerrada' then
    new.closed_at := now();
  elsif old.status = 'cerrada' and new.status = 'finalizada' then
    if not exists (select 1 from public.cause_results where cause_id = new.id) then
      raise exception 'REQ_RESULTADOS' using errcode = 'P0001';
    end if;
    select count(*) into n_res_img from public.cause_media
      where cause_id = new.id and phase = 'resultado' and kind = 'imagen';
    if n_res_img < 1 then raise exception 'REQ_FOTO_DESPUES' using errcode = 'P0001'; end if;
    new.finalized_at := now();
  else
    raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger causes_enforce_status
  before update on public.causes for each row execute function public.enforce_cause_status();
```

**3. Registrar actividad**

- Trigger `after update of status` en `causes`, con `security definer`.
- Inserta en `activity_events`:
  - `causa_publicada` al pasar a `activa`;
  - `causa_cerrada` al pasar a `cerrada`;
  - `causa_finalizada` al pasar a `finalizada`.
- Copia `country_code`, `city` y el `full_name` de la autora.
- Borra los eventos de más de 30 días en la misma función, de forma barata: con límite, o una vez de cada 100 inserciones.

**4. Proteger las imágenes mínimas**

- Trigger `before delete` en `cause_media`.
- Si la causa está `activa` y quedarían menos de 2 imágenes de fase `causa`, lanza `REQ_IMAGENES`.
- Deja pasar el borrado en cascada cuando se elimina un borrador.

**5. Comentarios de un solo nivel**

Trigger `before insert` en `comments`:
- el padre debe existir y pertenecer a la misma causa y al mismo hilo;
- si el padre ya es una respuesta, `new.parent_id := padre.parent_id`;
- los comentarios del hilo `resultado` solo se permiten si la causa está `finalizada`;
- cualquier comentario requiere que la causa esté en `activa`, `cerrada` o `finalizada`.

**6. Contadores**

Triggers `after insert or delete`, con `security definer`, que mantienen:
- `causes.comments_count`
- `comments.replies_count`
- `causes.saves_count`
- `profiles.followers_count` y `following_count`
- `profiles.causes_count`, que cuenta las causas no borrador; actualízalo también en el trigger de actividad

**7. `set_updated_at`** en `profiles`, `causes`, `cause_results` y `comments`. En `comments`, además, marca `edited_at` cuando cambia `body`.

### 12.6 Vistas y funciones

**Conteo por país para el planeta:**

```sql
create view public.country_cause_counts with (security_invoker = true) as
  select country_code, count(*)::int as active_count
  from public.causes where status = 'activa'
  group by country_code;
```

**Búsqueda:**
- Crea `public.f_unaccent(text)` como envoltura `immutable` de `extensions.unaccent`, para poder indexar.
- Crea índices GIN trigram sobre `public.f_unaccent(lower(title))` en `causes`, y sobre `public.f_unaccent(lower(full_name || ' ' || username))` en `profiles`.
- **Firma de la función:** `public.search_people_and_causes(q text, max_results int default 8)`
  - `stable`, `security invoker`;
  - devuelve filas con `kind` (`'persona'` | `'causa'`), `id`, `label`, `sublabel`, `username` (personas), `country_code`, `lat`, `lng` y `score`;
  - solo causas `activa`;
  - ordena por coincidencia al inicio, luego por similitud.

**Realtime:**
- `alter publication supabase_realtime add table public.activity_events;`
- **No** publiques `causes`: los contadores la actualizan constantemente y generarían ruido.

### 12.7 RLS

Activa RLS en **todas** las tablas de `public`. En las políticas usa `(select auth.uid())` en lugar de `auth.uid()`, por rendimiento.

"Visible" significa que la causa está en `activa`, `cerrada` o `finalizada`, o que la persona que consulta es la autora.

| Tabla | select | insert | update | delete |
|---|---|---|---|---|
| `profiles` | todos | solo el trigger | la propia persona | nadie |
| `causes` | visibles | con sesión, `author_id` propio y `status = 'borrador'` | la autora; el trigger valida los estados | la autora, solo en `borrador` |
| `cause_media` | si la causa es visible | la autora de la causa: fase `causa` en borrador o activa; fase `resultado` en cerrada | la autora (posición, alt) | la autora; el trigger protege el mínimo |
| `donation_methods` | **solo con sesión** y causa visible (decisión 2) | la autora, en borrador o activa | la autora, en borrador o activa | la autora, en borrador o activa, sin dejar 0 si está activa |
| `cause_results` | si la causa es visible | la autora, causa `cerrada` | la autora | nadie |
| `comments` | si la causa es visible | con sesión y `author_id` propio | quien comentó | quien comentó o la autora de la causa |
| `follows` | todos | `follower_id` propio | nadie | `follower_id` propio |
| `saves` | solo la propia persona | la propia persona | nadie | la propia persona |
| `reports` | solo quien reportó | con sesión y `reporter_id` propio | nadie | nadie |
| `activity_events` | todos | nadie; solo el trigger | nadie | nadie |

### 12.8 Storage

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('causas-imagenes', 'causas-imagenes', true, 10485760, array['image/webp','image/jpeg','image/png','image/avif']),
  ('causas-videos',   'causas-videos',   true, 52428800, array['video/mp4','video/webm','video/quicktime']),
  ('avatares',        'avatares',        true,  2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "subir en mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id in ('causas-imagenes','causas-videos','avatares')
              and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "borrar en mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id in ('causas-imagenes','causas-videos','avatares')
         and (storage.foldername(name))[1] = (select auth.uid()::text));
```

**Notas:**
- Los buckets son públicos para lectura, así `next/image` funciona sin URLs firmadas. Las rutas llevan uuids imposibles de adivinar.
- Verifica el límite global de tamaño de subida del plan del proyecto. En planes gratuitos suele ser 50 MB.
- Deja anotada como tarea futura la limpieza de archivos huérfanos, es decir, subidos pero sin fila en `cause_media`.

---

## 13. Decisiones por defecto

El agente las aplica tal cual. La persona dueña del proyecto puede cambiarlas aquí antes de ejecutar.

1. **Cerrada vs. Finalizada.**
   - *Cerrada:* ya no recibe donaciones y todavía no publica resultados.
   - *Finalizada:* publicó resultados con antes y después.
2. **Métodos de donación visibles solo con sesión iniciada.** Así se evita que bots recojan números de teléfono y cuentas, y cada reporte queda ligado a una cuenta. Para hacerlos públicos, cambia la política `select` de `donation_methods` y quita el bloque "Inicia sesión para ver cómo donar".
3. **El monto recaudado lo reporta quien publica.** La plataforma no puede verificarlo, así que siempre se etiqueta como "reportado".
4. **Las luces del planeta representan solo causas activas.**
5. **Se eliminan los arcos de donaciones del prototipo.** No hay datos reales de donaciones.
6. **Respuestas a comentarios de un solo nivel.**
7. **Ubicación pública a nivel de ciudad.** Nunca se pide dirección exacta, y se eliminan los datos GPS de las fotos.
8. **Límites de medios:**
   - causa: 2 a 10 imágenes y hasta 2 videos de 50 MB y 90 s;
   - resultados: 1 a 10 imágenes y hasta 2 videos.
9. **Inicio de sesión:** correo con enlace mágico o código de un solo uso, y Google. El proveedor de Google se configura en el panel de Supabase; pide las credenciales a la persona, no las inventes.
10. **"Puente" es un nombre provisional.** Centralízalo en `src/config/site.ts` para cambiarlo en un solo lugar.
11. **La interfaz está en español.** Deja los textos en `src/content/es.ts` para facilitar otros idiomas después.

---

## 14. Fases de trabajo

### Fase 0 · Reconocimiento
- Lee `package.json`, la estructura de carpetas y `planeta-hero.html` completo.
- Confirma el proyecto de Supabase mediante el MCP.
- Entrega un resumen corto: versiones encontradas, lo que falta instalar, dudas.
- **Criterio:** la persona aprueba el resumen.

### Fase 1 · Base de datos
- Migraciones de la sección 12, en orden.
- `get_advisors` sin advertencias de seguridad.
- Tipos generados.
- **Criterio:** pruebas con `execute_sql` que demuestran lo siguiente:
  - publicar con 1 imagen falla con `REQ_IMAGENES`;
  - una respuesta a una respuesta queda colgando del comentario raíz;
  - un usuario anónimo no puede leer `donation_methods`.

### Fase 2 · Fundación
- Clientes de Supabase y `proxy.ts`.
- `/entrar` y `/auth/callback`.
- Layout raíz, tokens, tema claro/oscuro con persistencia.
- Componente `<Glass>` con sus variantes.
- Header responsive y barra inferior en móvil.
- Fondo ambiental.
- **Criterio:**
  - iniciar y cerrar sesión funciona;
  - el header se ve como vidrio líquido en Chrome y como vidrio base en Safari y Firefox, sin errores;
  - `next build` pasa sin errores de tipos.

### Fase 3 · Planeta
- Portar el hero según la sección 5, con datos reales y Realtime.
- Eliminar la simulación.
- **Criterio:**
  - al publicar una causa desde otra pestaña, la luz de su país se enciende sin recargar;
  - el panel muestra causas reales y los enlaces llevan a las rutas correctas;
  - el planeta se ve igual que en el prototipo en ambos temas.

### Fase 4 · Publicar causa
- Flujo de la sección 10 completo.
- **Criterio:**
  - no se puede publicar sin cumplir los 4 requisitos, ni siquiera llamando a la API directamente;
  - las fotos subidas no conservan datos GPS.

### Fase 5 · Explorar y página de la causa
- Secciones 6.1 a 6.6: feed infinito, seguir, guardar, comentarios con respuestas, página completa, metadatos para compartir.
- **Criterio:**
  - el scroll infinito carga sin duplicados ni saltos;
  - volver atrás conserva la posición;
  - las acciones optimistas se revierten si fallan.

### Fase 6 · Cierre y resultados
- Sección 6.7, `/cerradas` (sección 8) y `/finalizadas` (sección 9), con comparación antes/después y el hilo de comentarios de resultados.
- **Criterio:** una causa recorre `borrador → activa → cerrada → finalizada` y aparece en el feed correcto en cada paso.

### Fase 7 · Cierre del proyecto
- `/como-funciona`, perfil, `/guardadas`, `/ajustes`, reportes, `/terminos` y `/privacidad`.
- Revisión de accesibilidad y rendimiento.
- `get_advisors` de nuevo.
- **Criterio:** sección 15 completa.

---

## 15. Definición de terminado

- [ ] `next build` y el lint pasan sin errores. Nada de `any` sin justificar.
- [ ] Ningún secreto en el repositorio; `.env.local` está en `.gitignore`.
- [ ] RLS activa en todas las tablas; `get_advisors` de seguridad sin advertencias.
- [ ] Funciona en Chrome, Safari y Firefox recientes, en escritorio y en móvil, desde 360 px de ancho.
- [ ] Modo claro y modo oscuro completos en todas las pantallas.
- [ ] Navegación completa con teclado, foco visible, `prefers-reduced-motion` y `prefers-reduced-transparency` respetados.
- [ ] Contraste de texto AA en todas las superficies, incluido el vidrio.
- [ ] El hero muestra el poster al instante, y el planeta no bloquea la interacción mientras carga.
- [ ] Imágenes con `next/image`, tamaños correctos y carga diferida; videos con `preload="none"` fuera de pantalla.
- [ ] Todo contenido de usuarios se muestra como texto; nunca con `dangerouslySetInnerHTML`.
- [ ] Los errores se explican en español con una acción para resolverlos (por ejemplo, "Reintentar" o "Ir al paso 1"). Nunca muestran mensajes técnicos.
- [ ] Ninguna pantalla muestra datos simulados.
