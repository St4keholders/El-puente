import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, full_name, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // Si ya completó onboarding, llevarlo de inmediato a su destino
  if (profile?.onboarding_completed_at) {
    redirect(next);
  }

  const meta = user.user_metadata || {};
  const initialName =
    profile?.full_name ||
    meta.full_name ||
    meta.name ||
    user.email?.split("@")[0] ||
    "";
  const avatarUrl =
    profile?.avatar_url || meta.avatar_url || meta.picture || null;

  // Sugerir nombre de usuario: primer nombre y primer apellido sin tildes en minúsculas unidos por _
  let suggested = "";
  if (profile?.username && !profile.username.startsWith("id_")) {
    suggested = profile.username;
  } else {
    const cleanNorm = initialName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const parts = cleanNorm.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      suggested = `${parts[0]}_${parts[1]}`.slice(0, 24);
    } else if (parts.length === 1) {
      suggested = parts[0].slice(0, 24);
    } else {
      suggested = (user.email?.split("@")[0] || "usuario")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 24);
    }
  }

  return (
    <BienvenidaForm
      userId={user.id}
      userEmail={user.email || ""}
      initialName={initialName}
      suggestedUsername={suggested}
      avatarUrl={avatarUrl}
      next={next}
    />
  );
}
