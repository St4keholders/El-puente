import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CauseCardProps } from "@/components/feed/CauseCard";

export interface FeedFilters {
  q?: string;
  pais?: string;
  categoria?: string;
  siguiendo?: boolean;
  status?: "activa" | "cerrada" | "finalizada";
}

export interface FeedPageResult {
  causes: CauseCardProps[];
  /** Mensaje si la consulta falló (nunca se devuelve una lista vacía en su lugar). */
  error?: string;
  nextCursor?: {
    date: string;
    id: string;
  } | null;
  hasMore: boolean;
}

export interface FeedFacetsResult {
  categories: Array<{ category: string; total: number }>;
  countries: Array<{ country_code: string; total: number }>;
}

export async function fetchFeedFacets(
  supabase: SupabaseClient<Database, any, any>,
  status: "activa" | "cerrada" | "finalizada",
  q?: string,
  country?: string,
  category?: string,
  following?: boolean
): Promise<FeedFacetsResult> {
  try {
    const { data, error } = await (supabase.rpc as any)("feed_facets", {
      p_status: status,
      p_q: q?.trim() || null,
      p_country: country ? country.toUpperCase() : null,
      p_category: category && category !== "todas" ? category : null,
      p_following: Boolean(following),
    });

    if (error || !data) {
      console.warn("fetchFeedFacets error:", error);
      return { categories: [], countries: [] };
    }

    return {
      categories: (data as any).categories || [],
      countries: (data as any).countries || [],
    };
  } catch (err) {
    console.error("fetchFeedFacets caught exception:", err);
    return { categories: [], countries: [] };
  }
}

