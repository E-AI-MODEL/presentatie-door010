import { Link } from "react-router-dom";

const footerLinks = {
  ontdek: [
    { name: "Kennisbank", href: "/kennisbank" },
    { name: "Opleidingen", href: "/opleidingen" },
    { name: "Vacatures", href: "/vacatures" },
    { name: "Events", href: "/events" },
  ],
  route: [
    { name: "Account maken", href: "/auth" },
    { name: "Dashboard", href: "/dashboard" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 20L28 20M28 20L20 12M28 20L20 28" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M32 8L32 32" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium text-secondary-foreground/70 uppercase tracking-wider">Onderwijsloket</span>
                <span className="text-base font-bold text-primary uppercase tracking-tight">Rotterdam</span>
              </div>
            </Link>
            <p className="text-sm text-secondary-foreground/70 max-w-xs">
              Van eerste oriëntatie tot instroom in het onderwijs — persoonlijk begeleid door AI.
            </p>
          </div>

          {/* Ontdek */}
          <div>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide">Ontdek</h3>
            <ul className="space-y-2">
              {footerLinks.ontdek.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Jouw route */}
          <div>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide">Jouw route</h3>
            <ul className="space-y-2">
              {footerLinks.route.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-secondary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-secondary-foreground/50">
            © {new Date().getFullYear()} Onderwijsloket Rotterdam. Alle rechten voorbehouden.
          </p>
        </div>
      </div>
    </footer>
  );
}
