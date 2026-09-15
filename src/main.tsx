import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPlatformTelemetry } from "./lib/platform-telemetry";
import { DeploymentBanner } from './components/layout/DeploymentBanner';

initPlatformTelemetry();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DeploymentBanner />
    <App />
  </React.StrictMode>
);
