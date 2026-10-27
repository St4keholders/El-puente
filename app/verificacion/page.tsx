import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VerificacionClient } from "./VerificacionClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function VerificacionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = params.next || "/perfil";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/entrar?next=${encodeURIComponent("/verificacion" + (params.next ? `?next=${params.next}` : ""))}`);
  }

  // Leer estado actual de verificación
  const { data: verif } = await supabase
    .from("identity_verifications")
    .select("id, status, verified_at, expires_at, decline_reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("identity_verified, identity_verified_at, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
      <VerificacionClient
        userId={user.id}
        initialVerification={verif || null}
        isProfileVerified={Boolean(profile?.identity_verified)}
        verifiedAt={profile?.identity_verified_at || null}
        userName={profile?.full_name || ""}
        nextUrl={next}
      />
    </main>
  );
}
