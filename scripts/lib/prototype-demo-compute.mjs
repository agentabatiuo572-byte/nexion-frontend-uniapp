// Loopback-only task-cycle, v2 and receipt scenarios. Never imported by src.
const proof = { source: 'server', sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true };
export function computeDemo(url, locale, state, request, fleetDevices) {
  const path = url.pathname;
  if (!path.startsWith('/api/tasks/')) return undefined;
  const now = Date.now(), mode = state.computeState || 'cycles';
  const simulated = mode === 'cycles', version = simulated ? 3 : 2;
  const text = (zh, en, vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
  const names = [text('图像生成周期', 'Image generation cycle', 'Chu kỳ tạo ảnh'), text('Cloud Share 收益周期', 'Cloud Share reward cycle', 'Chu kỳ thu nhập Cloud Share')];
  const anchor=state.computeAnchor??=now;
  // Tasks run on the fleet the account actually holds, as the fleet read shows it: activated devices with their own
  // ids, kinds and names (Lite phones by their PHONE/MOBILE identity), plus devices the user stopped, which keep their
  // history but run nothing. Traded-in and inventory devices have no task, and the empty account has none at all.
  const fleet = fleetDevices().filter(device => device.activatedAt !== null || state.stoppedDevices?.includes(device.id));
  // Freeze each task's device facts and USDT amount on first use. Current target daily values already
  // come from the same catalog and E3 projection as the fleet; Share's daily UVT is a separate entitlement.
  const snapshots = state.computeTaskSnapshots ??= {};
  for (const device of fleet) snapshots[device.id] ??= {
    device: structuredClone(device),
    amount: device.monthlyTargetActive ? (device.dailyUsdt * 60 / 86400).toFixed(6)
      : ({CLOUD:'0.000032',PHONE:'0.100000',MOBILE:'0.200000'}[device.deviceType] ?? '0.023456'),
    startedAt: anchor - 30000, completedStartedAt: anchor - 600000,
  };
  const byId = new Map(fleet.map(device => [device.id, snapshots[device.id].device])), devices = fleet.map(device => device.id);
  const deviceType=id=>byId.get(id).deviceType;
  const deviceName=id=>byId.get(id).name;
  const instance=id=>byId.get(id).instanceNo;
  const amount=id=>snapshots[id].amount;
  const total=(devices.reduce((sum,id)=>sum+Math.round(Number(amount(id))*1e6),0)/1e6).toFixed(6);
  const task = (deviceId, status, history = false) => {
    const cloud = deviceType(deviceId) === 'CLOUD', index = cloud ? 1 : 0;
    const start = history ? snapshots[deviceId].completedStartedAt : snapshots[deviceId].startedAt;
    const execution = simulated ? { executionMode: 'SIMULATED', proofKind: 'TASK_RECEIPT', modelExecuted: false }
      : cloud ? { executionMode: 'RULE_CYCLE', proofKind: 'RULE_SETTLEMENT', modelExecuted: false }
        : { executionMode: 'MODEL', proofKind: 'MODEL_EXECUTION', modelExecuted: true };
    return { ...proof, ...execution, protocolVersion: version, taskNo: `DEMO-TASK-${deviceId}-${history ? 'DONE' : 'LIVE'}`, deviceId,
      taskId: cloud ? 'cloud-cycle' : 'image-gen', taskName: ['PHONE','MOBILE'].includes(deviceType(deviceId))?`${deviceType(deviceId)} ${text('任务周期','task cycle','chu kỳ tác vụ')}`:names[index], taskClass: 'IG', model: simulated ? '' : cloud ? 'Cloud reward' : 'SDXL', client: 'UVEL', status,
      rewardUsdt: Number(amount(deviceId)), ...(simulated ? { rewardAsset: 'USDT', rewardAmount: amount(deviceId) } : {}),
      requiredSeconds: 60, queuedAt: start - 1000, startedAt: status === 'QUEUED' ? null : start, completableAt: ['QUEUED', 'RECOVERING'].includes(status) ? null : start + 60000,
      completedAt: history ? start + 60000 : null, actualDurationSec: status === 'QUEUED' ? null : history ? 60 : 30,
      receiptNo: history && !['pending', 'blocked'].includes(mode) ? `DEMO-RECEIPT-${deviceId}` : null,
      settlementStatus: history ? mode === 'pending' ? 'PENDING' : mode === 'blocked' ? 'BLOCKED' : 'POSTED' : 'NONE',
      settlementBatchNo: history && !simulated && !['pending', 'blocked'].includes(mode) ? 'DEMO-BATCH-1' : null,
      settledAt: history ? anchor - 60000 : null, configVersion: 'compute-demo-3', proofNonce: null, proofExpiresAt: null, pausedAt: null, pausedSeconds: 0 };
  };
  const status = ({ queued: 'QUEUED', verifying: 'VERIFYING', recovering: 'RECOVERING', failed: 'FAILED', cancelled: 'CANCELLED' })[mode] || 'RUNNING';
  if (path === '/api/tasks/assignments' || path === '/api/tasks/v2/assignments') return { ...proof, protocolVersion: version, serverNow: now,
    pendingEarned: [{ asset: 'USDT', amount: ['pending','blocked'].includes(mode) ? total : '0.000000', taskCount: ['pending','blocked'].includes(mode) ? devices.length : 0 }],
    devices: devices.map(deviceId => ({ deviceId, instanceNo: instance(deviceId), deviceType: deviceType(deviceId), lockUntil: null,
      recoveryPending: mode === 'recovering', recoveryReason: mode === 'recovering' ? 'LEGACY_COMPLETE_OUTCOME_UNKNOWN' : null,
      simulationState: state.stoppedDevices?.includes(deviceId) ? 'STOPPED' : 'RUNNING',
      currentTask: state.stoppedDevices?.includes(deviceId) || mode === 'recovering' ? null : task(deviceId, status), recentTasks: [task(deviceId, 'COMPLETED', true)] })) };
  // App 99cf4991's minute-batch fixture, extended to cover hardware and Cloud Share together.
  const batch = { batchNo: 'DEMO-BATCH-1', asset: 'USDT', amount: total, taskCount: devices.length, status: 'POSTED', windowStart: anchor - 600000, windowEnd: anchor - 540000, postedAt: anchor - 60000 };
  if (path === '/api/tasks/v2/settlements') return { ...proof, records: devices.length ? [batch] : [], nextCursor: null };
  if (path === '/api/tasks/v2/settlements/DEMO-BATCH-1') return { ...proof, ...batch, items: devices.map(deviceId => ({ taskNo: `DEMO-TASK-${deviceId}-DONE`, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceId, taskType: 'IG', amount: amount(deviceId), completedAt: anchor - 540000 })) };
  const receipts = devices.map(deviceId => {
    const done = task(deviceId, 'COMPLETED', true);
    return { ...done, settledAt: simulated?done.settledAt:done.completedAt, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceInstanceNo: instance(deviceId), deviceName: deviceName(deviceId), deviceType: deviceType(deviceId), deviceGpu: byId.get(deviceId).gpuModel, vramTotalGb: byId.get(deviceId).vramTotalGb,
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
