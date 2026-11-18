// Loopback-only task-cycle, v2 and receipt scenarios. Never imported by src.
import { demoHasEarningsHistory, postDemoWalletEntries } from './prototype-demo-wallet.mjs';

import { demoBatchPage, demoReceiptPage } from './prototype-demo-secondary.mjs';

const proof = { source: 'server', sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true };
const cycleMs = 60000;
const maxBatchItems = 200;
export function demoComputeFacts(state,now,fleetDevices) {
  const mode=state.computeState,simulated=mode==='cycles',pending=['pending','blocked'].includes(mode);
  const heldDevices=fleetDevices();
  if(!demoHasEarningsHistory(state))return {snapshots:{},devices:[],heldDevices,pending,postedTasks:[]};
  const anchor=state.computeAnchor??=now;
  const fleet=heldDevices.filter(device=>device.activatedAt!==null&&device.activatedAt<=now
    ||state.stoppedDevices?.includes(device.id));
  const snapshots=state.computeTaskSnapshots??={};
  const starts=state.computeCycleStarts??={};
  const describe=(snapshot,startedAt,postedAt,taskNo,receiptNo,batchNo,deliveryCycle)=>({
    deviceId:snapshot.device.id,taskNo,receiptNo,taskClass:'IG',amount:Number(snapshot.amount),nex:0,startedAt,
    completedAt:startedAt+cycleMs,postedAt,batchNo,deliveryCycle,client:'UVEL',
    model:snapshot.device.deviceType==='CLOUD'?'Cloud reward':'SDXL',
  });

  for(const device of fleet){
    const deliveryCycle=!state.fleetSeed.some(seed=>seed.id===device.id)||Boolean(state.deviceActivations?.[device.id]);
    if(!snapshots[device.id]){
      const startedAt=deliveryCycle?device.activatedAt:anchor-30000;
      snapshots[device.id]={device:structuredClone(device),deliveryCycle,startedAt,
        completedStartedAt:deliveryCycle?startedAt:anchor-600000,
        amount:device.monthlyTargetActive?(device.dailyUsdt*60/86400).toFixed(6)
          :({CLOUD:'0.000032',PHONE:'0.100000',MOBILE:'0.200000'}[device.deviceType]??'0.023456')};
    }
    if(device.activatedAt===null)continue;
    const snapshot=snapshots[device.id];
    // Opening snapshots may be from a previous preview. Keep their completed
    // rewards and resume from the import time if the open cycle already expired.
    const resumedAt=state.computeResumeAt;
    const initial=snapshot.startedAt+cycleMs<=resumedAt?resumedAt:snapshot.startedAt;
    starts[device.id]??=Math.max(initial,device.activatedAt);
  }

  const due=[];
  if(simulated||mode==='running'){
    for(const device of fleet){
      if(device.activatedAt===null)continue;
      const snapshot=snapshots[device.id];
      while(starts[device.id]+cycleMs<=now){
        const startedAt=starts[device.id],identity=`${device.id}-${startedAt}`;
        const task=describe(snapshot,startedAt,now,`DEMO-TASK-${identity}`,`DEMO-RECEIPT-${identity}`,null,true);
        due.push({...task,queuedAt:Math.max(device.activatedAt,startedAt-1000)});
        starts[device.id]+=cycleMs;
      }
    }
  }
  due.sort((a,b)=>a.completedAt-b.completedAt||a.deviceId-b.deviceId);
  const entry=task=>({bizNo:task.taskNo,bizType:'COMPUTE_TASK_REWARD',asset:'USDT',direction:'IN',
    amount:task.amount,at:task.postedAt,category:'bonus',batchNo:task.batchNo,detail:task});
  if(simulated){
    for(const task of due)postDemoWalletEntries(state,entry(task));
  }else{
    for(let offset=0;offset<due.length;offset+=maxBatchItems){
      const batchNo=`DEMO-BATCH-${now}-${offset/maxBatchItems+1}`;
      const batch=due.slice(offset,offset+maxBatchItems).map(task=>entry({...task,batchNo}));
      postDemoWalletEntries(state,...batch);
    }
  }

  const opening=Object.values(snapshots).filter(snapshot=>!snapshot.deliveryCycle||snapshot.postedAt!=null).map(snapshot=>{
    const id=snapshot.device.id,startedAt=snapshot.completedStartedAt;
    const postedAt=Math.max(startedAt+cycleMs,snapshot.postedAt??anchor-cycleMs);
    return describe(snapshot,startedAt,postedAt,`DEMO-TASK-${id}-DONE`,`DEMO-RECEIPT-${id}`,
      simulated?null:snapshot.deliveryCycle?`DEMO-BATCH-${postedAt}`:'DEMO-BATCH-1',Boolean(snapshot.deliveryCycle));
  });
  const posted=(state.walletMovements??[]).filter(row=>row.bizType==='COMPUTE_TASK_REWARD').map(row=>row.detail);
  const postedTasks=pending?[]:[...opening,...posted].sort((a,b)=>b.completedAt-a.completedAt);
  const displaySnapshots=Object.fromEntries(Object.entries(snapshots).map(([id,snapshot])=>[id,{...snapshot,startedAt:starts[id]??snapshot.startedAt,
    liveActivatedAt:state.deviceActivations?.[id]?.activatedAt??snapshot.device.activatedAt}]));
  return {snapshots:displaySnapshots,devices:fleet.map(device=>device.id),heldDevices,pending,postedTasks};
}

