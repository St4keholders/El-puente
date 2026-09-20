import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MisCausasClient, CauseStatusTab, ExtendedCauseCardProps } from "./MisCausasClient";
import type { CauseMediaItem } from "@/components/feed/CauseCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MisCausasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/perfil/causas");
  }

  const [borradoresRes, activasRes, cerradasRes, finalizadasRes, exRowRes, profileRes] = await Promise.all([
    supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", user.id).eq("status", "borrador"),
    supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", user.id).eq("status", "activa"),
    supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", user.id).eq("status", "cerrada"),
    supabase.from("causes").select("id", { count: "exact", head: true }).eq("author_id", user.id).eq("status", "finalizada"),
    supabase.from("causes").select("id").eq("author_id", user.id).eq("is_example", true).maybeSingle(),
    supabase.from("profiles").select("id, full_name, username, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  const initialCounts: Record<CauseStatusTab, number> = {
    borrador: borradoresRes.count || 0,
    activa: activasRes.count || 0,
    cerrada: cerradasRes.count || 0,
    finalizada: finalizadasRes.count || 0,
  };

  const { data: rawCauses } = await supabase
    .from("causes")
    .select(`
      id,
      title,
      category,
      description,
      status,
      city,
      country_code,
      published_at,
      closed_at,
      finalized_at,
      goal_amount,
      raised_reported,
      currency,
      comments_count,
      saves_count,
      created_at,
      updated_at,
      collection_type,
      is_example,
      first_support_confirmed_at,
      profiles:author_id(id, full_name, username, avatar_url),
      cause_media(id, storage_path, kind, position, width, height),
      cause_results(summary, amount_received),
      cause_supplies(id, name, unit, quantity_needed, quantity_received, position)
    `)
    .eq("author_id", user.id)
    .eq("status", "activa")
    .order("created_at", { ascending: false })
    .limit(11);

  const items = rawCauses || [];
  const initialHasMore = items.length > 10;
  const pageItems = initialHasMore ? items.slice(0, 10) : items;

  const profile = profileRes.data;

  const initialCauses: ExtendedCauseCardProps[] = pageItems.map((c: any) => {
    const media: CauseMediaItem[] = (c.cause_media || []).map((m: any) => ({
      id: m.id,
      storage_path: m.storage_path,
      kind: m.kind,
      position: m.position,
      width: m.width,
      height: m.height,
    }));

    const results = Array.isArray(c.cause_results) ? c.cause_results[0] : c.cause_results;
    const suppliesList = (c.cause_supplies || []).sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
    );

    return {
      id: c.id,
      title: c.title || "Causa sin título",
      category: c.category || "otra",
      description: c.description || "",
      status: c.status,
      city: c.city,
      country_code: c.country_code,
      published_at: c.published_at,
      closed_at: c.closed_at,
      finalized_at: c.finalized_at,
      goal_amount: c.goal_amount,
      raised_reported: c.raised_reported,
      currency: c.currency || "USD",
      comments_count: c.comments_count || 0,
      saves_count: c.saves_count || 0,
      collection_type: c.collection_type,
      is_example: c.is_example,
      first_support_confirmed_at: c.first_support_confirmed_at,
      supplies: suppliesList,
      author: {
        id: c.profiles?.id || user.id,
        full_name: c.profiles?.full_name || profile?.full_name || "Mi perfil",
        username: c.profiles?.username || profile?.username || "yo",
        avatar_url: c.profiles?.avatar_url || profile?.avatar_url,
      },
      media,
      resultsSummary: results?.summary || null,
      resultsAmountReceived: results?.amount_received || null,
      isOwner: true,
    };
  });

  const initialCursor = pageItems.length > 0 ? pageItems[pageItems.length - 1].created_at : null;

  return (
    <MisCausasClient
      userId={user.id}
      initialCounts={initialCounts}
      initialCauses={initialCauses}
      initialHasMore={initialHasMore}
      initialCursor={initialCursor}
      initialHasExampleCause={Boolean(exRowRes.data)}
    />
  );
}
