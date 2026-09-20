"use server";

import { createClient } from "@/lib/supabase/server";
import { copyGoogleAvatarToStorage } from "@/lib/actions/auth";

export interface OnboardingInput {
  fullName: string;
  username: string;
  phoneNumber?: string | null;
  termsVersion?: string;
  acceptTerms: boolean;
  next?: string;
}

export async function completeOnboardingAction(data: OnboardingInput) {
  if (!data.acceptTerms) {
    return { success: false, error: "Acepta los términos para continuar." };
  }

  const name = (data.fullName || "").trim();
  if (name.length < 2) {
    return { success: false, error: "Escribe tu nombre completo (mínimo 2 caracteres)." };
  }

  const username = (data.username || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      success: false,
      error: "Solo minúsculas, números y _, entre 3 y 24 caracteres.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return {
      success: false,
      error: "Tu sesión no está activa o expiró. Por favor inicia sesión de nuevo.",
      redirect: "/entrar",
    };
  }

  // Llamar a la función canónica de 4 parámetros de la base de datos
  const { error: rpcErr } = await (supabase.rpc as any)("complete_onboarding", {
    p_full_name: name,
    p_username: username,
    p_phone: data.phoneNumber || null,
    p_terms_version: data.termsVersion || "v1.0",
  });

  if (rpcErr) {
    console.error("complete_onboarding RPC error:", rpcErr);
    if (rpcErr.message?.includes("USUARIO_EN_USO")) {
      return {
        success: false,
        error: "Ese usuario ya lo tomó otra persona. Prueba con otro.",
      };
    }
    if (rpcErr.message?.includes("USUARIO_INVALIDO")) {
      return {
        success: false,
        error: "Solo minúsculas, números y _, entre 3 y 24 caracteres.",
      };
    }
    if (rpcErr.message?.includes("REG_TELEFONO")) {
      return { success: false, error: "Revisa el número, parece incompleto." };
    }
    if (rpcErr.message?.includes("REG_TERMINOS")) {
      return { success: false, error: "Acepta los términos para continuar." };
    }
    return {
      success: false,
      error: rpcErr.message || "Error al completar el registro.",
    };
  }

  // Copiar foto de Google a almacenamiento propio en segundo plano
  const meta = user.user_metadata || {};
  const googlePhoto = meta.avatar_url || meta.picture || null;
  if (googlePhoto) {
    copyGoogleAvatarToStorage(googlePhoto).catch(() => {});
  }

  const targetUrl = !data.next || data.next === "/bienvenida" ? "/" : data.next;
  return { success: true, redirect: targetUrl };
}
