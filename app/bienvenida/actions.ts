"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export interface OnboardingInput {
  fullName: string;
  phoneNumber?: string | null;
  countryCode?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  acceptTerms: boolean;
  next?: string;
}

export async function completeOnboardingAction(data: OnboardingInput) {
  try {
    if (!data.acceptTerms) {
      return { success: false, error: "Debes aceptar los términos para continuar." };
    }

    const name = (data.fullName || "").trim();
    if (name.length < 2) {
      return { success: false, error: "Escribe tu nombre completo (mínimo 2 caracteres)." };
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

    // ID único asignado automáticamente basado en el UUID del usuario
    const assignedId = `id_${user.id.replace(/-/g, "").slice(0, 10)}`;

    // Ejecutar el procedimiento almacenado canónico de onboarding
    const { error: rpcErr } = await (supabase.rpc as any)("complete_onboarding", {
      p_full_name: name,
      p_username: assignedId,
      p_phone: data.phoneNumber || null,
      p_terms_version: "v1.0",
      p_country_code: data.countryCode || null,
      p_city: data.city ? data.city.trim() : null,
      p_avatar_url: data.avatarUrl || null,
    });

    if (rpcErr) {
      console.error("Error in complete_onboarding action:", rpcErr);
      if (rpcErr.message?.includes("REG_TELEFONO")) {
        return { success: false, error: "Revisa el número, parece incompleto." };
      }
      return {
        success: false,
        error: "No pudimos completar tu registro: " + rpcErr.message,
      };
    }

    const targetUrl = !data.next || data.next === "/bienvenida" ? "/" : data.next;
    return { success: true, redirect: targetUrl };
  } catch (err: any) {
    console.error("Fatal error in completeOnboardingAction:", err);
    return {
      success: false,
      error: "Ocurrió un error al procesar tu registro. Por favor intenta de nuevo.",
    };
  }
}
