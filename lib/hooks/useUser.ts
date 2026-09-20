"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPhone, setHasPhone] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    // Temporizador de seguridad: loading NUNCA debe quedarse en true indefinidamente
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    }, 4000);

    const fetchUserAndProfile = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr) {
          if (
            authErr.message?.includes("claim in JWT") ||
            authErr.status === 403 ||
            authErr.status === 401
          ) {
            // Token huérfano de usuario eliminado: limpiar sesión local
            await supabase.auth.signOut().catch(() => {});
          }
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
            setHasPhone(true);
            setLoading(false);
          }
          return;
        }

        if (mountedRef.current) {
          setUser(user);
        }

        if (user) {
          const [{ data: initialProfile }, { data: privateData }] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
            supabase.from("profile_private").select("phone").eq("id", user.id).maybeSingle(),
          ]);
          let profileData = initialProfile;

          // Auto-sanar fila de perfil si aún no existe en DB
          if (!profileData) {
            const meta = user.user_metadata || {};
            const fullName = meta.full_name || meta.name || user.email?.split("@")[0] || "Usuario";
            const candidate = `usuario_${user.id.substring(0, 6)}`;
            try {
              await supabase.from("profiles").upsert({
                id: user.id,
                full_name: fullName,
                username: candidate,
                avatar_url: meta.avatar_url || meta.picture || null,
              });
            } catch {}

            const { data: healed } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .maybeSingle();
            profileData = healed;
          }

          if (mountedRef.current) {
            setProfile(profileData);
            setHasPhone(Boolean(privateData?.phone));
          }
        } else {
          if (mountedRef.current) {
            setProfile(null);
            setHasPhone(true);
          }
        }
      } catch (err) {
        console.error("Error fetching user session:", err);
      } finally {
        clearTimeout(safetyTimer);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mountedRef.current) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const [{ data: profileData }, { data: privateData }] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
            supabase.from("profile_private").select("phone").eq("id", currentUser.id).maybeSingle(),
          ]);
          if (mountedRef.current) {
            setProfile(profileData);
            setHasPhone(Boolean(privateData?.phone));
          }
        } else {
          if (mountedRef.current) {
            setProfile(null);
            setHasPhone(true);
          }
        }
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser && mountedRef.current) {
      const [{ data: profileData }, { data: privateData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
        supabase.from("profile_private").select("phone").eq("id", currentUser.id).maybeSingle(),
      ]);
      if (mountedRef.current) {
        setProfile(profileData);
        setHasPhone(Boolean(privateData?.phone));
      }
    }
  };

  return { user, profile, hasPhone, loading, refreshProfile };
}


