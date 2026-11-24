// 我的等级改版的原型夹具预设（team-rank DESIGN 第 5、6、12.0 节），只由演示服务读取，不进 App 包。
// 三个独立开关：rankPreset（等级 V0–V8，follow 为原有演示数据）、rankSalaryState（有月薪／没有 salary 字段／月薪读取失败）、
// rankReviewState（V8 带 reviewRequired 与否）。三种数据状态可以同时成立（12.0）。
// 数值全部由下面一张表按一条规则推出：预设 Vn 的用户满足 V1–Vn 的全部条件；朝 Vn+1 的每项数值条件走到
// 本级门槛与下一级门槛之间的 60%（向下取整，所以下一级每项都未满足）；V8 停在 V8 门槛。后续状态在这里加。

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
export const rankSalaryOptions=[['present','有月薪（V2 起本月可领）'],['absent','没有 salary 字段（月薪接口未上线）'],['unavailable','月薪读取失败（salary null）']];
export const rankReviewOptions=[['required','V8 需审核（reviewRequired）'],['off','V8 不带审核标记']];
export const rankPriorOptions=[['met','前序条件全部满足'],['one-short','前序差 1 人（本级 V{n}+ 人数少 1，H5）']];
export const rankCoolingOptions=[['normal','好友购买冷却 7 天'],['zero','好友购买不冷却（0 天）']];
// rankCoolingState zero: the direct-referral purchase cooling is 0 days, for the credited-right-away wording.
export const rankPresetDefaults={rankPreset:'follow',rankSalaryState:'present',rankReviewState:'required',rankPriorState:'met',rankCoolingState:'normal'};

const toward=(current,target)=>current+Math.floor((target-current)*.6);

/** 预设 Vn 的当前值：数值条件按「门槛 + 60% 差距」，V{n}+ 人数先补足 V1–Vn 的要求，再朝下一级走 60%。
 *  prior 为 one-short 时（H5：一位好友降级）：本级要求的 V{n}+ 人数里多出来的和差的一位降一级，本级这一项正好差 1 人；V0、V1 没有这项，不变。 */
export function rankPresetProgress(v,prior='met'){
  const own=RANK_RULES[v],next=RANK_RULES[v+1];
  const counts={};
  const atLeast=rank=>Object.entries(counts).reduce((sum,[r,n])=>Number(r)>=rank?sum+n:sum,0);
  for(const [,, , ,leaders] of RANK_RULES.slice(1,v+1))if(leaders&&atLeast(leaders[0])<leaders[1])counts[leaders[0]]=(counts[leaders[0]]??0)+leaders[1]-atLeast(leaders[0]);
  if(next?.[4]){const [rank,need]=next[4],have=atLeast(rank);if(have<need)counts[rank]=(counts[rank]??0)+Math.floor((need-have)*.6);}
  if(prior==='one-short'&&own[4]){const [rank,need]=own[4],drop=atLeast(rank)-(need-1);counts[rank]=(counts[rank]??0)-drop;if(rank>1)counts[rank-1]=(counts[rank-1]??0)+drop;}
  const value=index=>next?toward(own[index],next[index]):own[index];
  return {selfComputePoints:value(1),teamComputePoints:value(2),directRefs:value(3),vDownlineCounts:Object.fromEntries(Object.entries(counts).filter(([,n])=>n>0).map(([r,n])=>[String(r),n]))};
}

/** /api/team/rank 的 salary（6.1）：V2 起当月一项 CLAIMABLE，按服务端业务日期；V0、V1 months 为空。 */
export function rankPresetSalary(v,businessDate){
  const [year,month]=businessDate.split('-').map(Number);
  const next=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  const monthKey=businessDate.slice(0,7),amount=RANK_RULES[v][8];
  const months=Number(amount)>0?[{month:monthKey,rankCode:'V'+v,amountUsdt:amount,status:'CLAIMABLE',claimableFrom:monthKey+'-01',expiresAt:next}]:[];
  return {businessDate,months,upcoming:null,nextClaimableFrom:null};
}

/** 预设开着时接管 /api/config/v-ranks 和 /api/team/rank；其余路径返回 undefined。base 是原有应答（保留校验需要的公共字段）。 */
export function rankPresetResponse(pathname,base,state,businessDate){
  if(!state.rankPreset||state.rankPreset==='follow')return undefined;
  const v=Number(state.rankPreset.slice(1));
  if(pathname==='/api/config/v-ranks'){
    const template=base.ranks?.[0]??{};
    return {...base,ranks:RANK_RULES.map(([rank,self,team,refs,leaders,uvt,l1,l2,salary])=>{
      const row={...template,v:rank,title:base.ranks?.[rank]?.title??'V'+rank,cnTitle:base.ranks?.[rank]?.cnTitle??'V'+rank,
        selfComputePoints:self,teamComputePoints:team,directRefs:refs,directBonus:l1,purchaseL1Rate:l1,purchaseL2Rate:l2,
        unilevelDepth:0,peerBonus:0,leadershipVotes:0,cultivationBonus:0,rewards:uvt>0?[{type:'UVT',amount:uvt}]:[],monthlySalaryUsdt:salary,visible:true};
      delete row.requiredDownlineRank;delete row.requiredDownlineCount;
      if(leaders){row.requiredDownlineRank=leaders[0];row.requiredDownlineCount=leaders[1];}
      if(rank===8&&state.rankReviewState!=='off')row.reviewRequired=true;
      return row;
    })};
  }
  if(pathname==='/api/team/rank'){
    const data={...base,rankCode:'V'+v,progress:{...base.progress,...rankPresetProgress(v,state.rankPriorState)}};
    delete data.salary;delete data.salaryUnavailable;
    if(state.rankSalaryState==='unavailable')Object.assign(data,{salary:null,salaryUnavailable:true});
    else if(state.rankSalaryState!=='absent')data.salary=rankPresetSalary(v,businessDate);
    return data;
  }
  return undefined;
}
