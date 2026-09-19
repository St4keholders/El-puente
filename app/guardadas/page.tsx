import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedView } from "@/components/feed/FeedView";
import type { CauseCardProps } from "@/components/feed/CauseCard";

export const metadata: Metadata = {
  title: "Causas Guardadas | Puente",
  description: "Tus causas solidarias guardadas para dar seguimiento o apoyar.",
};

export default async function GuardadasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/guardadas");
  }

  // Fetch saved cause IDs
  const { data: saveRows } = await supabase
    .from("saves")
    .select("cause_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const causeIds = (saveRows || []).map((s) => s.cause_id);

  let causes: CauseCardProps[] = [];

  if (causeIds.length > 0) {
    const { data: rawCauses } = await supabase
      .from("causes")
      .select(
        `
        id,
        title,
        category,
        description,
        status,
        city,
        country_code,
        region,
        published_at,
        closed_at,
        finalized_at,
        goal_amount,
        raised_reported,
        currency,
        comments_count,
        saves_count,
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
      `
      )
      .in("id", causeIds);

    // Map according to save order
    const causesMap = new Map((rawCauses || []).map((c) => [c.id, c]));

    causes = causeIds
      .map((id) => causesMap.get(id))
      .filter(Boolean)
      .map((c: any) => {
        const author = c.author || {
          id: "unknown",
          full_name: "Usuario",
          username: "usuario",
        };

        const causeMedia = ((c.media || []) as any[])
          .filter((m) => m.phase === "causa")
          .sort((a, b) => a.position - b.position)
          .map((m) => ({
            id: m.id,
            storage_path: m.storage_path,
            bucket: m.bucket,
            kind: m.kind,
            position: m.position,
            width: m.width,
            height: m.height,
          }));

        const resultsMedia = ((c.media || []) as any[])
          .filter((m) => m.phase === "resultado")
          .sort((a, b) => a.position - b.position)
          .map((m) => ({
            id: m.id,
            storage_path: m.storage_path,
            bucket: m.bucket,
            kind: m.kind,
            position: m.position,
            width: m.width,
            height: m.height,
          }));

        return {
          id: c.id,
          title: c.title || "Sin título",
          category: c.category,
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
          media: causeMedia,
          resultsMedia,
          resultsSummary: c.results?.summary || null,
          isSaved: true,
          isFollowing: false,
          isOwner: author.id === user.id,
        };
      });
  }

  return (
    <main className="min-h-screen pt-4 pb-20">
      <FeedView
        initialCauses={causes}
        initialCursor={null}
        initialHasMore={false}
        filters={{}}
        title="Causas Guardadas"
        emptyMessage="Aún no has guardado ninguna causa."
      />
    </main>
  );
}
