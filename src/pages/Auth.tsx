import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Mail, Lock, User } from "lucide-react";

const ALLOWED_REDIRECT_TARGETS = new Set([
  "dashboard",
  "profile",
  "vacatures",
  "events",
  "opleidingen",
  "kennisbank",
]);

const resolveRedirectTarget = (
  redirectTarget: string | null,
  fallbackTarget = "dashboard"
) => {
  if (!redirectTarget) {
    return fallbackTarget;
  }

  const normalizedTarget = redirectTarget.replace(/^\/+|\/+$/g, "");

  return ALLOWED_REDIRECT_TARGETS.has(normalizedTarget)
    ? normalizedTarget
    : fallbackTarget;
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const redirectTo = resolveRedirectTarget(searchParams.get("redirect"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Inloggen mislukt",
            description: error.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // Wait a moment for auth state to update, then get user and roles
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roles, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          
          if (rolesError) {
            console.error("Error fetching roles:", rolesError);
          }
          
          const isAdvisorOrAdmin = roles?.some(
            (r) => r.role === "advisor" || r.role === "admin"
          );

          toast({
            title: "Welkom terug!",
            description: "Je bent succesvol ingelogd.",
          });

          // Redirect based on role or original destination
          if (isAdvisorOrAdmin) {
            navigate("/backoffice", { replace: true });
          } else {
            navigate("/" + redirectTo, { replace: true });
          }
        } else {
          // Fallback if user not found immediately
          toast({
            title: "Welkom terug!",
            description: "Je bent succesvol ingelogd.",
          });
          navigate("/" + redirectTo, { replace: true });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast({
            title: "Registratie mislukt",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Controleer je email",
            description: "We hebben je een verificatielink gestuurd.",
          });
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      toast({
        title: "Er ging iets mis",
        description: "Probeer het later opnieuw.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md px-4">
          <div className="bg-white border border-border rounded-lg p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-primary rounded-full p-2">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {isLogin ? "Inloggen" : "Account aanmaken"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isLogin
                    ? "Log in om verder te gaan met je oriëntatie"
                    : "Start je reis naar het leraarschap"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="jouw@email.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  "Even geduld..."
                ) : (
                  <>
                    {isLogin ? "Inloggen" : "Account aanmaken"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin
                  ? "Nog geen account? Maak er een aan"
                  : "Al een account? Log in"}
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Na registratie word je begeleid door <strong>DOORai</strong>, jouw
              persoonlijke assistent op weg naar het leraarschap.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
