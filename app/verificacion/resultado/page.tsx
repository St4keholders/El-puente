import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResultadoClient } from "./ResultadoClient";
import { destinoSeguro } from "@/lib/utils/destino";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function ResultadoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = destinoSeguro(params.next, "/perfil");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/entrar?next=${encodeURIComponent("/verificacion/resultado")}`);
  }

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 py-12 md:py-16">
      <ResultadoClient nextUrl={next} />
    </main>
  );
}
