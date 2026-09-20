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

    // Temporizador de seguridad rápido: loading nunca debe bloquear la UI por más de 1.5s
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    }, 1500);

    const loadProfileData = async (currentUser: User) => {
      try {
        const { data: initialProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

        let profileData = initialProfile;

        // Si no existe perfil en la DB, auto-crearlo con su ID asignado
        if (!profileData) {
          const meta = currentUser.user_metadata || {};
          const fullName =
            meta.full_name || meta.name || currentUser.email?.split("@")[0] || "Usuario";
          const assignedId = `id_${currentUser.id.replace(/-/g, "").slice(0, 10)}`;

          try {
            await supabase.from("profiles").upsert(
              {
                id: currentUser.id,
                full_name: fullName,
                username: assignedId,
                avatar_url: meta.avatar_url || meta.picture || null,
              },
              { onConflict: "id" }
            );
          } catch {}

          const { data: healed } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();
          profileData = healed;
        }

        if (mountedRef.current) {
          setProfile(profileData);
        }

        // Consultar teléfono sin bloquear
        const { data: privateData } = await supabase
          .from("profile_private")
          .select("phone")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (mountedRef.current) {
          setHasPhone(Boolean(privateData?.phone));
        }
      } catch (err) {
        console.warn("[useUser] Error loading profile details:", err);
      }
    };

    const fetchUserAndProfile = async () => {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr) {
          if (
            authErr.message?.includes("claim in JWT") ||
            authErr.status === 403 ||
            authErr.status === 401
          ) {
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
          await loadProfileData(user);
        } else {
          if (mountedRef.current) {
            setProfile(null);
            setHasPhone(true);
          }
        }
      } catch (err) {
        console.warn("[useUser] Error fetching user:", err);
      } finally {
        clearTimeout(safetyTimer);
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

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser && mountedRef.current) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      const { data: privateData } = await supabase
        .from("profile_private")
        .select("phone")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (mountedRef.current) {
        setProfile(profileData);
        setHasPhone(Boolean(privateData?.phone));
      }
    }
  };

  return { user, profile, hasPhone, loading, refreshProfile };
}
