/**
 * ShelterIQ — Automated Demo Recorder
 * ─────────────────────────────────────
 * Records a 2:30 demo of the app with all 3 new features demonstrated.
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
// Use localhost while the dev server is running (has your API keys from .env.local)
// Switch to your Vercel URL if you prefer to record the live site.
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

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log("\n🎬  ShelterIQ Demo Recorder  (Playwright v1.60)");
  console.log("═══════════════════════════════════════════════");
  console.log("Target URL :", APP_URL);
  console.log("Output dir :", OUT_DIR);
  console.log("Duration   : ~2 min 30 sec\n");

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
  });

  const page = await context.newPage();

  try {
    // ── [0:00–0:10]  HOME PAGE ──────────────────────────────────────────────
    console.log("⏱  0:00  Home page — loading...");
    await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(1500);

    // Let viewers read the stat block
    await sleep(7000); // hold for ~8 seconds total

    // ── [0:10–0:22]  ENTER USER MODE ───────────────────────────────────────
    console.log("⏱  0:10  Entering user mode");
    await safeTap(page.locator(".home-cta-primary"));
    await sleep(2500);

    // ── [0:22–0:40]  FILL INTAKE FORM ──────────────────────────────────────
    console.log("⏱  0:22  Filling intake form");

    // Need: shelter
    const selects = page.locator(".form-select");
    await selects.nth(0).selectOption("shelter");
    await sleep(700);

    // Who: already defaulted to "alone" — no change needed

    // Area: central Broward
    await selects.nth(2).selectOption("central");
    await sleep(700);

    // Submit
    await safeTap(page.locator(".btn-submit"));
    await sleep(2500);

    // ── [0:40–0:58]  RESULTS PANEL ─────────────────────────────────────────
    console.log("⏱  0:40  Results panel");
    await sleep(1000);

    // Scroll slowly through the first few cards
    await smoothScroll(page, 220, 1400);
    await sleep(900);
    await smoothScroll(page, 220, 1400);
    await sleep(1200);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(900);

    // ── [0:58–1:12]  "I'M HERE" CHECK-IN ───────────────────────────────────
    console.log("⏱  0:58  I'm Here check-in");

    const checkinBtn = page.locator(".btn-checkin").first();
    await safeTap(checkinBtn);
    await sleep(1800);

    // Tap "Yes, I got in"
    await safeTap(page.locator(".checkin-yes").first());
    await sleep(2500);

    // Close
    const resetLink = page.locator(".checkin-reset").first();
    if (await resetLink.isVisible()) await safeTap(resetLink);
    await sleep(900);

    // ── [1:12–1:25]  AI CALL SCRIPT ────────────────────────────────────────
    console.log("⏱  1:12  AI call script — generating...");

    const scriptBtn = page.locator(".btn-script").first();
    await safeTap(scriptBtn);

    // Wait up to 9 seconds for the Gemini response
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

    // Navigate back to intake
    await safeTap(page.locator(".nav-tab").nth(0));
    await sleep(900);

    // Open complex text mode
    await safeTap(page.locator(".btn-complex-toggle"));
    await sleep(700);

    // Type crisis phrase slowly so viewers can read it
    const textarea = page.locator(".form-textarea");
    await humanType(
      textarea,
      "I've been feeling like I don't want to live anymore and I need somewhere safe to sleep tonight",
      60
    );
    await sleep(1200);

    // Submit — crisis banner intercepts
    await safeTap(page.locator(".btn-submit"));
    await sleep(700);

    // Crisis banner should be visible — hold for viewers
    await sleep(5000);

    // Dismiss — runs the shelter search after
    const dismissBtn = page.locator(".crisis-dismiss");
    if (await dismissBtn.isVisible()) {
      await safeTap(dismissBtn);
    }
    await sleep(2000);

    // ── [1:40–1:55]  MAP + SAFE WAITING SPOTS ──────────────────────────────
    console.log("⏱  1:40  Map view — Safe Waiting Spots layer");

    await safeTap(page.locator(".nav-tab").nth(2)); // Map tab
    await sleep(3500); // Let Google Maps load

    // Toggle Safe Spots on
    const safeToggle = page.locator(".safe-spots-toggle");
    if (await safeToggle.isVisible()) {
      await safeTap(safeToggle);
      await sleep(3000); // Show the new markers
    }

    await sleep(2000);

    // ── [1:55–2:10]  OUTREACH MODE ─────────────────────────────────────────
    console.log("⏱  1:55  Outreach worker mode");

    await safeTap(page.locator(".btn-mode")); // Switch to Outreach
    await sleep(1500);

    const outreachInput = page.locator(".outreach-input");
    if (await outreachInput.isVisible()) {
      await humanType(outreachInput, "Veteran male substance abuse no ID", 50);
      await sleep(500);
      await safeTap(page.locator(".btn-outreach-search"));
      // Wait for AI results
      try {
        await page.locator(".service-card").first().waitFor({ timeout: 10000 });
      } catch {
        console.log("  (outreach results took too long — moving on)");
      }
      await sleep(2000);
    } else {
      await sleep(4000);
    }

    // ── [2:10–2:25]  LANGUAGE SWITCH TO SPANISH ────────────────────────────
    console.log("⏱  2:10  Language switch → Spanish");

    await safeTap(page.locator(".btn-mode")); // Back to user mode
    await sleep(900);

    // Click "ES" language button
    await safeTap(page.locator('.lang-btn:has-text("ES")'));
    await sleep(1200);

    // Show Results tab in Spanish
    await safeTap(page.locator(".nav-tab").nth(1));
    await sleep(1500);
    await smoothScroll(page, 180, 1000);
    await sleep(2000);

    // ── [2:25–2:30]  CLOSING SHOT ──────────────────────────────────────────
    console.log("⏱  2:25  Closing shot");

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1000);

    // Show the header / app logo as the final frame
    await sleep(5000);

  } finally {
    // ── SAVE & CLOSE ──────────────────────────────────────────────────────
    console.log("\n💾  Saving video — closing browser...");
    await context.close(); // This finalises the .webm file
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
  console.log("   → Use 'Rachel' voice, speed 0.95");
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
