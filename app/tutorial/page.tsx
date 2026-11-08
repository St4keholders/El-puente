import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/utils/destino";

export const dynamic = "force-dynamic";

/**
 * Abre el tutorial sobre la causa de ejemplo de Puente.
 * Se llega aquí al terminar el registro, desde el menú o desde "Cómo funciona".
 */
export default async function TutorialPage(props: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await props.searchParams;
  const destino = destinoSeguro(next, "/explorar");

  const supabase = await createClient();
  const { data: ejemplo } = await supabase
    .from("causes")
    .select("id")
    .eq("is_example", true)
    .eq("status", "activa")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ejemplo) redirect(destino);
  redirect(`/causa/${ejemplo.id}?tutorial=1&next=${encodeURIComponent(destino)}`);
}
