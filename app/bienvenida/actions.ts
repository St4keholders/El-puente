"use server";

import { createClient } from "@/lib/supabase/server";
import { copyGoogleAvatarToStorage } from "@/lib/actions/auth";
import { destinoSeguro } from "@/lib/utils/destino";
import { nombreDeCuenta } from "@/lib/identity/nombre";

export interface OnboardingInput {
  givenNames: string;
  lastNames: string;
  birthYear: number;
  accountType: "persona" | "empresa";
  companyName?: string | null;
  companyNit?: string | null;
  phoneNumber?: string | null;
  countryCode?: string | null;
  city?: string | null;
  termsVersion?: string;
  acceptTerms: boolean;
  next?: string;
}

const limpiar = (t: string | null | undefined) => (t || "").trim().replace(/\s+/g, " ");

const ERRORES_REGISTRO: Record<string, string> = {
  REG_NOMBRE: "Escribe tus nombres y tus apellidos (cada uno con al menos 2 letras).",
  REG_EDAD: "Para registrarte en Puente necesitas tener al menos 14 años.",
  REG_TELEFONO: "Revisa el número, parece incompleto.",
  REG_TERMINOS: "Acepta los términos para continuar.",
  REG_EMPRESA: "Escribe el nombre de la empresa (entre 2 y 80 caracteres).",
  REG_EMPRESA_RESERVADA: "Ese nombre de empresa no está disponible. Escribe el nombre comercial de tu empresa.",
  REG_NIT: "Revisa el NIT: solo números, con o sin dígito de verificación (ej. 900123456-1).",
};

export async function completeOnboardingAction(data: OnboardingInput) {
  if (!data.acceptTerms) {
    return { success: false, error: ERRORES_REGISTRO.REG_TERMINOS };
  }

  const nombres = limpiar(data.givenNames);
  const apellidos = limpiar(data.lastNames);
  if (nombres.length < 2 || nombres.length > 60 || apellidos.length < 2 || apellidos.length > 60) {
    return { success: false, error: ERRORES_REGISTRO.REG_NOMBRE };
  }

  const anioActual = new Date().getFullYear();
  if (!Number.isInteger(data.birthYear) || data.birthYear < 1900 || anioActual - data.birthYear < 14) {
    return { success: false, error: ERRORES_REGISTRO.REG_EDAD };
  }

  const empresa = data.accountType === "empresa" ? limpiar(data.companyName) : "";
  if (data.accountType === "empresa" && (empresa.length < 2 || empresa.length > 80)) {
    return { success: false, error: ERRORES_REGISTRO.REG_EMPRESA };
  }
  const nit = data.accountType === "empresa" ? (data.companyNit || "").replace(/[\s.]/g, "") : "";
  if (nit && !/^[0-9]{6,12}(-[0-9])?$/.test(nit)) {
    return { success: false, error: ERRORES_REGISTRO.REG_NIT };
  }

  const phone = (data.phoneNumber || "").trim();
  if (!phone) {
    return { success: false, error: "Ingresa tu número de teléfono de contacto." };
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

  // Persona: "Ana P." · Empresa: "Tienda Ana · Ana Pérez". Al verificar la identidad
  // se vuelve a calcular con los datos del documento (y la base no deja cambiarlo después).
  const nombreVisible = nombreDeCuenta({
    nombres,
    apellidos,
    empresa: data.accountType === "empresa" ? empresa : null,
  }) || `${nombres} ${apellidos}`;

  const { error: rpcErr } = await supabase.rpc("complete_onboarding", {
    p_given_names: nombres,
    p_last_names: apellidos,
    p_full_name: nombreVisible,
    p_phone: phone,
    p_terms_version: data.termsVersion || "v1.1",
    p_birth_year: data.birthYear,
    p_account_type: data.accountType,
    p_company_name: data.accountType === "empresa" ? empresa : undefined,
    p_company_nit: nit || undefined,
  });

  if (rpcErr) {
    console.error("complete_onboarding:", rpcErr.code, rpcErr.message);
    const codigo = rpcErr.message?.match(/REG_[A-Z_]+/)?.[0];
    return {
      success: false,
      error: (codigo && ERRORES_REGISTRO[codigo]) || "No pudimos completar el registro. Inténtalo de nuevo en un momento.",
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
        error: "Tu registro quedó listo, pero no pudimos guardar tu país y ciudad. Puedes agregarlos en tu perfil.",
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

  const destino = destinoSeguro(data.next, "/");
  const targetUrl = destino.startsWith("/bienvenida") ? "/" : destino;
  // Primero el tutorial corto; al terminar (o saltarlo) sigue a donde iba
  return { success: true, redirect: `/tutorial?next=${encodeURIComponent(targetUrl)}` };
}
