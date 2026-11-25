// 我的等级改版的原型夹具预设（team-rank DESIGN 第 5、6、12.0 节），只由演示服务读取，不进 App 包。
// 三个独立开关：rankPreset（等级 V0–V8，follow 为原有演示数据）、rankSalaryState（有月薪／没有 salary 字段／月薪读取失败）、
// rankReviewState（V8 带 reviewRequired 与否）。三种数据状态可以同时成立（12.0）。
// 数值全部由下面一张表按一条规则推出：预设 Vn 的用户满足 V1–Vn 的全部条件；朝 Vn+1 的每项数值条件走到
// 本级门槛与下一级门槛之间的 60%（向下取整，所以下一级每项都未满足）；V8 停在 V8 门槛。后续状态在这里加。
import { demoTeamBusinessDate } from './prototype-demo-events.mjs';
import { previewSelectedAccountId } from './prototype-demo-identity.mjs';

// 等级 · 自购算力点 · 团队算力点 · 一二级已购人数 · [下级领导者等级, 人数] · 晋级 UVT · 好友购买一级 · 二级 · 月薪 USDT（rank-rules.md）
export const RANK_RULES=[
  [0,0,0,0,null,0,.04,.02,'0'],
  [1,149,0,0,null,100,.04,.02,'0'],
  [2,299,1499,5,[1,5],500,.042,.021,'20'],
  [3,1599,15999,19,[2,1],2000,.044,.022,'50'],
  [4,2999,74999,49,[2,3],5000,.047,.025,'150'],
  [5,5999,279999,99,[3,2],10000,.052,.029,'500'],
  [6,9999,899999,199,[3,4],20000,.058,.035,'1500'],
  [7,15999,1799999,299,[4,2],30000,.066,.042,'4000'],
  [8,29999,3999999,399,[4,3],50000,.08,.055,'15000'],
];
export const rankPresetOptions=[['follow','跟随原演示数据'],...RANK_RULES.map(([v])=>['v'+v,'V'+v+(v===8?'（会员）':v===7?'（冲 V8）':'')])];
export const rankSalaryOptions=[['present','有月薪（V2 起本月可领，C）'],['pending','月中首次到达，明天起可领（D1）'],['pending-end','月末最后一天首次到达，仅下月 1 日可领（D1b）'],['expiring','还剩 3 天（D2）'],['claimed','本月已领（D3）'],['promo','晋升当天，明天金额更高（D4）'],['promo-end','月末最后一天晋升（D4c）'],['promo-end-lower','月末晋升，次月 1 日原金额失效（新金额更低）'],['promo-end-zero','月末晋升，次月 1 日原金额失效（新金额为零）'],['carry','1 日：上月今天截止＋本月（D4e）'],['empty','有 salary，months 为空（不显示卡）'],['absent','没有 salary 字段（月薪接口未上线）'],['unavailable','月薪读取失败（salary null，D9）']];
export const rankSalaryClaimOptions=[
  ['success','领取成功（D7）'], ['amount-changed','跨业务日金额变化（D10，V3 及以上）'],
  ['coverage-low','覆盖率低于红线（D8／D8b）'], ['coverage-unavailable','覆盖率读不到（D8／D8b）'],
  ['credit-unavailable','入账不可用'], ['already-claimed','本月已在另一处领取'], ['not-claimable','当月窗口已过'],
  ['not-found','请求未送达，可同键重发（D6）'], ['processing','回执处理中（D6）'], ['receipt-unavailable','首次回执读不到（D6）'],
];
export const rankReviewOptions=[['required','V8 需审核（reviewRequired）'],['off','V8 不带审核标记']];
export const rankPriorOptions=[['met','前序条件全部满足'],['one-short','前序差 1 人（本级 V{n}+ 人数少 1，H5）'],['next-met','下一级数值条件全部达到（V7 审核中，H7）']];
export const rankCoolingOptions=[['normal','奖励冷却 7 天'],['zero','奖励不冷却（0 天）']];
export const rankDeviceLevel2Options=[['off','设备收益二级为 0%'],['on','设备收益二级为 2%'],['disabled','设备收益暂停发放']];
export const rankPresetDefaults={rankPreset:'follow',rankSalaryState:'present',rankSalaryClaimState:'success',rankReviewState:'required',rankPriorState:'met',rankCoolingState:'normal',rankDeviceLevel2State:'off'};
export const usesRankPreset = state => !!state.rankPreset && state.rankPreset !== 'follow';

