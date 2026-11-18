// Loopback-only task-cycle, v2 and receipt scenarios. Never imported by src.
import { demoHasEarningsHistory, postDemoWalletUsdt } from './prototype-demo-wallet.mjs';

const proof = { source: 'server', sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true };
const cycleMs = 60000;
export function demoComputeFacts(state, now, fleetDevices) {
  const pending = ['pending', 'blocked'].includes(state.computeState);
  if(!demoHasEarningsHistory(state))return {snapshots:{},devices:[],pending,postedTasks:[]};
  const anchor=state.computeAnchor??=now;
  const fleet=fleetDevices().filter(device=>device.activatedAt!==null&&device.activatedAt<=now
    || state.stoppedDevices?.includes(device.id));
  const snapshots=state.computeTaskSnapshots??={};
  for(const device of fleet){
    if(snapshots[device.id])continue;
    // Only preset devices have a seed history included in the starting wallet.
    const deliveryCycle=!state.fleetSeed.some(seed=>seed.id===device.id);
    const startedAt=deliveryCycle?device.activatedAt:anchor-30000;
    snapshots[device.id]={device:structuredClone(device),deliveryCycle,startedAt,
      completedStartedAt:deliveryCycle?startedAt:anchor-600000,
      amount:device.monthlyTargetActive?(device.dailyUsdt*60/86400).toFixed(6)
        :({CLOUD:'0.000032',PHONE:'0.100000',MOBILE:'0.200000'}[device.deviceType]??'0.023456')};
  }
  if(['cycles','running'].includes(state.computeState)){
    const due=fleet.filter(device=>device.activatedAt!==null).map(device=>snapshots[device.id])
      .filter(snapshot=>snapshot.deliveryCycle&&snapshot.postedAt==null&&snapshot.completedStartedAt+cycleMs<=now);
    if(due.length){
      postDemoWalletUsdt(state,due.reduce((sum,snapshot)=>sum+Number(snapshot.amount),0));
      for(const snapshot of due){snapshot.postedAt=now;snapshot.startedAt=now;}
    }
  }
  const postedTasks=pending?[]:Object.values(snapshots)
    .filter(snapshot=>!snapshot.deliveryCycle||snapshot.postedAt!=null).map(snapshot=>{
      const deviceId=snapshot.device.id;
      const postedAt=snapshot.deliveryCycle?snapshot.postedAt:anchor-cycleMs;
      return {deviceId,taskNo:`DEMO-TASK-${deviceId}-DONE`,receiptNo:`DEMO-RECEIPT-${deviceId}`,
        amount:Number(snapshot.amount),completedAt:snapshot.completedStartedAt+cycleMs,postedAt,
        deliveryCycle:snapshot.deliveryCycle,
        batchNo:state.computeState==='cycles'?null:snapshot.deliveryCycle?`DEMO-BATCH-${postedAt}`:'DEMO-BATCH-1'};
    });
  return {snapshots,devices:fleet.map(device=>device.id),pending,postedTasks};
}

