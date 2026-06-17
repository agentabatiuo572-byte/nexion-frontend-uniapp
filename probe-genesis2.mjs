import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });
// Inspect how uni stores genesis: write via uni API path by checking existing key shape.
const before = await page.evaluate(()=>{ return Object.keys(localStorage).filter(k=>k.includes('genesis')||k.includes('milestone')); });
console.log('genesis/milestone keys present:', JSON.stringify(before));

// Seed both raw plain AND uni-wrapped shapes to cover whichever the store reads.
await page.evaluate(() => {
  const data = { soldSlots:847, myOwned:1, ownedTokenIds:[847], unitPriceUSDT:9999,
                 myListings:[{ tokenId:847, askPriceUSDT:25000, listedAt:Date.now() }] };
  try { localStorage.setItem('nexion-genesis', JSON.stringify({ type:'object', data })); } catch(e){}
});
await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Read what the store actually hydrated by calling uni.getStorageSync semantics via the same key.
const hydrated = await page.evaluate(()=>{
  try {
    const raw = localStorage.getItem('nexion-genesis');
    const parsed = JSON.parse(raw);
    // uni H5 stores {type,data}; getStorageSync returns parsed.data
    return JSON.stringify({ raw_has_listings: parsed?.data?.myListings?.length });
  } catch(e){ return 'ERR '+e.message; }
});
console.log('seeded genesis listings count in storage:', hydrated);
await browser.close();
console.log('DONE errors=', errors.length);
