import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Shared test info content blocks (reused by TestInfoModal)
export const TEST_INFO_BLOCKS = {
  intro: {
    title: "Hallo, Welkom bij Door010",
    text: "Jouw gids naar een carrière in het onderwijs. Deze omgeving is bedoeld om de chatbot te testen binnen de afgesproken kaders.",
  },
  whatToTest: {
    title: "Wat test je hier",
    text: `Deze site bevat twee AI modules:

1. De widget op de homepage (zichtbaar als je uitgelogd bent)
2. De assistent na inloggen (volledige versie)

Let op: zodra je inlogt verdwijnt de homepage widget. Als je uitlogt verschijnt de widget weer.`,
  },
  abTest: {
    title: "Wat is dit",
    text: "Dit is variant B van de DoorAI chatbot. Je test of de AI binnen de afgesproken kaders blijft, aansluit bij de fase van de gebruiker en bijdraagt aan de gezamenlijke doelen.",
  },
  testPoints: {
    title: "Let bij het testen op",
    text: `1. Rolvastheid: blijft de AI binnen de informatierol? Doet de AI geen toezeggingen of schijnzekerheid?
2. Fasegevoeligheid: sluit de AI aan bij waar de gebruiker zich bevindt? Informeert zonder te sturen?
3. Betrouwbaarheid: is het gedrag consistent en ondersteunend voor professioneel gebruik?
4. Tone of voice: Hoe ervaar je het gesprek met DoorAI, sluit dit aan bij wat wenselijk / verwacht wordt?`,
  },
  reminders: {
    title: "Vergeet niet",
    text: "Raadpleeg het kaderdocument dat je per mail hebt ontvangen voor de volledige testinstructies. Vul na het testen de enquête in (link via mail).",
  },
  otherVariant: {
    title: "Test ook de andere variant",
    text: "Link naar variant A volgt nog per mail.",
  },
  session: {
    title: "Werksessie",
    text: "23 februari, 13:00 tot 14:00 uur. Deze testomgeving is vertrouwelijk.",
  },
  placeholders: {
    title: "Belangrijk over deze testsite",
    text: "Sommige onderdelen op deze site zijn nog dummy of placeholders (zoals bepaalde doorverwijzingen, content of knoppen). Dat is bewust in deze testomgeving. Focus in je test vooral op het gedrag, de fase-aansluiting en de toon van de AI.",
  },
};

function getAssignedAccount(): { email: string; index: string } {
  let index = localStorage.getItem("doorai_test_account_index");
  if (!index) {
    index = String(Math.floor(Math.random() * 49) + 2); // 2-50
    localStorage.setItem("doorai_test_account_index", index);
  }
  return { email: `test${index}@doorai.nl`, index };
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground whitespace-pre-line">{text}</p>
    </div>
  );
}

export { InfoBlock };

export function TestOnboardingPopup() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const account = getAssignedAccount();
  const password = "admin010";

  useEffect(() => {
    const seen = localStorage.getItem("doorai_onboarding_seen");
    if (seen !== "true" && !user) {
      setOpen(true);
    }
  }, [user]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await signIn(account.email, password);
    if (error) {
      toast.error("Inloggen mislukt. Neem contact op met de testcoördinator.");
      setLoading(false);
      return;
    }
    localStorage.setItem("doorai_onboarding_seen", "true");
    setOpen(false);
    navigate("/dashboard");
  };

  if (!open) return null;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6 space-y-5">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-foreground">
                Welkom bij de A/B-test DoorAI
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">
                Dit is een testomgeving voor de werkgroep. Geen productieversie.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4">
              <InfoBlock {...TEST_INFO_BLOCKS.intro} />
              <InfoBlock {...TEST_INFO_BLOCKS.whatToTest} />
              <InfoBlock {...TEST_INFO_BLOCKS.abTest} />
              <InfoBlock {...TEST_INFO_BLOCKS.testPoints} />
              <InfoBlock {...TEST_INFO_BLOCKS.reminders} />
              <InfoBlock {...TEST_INFO_BLOCKS.otherVariant} />
              <InfoBlock {...TEST_INFO_BLOCKS.session} />
              <InfoBlock {...TEST_INFO_BLOCKS.placeholders} />

              {/* Blok 5: Login credentials */}
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Jouw testlogin</h3>
                <p className="text-xs text-muted-foreground">
                  Gebruik deze gegevens om direct in te loggen. Bewaar ze eventueel in je wachtwoordmanager.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-background border border-border px-3 py-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Email</span>
                      <p className="text-sm font-mono font-medium text-foreground">{account.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(account.email, "email")}
                    >
                    {copiedField === "email" ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-background border border-border px-3 py-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Wachtwoord</span>
                      <p className="text-sm font-mono font-medium text-foreground">{password}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(password, "password")}
                    >
                    {copiedField === "password" ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inloggen...
                </>
              ) : (
                "Start met testen (log in)"
              )}
            </Button>
          </div>
        </ScrollArea>
      </AlertDialogContent>
    </AlertDialog>
  );
}
