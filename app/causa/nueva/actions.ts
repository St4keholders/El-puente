"use server";

import { createClient } from "@/lib/supabase/server";

export async function initDraftAction(params?: {
  draftParam?: string | null;
  defaultCountry?: string | null;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, redirect: "/entrar?next=/causa/nueva" };
    }

    // Verificar si está onboarded
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at, country_code")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed_at) {
      return { success: false, redirect: "/bienvenida?next=/causa/nueva" };
    }

    let draft: any = null;

    if (params?.draftParam) {
      const { data: specifiedCause } = await supabase
        .from("causes")
        .select("*")
        .eq("id", params.draftParam)
        .eq("author_id", user.id)
        .maybeSingle();
      if (specifiedCause) {
        draft = specifiedCause;
      }
    }

    if (!draft) {
      const { data: existingDrafts } = await supabase
        .from("causes")
        .select("*")
        .eq("author_id", user.id)
        .eq("status", "borrador")
        .order("updated_at", { ascending: false })
        .limit(1);

      draft = existingDrafts && existingDrafts[0];
    }

    if (!draft) {
      const country = params?.defaultCountry || profile.country_code || "CO";
      const { data: newDraft, error: createError } = await supabase
        .from("causes")
        .insert({
          author_id: user.id,
          status: "borrador",
          country_code: country,
          category: "otra",
          currency: "USD",
        })
        .select()
        .single();

      if (createError) throw createError;
      draft = newDraft;
    }

    // Load supplies, media, donation methods and profile methods in parallel
    const [suppliesRes, mediaRes, methodsRes, pMethodsRes, prevMethodsRes] =
      await Promise.all([
        supabase
          .from("cause_supplies")
          .select("*")
          .eq("cause_id", draft.id)
          .order("position", { ascending: true }),
        supabase
          .from("cause_media")
          .select("*")
          .eq("cause_id", draft.id)
          .order("position", { ascending: true }),
        supabase
          .from("donation_methods")
          .select("*")
          .eq("cause_id", draft.id)
          .order("position", { ascending: true }),
        supabase
          .from("profile_donation_methods")
          .select("*")
          .eq("owner_id", user.id)
          .order("position", { ascending: true }),
        supabase
          .from("donation_methods")
          .select("*")
          .eq("owner_id", user.id)
          .neq("cause_id", draft.id)
          .limit(5),
      ]);

    return {
      success: true,
      draft,
      supplies: suppliesRes.data || [],
      media: mediaRes.data || [],
      methods: methodsRes.data || [],
      profileMethods: pMethodsRes.data || [],
      prevMethods: prevMethodsRes.data || [],
    };
  } catch (err: any) {
    console.error("Fatal in initDraftAction:", err);
    return {
      success: false,
      error: err?.message || "No pudimos inicializar el borrador.",
    };
  }
}
