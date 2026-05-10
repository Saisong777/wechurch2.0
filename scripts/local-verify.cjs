#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const WebSocket = require("ws");

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.LOCAL_VERIFY_PORT || 5099);
const baseUrl = process.env.LOCAL_VERIFY_URL || `http://127.0.0.1:${port}`;
const remoteDebuggingPort = Number(process.env.LOCAL_VERIFY_DEBUG_PORT || 9222);
const startedAt = Date.now();

function log(message) {
  console.log(`[local-verify] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return res;
      lastError = new Error(`${url} returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function isUrlAvailable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return res.status < 500;
  } catch {
    return false;
  }
}

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

function spawnServer() {
  if (process.env.LOCAL_VERIFY_SKIP_SERVER === "1") return null;

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    SESSION_SECRET: process.env.SESSION_SECRET || "local-verify-session-secret",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev",
  };

  log(`starting production server on ${baseUrl}`);
  const child = spawn("npm", ["start"], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function terminateChild(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
  });
  child.kill(signal);
  await Promise.race([exited, sleep(3000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, sleep(1000)]);
  }
}

async function connectToDevTools(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  function send(method, params = {}) {
    const message = { id: ++id, method, params };
    ws.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(message.id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 10000);
      pending.set(message.id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
      return;
    }

    if (
      message.method &&
      [
        "Runtime.exceptionThrown",
        "Log.entryAdded",
        "Network.loadingFailed",
        "Page.loadEventFired",
      ].includes(message.method)
    ) {
      events.push(message);
    }
  });

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  return { ws, send, events };
}

async function runBrowserCheck() {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error("Chrome executable not found. Set CHROME_PATH to run local browser verification.");
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechurch-local-verify-"));
  const chromeArgs = [
    "--headless=new",
    `--remote-debugging-port=${remoteDebuggingPort}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];
  log(`launching headless Chrome from ${chromePath}`);
  const chrome = spawn(chromePath, chromeArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  chrome.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    if (!text.includes("DevTools listening")) process.stderr.write(chunk);
  });

  try {
    await waitForUrl(`http://127.0.0.1:${remoteDebuggingPort}/json/version`, 15000);
    const targets = await fetch(`http://127.0.0.1:${remoteDebuggingPort}/json`).then((res) => res.json());
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("No Chrome page target found");

    const devtools = await connectToDevTools(page.webSocketDebuggerUrl);
    const { send, events, ws } = devtools;
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Page.enable");
    await send("Network.enable");

    const verifyUrl = `${baseUrl}/?localVerify=${startedAt}`;
    log(`opening ${verifyUrl}`);
    await send("Page.navigate", { url: verifyUrl });
    await sleep(Number(process.env.LOCAL_VERIFY_WAIT_MS || 7000));

    const evaluate = (expression) =>
      send("Runtime.evaluate", { expression, returnByValue: true }).then((result) => result.result.value);

    const rootLength = await evaluate('document.getElementById("root")?.innerHTML.length || 0');
    const bodyText = await evaluate("document.body.innerText.slice(0, 1000)");
    const dataModulePreloads = await evaluate(
      'Array.from(document.querySelectorAll("link[rel=modulepreload]")).map((link) => link.href).filter((href) => href.startsWith("data:"))',
    );

    const seriousEvents = events.filter((event) => {
      if (event.method === "Page.loadEventFired") return false;
      const entry = event.params?.entry;
      const exception = event.params?.exceptionDetails;
      if (exception) return true;
      if (entry?.source === "security" && entry.level === "error") return true;
      if (entry?.source === "javascript" && entry.level === "error") return true;
      if (event.method === "Network.loadingFailed" && event.params?.blockedReason === "csp") return true;
      return false;
    });

    fs.mkdirSync(path.join(rootDir, "artifacts"), { recursive: true });
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(rootDir, "artifacts", "local-verify.png"), screenshot.data, "base64");

    const hasExpectedText = /WeChurch|我們就是教會/.test(bodyText);
    if (rootLength < 1000 || !hasExpectedText || dataModulePreloads.length > 0 || seriousEvents.length > 0) {
      console.error(
        JSON.stringify(
          {
            rootLength,
            hasExpectedText,
            bodyText,
            dataModulePreloads,
            seriousEvents: seriousEvents.map((event) => ({
              method: event.method,
              text:
                event.params?.entry?.text ||
                event.params?.exceptionDetails?.exception?.description ||
                event.params?.errorText,
              url: event.params?.entry?.url || event.params?.exceptionDetails?.url,
              blockedReason: event.params?.blockedReason,
            })),
          },
          null,
          2,
        ),
      );
      throw new Error("Local browser verification failed");
    }

    ws.close();
    log(`browser check passed: rootLength=${rootLength}`);
    log("screenshot saved to artifacts/local-verify.png");
  } finally {
    await terminateChild(chrome, "SIGTERM");
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function main() {
  const healthcheckUrl = `${baseUrl}/__healthcheck`;
  const server = await isUrlAvailable(healthcheckUrl) ? null : spawnServer();
  if (!server) log(`using existing server on ${baseUrl}`);
  try {
    await waitForUrl(healthcheckUrl, 45000);
    await runBrowserCheck();
  } finally {
    await terminateChild(server, "SIGINT");
  }
}

main().catch((error) => {
  console.error(`[local-verify] ${error.message}`);
  process.exit(1);
});