export async function fetchFeedPage(
  supabase: SupabaseClient<Database, any, any>,
  filters: FeedFilters = {},
  cursor?: { date: string; id: string } | null,
  sessionUserId?: string | null,
  limit = 10
): Promise<FeedPageResult> {
  const targetStatus = filters.status || "activa";
  const sortField =
    targetStatus === "cerrada"
      ? "closed_at"
      : targetStatus === "finalizada"
      ? "finalized_at"
      : "published_at";

  const args = {
    p_status: targetStatus,
    p_q: filters.q?.trim() || null,
    p_country: filters.pais ? filters.pais.toUpperCase() : null,
    p_category:
      filters.categoria && filters.categoria !== "todas"
        ? (filters.categoria as any)
        : null,
    p_following: Boolean(filters.siguiendo),
    p_cursor_ts: cursor?.date || null,
    p_cursor_id: cursor?.id || null,
    p_limit: limit + 1,
  };

  let rawCauses: any[] | null = null;

  // Intenta primero mediante la función optimizada feed_causes
  const rpcQuery = (supabase.rpc as any)("feed_causes", args)
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
      collection_type,
      is_example,
      author:profiles!causes_author_id_fkey(
        id,
        full_name,
        public_id,
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
    .order(sortField as any, { ascending: false })
    .order("id", { ascending: false });

  const { data: rpcData, error: rpcError } = await rpcQuery;

  if (!rpcError && rpcData) {
    rawCauses = rpcData;
  } else {
    if (rpcError) console.error("fetchFeedPage feed_causes:", rpcError.code, rpcError.message);
    // Fallback a consulta directa sobre tabla si RPC tiene alguna restricción en joins PostgREST
    let directQuery = supabase
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
        collection_type,
        is_example,
        author:profiles!causes_author_id_fkey(
          id,
          full_name,
          public_id,
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
      .eq("status", targetStatus);

    if (filters.pais) {
      directQuery = directQuery.eq("country_code", filters.pais.toUpperCase());
    }
    if (filters.categoria && filters.categoria !== "todas") {
      directQuery = directQuery.eq("category", filters.categoria as any);
    }
    if (cursor?.date && cursor?.id) {
      directQuery = directQuery.or(
        `${sortField}.lt.${cursor.date},and(${sortField}.eq.${cursor.date},id.lt.${cursor.id})`
      );
    }

    directQuery = directQuery
      .order(sortField as any, { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    const { data: directData, error: directError } = await directQuery;
    if (directError) {
      console.error("fetchFeedPage direct fallback error:", directError.code, directError.message);
      return {
        causes: [],
        nextCursor: null,
        hasMore: false,
        error: `No pudimos cargar las causas: ${directError.message}`,
      };
    }
    rawCauses = directData;
  }

  if (!rawCauses || rawCauses.length === 0) {
    return { causes: [], nextCursor: null, hasMore: false };
  }

  const hasMore = rawCauses.length > limit;
  const items = hasMore ? rawCauses.slice(0, limit) : rawCauses;

  const causeIds = items.map((c) => c.id);
  const authorIds = Array.from(
    new Set(items.map((c) => (c.author as any)?.id).filter(Boolean))
  );

  // Saves para el usuario actual
  const savedSet = new Set<string>();
  if (sessionUserId && causeIds.length > 0) {
    const { data: saveRows } = await supabase
      .from("saves")
      .select("cause_id")
      .eq("user_id", sessionUserId)
      .in("cause_id", causeIds);

    (saveRows || []).forEach((s) => savedSet.add(s.cause_id));
  }

  // Follows para autores en la página
  const followingSet = new Set<string>();
  if (sessionUserId && authorIds.length > 0) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", sessionUserId)
      .in("following_id", authorIds);

    (followRows || []).forEach((f) => followingSet.add(f.following_id));
  }

  // 2 comentarios recientes por causa
  const commentsByCause: Record<
    string,
    Array<{ id: string; author_name: string; body: string }>
  > = {};

  if (causeIds.length > 0) {
    const { data: commentRows } = await supabase
      .from("comments")
      .select(
        `
        id,
        cause_id,
        body,
        created_at,
        author:profiles!comments_author_id_fkey(
          full_name
        )
      `
      )
      .in("cause_id", causeIds)
      .is("parent_id", null)
      .order("created_at", { ascending: false });

    (commentRows || []).forEach((row: any) => {
      if (!commentsByCause[row.cause_id]) {
        commentsByCause[row.cause_id] = [];
      }
      if (commentsByCause[row.cause_id].length < 2) {
        commentsByCause[row.cause_id].push({
          id: row.id,
          author_name: row.author?.full_name || "Usuario",
          body: row.body,
        });
      }
    });
  }

  // 3. Insumos para causas que requieren insumos o ambas
  const suppliesByCause: Record<
    string,
    Array<{ id: string; name: string; quantity_needed?: number | null; quantity_received?: number | null; position: number }>
  > = {};

  if (causeIds.length > 0) {
    const { data: supplyRows } = await supabase
      .from("cause_supplies")
      .select("id, cause_id, name, quantity_needed, quantity_received, position")
      .in("cause_id", causeIds)
      .order("position", { ascending: true });

    (supplyRows || []).forEach((row: any) => {
      if (!suppliesByCause[row.cause_id]) {
        suppliesByCause[row.cause_id] = [];
      }
      suppliesByCause[row.cause_id].push({
        id: row.id,
        name: row.name,
        quantity_needed: row.quantity_needed,
        quantity_received: row.quantity_received,
        position: row.position,
      });
    });
  }

  // Mapear a CauseCardProps
  const causes: CauseCardProps[] = items.map((c: any) => {
    const author = c.author || {
      id: "unknown",
      full_name: "Usuario",
      public_id: "",
    };

    const causeMediaItems = ((c.media || []) as any[])
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

    const resultsMediaItems = ((c.media || []) as any[])
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
      collection_type: c.collection_type || "dinero",
      is_example: Boolean(c.is_example),
      supplies: suppliesByCause[c.id] || [],
      author: {
        id: author.id,
        full_name: author.full_name || "Usuario",
        public_id: author.public_id || "",
        avatar_url: author.avatar_url,
      },
      media: causeMediaItems,
      resultsMedia: resultsMediaItems,
      resultsSummary: c.results?.summary || null,
      resultsAmountReceived: c.results?.amount_received || null,
      recentComments: commentsByCause[c.id] || [],
      isSaved: savedSet.has(c.id),
      isFollowing: followingSet.has(author.id),
      isOwner: Boolean(sessionUserId && author.id === sessionUserId),
    };
  });

  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? {
          date: (lastItem as any)[sortField],
          id: lastItem.id,
        }
      : null;

  return {
    causes,
    nextCursor,
    hasMore,
  };
}
