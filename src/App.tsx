import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createBrowserRouter, RouterProvider, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/contexts/SessionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// Resilient lazy loader — catches chunk load failures (bad network, deploy race)
// and shows a reload prompt instead of white screen
function lazyPage(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    factory().catch(() => ({
      default: () => (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="text-center space-y-4">
            <p className="text-lg font-semibold">頁面載入失敗</p>
            <p className="text-sm text-muted-foreground">請檢查網路連線後重新載入</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              重新載入
            </button>
          </div>
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
const WeLiveLandingPage = lazyNamed(() => import("./pages/WeLiveLandingPage"), "WeLiveLandingPage");
const UserPage = lazyNamed(() => import("./pages/UserPage"), "UserPage");
const SoulGymNotebookPage = lazyNamed(() => import("./pages/SoulGymNotebookPage"), "SoulGymNotebookPage");
const AdminPage = lazyNamed(() => import("./pages/AdminPage"), "AdminPage");
const CRMPage = lazyPage(() => import("./pages/CRMPage"));
const ChurchDevotionAdminPage = lazyPage(() => import('./pages/ChurchDevotionAdminPage'));
const LifeGroupsPage = lazyPage(() => import('./pages/LifeGroupsPage'));
const PastoralPersonPage = lazyPage(() => import("./pages/PastoralPersonPage"));
const NotebookPage = lazyPage(() => import("./pages/NotebookPage"));
const MePage = lazyPage(() => import("./pages/MePage"));
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


// Minimal loading fallback for Suspense
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6">
    <div className="w-full max-w-sm space-y-4 rounded-lg border border-border/70 bg-card p-5 text-center shadow-[0_16px_48px_-34px_rgba(30,58,95,0.42)]">
      <div className="mx-auto h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">正在載入 WeChurch</p>
        <p className="text-xs text-muted-foreground">馬上就好</p>
      </div>
    </div>
  </div>
);

const router = createBrowserRouter([{ path: '*', element: (
            <ErrorBoundary fallbackTitle="頁面載入失敗">
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/user" element={<WeLiveLandingPage />} />
                    <Route path="/user/study" element={<UserPage />} />
                    <Route path="/user/notebook" element={<SoulGymNotebookPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/crm" element={<CRMPage />} />
                    <Route path="/admin/church-devotions" element={<ChurchDevotionAdminPage />} />
                    <Route path="/groups" element={<LifeGroupsPage />} />
                    <Route path="/groups/:groupId" element={<LifeGroupsPage />} />
                    <Route path="/admin/crm/person/:personId" element={<PastoralPersonPage />} />
                    <Route path="/notebook" element={<NotebookPage />} />
                    <Route path="/me" element={<MePage />} />
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
      <SessionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} />
        </TooltipProvider>
      </SessionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
