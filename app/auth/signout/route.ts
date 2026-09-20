import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function doSignOut(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Error calling supabase.auth.signOut in /auth/signout:", err);
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const origin =
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://el-puente-five.vercel.app";
  const response = NextResponse.redirect(new URL("/", origin));

  for (const c of allCookies) {
    if (
      c.name.startsWith("sb-") ||
      c.name.includes("auth-token") ||
      c.name.includes("supabase") ||
      c.name.startsWith("puente")
    ) {
      cookieStore.delete(c.name);
      response.cookies.set(c.name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }

  return response;
}

export async function GET(request: NextRequest) {
  return doSignOut(request);
}

export async function POST(request: NextRequest) {
  return doSignOut(request);
}
