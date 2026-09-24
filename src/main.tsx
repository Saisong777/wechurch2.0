import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPlatformTelemetry } from "./lib/platform-telemetry";
import { DeploymentBanner } from './components/layout/DeploymentBanner';
import { AppearanceProvider } from './components/theme/AppearanceProvider';

initPlatformTelemetry();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppearanceProvider>
    <DeploymentBanner />
    <App />
    </AppearanceProvider>
  </React.StrictMode>
);
