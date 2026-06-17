import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// Seed a genesis listing BEFORE load so the resale path can fire.
await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  try {
    localStorage.setItem('nexion-genesis', JSON.stringify({
      type:'object',
      data:{ soldSlots:847, myOwned:1, ownedTokenIds:[847], unitPriceUSDT:9999,
             myListings:[{ tokenId:847, askPriceUSDT:25000, listedAt:Date.now() }] }
    }));
    localStorage.removeItem('nexion-milestones-v1');
    localStorage.removeItem('nexion-bills-v1');
  } catch(e){}
});
await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });

// ORDER_TICK is 6s with 0.18 chance — wait up to ~60s for a resale (≈statistically certain).
let listingGone = false;
for (let i=0;i<12;i++){
  await page.waitForTimeout(6500);
  const g = await page.evaluate(()=>{ try{ const r=JSON.parse(localStorage.getItem('nexion-genesis')); return r?.data?.myListings?.length ?? -1;}catch{return -2;} });
  if (g === 0) { listingGone = true; break; }
}
console.log('GENESIS resale fired (listing cleared):', listingGone);

// Check a genesis-sold bill landed
const bills = await page.evaluate(()=>{ try{ const r=JSON.parse(localStorage.getItem('nexion-bills-v1')); const arr=r?.data?.bills ?? r?.data ?? []; return JSON.stringify((Array.isArray(arr)?arr:[]).filter(b=>String(b.ref||'').startsWith('GENESIS-SOLD')).slice(0,2)); }catch(e){return 'ERR '+e.message;} });
console.log('GENESIS-SOLD bills:', bills);

// Check overlay component is mounted in DOM (milestone-celebration host present)
const overlayHost = await page.evaluate(()=> {
  // global-ui mounts the overlay; check the celebration element class exists in DOM tree (v-if may be false now)
  return document.body.innerHTML.includes('milestone') ? 'overlay-host-present-keyword' : 'no-keyword';
});
console.log('overlay check:', overlayHost);

console.log('TOTAL console errors:', errors.length);
errors.slice(0,10).forEach(e=>console.log('  ',e));
await browser.close();
console.log('DONE');
