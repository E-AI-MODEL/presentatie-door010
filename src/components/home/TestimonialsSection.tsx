import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const testimonials = [
  {
    quote: "Dankzij het onderwijsloket heb ik precies de juiste stappen kunnen zetten om zij-instromer te worden. De begeleiding hielp me bij elke vraag.",
    author: "Maria van der Berg",
    role: "Zij-instromer Wiskunde",
    sector: "Voortgezet onderwijs",
  },
  {
    quote: "Het platform gaf mij direct inzicht in alle vacatures die bij mijn profiel pasten. Binnen twee maanden had ik een baan.",
    author: "Thomas de Vries",
    role: "Docent Basisonderwijs",
    sector: "Primair onderwijs",
  },
  {
    quote: "De combinatie van leren en werken gaf me meteen het gevoel: dit is waar ik thuishoor.",
    author: "Sophie Janssen",
    role: "Student Pabo",
    sector: "Primair onderwijs",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 md:py-24 bg-muted">
      <div className="container">
        <div className="flex items-center gap-3 mb-4">
          <ArrowRight className="h-8 w-8 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            <span className="text-primary">ERVARINGEN</span> VAN LERAREN
          </h2>
        </div>
        
        <p className="text-muted-foreground mb-12 max-w-2xl">
          Laat je inspireren door mensen die de stap naar het onderwijs al maakten. 
          Lees hun verhalen vol ervaringen, twijfels én successen.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white border border-border rounded overflow-hidden"
            >
              {/* Quote mark */}
              <div className="p-6">
                <span className="text-5xl text-primary font-serif leading-none">"</span>
                
                <blockquote className="text-foreground mt-2 mb-6 leading-relaxed">
                  {testimonial.quote}
                </blockquote>

                {/* Author info */}
                <div className="border-t border-border pt-4">
                  <div className="font-semibold text-foreground">{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  <div className="text-xs text-primary font-medium mt-1 uppercase tracking-wide">
                    {testimonial.sector}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
