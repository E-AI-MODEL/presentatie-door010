import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, User, Shield, LogOut, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDemoLogin } from "@/hooks/useDemoLogin";

const navigation = [
  { name: "Ontdek het onderwijs", href: "/kennisbank" },
  { name: "Opleidingen", href: "/opleidingen" },
  { name: "Agenda", href: "/events" },
  { name: "Vacatures", href: "/vacatures" },
];

// Elegant DOORai hint - clickable to open chat widget
function DOORaiHint({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Elegant arrow icon matching the logo style */}
      <div className="flex items-center justify-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
          <motion.path 
            d="M14 20L22 20M22 20L18 16M22 20L18 24" 
            stroke="hsl(var(--primary))" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            animate={{ x: [0, 2, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
          <motion.circle 
            cx="28" 
            cy="20" 
            r="2" 
            fill="hsl(var(--primary))"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
        </svg>
      </div>
      <div className="flex flex-col leading-tight text-left">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hulp nodig?</span>
        <span className="text-lg font-bold text-primary uppercase tracking-tight">DOORai</span>
      </div>
    </motion.button>
  );
}

// Regular logo component
function RegularLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 20L28 20M28 20L20 12M28 20L20 28" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M32 8L32 32" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Onderwijsloket</span>
        <span className="text-lg font-bold text-primary uppercase tracking-tight">Rotterdam</span>
      </div>
    </div>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const { loginAsDemo, loading: demoLoading } = useDemoLogin();
  const navigate = useNavigate();
  const [showMascot, setShowMascot] = useState(false);
  const [isAdvisorOrAdmin, setIsAdvisorOrAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for unread advisor messages (punt 12)
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }

    const checkUnread = async () => {
      try {
        // Get user's conversations
        const { data: convs } = await supabase
          .from("conversations")
          .select("id")
          .eq("user_id", user.id);
        
        if (!convs || convs.length === 0) return;

        const convIds = convs.map(c => c.id);
        
        // Count advisor messages in last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .eq("role", "advisor")
          .gte("created_at", weekAgo.toISOString());

        setUnreadCount(count || 0);
      } catch {
        // Ignore errors
      }
    };

    checkUnread();
  }, [user]);

  // Check if user has advisor or admin role
  useEffect(() => {
    if (user) {
      checkUserRole();
    } else {
      setIsAdvisorOrAdmin(false);
    }
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (data) {
        const hasAccess = data.some(
          (r) => r.role === "advisor" || r.role === "admin"
        );
        setIsAdvisorOrAdmin(hasAccess);
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  // Show DOORai mascot every 5 minutes for 8 seconds (replaces logo)
  useEffect(() => {
    const showMascotAnimation = () => {
      setShowMascot(true);
      setTimeout(() => setShowMascot(false), 8000);
    };

    // Show after 30 seconds initially
    const initialTimeout = setTimeout(showMascotAnimation, 30000);
    
    // Then every 5 minutes
    const interval = setInterval(showMascotAnimation, 300000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <nav className="container flex h-16 items-center justify-between">
        {/* Logo / Mascot - animated swap */}
        <div className="flex items-center">
          <AnimatePresence mode="wait">
            {showMascot ? (
              <motion.div
                key="mascot"
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <DOORaiHint onClick={() => {
                  // Dispatch custom event to open chat widget
                  window.dispatchEvent(new CustomEvent('openDOORaiChat'));
                  setShowMascot(false);
                }} />
              </motion.div>
            ) : (
              <Link to="/">
                <motion.div
                  key="logo"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                >
                  <RegularLogo />
                </motion.div>
              </Link>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors uppercase tracking-wide"
            >
              {item.name}
            </Link>
          ))}
          {isAdvisorOrAdmin && (
            <Link
              to="/backoffice"
              className="px-4 py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors uppercase tracking-wide flex items-center gap-1"
            >
              <Shield className="h-4 w-4" />
              Backoffice
            </Link>
          )}
        </div>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Demo-omgeving</span>

          {!loading && (
            user ? (
              <>
                <Button size="sm" className="font-medium relative" asChild>
                  <Link to="/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Mijn hub
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={async () => { await signOut(); navigate("/"); }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="font-medium"
                  disabled={demoLoading}
                  onClick={() => loginAsDemo("/dashboard")}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {demoLoading ? "Bezig..." : "Inloggen"}
                </Button>
              </>

            )
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="lg:hidden p-2 text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Navigation — compact dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden absolute top-full right-4 z-50 w-64 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/10 overflow-hidden"
            >
              <nav className="flex flex-col py-1.5">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="px-4 py-2 text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                {isAdvisorOrAdmin && (
                  <Link
                    to="/backoffice"
                    className="px-4 py-2 text-sm text-accent hover:text-accent/80 hover:bg-accent/5 transition-colors flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Backoffice
                  </Link>
                )}
              </nav>
              {!loading && (
                <div className="py-1.5 border-t border-border/40">
                  {user ? (
                    <div className="flex flex-col">
                      <Link
                        to="/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-2 text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-2"
                      >
                        <User className="h-3.5 w-3.5" />
                        Mijn hub
                      </Link>
                      <button
                        type="button"
                        onClick={async () => { await signOut(); navigate("/"); setMobileMenuOpen(false); }}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2 text-left w-full"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Uitloggen
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="mx-4 my-1.5 w-[calc(100%-2rem)]"
                      disabled={demoLoading}
                      onClick={() => { loginAsDemo("/dashboard"); setMobileMenuOpen(false); }}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {demoLoading ? "Bezig..." : "Inloggen"}
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
