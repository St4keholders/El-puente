import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserProfileView } from "@/components/profile/UserProfileView";
import mundoData from "@/lib/geo/mundo.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata(props: UserProfilePageProps): Promise<Metadata> {
  const { username } = await props.params;
  const cleanUsername = decodeURIComponent(username).replace(/^@/, "").toLowerCase();
  const supabase = await createClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUsername);
  let query = supabase.from("profiles").select("full_name, username, bio, avatar_url");
  if (isUuid) {
    query = query.or(`id.eq.${cleanUsername},username.eq.${cleanUsername}`);
  } else {
    query = query.eq("username", cleanUsername);
  }

  const { data: profile } = await query.maybeSingle();

  if (!profile) {
    return { title: "Usuario no encontrado | Puente" };
  }

  return {
    title: `${profile.full_name} (${profile.username ? `@${profile.username}` : "Puente"}) | Puente`,
    description: profile.bio || `Perfil y causas comunitarias de ${profile.full_name} en Puente.`,
    openGraph: {
      title: `${profile.full_name}`,
      description: profile.bio || `Perfil en Puente.`,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
  };
}

export default async function UserProfilePage(props: UserProfilePageProps) {
  const { username } = await props.params;
  const cleanUsername = decodeURIComponent(username).replace(/^@/, "").toLowerCase();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile by username or ID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUsername);
  let profQuery = supabase.from("profiles").select("*");
  if (isUuid) {
    profQuery = profQuery.or(`id.eq.${cleanUsername},username.eq.${cleanUsername}`);
  } else {
    profQuery = profQuery.eq("username", cleanUsername);
  }

  const { data: profile, error } = await profQuery.maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const isOwner = Boolean(user && user.id === profile.id);

  // Check if following
  let isFollowing = false;
  if (user && !isOwner) {
    const { data: followRow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .single();
    isFollowing = Boolean(followRow);
  }

  // Fetch causes of this user
  const { data: causes } = await supabase
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
      goal_amount,
      raised_reported,
      currency,
      published_at,
      closed_at,
      finalized_at,
      comments_count,
      saves_count,
      media:cause_media(
        id,
        storage_path,
        bucket,
        kind,
        phase,
        position
      ),
      results:cause_results(
        summary,
        amount_received,
        currency
      )
    `
    )
    .eq("author_id", profile.id)
    .in("status", isOwner ? ["borrador", "activa", "cerrada", "finalizada"] : ["activa", "cerrada", "finalizada"])
    .order("created_at", { ascending: false });

  const countries = ((mundoData as any).countries || []) as Array<{ id: string; n: string }>;
  const countryObj = countries.find((c) => c.id === profile.country_code);

  return (
    <main className="min-h-screen pt-24 md:pt-28 pb-24">
      <UserProfileView
        profile={profile}
        countryName={countryObj?.n}
        causes={causes || []}
        isFollowing={isFollowing}
        isOwner={isOwner}
        currentUserId={user?.id || null}
      />
    </main>
  );
}
