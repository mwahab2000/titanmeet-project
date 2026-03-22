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
import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

// ── Eagerly loaded (critical path) ────────────────────────────
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// ── Public pages (lazy — visited by external users) ───────────
const PublicEventPage = lazy(() => import("./pages/public/PublicEventPage"));
const SubdomainEventPage = lazy(() => import("./pages/public/SubdomainEventPage"));
const ClientLandingPage = lazy(() => import("./pages/public/ClientLandingPage"));
const PublicSurveyPage = lazy(() => import("./pages/public/PublicSurveyPage"));
const InviteLandingPage = lazy(() => import("./pages/public/InviteLandingPage"));

// ── Dashboard pages (lazy — behind auth) ──────────────────────
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Events = lazy(() => import("./pages/Events"));
const CreateEvent = lazy(() => import("./pages/CreateEvent"));
const QuickEventWizard = lazy(() => import("./pages/QuickEventWizard"));
const DraftsPage = lazy(() => import("./pages/DraftsPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const CreateClient = lazy(() => import("./pages/CreateClient"));
const EditClient = lazy(() => import("./pages/EditClient"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const Attendees = lazy(() => import("./pages/Attendees"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const AdminBillingPage = lazy(() => import("./pages/AdminBillingPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const SupportTicketDetail = lazy(() => import("./pages/SupportTicketDetail"));
const AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AIBuilderPage = lazy(() => import("./pages/AIBuilderPage"));

// ── Event workspace sections (lazy — deep workspace pages) ────
const HeroSection = lazy(() => import("./pages/workspace/HeroSection"));
const EventInfoSection = lazy(() => import("./pages/workspace/EventInfoSection"));
const AgendaSection = lazy(() => import("./pages/workspace/AgendaSection"));
const OrganizersSection = lazy(() => import("./pages/workspace/OrganizersSection"));
const SpeakersSection = lazy(() => import("./pages/workspace/SpeakersSection"));
const AttendeesSection = lazy(() => import("./pages/workspace/AttendeesSection"));
const GroupsSection = lazy(() => import("./pages/workspace/GroupsSection"));
const AssignGroupsSection = lazy(() => import("./pages/workspace/AssignGroupsSection"));
const TransportationSection = lazy(() => import("./pages/workspace/TransportationSection"));
const VenueSection = lazy(() => import("./pages/workspace/VenueSection"));
const AnnouncementsSection = lazy(() => import("./pages/workspace/AnnouncementsSection"));
const EventAnnouncementsSection = lazy(() => import("./pages/workspace/EventAnnouncementsSection"));
const SurveySection = lazy(() => import("./pages/workspace/SurveySection"));
const CommunicationsSection = lazy(() => import("./pages/workspace/CommunicationsSection"));
const WebsiteSection = lazy(() => import("./pages/workspace/WebsiteSection"));
const DressCodeSection = lazy(() => import("./pages/workspace/DressCodeSection"));
const GallerySection = lazy(() => import("./pages/workspace/GallerySection"));
const PreviewEventPage = lazy(() => import("./pages/workspace/PreviewEventPage"));
const AnalyticsSection = lazy(() => import("./pages/workspace/AnalyticsSection"));

const queryClient = new QueryClient();

const subdomainClient = getClientSlugFromHostname();

/** Minimal loading fallback for lazy routes */
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="titanmeet-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
            {subdomainClient ? (
              <Routes>
                <Route path="/" element={<ClientLandingPage clientSlug={subdomainClient} />} />
                <Route path="/:eventSlug" element={<SubdomainEventPage clientSlug={subdomainClient} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            ) : (
              <AuthProvider>
                <UpgradeModalProvider>
                  <UpgradeModal />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                      <Route index element={<Dashboard />} />
                      <Route path="ai-builder" element={<AIBuilderPage />} />
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
                    <Route path="/:clientSlug/:eventSlug" element={<PublicEventPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </UpgradeModalProvider>
              </AuthProvider>
            )}
          </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
