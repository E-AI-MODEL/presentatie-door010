import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ClipboardCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2,
  Sparkles,
  RotateCcw
} from "lucide-react";

interface InterestTestProps {
  userId: string;
  testCompleted: boolean;
  testResults: Record<string, unknown> | null;
  onTestComplete: (results: Record<string, unknown>) => void;
}

interface Question {
  id: string;
  question: string;
  options: { value: string; label: string; sectors: string[] }[];
}

const questions: Question[] = [
  {
    id: "age_group",
    question: "Met welke leeftijdsgroep werk je het liefst?",
    options: [
      { value: "jong", label: "Jonge kinderen (4-12 jaar)", sectors: ["po"] },
      { value: "tieners", label: "Tieners (12-18 jaar)", sectors: ["vo", "mbo"] },
      { value: "jongvolwassenen", label: "Jongvolwassenen (16-25 jaar)", sectors: ["mbo"] },
      { value: "extra_zorg", label: "Leerlingen met extra ondersteuningsbehoefte", sectors: ["so"] },
    ],
  },
  {
    id: "teaching_style",
    question: "Welke onderwijsstijl past het beste bij jou?",
    options: [
      { value: "speels", label: "Speels en creatief, veel variatie", sectors: ["po", "so"] },
      { value: "vakgericht", label: "Vakinhoudelijk diepgaand", sectors: ["vo"] },
      { value: "praktisch", label: "Praktijkgericht en beroepsvormend", sectors: ["mbo"] },
      { value: "individueel", label: "Individuele begeleiding en maatwerk", sectors: ["so"] },
    ],
  },
  {
    id: "motivation",
    question: "Wat motiveert jou het meest in het onderwijs?",
    options: [
      { value: "ontwikkeling", label: "De ontwikkeling van kinderen zien", sectors: ["po", "so"] },
      { value: "kennis", label: "Mijn vakkennis overdragen", sectors: ["vo"] },
      { value: "arbeidsmarkt", label: "Jongeren voorbereiden op de arbeidsmarkt", sectors: ["mbo"] },
      { value: "impact", label: "Verschil maken voor kwetsbare leerlingen", sectors: ["so"] },
    ],
  },
  {
    id: "work_environment",
    question: "In welke werkomgeving voel jij je het beste?",
    options: [
      { value: "klaslokaal", label: "Traditioneel klaslokaal met vaste groep", sectors: ["po", "vo"] },
      { value: "praktijk", label: "Praktijklokalen en werkplaatsen", sectors: ["mbo"] },
      { value: "klein", label: "Kleine groepen met intensieve begeleiding", sectors: ["so"] },
      { value: "afwisselend", label: "Afwisselend tussen theorie en praktijk", sectors: ["vo", "mbo"] },
    ],
  },
  {
    id: "skills",
    question: "Welke vaardigheid beschrijft jou het beste?",
    options: [
      { value: "creatief", label: "Creatief en geduldig", sectors: ["po", "so"] },
      { value: "analytisch", label: "Analytisch en vakinhoudelijk sterk", sectors: ["vo"] },
      { value: "praktisch", label: "Praktisch en resultaatgericht", sectors: ["mbo"] },
      { value: "empathisch", label: "Empathisch en flexibel", sectors: ["so"] },
    ],
  },
  {
    id: "challenge",
    question: "Welke uitdaging spreekt jou het meeste aan?",
    options: [
      { value: "basis", label: "Kinderen een sterke basis geven", sectors: ["po"] },
      { value: "examen", label: "Leerlingen naar hun examen begeleiden", sectors: ["vo"] },
      { value: "beroep", label: "Studenten klaarstomen voor een beroep", sectors: ["mbo"] },
      { value: "inclusie", label: "Inclusief onderwijs realiseren", sectors: ["so"] },
    ],
  },
  {
    id: "collaboration",
    question: "Hoe werk je het liefst samen?",
    options: [
      { value: "team", label: "In een hecht lerarenteam", sectors: ["po", "so"] },
      { value: "vaksectie", label: "Binnen een vaksectie", sectors: ["vo"] },
      { value: "bedrijven", label: "Met bedrijven en stagebegeleiders", sectors: ["mbo"] },
      { value: "zorgteam", label: "In een multidisciplinair zorgteam", sectors: ["so"] },
    ],
  },
  {
    id: "growth",
    question: "Waar zie je jezelf over 5 jaar?",
    options: [
      { value: "meester", label: "Als ervaren groepsleerkracht", sectors: ["po"] },
      { value: "specialist", label: "Als vakspecialist of sectieleider", sectors: ["vo"] },
      { value: "opleider", label: "Als praktijkopleider of trajectbegeleider", sectors: ["mbo"] },
      { value: "expert", label: "Als specialist in passend onderwijs", sectors: ["so"] },
    ],
  },
];

