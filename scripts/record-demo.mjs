/**
 * ShelterIQ — Automated Demo Recorder
 * ─────────────────────────────────────
 * Records a 3:00 demo of the app with all features demonstrated.
 *
 * SETUP (run once):
 *   npx playwright install chromium
 *
 * USAGE:
 *   1. Start the dev server:  npm run dev
 *   2. In a second terminal:  node scripts/record-demo.mjs
 *
 * OUTPUT:
 *   demo-output/shelteriq-demo.webm  (rename + upload or convert with ffmpeg)
 *   To convert to MP4:
 *     ffmpeg -i demo-output/shelteriq-demo.webm -c:v libx264 -preset fast -crf 18 demo-output/shelteriq-demo.mp4
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, renameSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../demo-output");

// ── CONFIGURE ────────────────────────────────────────────────────────────────
const APP_URL = "http://localhost:5173";
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Smoothly scroll the page by `px` pixels over `durationMs` */
async function smoothScroll(page, px, durationMs = 900) {
  const steps = 24;
  const stepPx = px / steps;
  const stepMs = durationMs / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((s) => window.scrollBy(0, s), stepPx);
    await sleep(stepMs);
  }
}

/** Type a string character-by-character at human speed */
async function humanType(locator, text, msPerChar = 55) {
  await locator.click();
  for (const char of text) {
    await locator.pressSequentially(char);
    await sleep(msPerChar + Math.random() * 30);
  }
}

/** Click a button safely — scrolls into view first */
async function safeTap(locator) {
  await locator.scrollIntoViewIfNeeded();
  await sleep(250);
  await locator.click();
  await sleep(300);
}

