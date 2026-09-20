import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetodosPagoClient } from "./MetodosPagoClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MetodosPagoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar?next=/perfil/metodos");
  }

  const { data: methods, error } = await supabase
    .from("profile_donation_methods")
    .select("*")
    .eq("owner_id", user.id)
    .order("position", { ascending: true });

  return (
    <MetodosPagoClient
      userId={user.id}
      initialMethods={methods || []}
      initialError={error ? "No pudimos cargar tus métodos de pago. Intenta recargar la página." : null}
    />
  );
}
