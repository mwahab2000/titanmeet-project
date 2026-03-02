import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, PanelLeft, QrCode, BarChart3, Image, Mail, Check, Menu } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

const features = [
  { icon: Users, title: "Clients Workspace", description: "Organize multiple clients into dedicated workspaces. Keep data, branding, and assets separate and secure." },
  { icon: PanelLeft, title: "Sidebar Editor", description: "Intuitive drag-and-drop site builder that lives in your sidebar. Live preview your changes instantly." },
  { icon: QrCode, title: "RSVP Tracking", description: "Real-time attendance tracking with QR code check-ins and automatic confirmation emails." },
  { icon: BarChart3, title: "Surveys & Analytics", description: "Post-event feedback collection with automated sentiment analysis and visual report generation." },
  { icon: Image, title: "Media Gallery", description: "Optimized media library for event photos and videos. Fast delivery via our global CDN." },
  { icon: Mail, title: "Email Health", description: "Monitor your deliverability scores. Get alerts for bounces and maintain a high sender reputation." },
];

const faqs = [
  { q: 'What counts as an "active event"?', a: "An active event is any site currently published and accepting RSVPs. Drafts and past archived events do not count against your limit." },
  { q: "Can I manage multiple clients?", a: "Yes! Our multi-tenant architecture is built specifically for agencies. You can create isolated workspaces for different clients under a single login." },
  { q: "How customizable are the pages?", a: "You have full control over branding, colors, fonts, and layout. You can also inject custom CSS and JavaScript if you need extra flexibility." },
  { q: "What happens if I exceed my limits?", a: "We won't shut you down. If you go over your event or storage limits, you'll be billed at the standard overage rate on your next cycle." },
  { q: "Are RSVPs and surveys unlimited?", a: "Yes, we do not charge per RSVP or survey response. Scale your guest list as much as you need without extra costs." },
  { q: "Can I export my data?", a: "Absolutely. You can export guest lists, survey results, and analytics as CSV or PDF at any time." },
];

