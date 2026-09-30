import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createBrowserRouter, RouterProvider, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PageLoader, PageLoadRecovery } from '@/components/PageLoader';

// Resilient lazy loader — catches chunk load failures (bad network, deploy race)
// and shows a reload prompt instead of white screen
function lazyPage(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    factory().catch(() => ({
      default: () => (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <PageLoadRecovery />
        </div>
      ),
    }))
  );
}

// Named export helper for modules that don't use default export
function lazyNamed<T extends Record<string, ComponentType<any>>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  return lazyPage(() => factory().then(m => ({ default: m[name] })));
}

// Lazy load all pages with error recovery
const Index = lazyPage(() => import("./pages/Index"));
const BibleQuizPage = lazyNamed(() => import("./pages/BibleQuizPage"), "BibleQuizPage");
const DiscipleQuizPage = lazyNamed(() => import("./pages/DiscipleQuizPage"), "DiscipleQuizPage");
const AdminPage = lazyNamed(() => import("./pages/AdminPage"), "AdminPage");
const CRMPage = lazyPage(() => import("./pages/CRMPage"));
const ChurchDevotionAdminPage = lazyPage(() => import('./pages/ChurchDevotionAdminPage'));
const AccessControlPage = lazyPage(() => import('./pages/AccessControlPage'));
const LifeGroupsPage = lazyPage(() => import('./pages/LifeGroupsPage'));
const PastoralPersonPage = lazyPage(() => import("./pages/PastoralPersonPage"));
const MePage = lazyPage(() => import("./pages/MePage"));
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'));
const MyActivityPage = lazyPage(() => import('./pages/MyActivityPage'));
const MySharingPage = lazyPage(() => import('./pages/MySharingPage'));
const SupportPage = lazyPage(() => import("./pages/SupportPage"));
const SupportSettingsPage = lazyPage(() => import("./pages/SupportPage").then(m => ({ default: m.SupportSettingsPage })));
const LoveJourneyPage = lazyPage(() => import("./pages/LoveJourneyPage"));
const MentoringPage = lazyPage(() => import('./pages/MentoringPage'));
const LoginPage = lazyPage(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazyPage(() => import("./pages/ResetPasswordPage"));
const WePlayPage = lazyNamed(() => import("./pages/WePlayPage"), "WePlayPage");
const IcebreakerPage = lazyNamed(() => import("./pages/IcebreakerPage"), "IcebreakerPage");
const GrouperPage = lazyNamed(() => import("./pages/GrouperPage"), "GrouperPage");
const PrayerWallPage = lazyPage(() => import("./pages/PrayerWallPage"));
const PublicWallsPage = lazyPage(() => import('./pages/PublicWallsPage'));
const DevotionWallPage = lazyPage(() => import("./pages/DevotionWallPage"));
const MessageCardPage = lazyPage(() => import("./pages/MessageCardPage"));
const SharePage = lazyPage(() => import("./pages/SharePage"));
const GraceRecordPage = lazyPage(() => import("./pages/GraceRecordPage"));
const CarePage = lazyPage(() => import("./pages/CarePage"));
const LearnPage = lazyPage(() => import("./pages/LearnPage"));
const ChurchReadingPage = lazyPage(() => import("./pages/ChurchReadingPage"));
const BiblePage = lazyPage(() => import("./pages/BiblePage"));
const JesusTimelinePage = lazyPage(() => import("./pages/JesusTimelinePage"));
const ReadingPlansPage = lazyPage(() => import("./pages/ReadingPlansPage"));
const ReadingExperiencePage = lazyPage(() => import("./pages/ReadingExperiencePage"));
const MyNotesPage = lazyPage(() => import("./pages/MyNotesPage"));
const PrayerMeetingPage = lazyPage(() => import("./pages/PrayerMeetingPage"));
const NotFound = lazyPage(() => import("./pages/NotFound"));


const router = createBrowserRouter([{ path: '*', element: (
            <ErrorBoundary fallbackTitle="頁面載入失敗">
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/user" element={<Navigate to="/" replace />} />
                    <Route path="/user/study" element={<Navigate to="/" replace />} />
                    <Route path="/user/notebook" element={<Navigate to="/learn/my-notes" replace />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/crm" element={<CRMPage />} />
                    <Route path="/admin/access" element={<AccessControlPage />} />
                    <Route path="/admin/church-devotions" element={<ChurchDevotionAdminPage />} />
                    <Route path="/groups" element={<LifeGroupsPage />} />
                    <Route path="/groups/:groupId" element={<LifeGroupsPage />} />
                    <Route path="/admin/crm/person/:personId" element={<PastoralPersonPage />} />
                    <Route path="/notebook" element={<Navigate to="/learn/my-notes" replace />} />
                    <Route path="/me" element={<MePage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/me/activity" element={<MyActivityPage />} />
                    <Route path="/me/sharing" element={<MySharingPage />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/work" element={<SupportPage />} />
                    <Route path="/work/settings" element={<SupportSettingsPage />} />
                    <Route path="/me/love-journey" element={<LoveJourneyPage />} />
                    <Route path="/me/mentoring" element={<MentoringPage />} />
                    <Route path="/work/mentoring" element={<MentoringPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/play" element={<WePlayPage />} />
                    <Route path="/icebreaker" element={<IcebreakerPage />} />
                    <Route path="/grouper" element={<GrouperPage />} />
                    <Route path="/play/bible-quiz" element={<BibleQuizPage />} />
                    <Route path="/play/disciple-quiz" element={<DiscipleQuizPage />} />
                    <Route path="/prayer-wall" element={<PrayerWallPage />} />
                    <Route path="/walls" element={<PublicWallsPage />} />
                    <Route path="/devotion-wall" element={<DevotionWallPage />} />
                    <Route path="/card" element={<MessageCardPage />} />
                    <Route path="/share" element={<SharePage />} />
                    <Route path="/grace-record" element={<GraceRecordPage />} />
                    <Route path="/care" element={<CarePage />} />
                    <Route path="/learn" element={<LearnPage />} />
                    <Route path="/learn/church-reading" element={<ChurchReadingPage />} />
                    <Route path="/learn/bible" element={<BiblePage />} />
                    <Route path="/bible" element={<BiblePage />} />
                    <Route path="/learn/jesus-timeline" element={<JesusTimelinePage />} />
                    <Route path="/jesus-timeline" element={<JesusTimelinePage />} />
                    <Route path="/learn/reading-plans" element={<ReadingPlansPage />} />
                    <Route path="/learn/reading-plans/:planId/read" element={<ReadingExperiencePage />} />
                    <Route path="/learn/my-notes" element={<MyNotesPage />} />
                    <Route path="/cards" element={<MessageCardPage />} />
                    <Route path="/prayer-meeting" element={<PrayerMeetingPage />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </ErrorBoundary>
)}]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