export function rankDevicePolicies(state, at) {
  const day = 86_400_000;
  const enabled = state.dataState !== 'empty' && state.rankDeviceLevel2State !== 'disabled';
  const previous = {policyVersion:2, effectiveAt:at-30*day, enabled:true, totalRatePct:5, level2RatePct:2, usdtSharePct:70, coolingDays:7};
  const current = {...previous, policyVersion:3, effectiveAt:at-8*day, enabled,
    totalRatePct:state.dataState==='empty'?0:5,
    level2RatePct:state.rankDeviceLevel2State==='on'?2:0,
    coolingDays:state.rankPreset==='follow'||state.rankCoolingState==='zero'?0:7};
  return {previous, current};
}

const toward=(current,target)=>current+Math.floor((target-current)*.6);

/** 预设 Vn 的当前值：数值条件按「门槛 + 60% 差距」，V{n}+ 人数先补足 V1–Vn 的要求，再朝下一级走 60%。
 *  prior 为 one-short 时（H5：一位好友降级）：本级要求的 V{n}+ 人数里多出来的和差的一位降一级，本级这一项正好差 1 人；V0、V1 没有这项，不变。 */
export function rankPresetProgress(v,prior='met'){
  if(prior==='next-met'&&v!==7)prior='met';
  const own=RANK_RULES[v],next=RANK_RULES[v+1];
  const counts={};
  const atLeast=rank=>Object.entries(counts).reduce((sum,[r,n])=>Number(r)>=rank?sum+n:sum,0);
  for(const [,, , ,leaders] of RANK_RULES.slice(1,v+1))if(leaders&&atLeast(leaders[0])<leaders[1])counts[leaders[0]]=(counts[leaders[0]]??0)+leaders[1]-atLeast(leaders[0]);
  if(next?.[4]){const [rank,need]=next[4],have=atLeast(rank);if(have<need)counts[rank]=(counts[rank]??0)+(prior==='next-met'?need-have:Math.floor((need-have)*.6));}
  if(prior==='one-short'&&own[4]){const [rank,need]=own[4],drop=atLeast(rank)-(need-1);counts[rank]=(counts[rank]??0)-drop;if(rank>1)counts[rank-1]=(counts[rank-1]??0)+drop;}
  // next-met：朝下一级的数值条件全部停在下一级门槛（V7 数值全满足、等待 V8 审核，H7）。
  const value=index=>next?(prior==='next-met'?next[index]:toward(own[index],next[index])):own[index];
  return {selfComputePoints:value(1),teamComputePoints:value(2),directRefs:value(3),vDownlineCounts:Object.fromEntries(Object.entries(counts).filter(([,n])=>n>0).map(([r,n])=>[String(r),n]))};
}

/** /api/team/rank 的 salary（6.1、6.5）：V2 起按状态给当月一项，业务日期按状态挪到月中、月末或 1 日；V0、V1 months 为空。
 *  晋升当天（promo、promo-end）：当前可领项按上一级的月薪，upcoming 为本级（只有上一级月薪大于 0 才成立，否则按 pending）。 */
const iso=(y,m,d)=>new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10);
const atStart=date=>new Date(Date.parse(date+'T00:00:00+07:00')).toISOString();

