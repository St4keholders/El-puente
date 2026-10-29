import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MisDatosClient } from "./MisDatosClient";
import { completarDatosIdentidad } from "@/lib/identity/sync";

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

  const leerPerfil = () => supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  let { data: profile } = await leerPerfil();

  const { data: priv } = await supabase
    .from("profile_private")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  const leerVerificacion = () =>
    supabase
      .from("identity_verifications")
      .select(
        "status, verified_at, expires_at, decline_reason, verified_full_name, verified_given_names, verified_last_names, document_country, document_last4"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  let { data: verif } = await leerVerificacion();

  // Cuentas verificadas antes de guardar los últimos 4 y el nombre público: se completan una vez.
  if (verif?.status === "aprobada" && !verif.document_last4 && !verif.verified_given_names) {
    await completarDatosIdentidad(user.id);
    ({ data: verif } = await leerVerificacion());
    ({ data: profile } = await leerPerfil());
  }

  return (
    <MisDatosClient
      userId={user.id}
      userEmail={user.email || ""}
      initialProfile={profile}
      initialPhone={priv?.phone || null}
      initialVerification={verif || null}
    />
  );
}