export function computeDemo(url, locale, state, request, fleetDevices) {
  const path = url.pathname;
  if (!path.startsWith('/api/tasks/')) return undefined;
  const now = Date.now(), mode = state.computeState || 'cycles';
  const simulated = mode === 'cycles', version = simulated ? 3 : 2;
  const text = (zh, en, vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
  const names = [text('图像生成周期', 'Image generation cycle', 'Chu kỳ tạo ảnh'), text('Cloud Share 收益周期', 'Cloud Share reward cycle', 'Chu kỳ thu nhập Cloud Share')];
  const { snapshots, devices, pending, postedTasks } = demoComputeFacts(state, now, fleetDevices);
  const postedByDevice = new Map(postedTasks.map(task=>[task.deviceId,task]));
  const byId = new Map(Object.values(snapshots).map(snapshot=>[snapshot.device.id,snapshot.device]));
  const deviceType=id=>byId.get(id).deviceType;
  const deviceName=id=>byId.get(id).name;
  const instance=id=>byId.get(id).instanceNo;
  const amount=id=>snapshots[id].amount;
  const total=(devices.reduce((sum,id)=>sum+Math.round(Number(amount(id))*1e6),0)/1e6).toFixed(6);
  const task = (deviceId, status, history = false) => {
    const cloud = deviceType(deviceId) === 'CLOUD', index = cloud ? 1 : 0;
    const snapshot=snapshots[deviceId], posted=history?postedByDevice.get(deviceId):null;
    const start = history ? snapshot.completedStartedAt : snapshot.startedAt;
    const execution = simulated ? { executionMode: 'SIMULATED', proofKind: 'TASK_RECEIPT', modelExecuted: false }
      : cloud ? { executionMode: 'RULE_CYCLE', proofKind: 'RULE_SETTLEMENT', modelExecuted: false }
        : { executionMode: 'MODEL', proofKind: 'MODEL_EXECUTION', modelExecuted: true };
    return { ...proof, ...execution, protocolVersion: version, taskNo: `DEMO-TASK-${deviceId}-${history ? 'DONE' : 'LIVE'}`, deviceId,
      taskId: cloud ? 'cloud-cycle' : 'image-gen', taskName: ['PHONE','MOBILE'].includes(deviceType(deviceId))?`${deviceType(deviceId)} ${text('任务周期','task cycle','chu kỳ tác vụ')}`:names[index], taskClass: 'IG', model: simulated ? '' : cloud ? 'Cloud reward' : 'SDXL', client: 'UVEL', status,
      rewardUsdt: Number(amount(deviceId)), ...(simulated ? { rewardAsset: 'USDT', rewardAmount: amount(deviceId) } : {}),
      requiredSeconds: 60, queuedAt: snapshot.deliveryCycle?Math.max(snapshot.device.activatedAt,start-1000):start-1000, startedAt: status === 'QUEUED' ? null : start, completableAt: ['QUEUED', 'RECOVERING'].includes(status) ? null : start + 60000,
      completedAt: history ? start + 60000 : null, actualDurationSec: status === 'QUEUED' ? null : history ? 60 : 30,
      receiptNo: posted?.receiptNo??null,
      settlementStatus: history ? mode === 'pending' ? 'PENDING' : mode === 'blocked' ? 'BLOCKED' : 'POSTED' : 'NONE',
      settlementBatchNo: posted?.batchNo??null,
      settledAt: posted?.postedAt??null, configVersion: 'compute-demo-3', proofNonce: null, proofExpiresAt: null, pausedAt: null, pausedSeconds: 0 };
  };
  const status = ({ queued: 'QUEUED', verifying: 'VERIFYING', recovering: 'RECOVERING', failed: 'FAILED', cancelled: 'CANCELLED' })[mode] || 'RUNNING';
  if (path === '/api/tasks/assignments' || path === '/api/tasks/v2/assignments') return { ...proof, protocolVersion: version, serverNow: now,
    pendingEarned: [{ asset: 'USDT', amount: pending ? total : '0.000000', taskCount: pending ? devices.length : 0 }],
    devices: devices.map(deviceId => ({ deviceId, instanceNo: instance(deviceId), deviceType: deviceType(deviceId), lockUntil: null,
      recoveryPending: mode === 'recovering', recoveryReason: mode === 'recovering' ? 'LEGACY_COMPLETE_OUTCOME_UNKNOWN' : null,
      simulationState: state.stoppedDevices?.includes(deviceId) ? 'STOPPED' : 'RUNNING',
      currentTask: state.stoppedDevices?.includes(deviceId) || mode === 'recovering' ? null : task(deviceId, status), recentTasks: !snapshots[deviceId].deliveryCycle||postedByDevice.has(deviceId)?[task(deviceId, 'COMPLETED', true)]:[] })) };
  if(path==='/api/tasks/v2/settlements'||path.startsWith('/api/tasks/v2/settlements/')){
    // Keep the existing seed batch for the cycles preset. Newly simulated
    // deliveries have their own receipts and no v2 batch membership.
    const grouped=Object.groupBy(postedTasks.filter(task=>task.batchNo||!task.deliveryCycle),task=>task.batchNo??'DEMO-BATCH-1');
    const batches=Object.entries(grouped).map(([batchNo,tasks])=>({batchNo,asset:'USDT',
      amount:tasks.reduce((sum,entry)=>sum+entry.amount,0).toFixed(6),taskCount:tasks.length,status:'POSTED',
      windowStart:Math.min(...tasks.map(entry=>entry.completedAt-cycleMs)),windowEnd:Math.max(...tasks.map(entry=>entry.completedAt)),
      postedAt:tasks[0].postedAt})).sort((left,right)=>right.postedAt-left.postedAt);
    if(path==='/api/tasks/v2/settlements')return {...proof,records:batches,nextCursor:null};
    const batch=batches.find(entry=>entry.batchNo===path.split('/').at(-1));
    if(!batch)throw Object.assign(new Error('COMPUTE_V2_SETTLEMENT_NOT_FOUND'),{status:404});
    return {...proof,...batch,items:grouped[batch.batchNo].map(({taskNo,receiptNo,deviceId,completedAt})=>({
      taskNo,receiptNo,deviceId,completedAt,taskType:'IG',amount:amount(deviceId),
    }))};
  }
  const receipts = postedTasks.map(({deviceId}) => {
    const done = task(deviceId, 'COMPLETED', true);
    return { ...done, settledAt: simulated||snapshots[deviceId].deliveryCycle?done.settledAt:done.completedAt, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceInstanceNo: instance(deviceId), deviceName: deviceName(deviceId), deviceType: deviceType(deviceId), deviceGpu: byId.get(deviceId).gpuModel, vramTotalGb: byId.get(deviceId).vramTotalGb,
      rewardNex: 0, earningStatus: 'POSTED', proofHash: simulated ? null : 'a'.repeat(64), durationSec: 60 };
  });
  // Current summary DTO omits posting time; direct simulated receipt details carry it.
  if (path === '/api/tasks/receipts') return { ...proof, items: receipts.map(({settledAt,...summary})=>summary), total: receipts.length, nextOffset: null, nextCursor: null };
  if (path.startsWith('/api/tasks/receipts/')) return receipts.find(row => row.receiptNo === decodeURIComponent(path.split('/').pop()));
  if (path === '/api/tasks/simulated/stop' && request.method() === 'POST') {
    const { deviceId, expectedVersion } = request.postDataJSON();
    // expectedVersion is optional (decision 3: the App omits it); a stated version must still match.
    if (!devices.includes(deviceId) || (expectedVersion != null && expectedVersion !== 1)) throw Object.assign(new Error('DEVICE_VERSION_CONFLICT'), { status: 409 });
    state.stoppedDevices ??= []; state.stoppedDevices.push(deviceId);
    return { deviceId, simulationState: 'STOPPED' };
  }
  return undefined;
}
