"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const EVENTO_PERFIL_ACTUALIZADO = "puente:perfil-actualizado";

/**
 * Avisa a todos los componentes que usan `useUser` (header, menús) que el perfil
 * cambió (foto, nombre...) para que lo vuelvan a leer sin recargar la página.
 */
export function avisarPerfilActualizado() {
  window.dispatchEvent(new Event(EVENTO_PERFIL_ACTUALIZADO));
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPhone, setHasPhone] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadProfileData = useCallback(async (currentUser: User) => {
    const supabase = createClient();
    const [profileRes, privateRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
      supabase.from("profile_private").select("phone").eq("id", currentUser.id).maybeSingle(),
    ]);

    if (profileRes.error) {
      console.error("[useUser] profiles:", profileRes.error.code, profileRes.error.message);
    }
    if (privateRes.error) {
      console.error("[useUser] profile_private:", privateRes.error.code, privateRes.error.message);
    }

    if (mountedRef.current) {
      if (!profileRes.error) setProfile(profileRes.data);
      if (!privateRes.error) setHasPhone(Boolean(privateRes.data?.phone));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    const fetchUserAndProfile = async () => {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr) {
          // Sin sesión es un estado normal; cualquier otro error se registra.
          if (authErr.name !== "AuthSessionMissingError") {
            console.error("[useUser] auth.getUser:", authErr.status, authErr.message);
          }
          if (
            authErr.message?.includes("claim in JWT") ||
            authErr.status === 403 ||
            authErr.status === 401
          ) {
            const { error: outErr } = await supabase.auth.signOut();
            if (outErr) console.error("[useUser] signOut:", outErr.status, outErr.message);
          }
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
            setHasPhone(true);
          }
          return;
        }

        if (mountedRef.current) {
          setUser(user);
        }

        if (user) {
          await loadProfileData(user);
        } else if (mountedRef.current) {
          setProfile(null);
          setHasPhone(true);
        }
      } catch (err: any) {
        console.error("[useUser] Error fetching user:", err?.code, err?.message);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchUserAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mountedRef.current) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadProfileData(currentUser);
      } else {
        setProfile(null);
        setHasPhone(true);
      }
      setLoading(false);
    });

    const onPerfilActualizado = async () => {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.error("[useUser] refresco de perfil:", error.status, error.message);
        return;
      }
      if (currentUser) await loadProfileData(currentUser);
    };
    window.addEventListener(EVENTO_PERFIL_ACTUALIZADO, onPerfilActualizado);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener(EVENTO_PERFIL_ACTUALIZADO, onPerfilActualizado);
    };
  }, [loadProfileData]);

  const refreshProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      console.error("[useUser] refreshProfile:", error.status, error.message);
      return;
    }
    if (currentUser) await loadProfileData(currentUser);
  }, [loadProfileData]);

  return { user, profile, hasPhone, loading, refreshProfile };
}
