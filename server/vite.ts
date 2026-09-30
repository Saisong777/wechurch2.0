import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: any) {
  const vite = await createViteServer({
    server: {
      allowedHosts: [],
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        if (
          msg.includes("[TypeScript] Found 0 errors. Watching for file changes")
        ) {
          log("no errors found", "tsc");
          return;
        }
        if (msg.includes("[TypeScript] ")) {
          const [errors, summary] = msg.split("[TypeScript] ", 2);
          log(summary, "tsc");
          return;
        }
        viteLogger.error(msg, options);
      },
    },
  });

  app.use(vite.middlewares);
  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(__dirname, "..", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, distPath = path.resolve(__dirname, "..", "dist", "public")) {

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve static assets with long cache (they have content hashes)
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  // Stale deployment chunks must fail as assets, never as a successful HTML page.
  app.use('/assets', (_req, res) => {
    res.set('Cache-Control', 'no-store').status(404).type('text/plain').send('Asset not found');
  });

  // Serve other static files with short cache
  app.use(express.static(distPath, {
    maxAge: '1h',
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    },
  }));

  // SPA fallback - always return fresh index.html
  app.use("/{*path}", (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
