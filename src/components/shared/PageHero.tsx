import { motion } from "framer-motion";
import { ReactNode } from "react";
import rotterdamSkyline from "@/assets/rotterdam-skyline.jpeg";

interface PageHeroProps {
  title: string;
  titleHighlight?: string;
  subtitle: string;
  children?: ReactNode;
  variant?: "primary" | "image";
  imageUrl?: string;
}

export function PageHero({ 
  title, 
  titleHighlight, 
  subtitle, 
  children,
  variant = "primary",
  imageUrl
}: PageHeroProps) {
  const backgroundImage = imageUrl || rotterdamSkyline;
  if (variant === "image") {
    return (
      <section className="relative min-h-[40vh] flex items-center">
        {/* Background image */}
        <div className="absolute inset-0 -z-10">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 via-50% to-white" />
        </div>

        <div className="container py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight uppercase tracking-tight">
              {titleHighlight ? (
                <>
                  <span className="bg-white text-foreground px-2 inline-block mb-2">{title}</span>{" "}
                  <span className="bg-primary text-primary-foreground px-2 inline-block">{titleHighlight}</span>
                </>
              ) : (
                <span className="bg-primary text-primary-foreground px-2 inline-block">{title}</span>
              )}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-lg md:text-xl text-white/90 max-w-2xl"
            >
              {subtitle}
            </motion.p>
            {children && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-6"
              >
                {children}
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-primary py-12 md:py-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl md:text-4xl font-bold text-primary-foreground mb-4 uppercase tracking-tight">
            {titleHighlight ? (
              <>
                <span className="bg-white text-foreground px-2 inline-block mb-2">{title}</span>{" "}
                <span>{titleHighlight}</span>
              </>
            ) : (
              title
            )}
          </h1>
          <p className="text-primary-foreground/90 max-w-2xl text-lg">
            {subtitle}
          </p>
          {children && <div className="mt-6">{children}</div>}
        </motion.div>
      </div>
    </section>
  );
}
