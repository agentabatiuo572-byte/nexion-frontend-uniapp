import { afterEach, expect, it, vi } from "vitest";
import * as Vue from "vue";
import { parse, compileScript } from "@vue/compiler-sfc";
import ts from "typescript";
import source from "./compute-settlements.vue?raw";
import { computeV2Copy } from "@/i18n/compute-v2";
import { ApiError } from "@/api/errors";
import { formatAmount } from "@/lib/amount-display";

const compiled=ts.transpileModule(compileScript(parse(source).descriptor,{id:"compute-settlements-test"}).content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const stops:Array<()=>void>=[];
afterEach(()=>stops.splice(0).forEach(stop=>stop()));
function deferred() { let resolve!:(value:any)=>void; const promise=new Promise<any>(r=>resolve=r); return {promise,resolve}; }
async function flush() { for(let i=0;i<8;i++)await Promise.resolve();await Vue.nextTick(); }
async function mount(api:{settlements:any;settlement:any}) {
  const app=Vue.reactive({accountKey:"A",accountBindingEpoch:1,remoteComputeProtocolVersion:1,remotePendingEarned:null,remoteAssignmentStatus:"ready",remoteAssignmentHasSnapshot:true});
  const shows:Function[]=[],hides:Function[]=[];
  const module={exports:{} as any};
  new Function("require","exports",compiled)((id:string)=>{
    if(id==="vue")return Vue;
    if(id==="@/composables/use-tab-page-lifecycle")return {onShow:(callback:Function)=>shows.push(callback),onHide:(callback:Function)=>hides.push(callback)};
    if(id==="@/api/runtime")return {remoteApiEnabled:true,taskAssignmentApi:api};
    if(id==="@/api/errors")return {ApiError};
    if(id==="@/store/app")return {useApp:()=>app};
    if(id==="@/i18n/compute-v2")return {useComputeV2Copy:()=>Vue.ref(computeV2Copy.en)};
    if(id==="@/store/data-visibility")return {useDataVisibility:()=>({mask:String})};
    if(id==="@/lib/display-date")return {formatDisplayDateTime:String};
    if(id==="@/i18n/format")return {dateLocale:()=>"en-US"};
    if(id==="@/lib/amount-display")return {formatAmount};
    throw new Error("UNEXPECTED_IMPORT "+id);
  },module.exports);
  const renderer=Vue.createRenderer<any,any>({insert:()=>{},remove:()=>{},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null,patchProp:()=>{}});
  let state:any;
  const component=module.exports.default;
  const mounted=renderer.createApp({...component,setup:(props:any,ctx:any)=>{state=component.setup(props,ctx);return()=>null;}});
  mounted.mount({});stops.push(()=>mounted.unmount());shows.forEach(show=>show());await flush();
  return {app,state,hide:()=>hides.forEach(hide=>hide())};
}

it("keeps posted settlement history readable when assignments use v1 after admission is disabled",async()=>{
  const settlements=vi.fn().mockResolvedValue({records:[{batchNo:"A-batch"}],nextCursor:null});
  const view=await mount({settlements,settlement:vi.fn()});
  expect(view.state.historyAvailable.value).toBe(true);
  expect(view.state.batches.value).toEqual([{batchNo:"A-batch"}]);
  expect(settlements).toHaveBeenCalledTimes(1);
});

it("suppresses only explicit endpoint-unavailable and keeps authentication failures visible",async()=>{
  const absent=await mount({settlements:vi.fn().mockRejectedValue(new ApiError({kind:"http",status:404,message:"ABSENT"})),settlement:vi.fn()});
  expect(absent.state.historyAvailable.value).toBe(false);expect(absent.state.error.value).toBe(false);
  const denied=await mount({settlements:vi.fn().mockRejectedValue(new ApiError({kind:"auth",status:401,message:"AUTH"})),settlement:vi.fn()});
  expect(denied.state.historyAvailable.value).toBe(true);expect(denied.state.error.value).toBe(true);
});

it("clears batches and ignores the previous account's slow list response",async()=>{
  const old=deferred();const settlements=vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({records:[{batchNo:"B-batch"}],nextCursor:null});
  const view=await mount({settlements,settlement:vi.fn()});
  view.app.accountKey="B";view.app.accountBindingEpoch++;await flush();
  old.resolve({records:[{batchNo:"A-batch"}],nextCursor:null});await flush();
  expect(view.state.batches.value).toEqual([{batchNo:"B-batch"}]);
});

it("does not reopen a batch detail after hiding the page",async()=>{
  const old=deferred();const view=await mount({settlements:vi.fn().mockResolvedValue({records:[],nextCursor:null}),settlement:vi.fn().mockReturnValue(old.promise)});
  const pending=view.state.openBatch("A-batch");view.hide();old.resolve({batchNo:"A-batch",items:[]});await pending;await flush();
  expect(view.state.detail.value).toBeNull();expect(view.state.historyAvailable.value).toBe(false);
});
