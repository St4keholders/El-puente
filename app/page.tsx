import { createClient } from "@/lib/supabase/server";
import { GlobeHero } from "@/components/planet/GlobeHero";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();

  // 1. Fetch active cause counts per country for the lights
  const { data: countsData } = await supabase
    .from("country_cause_counts")
    .select("country_code, active_count");

  const counts = (countsData || [])
    .filter((c) => c.country_code && c.active_count)
    .map((c) => ({
      country_code: c.country_code!,
      active_count: Number(c.active_count || 0),
    }));

  // 2. Fetch latest activity events
  const { data: eventsData } = await supabase
    .from("activity_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <GlobeHero
      initialCounts={counts}
      initialEvents={eventsData || []}
    />
  );
}