const pricing = [
  {
    name: "Starter",
    price: "$15",
    desc: "Perfect for individuals launching their first few events.",
    features: ["3 clients", "10 active events", "10 GB storage"],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Growth",
    price: "$75",
    desc: "Designed for growing agencies and frequent organizers.",
    features: ["10 clients", "50 active events", "50 GB storage", "Priority support"],
    cta: "Get Started Now",
    popular: true,
  },
  {
    name: "Business",
    price: "$299",
    desc: "Enterprise-grade volume for large-scale operations.",
    features: ["50 clients", "200 active events", "200 GB storage", "White-labeling"],
    cta: "Contact Sales",
    popular: false,
  },
];

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const Index = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const featuresRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const faqRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen bg-[hsl(var(--landing-bg))] text-[hsl(var(--landing-fg))] font-sans">
      {/* Navbar */}
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

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.1)]">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-[hsl(var(--landing-bg))] border-[hsl(var(--landing-border)/0.1)] text-[hsl(var(--landing-fg))] p-0">
                <div className="flex flex-col gap-1 p-6 pt-12">
                  {navLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-4 py-3 text-base font-medium text-[hsl(var(--landing-fg-muted))] transition-colors hover:bg-[hsl(var(--landing-fg)/0.1)] hover:text-[hsl(var(--landing-fg))]"
                    >
                      {link.label}
                    </a>
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

      {/* Hero */}
      <section className="relative flex min-h-screen items-center pt-16">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-[hsl(var(--titan-green)/var(--landing-glow-opacity))] blur-[120px]" />
          <div className="absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[hsl(var(--titan-blue)/var(--landing-glow-opacity))] blur-[120px]" />
        </div>
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--landing-border)/0.3)] bg-[hsl(var(--landing-fg)/0.05)] px-4 py-1.5 text-sm text-[hsl(var(--landing-fg-muted))]">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--titan-green))]" />
              V2.0 is now live
            </div>
            <h1 className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Build premium event sites{" "}
              <span className="gradient-titan-text">in minutes.</span>
            </h1>
            <p className="mb-8 text-lg text-[hsl(var(--landing-fg-muted))] md:text-xl max-w-2xl mx-auto">
              The all-in-one multi-tenant platform for event managers. Manage workspaces, RSVPs, surveys, and high-quality media assets from a single centralized dashboard.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="gradient-titan border-0 text-white px-8 text-base font-semibold" asChild>
                <Link to="/login?tab=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="border-[hsl(var(--landing-border)/0.4)] bg-transparent text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.1)] px-8 text-base" asChild>
                <a href="#features">View Demo</a>
              </Button>
            </div>
          </div>

          {/* Mock Dashboard Preview */}
          <div className="mt-16 mx-auto max-w-4xl animate-float">
            <div className="glass-card-landing rounded-xl p-6 border border-[hsl(var(--landing-border)/0.3)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
                <span className="ml-4 text-xs text-[hsl(var(--landing-fg-muted)/0.6)]">titanmeet.io/admin/workspace-alpha</span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-3">
                  {["Dashboard", "Events", "Attendees", "Settings"].map((item) => (
                    <div key={item} className="h-8 rounded-lg bg-[hsl(var(--landing-fg)/0.06)] flex items-center px-3 text-xs text-[hsl(var(--landing-fg-muted)/0.6)]">{item}</div>
                  ))}
                </div>
                <div className="col-span-3 space-y-3">
                  <div className="h-8 rounded-lg bg-[hsl(var(--landing-fg)/0.06)]" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-24 rounded-lg bg-[hsl(var(--landing-fg)/0.06)]" />
                    <div className="h-24 rounded-lg bg-[hsl(var(--landing-fg)/0.06)]" />
                    <div className="h-24 rounded-lg bg-[hsl(var(--titan-green)/0.1)] border border-[hsl(var(--titan-green)/0.2)]" />
                  </div>
                  <div className="h-32 rounded-lg bg-[hsl(var(--landing-fg)/0.06)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 scroll-reveal bg-[hsl(var(--landing-bg-alt))]" ref={featuresRef}>
        <div className="container">
          <div className="mb-4 text-center">
            <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Features</span>
          </div>
          <div className="mb-4 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Enterprise features for everyone</h2>
          </div>
          <p className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-16">
            Scaling your event management business requires tools that handle the complexity so you can focus on the experience.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={f.title} className={`glass-card-landing rounded-xl p-6 border border-[hsl(var(--landing-border)/0.3)] transition-all duration-300 hover:border-[hsl(var(--landing-border)/0.5)] scroll-reveal scroll-reveal-delay-${i + 1}`}>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[hsl(var(--titan-green)/0.1)]">
                  <f.icon className="h-6 w-6 text-[hsl(var(--titan-green))]" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-[hsl(var(--landing-fg-muted))]">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 scroll-reveal" ref={pricingRef}>
        <div className="container">
          <div className="mb-4 text-center">
            <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Pricing</span>
          </div>
          <div className="mb-4 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Simple, transparent pricing</h2>
          </div>
          <p className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-16">
            Choose the plan that fits your current volume and scale as you grow.
          </p>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`glass-card-landing rounded-xl p-8 border transition-all duration-300 relative ${
                  plan.popular ? "border-[hsl(var(--titan-green)/0.5)] scale-105" : "border-[hsl(var(--landing-border)/0.3)]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-titan px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="font-display text-xl font-semibold mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="text-[hsl(var(--landing-fg-muted))]">/mo</span>
                </div>
                <p className="text-sm text-[hsl(var(--landing-fg-muted))] mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm text-[hsl(var(--landing-fg-muted))]">
                      <Check className="h-4 w-4 text-[hsl(var(--titan-green))]" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full font-semibold ${
                    plan.popular
                      ? "gradient-titan border-0 text-white"
                      : "bg-[hsl(var(--landing-fg)/0.1)] text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.2)] border-0"
                  }`}
                  asChild
                >
                  <Link to="/login?tab=signup">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[hsl(var(--landing-fg-muted)/0.6)] mt-8">
            * Overage fees apply for additional events ($2/event) or storage ($5/10GB)
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 scroll-reveal bg-[hsl(var(--landing-bg-alt))]" ref={faqRef}>
        <div className="container max-w-3xl">
          <div className="mb-4 text-center">
            <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">FAQ</span>
          </div>
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Frequently Asked Questions</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] px-6">
                <AccordionTrigger className="text-left font-medium text-[hsl(var(--landing-fg))] hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-[hsl(var(--landing-fg-muted))]">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 scroll-reveal" ref={ctaRef}>
        <div className="container">
          <div className="mx-auto max-w-3xl rounded-2xl gradient-titan p-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-white">Ready to launch your next event?</h2>
            <p className="mb-8 text-white/80">
              Join 2,000+ event organizers who trust TitanMeet for their premium event experiences.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="bg-white text-[hsl(222,47%,11%)] hover:bg-white/90 px-8 font-semibold border-0" asChild>
                <Link to="/login?tab=signup">Start Your Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 px-8" asChild>
                <a href="#pricing">Contact Sales</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-white/50">No credit card required for trial.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--landing-border)/0.3)] py-16">
        <div className="container">
          <div className="grid gap-12 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={logo} alt="TitanMeet" className="h-8 w-8" />
                <span className="font-display text-lg font-bold gradient-titan-text">TitanMeet</span>
              </div>
              <p className="text-sm text-[hsl(var(--landing-fg-muted))]">Making premium event management accessible, secure, and blazing fast.</p>
            </div>
            {[
              { title: "Product", links: ["Features", "Roadmap", "Templates", "API"] },
              { title: "Company", links: ["About Us", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-display font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-[hsl(var(--landing-fg-muted)/0.7)] hover:text-[hsl(var(--landing-fg))] transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[hsl(var(--landing-border)/0.3)] pt-8 sm:flex-row">
            <p className="text-xs text-[hsl(var(--landing-fg-muted)/0.6)]">© 2026 TitanMeet Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-[hsl(var(--landing-fg-muted)/0.6)] hover:text-[hsl(var(--landing-fg))] transition-colors text-sm">Twitter</a>
              <a href="#" className="text-[hsl(var(--landing-fg-muted)/0.6)] hover:text-[hsl(var(--landing-fg))] transition-colors text-sm">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
