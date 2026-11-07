import { createClient } from "@/lib/supabase/server";
import { GlobeHero } from "@/components/planet/GlobeHero";
import { CausasRecientes } from "@/components/planet/CausasRecientes";
import { fetchFeedPage } from "@/lib/feed/fetchFeed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();

  const [countsRes, eventsRes, userRes] = await Promise.all([
    // 1. Causas activas por país para las luces del planeta
    supabase.from("country_cause_counts").select("country_code, active_count"),
    // 2. Últimos eventos de actividad
    supabase.from("activity_events").select("*").order("created_at", { ascending: false }).limit(3),
    supabase.auth.getUser(),
  ]);

  const counts = (countsRes.data || [])
    .filter((c) => c.country_code && c.active_count)
    .map((c) => ({
      country_code: c.country_code!,
      active_count: Number(c.active_count || 0),
    }));

  // 3. Primeras causas recientes para el scroll de abajo (el resto se carga al bajar)
  const recientes = await fetchFeedPage(supabase, { status: "activa" }, null, userRes.data.user?.id || null, 6);

  return (
    <>
      <GlobeHero initialCounts={counts} initialEvents={eventsRes.data || []} />
      <CausasRecientes
        iniciales={recientes.error ? [] : recientes.causes}
        cursorInicial={recientes.nextCursor || null}
        hayMasInicial={!recientes.error && recientes.hasMore}
      />
    </>
  );
}
