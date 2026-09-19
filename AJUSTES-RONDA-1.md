# Puente · Ajustes, ronda 1

> **Para el agente:** este documento corrige la versión que ya está construida. Complementa a `PLAN-VERSION-DEFINITIVA.md`; **si algo choca, manda este documento**. Lee todo antes de empezar y trabaja en el orden de la sección 8. No rompas nada que ya funcione (planeta, autenticación, publicación, comentarios, Realtime).

## Archivos de referencia

- `planeta-hero.html`: el prototipo del planeta. Contiene la matemática correcta de tamaño y zoom.
- **El HTML de Stakeholders** (sitio `https://stakeholders-hazel.vercel.app/`).
  - Si no está en la carpeta del proyecto, pide a la persona que lo copie en `referencias/stakeholders.html`.
  - De ese archivo salen el fondo de estrellas y el estilo de los SVG.
  - Las partes que interesan son:
    - la clase `.grain`;
    - la clase `.neural-canvas`;
    - el bloque de script que empieza con el comentario `EFECTO NEURONAL + MAPA DE CALOR`;
    - el fondo de `.servicio`;
    - las reglas `.illustration svg`, `.fig-label` y `.chip svg`.

## Cómo verificar cada ajuste

Toma capturas en estos tamaños, en **modo oscuro y modo claro**, y compáralas con los criterios de aceptación de cada sección:

- 1920 × 1080
- 1440 × 900
- 1280 × 800
- 390 × 844 (móvil)

---

## 0. Resumen

| # | Ajuste | Dónde |
|---|---|---|
| 1 | El planeta está demasiado cerca; el titular debe ir en una sola línea en computador | Hero `/` |
| 2 | Fondo de estrellas de Stakeholders, combinado con el vidrio líquido | `/explorar`, `/cerradas`, `/finalizadas`, `/como-funciona` |
| 3 | Filtros en una columna a la izquierda, buscador propio y "historias" de causas que cerraron recaudo | `/explorar`, `/cerradas`, `/finalizadas` |
| 4 | Tarjeta horizontal y publicaciones de prueba con marcos donde irían las imágenes | Feeds y página de la causa |
| 5 | Sin emojis ni librerías de iconos; solo SVG de línea al estilo Stakeholders | Todo el sitio |
| 6 | Planeta en modo claro con océanos azules y países verdes | Hero `/` |
| 7 | Otros errores vistos en las capturas | Varios |

---

## 1. Hero: planeta más lejos y titular en una línea

### 1.1 Qué se ve mal

- **El planeta ocupa casi toda la altura de la pantalla.** Pasa por detrás del header y del titular, y se sale por abajo.
- **El titular "Cada luz es una persona que necesita ayuda." se parte en dos líneas** en una pantalla de 1874 px de ancho.
- **En modo claro, el titular y el subtítulo quedan encima del planeta** y no se leen.

### 1.2 Corrección del tamaño del planeta

1. **Porta `layout()` desde `planeta-hero.html` sin cambiar la fórmula.**
   - El diámetro `D` sale del espacio que queda entre el borde inferior del buscador y el borde inferior del hero.
   - La altitud de la cámara se calcula a partir de `D`, de la altura del contenedor y del campo de visión de 50°.
2. **Revisa estas causas probables del problema**, en orden:
   - **`controls().maxDistance`:** si tiene un valor fijo menor que la distancia de inicio, la cámara se ve obligada a acercarse. Debe ser `100 * (1 + homeAlt * 1.25)`, calculado **después** de conocer `homeAlt`.
   - **`pointOfView({ altitude: homeAlt }, 0)`:** vuelve a aplicarlo dentro de `onGlobeReady` y cada vez que cambia el tamaño de la ventana (si no hay país seleccionado).
   - **Altura del contenedor:** si ocupa exactamente el viewport y no la altura calculada `Hc` del prototipo, la fórmula da otro resultado.
   - **Altitud fija:** confirma que no quedó una altitud escrita a mano (por ejemplo `1.5`) de alguna prueba.
   - **Header más alto:** el header flotante mide más que el del prototipo. `layout()` debe medir el buscador **real** con `getBoundingClientRect()`, después de que carguen las fuentes (`document.fonts.ready`).

**Criterios de aceptación en computador:**
- La esfera completa, **atmósfera incluida**, se ve entera.
- El borde superior del planeta queda **a la altura del centro vertical del buscador o más abajo**; nunca detrás del titular.
- El borde inferior queda al menos **24 px por encima** del final de la pantalla.
- En 1920 × 1080 el diámetro está aproximadamente entre 640 y 760 px, según la altura real del header.

**Criterio en móvil:** el planeta ocupa cerca del 94 % del ancho y no toca las estadísticas de abajo.

### 1.3 Titular en una línea

- **Desde 1024 px de ancho:**
  - `white-space: nowrap`, sin `max-width` en el `h1`;
  - `font-size: clamp(2.25rem, 3.4vw, 3.6rem)`.
  - Es la misma idea que usa Stakeholders con `.hero-title .line { white-space: nowrap }`.