const sectorInfo: Record<string, { label: string; description: string }> = {
  po: { label: "Primair Onderwijs", description: "Basisschool (groep 1-8)" },
  vo: { label: "Voortgezet Onderwijs", description: "Middelbare school" },
  mbo: { label: "MBO", description: "Middelbaar beroepsonderwijs" },
  so: { label: "Speciaal Onderwijs", description: "Onderwijs voor leerlingen met extra ondersteuning" },
};

export function InterestTest({ 
  userId, 
  testCompleted, 
  testResults,
  onTestComplete 
}: InterestTestProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateResults = () => {
    const sectorScores: Record<string, number> = { po: 0, vo: 0, mbo: 0, so: 0 };
    
    Object.entries(answers).forEach(([questionId, answerValue]) => {
      const question = questions.find(q => q.id === questionId);
      const selectedOption = question?.options.find(o => o.value === answerValue);
      
      selectedOption?.sectors.forEach(sector => {
        sectorScores[sector] = (sectorScores[sector] || 0) + 1;
      });
    });

    const sortedSectors = Object.entries(sectorScores)
      .sort(([, a], [, b]) => b - a)
      .map(([sector, score]) => ({ sector, score }));

    return {
      answers,
      sectorScores,
      recommendedSector: sortedSectors[0]?.sector || 'onbekend',
      ranking: sortedSectors,
      completedAt: new Date().toISOString(),
    };
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const results = calculateResults();
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          test_completed: true,
          test_results: results,
          preferred_sector: results.recommendedSector
        })
        .eq('user_id', userId);

      if (error) throw error;

      onTestComplete(results);
      setIsOpen(false);
      toast({
        title: "Test voltooid!",
        description: `Op basis van je antwoorden past ${sectorInfo[results.recommendedSector]?.label} het beste bij jou.`,
      });
    } catch (error) {
      console.error('Error saving test results:', error);
      toast({
        title: "Opslaan mislukt",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startTest = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setIsOpen(true);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];
  const canProceed = answers[currentQ?.id];
  const isLastQuestion = currentQuestion === questions.length - 1;

  // Show results summary if test is completed
  if (testCompleted && testResults && !isOpen) {
    const results = testResults as { recommendedSector: string; ranking: { sector: string; score: number }[] };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Interessetest Voltooid
          </CardTitle>
          <CardDescription>
            Je aanbevolen onderwijssector
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-bold text-lg text-foreground">
              {sectorInfo[results.recommendedSector]?.label}
            </h3>
            <p className="text-sm text-muted-foreground">
              {sectorInfo[results.recommendedSector]?.description}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Alle sectoren op volgorde:</p>
            <div className="flex flex-wrap gap-2">
              {results.ranking?.map(({ sector, score }, index) => (
                <Badge 
                  key={sector} 
                  variant={index === 0 ? "default" : "outline"}
                  className={index === 0 ? "bg-primary" : ""}
                >
                  {index + 1}. {sectorInfo[sector]?.label} ({score})
                </Badge>
              ))}
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={startTest}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Test opnieuw doen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show start card if test not started
  if (!isOpen) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Interesse & Persoonlijkheidstest
          </CardTitle>
          <CardDescription>
            Ontdek welke onderwijssector het beste bij jou past
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Beantwoord {questions.length} vragen over je voorkeuren en ontdek welk type onderwijs 
            het beste aansluit bij jouw persoonlijkheid en ambities.
          </p>
          <Button onClick={startTest} className="w-full">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Start de test
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show test questions
  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Vraag {currentQuestion + 1} van {questions.length}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground"
            >
              Annuleren
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-lg font-medium mb-4">{currentQ.question}</h3>
            <div className="space-y-2">
              {currentQ.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleAnswer(currentQ.id, option.value)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    answers[currentQ.id] === option.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option.label}</span>
                    {answers[currentQ.id] === option.value && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            disabled={currentQuestion === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Vorige
          </Button>
          
          {isLastQuestion ? (
            <Button
              onClick={handleComplete}
              disabled={!canProceed || saving}
            >
              {saving ? "Opslaan..." : "Afronden"}
              <CheckCircle2 className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestion(prev => prev + 1)}
              disabled={!canProceed}
            >
              Volgende
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}