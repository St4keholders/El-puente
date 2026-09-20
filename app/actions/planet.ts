"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCountryCausesAction(countryCode: string) {
  if (!countryCode) {
    return { success: true, causes: [], count: 0 };
  }

  try {
    const supabase = await createClient();
    const { data, count, error } = await supabase
      .from("causes")
      .select(
        `
        *,
        author:profiles!causes_author_id_fkey(*),
        cause_media(*)
      `,
        { count: "exact" }
      )
      .eq("status", "activa")
      .eq("country_code", countryCode.toUpperCase())
      .order("published_at", { ascending: false })
      .limit(4);

    if (error) {
      console.error("Error in getCountryCausesAction:", error);
      return { success: false, error: error.message, causes: [], count: 0 };
    }

    return {
      success: true,
      causes: (data as any) || [],
      count: count ?? (data?.length || 0),
    };
  } catch (err: any) {
    console.error("Fatal in getCountryCausesAction:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener causas del país",
      causes: [],
      count: 0,
    };
  }
}
