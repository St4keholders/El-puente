"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPhone, setHasPhone] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const [{ data: profileData }, { data: privateData }] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", user.id).single(),
            supabase.from("profile_private").select("phone").eq("id", user.id).single(),
          ]);
          setProfile(profileData);
          setHasPhone(Boolean(privateData?.phone));
        } else {
          setProfile(null);
          setHasPhone(true);
        }
      } catch (err) {
        console.error("Error fetching user session:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const [{ data: profileData }, { data: privateData }] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", session.user.id).single(),
            supabase.from("profile_private").select("phone").eq("id", session.user.id).single(),
          ]);
          setProfile(profileData);
          setHasPhone(Boolean(privateData?.phone));
        } else {
          setProfile(null);
          setHasPhone(true);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const [{ data: profileData }, { data: privateData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", currentUser.id).single(),
        supabase.from("profile_private").select("phone").eq("id", currentUser.id).single(),
      ]);
      setProfile(profileData);
      setHasPhone(Boolean(privateData?.phone));
    }
  };

  return { user, profile, hasPhone, loading, refreshProfile };
}