export function computeDemo(url, state, request, now, facts) {
  const path = url.pathname;
  if (!path.startsWith('/api/tasks/')) return undefined;
  const mode = state.computeState || 'cycles';
  const simulated = mode === 'cycles', version = simulated ? 3 : 2;
  const { snapshots, devices, pending, postedTasks } = facts;
  const byId = new Map(Object.values(snapshots).map(snapshot=>[snapshot.device.id,snapshot.device]));
  const deviceType=id=>byId.get(id).deviceType;
  const deviceName=id=>byId.get(id).name;
  const instance=id=>byId.get(id).instanceNo;
  const amount=id=>snapshots[id].amount;
  const total=(devices.reduce((sum,id)=>sum+Math.round(Number(amount(id))*1e6),0)/1e6).toFixed(6);
  const task = (deviceId,status,posted=null) => {
    const type=deviceType(deviceId),cloud=type==='CLOUD';
    const taskName=['PHONE','MOBILE'].includes(type)?type+' task cycle':cloud?'Cloud Share reward cycle':'Image generation cycle';
    const snapshot=snapshots[deviceId],history=status==='COMPLETED';
    const start=posted?.startedAt??(history?snapshot.completedStartedAt:snapshot.startedAt);
    const execution = simulated ? { executionMode: 'SIMULATED', proofKind: 'TASK_RECEIPT', modelExecuted: false }
      : cloud ? { executionMode: 'RULE_CYCLE', proofKind: 'RULE_SETTLEMENT', modelExecuted: false }
        : { executionMode: 'MODEL', proofKind: 'MODEL_EXECUTION', modelExecuted: true };
    return { ...proof, ...execution, protocolVersion: version, taskNo:posted?.taskNo??`DEMO-TASK-${deviceId}-${start}`, deviceId,
      taskId: cloud ? 'cloud-cycle' : 'image-gen', taskName, taskClass: 'IG', model: simulated ? '' : cloud ? 'Cloud reward' : 'SDXL', client: 'UVEL', status,
      rewardUsdt: Number(amount(deviceId)), ...(simulated ? { rewardAsset: 'USDT', rewardAmount: amount(deviceId) } : {}),
      requiredSeconds: 60, queuedAt: posted?.queuedAt??Math.max(history?snapshot.device.activatedAt:snapshot.liveActivatedAt,start-1000), startedAt: status === 'QUEUED' ? null : start, completableAt: ['QUEUED', 'RECOVERING'].includes(status) ? null : start + 60000,
      completedAt: history ? start + 60000 : null, actualDurationSec: status === 'QUEUED' ? null : history ? 60 : 30,
      receiptNo: posted?.receiptNo??null,
      settlementStatus: history ? mode === 'pending' ? 'PENDING' : mode === 'blocked' ? 'BLOCKED' : 'POSTED' : 'NONE',
      settlementBatchNo: posted?.batchNo??null,
      settledAt: posted?.postedAt??null, configVersion: 'compute-demo-3', proofNonce: null, proofExpiresAt: null, pausedAt: null, pausedSeconds: 0 };
  };
  const status = ({ queued: 'QUEUED', verifying: 'VERIFYING', recovering: 'RECOVERING', failed: 'FAILED', cancelled: 'CANCELLED' })[mode] || 'RUNNING';
  const v2=path==='/api/tasks/v2/assignments';
  if(v2&&(simulated||!facts.heldDevices.some(device=>device.activatedAt!==null)))
    throw Object.assign(new Error('COMPUTE_V2_NOT_AVAILABLE'),{status:404});
  if(path==='/api/tasks/assignments'&&!simulated)return undefined;
  if (path === '/api/tasks/assignments' || v2) return { ...proof, protocolVersion: version, serverNow: now,
    pendingEarned: [{ asset: 'USDT', amount: pending ? total : '0.000000', taskCount: pending ? devices.length : 0 }],
    devices: facts.heldDevices.map(({id:deviceId,instanceNo,deviceType:type}) => ({ deviceId, instanceNo, deviceType:type, lockUntil: null,
      recoveryPending: mode === 'recovering' && devices.includes(deviceId), recoveryReason: mode === 'recovering' && devices.includes(deviceId) ? 'LEGACY_COMPLETE_OUTCOME_UNKNOWN' : null,
      simulationState: state.stoppedDevices?.includes(deviceId) ? 'STOPPED' : devices.includes(deviceId) ? 'RUNNING' : 'WAITING_CONFIG',
      currentTask: !devices.includes(deviceId) || state.stoppedDevices?.includes(deviceId) || mode === 'recovering' ? null : task(deviceId, status), recentTasks: pending&&devices.includes(deviceId)&&!snapshots[deviceId].deliveryCycle?[task(deviceId,'COMPLETED')]:
        postedTasks.filter(row=>row.deviceId===deviceId).slice(0,5).map(row=>task(deviceId,'COMPLETED',row)) })) };
  if(path==='/api/tasks/v2/settlements'||path.startsWith('/api/tasks/v2/settlements/')){
    const grouped=Object.groupBy(postedTasks.filter(task=>task.batchNo),task=>task.batchNo);
    const batches=Object.entries(grouped).map(([batchNo,tasks])=>({batchNo,asset:'USDT',
      amount:tasks.reduce((sum,entry)=>sum+entry.amount,0).toFixed(6),taskCount:tasks.length,status:'POSTED',
      windowStart:Math.min(...tasks.map(entry=>entry.completedAt-cycleMs)),windowEnd:Math.max(...tasks.map(entry=>entry.completedAt)),
      postedAt:tasks[0].postedAt})).sort((left,right)=>right.postedAt-left.postedAt);
    if(path==='/api/tasks/v2/settlements')return demoBatchPage(url.searchParams,batches);
    const batch=batches.find(entry=>entry.batchNo===path.split('/').at(-1));
    if(!batch)throw Object.assign(new Error('COMPUTE_V2_SETTLEMENT_NOT_FOUND'),{status:404});
    return {...proof,...batch,items:grouped[batch.batchNo].map(({taskNo,receiptNo,deviceId,completedAt})=>({
      taskNo,receiptNo,deviceId,completedAt,taskType:'IG',amount:amount(deviceId),
    }))};
  }
  const receipts = postedTasks.map(posted => {
    const {deviceId}=posted;
    const done=task(deviceId,'COMPLETED',posted);
    return { ...done, receiptNo:posted.receiptNo, deviceInstanceNo: instance(deviceId), deviceName: deviceName(deviceId), deviceType: deviceType(deviceId), deviceGpu: byId.get(deviceId).gpuModel, vramTotalGb: byId.get(deviceId).vramTotalGb,
      rewardNex: 0, earningStatus: 'POSTED', proofHash: simulated ? null : 'a'.repeat(64), durationSec: 60 };
  });
  if (path === '/api/tasks/receipts') return demoReceiptPage(url.searchParams,receipts);
  if(path.startsWith('/api/tasks/receipts/')){
    const receipt=receipts.find(row=>row.receiptNo===decodeURIComponent(path.split('/').pop()));
    if(!receipt)throw Object.assign(new Error('TASK_RECEIPT_NOT_FOUND'),{status:404});
    return receipt;
  }
  if (path === '/api/tasks/simulated/stop' && request.method() === 'POST') {
    const { deviceId, expectedVersion } = request.postDataJSON();
    // expectedVersion is optional (decision 3: the App omits it); a stated version must still match.
    if (!devices.includes(deviceId) || (expectedVersion!=null&&expectedVersion!==(state.deviceActivations?.[deviceId]?.rowVersion??snapshots[deviceId].device.rowVersion))) throw Object.assign(new Error('DEVICE_VERSION_CONFLICT'), { status: 409 });
    if(!state.stoppedDevices?.includes(deviceId))(state.stoppedDevices??=[]).push(deviceId);
    // The shared request entry reconciled all work due through this cutoff.
    delete state.computeCycleStarts[deviceId];
    return { deviceId, simulationState: 'STOPPED' };
  }
  return undefined;
}
