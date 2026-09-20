import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BienvenidaForm } from "./BienvenidaForm";

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, full_name, username, avatar_url, country_code, city")
    .eq("id", user.id)
    .maybeSingle();

  // Si ya completó onboarding, llevarlo de inmediato a su destino
  if (profile?.onboarding_completed_at) {
    redirect(next);
  }

  // ID único asignado automáticamente
  const assignedId = `id_${user.id.replace(/-/g, "").slice(0, 10)}`;

  const meta = user.user_metadata || {};
  const initialName =
    profile?.full_name ||
    meta.full_name ||
    meta.name ||
    user.email?.split("@")[0] ||
    "";
  const initialAvatar =
    profile?.avatar_url || meta.avatar_url || meta.picture || null;

  return (
    <BienvenidaForm
      userId={user.id}
      userEmail={user.email || ""}
      assignedId={assignedId}
      initialName={initialName}
      initialAvatar={initialAvatar}
      initialCountry={profile?.country_code || "CO"}
      initialCity={profile?.city || ""}
      next={next}
    />
  );
}
