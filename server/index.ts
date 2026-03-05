import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

// Catch any uncaught errors so they show in Railway App Logs
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  process.exit(1);
});
// Log unhandled rejections but don't crash — most are recoverable
process.on("unhandledRejection", (reason) => {
  console.error("[WARN] Unhandled Rejection:", reason);
});

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (path.startsWith("/api") && capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    if (logLine.length > 120) {
      logLine = logLine.slice(0, 119) + "…";
    }
    log(logLine);
  });

  next();
});

(async () => {
  const server = createServer(app);

  app.get("/__healthcheck", (_req, res) => {
    res.status(200).send("ok");
  });

  await registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error(err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5001;
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(`[Server] Failed to bind on port ${port}:`, err.message);
    process.exit(1);
  });
  server.listen(port, "::", () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown — close connections cleanly during Railway deploys
  const shutdown = async (signal: string) => {
    log(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      log('HTTP server closed');
    });
    try {
      await pool.end();
      log('DB pool closed');
    } catch (e) {
      console.error('[Shutdown] Error closing DB pool:', e);
    }
    // Force exit after 10s if something hangs
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();

