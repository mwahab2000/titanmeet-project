import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingCta, LandingFooter } from "@/components/landing/LandingCtaFooter";

const Index = () => (
  <div className="min-h-screen bg-[hsl(var(--landing-bg))] text-[hsl(var(--landing-fg))] font-sans">
    <LandingNav />
    <LandingHero />
    <LandingStats />
    <LandingFeatures />
    <LandingHowItWorks />
    <LandingPricing />
    <LandingFaq />
    <LandingCta />
    <LandingFooter />
  </div>
);

export default Index;
