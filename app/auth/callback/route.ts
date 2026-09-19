import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const destinoSeguro = (n: string | null) =>
  n && n.startsWith("/") && !n.startsWith("//") ? n : "/";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = destinoSeguro(url.searchParams.get("next"));

  // Resolver origen respetando proxy inverso (x-forwarded-host)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin =
    process.env.NODE_ENV === "development"
      ? url.origin
      : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : url.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?error=google", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Auth callback error exchanging code:", error);
    return NextResponse.redirect(new URL("/entrar?error=google", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;

  if (!uid) {
    return NextResponse.redirect(new URL("/entrar?error=google", origin));
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", uid)
    .single();

  const destino = perfil?.onboarding_completed_at
    ? next
    : `/bienvenida?next=${encodeURIComponent(next)}`;

  return NextResponse.redirect(new URL(destino, origin));
}
