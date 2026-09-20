import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchFeedPage, FeedFilters } from "@/lib/feed/fetchFeed";
import { FeedView } from "@/components/feed/FeedView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Causas Cerradas | Puente",
  description:
    "Causas que ya no reciben donaciones y están en proceso de compartir sus resultados y rendición de cuentas con la comunidad.",
};

interface CerradasPageProps {
  searchParams: Promise<{
    q?: string;
    pais?: string;
    categoria?: string;
    siguiendo?: string;
  }>;
}

export default async function CerradasPage(props: CerradasPageProps) {
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
    status: "cerrada",
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
        panelKey="cerradas"
      />
    </main>
  );
}
