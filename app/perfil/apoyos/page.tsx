import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApoyosClient } from "./ApoyosClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AVISO_SELECT =
  "id, cause_id, kind, amount, currency, items, message, is_anonymous, status, thanks_message, created_at, confirmed_at";

export default async function ApoyosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/perfil/apoyos");
  }

  const [recibidosRes, enviadosRes] = await Promise.all([
    // Avisos a mis causas (con quién los envió, aunque haya pedido anonimato: la autora lo necesita)
    supabase
      .from("support_reports")
      .select(
        `${AVISO_SELECT}, donor:profiles!support_reports_donor_id_fkey(full_name, public_id), cause:causes!inner(title, author_id)`
      )
      .eq("cause.author_id", user.id)
      .order("created_at", { ascending: false }),
    // Mis avisos a causas de otras personas
    supabase
      .from("support_reports")
      .select(`${AVISO_SELECT}, cause:causes(title)`)
      .eq("donor_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (recibidosRes.error) {
    console.error("/perfil/apoyos recibidos:", recibidosRes.error.code, recibidosRes.error.message);
    throw new Error(`No pudimos cargar los apoyos recibidos: ${recibidosRes.error.message}`);
  }
  if (enviadosRes.error) {
    console.error("/perfil/apoyos enviados:", enviadosRes.error.code, enviadosRes.error.message);
    throw new Error(`No pudimos cargar tus apoyos enviados: ${enviadosRes.error.message}`);
  }

  const recibidos = recibidosRes.data || [];
  const enviados = enviadosRes.data || [];

  // Nombres de los insumos de todas las causas involucradas
  const causeIds = Array.from(new Set([...recibidos, ...enviados].map((r) => r.cause_id)));
  let insumos: Array<{ id: string; name: string; unit: string | null }> = [];
  if (causeIds.length > 0) {
    const { data, error } = await supabase
      .from("cause_supplies")
      .select("id, name, unit")
      .in("cause_id", causeIds);
    if (error) {
      console.error("/perfil/apoyos insumos:", error.code, error.message);
      throw new Error(`No pudimos cargar los insumos: ${error.message}`);
    }
    insumos = data || [];
  }

  return <ApoyosClient recibidos={recibidos as any} enviados={enviados as any} insumos={insumos} />;
}
