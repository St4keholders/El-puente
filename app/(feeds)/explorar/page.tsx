import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchFeedPage, FeedFilters } from "@/lib/feed/fetchFeed";
import { FeedView } from "@/components/feed/FeedView";

export const metadata: Metadata = {
  title: "Explorar Causas | Puente",
  description:
    "Descubre causas comunitarias y emergencias activas en todo el mundo. Apoya directamente a quienes lo necesitan, sin comisiones ni intermediarios.",
};

interface ExplorarPageProps {
  searchParams: Promise<{
    q?: string;
    pais?: string;
    categoria?: string;
    siguiendo?: string;
  }>;
}

export default async function ExplorarPage(props: ExplorarPageProps) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const filters: FeedFilters = {
    q: searchParams.q || undefined,
    pais: searchParams.pais || undefined,
    categoria: searchParams.categoria || undefined,
    siguiendo: searchParams.siguiendo === "1",
    status: "activa",
  };

  const initialResult = await fetchFeedPage(
    supabase,
    filters,
    null,
    user?.id || null,
    10
  );

  return (
    <main className="min-h-screen pb-24">
      <FeedView
        initialCauses={initialResult.causes}
        initialCursor={initialResult.nextCursor}
        initialHasMore={initialResult.hasMore}
        filters={filters}
        panelKey="explorar"
      />
    </main>
  );
}
