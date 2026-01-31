import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/contexts/SessionContext";
import { AuthProvider } from "@/contexts/AuthContext";

// Lazy load pages for better code splitting and FCP
const Index = lazy(() => import("./pages/Index"));
const UserPage = lazy(() => import("./pages/UserPage").then(m => ({ default: m.UserPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then(m => ({ default: m.AdminPage })));
const CRMPage = lazy(() => import("./pages/CRMPage"));
const NotebookPage = lazy(() => import("./pages/NotebookPage"));
const IcebreakerPage = lazy(() => import("./pages/IcebreakerPage").then(m => ({ default: m.IcebreakerPage })));
const PrayerWallPage = lazy(() => import("./pages/PrayerWallPage"));
const MessageCardPage = lazy(() => import("./pages/MessageCardPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

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
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/user" element={<UserPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/crm" element={<CRMPage />} />
                <Route path="/notebook" element={<NotebookPage />} />
                <Route path="/icebreaker" element={<IcebreakerPage />} />
                <Route path="/prayer-wall" element={<PrayerWallPage />} />
                <Route path="/card" element={<MessageCardPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </SessionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
