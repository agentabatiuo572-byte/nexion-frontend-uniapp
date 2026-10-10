import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import { compile } from '@vue/compiler-dom';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { zh } from '@/i18n/messages/zh';
import { en } from '@/i18n/messages/en';
import { vi } from '@/i18n/messages/vi';
import networkSource from '@/components/home/network-pulse-card.vue?raw';
import earnSource from '@/pages/earn/earn.vue?raw';
import deviceSource from '@/components/earn/device-card-pc.vue?raw';
import eventsSource from '@/pages/events/events.vue?raw';
import storeSource from '@/pages/store/store.vue?raw';
import ordinaryBundleSource from '@/pages/store/bundle.vue?raw';
import bundleSource from './promotion-bundle.vue?raw';
import checkoutSource from './promotion-checkout.vue?raw';
import ordinaryCheckoutSource from '@/pages/store/checkout.vue?raw';
import detailSource from '@/pages/store/detail.vue?raw';
import orderSource from '@/pages/store/order-detail.vue?raw';
import meSource from '@/pages/me/me.vue?raw';
import poolSource from '@/components/home/leadership-pool-card.vue?raw';
import poolPageSource from '@/pages/team/leadership-pool.vue?raw';
import poolHowSource from '@/pages/team/leadership-pool-how.vue?raw';
import teamSource from '@/pages/team/team.vue?raw';
import inviteSource from './referral-progress.vue?raw';
import rewardDetailSource from '@/pages/events/promotion-reward-detail.vue?raw';

const internal=/服务端|数据库|接口|投影|本地(?:数据|模拟|不会)|不会(?:猜测|用本地)|沿现有|server(?:[- ]side)?|database|backend|\bAPI\b|\bmock\b|\bfixture\b|\bfallback\b|existing (?:invite|product)|máy chủ|cơ sở dữ liệu|dữ liệu cục bộ|hiện có/i;
it.each([
  {locale:'zh',copy:zh,text:'当前算力暂不可用。'},
  {locale:'en',copy:en,text:'Current hashpower is unavailable.'},
  {locale:'vi',copy:vi,text:'Công suất hiện tại tạm thời chưa có.'},
])('$locale shared unavailable hashpower copy fits all three callers without claiming estimated specifications',({copy,text})=>{
  expect(deviceSource.match(/t(?:\.value)?\.earn\.hashCapabilityUnknown/g)).toHaveLength(3);
  expect(copy.earn.hashCapabilityUnknown).toBe(text);
});
const consumers:{key:string;sources:string[]}[]=[
  {key:'home.networkVerifiedMembers',sources:[networkSource]},
  {key:'home.networkVerifiedDevices',sources:[networkSource]},
  {key:'home.networkVerifiedScope',sources:[networkSource]},
  {key:'earn.summaryUnavailableBody',sources:[earnSource]},
  {key:'earn.hashCapabilityUnknown',sources:[deviceSource]},
  {key:'events.loadErrorBody',sources:[eventsSource]},
  {key:'store.catalogLoadingBody',sources:[storeSource,bundleSource,ordinaryBundleSource]},
  {key:'store.catalogEmptyBody',sources:[storeSource]},
  {key:'store.coAwaitingServer',sources:[ordinaryCheckoutSource]},
  {key:'store.purchaseEligibilityFailClosed',sources:[detailSource]},
  {key:'store.purchaseEligibilityNoFacts',sources:[detailSource]},
  {key:'orders.refreshing',sources:[orderSource,meSource]},
  {key:'trust.errorUnavailable',sources:[detailSource]},
  {key:'pool.loading',sources:[poolSource,teamSource,poolPageSource,poolHowSource]},
  {key:'promotion.existingInvite',sources:[inviteSource]},
];
it.each([{locale:'zh',copy:zh},{locale:'en',copy:en},{locale:'vi',copy:vi}])('$locale task-page copy has actual consumers and excludes internal explanations',({copy})=>{
  for(const {key,sources} of consumers){
    const [namespace,name]=key.split('.');
    const value=(copy as unknown as Record<string,Record<string,string>>)[namespace][name];
    expect(value,key).toBeTruthy();expect(value,key).not.toMatch(internal);
    for(const source of sources)expect(source,key).toContain(key);
  }
  expect(copy.promotion).not.toHaveProperty('statusRead');expect(copy.promotion).not.toHaveProperty('specNote');
  expect(rewardDetailSource).not.toContain('p.statusRead');expect(rewardDetailSource).toContain('p.existingInvite');
});

const render=new Function('Vue',compile(parse(rewardDetailSource).descriptor.template!.content,{mode:'function',prefixIdentifiers:true,isCustomElement:tag=>['view','text'].includes(tag)}).code)(Vue);
it.each([{locale:'zh',copy:zh},{locale:'en',copy:en},{locale:'vi',copy:vi}])('$locale real reward-detail template keeps result, conditions and invitation without internal prose',async({locale,copy})=>{
  const html=await renderToString(Vue.createSSRApp({render,components:{
    AppChassis:{setup:(_props:unknown,{slots}:Vue.SetupContext)=>()=>Vue.h('view',slots.default?.())},
    RewardRows:{render:()=>null},DisclosureDetails:{render:()=>null},
  },setup:()=>({loading:false,error:false,id:'reward',progress:{qualifyingOrders:1},
    reward:{orderNo:'original-order',state:'ISSUED',beneficiaryRole:'DIRECT_INVITER',disclosure:{title:{zh:'实际奖励',en:'Earned reward',vi:'Phần thưởng đã nhận'}},assetReceipt:null},
    p:copy.promotion,t:copy,locale:{code:locale},localized:(text:Record<string,string>)=>text[locale],displayDeadline:()=>'',load:()=>{},navTo:()=>{},
  })}));
  expect(html).toContain(copy.promotion.rights);expect(html).toContain(copy.promotion.assetPending);
  expect(html).toContain(copy.promotion.existingInvite);expect(html).toContain(copy.promotion.privacy);
  expect(html).not.toMatch(internal);
});

const ast=ts.createSourceFile('checkout.ts',parse(checkoutSource).descriptor.scriptSetup!.content,ts.ScriptTarget.Latest,true);
const run=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='run')!;
const runCode=ts.transpileModule(run.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
it.each([{locale:'zh',copy:zh},{locale:'en',copy:en},{locale:'vi',copy:vi}])('$locale real checkout failure mapping never renders an original API diagnostic',async({copy})=>{
  const error=Vue.ref(''),deps={busy:Vue.ref(false),current:()=>true,error,p:Vue.ref(copy.promotion),revision:Vue.ref(0),updateClock:()=>{},asApiError:(cause:unknown)=>({message:String(cause)})};
  const actual=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${runCode};return run;`)(deps) as (action:()=>Promise<void>)=>Promise<void>;
  for(const diagnostic of ['DATABASE_CONNECTION_TOKEN','HTTP_500_INTERNAL_DETAIL','ACCOUNT_SCOPE_CHANGED']){
    await actual(async()=>{throw new Error(diagnostic);});
    expect(error.value).toBe(copy.promotion.errorNote);expect(error.value).not.toContain(diagnostic);expect(error.value).not.toMatch(internal);
  }
});
