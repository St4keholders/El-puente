import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevaCausaClient } from "./NuevaCausaClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevaCausaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/causa/nueva");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) {
    redirect("/bienvenida?next=/causa/nueva");
  }

  const { data: priv } = await supabase
    .from("profile_private")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <NuevaCausaClient
      currentUser={user}
      currentUserProfile={profile}
      hasPhoneInitial={Boolean(priv?.phone)}
    />
  );
}
