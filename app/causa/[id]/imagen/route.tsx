import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FORMATOS,
  dibujarImagenCausa,
  fotoComoJpeg,
  origenDe,
  type Formato,
} from "@/lib/compartir/imagen-causa";

/**
 * Imagen para compartir una causa: ?formato=historia (1080×1920) o ?formato=publicacion (1080×1350).
 * Solo causas publicadas (activa, cerrada o finalizada).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const formato: Formato =
    new URL(request.url).searchParams.get("formato") === "publicacion" ? "publicacion" : "historia";
  const F = FORMATOS[formato];

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Causa no encontrada", { status: 404 });
  }

  const supabase = await createClient();
  const { data: causa } = await supabase
    .from("causes")
    .select(
      `id, title, category, status, city, region, country_code, collection_type, supplies_instructions, is_example,
       author:profiles!causes_author_id_fkey(full_name, identity_verified),
       media:cause_media(storage_path, kind, phase, position)`
    )
    .eq("id", id)
    .in("status", ["activa", "cerrada", "finalizada"])
    .maybeSingle();

  if (!causa) {
    return new Response("Causa no encontrada", { status: 404 });
  }

  const recibeDinero = causa.collection_type !== "insumos";
  const recibeInsumos = causa.collection_type !== "dinero";
  const activa = causa.status === "activa";

  // Métodos e insumos solo de esta causa. La tabla de métodos sigue cerrada al público.
  let metodos: { kind: string; provider: string; account_holder: string; account_value: string }[] = [];
  let totalMetodos = 0;
  if (activa && recibeDinero && !causa.is_example) {
    try {
      const { data } = await createAdminClient()
        .from("donation_methods")
        .select("kind, provider, account_holder, account_value")
        .eq("cause_id", causa.id)
        .order("position", { ascending: true });
      totalMetodos = data?.length || 0;
      metodos = (data || []).slice(0, F.metodos);
    } catch (err) {
      console.error("[imagen causa] métodos:", err);
    }
  }

  let insumos: { name: string; quantity_needed: number | null; unit: string | null }[] = [];
  let totalInsumos = 0;
  if (activa && recibeInsumos) {
    const { data } = await supabase
      .from("cause_supplies")
      .select("name, quantity_needed, unit")
      .eq("cause_id", causa.id)
      .order("position", { ascending: true });
    totalInsumos = data?.length || 0;
    insumos = (data || []).slice(0, F.insumos);
  }

  const portada = (causa.media || [])
    .filter((m) => m.phase === "causa" && m.kind === "imagen")
    .sort((a, b) => a.position - b.position)[0];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const foto = portada
    ? await fotoComoJpeg(
        `${supabaseUrl}/storage/v1/object/public/causas-imagenes/${portada.storage_path}`,
        F.w,
        F.foto
      )
    : null;

  const autorFila = Array.isArray(causa.author) ? causa.author[0] : causa.author;
  return dibujarImagenCausa(
    {
      causa,
      autor: autorFila ?? null,
      metodos,
      totalMetodos,
      insumos,
      totalInsumos,
      foto,
      origen: origenDe(request),
    },
    formato
  );
}
