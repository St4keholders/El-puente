"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/database.types";

type DonationMethodKind = Database["public"]["Enums"]["donation_method_kind"];

export interface CreateMethodInput {
  kind: DonationMethodKind;
  provider: string;
  account_holder: string;
  account_value: string;
  details?: string | null;
  position: number;
}

export interface UpdateMethodInput {
  kind: DonationMethodKind;
  provider: string;
  account_holder: string;
  account_value: string;
  details?: string | null;
  syncActiveCauses?: boolean;
}

export async function createPaymentMethodAction(data: CreateMethodInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "SIN_SESION" };
    }

    // Comprobar límite de 10 métodos
    const { count } = await supabase
      .from("profile_donation_methods")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    if (count !== null && count >= 10) {
      return { success: false, error: "Llegaste al máximo de 10 métodos permitidos." };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("profile_donation_methods")
      .insert({
        owner_id: user.id,
        kind: data.kind,
        provider: data.provider.trim(),
        account_holder: data.account_holder.trim(),
        account_value: data.account_value.trim(),
        details: data.details ? data.details.trim() : null,
        position: data.position,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Error creating payment method:", insertError);
      return { success: false, error: insertError.message || "Error al crear método." };
    }

    revalidatePath("/perfil/metodos");
    return { success: true, method: inserted };
  } catch (err: any) {
    console.error("Fatal creating payment method:", err);
    return { success: false, error: err?.message || "Error inesperado." };
  }
}

export async function updatePaymentMethodAction(id: string, data: UpdateMethodInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "SIN_SESION" };
    }

    const { error: updateError } = await supabase
      .from("profile_donation_methods")
      .update({
        kind: data.kind,
        provider: data.provider.trim(),
        account_holder: data.account_holder.trim(),
        account_value: data.account_value.trim(),
        details: data.details ? data.details.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", user.id);

    if (updateError) {
      console.error("Error updating payment method:", updateError);
      return { success: false, error: updateError.message || "Error al actualizar método." };
    }

    if (data.syncActiveCauses) {
      try {
        await (supabase.rpc as any)("sync_profile_method", {
          p_method_id: id,
        });
      } catch (rpcErr) {
        console.warn("sync_profile_method warning:", rpcErr);
      }
    }

    revalidatePath("/perfil/metodos");
    return { success: true };
  } catch (err: any) {
    console.error("Fatal updating payment method:", err);
    return { success: false, error: err?.message || "Error inesperado." };
  }
}

export async function deletePaymentMethodAction(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "SIN_SESION" };
    }

    const { error: delError } = await supabase
      .from("profile_donation_methods")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);

    if (delError) {
      console.error("Error deleting payment method:", delError);
      return { success: false, error: delError.message || "Error al eliminar método." };
    }

    revalidatePath("/perfil/metodos");
    return { success: true };
  } catch (err: any) {
    console.error("Fatal deleting payment method:", err);
    return { success: false, error: err?.message || "Error inesperado." };
  }
}

export async function reorderPaymentMethodsAction(orderedIds: string[]) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "SIN_SESION" };
    }

    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase
          .from("profile_donation_methods")
          .update({ position: idx })
          .eq("id", id)
          .eq("owner_id", user.id)
      )
    );

    revalidatePath("/perfil/metodos");
    return { success: true };
  } catch (err: any) {
    console.error("Fatal reordering payment methods:", err);
    return { success: false, error: err?.message || "Error al reordenar." };
  }
}