- **Por debajo de 1024 px:** vuelve a `text-wrap: balance` en dos líneas.
- **El subtítulo** puede quedar en dos líneas, con `max-width: 52ch`.

**Criterio:** en 1024, 1280, 1440 y 1920 px el titular ocupa una sola línea sin cortarse ni desbordar.

### 1.4 Texto legible sobre el planeta

- Al pasar el titular a una línea y alejar el planeta, **ningún texto del hero debe quedar encima de la esfera.** Si en algún tamaño se tocan, `layout()` reduce `D`; nunca se deja el texto encima.
- **El buscador sí puede montarse un poco sobre el borde superior del planeta,** como en el prototipo. Para que el texto se lea:
  - usa `--glass-tint-strong`;
  - el color del placeholder debe cumplir contraste 4,5:1 en ambos temas.
  - En la captura del modo claro, el placeholder es gris sobre gris y no se lee.

---

## 2. Fondo de estrellas de Stakeholders + vidrio líquido

**Aplica en:** `/explorar`, `/cerradas`, `/finalizadas` y `/como-funciona`.

**El hero `/` conserva su propio cielo estrellado** (el del prototipo); no lo reemplaces.

### 2.1 Qué es el fondo de Stakeholders

No es un cielo estático. Son tres capas:

1. **Red de nodos (canvas).**
   - Puntos pequeños que derivan muy despacio por la pantalla.
   - Líneas finas unen los nodos que están a menos de 110 px entre sí.
   - Cerca del cursor (radio de 240 px), nodos y líneas se encienden.
   - Un halo blanco muy suave, tipo mapa de calor, sigue al cursor.
   - **En pantallas táctiles, o si el mouse lleva 2,5 s quieto,** el halo se mueve solo con una trayectoria senoidal lenta.
2. **Grano.** Ruido fractal generado con SVG (`feTurbulence`), fijo sobre toda la página, con opacidad 0,1 y `mix-blend-mode: overlay`.
3. **Resplandor azul.** `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(77,127,255,0.06), transparent 70%)` en la parte superior.

### 2.2 Cómo portarlo

En Stakeholders cada sección tiene su propio canvas. Aquí los feeds tienen scroll infinito, así que se usa **un solo canvas fijo del tamaño del viewport**, detrás de todo el contenido.

Componente `src/components/fondo/FondoConstelacion.tsx`, adaptado del script original:

