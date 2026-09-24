"use server";

import { createClient } from "@/lib/supabase/server";
import { copyGoogleAvatarToStorage } from "@/lib/actions/auth";

export interface OnboardingInput {
  fullName: string;
  phoneNumber?: string | null;
  countryCode?: string | null;
  city?: string | null;
  termsVersion?: string;
  acceptTerms: boolean;
  next?: string;
}

/** Nombre y apellidos: mínimo dos palabras, entre 5 y 80 caracteres (igual que REG_NOMBRE). */
function nombreValido(nombre: string) {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  return limpio.length >= 5 && limpio.length <= 80 && limpio.split(" ").length >= 2;
}

export async function completeOnboardingAction(data: OnboardingInput) {
  if (!data.acceptTerms) {
    return { success: false, error: "Acepta los términos para continuar." };
  }

  const name = (data.fullName || "").trim().replace(/\s+/g, " ");
  if (!nombreValido(name)) {
    return {
      success: false,
      error: "Escribe tu nombre y apellidos (mínimo dos palabras, entre 5 y 80 caracteres).",
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

  const { error: rpcErr } = await supabase.rpc("complete_onboarding", {
    p_full_name: name,
    p_phone: data.phoneNumber || null,
    p_terms_version: data.termsVersion || "v1.0",
  });

  if (rpcErr) {
    console.error("complete_onboarding:", rpcErr.code, rpcErr.message);
    if (rpcErr.message?.includes("REG_NOMBRE")) {
      return {
        success: false,
        error: "Escribe tu nombre y apellidos (mínimo dos palabras, entre 5 y 80 caracteres).",
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
      error: `No pudimos completar el registro: ${rpcErr.message}`,
    };
  }

  // País y ciudad (opcionales)
  const cleanCountry =
    data.countryCode && /^[a-zA-Z]{2}$/.test(data.countryCode.trim())
      ? data.countryCode.trim().toUpperCase()
      : null;
  const cleanCity = data.city?.trim() ? data.city.trim().slice(0, 80) : null;

  if (cleanCountry || cleanCity) {
    const { error: locErr } = await supabase
      .from("profiles")
      .update({ country_code: cleanCountry, city: cleanCity })
      .eq("id", user.id);

    if (locErr) {
      console.error("completeOnboardingAction ubicación:", locErr.code, locErr.message);
      return {
        success: false,
        error: `Tu registro quedó listo, pero no pudimos guardar tu país y ciudad: ${locErr.message}`,
      };
    }
  }

  // Copiar la foto de Google al almacenamiento propio (si la foto actual es la de Google)
  const { data: perfil, error: perfilErr } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  if (perfilErr) {
    console.error("completeOnboardingAction leer perfil:", perfilErr.code, perfilErr.message);
  } else if (perfil?.avatar_url?.startsWith("http")) {
    await copyGoogleAvatarToStorage(perfil.avatar_url);
  }

  const targetUrl = !data.next || data.next === "/bienvenida" ? "/" : data.next;
  return { success: true, redirect: targetUrl };
}