export function rankPresetSalary(v,businessDate,state='present'){
  const [year,month]=businessDate.split('-').map(Number);
  const ym=businessDate.slice(0,7),first=iso(year,month,1),nextFirst=iso(year,month+1,1),lastDay=iso(year,month+1,0),mid=iso(year,month,15),midNext=iso(year,month,16);
  const followingSecond=iso(year,month+1,2);
  const amount=RANK_RULES[v][8],prior=v>0?RANK_RULES[v-1][8]:'0';
  const item=(status,extra={})=>({month:ym,rankCode:'V'+v,amountUsdt:amount,status,claimableFrom:first,expiresAt:nextFirst,...extra});
  const salary=(date,months,upcoming=null,nextClaimableFrom=null)=>({
    businessDate:date,
    months:months.map(row=>({...row,claimableFrom:atStart(row.claimableFrom),expiresAt:atStart(row.expiresAt)})),
    upcoming:upcoming&&{...upcoming,claimableFrom:atStart(upcoming.claimableFrom)},
    nextClaimableFrom:nextClaimableFrom&&atStart(nextClaimableFrom),
  });
  if(!(Number(amount)>0)||state==='empty')return salary(businessDate,[]);
  const promo=Number(prior)>0;
  if(state==='pending'||(state==='promo'&&!promo))return salary(mid,[item('PENDING',{claimableFrom:midNext})]);
  if(state==='pending-end'||(state.startsWith('promo-end')&&!promo))return salary(lastDay,[item('PENDING',{claimableFrom:nextFirst,expiresAt:followingSecond})]);
  if(state==='expiring')return salary(iso(year,month+1,-2),[item('CLAIMABLE')]);
  if(state==='claimed')return salary(businessDate,[item('CLAIMED',{claimNo:`SAL-DEMO-${ym}-V${v}`,claimedAt:atStart(businessDate)})]);
  if(state==='promo')return salary(mid,[item('CLAIMABLE',{rankCode:'V'+(v-1),amountUsdt:prior})],{month:ym,rankCode:'V'+v,amountUsdt:amount,claimableFrom:midNext});
  if(state.startsWith('promo-end')&&promo){
    const nextAmount=state==='promo-end-zero'?'0':state==='promo-end-lower'?String(Number(prior)/2):amount;
    return salary(lastDay,[item('CLAIMABLE',{rankCode:'V'+(v-1),amountUsdt:prior,expiresAt:followingSecond})],
      {month:ym,rankCode:'V'+v,amountUsdt:nextAmount,claimableFrom:nextFirst});
  }
  if(state==='carry')return salary(first,[item('CLAIMABLE',{month:iso(year,month-1,1).slice(0,7),expiresAt:iso(year,month,2)}),item('CLAIMABLE')]);
  return salary(businessDate,[item('CLAIMABLE')]);
}

function baseRankSalary(state, now) {
  if (!usesRankPreset(state) || ['absent', 'unavailable'].includes(state.rankSalaryState)) return null;
  const v = Number(state.rankPreset.slice(1));
  const today = demoTeamBusinessDate(now);
  const scenario = state.rankSalaryClaimState === 'amount-changed' && state.rankSalaryState === 'present' && v >= 3
    ? 'promo' : state.rankSalaryState;
  const current = rankPresetSalary(v, today, scenario);
  // A demo day pinned to mid-month or month-end must be a day that has already occurred.
  if (current.businessDate <= today) return current;
  const [year, month] = today.split('-').map(Number);
  return rankPresetSalary(v, iso(year, month - 1, 1), scenario);
}

export function rankSalaryPaidFacts(state, now) {
  const accountId = previewSelectedAccountId(state);
  const paid = (state.rankSalaryClaims ?? []).filter(fact => fact.accountId === accountId).map(fact => fact.item);
  const salary = baseRankSalary(state, now);
  const seeded = salary?.months.filter(item => item.status === 'CLAIMED') ?? [];
  if (state.rankSalaryState === 'claimed' && seeded.length) {
    const [year, month] = salary.businessDate.split('-').map(Number);
    const prior = rankPresetSalary(Number(state.rankPreset.slice(1)), iso(year, month, 0), 'claimed').months[0];
    seeded.push({...prior, legacyProjection:true});
  }
  return [...paid, ...seeded.filter(item => !paid.some(fact => fact.month === item.month))];
}

