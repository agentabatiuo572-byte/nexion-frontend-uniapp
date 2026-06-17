import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const errors = [];
const logs = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => {
  const t = m.type();
  const txt = m.text();
  logs.push(`[${t}] ${txt}`);
  if (t === 'error') errors.push(txt);
});
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// 1) Load home, clear quest/milestone storage so we start clean
await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Clear quest + milestone localStorage so this run is deterministic, then reload.
await page.evaluate(() => {
  try {
    localStorage.removeItem('nexion-quest-v1');
    localStorage.removeItem('nexion-milestones-v1');
  } catch {}
});
await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('STEP1 home loaded, errors so far:', errors.length);

// 2) Navigate to /earn — should auto-complete visit_earn quest -> toast + NEX credit
await page.goto(BASE + '/#/pages/earn/earn', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500); // > QUEST_TICK_MS(1s)

// 3) Navigate to /store — should auto-complete visit_store quest
await page.goto(BASE + '/#/pages/store/store', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// 4) Navigate to /store/detail?id=stellarbox-s1 — should auto-complete view_product_roi
await page.goto(BASE + '/#/pages/store/detail?id=nexionbox-s1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Read quest completed map from localStorage
const questState = await page.evaluate(() => {
  try { return localStorage.getItem('nexion-quest-v1'); } catch { return null; }
});
console.log('STEP-quest localStorage nexion-quest-v1 =', questState);

// 5) Let ORDER_TICK + milestone polls run a bit more on a stable page
await page.waitForTimeout(7000); // > one ORDER_TICK(6s) + milestone(4s)

const milestoneState = await page.evaluate(() => {
  try { return localStorage.getItem('nexion-milestones-v1'); } catch { return null; }
});
console.log('STEP-milestone localStorage nexion-milestones-v1 =', milestoneState);

// Count quest/genesis/milestone-related toasts seen in console (vue devtools may not log; we just check no errors)
console.log('--- TOTAL console errors:', errors.length);
if (errors.length) {
  console.log('--- ERROR DUMP ---');
  errors.slice(0, 20).forEach(e => console.log('  ', e));
}

await browser.close();
console.log('DONE');
