import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingAIShowcase } from "@/components/landing/LandingAIShowcase";
import { LandingProblemSolution } from "@/components/landing/LandingProblemSolution";
import { LandingValuePillars } from "@/components/landing/LandingValuePillars";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingAnalytics } from "@/components/landing/LandingAnalytics";
import { LandingCommunication } from "@/components/landing/LandingCommunication";
import { LandingTrust } from "@/components/landing/LandingTrust";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingCta, LandingFooter } from "@/components/landing/LandingCtaFooter";

const Index = () => (
  <div className="min-h-screen bg-[hsl(var(--landing-bg))] text-[hsl(var(--landing-fg))] font-sans">
    <LandingNav />
    <LandingHero />
    <LandingAIShowcase />
    <LandingProblemSolution />
    <LandingValuePillars />
    <LandingHowItWorks />
    <LandingAnalytics />
    <LandingCommunication />
    <LandingTrust />
    <LandingPricing />
    <LandingFaq />
    <LandingCta />
    <LandingFooter />
  </div>
);

export default Index;
