import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
const WeLiveLandingPage = lazyNamed(() => import("./pages/WeLiveLandingPage"), "WeLiveLandingPage");
const UserPage = lazyNamed(() => import("./pages/UserPage"), "UserPage");
const SoulGymNotebookPage = lazyNamed(() => import("./pages/SoulGymNotebookPage"), "SoulGymNotebookPage");
const AdminPage = lazyNamed(() => import("./pages/AdminPage"), "AdminPage");
const CRMPage = lazyPage(() => import("./pages/CRMPage"));
const NotebookPage = lazyPage(() => import("./pages/NotebookPage"));
const LoginPage = lazyPage(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazyPage(() => import("./pages/ResetPasswordPage"));
const WePlayPage = lazyNamed(() => import("./pages/WePlayPage"), "WePlayPage");
const IcebreakerPage = lazyNamed(() => import("./pages/IcebreakerPage"), "IcebreakerPage");
const GrouperPage = lazyNamed(() => import("./pages/GrouperPage"), "GrouperPage");
const PrayerWallPage = lazyPage(() => import("./pages/PrayerWallPage"));
const MessageCardPage = lazyPage(() => import("./pages/MessageCardPage"));
const SharePage = lazyPage(() => import("./pages/SharePage"));
const LearnPage = lazyPage(() => import("./pages/LearnPage"));
const BiblePage = lazyPage(() => import("./pages/BiblePage"));
const JesusTimelinePage = lazyPage(() => import("./pages/JesusTimelinePage"));
const ReadingPlansPage = lazyPage(() => import("./pages/ReadingPlansPage"));
const ReadingExperiencePage = lazyPage(() => import("./pages/ReadingExperiencePage"));
const MyNotesPage = lazyPage(() => import("./pages/MyNotesPage"));
const PrayerMeetingPage = lazyPage(() => import("./pages/PrayerMeetingPage"));
const NotFound = lazyPage(() => import("./pages/NotFound"));


// Minimal loading fallback for Suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SessionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary fallbackTitle="頁面載入失敗">
              <Suspense fallback={<PageLoader />}>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/user" element={<WeLiveLandingPage />} />
                    <Route path="/user/study" element={<UserPage />} />
                    <Route path="/user/notebook" element={<SoulGymNotebookPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/crm" element={<CRMPage />} />
                    <Route path="/notebook" element={<NotebookPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/play" element={<WePlayPage />} />
                    <Route path="/icebreaker" element={<IcebreakerPage />} />
                    <Route path="/grouper" element={<GrouperPage />} />
                    <Route path="/play/bible-quiz" element={<BibleQuizPage />} />
                    <Route path="/prayer-wall" element={<PrayerWallPage />} />
                    <Route path="/card" element={<MessageCardPage />} />
                    <Route path="/share" element={<SharePage />} />
                    <Route path="/learn" element={<LearnPage />} />
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
                </AppLayout>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </SessionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
