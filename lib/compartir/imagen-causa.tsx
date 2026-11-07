import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";
import mundoData from "@/lib/geo/mundo.json";

/**
 * Dibuja la imagen para compartir una causa: foto, título, cómo donar o entregar,
 * enlace y QR. La usan la ruta /causa/[id]/imagen y las pruebas.
 */

export const FORMATOS = {
  historia: { w: 1080, h: 1920, foto: 600, metodos: 3, insumos: 6, qr: 250 },
  publicacion: { w: 1080, h: 1350, foto: 430, metodos: 2, insumos: 4, qr: 200 },
} as const;
export type Formato = keyof typeof FORMATOS;

const C = {
  fondo: "#F5F7FC",
  tarjeta: "#FFFFFF",
  tinta: "#0A1633",
  tinta2: "#465170",
  tinta3: "#7C86A2",
  linea: "#E3E8F2",
  acento: "#2E62F2",
  verde: "#0F9F6E",
  verdeSuave: "#E3F6EE",
  ambar: "#B7791F",
};

const TIPOS_METODO: Record<string, string> = {
  transferencia_bancaria: "Transferencia",
  billetera_digital: "Billetera digital",
  paypal: "PayPal",
  enlace_de_pago: "Enlace de pago",
  otro: "Otro",
};

const CATEGORIAS: Record<string, string> = {
  terremoto: "Terremoto",
  inundacion: "Inundación",
  incendio: "Incendio",
  tormenta: "Tormenta",
  sequia: "Sequía",
  salud: "Salud",
  alimentacion: "Alimentación",
  vivienda: "Vivienda",
  educacion: "Educación",
  otra: "Causa social",
};

function corto(texto: string | null | undefined, max: number): string {
  const t = (texto || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

let fuentes: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]> | null = null;
function cargarFuentes() {
  fuentes ??= Promise.all(
    ([400, 600, 700] as const).map(async (weight) => ({
      name: "Instrument Sans",
      data: await readFile(join(process.cwd(), "assets/fonts", `InstrumentSans-${weight}.woff`)),
      weight,
      style: "normal" as const,
    }))
  );
  return fuentes;
}

/** La foto de la causa viene en WebP; el generador de imágenes solo lee JPG/PNG. */
export async function fotoComoJpeg(url: string, ancho: number, alto: number): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const original = Buffer.from(await res.arrayBuffer());
    const jpeg = await sharp(original)
      .rotate()
      .resize(ancho, alto, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.error("[imagen causa] foto:", err);
    return null;
  }
}

