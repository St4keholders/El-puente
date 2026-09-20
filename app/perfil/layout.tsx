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

  return (
    <PerfilLayoutClient user={user} profile={profile} hasPhone={hasPhone}>
      {children}
    </PerfilLayoutClient>
  );
}

