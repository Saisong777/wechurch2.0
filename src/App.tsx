import { lazy, Suspense } from "react";
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

// Lazy load pages for better code splitting and FCP
const Index = lazy(() => import("./pages/Index"));
const UserPage = lazy(() => import("./pages/UserPage").then(m => ({ default: m.UserPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then(m => ({ default: m.AdminPage })));
const CRMPage = lazy(() => import("./pages/CRMPage"));
const NotebookPage = lazy(() => import("./pages/NotebookPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const IcebreakerPage = lazy(() => import("./pages/IcebreakerPage").then(m => ({ default: m.IcebreakerPage })));
const GrouperPage = lazy(() => import("./pages/GrouperPage").then(m => ({ default: m.GrouperPage })));
const PrayerWallPage = lazy(() => import("./pages/PrayerWallPage"));
const MessageCardPage = lazy(() => import("./pages/MessageCardPage"));
const SharePage = lazy(() => import("./pages/SharePage"));
const LearnPage = lazy(() => import("./pages/LearnPage"));
const BiblePage = lazy(() => import("./pages/BiblePage").catch(() => ({ default: () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center space-y-4">
        <p className="text-lg font-semibold">頁面載入失敗</p>
        <p className="text-sm text-muted-foreground">請檢查網路連線後重新載入</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">重新載入</button>
      </div>
    </div>
  );
}})));
const JesusTimelinePage = lazy(() => import("./pages/JesusTimelinePage"));
const ReadingPlansPage = lazy(() => import("./pages/ReadingPlansPage"));
const ReadingExperiencePage = lazy(() => import("./pages/ReadingExperiencePage"));
const MyNotesPage = lazy(() => import("./pages/MyNotesPage"));
const PrayerMeetingPage = lazy(() => import("./pages/PrayerMeetingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
                  <Route path="/user" element={<UserPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/crm" element={<CRMPage />} />
                  <Route path="/notebook" element={<NotebookPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/icebreaker" element={<IcebreakerPage />} />
                  <Route path="/grouper" element={<GrouperPage />} />
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
