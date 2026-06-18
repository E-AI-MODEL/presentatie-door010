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
import { ArrowRight, Mail, Lock, User, Sparkles, MapPin, GraduationCap } from "lucide-react";
import heroBanner from "@/assets/profile-hero-banner.jpg";

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
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 flex items-stretch">
        <div className="w-full grid lg:grid-cols-2 gap-0 lg:gap-8 lg:p-8 lg:max-w-6xl lg:mx-auto">
          {/* Left visual panel - hidden on mobile, banner-style on tablet, full panel on desktop */}
          <aside className="hidden lg:flex relative rounded-3xl overflow-hidden bg-card shadow-door">
            <img
              src={heroBanner}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/40 to-transparent" />
            <div className="relative mt-auto p-8 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <MapPin className="h-3 w-3" />
                ​
              </div>
              <h2 className="text-3xl font-bold text-foreground leading-tight">
                Jouw eerste stap naar het onderwijs.
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Persoonlijk begeleid door DoorAI, met slimme tools die je verder helpen — van eerste vraag tot je eerste lesdag.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-xs text-foreground">AI-coach 24/7</span>
                </div>
                <div className="flex items-start gap-2">
                  <GraduationCap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-xs text-foreground">PO, VO, MBO routes</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right form panel */}
          <section className="flex flex-col items-center justify-center py-8 px-4 lg:py-0">
            {/* Mobile/tablet top banner */}
            <div className="lg:hidden w-full max-w-md mb-6">
              <div className="relative h-32 rounded-3xl overflow-hidden shadow-door">
                <img
                  src={heroBanner}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="text-xs font-semibold text-foreground">​</p>
                  <p className="text-sm font-bold text-foreground">Jouw route naar het onderwijs</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-md">
              <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-door">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary rounded-2xl p-2.5">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">
                      {isLogin ? "Welkom terug" : "Start als kandidaat"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {isLogin
                        ? "Log in om verder te gaan"
                        : "Maak je gratis account aan"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
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

                  <Button type="submit" className="w-full rounded-2xl" disabled={loading}>
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
                  <p className="text-xs text-muted-foreground">
                    Demo-omgeving — alleen vooraf aangemaakte accounts kunnen inloggen.
                  </p>
                </div>
              </div>

              <div className="mt-6 text-center text-sm text-muted-foreground px-4">
                <p>
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
