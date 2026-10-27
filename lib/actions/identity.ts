"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { diditProvider } from "@/lib/identity/didit";

export async function iniciarVerificacionAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "SIN_SESION" };
  }

  // Comprobar si ya tiene una verificación aprobada y vigente
  const { data: verif } = await supabase
    .from("identity_verifications")
    .select("status, expires_at")
    .eq("user_id", user.id)
    .eq("status", "aprobada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verif) {
    const isExpired = verif.expires_at && new Date(verif.expires_at) <= new Date();
    if (!isExpired) {
      return { success: true, alreadyVerified: true };
    }
  }

  // Crear la sesión en Didit
  try {
    const sesion = await diditProvider.crearSesion({
      userId: user.id,
      callbackUrl: "https://www.elpuentesh.org/verificacion/resultado",
    });

    // Guardar fila inicial en pendiente
    const admin = createAdminClient();
    await admin.from("identity_verifications").upsert(
      {
        user_id: user.id,
        provider: "didit",
        provider_session_id: sesion.sessionId,
        status: "pendiente",
        level: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_session_id" }
    );

    return { success: true, url: sesion.url, sessionId: sesion.sessionId };
  } catch (err: any) {
    console.error("[iniciarVerificacionAction] error:", err);
    return {
      success: false,
      error: "No pudimos iniciar la verificación. Inténtalo de nuevo más tarde.",
    };
  }
}

export async function consultarEstadoVerificacionAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "SIN_SESION" };
  }

  const { data: verif } = await supabase
    .from("identity_verifications")
    .select("status, verified_at, expires_at, decline_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("identity_verified, identity_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    success: true,
    verification: verif || null,
    profileVerified: Boolean(profile?.identity_verified),
    verifiedAt: profile?.identity_verified_at || null,
  };
}
