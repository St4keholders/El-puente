import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserProfileView } from "@/components/profile/UserProfileView";
import { urlDeAvatar } from "@/lib/media";
import mundoData from "@/lib/geo/mundo.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface UserProfilePageProps {
  params: Promise<{ publicId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_ID_RE = /^PNT-[A-Z0-9]{6}$/;

/** Acepta el ID público (PNT-XXXXXX) y, por compatibilidad con enlaces viejos, el uuid. */
function columnaYValor(raw: string): { column: "public_id" | "id"; value: string } | null {
  const clean = decodeURIComponent(raw).trim();
  if (PUBLIC_ID_RE.test(clean.toUpperCase())) return { column: "public_id", value: clean.toUpperCase() };
  if (UUID_RE.test(clean)) return { column: "id", value: clean.toLowerCase() };
  return null;
}

export async function generateMetadata(props: UserProfilePageProps): Promise<Metadata> {
  const { publicId } = await props.params;
  const target = columnaYValor(publicId);
  if (!target) {
    return { title: "Perfil no encontrado | Puente" };
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, public_id, bio, avatar_url")
    .eq(target.column, target.value)
    .maybeSingle();

  if (error) {
    console.error("generateMetadata /u:", error.code, error.message);
  }
  if (!profile) {
    return { title: "Perfil no encontrado | Puente" };
  }

  const avatar = urlDeAvatar(profile.avatar_url);
  return {
    title: `${profile.full_name} (${profile.public_id}) | Puente`,
    description: profile.bio || `Perfil y causas comunitarias de ${profile.full_name} en Puente.`,
    openGraph: {
      title: `${profile.full_name}`,
      description: profile.bio || `Perfil en Puente.`,
      images: avatar ? [{ url: avatar }] : [],
    },
  };
}

export default async function UserProfilePage(props: UserProfilePageProps) {
  const { publicId } = await props.params;
  const target = columnaYValor(publicId);
  if (!target) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq(target.column, target.value)
    .maybeSingle();

  if (error) {
    console.error("/u profiles:", error.code, error.message);
    throw new Error(`No pudimos cargar el perfil: ${error.message}`);
  }
  if (!profile) {
    notFound();
  }

  const isOwner = Boolean(user && user.id === profile.id);

  // Check if following
  let isFollowing = false;
  if (user && !isOwner) {
    const { data: followRow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    isFollowing = Boolean(followRow);
  }

  // Fetch causes of this user
  const { data: causes, error: causesErr } = await supabase
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

  if (causesErr) {
    console.error("/u causes:", causesErr.code, causesErr.message);
    throw new Error(`No pudimos cargar las causas de este perfil: ${causesErr.message}`);
  }

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
