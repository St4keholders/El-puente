import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
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
    return {
      title: "Causa no encontrada | Puente",
    };
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

  // Fetch cause with author and media
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

  // If status is borrador and current user is not author, 404
  if (cause.status === "borrador" && user?.id !== cause.author_id) {
    notFound();
  }

  // Fetch donation methods (only visible if logged in due to RLS)
  let donationMethods: any[] = [];
  if (user) {
    const { data: methods } = await supabase
      .from("donation_methods")
      .select("*")
      .eq("cause_id", cause.id)
      .order("position", { ascending: true });

    donationMethods = methods || [];
  }

  // Fetch results if finalized
  let resultsData: any = null;
  if (cause.status === "finalizada") {
    const { data: results } = await supabase
      .from("cause_results")
      .select("*")
      .eq("cause_id", cause.id)
      .single();

    resultsData = results;
  }

  // Check if saved by current user
  let isSaved = false;
  let isFollowing = false;
  if (user) {
    const { data: saveRow } = await supabase
      .from("saves")
      .select("id")
      .eq("user_id", user.id)
      .eq("cause_id", cause.id)
      .single();
    isSaved = Boolean(saveRow);

    const { data: followRow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", cause.author_id)
      .single();
    isFollowing = Boolean(followRow);
  }

  const countries = ((mundoData as any).countries || []) as Array<{ id: string; n: string }>;
  const countryObj = countries.find((c) => c.id === cause.country_code);

  return (
    <main className="min-h-screen pt-4 pb-24">
      <CauseDetailView
        cause={cause as any}
        countryName={countryObj?.n}
        donationMethods={donationMethods}
        results={resultsData}
        isSaved={isSaved}
        isFollowing={isFollowing}
        isOwner={Boolean(user && user.id === cause.author_id)}
        currentUserId={user?.id || null}
      />
    </main>
  );
}
