import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const data = { soldSlots:847, myOwned:1, ownedTokenIds:[847], unitPriceUSDT:9999,
                 myListings:[{ tokenId:847, askPriceUSDT:25000, listedAt:Date.now() }] };
  try { localStorage.setItem('nexion-genesis', JSON.stringify({ type:'object', data })); } catch(e){}
  try { localStorage.removeItem('nexion-bills-v1'); } catch(e){}
});
await page.goto(BASE + '/#/pages/index/index', { waitUntil: 'networkidle' });

// Poll up to 30 ticks (~3 min worst case) but log each read
let fired = false;
for (let i=0;i<30;i++){
  await page.waitForTimeout(6300);
  const snap = await page.evaluate(()=>{
    try {
      const g = JSON.parse(localStorage.getItem('nexion-genesis'));
      const b = JSON.parse(localStorage.getItem('nexion-bills-v1'));
      const billsArr = b?.data?.bills ?? (Array.isArray(b?.data)?b.data:[]);
      const sold = (Array.isArray(billsArr)?billsArr:[]).filter(x=>String(x.ref||'').startsWith('GENESIS-SOLD'));
      return { listings: g?.data?.myListings?.length ?? -1, soldBills: sold.length, sample: sold[0] ? {memo:sold[0].memo, amount:sold[0].amount, symbol:sold[0].symbol} : null };
    } catch(e){ return { err: e.message }; }
  });
  if (snap.listings === 0 || snap.soldBills > 0) {
    console.log('tick', i, 'FIRED ->', JSON.stringify(snap));
    fired = true; break;
  }
}
console.log('genesis resale fired within window:', fired);
console.log('errors:', errors.length);
errors.slice(0,8).forEach(e=>console.log('  ',e));
await browser.close();
console.log('DONE');
