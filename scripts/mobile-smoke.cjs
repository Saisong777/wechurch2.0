#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.MOBILE_SMOKE_BASE_URL || "http://127.0.0.1:5099";
const outputDir = path.resolve(process.cwd(), process.env.MOBILE_SMOKE_DIR || "artifacts/mobile-smoke");
const routes = (process.env.MOBILE_SMOKE_ROUTES || "/,/user,/user/study,/learn,/share,/play,/login")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function nameForRoute(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
}

function killProcessGroup(child) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // Best effort cleanup only.
    }
  }
}

function captureRoute(route) {
  return new Promise((resolve) => {
    const name = nameForRoute(route);
    const screenshot = path.join(outputDir, `${name}.png`);
    const profile = path.join("/tmp", `wechurch-mobile-smoke-${name}-${Date.now()}`);
    const child = spawn(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--run-all-compositor-stages-before-draw",
      "--hide-scrollbars",
      "--virtual-time-budget=6000",
      `--user-data-dir=${profile}`,
      "--window-size=390,844",
      `--screenshot=${screenshot}`,
      `${baseUrl}${route}`,
    ], { detached: true, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(fileCheck);
      killProcessGroup(child);
      fs.rmSync(profile, { recursive: true, force: true });
      resolve(result);
    };

    const fileCheck = setInterval(() => {
      if (!fs.existsSync(screenshot)) return;
      const bytes = fs.statSync(screenshot).size;
      if (bytes > 10000) {
        finish({ route, screenshot, bytes, pass: true, status: 0, stdout, stderr });
      }
    }, 500);

    const timer = setTimeout(() => {
      const bytes = fs.existsSync(screenshot) ? fs.statSync(screenshot).size : 0;
      finish({ route, screenshot, bytes, pass: bytes > 10000, timedOut: true, stdout, stderr });
    }, 20000);

    child.on("error", (error) => {
      finish({ route, screenshot, bytes: 0, pass: false, error: error.message, stdout, stderr });
    });

    child.on("exit", (status) => {
      const bytes = fs.existsSync(screenshot) ? fs.statSync(screenshot).size : 0;
      finish({ route, screenshot, bytes, pass: status === 0 && bytes > 10000, status, stdout, stderr });
    });
  });
}

const chrome = findChromeExecutable();
if (!chrome) {
  console.error("[mobile-smoke] Chrome/Chromium executable not found.");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
const results = [];

(async () => {
  for (const route of routes) {
    const result = await captureRoute(route);
    if (!result.pass) {
      console.error(`[mobile-smoke] failed on ${route}`);
      console.error(result.error || result.stderr || result.stdout || "Screenshot is blank or incomplete.");
      process.exit(1);
    }
    results.push(result);
  }

  console.table(results.map(({ route, bytes, pass, timedOut }) => ({ route, bytes, pass, timedOut: !!timedOut })));
  if (results.some((result) => !result.pass)) {
    console.error("[mobile-smoke] one or more screenshots look blank or incomplete.");
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
