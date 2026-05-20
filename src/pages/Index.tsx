import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { AIShowcaseSection } from "@/components/home/AIShowcaseSection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <AIShowcaseSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