export function rankSalaryReadback(state, now) {
  const salary = baseRankSalary(state, now);
  if (!salary) return null;
  const accountId = previewSelectedAccountId(state);
  const transition = state.rankSalaryTransitions?.find(row => row.accountId === accountId && row.month === salary.upcoming?.month);
  if (transition && salary.upcoming) {
    const next = salary.upcoming;
    salary.businessDate = demoTeamBusinessDate(Date.parse(next.claimableFrom));
    salary.months = salary.months.map(item => item.month === next.month ? { ...item, ...next } : item);
    salary.upcoming = null;
    salary.nextClaimableFrom = null;
  }
  const expired = state.rankSalaryExpirations?.filter(row => row.accountId === accountId) ?? [];
  const businessDayStart = Date.parse(atStart(salary.businessDate));
  const paid = rankSalaryPaidFacts(state, now).filter(fact =>
    demoTeamBusinessDate(Date.parse(fact.claimedAt)) <= salary.businessDate && businessDayStart < Date.parse(fact.expiresAt));
  salary.months = salary.months.filter(item => !expired.some(row => row.month === item.month))
    .map(item => paid.find(fact => fact.month === item.month) ?? item);
  salary.months.push(...paid.filter(fact => !salary.months.some(item => item.month === fact.month)));
  salary.months.sort((a,b) => a.month.localeCompare(b.month));
  if (salary.upcoming && salary.months.every(item => item.month !== salary.upcoming.month || item.status === 'CLAIMED')) {
    salary.upcoming = null;
    salary.nextClaimableFrom = null;
  }
  return salary;
}

/** 预设开着时接管 /api/config/v-ranks 和 /api/team/rank；其余路径返回 undefined。base 是原有应答（保留校验需要的公共字段）。 */
export function rankPresetResponse(pathname,base,state,now){
  if(!usesRankPreset(state))return undefined;
  const v=Number(state.rankPreset.slice(1));
  if(pathname==='/api/config/v-ranks'){
    const template=base.ranks?.[0]??{};
    return {...base,ranks:RANK_RULES.map(([rank,self,team,refs,leaders,uvt,l1,l2,salary])=>{
      const row={...template,v:rank,title:base.ranks?.[rank]?.title??'V'+rank,cnTitle:base.ranks?.[rank]?.cnTitle??'V'+rank,
        selfComputePoints:self,teamComputePoints:team,directRefs:refs,directBonus:l1,purchaseL1Rate:l1,purchaseL2Rate:l2,
        unilevelDepth:0,peerBonus:0,leadershipVotes:0,cultivationBonus:0,rewards:uvt>0?[{type:'UVT',amount:uvt}]:[],monthlySalaryUsdt:salary,visible:true};
      if(rank===v&&v>=3){
        if(state.rankSalaryState==='promo-end-zero')row.monthlySalaryUsdt='0';
        if(state.rankSalaryState==='promo-end-lower')row.monthlySalaryUsdt=String(Number(RANK_RULES[v-1][8])/2);
      }
      delete row.requiredDownlineRank;delete row.requiredDownlineCount;
      if(leaders){row.requiredDownlineRank=leaders[0];row.requiredDownlineCount=leaders[1];}
      if(rank===8&&state.rankReviewState!=='off')row.reviewRequired=true;
      return row;
    })};
  }
  if(pathname==='/api/team/rank'){
    const prior=state.rankPriorState==='next-met'&&state.rankReviewState==='off'?'met':state.rankPriorState;
    const data={...base,rankCode:'V'+v,progress:{...base.progress,...rankPresetProgress(v,prior)}};
    delete data.salary;delete data.salaryUnavailable;
    if(state.rankSalaryState==='unavailable')Object.assign(data,{salary:null,salaryUnavailable:true});
    else if(state.rankSalaryState!=='absent')data.salary=rankSalaryReadback(state,now);
    return data;
  }
  return undefined;
}
