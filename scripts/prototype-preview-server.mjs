// Loopback-only presentation server. No request is proxied to a real backend.
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { installFormalProbeSession } from './lib/formal-probe-session.mjs';
import { demoDefaults, demoFixture, demoOptions } from './lib/prototype-demo-data.mjs';
import { createPrototypeMessages } from './lib/prototype-message-demo.mjs';
import { createPrototypeRealtime } from './lib/prototype-realtime.mjs';
import { createCheckoutFlowFixture } from './lib/checkout-flow-fixture.mjs';
const root=path.resolve(process.env.DEMO_BUILD_ROOT||path.join(import.meta.dirname,'../dist/build/h5'));
const port=Number(process.env.DEMO_PORT||5190);
const state=structuredClone(demoDefaults),routes=[],init=[];
// An optional local handoff preserves demo conversations across a preview rebuild.
if(process.env.DEMO_STATE_FILE)Object.assign(state,JSON.parse(await readFile(process.env.DEMO_STATE_FILE,'utf8')).state);
let locale='zh';
// Purchases need the payment PIN and order commands, so the preview models them
// unless DEMO_CHECKOUT_FLOW=0.
// Continue from an imported epoch, so the first scenario change never reuses it.
let scenarioEpoch=state.scenarioEpoch??0;
const checkoutFlow=process.env.DEMO_CHECKOUT_FLOW!=='0'?createCheckoutFlowFixture(state,()=>locale):null;
const fixtureFor=(url,request)=>demoFixture(url,locale,state,request);
const messages=createPrototypeMessages({state,fixtureFor});
const realtime=createPrototypeRealtime({state,messages,fixtureFor});
await installFormalProbeSession({addInitScript:async(fn,arg)=>init.push('('+fn.toString()+')('+JSON.stringify(arg)+');'),route:async(matcher,handler)=>routes.push({matcher,handler}),routeWebSocket:realtime.routeWebSocket},{responseFor:fixtureFor});
const seed='<script>'+init.join('\n')+"for(const [key,data] of [['nexgrid-locale-v1',{code:'zh',userSet:true}],['nexgrid-theme-v1',{mode:'dark'}]]){if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({type:'object',data}));}</script>";
// Browser records a scenario owns (design rule at demoSeedFleet): the App's account-scoped order, checkout, payment,
// trade-in and trial commands, recovery rows and caches. The payment PIN, profile, cart and preferences belong to the
// account and stay.
const scenarioStorageKeys=['nexgrid-orders-accounts-v1','nexgrid-order-action-accounts-v1','nexgrid-pending-checkout-accounts-v1','uvel-checkout-create-recovery-v1','nexgrid-checkout-server-order-recovery-v1','nexgrid-checkout-receipt-recovery-v1','nexgrid-remote-checkout-commands-v1','nexgrid-bundle-order-command-v1','nexgrid-bundle-receipt-recovery-v1','nexgrid-promotion-checkout-v1','nexgrid-promotion-commands-v1','uvel-purchase-payment-accounts-v1','uvel-purchase-payment-keys-accounts-v1','nexgrid-e3-capacity-payment-accounts-v1','nexgrid-e3-capacity-commands-accounts-v1','nexgrid-trial-accounts-v1','nexgrid-trial-convert-accounts-v1'];
const serverRun=Date.now().toString(36);
// The scenario a page or a reply belongs to: this server run and its scenario epoch.
const scenarioId=()=>serverRun+':'+(state.scenarioEpoch??0);
// Runs in every App page before the App starts (design rule at demoSeedFleet). It drops the records of another
// scenario, makes every same-origin request carry this page's scenario, and reloads the page when a reply comes from
// another scenario or another page has entered one, so a page of an old scenario never acts in the new one.
function previewScenarioPage(scenario,keys){
  if(localStorage.getItem('uvel-preview-scenario')!==scenario){for(const key of keys)localStorage.removeItem(key);localStorage.setItem('uvel-preview-scenario',scenario);}
  // A record this page wrote after its scenario ended goes with it, also when another page has already entered the new one.
  const follow=value=>{if(value&&value!==scenario){for(const key of keys)localStorage.removeItem(key);location.reload();}};
  addEventListener('storage',event=>{if(event.key==='uvel-preview-scenario')follow(event.newValue);});
  const local=target=>{try{return new URL(target,location.href).origin===location.origin;}catch{return false;}};
  const {open,send}=XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open=function(method,target,...rest){this.previewLocal=local(target);return open.call(this,method,target,...rest);};
  XMLHttpRequest.prototype.send=function(body){
    if(this.previewLocal){this.setRequestHeader('X-Preview-Scenario',scenario);this.addEventListener('loadend',()=>follow(this.getResponseHeader('X-Preview-Scenario')));}
    return send.call(this,body);
  };
  const nativeFetch=window.fetch;
  window.fetch=function(input,init){
    if(!local(input instanceof Request?input.url:String(input)))return nativeFetch.call(this,input,init);
    const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));headers.set('X-Preview-Scenario',scenario);
    return nativeFetch.call(this,input,{...init,headers}).then(response=>{follow(response.headers.get('X-Preview-Scenario'));return response;});
  };
}
const scenarioSeed=()=>'<script>('+previewScenarioPage+')('+JSON.stringify(scenarioId())+','+JSON.stringify(scenarioStorageKeys)+');</script>';
const mime={'.ico':'image/x-icon','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.mp4':'video/mp4'};
const sendJson=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':mime['.json'],'X-Preview-Scenario':scenarioId()});res.end(JSON.stringify(value));};
const modeledWrite=/^\/(auth\/users\/refresh|api\/(me\/notification-preferences|goals(?:\/\d+(?:\/status)?)?|orders(?:\/(quote|bundle|DEMO-ORDER-\d+\/(pay|cancel)))?|withdrawals\/eligibility|points\/sign-in|points\/streak-saver\/use|earnings\/milestones\/evaluate|points\/milestones\/\d+\/claim|points\/power-ups\/\d+\/activate|quests\/[^/]+\/claim|trial\/start|vouchers\/V-DESIGN\/claim|events\/demo-[^/]+\/(join|claim|spin|reminder)|events\/genesis-raffle\/demo-draw-0\/enter|content\/trust\/sections\/[^/]+\/view|content\/learning\/courses\/review-course-\d\/(start|complete|quiz)|notifications\/(read|read-all|\d+\/(read|actions))|app\/support\/conversations(?:\/DEMO-SUPPORT-\d+\/(read|replies|dismiss))?|app\/team\/ambassador-applications|app\/profile(?:\/language)?|app\/compute-share\/enrollments|app\/trade-in\/(eligibility|quote|capacity-quote|submit)))$/;
const server=http.createServer(async(req,res)=>{
  // A write belongs to the scenario it started in: one whose body arrives after a scenario change is refused, and so
  // is any request from a page of another scenario (checked below).
  const startedIn=state.scenarioEpoch;
  const staleWrite=()=>req.method!=='GET'&&state.scenarioEpoch!==startedIn;
  const refuseStale=()=>sendJson(res,{code:409,message:'演示场景已切换，此操作未执行，请刷新页面',data:null},409);
  try {
    const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
    res.setHeader('Cache-Control','no-store');
    if(checkoutFlow&&url.pathname==='/__checkout/state'){
      if(req.method==='POST'){
        let raw='';for await(const chunk of req)raw+=chunk;const update=JSON.parse(raw||'{}');
        if(update.resetPin){checkoutFlow.pin.state.password=null;checkoutFlow.pin.state.version=0;checkoutFlow.pin.state.attempts=5;checkoutFlow.pin.state.lockedUntil=null;}
        if(typeof update.dropNextPayment==='boolean')checkoutFlow.pin.state.dropNextPayment=update.dropNextPayment;
      }
      return sendJson(res,{simulation:true,payWrites:checkoutFlow.pin.state.payWrites,configured:checkoutFlow.pin.state.password!==null,orders:state.createdOrders??[]});
    }
    if(url.pathname==='/preview'){res.setHeader('Content-Type',mime['.html']);return res.end(await readFile(path.join(import.meta.dirname,'prototype-preview.html')));}
    if(url.pathname==='/__demo/state') {
      if(req.method==='POST') {
        let body='';for await(const chunk of req)body+=chunk;
        const accountPayment=value=>['low-balance','urgent','late'].includes(value)?value:'';
        const update=JSON.parse(body||'{}'),wasEmpty=state.dataState==='empty',wasPayment=accountPayment(state.paymentState),wasTrialQuote=state.trialQuoteState;
        if(update.reset){for(const key of Object.keys(state))delete state[key];Object.assign(state,structuredClone(demoDefaults));}
        for(const [key,options] of Object.entries(demoOptions)) if(options.some(([value])=>value===update[key]))state[key]=update[key];
        // Scenario knobs start a fresh scenario (design rule at demoSeedFleet): the old scenario's purchases, orders,
        // trade-ins, trial and payment intents go, and the next read seeds the fleet. Entering or leaving the empty
        // account (dataState=empty), the low-balance account or a near-deadline sample (paymentState=low-balance, urgent,
        // late) is one too. Presentation knobs keep them.
        // Precision <-> precision-repriced only changes live promo policy: keep the confirmed claim and page epoch.
        const quotePolicyChange=['precision','precision-repriced'].includes(wasTrialQuote)&&['precision','precision-repriced'].includes(state.trialQuoteState);
        const scenarioChange=['fleetState','checkoutState','trialState','benefitState','trialQuoteState'].some(key=>key in update&&(key!=='trialQuoteState'||!quotePolicyChange))||(state.dataState==='empty')!==wasEmpty||accountPayment(state.paymentState)!==wasPayment;
        if(scenarioChange)for(const key of ['fleetSeed','sampleOrdersAt','createdOrders','orderStatuses','retiredDeviceIds','deviceIds','deviceSequence','commands','quotes','walletBalance','trialRow','trialCommands','trialStartFailed','trialOrderNo','lastTrialConversion','lastTrialPaymentQuote','intentOrders'])delete state[key];
        // The empty account's wallet holds nothing and the low-balance account's 820.64: facts every wallet payment
        // checks, not only numbers on screen.
        if(scenarioChange&&state.bankDemo)Object.assign(state.bankDemo,{quotes:{},orders:{},commands:{}});
        if(scenarioChange&&state.dataState==='empty')state.walletBalance=0;
        else if(scenarioChange&&state.paymentState==='low-balance')state.walletBalance=820.64;
        if(update.reset||scenarioChange)state.scenarioEpoch=++scenarioEpoch;
        if(update.taskState)for(const key of ['weekClaims','dayOneClaimed'])delete state[key];
        if(update.riskState)delete state.riskDemo;
        if(update.streakState){delete state.saverUsed;state.checkedIn=false;state.milestoneClaims=[];}
        if(typeof update.allCoursesDone==='boolean'){delete state.learningResults;delete state.learningReceipts;}
        if(update.ambassadorState)for(const key of ['ambassadorSubmission','ambassadorCommands'])delete state[key];
        if(update.eventState)for(const key of ['eventStatuses','reminders','spun','spinHistory','raffleEntries'])delete state[key];
        if(update.raffleState){state.raffleScenarioAt=Date.now();delete state.raffleEntries;}
        if(update.promotionTiming)state.promotionTimingAt=Date.now();
        if(update.benefitState)for(const key of ['trialStarted','voucherClaimed','voucherUsed'])delete state[key];
        if(typeof update.highestRank==='boolean')state.highestRank=update.highestRank;
        if(typeof update.allCoursesDone==='boolean')state.completed=update.allCoursesDone?[1,2,3]:[];
        realtime.stateChanged(update);
      }
      return sendJson(res,{state,options:demoOptions,simulation:true});
    }
    if(url.pathname==='/preview-language'){locale=['zh','en','vi'].includes(url.searchParams.get('code'))?url.searchParams.get('code'):'zh';if(state.profile)state.profile.language=locale;return res.end('OK');}
    if(req.method==='GET'&&/^\/api\/promotions\/demo-promo-\d+\/banner\/[1-9][0-9]*$/.test(url.pathname)){res.setHeader('Content-Type','image/png');return res.end(await readFile(path.join(root,'static/promotion/purchase-gift-reference.png')));}
    const trustFile=req.method==='GET'&&url.pathname.match(/^\/api\/content\/trust\/documents\/(incorporation|msb|ein)\/file$/);
    if(trustFile&&process.env.DEMO_TRUST_DOCUMENTS_DIR){
      const entry=fixtureFor(new URL('/api/content/trust/documents',url.origin),{method:()=>'GET',postDataJSON:()=>({}),headers:()=>req.headers}).documents.find(item=>item.slot===trustFile[1]);
      res.setHeader('Content-Type','application/pdf');return res.end(await readFile(path.join(process.env.DEMO_TRUST_DOCUMENTS_DIR,entry.fileName)));
    }
    const trustPage=req.method==='GET'&&url.pathname.match(/^\/api\/content\/trust\/documents\/(whitepaper|incorporation|msb|ein)\/pages\/([1-9][0-9]?)$/);
    if(trustPage&&process.env.DEMO_TRUST_DOCUMENTS_DIR){res.setHeader('Content-Type','image/jpeg');return res.end(await readFile(path.join(process.env.DEMO_TRUST_DOCUMENTS_DIR,'pages',trustPage[1],`${trustPage[2]}.jpg`)));}
    if(url.pathname==='/api/app/support/advisor/avatar/1'&&req.method==='GET'){res.setHeader('Content-Type','image/webp');return res.end(await readFile(path.join(import.meta.dirname,'fixtures/demo-advisor-photo.webp')));}
    if(url.pathname==='/api/app/support/attachments/demo-image/content'&&req.method==='GET'){res.setHeader('Content-Type','image/webp');return res.end(await readFile(path.join(root,'static/img/home-glass-20260928/s1.webp')));}
    if(/^\/(api|auth)\//.test(url.pathname)) {
      const page=req.headers['x-preview-scenario'];
      if(page&&page!==scenarioId())return refuseStale();
      if(checkoutFlow?.handles(url.pathname)){
        let raw='';for await(const chunk of req)raw+=chunk;
        if(staleWrite())return refuseStale();
        const response=checkoutFlow.handle(url,{method:()=>req.method,headers:()=>req.headers,postDataJSON:()=>raw?JSON.parse(raw):{}});
        if(response.drop){res.destroy();return;}
        return sendJson(res,{code:response.status===200?0:response.status,message:response.message,data:response.data},response.status);
      }
      // The signed-out switch refuses the refresh, so the App boots with no session at all.
      if(url.pathname==='/auth/users/refresh'&&state.sessionState==='signed-out')return sendJson(res,{code:401,message:'AUTH_REQUIRED',data:null},401);
      if(url.pathname==='/auth/users/refresh')return sendJson(res,{code:0,message:'OK',data:{accessToken:'local-demo-token',refreshToken:null,tokenType:'Bearer',user:{userId:900001,countryCode:'+86',phone:'13800000000',nickname:'Alex',onboardingComplete:true}}});
      const modeledBankWrite=/^\/api\/(withdrawals\/bank\/(beneficiary(?:\/otp)?|quotes(?:\/BQ-[a-f0-9]{32}\/abandon)?|orders)|payout-addresses(?:\/otp\/send)?)$/.test(url.pathname);
      const realtimeTicket=req.method==='POST'&&url.pathname==='/api/app/support/realtime-ticket';
      const trialWrite=req.method==='POST'&&/^\/api\/trial\/(start|cancel|convert)$/.test(url.pathname);
      // AppStakingService.open refuses an unacknowledged risk disclosure before recording the command.
      if(req.method==='POST'&&url.pathname==='/api/stakes'&&state.stakingOpenState==='disclosure')return sendJson(res,{code:409,message:'RISK_DISCLOSURE_ACK_REQUIRED',data:null});
      const conversationDelete=req.method==='DELETE'&&/^\/api\/app\/support\/conversations\/DEMO-SUPPORT-\d+$/.test(url.pathname);
      if(req.method!=='GET'&&!realtimeTicket&&!trialWrite&&!conversationDelete&&!modeledWrite.test(url.pathname)&&!modeledBankWrite&&url.pathname!=='/api/legal/risk-disclosure/acknowledgment')return sendJson(res,{code:409,message:'该演示操作尚未配置，请使用外侧面板切换状态',data:null},409);
      const businessRead=req.method==='GET'&&/^\/api\/(config\/(platform|v-rank|exchange|repurchase|staking|commission)|store\/(catalog|purchase-eligibility)|team\/(rank|binary)|app\/(team|payments|deposits|home\/overview|proof|network|security|support|developer)|content\/(learning|trust|how-it-works)|quests\/state|events|points\/state|devices\/earnings|exchange|repurchase|withdrawals|payout-addresses|deposits|notifications|goals|promotions|promotion-rewards|tasks|payment-methods|developer|public\/referrals|legal\/(privacy|risk)|staking|stakes)/.test(url.pathname);
      if(businessRead&&state.dataState==='error')return sendJson(res,{code:503,message:'暂时无法加载，请重试',data:null},503);
      if(businessRead&&state.dataState==='loading')await new Promise(resolve=>setTimeout(resolve,5000));
      let body='';for await(const chunk of req)body+=chunk;
      if(staleWrite())return refuseStale();
      if(conversationDelete) {
        const data=fixtureFor(url,{method:()=>req.method,postDataJSON:()=>JSON.parse(body||'{}'),headers:()=>req.headers});
        return sendJson(res,{code:0,message:'OK',data});
      }
      if(messages.matches(url,req.method)) {
        const result=await messages.request(url,{method:()=>req.method,postDataJSON:()=>JSON.parse(body||'{}'),headers:()=>req.headers});
        return sendJson(res,result.body,result.status);
      }
      if(url.pathname==='/api/legal/terms/current')return sendJson(res,{code:0,message:'OK',data:demoFixture(url,locale,state,{method:()=>req.method,postDataJSON:()=>({}),headers:()=>req.headers})});
      for(const route of [...routes].reverse()) {
        if(route.matcher!=='**/*'&&!route.matcher(url))continue;
        await route.handler({request:()=>({url:()=>url.href,method:()=>req.method,headers:()=>req.headers,postDataJSON:()=>JSON.parse(body||'{}')}),fulfill:async response=>{res.writeHead(response.status||200,{'Content-Type':response.contentType||mime['.json'],'X-Preview-Scenario':scenarioId()});res.end(response.body);},continue:async()=>{}});
        if(res.writableEnded)return;
      }
      return sendJson(res,{code:404,message:'暂无演示内容',data:null},404);
    }
    let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    if(url.pathname==='/'||(await stat(file).catch(()=>null))?.isDirectory())file=path.join(file,'index.html');
    const bytes=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.end(path.extname(file)==='.html'?bytes.toString().replace('<head>','<head>'+scenarioSeed()+seed):bytes);
  }catch(error){console.error(req.method,req.url,error.message);if(Number.isInteger(error.status)&&error.status>=400&&error.status<600)return sendJson(res,{code:error.status,message:error.message,data:null},error.status);res.writeHead(error.code==='ENOENT'?404:500);res.end('Preview resource unavailable');}
});
realtime.attach(server);
server.listen(port,'127.0.0.1',()=>console.log('UVEL simulation: http://127.0.0.1:'+server.address().port+'/preview'));
