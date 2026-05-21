import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const DEMO_EMAIL = "test@doorai.nl";
const DEMO_PASSWORD = "admin010";

export function useDemoLogin() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function loginAsDemo(redirect: string = "/dashboard") {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error) throw error;
      navigate(redirect);
    } catch (e) {
      console.error("Demo login failed", e);
      toast({
        title: "Demo-login mislukt",
        description: e instanceof Error ? e.message : "Onbekende fout",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return { loginAsDemo, loading };
}
