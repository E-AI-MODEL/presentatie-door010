import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import rotterdamSkyline from "@/assets/rotterdam-skyline.jpeg";

export function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-start">
      {/* Background image - Rotterdam Erasmusbrug skyline */}
      <div className="absolute inset-0 -z-10">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${rotterdamSkyline})`,
          }}
        />
        {/* Gradient overlay - sharp at top, fading to white at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 via-50% to-white" />
      </div>

      <div className="container pt-10 md:pt-14 pb-20 md:pb-28">
        <div className="max-w-3xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-10 leading-tight uppercase tracking-tight"
          >
            <span className="bg-white text-foreground px-2 inline-block mb-2">ONTDEK</span>{" "}
            <span className="bg-primary text-primary-foreground px-2 inline-block mb-2">JOUW ROUTE</span>{" "}
            <span className="bg-white text-foreground px-2 inline-block">NAAR HET ONDERWIJS</span>
          </motion.h1>

          {/* CTA Buttons - styled like onderwijsloketrotterdam.nl */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-start gap-3 mt-16 md:mt-24"
          >
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
              asChild
            >
              <Link to="/auth">
                Je eerste stap richting het Rotterdamse onderwijs
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
