import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CauseDetailView } from "@/components/cause/CauseDetailView";
import mundoData from "@/lib/geo/mundo.json";

interface CausePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: CausePageProps): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: cause } = await supabase
    .from("causes")
    .select(
      `
      title,
      description,
      city,
      country_code,
      media:cause_media(
        storage_path,
        bucket,
        kind,
        phase,
        position
      )
    `
    )
    .eq("id", id)
    .single();

  if (!cause) {
    return { title: "Causa no encontrada | Puente" };
  }

  const firstMedia = (cause.media || [])
    .filter((m) => m.phase === "causa" && m.kind === "imagen")
    .sort((a, b) => a.position - b.position)[0];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const imageUrl = firstMedia
    ? `${supabaseUrl}/storage/v1/object/public/causas-imagenes/${firstMedia.storage_path}`
    : undefined;

  const excerpt =
    cause.description && cause.description.length > 150
      ? `${cause.description.slice(0, 150)}...`
      : cause.description || "Apoyo comunitario directo sin intermediarios ni comisiones.";

  return {
    title: `${cause.title} | Puente`,
    description: excerpt,
    openGraph: {
      title: cause.title || "Causa solidaria",
      description: excerpt,
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: cause.title || "Causa solidaria",
      description: excerpt,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function CauseDetailPage(props: CausePageProps) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch cause with author, media and new schema fields
  const { data: cause, error } = await supabase
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
      lat,
      lng,
      goal_amount,
      raised_reported,
      currency,
      published_at,
      closed_at,
      finalized_at,
      created_at,
      closing_note,
      author_id,
      collection_type,
      supplies_instructions,
      is_example,
      first_support_confirmed_at,
      author:profiles!causes_author_id_fkey(
        id,
        full_name,
        username,
        avatar_url,
        bio
      ),
      media:cause_media(
        id,
        storage_path,
        bucket,
        kind,
        phase,
        position,
        width,
        height,
        duration_seconds
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !cause) {
    notFound();
  }

  // Borradores solo visibles al autor
  if (cause.status === "borrador" && user?.id !== cause.author_id) {
    notFound();
  }

  // Métodos de donación (RLS: solo con sesión)
  let donationMethods: any[] = [];
  if (user) {
    const { data: methods } = await supabase
      .from("donation_methods")
      .select("*")
      .eq("cause_id", cause.id)
      .order("position", { ascending: true });
    donationMethods = methods || [];
  }

  // Insumos (visibles sin auth para causas activas por RLS)
  const { data: suppliesData } = await supabase
    .from("cause_supplies")
    .select("*")
    .eq("cause_id", cause.id)
    .order("position", { ascending: true });
  const supplies = suppliesData || [];

  // Resultados si finalizada
  let resultsData: any = null;
  if (cause.status === "finalizada") {
    const { data: results } = await supabase
      .from("cause_results")
      .select("*")
      .eq("cause_id", cause.id)
      .single();
    resultsData = results;
  }

  // Estado de guardado y seguimiento del usuario actual
  let isSaved = false;
  let isFollowing = false;
  if (user) {
    const [saveRes, followRes] = await Promise.all([
      supabase
        .from("saves")
        .select("cause_id")
        .eq("user_id", user.id)
        .eq("cause_id", cause.id)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", cause.author_id)
        .maybeSingle(),
    ]);
    isSaved = Boolean(saveRes.data);
    isFollowing = Boolean(followRes.data);
  }

  const countries = ((mundoData as any).countries || []) as Array<{ id: string; n: string }>;
  const countryObj = countries.find((c) => c.id === cause.country_code);

  return (
    // padding-top: --alto-header + 24px para que el header flotante no tape el título
    <main
      className="min-h-screen pb-24 relative z-[2]"
      style={{ paddingTop: "calc(var(--alto-header) + 24px)" }}
    >
      <CauseDetailView
        cause={cause as any}
        countryName={countryObj?.n}
        donationMethods={donationMethods}
        supplies={supplies}
        results={resultsData}
        isSaved={isSaved}
        isFollowing={isFollowing}
        isOwner={Boolean(user && user.id === cause.author_id)}
        currentUserId={user?.id || null}
      />
    </main>
  );
}