```tsx
'use client';
import { useEffect, useRef } from 'react';

const LINK_DIST = 110;
const MOUSE_RADIUS = 240;
type Nodo = { x: number; y: number; vx: number; vy: number; r: number };

export function FondoConstelacion() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = matchMedia('(hover: none)').matches;
    const pointer = { x: -99999, y: -99999, t: -99999 };
    const phase = Math.random() * Math.PI * 2;
    let nodos: Nodo[] = [];
    let w = 0, h = 0, raf = 0, last = 0;

    // Colores desde CSS para respetar el tema
    let rgb = '255,255,255', halo = 0.085, fuerza = 1;
    const leerTema = () => {
      const cs = getComputedStyle(document.documentElement);
      rgb = cs.getPropertyValue('--fx-rgb').trim() || rgb;
      halo = parseFloat(cs.getPropertyValue('--fx-halo')) || halo;
      fuerza = parseFloat(cs.getPropertyValue('--fx-fuerza')) || fuerza;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(26, Math.min(85, Math.round((w * h) / 17000)));
      nodos = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24, vy: (Math.random() - 0.5) * 0.24,
        r: 1 + Math.random() * 1.3,
      }));
    };

    const draw = (now: number) => {
      let mx = pointer.x, my = pointer.y;
      if (touch || now - pointer.t > 2500) {
        mx = w * (0.5 + 0.36 * Math.sin(now * 0.00042 + phase));
        my = h * (0.5 + 0.36 * Math.sin(now * 0.00031 + phase * 1.7));
      }
      ctx.clearRect(0, 0, w, h);

      const g = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_RADIUS * 1.35);
      g.addColorStop(0, `rgba(${rgb},${halo})`);
      g.addColorStop(0.35, `rgba(${rgb},${halo * 0.41})`);
      g.addColorStop(0.7, `rgba(${rgb},${halo * 0.14})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(mx - MOUSE_RADIUS * 1.35, my - MOUSE_RADIUS * 1.35, MOUSE_RADIUS * 2.7, MOUSE_RADIUS * 2.7);

      if (!reduced) {
        for (const n of nodos) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }
      for (let i = 0; i < nodos.length; i++) {
        const a = nodos[i];
        const heatA = Math.max(0, 1 - Math.hypot(a.x - mx, a.y - my) / MOUSE_RADIUS);
        for (let j = i + 1; j < nodos.length; j++) {
          const b = nodos[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const heatB = Math.max(0, 1 - Math.hypot(b.x - mx, b.y - my) / MOUSE_RADIUS);
            const o = (0.022 + Math.max(heatA, heatB) * 0.34) * (1 - Math.sqrt(d2) / LINK_DIST) * fuerza;
            if (o > 0.006) {
              ctx.strokeStyle = `rgba(${rgb},${o})`;
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
        }
        ctx.fillStyle = `rgba(${rgb},${(0.09 + heatA * 0.72) * fuerza})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r + heatA * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - last < 33) return; // máximo ~30 fps
      last = now;
      draw(now);
    };

    const onMove = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now(); };
    const obs = new MutationObserver(() => { leerTema(); if (reduced) draw(performance.now()); });

    leerTema(); resize();
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    window.addEventListener('resize', resize);
    if (!touch) window.addEventListener('pointermove', onMove, { passive: true });
    if (reduced) draw(performance.now()); else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); obs.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="fondo-constelacion" />;
}
```

**Diferencias con el original, a propósito:**
- canvas fijo en lugar de uno por sección;
- como mucho unos 30 fotogramas por segundo;
- colores leídos del tema;
- con movimiento reducido se dibuja un solo cuadro fijo en vez de no dibujar nada.

### 2.3 CSS del fondo

```css
.fondo-constelacion { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }

.fondo-grano {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  opacity: var(--fx-grano-opacidad); mix-blend-mode: var(--fx-grano-mezcla);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>");
}

.fondo-resplandor {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(ellipse 60% 40% at 50% 0%, var(--fx-resplandor), transparent 70%);
}

/* Tema oscuro (valores de Stakeholders) */
:root[data-theme="dark"] {
  --fx-rgb: 255,255,255; --fx-halo: .085; --fx-fuerza: 1;
  --fx-grano-opacidad: .1; --fx-grano-mezcla: overlay;
  --fx-resplandor: rgba(77,127,255,.06);
}
/* Tema claro: la misma red en azul marino, más tenue */
:root {
  --fx-rgb: 10,22,51; --fx-halo: .05; --fx-fuerza: .8;
  --fx-grano-opacidad: .05; --fx-grano-mezcla: multiply;
  --fx-resplandor: rgba(46,98,242,.07);
}
```

Repite los valores oscuros también dentro del `@media (prefers-color-scheme: dark)` que ya usa el proyecto. **Si el proyecto marca el tema con una clase** (por ejemplo `next-themes` con `class="dark"`), usa ese selector en lugar de `[data-theme]`.

Crea un layout de grupo, `src/app/(feeds)/layout.tsx`, que monte `FondoConstelacion`, `.fondo-grano` y `.fondo-resplandor` una sola vez para las cuatro rutas. El contenido va en `position: relative; z-index: 2`.

### 2.4 Cómo se combina con el vidrio líquido

| Capa (de atrás hacia adelante) | Tratamiento |
|---|---|
| Fondo `--bg` + resplandor + canvas de nodos | Sección 2.2 |
| Grano | Encima del canvas, debajo del contenido |
| Header flotante | Vidrio líquido **con refracción**: la red de nodos se curva en sus bordes al pasar por detrás |
| Columna de filtros | Vidrio base: desenfoque y borde de luz, **sin refracción** |
| Fila de historias | Sin panel: los círculos flotan directo sobre el fondo |
| Tarjetas del feed | Superficie casi opaca (`color-mix(in oklab, var(--bg) 84%, transparent)`), borde de luz de 1 px y **sin desenfoque**. Los nodos se intuyen, pero el texto se lee perfecto |
| Visor de historias, menús, hojas | Vidrio líquido con refracción |

**Rendimiento:** el canvas se redibuja unas 30 veces por segundo, y cada superficie con `backdrop-filter` que tenga encima se recalcula también. Por eso **solo el header, el visor de historias y las hojas** llevan refracción. Nunca pongas `backdrop-filter` en las tarjetas del feed.

**Criterios de aceptación:**
- En las cuatro rutas se ve la red de nodos. Se enciende alrededor del cursor en computador y se mueve sola en móvil.
- En modo claro la red se ve en azul marino tenue.
- El scroll del feed se mantiene fluido en un portátil común.
- Con `prefers-reduced-motion` el fondo queda quieto.

---

## 3. Feeds: filtros a la izquierda, buscador y historias

**Aplica igual en:** `/explorar`, `/cerradas` y `/finalizadas`. Construye **un solo layout de feed** que reciba el estado (`activa`, `cerrada` o `finalizada`) y cambie solo textos y datos.

### 3.1 Distribución

**Computador (1100 px o más):**
- Contenedor centrado de hasta 1240 px, con dos columnas: filtros de 280 px a la izquierda, 40 px de separación y el feed a la derecha, de hasta 920 px.
- La columna de filtros es `position: sticky`, justo debajo del header (altura del header + 16 px). Si su contenido no cabe, tiene scroll propio.

**Tableta (721 a 1099 px):**
- Arriba del feed, una barra de vidrio pegajosa con el buscador y el botón `Filtros`.
- `Filtros` abre una hoja lateral de vidrio con el mismo contenido de la columna.

**Móvil (720 px o menos):**
- Igual que tableta, pero `Filtros` abre una hoja inferior.
- Orden vertical: buscador y filtros, historias, feed.

### 3.2 Contenido de la columna de filtros

De arriba a abajo:

1. **Título del panel y conteo.** Por ejemplo, "Causas activas" y "128 causas". Los textos cambian según el panel (tabla 3.4).
2. **Buscador del panel** (sección 3.3).
3. **País:**
   - selector con buscador interno y la opción "Todos los países";
   - nombres en español desde `mundo.json`;
   - a la derecha de cada país, el número de causas **del panel actual**;
   - no muestra países con cero.
4. **Siguiendo:** un interruptor con el texto "Solo personas que sigo". Sin sesión, al activarlo lleva a `/entrar`.
5. **Categorías:**
   - lista vertical de botones de texto con su conteo a la derecha, por ejemplo "Salud 12";
   - la primera opción es "Todas";
   - la seleccionada se marca con `aria-pressed="true"`, texto en blanco y una barra azul de 2 px a la izquierda;
   - **sin emojis ni iconos.**
6. **Limpiar filtros:** enlace de texto que solo aparece si hay algún filtro activo.

Todos los filtros y la búsqueda se guardan en la URL (`?q=`, `?pais=`, `?categoria=`, `?siguiendo=1`). Así se pueden compartir y el botón atrás funciona.

### 3.3 Buscador de cada panel

- **Busca dentro del panel en el que está la persona:**
  - en `/cerradas`, solo causas cerradas;
  - en `/finalizadas`, solo finalizadas;
  - en `/explorar`, solo activas.
- **Campos donde busca:** título, descripción, ciudad, y nombre o `@usuario` de quien publica. No distingue mayúsculas ni tildes.
- **Cuándo busca:** 250 ms después de la última tecla, desde 2 caracteres. Cancela la petición anterior si llega una nueva.
- **Sin resultados:** el mensaje del panel (tabla 3.4) con un botón `Borrar búsqueda`.
- **Atajo `/`:** enfoca este buscador cuando la persona está en un feed.

### 3.4 Textos por panel

En las capturas, `/cerradas` muestra "0 causas activas" y "No hay causas activas para este filtro". **Es un error.** Cada panel usa sus propios textos:

| | Explorar | Cerradas | Finalizadas |
|---|---|---|---|
| Título | Causas activas | Causas cerradas | Causas finalizadas |
| Conteo | `N causas activas` | `N causas cerradas` | `N causas con resultados` |
| Placeholder del buscador | Busca por causa, ciudad o persona | Busca entre las causas cerradas | Busca entre los resultados |
| Vacío sin filtros | Todavía no hay causas activas. / Botón `Crear una causa` | Aún no hay causas cerradas. / Enlace `Ver causas activas` | Aún nadie ha publicado resultados. / Enlace `Ver causas cerradas` |
| Vacío con filtros o búsqueda | No encontramos causas activas con estos filtros. / `Limpiar filtros` | No encontramos causas cerradas con estos filtros. / `Limpiar filtros` | No encontramos resultados con estos filtros. / `Limpiar filtros` |

Guarda estos textos en `src/content/es.ts`, agrupados por panel.

### 3.5 Historias: causas que cerraron su recaudo hace poco

Es una fila de círculos al estilo de las historias de Instagram, arriba del feed, en los tres paneles.

**Qué incluye:**
- causas en estado `cerrada` o `finalizada`, cuyo `closed_at` sea de los **últimos 7 días**;
- de la más reciente a la más antigua;
- máximo 20;
- si no hay ninguna, la fila no se muestra.

**Cada círculo:**
- 72 px en computador y 64 px en móvil;
- adentro, la portada de la causa (primera imagen) recortada en círculo; si es de prueba, el marco de la sección 4.3 en versión circular;
- un anillo de 3 px con degradado **azul de la marca**, no los colores de Instagram: `conic-gradient(from 210deg, #2E62F2, #4E80FF, #9DB8FF, #4E80FF, #2E62F2)`;
- 3 px de separación entre la foto y el anillo, del color del fondo;
- debajo, el nombre corto de quien publicó, en una línea con puntos suspensivos si no cabe.

**Estado "visto":**
- una vez abierta, el anillo pasa a gris (`var(--line)`);
- guarda los ids vistos en `localStorage` (clave `puente-historias-vistas`), dentro de `try/catch`.

**Desplazamiento:**
- en computador, la fila se mueve con flechas circulares de vidrio a los lados, que aparecen solo cuando hay más círculos;
- en móvil, con el dedo;
- oculta la barra de scroll nativa.

**Al tocar un círculo, se abre el visor:**
- capa a pantalla completa con el fondo oscurecido y una tarjeta central de vidrio líquido;
- **contenido de cada historia:**
  - portada grande;
  - nombre, ciudad y país;
  - "Cerró su recaudo hace 2 días";
  - monto reportado, si existe;
  - si ya está finalizada, "Ya publicó resultados";
  - botón `Ver causa`;
- **barras de progreso** arriba, una por historia; cada historia avanza sola a los 6 s;
- **navegación:** tocar la mitad derecha o la flecha derecha avanza; la mitad izquierda o la flecha izquierda retrocede; mantener presionado pausa; Escape o `Cerrar` sale;
- al terminar la última historia, el visor se cierra;
- **accesibilidad:** `role="dialog"`, `aria-modal="true"`, el foco queda atrapado dentro y vuelve al círculo al cerrar;
- con movimiento reducido, no avanza solo.

### 3.6 Cambios en la base de datos

Crea una migración `011_feeds_busqueda` con el MCP de Supabase (`apply_migration`) y después regenera los tipos.

**Función del feed**, que sirve a los tres paneles, con búsqueda y paginación por cursor:

```sql
create or replace function public.escape_like(t text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function public.feed_causes(
  p_status    public.cause_status,
  p_q         text default null,
  p_country   text default null,
  p_category  public.cause_category default null,
  p_following boolean default false,
  p_cursor_ts timestamptz default null,
  p_cursor_id uuid default null,
  p_limit     int default 10
)
returns setof public.causes
language sql stable security invoker set search_path = ''
as $$
  select c.*
  from public.causes c
  join public.profiles p on p.id = c.author_id
  cross join lateral (
    select case p_status
      when 'activa'     then c.published_at
      when 'cerrada'    then c.closed_at
      when 'finalizada' then c.finalized_at
    end as sort_ts
  ) s
  where p_status in ('activa', 'cerrada', 'finalizada')
    and c.status = p_status
    and (p_country is null or c.country_code = p_country)
    and (p_category is null or c.category = p_category)
    and (not p_following or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid()) and f.following_id = c.author_id))
    and (p_q is null or char_length(trim(p_q)) < 2 or
         public.f_unaccent(lower(concat_ws(' ', c.title, c.description, c.city, p.full_name, p.username)))
           like '%' || public.escape_like(public.f_unaccent(lower(trim(p_q)))) || '%')
    and (p_cursor_ts is null or (s.sort_ts, c.id) < (p_cursor_ts, p_cursor_id))
  order by s.sort_ts desc, c.id desc
  limit least(greatest(p_limit, 1), 30);
$$;
```

**Cómo se llama desde el cliente:** PostgREST permite anidar relaciones sobre una función que devuelve filas de una tabla. Llámala así y vuelve a ordenar en la consulta:

```ts
supabase
  .rpc('feed_causes', args)
  .select('*, author:profiles!causes_author_id_fkey(id, username, full_name, avatar_url), media:cause_media(id, kind, phase, bucket, storage_path, width, height, position)')
  .order(sortColumn, { ascending: false })
  .order('id', { ascending: false });
```

`sortColumn` es `published_at`, `closed_at` o `finalized_at`, según el panel. El cursor de la página siguiente sale de esa columna y del `id` de la última fila.

**Función de conteos para la columna de filtros:**
- `public.feed_facets(p_status, p_q, p_country, p_following)`;
- devuelve `jsonb` con dos listas: `categories: [{ category, total }]` y `countries: [{ country_code, total }]`;
- usa **exactamente las mismas condiciones** que `feed_causes`, sin cursor ni límite;
- el conteo de categorías ignora el filtro de categoría (para poder cambiar de categoría viendo los números) y el de países ignora el filtro de país.

**Función de historias:**

```sql
create or replace function public.recent_closures(p_days int default 7, p_limit int default 20)
returns setof public.causes
language sql stable security invoker set search_path = ''
as $$
  select c.* from public.causes c
  where c.status in ('cerrada', 'finalizada')
    and c.closed_at >= now() - make_interval(days => least(greatest(p_days, 1), 30))
  order by c.closed_at desc, c.id desc
  limit least(greatest(p_limit, 1), 30);
$$;
```

**Nota de rendimiento:** la búsqueda con `like '%…%'` sobre texto unido con el perfil no usa índices. Alcanza para el lanzamiento. Si el volumen crece, pasa a una columna `search_text` en `causes`, mantenida por un trigger (también cuando la persona cambia su nombre) e indexada con GIN trigram.

**Después de la migración:**
1. Ejecuta `get_advisors` (seguridad y rendimiento) y corrige lo que aparezca.
2. Ejecuta `generate_typescript_types`.

**Criterios de aceptación:**
- En computador, los filtros están a la izquierda y no hay barra horizontal de chips.
- Buscar "quibdo", sin tilde, en `/explorar` encuentra la causa de Quibdó.
- Cada panel busca solo dentro de su estado.
- La fila de historias aparece en los tres paneles con las causas cerradas en los últimos 7 días, y el anillo cambia a gris después de verla.
- Los textos de `/cerradas` y `/finalizadas` ya no dicen "activas".

---

## 4. Tarjeta horizontal y publicaciones de prueba

### 4.1 Qué cambia

- **Antes:** tarjeta vertical, con la imagen 4:5 arriba y el texto cortado a 3 líneas debajo.
- **Ahora:** tarjeta **horizontal**, pensada para leer mientras se hace scroll:
  - imagen apaisada;
  - la descripción, bien visible, junto a la imagen;
  - en móvil, debajo de ella.

### 4.2 Anatomía

Usa `container queries` sobre el ancho de la tarjeta, no media queries del viewport.

**Tarjeta de 640 px de ancho o más: dos columnas.**
- **Izquierda (42 %):** carrusel de medios en proporción **4:3**, radio de 16 px, indicador "1/3" y flechas al pasar el cursor.
- **Derecha, de arriba a abajo:**
  1. avatar, nombre, `@usuario`, `Seguir` y menú;
  2. categoría, "Ciudad, País" (nombre del país en español, **nunca el código como "JP"**) y hace cuánto se publicó;
  3. título en 1,25 rem;
  4. **descripción en 1 rem con interlineado 1,6, limitada a 6 líneas**, con `Leer más` que la expande en el mismo lugar;
  5. barra de progreso con el monto reportado, si hay meta;
  6. fila inferior: comentar, guardar y compartir a la izquierda, y `Ver causa` a la derecha.

**Tarjeta de menos de 640 px: una columna.**
- Medios en proporción **16:9** arriba.
- Contenido debajo, en el mismo orden.
- Descripción limitada a 4 líneas.

**Variantes:**
- **`cerrada`:**
  - insignia "Cerrada hace 3 días";
  - monto reportado;
  - "Esperando resultados";
  - sin barra de meta.
- **`finalizada`:**
  - la zona de medios se divide en dos mitades, **Antes** (primera imagen de la causa) y **Después** (primera imagen de resultados), cada una con su etiqueta;
  - a la derecha, el resumen de resultados en lugar de la descripción, limitado a 6 líneas;
  - el monto recibido.

La página `/causa/[id]` también usa medios apaisados 4:3 en su galería.

### 4.3 Marco de imagen de prueba

Componente `src/components/media/MarcoImagen.tsx`. Aparece en tres casos:
- el medio es de prueba (`storage_path` empieza con `seed/`);
- no hay URL;
- la imagen falla al cargar (`onError`). Esto corrige las imágenes rotas que hoy muestran su texto alternativo.

**Aspecto, al estilo Stakeholders:**
- **Contenedor:**
  - misma proporción que tendría la imagen;
  - fondo `color-mix(in oklab, var(--bg) 92%, var(--fg))`;
  - borde de 1 px `var(--hair)`, radio igual al de la imagen.
- **Trazos del fondo:**
  - dos líneas diagonales finas de esquina a esquina, `var(--hair)`, como en los planos de arquitectura;
  - dibújalas con un SVG absoluto con `preserveAspectRatio="none"`.
- **Al centro:**
  - un SVG de línea de 48 px, una foto con una montaña y un sol (sección 5.3);
  - debajo, en 0,8 rem y color `var(--dim)`, "Imagen 2 de 3";
  - y "Aquí va la foto de la causa".
  - En la mitad "Después" de la variante `finalizada`, el texto es "Aquí va la foto del resultado".
- **Accesibilidad:** `role="img"` con `aria-label="Espacio para imagen de la causa"`.

### 4.4 Publicaciones de prueba

Reemplaza las publicaciones de prueba actuales por un conjunto completo y coherente.

**Cómo crearlas:**
1. Revisa cómo se crearon los datos de prueba que ya existen y **usa el mismo método**.
2. Si no hay método, crea `scripts/seed.ts`:
   - usa `SUPABASE_SECRET_KEY` desde `.env.local`, **nunca expuesta al navegador**;
   - crea las cuentas con `auth.admin.createUser`;
   - inserta el resto con ese mismo cliente.
3. Añade la columna `is_seed boolean not null default false` a `profiles` y `causes`, para borrar todo después.

**Contenido:**
- **8 cuentas de prueba,** con nombres coherentes con su país. En la captura aparece "Carlos Mendoza" en Wajima, Japón; eso no debe pasar.
- **12 causas activas.** Reutiliza las personas, ciudades y títulos del arreglo `HAND` de `planeta-hero.html`:
  - Turquía, México, Colombia (Quibdó), Ecuador, Perú, Chile, Marruecos, Nepal, Filipinas, Japón, Ucrania, Kenia;
  - descripciones de 400 a 900 caracteres, escritas en primera persona o por la organización, con qué pasó, qué se necesita y en qué se usará.
- **7 causas cerradas**, con `closed_at` repartido entre hace 2 horas y hace 6 días. Aparecen en las historias.
- **5 causas finalizadas**, con resultados escritos (monto recibido y resumen de 150 a 400 caracteres). Tres de ellas cerradas en los últimos 7 días, para que también aparezcan en historias.

**Medios de cada causa:**
- entre 2 y 4 filas en `cause_media` con `storage_path = 'seed/placeholder-{n}'` y dimensiones de 1600 × 1200;
- las finalizadas tienen además 2 medios de fase `resultado`.

**Interacción de prueba:**
- 3 o 4 métodos de donación inventados y claramente ficticios, por ejemplo "Cuenta de ahorros 000-000000-00, dato de prueba";
- en 5 causas, entre 3 y 8 comentarios con algunas respuestas;
- algunos seguidores y guardados entre las cuentas.

**Borrado:** deja en el README una sección "Borrar datos de prueba" con el SQL que elimina todo lo marcado con `is_seed = true` y sus usuarios de Auth.

**Criterios de aceptación:**
- Los tres feeds tienen contenido y ninguna imagen se ve rota.
- En computador se lee la descripción de cada causa sin abrirla.
- Las finalizadas muestran el par antes/después con sus etiquetas.

---

## 5. Iconos: solo SVG de línea, sin emojis

### 5.1 Qué quitar

- **Todos los emojis de las categorías.** En la captura: 🌪️, ☀️, 🏥, 🍲, 🏠, 📚, 💛. Las categorías quedan solo con texto.
- **El icono del botón `Crear una causa`:** queda solo el texto.
- **Los iconos del selector de país y del botón "Siguiendo".**
- **La brújula del estado vacío:** la reemplaza la ilustración de la sección 5.4.
- **Cualquier librería de iconos** (por ejemplo `lucide-react`, `react-icons` o `heroicons`). Cuando ya no se use, desinstálala.

### 5.2 Iconos que sí se permiten

Solo los que tienen una función que se entiende mejor con icono. Todos van hechos a mano en `src/components/iconos/`:

| Icono | Uso |
|---|---|
| Buscar | Buscadores |
| Cerrar | Paneles, visor, hojas |
| Sol / Luna | Botón de tema |
| Menú de tres puntos | Menú de la tarjeta |
| Flecha izquierda / derecha | Carruseles, historias |
| Flecha abajo | Selectores |
| Comentar, Guardar, Compartir | Fila de acciones de la tarjeta |
| Copiar / Check | Copiar datos de donación |
| Verificado | Perfil verificado |
| Foto | Dentro del marco de prueba |

### 5.3 Estilo: el mismo de las ilustraciones de Stakeholders

Reglas tomadas de `.illustration svg` en el HTML de referencia:
- trazo sin relleno;
- puntas y uniones redondeadas;
- grosor fino y uniforme;
- color heredado.

Componente base:

```tsx
export function IconoBase({ size = 20, children, className }: { size?: number; children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  );
}

// Ejemplos
export const IconoBuscar   = (p: { size?: number }) => <IconoBase {...p}><circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="20.5" y2="20.5"/></IconoBase>;
export const IconoGuardar  = (p: { size?: number }) => <IconoBase {...p}><path d="M7 4.5h10v15l-5-3.6-5 3.6z"/></IconoBase>;
export const IconoComentar = (p: { size?: number }) => <IconoBase {...p}><path d="M5 6h14v9.5H10.5L6.5 19v-3.5H5z"/></IconoBase>;
export const IconoCompartir= (p: { size?: number }) => <IconoBase {...p}><path d="M12 14.5V4.5"/><path d="M8 8.5l4-4 4 4"/><path d="M6 12.5v6.5h12v-6.5"/></IconoBase>;
export const IconoFoto     = (p: { size?: number }) => <IconoBase {...p}><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17.5l5-4.5 4 3.5 3-2.5 4 3.5"/></IconoBase>;
```

**Color de los iconos:**
- en reposo, `var(--ink-2)`;
- al pasar el cursor o activos, `var(--ink)`;
- un icono que marca un estado activo, como "Guardada", usa el azul de acento.

**Colores de las ilustraciones grandes:**

| Estado | Color |
|---|---|
| Trazo en reposo | `var(--line)`: `rgba(255,255,255,.32)` en oscuro, `rgba(10,22,51,.32)` en claro |
| Al pasar el cursor | `var(--line-strong)`: 0,7 de opacidad |
| El detalle clave (clase `.key`) | Azul `#4D7FFF` |

### 5.4 Ilustraciones de línea

Viewbox de 280 × 280, trazo de 1 px, mismo sistema de colores y animaciones de Stakeholders:
- **en computador**, al pasar el cursor;
- **en pantallas táctiles**, cuando entran en pantalla, con `IntersectionObserver` al 55 %;
- transición de 0,5 s con `cubic-bezier(0.22, 1, 0.36, 1)`.

**Estados vacíos:**

| Dónde | Dibujo | Detalle clave en azul y animación |
|---|---|---|
| Explorar | Un globo con meridianos y tres puntos unidos como constelación | Un punto que se enciende y crece |
| Cerradas | Una alcancía o frasco con la tapa puesta | La tapa baja 4 px y encaja |
| Finalizadas | Dos marcos, antes y después, con una flecha entre ellos | La flecha avanza 6 px |

**`/como-funciona`:**
- tres tarjetas en fila con separadores de 1 px, como la sección `.features` de Stakeholders;
- cada una con su etiqueta superior al estilo `.fig-label`: `PASO 01 · PUBLICA`, `PASO 02 · APOYO DIRECTO`, `PASO 03 · RESULTADOS`;
- las etiquetas en letra monoespaciada, espaciada y en mayúsculas. Si se usa JetBrains Mono, cárgala con `next/font` solo en esta página.

| Paso | Dibujo | Detalle clave en azul y animación |
|---|---|---|
| Publica | Un teléfono con dos marcos de foto y líneas de texto | Un pin de ubicación que sube 6 px |
| Apoyo directo | Dos personas sobre una línea de suelo, unidas por un arco punteado (el mismo gesto del logo) | Un punto que recorre el arco (animación de `stroke-dashoffset`) |
| Resultados | Una casa agrietada a la izquierda y la misma casa reconstruida a la derecha | Un círculo con check que se dibuja |

**Criterios de aceptación:**
- No queda ningún emoji en la interfaz. Busca en el código caracteres del rango de emojis.
- No hay librerías de iconos en `package.json`.
- Todos los iconos comparten grosor y estilo.
- Las ilustraciones reaccionan al cursor en computador y al entrar en pantalla en móvil.

---

## 6. Planeta en modo claro: océanos azules y países verdes

### 6.1 Qué se ve mal

En la captura del modo claro, el planeta sale con **océano negro** y países azul marino, como si siguiera en modo oscuro.

La causa probable: el planeta no vuelve a leer la paleta cuando cambia el tema.

**Revisa:**
- **Cómo se marca el tema.** Si el proyecto lo marca con `class="dark"` (por ejemplo `next-themes`) y el código del planeta observa solo `data-theme`, nunca se entera del cambio. Observa `class` y `data-theme`, o suscríbete al contexto del tema.
- **Momento de lectura.** `readPalette()` debe ejecutarse **después** de que el tema esté aplicado en el primer render, y otra vez en cada cambio.
- **Material del planeta.** `applyGlobeTheme()` debe actualizar `globeMaterial().color`, `emissive`, `atmosphereColor` y volver a asignar los accesores de polígonos.

### 6.2 Nueva paleta del planeta en modo claro

Reemplaza las variables `--g-*` del tema claro:

```css
:root {
  --g-ocean: #3F7FE8;            /* océano azul */
  --g-ocean-emissive: #000000;   /* sin emisivo: la iluminación da el volumen */
  --g-land: #3FA66B;             /* países sin causas: verde */
  --g-land-lit: #2F9360;         /* países con causas: verde un poco más profundo */
  --g-land-hover: #57C284;       /* al pasar el cursor */
  --g-land-selected: #7AD8A0;    /* país seleccionado */
  --g-stroke: rgba(255,255,255,.6);  /* fronteras blancas finas */
  --g-atmo: #6FA8FF;
  --g-atmo-alt: .16;
  --g-ring: 255,255,255;         /* pulso blanco, se ve sobre verde y sobre azul */
}
```

**Por qué estos valores:**
- **Océano:** el material del océano recibe iluminación, así que el azul se verá algo más oscuro hacia los bordes y dará volumen.
- **Países:** las tapas de los países no reciben iluminación y muestran el color exacto.

**Luces en modo claro:**
- núcleo blanco (`--light-core: #FFFFFF`);
- anillo medio azul intenso (`--light-mid: #1F4FD8`);
- halo `rgba(31,79,216,.55)`;
- así se distinguen sobre el verde.

**Poster de carga en modo claro:**
- degradado de `#6FA0F0` a `#2F66D0`, para que el círculo previo ya se vea azul.

**El modo oscuro no cambia.**

**Criterios de aceptación:**
- En modo claro: océanos azules, países verdes con fronteras blancas y luces visibles.
- Al cambiar de tema con el botón, el planeta cambia de colores **al instante** sin recargar, en ambos sentidos.

---

## 7. Otros errores vistos en las capturas

1. **Textos de "activas" en Cerradas.** Resuelto en 3.4.
2. **Imágenes rotas.** Las publicaciones muestran el texto alternativo en lugar de la imagen. Resuelto con `MarcoImagen` (4.3).
3. **Código de país en lugar de nombre.** Aparece "Wajima, JP"; debe decir "Wajima, Japón". Usa `mundo.json` en todas las tarjetas, historias y páginas.
4. **Barra horizontal de chips con scroll nativo visible.** Desaparece con la columna de filtros (3.2). En tableta y móvil, los filtros van en la hoja.
5. **Avatar sin forma.** Aparece una letra "C" sola. Si no hay foto, usa un círculo con las iniciales sobre `var(--avatar)`.
6. **Indicador de desarrollo de Next.js.** El botón "N" abajo a la izquierda tapa las estadísticas del hero. Solo aparece en desarrollo; si molesta, muévelo con la opción `devIndicators` de `next.config`. No lo quites de producción: ahí no existe.
7. **Buscador del hero en modo claro.** Se ve gris y sucio sobre el planeta. Resuelto en 1.4 y con la nueva paleta.

---

## 8. Orden de trabajo

Después de cada paso, toma las capturas indicadas al inicio y verifica los criterios antes de continuar.

1. **Iconos (sección 5).** Primero, porque toca componentes que usan todos los demás pasos.
2. **Planeta:** tamaño y titular (sección 1), y paleta clara (sección 6).
3. **Base de datos:** migración `011_feeds_busqueda`, `is_seed`, advisors y tipos (secciones 3.6 y 4.4).
4. **Datos de prueba y `MarcoImagen`** (secciones 4.3 y 4.4).
5. **Fondo de estrellas y su combinación con el vidrio** (sección 2).
6. **Layout de feeds:** columna de filtros, buscador, textos por panel (secciones 3.1 a 3.4).
7. **Tarjeta horizontal y sus variantes** (sección 4.2).
8. **Historias y visor** (sección 3.5).
9. **Ilustraciones y `/como-funciona`** (sección 5.4).
10. **Errores de la sección 7**, revisión final en todos los tamaños y ambos temas, `next build` sin errores.

**Cierre:** entrega a la persona un resumen con capturas de antes y después de cada punto.
