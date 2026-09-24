import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { urlDeAvatar } from "@/lib/media";
import { BienvenidaForm } from "./BienvenidaForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BienvenidaPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function BienvenidaPage({ searchParams }: BienvenidaPageProps) {
  const params = await searchParams;
  const next = params.next || "/";

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    redirect(`/entrar?next=${encodeURIComponent(next)}`);
  }

  // Comprobar estado de perfil existente
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, full_name, public_id, avatar_url, country_code, city")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("/bienvenida profiles:", profileErr.code, profileErr.message);
    throw new Error(`No pudimos leer tu perfil: ${profileErr.message}`);
  }

  // Si ya completó onboarding, llevarlo de inmediato a su destino
  if (profile?.onboarding_completed_at) {
    redirect(next);
  }

  const meta = user.user_metadata || {};
  const initialName =
    profile?.full_name ||
    meta.full_name ||
    meta.name ||
    "";
  const avatarUrl =
    urlDeAvatar(profile?.avatar_url) || meta.avatar_url || meta.picture || null;

  return (
    <BienvenidaForm
      userEmail={user.email || ""}
      initialName={initialName}
      publicId={profile?.public_id || null}
      initialCountry={profile?.country_code || ""}
      initialCity={profile?.city || ""}
      avatarUrl={avatarUrl}
      next={next}
    />
  );
}
