import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  created_at?: string;
}

/**
 * Hook to manage Supabase authentication session.
 * Mirrors the web app's useSession hook but adapted for React Native.
 * Fetches user profile once authenticated.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function handleSessionChange(currentSession: Session | null) {
      if (!active) return;
      setSession(currentSession);

      if (currentSession?.user) {
        try {
          // Fetch user profile from database
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentSession.user.id)
            .maybeSingle();

          if (active) {
            if (error) {
              console.error("Error fetching profile:", error);
            }
            if (data) {
              setProfile(data as UserProfile);
            } else {
              // Graceful auto-creation fallback for legacy users
              const fallbackName =
                currentSession.user.user_metadata?.full_name ||
                currentSession.user.user_metadata?.display_name ||
                currentSession.user.email?.split("@")[0] ||
                "User";
              const cleanName = fallbackName
                .split(" ")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");

              const { data: newProfile, error: insertError } = await supabase
                .from("profiles")
                .insert({
                  id: currentSession.user.id,
                  full_name: cleanName,
                  email: currentSession.user.email || "",
                })
                .select()
                .maybeSingle();

              if (active) {
                if (insertError) {
                  if (insertError.code === "23505") {
                    // Profile already exists in the database. Fetch it.
                    const { data: refetchedProfile } = await supabase
                      .from("profiles")
                      .select("*")
                      .eq("id", currentSession.user.id)
                      .maybeSingle();
                    
                    if (refetchedProfile) {
                      setProfile(refetchedProfile as UserProfile);
                    } else {
                      // Fallback if RLS still filters it out temporarily
                      setProfile({
                        id: currentSession.user.id,
                        full_name: cleanName,
                        email: currentSession.user.email || "",
                      });
                    }
                  } else {
                    console.error("Error auto-creating profile:", insertError);
                    // Set local state anyway as a fallback so UI works without crash
                    setProfile({
                      id: currentSession.user.id,
                      full_name: cleanName,
                      email: currentSession.user.email || "",
                    });
                  }
                } else if (newProfile) {
                  setProfile(newProfile as UserProfile);
                } else {
                  setProfile({
                    id: currentSession.user.id,
                    full_name: cleanName,
                    email: currentSession.user.email || "",
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Profile fetch error:", err);
          if (active) {
            setProfile({
              id: currentSession.user.id,
              full_name: currentSession.user.user_metadata?.full_name || "User",
              email: currentSession.user.email || "",
            });
          }
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSessionChange(initialSession);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setLoading(false);
      } else {
        handleSessionChange(newSession);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, user: session?.user ?? null, profile };
}
