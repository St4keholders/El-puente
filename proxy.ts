import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createRedirectWithCookies(url: URL | string, baseResponse: NextResponse) {
  const redirectRes = NextResponse.redirect(url);
  baseResponse.cookies.getAll().forEach((cookie) => {
    redirectRes.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectRes;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Redirecciones directas requeridas (Sección 4)
  if (pathname === "/guardadas" || pathname.startsWith("/guardadas/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil/guardadas";
    return createRedirectWithCookies(url, supabaseResponse);
  }

  if (pathname === "/ajustes" || pathname.startsWith("/ajustes/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil";
    return createRedirectWithCookies(url, supabaseResponse);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
  });

  // Validar sesión del usuario en el servidor
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
    return createRedirectWithCookies(redirectUrl, supabaseResponse);
  }

  // Control de Bienvenida (PLAN-RESCATE 5.3: Sin cookie intermedia, consulta directa de la verdad)
  const isExemptRoute =
    pathname.startsWith("/bienvenida") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/terminos") ||
    pathname.startsWith("/privacidad") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (user && !isExemptRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed_at) {
      const bienvenidaUrl = new URL("/bienvenida", request.url);
      bienvenidaUrl.searchParams.set("next", pathname);
      return createRedirectWithCookies(bienvenidaUrl, supabaseResponse);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
