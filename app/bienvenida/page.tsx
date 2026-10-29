import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { urlDeAvatar } from "@/lib/media";
import { BienvenidaForm } from "./BienvenidaForm";
import { destinoSeguro } from "@/lib/utils/destino";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BienvenidaPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function BienvenidaPage({ searchParams }: BienvenidaPageProps) {
  const params = await searchParams;
  const next = destinoSeguro(params.next, "/");

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    redirect(`/entrar?next=${encodeURIComponent(next)}`);
  }

  // Comprobar estado de perfil y teléfono existente
  const [profileRes, privateRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_completed_at, full_name, public_id, avatar_url, country_code, city")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (profileRes.error) {
    console.error("/bienvenida profiles:", profileRes.error.code, profileRes.error.message);
    throw new Error("No pudimos leer tu perfil. Recarga la página.");
  }

  const profile = profileRes.data;
  const hasPhone = Boolean(privateRes.data?.phone);

  // Si ya completó onboarding y tiene teléfono obligatorio, llevarlo de inmediato a su destino
  if (profile?.onboarding_completed_at && hasPhone) {
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

  // País desde donde se conecta: sirve para dejar preseleccionados país e indicativo
  const paisConexion = ((await headers()).get("x-vercel-ip-country") || "").toUpperCase();
  const paisSugerido = /^[A-Z]{2}$/.test(paisConexion) ? paisConexion : "";

  return (
    <BienvenidaForm
      paisSugerido={paisSugerido}
      userEmail={user.email || ""}
      initialName={initialName}
      publicId={profile?.public_id || null}
      initialCountry={profile?.country_code || paisSugerido}
      initialCity={profile?.city || ""}
      avatarUrl={avatarUrl}
      next={next}
    />
  );
}
