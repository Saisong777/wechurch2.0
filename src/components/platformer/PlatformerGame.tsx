import { useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const W = 480;
const H = 270;
const GRAVITY = 0.45;
const JUMP_VY = -10.5;
const MOVE_SPEED = 3.5;
const PW = 20;
const PH = 26;
const LEVEL_W = 3400;
const TOTAL_CROSSES = 20;
const CHURCH_X = 3060;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Platform { x: number; y: number; w: number; h: number; cloud?: boolean }
interface CrossItem { x: number; y: number; collected: boolean }
type GameStatus = "menu" | "playing" | "dead" | "win";

// ─── Level Data ──────────────────────────────────────────────────────────────
const PLATFORMS: Platform[] = [
  // Zone 1: Tutorial ground
  { x: 0,    y: 230, w: 300, h: 50 },
  { x: 350,  y: 215, w: 90,  h: 55 },
  { x: 490,  y: 200, w: 90,  h: 70 },
  { x: 630,  y: 230, w: 190, h: 50 },
  // Zone 2: Cloud platforms
  { x: 695,  y: 163, w: 80,  h: 18, cloud: true },
  { x: 825,  y: 143, w: 80,  h: 18, cloud: true },
  { x: 905,  y: 230, w: 190, h: 50 },
  // Zone 3: Step platforms
  { x: 1145, y: 210, w: 70,  h: 60 },
  { x: 1270, y: 192, w: 70,  h: 78 },
  { x: 1395, y: 175, w: 70,  h: 95 },
  { x: 1520, y: 230, w: 230, h: 50 },
  // Zone 4: Staircase clouds
  { x: 1805, y: 208, w: 80,  h: 18, cloud: true },
  { x: 1935, y: 180, w: 80,  h: 18, cloud: true },
  { x: 2065, y: 150, w: 80,  h: 18, cloud: true },
  { x: 2195, y: 120, w: 200, h: 18, cloud: true },
  // Zone 5: Final church grounds
  { x: 2455, y: 230, w: 950, h: 50 },
];

function makeCrosses(): CrossItem[] {
  return [
    { x: 80,   y: 203, collected: false },
    { x: 200,  y: 203, collected: false },
    { x: 370,  y: 188, collected: false },
    { x: 510,  y: 173, collected: false },
    { x: 660,  y: 203, collected: false },
    { x: 715,  y: 135, collected: false },
    { x: 845,  y: 115, collected: false },
    { x: 945,  y: 203, collected: false },
    { x: 1070, y: 203, collected: false },
    { x: 1168, y: 182, collected: false },
    { x: 1283, y: 163, collected: false },
    { x: 1408, y: 147, collected: false },
    { x: 1570, y: 203, collected: false },
    { x: 1825, y: 179, collected: false },
    { x: 1955, y: 151, collected: false },
    { x: 2085, y: 121, collected: false },
    { x: 2240, y: 91,  collected: false },
    { x: 2560, y: 203, collected: false },
    { x: 2720, y: 203, collected: false },
    { x: 2880, y: 203, collected: false },
  ];
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.fillStyle = color;
  const vw = size * 0.28;
  const hh = size * 0.28;
  ctx.fillRect(cx - vw / 2, cy - size / 2, vw, size);
  ctx.fillRect(cx - size * 0.4, cy - hh / 2 - size * 0.12, size * 0.8, hh);
}

function drawBackground(ctx: CanvasRenderingContext2D, camX: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#5b9bd5");
  grad.addColorStop(0.6, "#a8d4f0");
  grad.addColorStop(1, "#d4ecf9");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Parallax clouds
  const cloudDefs = [
    { bx: 120, y: 28, r: 18 }, { bx: 380, y: 42, r: 14 }, { bx: 620, y: 22, r: 22 },
    { bx: 900, y: 48, r: 16 }, { bx: 1180, y: 32, r: 20 }, { bx: 1450, y: 18, r: 17 },
    { bx: 1720, y: 44, r: 19 }, { bx: 2000, y: 28, r: 23 }, { bx: 2280, y: 46, r: 15 },
    { bx: 2560, y: 24, r: 21 }, { bx: 2840, y: 38, r: 18 }, { bx: 3100, y: 30, r: 16 },
  ];
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  cloudDefs.forEach(({ bx, y, r }) => {
    const sx = bx - camX * 0.35;
    if (sx > -60 && sx < W + 60) {
      ctx.beginPath();
      ctx.arc(sx, y + r, r, 0, Math.PI * 2);
      ctx.arc(sx + r * 1.1, y + r * 0.6, r * 1.3, 0, Math.PI * 2);
      ctx.arc(sx + r * 2.3, y + r, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, camX: number) {
  const sx = p.x - camX;
  if (sx + p.w < -2 || sx > W + 2) return;

  if (p.cloud) {
    ctx.fillStyle = "#dceefb";
    ctx.strokeStyle = "#9ecde8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    (ctx as any).roundRect(sx, p.y, p.w, p.h, 8);
    ctx.fill();
    ctx.stroke();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    (ctx as any).roundRect(sx + 4, p.y + 2, p.w - 8, 5, 4);
    ctx.fill();
    return;
  }

  // Stone ground
  ctx.fillStyle = "#6b4c11";
  ctx.fillRect(sx, p.y + 10, p.w, p.h - 10);
  // Grass top
  ctx.fillStyle = "#3d7a36";
  ctx.fillRect(sx, p.y, p.w, 12);
  // Grass tufts
  ctx.fillStyle = "#52a348";
  for (let i = 4; i < p.w - 4; i += 12) {
    ctx.beginPath();
    ctx.arc(sx + i + 6, p.y + 3, 4.5, Math.PI, 0);
    ctx.fill();
  }
  // Stone bricks
  ctx.strokeStyle = "#5a3f0e";
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.5;
  for (let row = 0; row < Math.ceil((p.h - 10) / 16); row++) {
    const ry = p.y + 12 + row * 16;
    const offset = row % 2 === 0 ? 0 : 20;
    for (let col = -20 + offset; col < p.w; col += 40) {
      ctx.strokeRect(sx + col, ry, 40, 16);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  facingRight: boolean,
  frame: number
) {
  ctx.save();
  const cx = px + PW / 2;
  const cy = py + PH / 2;
  ctx.translate(cx, cy);
  if (!facingRight) ctx.scale(-1, 1);
  ctx.translate(-PW / 2, -PH / 2);

  const legBob = Math.sin(frame * 0.3) * 1.5;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(PW / 2, PH + 1, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Left leg
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(4, 20 + legBob, 6, 6);
  ctx.fillStyle = "#111";
  ctx.fillRect(3, 24 + legBob, 8, 3);

  // Right leg
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(10, 20 - legBob, 6, 6);
  ctx.fillStyle = "#111";
  ctx.fillRect(9, 24 - legBob, 8, 3);

  // Body (blue shirt)
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  (ctx as any).roundRect(3, 10, PW - 6, 12, 3);
  ctx.fill();

  // Cross on chest
  drawCross(ctx, PW / 2, 16, 9, "#fbbf24");

  // Head
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  (ctx as any).roundRect(4, 1, PW - 8, 10, 3);
  ctx.fill();

  // Hair
  ctx.fillStyle = "#92400e";
  ctx.fillRect(4, 1, PW - 8, 3);

  // Eyes
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(7, 4, 2, 2);
  ctx.fillRect(11, 4, 2, 2);

  // Smile
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(PW / 2, 8, 2.5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawChurch(ctx: CanvasRenderingContext2D, camX: number) {
  const sx = CHURCH_X - camX;
  if (sx > W + 10 || sx + 140 < -10) return;

  const groundY = 230;
  const bh = 115; // building height

  // Building body
  ctx.fillStyle = "#e8dcc8";
  ctx.fillRect(sx, groundY - bh, 130, bh);

  // Stone texture
  ctx.strokeStyle = "#c4ab88";
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = 0.5;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 4; col++) {
      const offset = row % 2 === 0 ? 0 : 16;
      ctx.strokeRect(sx + col * 32 - offset, groundY - bh + row * 16 + 4, 32, 16);
    }
  }
  ctx.globalAlpha = 1;

  // Door (arched)
  ctx.fillStyle = "#7c3d12";
  ctx.fillRect(sx + 47, groundY - 52, 36, 52);
  ctx.beginPath();
  ctx.arc(sx + 65, groundY - 52, 18, Math.PI, 0);
  ctx.fill();
  // Door handle
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(sx + 75, groundY - 26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Left window
  ctx.fillStyle = "#93c5fd";
  ctx.fillRect(sx + 10, groundY - bh + 22, 26, 34);
  ctx.beginPath();
  ctx.arc(sx + 23, groundY - bh + 22, 13, Math.PI, 0);
  ctx.fillStyle = "#bfdbfe";
  ctx.fill();
  // Window pane
  ctx.strokeStyle = "#7c3d12";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 10, groundY - bh + 22, 26, 34);
  ctx.beginPath();
  ctx.moveTo(sx + 23, groundY - bh + 22); ctx.lineTo(sx + 23, groundY - bh + 56);
  ctx.moveTo(sx + 10, groundY - bh + 39); ctx.lineTo(sx + 36, groundY - bh + 39);
  ctx.stroke();

  // Right window
  ctx.fillStyle = "#93c5fd";
  ctx.fillRect(sx + 94, groundY - bh + 22, 26, 34);
  ctx.beginPath();
  ctx.arc(sx + 107, groundY - bh + 22, 13, Math.PI, 0);
  ctx.fillStyle = "#bfdbfe";
  ctx.fill();
  ctx.strokeStyle = "#7c3d12";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx + 94, groundY - bh + 22, 26, 34);
  ctx.beginPath();
  ctx.moveTo(sx + 107, groundY - bh + 22); ctx.lineTo(sx + 107, groundY - bh + 56);
  ctx.moveTo(sx + 94, groundY - bh + 39); ctx.lineTo(sx + 120, groundY - bh + 39);
  ctx.stroke();

  // Steeple base
  ctx.fillStyle = "#c8b87a";
  ctx.fillRect(sx + 52, groundY - bh - 30, 26, 32);

  // Steeple roof (triangle)
  ctx.fillStyle = "#8B6914";
  ctx.beginPath();
  ctx.moveTo(sx + 65, groundY - bh - 68);
  ctx.lineTo(sx + 44, groundY - bh - 30);
  ctx.lineTo(sx + 86, groundY - bh - 30);
  ctx.closePath();
  ctx.fill();

  // Gold cross on top
  drawCross(ctx, sx + 65, groundY - bh - 78, 22, "#f59e0b");

  // Glow around church cross
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 12;
  drawCross(ctx, sx + 65, groundY - bh - 78, 22, "#f59e0b");
  ctx.shadowBlur = 0;
}

function drawCollectibles(ctx: CanvasRenderingContext2D, crosses: CrossItem[], camX: number, tick: number) {
  crosses.forEach((c) => {
    if (c.collected) return;
    const sx = c.x - camX;
    if (sx < -20 || sx > W + 20) return;
    const bobY = c.y + Math.sin(tick * 0.06 + c.x * 0.01) * 3;
    // Glow
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 8;
    drawCross(ctx, sx, bobY, 14, "#fbbf24");
    ctx.shadowBlur = 0;
    // Sparkles
    if (Math.floor(tick * 0.1 + c.x) % 60 < 10) {
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(sx + 6, bobY - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}

function drawHUD(ctx: CanvasRenderingContext2D, lives: number, collected: number) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  (ctx as any).roundRect(6, 6, 72, 22, 6);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  (ctx as any).roundRect(W - 78, 6, 72, 22, 6);
  ctx.fill();

  // Hearts
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < lives ? 1 : 0.22;
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 13px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("♥", 12 + i * 22, 17);
  }
  ctx.globalAlpha = 1;

  // Cross count
  drawCross(ctx, W - 63, 17, 10, "#fbbf24");
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${collected}/${TOTAL_CROSSES}`, W - 52, 13);
  ctx.textAlign = "left";
}

function drawMessage(ctx: CanvasRenderingContext2D, msg: string, sub: string) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, H / 2 - 18);

  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ddd";
  ctx.fillText(sub, W / 2, H / 2 + 14);
  ctx.textAlign = "left";
}

// ─── Collision ───────────────────────────────────────────────────────────────
function collidePlatforms(
  px: number, py: number,
  vx: number, vy: number,
): { py: number; vy: number; onGround: boolean } {
  let onGround = false;

  for (const p of PLATFORMS) {
    const prevBottom = py + PH - vy; // bottom before move
    const curBottom = py + PH;
    const left = px + 2;
    const right = px + PW - 2;

    if (right > p.x && left < p.x + p.w) {
      // Only top collision (player lands on top)
      if (prevBottom <= p.y + 2 && curBottom >= p.y && vy >= 0) {
        py = p.y - PH;
        vy = 0;
        onGround = true;
      }
    }
  }

  // Prevent going left of level
  if (px < 0) { px = 0; }

  return { py, vy, onGround };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function PlatformerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    px: 50, py: 185,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    camX: 0,
    crosses: makeCrosses(),
    lives: 3,
    collected: 0,
    status: "menu" as GameStatus,
    keys: new Set<string>(),
    touch: { left: false, right: false, jump: false },
    jumpConsumed: false,
    tick: 0,
    animFrame: 0,
    deathTimer: 0,
    winTimer: 0,
  });

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.px = 50; s.py = 185;
    s.vx = 0; s.vy = 0;
    s.onGround = false;
    s.facingRight = true;
    s.camX = 0;
    s.crosses = makeCrosses();
    s.lives = 3;
    s.collected = 0;
    s.status = "playing";
    s.tick = 0;
    s.deathTimer = 0;
    s.winTimer = 0;
    s.jumpConsumed = false;
  }, []);

  const respawn = useCallback(() => {
    const s = stateRef.current;
    s.px = 50; s.py = 185;
    s.vx = 0; s.vy = 0;
    s.onGround = false;
    s.camX = 0;
    s.status = "playing";
    s.deathTimer = 0;
    s.jumpConsumed = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      stateRef.current.keys[down ? "add" : "delete"](e.code);
      if (down && (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));

    // Click/tap to start on menu/dead/win
    const handleClick = () => {
      const s = stateRef.current;
      if (s.status === "menu") { startGame(); return; }
      if (s.status === "dead" && s.deathTimer > 60) { s.lives > 0 ? respawn() : startGame(); return; }
      if (s.status === "win" && s.winTimer > 90) { startGame(); return; }
    };
    canvas.addEventListener("click", handleClick);

    const loop = () => {
      const s = stateRef.current;
      s.tick++;

      // ── Game logic ──
      if (s.status === "playing") {
        const left = s.keys.has("ArrowLeft") || s.keys.has("KeyA") || s.touch.left;
        const right = s.keys.has("ArrowRight") || s.keys.has("KeyD") || s.touch.right;
        const jump = s.keys.has("ArrowUp") || s.keys.has("KeyW") || s.keys.has("Space") || s.touch.jump;

        if (left) { s.vx = -MOVE_SPEED; s.facingRight = false; }
        else if (right) { s.vx = MOVE_SPEED; s.facingRight = true; }
        else s.vx = 0;

        if (jump && !s.jumpConsumed && s.onGround) {
          s.vy = JUMP_VY;
          s.onGround = false;
          s.jumpConsumed = true;
        }
        if (!jump) s.jumpConsumed = false;

        // Physics
        s.vy += GRAVITY;
        s.px += s.vx;
        s.py += s.vy;

        // Clamp px
        if (s.px < 0) s.px = 0;
        if (s.px > LEVEL_W - PW) s.px = LEVEL_W - PW;

        // Platform collision
        const col = collidePlatforms(s.px, s.py, s.vx, s.vy);
        s.py = col.py;
        s.vy = col.vy;
        s.onGround = col.onGround;

        // Camera
        const targetCam = s.px - W / 3;
        s.camX += (targetCam - s.camX) * 0.12;
        s.camX = Math.max(0, Math.min(LEVEL_W - W, s.camX));

        // Collect crosses
        s.crosses.forEach((c) => {
          if (c.collected) return;
          const dx = (c.x) - (s.px + PW / 2);
          const dy = (c.y) - (s.py + PH / 2);
          if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
            c.collected = true;
            s.collected++;
          }
        });

        // Win: reach church
        if (s.px + PW >= CHURCH_X + 44 && s.px <= CHURCH_X + 86) {
          s.status = "win";
        }

        // Death: fall off
        if (s.py > H + 60) {
          s.lives--;
          if (s.lives <= 0) {
            s.lives = 0;
            s.status = "dead";
          } else {
            s.status = "dead";
          }
          s.deathTimer = 0;
        }
      }

      if (s.status === "dead") s.deathTimer++;
      if (s.status === "win") s.winTimer++;

      // ── Render ──
      ctx.clearRect(0, 0, W, H);

      if (s.status === "menu") {
        // Menu background
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1e3a5f");
        g.addColorStop(1, "#0f2340");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Stars
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 40; i++) {
          const sx = ((i * 137 + 23) % W);
          const sy = ((i * 89 + 11) % (H * 0.7));
          ctx.globalAlpha = 0.4 + Math.sin(s.tick * 0.05 + i) * 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Title cross
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 20;
        drawCross(ctx, W / 2, 60, 40, "#f59e0b");
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("天路歷程", W / 2, 105);

        ctx.fillStyle = "#93c5fd";
        ctx.font = "13px sans-serif";
        ctx.fillText("收集十字架，抵達教會！", W / 2, 128);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "14px sans-serif";
        const pulse = 0.7 + Math.sin(s.tick * 0.08) * 0.3;
        ctx.globalAlpha = pulse;
        ctx.fillText("點擊螢幕開始", W / 2, 160);
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px sans-serif";
        ctx.fillText("← → / A D 移動　↑ / W / 空白鍵 跳躍", W / 2, 195);

        ctx.textAlign = "left";
        return;
      }

      drawBackground(ctx, s.camX);

      // Platforms
      PLATFORMS.forEach((p) => drawPlatform(ctx, p, s.camX));

      // Church
      drawChurch(ctx, s.camX);

      // Collectibles
      drawCollectibles(ctx, s.crosses, s.camX, s.tick);

      // Player
      drawPlayer(ctx, s.px - s.camX, s.py, s.facingRight, s.tick);

      // HUD
      drawHUD(ctx, s.lives, s.collected);

      // Overlays
      if (s.status === "dead") {
        if (s.lives > 0) {
          drawMessage(ctx, "💔 跌落了！", `還有 ${s.lives} 條命 — 點擊繼續`);
        } else {
          drawMessage(ctx, "遊戲結束", "點擊重新開始");
        }
      }

      if (s.status === "win") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);

        // Celebration crosses
        for (let i = 0; i < 8; i++) {
          const angle = (s.winTimer * 0.03 + i * Math.PI / 4);
          const r = 55 + Math.sin(s.winTimer * 0.05 + i) * 10;
          const cx2 = W / 2 + Math.cos(angle) * r;
          const cy2 = H / 2 + Math.sin(angle) * r * 0.5;
          ctx.globalAlpha = 0.7;
          drawCross(ctx, cx2, cy2, 12, "#fbbf24");
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 12;
        ctx.fillText("🎉 抵達教會！", W / 2, H / 2 - 22);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        ctx.fillText(`收集了 ${s.collected}/${TOTAL_CROSSES} 個十字架`, W / 2, H / 2 + 8);

        ctx.fillStyle = "#93c5fd";
        ctx.font = "12px sans-serif";
        const p2 = 0.6 + Math.sin(s.winTimer * 0.08) * 0.4;
        ctx.globalAlpha = p2;
        ctx.fillText("點擊再玩一次", W / 2, H / 2 + 36);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }

      s.animFrame = requestAnimationFrame(loop);
    };

    s.animFrame = requestAnimationFrame(loop);
    const s = stateRef.current;

    return () => {
      cancelAnimationFrame(s.animFrame);
      window.removeEventListener("keydown", (e) => onKey(e, true));
      window.removeEventListener("keyup", (e) => onKey(e, false));
      canvas.removeEventListener("click", handleClick);
    };
  }, [startGame, respawn]);

  // Touch button handlers
  const setTouch = (key: "left" | "right" | "jump", val: boolean) => {
    stateRef.current.touch[key] = val;
  };

  const handleStart = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "menu") { startGame(); return; }
    if (s.status === "dead" && s.deathTimer > 60) { s.lives > 0 ? respawn() : startGame(); return; }
    if (s.status === "win" && s.winTimer > 90) { startGame(); return; }
  }, [startGame, respawn]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 select-none">
      {/* Back button */}
      <div className="w-full max-w-2xl px-3 py-2 flex items-center">
        <Link to="/play" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回
        </Link>
        <span className="ml-auto text-gray-400 text-sm">天路歷程</span>
      </div>

      {/* Canvas container */}
      <div
        className="w-full max-w-2xl"
        style={{ aspectRatio: "16/9", position: "relative" }}
        onClick={handleStart}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block", cursor: "pointer" }}
        />
      </div>

      {/* Mobile controls */}
      <div className="w-full max-w-2xl flex justify-between items-center px-4 py-3 mt-1">
        <div className="flex gap-2">
          <button
            className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 text-white text-xl flex items-center justify-center active:bg-white/25 touch-none"
            onTouchStart={(e) => { e.preventDefault(); setTouch("left", true); }}
            onTouchEnd={(e) => { e.preventDefault(); setTouch("left", false); }}
            onMouseDown={() => setTouch("left", true)}
            onMouseUp={() => setTouch("left", false)}
            onMouseLeave={() => setTouch("left", false)}
          >
            ◀
          </button>
          <button
            className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 text-white text-xl flex items-center justify-center active:bg-white/25 touch-none"
            onTouchStart={(e) => { e.preventDefault(); setTouch("right", true); }}
            onTouchEnd={(e) => { e.preventDefault(); setTouch("right", false); }}
            onMouseDown={() => setTouch("right", true)}
            onMouseUp={() => setTouch("right", false)}
            onMouseLeave={() => setTouch("right", false)}
          >
            ▶
          </button>
        </div>
        <button
          className="w-20 h-14 rounded-xl bg-blue-500/30 border border-blue-400/40 text-white text-sm font-bold flex items-center justify-center active:bg-blue-500/50 touch-none"
          onTouchStart={(e) => { e.preventDefault(); setTouch("jump", true); }}
          onTouchEnd={(e) => { e.preventDefault(); setTouch("jump", false); }}
          onMouseDown={() => setTouch("jump", true)}
          onMouseUp={() => setTouch("jump", false)}
          onMouseLeave={() => setTouch("jump", false)}
        >
          跳！
        </button>
      </div>

      <p className="text-gray-600 text-xs mt-1 pb-2">鍵盤：← → 移動　↑ / 空白鍵 跳躍</p>
    </div>
  );
}

export default PlatformerGame;
