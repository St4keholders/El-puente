import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MisDatosClient } from "./MisDatosClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MisDatosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/perfil");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: priv } = await supabase
    .from("profile_private")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <MisDatosClient
      userId={user.id}
      userEmail={user.email || ""}
      initialProfile={profile}
      initialPhone={priv?.phone || null}
    />
  );
}
