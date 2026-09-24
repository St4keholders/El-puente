import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfilLayoutClient } from "./PerfilLayoutClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PerfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    redirect("/entrar?next=/perfil");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) {
    redirect("/bienvenida");
  }

  const { data: priv } = await supabase
    .from("profile_private")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  const hasPhone = Boolean(priv?.phone);

  // Avisos de donación pendientes en mis causas (punto azul en "Apoyos")
  const { count: pendingSupports, error: pendingErr } = await supabase
    .from("support_reports")
    .select("id, cause:causes!inner(author_id)", { count: "exact", head: true })
    .eq("status", "reportado")
    .eq("cause.author_id", user.id);
  if (pendingErr) {
    console.error("/perfil avisos pendientes:", pendingErr.code, pendingErr.message);
  }

  return (
    <PerfilLayoutClient user={user} profile={profile} hasPhone={hasPhone} pendingSupports={pendingSupports ?? 0}>
      {children}
    </PerfilLayoutClient>
  );
}