export function origenDe(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export interface DatosImagenCausa {
  causa: {
    id: string;
    title: string;
    category: string;
    status: string;
    city: string | null;
    country_code: string | null;
    collection_type: string;
    supplies_instructions: string | null;
  };
  autor: { full_name: string | null; identity_verified: boolean | null } | null;
  metodos: { kind: string; provider: string; account_holder: string; account_value: string }[];
  totalMetodos: number;
  insumos: { name: string; quantity_needed: number | null; unit: string | null }[];
  totalInsumos: number;
  /** Foto ya convertida a JPEG (data URI) o null */
  foto: string | null;
  origen: string;
}

export async function dibujarImagenCausa(datos: DatosImagenCausa, formato: Formato): Promise<ImageResponse> {
  const F = FORMATOS[formato];
  const { causa, autor, totalMetodos, totalInsumos, foto } = datos;
  const historiaFmt = formato === "historia";
  // Con dinero e insumos a la vez hay menos espacio: se muestran menos de cada uno.
  const ambas = causa.collection_type === "ambas";
  const metodos = datos.metodos.slice(0, ambas ? (historiaFmt ? 2 : 1) : F.metodos);
  const insumos = datos.insumos.slice(0, ambas ? (historiaFmt ? 4 : 3) : F.insumos);
  const activa = causa.status === "activa";
  const recibeInsumos = causa.collection_type !== "dinero";
  const enlace = `${datos.origen}/causa/${causa.id}`;
  const enlaceVisible = enlace.replace(/^https?:\/\/(www\.)?/, "");
  const qrSvg = await QRCode.toString(enlace, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: C.tinta, light: "#FFFFFF" },
  });
  const qr = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;

  const paises = ((mundoData as { countries?: { id: string; n: string }[] }).countries || []);
  const pais = paises.find((p) => p.id === causa.country_code)?.n || causa.country_code || "";
  const lugar = [causa.city, pais].filter(Boolean).join(", ");
  const historia = formato === "historia";

  const estadoTexto =
    causa.status === "finalizada"
      ? "Causa finalizada: mira los resultados en el enlace"
      : causa.status === "cerrada"
      ? "Esta causa ya no recibe donaciones"
      : null;

  const imagen = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.fondo,
        fontFamily: "Instrument Sans",
        color: C.tinta,
      }}
    >
      {/* Foto */}
      <div style={{ display: "flex", position: "relative", width: F.w, height: F.foto, backgroundColor: "#DCE4F5" }}>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} width={F.w} height={F.foto} style={{ objectFit: "cover" }} alt="" />
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: F.foto * 0.55,
            display: "flex",
            backgroundImage: `linear-gradient(to bottom, rgba(245,247,252,0), ${C.fondo})`,
          }}
        />
        {/* Marca */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 24px",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.92)",
          }}
        >
          <svg width="44" height="26" viewBox="0 0 30 18">
            <path d="M4 14 C 9 1.5, 21 1.5, 26 14" fill="none" stroke={C.tinta} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
            <circle cx="4" cy="14" r="2.6" fill={C.tinta} />
            <circle cx="26" cy="14" r="2.6" fill={C.acento} />
          </svg>
          <span style={{ fontSize: 30, fontWeight: 700 }}>Puente</span>
        </div>
      </div>

      {/* Contenido */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: historia ? "0 64px 28px" : "0 56px 22px",
          marginTop: historia ? -90 : -60,
          gap: historia ? 30 : 22,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: C.acento,
              backgroundColor: "#E6EDFF",
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {CATEGORIAS[causa.category] || "Causa social"}
          </span>
          {lugar && (
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: C.tinta2,
                backgroundColor: C.tarjeta,
                border: `2px solid ${C.linea}`,
                padding: "6px 20px",
                borderRadius: 999,
              }}
            >
              {corto(lugar, 40)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: historia ? 60 : 54, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
            {corto(causa.title, historia ? 90 : 70)}
          </div>
          {autor?.full_name && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: C.tinta2 }}>
              <span>Publicada por {corto(autor.full_name, 40)}</span>
              {autor.identity_verified && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 22,
                    fontWeight: 600,
                    color: C.verde,
                    backgroundColor: C.verdeSuave,
                    padding: "4px 14px",
                    borderRadius: 999,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke={C.verde} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Identidad verificada
                </span>
              )}
            </div>
          )}
        </div>

        {estadoTexto && (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: C.ambar,
              backgroundColor: "#FFF6E5",
              padding: "20px 28px",
              borderRadius: 24,
            }}
          >
            {estadoTexto}
          </div>
        )}

        {/* Cómo donar */}
        {metodos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: C.tinta2 }}>
              Cómo donar
            </div>
            {metodos.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  backgroundColor: C.tarjeta,
                  border: `2px solid ${C.linea}`,
                  borderRadius: 28,
                  padding: historia ? "20px 28px" : "18px 26px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 30, fontWeight: 700 }}>{corto(m.provider, 30)}</span>
                  <span style={{ fontSize: 22, fontWeight: 600, color: C.acento }}>
                    {TIPOS_METODO[m.kind] || "Otro"}
                  </span>
                </div>
                <div style={{ display: "flex", fontSize: historia ? 38 : 34, fontWeight: 700, letterSpacing: 1, color: C.tinta }}>
                  {corto(m.account_value, 34)}
                </div>
                <div style={{ display: "flex", fontSize: 24, color: C.tinta2 }}>Titular: {corto(m.account_holder, 44)}</div>
              </div>
            ))}
            {totalMetodos > metodos.length && (
              <div style={{ display: "flex", fontSize: 24, color: C.tinta3 }}>
                + {totalMetodos - metodos.length} {totalMetodos - metodos.length === 1 ? "método más" : "métodos más"} en el enlace
              </div>
            )}
          </div>
        )}

        {/* Insumos */}
        {(insumos.length > 0 || (activa && recibeInsumos && causa.supplies_instructions)) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: C.tinta2 }}>
              Se necesita
            </div>
            {insumos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {insumos.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      backgroundColor: C.tarjeta,
                      border: `2px solid ${C.linea}`,
                      padding: "8px 18px",
                      borderRadius: 999,
                    }}
                  >
                    {corto(
                      [s.quantity_needed ? `${s.quantity_needed}${s.unit ? ` ${s.unit}` : ""}` : null, s.name]
                        .filter(Boolean)
                        .join(" · "),
                      32
                    )}
                  </span>
                ))}
                {totalInsumos > insumos.length && (
                  <span style={{ fontSize: 24, color: C.tinta3, padding: "8px 6px" }}>
                    + {totalInsumos - insumos.length} más
                  </span>
                )}
              </div>
            )}
            {causa.supplies_instructions && (
              <div style={{ display: "flex", fontSize: 24, color: C.tinta2, lineHeight: 1.35 }}>
                Dónde entregar: {corto(causa.supplies_instructions, ambas ? (historia ? 110 : 70) : historia ? 200 : 130)}
              </div>
            )}
          </div>
        )}

      </div>

        {/* Pie: QR + enlace (siempre visible) */}
        <div
          style={{
            margin: historia ? "0 64px 56px" : "0 56px 44px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 32,
            backgroundColor: C.tarjeta,
            border: `2px solid ${C.linea}`,
            borderRadius: 32,
            padding: historia ? 30 : 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={F.qr} height={F.qr} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            <div style={{ display: "flex", fontSize: historia ? 34 : 30, fontWeight: 700, lineHeight: 1.15 }}>
              Escanea para ver la causa completa y apoyar
            </div>
            <div style={{ display: "flex", fontSize: 22, color: C.acento, fontWeight: 600 }}>{corto(enlaceVisible, 60)}</div>
            <div style={{ display: "flex", fontSize: 22, color: C.tinta3 }}>Donación directa a quien publica · 0% comisiones</div>
          </div>
        </div>
    </div>
  );

  const nombreArchivo = `puente-${corto(causa.title, 40)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${formato}.png`;

  return new ImageResponse(imagen, {
    width: F.w,
    height: F.h,
    fonts: await cargarFuentes(),
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": `inline; filename="${nombreArchivo}"`,
    },
  });
}
