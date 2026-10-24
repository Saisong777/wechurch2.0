import { setChurchScope } from '@/lib/churchFetch';
import { ChurchProvider } from '@/contexts/ChurchContext';
import { CastleRouteSurface } from "@/components/home/CastleRouteSurface";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ui/error-boundary";



setChurchScope(null);
const router = createBrowserRouter([{path:'*',element:<ErrorBoundary fallbackTitle="頁面載入失敗"><CastleRouteSurface/></ErrorBoundary>}]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ChurchProvider><TooltipProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </TooltipProvider></ChurchProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
