import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { UpgradeModalProvider } from "@/hooks/useUpgradeModal";
import UpgradeModal from "@/components/billing/UpgradeModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { EventWorkspaceLayout } from "@/components/dashboard/EventWorkspaceLayout";
import { getClientSlugFromHostname } from "@/lib/subdomain";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import CreateEvent from "./pages/CreateEvent";
import QuickEventWizard from "./pages/QuickEventWizard";
import DraftsPage from "./pages/DraftsPage";
import TemplatesPage from "./pages/TemplatesPage";
import CreateClient from "./pages/CreateClient";
import EditClient from "./pages/EditClient";
import ClientsPage from "./pages/ClientsPage";
import Attendees from "./pages/Attendees";
import DashboardSettings from "./pages/DashboardSettings";
import BillingPage from "./pages/BillingPage";
import AdminBillingPage from "./pages/AdminBillingPage";
import SupportPage from "./pages/SupportPage";
import SupportTicketDetail from "./pages/SupportTicketDetail";
import AdminSupportPage from "./pages/AdminSupportPage";
import NotFound from "./pages/NotFound";
import NotificationsPage from "./pages/NotificationsPage";
import HeroSection from "./pages/workspace/HeroSection";
import EventInfoSection from "./pages/workspace/EventInfoSection";
import AgendaSection from "./pages/workspace/AgendaSection";
import OrganizersSection from "./pages/workspace/OrganizersSection";
import SpeakersSection from "./pages/workspace/SpeakersSection";
import AttendeesSection from "./pages/workspace/AttendeesSection";
import GroupsSection from "./pages/workspace/GroupsSection";
import AssignGroupsSection from "./pages/workspace/AssignGroupsSection";
import TransportationSection from "./pages/workspace/TransportationSection";
import VenueSection from "./pages/workspace/VenueSection";
import AnnouncementsSection from "./pages/workspace/AnnouncementsSection";
import EventAnnouncementsSection from "./pages/workspace/EventAnnouncementsSection";
import SurveySection from "./pages/workspace/SurveySection";
import CommunicationsSection from "./pages/workspace/CommunicationsSection";
import WebsiteSection from "./pages/workspace/WebsiteSection";
import DressCodeSection from "./pages/workspace/DressCodeSection";
import GallerySection from "./pages/workspace/GallerySection";
import PreviewEventPage from "./pages/workspace/PreviewEventPage";
import PublicEventPage from "./pages/public/PublicEventPage";
import SubdomainEventPage from "./pages/public/SubdomainEventPage";
import PublicSurveyPage from "./pages/public/PublicSurveyPage";
import InviteLandingPage from "./pages/public/InviteLandingPage";
import RsvpConfirmationPage from "./pages/public/RsvpConfirmationPage";

const queryClient = new QueryClient();

/**
 * Detect whether the current hostname is a client subdomain.
 * If so, we render subdomain-based public routes instead of the main app.
 */
const subdomainClient = getClientSlugFromHostname();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" storageKey="titanmeet-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {subdomainClient ? (
            /* ── Subdomain mode: clientslug.titanmeet.com ── */
            <Routes>
              <Route path="/:eventSlug" element={<SubdomainEventPage clientSlug={subdomainClient} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          ) : (
            /* ── Main domain / local dev ── */
            <AuthProvider>
              <UpgradeModalProvider>
                <UpgradeModal />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="events" element={<Events />} />
                    <Route path="events/new" element={<CreateEvent />} />
                    <Route path="events/quick-setup" element={<QuickEventWizard />} />
                    <Route path="events/drafts" element={<DraftsPage />} />
                    <Route path="clients" element={<ClientsPage />} />
                    <Route path="clients/new" element={<CreateClient />} />
                    <Route path="clients/:clientId/edit" element={<EditClient />} />
                    <Route path="templates" element={<TemplatesPage />} />
                    <Route path="attendees" element={<Attendees />} />
                    <Route path="settings" element={<DashboardSettings />} />
                    <Route path="billing" element={<BillingPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="support" element={<SupportPage />} />
                    <Route path="support/:ticketId" element={<SupportTicketDetail />} />
                    <Route path="admin/billing" element={<AdminRoute><AdminBillingPage /></AdminRoute>} />
                    <Route path="admin/support" element={<AdminRoute><AdminSupportPage /></AdminRoute>} />
                    
                    <Route path="events/:id" element={<EventWorkspaceLayout />}>
                      <Route path="hero" element={<HeroSection />} />
                      <Route path="info" element={<EventInfoSection />} />
                      <Route path="agenda" element={<AgendaSection />} />
                      <Route path="organizers" element={<OrganizersSection />} />
                      <Route path="speakers" element={<SpeakersSection />} />
                      <Route path="attendees" element={<AttendeesSection />} />
                      <Route path="groups" element={<GroupsSection />} />
                      <Route path="assign-groups" element={<AssignGroupsSection />} />
                      <Route path="transportation" element={<TransportationSection />} />
                      <Route path="dress-code" element={<DressCodeSection />} />
                      <Route path="gallery" element={<GallerySection />} />
                      <Route path="venue" element={<VenueSection />} />
                      <Route path="announcements" element={<AnnouncementsSection />} />
                      <Route path="event-announcements" element={<EventAnnouncementsSection />} />
                      <Route path="survey" element={<SurveySection />} />
                      <Route path="communications" element={<CommunicationsSection />} />
                      <Route path="website" element={<WebsiteSection />} />
                    </Route>
                  </Route>
                  <Route path="/dashboard/events/:id/preview" element={<ProtectedRoute><PreviewEventPage /></ProtectedRoute>} />
                  <Route path="/s/:token" element={<PublicSurveyPage />} />
                  <Route path="/i/:token" element={<InviteLandingPage />} />
                  <Route path="/rsvp/confirmed" element={<RsvpConfirmationPage />} />
                  <Route path="/rsvp/already-confirmed" element={<RsvpConfirmationPage />} />
                  <Route path="/rsvp/invalid" element={<RsvpConfirmationPage />} />
                  <Route path="/:clientSlug/:eventSlug" element={<PublicEventPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </UpgradeModalProvider>
            </AuthProvider>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
