import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useLiveProfile — gedeelde hook die het profile-record van de ingelogde
 * gebruiker live houdt. Dekt 4 sync-mechanismen:
 *
 *  1. Mount fetch        — eerste load van DB
 *  2. CustomEvent        — `profile-updated` op window (instant feedback na save
 *                          in dezelfde tab, voorkomt wachten op realtime roundtrip)
 *  3. Realtime subscribe — postgres_changes op public.profiles voor deze user
 *                          (advisor wijzigt fase → kandidaat ziet het direct)
 *  4. Visibilitychange   — bij terug-focussen even valideren
 *
 * Triggert ook `profile-updated` event na elke verse fetch, zodat consumers
 * die met losse hooks/subscriptions werken automatisch mee-updaten.
 */
export function useLiveProfile<T extends Record<string, any> = any>(
  userId: string | undefined,
  selectColumns: string = "*",
) {
  const [profile, setProfile] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const selectRef = useRef(selectColumns);
  selectRef.current = selectColumns;

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(selectRef.current)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("[useLiveProfile] fetch error:", error.message);
        return;
      }
      if (data) setProfile(data as unknown as T);
    } catch (err) {
      console.warn("[useLiveProfile] fetch threw:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [userId, fetchProfile]);

  // CustomEvent listener — instant in-tab sync
  useEffect(() => {
    if (!userId) return;
    const handler = () => { fetchProfile(); };
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [userId, fetchProfile]);

  // Visibility — refetch bij terug-focussen
  useEffect(() => {
    if (!userId) return;
    const handler = () => {
      if (document.visibilityState === "visible") fetchProfile();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [userId, fetchProfile]);

  // Realtime — postgres_changes voor deze user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`live-profile-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as T | null;
          if (next) setProfile((prev) => ({ ...(prev || {}), ...next } as T));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { profile, loading, refresh: fetchProfile };
}

/**
 * Dispatch helper — gebruik na elke succesvolle profile mutate
 * zodat andere componenten in dezelfde tab meteen herladen.
 */
export function notifyProfileUpdated() {
  window.dispatchEvent(new CustomEvent("profile-updated"));
}
