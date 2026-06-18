// Screenshot-Skript (Playwright). Nimmt Landing, Login und die vier
// Dashboard-Tabs nach Login mit dem Seed-Demo-User auf.
// Lauf: NODE_PATH=/opt/node22/lib/node_modules node scripts/screenshots.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

// Next.js Dev-Indikator ausblenden, damit die Screenshots sauber sind.
const HIDE_DEV = `
  nextjs-portal, #__next-build-watcher, [data-nextjs-dev-tools-button],
  [data-nextjs-toast] { display: none !important; }
`;

async function shoot(page, name, { fullPage = false } = {}) {
  await page.addStyleTag({ content: HIDE_DEV }).catch(() => {});
  await page.waitForTimeout(700);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log("✓", file);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1) Landingpage
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shoot(page, "01-landing", { fullPage: false });

  // 2) Login
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await shoot(page, "02-login", { fullPage: false });

  // 3) Programmatischer Login über den NextAuth-Credentials-Endpoint
  //    (robuster als UI-Login, unabhängig von der Hydration im Dev-Modus).
  const csrf = await context.request.get(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  await context.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: "demo@localhub.app",
      password: "password123",
      callbackUrl: `${BASE}/dashboard`,
    },
  });

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 60000 });
  if (!page.url().includes("/dashboard")) {
    throw new Error(`Login fehlgeschlagen, gelandet auf: ${page.url()}`);
  }
  await page.waitForTimeout(1500);

  // 4) Dashboard-Tabs. Klick wird wiederholt, bis der Tab aktiv ist
  //    (deckt verzögerte Hydration im Dev-Modus ab).
  async function selectTab(label) {
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.getByRole("tab", { name: label, exact: true }).click().catch(() => {});
      try {
        await page.waitForFunction(
          (l) => {
            const el = [...document.querySelectorAll('[role="tab"]')].find(
              (b) => b.textContent.trim() === l,
            );
            return el && el.getAttribute("aria-selected") === "true";
          },
          label,
          { timeout: 1500 },
        );
        return;
      } catch {
        await page.waitForTimeout(500);
      }
    }
    throw new Error(`Tab nicht aktivierbar: ${label}`);
  }

  const tabs = [
    ["Form & Planung", "03-dashboard-form"],
    ["Kalender", "07-dashboard-kalender"],
    ["Analyse", "04-dashboard-analyse"],
    ["Training & Material", "05-dashboard-training"],
    ["Austausch & Sync", "06-dashboard-austausch"],
  ];
  for (const [label, name] of tabs) {
    await selectTab(label);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot(page, name, { fullPage: true });
  }

  // Kalender-Detail-Modal: gezielt der morgige Tag (geplante Intervall-Einheit
  // mit Leistungsprofil); Fallback auf den ersten Tag mit Einheiten.
  await selectTab("Kalender");
  await page.waitForTimeout(800);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  let dayBtn = page.locator(`[aria-label^="${tomorrowIso}"][aria-label*="Details"]`).first();
  if (!(await dayBtn.count())) {
    dayBtn = page.locator('[aria-label*="Details öffnen"]').first();
  }
  if (await dayBtn.count()) {
    await dayBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    await shoot(page, "08-calendar-modal", { fullPage: false });
  }

  await browser.close();
  console.log("Fertig.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
