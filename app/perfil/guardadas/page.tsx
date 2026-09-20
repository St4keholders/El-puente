import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CausasGuardadasClient } from "./CausasGuardadasClient";
import type { CauseCardProps, CauseMediaItem } from "@/components/feed/CauseCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CausasGuardadasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/perfil/guardadas");
  }

  const { data: savesData, error: savesError } = await supabase
    .from("saves")
    .select("cause_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(11);

  if (savesError) {
    return (
      <CausasGuardadasClient
        userId={user.id}
        initialCauses={[]}
        initialHasMore={false}
        initialCursor={null}
        initialError="No pudimos cargar las causas guardadas. Intenta recargar la página."
      />
    );
  }

  const saves = savesData || [];
  const initialHasMore = saves.length > 10;
  const pageSaves = initialHasMore ? saves.slice(0, 10) : saves;
  const causeIds = pageSaves.map((s) => s.cause_id);

  let initialCauses: CauseCardProps[] = [];

  if (causeIds.length > 0) {
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
        author:profiles!causes_author_id_fkey(
          id,
          full_name,
          username,
          avatar_url
        ),
        media:cause_media(
          id,
          storage_path,
          bucket,
          kind,
          phase,
          position,
          width,
          height
        ),
        results:cause_results(
          summary,
          amount_received,
          currency
        )
      `)
      .in("id", causeIds);

    const causesMap = new Map((rawCauses || []).map((c) => [c.id, c]));

    initialCauses = pageSaves
      .map((s) => causesMap.get(s.cause_id))
      .filter(Boolean)
      .map((c: any) => {
        const author = c.author || {
          id: "unknown",
          full_name: "Usuario",
          username: "usuario",
          avatar_url: null,
        };

        const media: CauseMediaItem[] = (c.media || [])
          .filter((m: any) => m.phase === "causa")
          .sort((a: any, b: any) => a.position - b.position)
          .map((m: any) => ({
            id: m.id,
            storage_path: m.storage_path,
            kind: m.kind,
            position: m.position,
            width: m.width,
            height: m.height,
          }));

        const results = Array.isArray(c.results) ? c.results[0] : c.results;

        return {
          id: c.id,
          title: c.title || "Causa solidaria",
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
          author: {
            id: author.id,
            full_name: author.full_name || "Usuario",
            username: author.username || "usuario",
            avatar_url: author.avatar_url,
          },
          media,
          resultsSummary: results?.summary || null,
          resultsAmountReceived: results?.amount_received || null,
          isSaved: true,
        };
      });
  }

  const initialCursor = pageSaves.length > 0 ? pageSaves[pageSaves.length - 1].created_at : null;

  return (
    <CausasGuardadasClient
      userId={user.id}
      initialCauses={initialCauses}
      initialHasMore={initialHasMore}
      initialCursor={initialCursor}
      initialError={null}
    />
  );
}
