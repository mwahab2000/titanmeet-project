import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export const LandingNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-[hsl(var(--landing-border)/0.3)] bg-[hsl(var(--landing-bg)/0.85)] backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="TitanMeet" className="h-8 w-8" />
          <span className="font-display text-xl font-bold gradient-titan-text">TitanMeet</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-[hsl(var(--landing-fg-muted))] transition-colors hover:text-[hsl(var(--landing-fg))]">{link.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="text-[hsl(var(--landing-fg)/0.6)] hover:text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.1)]" />
          <Button className="hidden gradient-titan border-0 text-white font-semibold md:inline-flex" asChild>
            <Link to="/login?tab=signup">Get Started</Link>
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.1)]">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-[hsl(var(--landing-bg))] border-[hsl(var(--landing-border)/0.1)] text-[hsl(var(--landing-fg))] p-0">
              <div className="flex flex-col gap-1 p-6 pt-12">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-base font-medium text-[hsl(var(--landing-fg-muted))] transition-colors hover:bg-[hsl(var(--landing-fg)/0.1)] hover:text-[hsl(var(--landing-fg))]">{link.label}</a>
                ))}
                <div className="mt-4 pt-4 border-t border-[hsl(var(--landing-border)/0.3)]">
                  <Button className="w-full gradient-titan border-0 text-white font-semibold" asChild>
                    <Link to="/login?tab=signup" onClick={() => setMobileOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};
