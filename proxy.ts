import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirecciones directas requeridas (Sección 4)
  if (pathname === "/guardadas" || pathname.startsWith("/guardadas/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil/guardadas";
    return NextResponse.redirect(url);
  }

  if (pathname === "/ajustes" || pathname.startsWith("/ajustes/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If environment variables are missing (e.g. during build or initial setup), pass through without crashing
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate session securely in server environment
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas que exigen sesión (Sección 4)
  const isProtectedPath =
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/causa/nueva") ||
    pathname.includes("/cerrar") ||
    pathname.includes("/resultados") ||
    pathname.includes("/editar");

  if (isProtectedPath && !user) {
    const redirectUrl = new URL("/entrar", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Control de Onboarding / Bienvenida (Sección 1.5)
  // Rutas exentas de redirección a bienvenida
  const isExemptRoute =
    pathname.startsWith("/bienvenida") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/terminos") ||
    pathname.startsWith("/privacidad") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (user && !isExemptRoute) {
    const hasBienvenidaCookie = request.cookies.get("puente-bienvenida")?.value === "1";

    if (!hasBienvenidaCookie) {
      // Consultar una sola vez onboarding_completed_at
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed_at) {
        // Establecer cookie para evitar consultas futuras
        supabaseResponse.cookies.set("puente-bienvenida", "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 365 * 24 * 60 * 60,
          path: "/",
        });
      } else {
        // Redirigir a bienvenida sin permitir saltársela
        const bienvenidaUrl = new URL("/bienvenida", request.url);
        bienvenidaUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(bienvenidaUrl);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