/** Returns true if locator is visible within timeout ms */
async function isVisible(locator, timeout = 2000) {
  return locator.isVisible({ timeout }).catch(() => false);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log("\n🎬  ShelterIQ Demo Recorder  (Playwright v1.60)");
  console.log("═══════════════════════════════════════════════");
  console.log("Target URL :", APP_URL);
  console.log("Output dir :", OUT_DIR);
  console.log("Duration   : ~3 min 00 sec\n");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 0,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    // iPhone 14 Pro dimensions at 2× — looks great for a demo
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 393, height: 852 },
    },
    // Spoof geolocation to Fort Lauderdale for a realistic map open
    geolocation: { latitude: 26.1224, longitude: -80.1534 },
    permissions: ["geolocation"],
  });

  const page = await context.newPage();

  try {
    // ── [0:00–0:10]  HOME PAGE ──────────────────────────────────────────────
    console.log("⏱  0:00  Home page — loading...");
    await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(1500);

    // Let viewers read the stat block
    await sleep(7000);

    // ── [0:10–0:22]  ENTER USER MODE ───────────────────────────────────────
    console.log("⏱  0:10  Entering user mode");
    await safeTap(page.locator(".home-cta-primary"));
    await sleep(2500);

    // ── [0:22–0:42]  FILL INTAKE FORM ──────────────────────────────────────
    console.log("⏱  0:22  Filling intake form");

    const selects = page.locator(".form-select");
    await selects.nth(0).selectOption("shelter");
    await sleep(700);

    // Area: central
    await selects.nth(2).selectOption("central");
    await sleep(700);

    // Submit
    await safeTap(page.locator(".btn-submit"));
    await sleep(2500);

    // ── [0:42–1:00]  RESULTS PANEL ─────────────────────────────────────────
    console.log("⏱  0:42  Results panel");
    await sleep(1000);

    await smoothScroll(page, 220, 1400);
    await sleep(900);
    await smoothScroll(page, 220, 1400);
    await sleep(1200);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(900);

    // ── [1:00–1:13]  "I'M HERE" CHECK-IN ───────────────────────────────────
    console.log("⏱  1:00  I'm Here check-in");

    const checkinBtn = page.locator(".btn-checkin").first();
    await safeTap(checkinBtn);
    await sleep(1800);

    await safeTap(page.locator(".checkin-yes").first());
    await sleep(2500);

    const resetLink = page.locator(".checkin-reset").first();
    if (await isVisible(resetLink)) await safeTap(resetLink);
    await sleep(700);

    // ── [1:13–1:25]  AI CALL SCRIPT ────────────────────────────────────────
    console.log("⏱  1:13  AI call script — generating...");

    const scriptBtn = page.locator(".btn-script").first();
    await safeTap(scriptBtn);

    try {
      await page.locator(".call-script").first().waitFor({ timeout: 9000 });
    } catch {
      console.log("  (call script took too long — moving on)");
    }
    await sleep(500);
    await smoothScroll(page, 80, 500);
    await sleep(2000);

    // ── [1:25–1:40]  CRISIS DETECTION ──────────────────────────────────────
    console.log("⏱  1:25  Crisis detection demo");

    await safeTap(page.locator(".nav-tab").nth(0));
    await sleep(900);

    await safeTap(page.locator(".btn-complex-toggle"));
    await sleep(700);

    const textarea = page.locator(".form-textarea");
    await humanType(
      textarea,
      "I've been feeling like I don't want to live anymore and I need somewhere safe tonight",
      60
    );
    await sleep(1200);

    await safeTap(page.locator(".btn-submit"));
    await sleep(700);

    // Hold on crisis banner
    await sleep(5000);

    const dismissBtn = page.locator(".crisis-dismiss");
    if (await isVisible(dismissBtn)) await safeTap(dismissBtn);
    await sleep(2000);

    // ── [1:40–2:00]  MAP + SAFE WAITING SPOTS ──────────────────────────────
    console.log("⏱  1:40  Map view — opens at user location, Safe Waiting Spots");

    await safeTap(page.locator(".nav-tab").nth(2)); // Map tab
    await sleep(4000); // Let Google Maps load and center on location

    // Toggle Safe Spots on
    const safeToggle = page.locator(".safe-spots-toggle");
    if (await isVisible(safeToggle)) {
      await safeTap(safeToggle);
      await sleep(3500);
      // Toggle off to clean up before navigation demo
      await safeTap(safeToggle);
      await sleep(1000);
    }

    await sleep(1000);

    // ── [2:00–2:22]  IN-APP NAVIGATION ─────────────────────────────────────
    console.log("⏱  2:00  In-app navigation demo");

    // Go to results, tap Navigate on first service card
    await safeTap(page.locator(".nav-tab").nth(1));
    await sleep(800);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(600);

    const directionsBtn = page.locator(".btn-directions").first();
    if (await isVisible(directionsBtn, 3000)) {
      await safeTap(directionsBtn);
      await sleep(2500); // App switches to map with nav mode active
    } else {
      console.log("  (no directions button found — switching to map manually)");
      await safeTap(page.locator(".nav-tab").nth(2));
      await sleep(2500);
    }

    // Now on map tab in navigation mode — show travel mode options
    const walkModeBtn = page.locator(".nav-mode-option").first(); // Walk
    if (await isVisible(walkModeBtn, 2000)) {
      // Tap Bike to show mode switching
      const bikeModeBtn = page.locator(".nav-mode-option").nth(1);
      await safeTap(bikeModeBtn);
      await sleep(1000);
      // Switch back to Walk for demo
      await safeTap(walkModeBtn);
      await sleep(1200);
    }

    // Tap More to expand route steps panel
    const moreBtn = page.locator(".nav-panel-toggle");
    if (await isVisible(moreBtn, 2000)) {
      await safeTap(moreBtn); // "More" → panel expands, map slides up
      await sleep(3500);      // Show the route visible above the expanded steps

      // Tap Follow
      const followBtn = page.locator(".nav-mode-locate");
      if (await isVisible(followBtn)) {
        await safeTap(followBtn); // Re-centers map on location, collapses panel
        await sleep(2000);
      } else {
        // Manually collapse panel
        await safeTap(moreBtn); // "Less"
        await sleep(1500);
      }
    }

    // Optionally show Open App button tap — then close navigation
    const openAppBtn = page.locator(".nav-mode-open-app");
    if (await isVisible(openAppBtn, 1000)) {
      await sleep(800); // Pause on Open App button so viewers see it
    }

    const clearNavBtn = page.locator(".nav-bar-close");
    if (await isVisible(clearNavBtn, 1000)) {
      await safeTap(clearNavBtn);
      await sleep(1200);
    }

    // ── [2:22–2:38]  OUTREACH MODE ─────────────────────────────────────────
    console.log("⏱  2:22  Outreach worker mode");

    await safeTap(page.locator(".btn-mode")); // Switch to Outreach
    await sleep(1500);

    const outreachInput = page.locator(".outreach-input");
    if (await isVisible(outreachInput)) {
      await humanType(outreachInput, "Veteran male substance abuse no ID", 50);
      await sleep(600);
      await safeTap(page.locator(".btn-outreach-search"));
      console.log("     waiting for outreach results (up to 15s)...");
      try {
        await page.locator(".service-card").first().waitFor({ timeout: 15000 });
        console.log("     ✓ outreach results loaded");
        await sleep(500);
        await smoothScroll(page, 200, 1000);
      } catch {
        console.log("     (outreach timed out — showing UI state and moving on)");
      }
      await sleep(2500);
    } else {
      await sleep(4000);
    }

    // ── [2:38–2:52]  LANGUAGE SWITCH TO SPANISH ────────────────────────────
    console.log("⏱  2:38  Language switch → Spanish");

    await safeTap(page.locator(".btn-mode")); // Back to user mode
    await sleep(900);

    await safeTap(page.locator('.lang-btn:has-text("ES")'));
    await sleep(1200);

    await safeTap(page.locator(".nav-tab").nth(1)); // Results in Spanish
    await sleep(1500);
    await smoothScroll(page, 180, 1000);
    await sleep(2000);

    // ── [2:52–3:00]  CLOSING SHOT ──────────────────────────────────────────
    console.log("⏱  2:52  Closing shot");

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1000);

    await sleep(7000); // Hold on header / logo as final frame

  } finally {
    console.log("\n💾  Saving video — closing browser...");
    await context.close();
    await browser.close();
  }

  // Rename the auto-generated UUID filename to something friendly
  try {
    const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
    if (files.length > 0) {
      const newest = files
        .map((f) => ({ f, t: existsSync(path.join(OUT_DIR, f)) }))
        .sort()
        .at(-1).f;
      const dest = path.join(OUT_DIR, "shelteriq-demo.webm");
      renameSync(path.join(OUT_DIR, newest), dest);
      console.log("\n✅  Video saved:");
      console.log("   ", dest);
    }
  } catch {
    console.log("\n✅  Video saved to:", OUT_DIR);
  }

  console.log("\n─────────────────────────────────────────────────");
  console.log("📋  NEXT STEPS — Adding the voiceover:");
  console.log("");
  console.log("1. Convert to MP4 (requires ffmpeg — ffmpeg.org/download):");
  console.log("     ffmpeg -i demo-output/shelteriq-demo.webm \\");
  console.log("            -c:v libx264 -preset fast -crf 18 \\");
  console.log("            demo-output/shelteriq-demo.mp4");
  console.log("");
  console.log("2. Generate AI voiceover:");
  console.log("   → Go to elevenlabs.io (free account)");
  console.log("   → Paste the script from scripts/demo-voiceover.txt");
  console.log("   → Use 'Rachel' voice, speed 0.93");
  console.log("   → Download the MP3");
  console.log("");
  console.log("3. Combine in CapCut (free, mobile or PC):");
  console.log("   → Import shelteriq-demo.mp4 as video track");
  console.log("   → Import voiceover MP3 as audio track");
  console.log("   → Trim/sync as needed, export at 1080p");
  console.log("─────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n❌  Recording failed:", err.message);
  process.exit(1);
});
