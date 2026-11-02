// Loopback-only task-cycle, v2 and receipt scenarios. Never imported by src.
const proof = { source: 'server', sourceEnvironment: 'PRODUCTION', runId: '', serverCanonical: true };
export function computeDemo(url, locale, state, request) {
  const path = url.pathname;
  if (!path.startsWith('/api/tasks/')) return undefined;
  const now = Date.now(), mode = state.computeState || 'cycles';
  const simulated = mode === 'cycles', version = simulated ? 3 : 2;
  const empty = state.dataState === 'empty' || state.fleetState === 'none';
  const text = (zh, en, vi) => locale === 'zh' ? zh : locale === 'vi' ? vi : en;
  const names = [text('图像生成周期', 'Image generation cycle', 'Chu kỳ tạo ảnh'), text('Cloud Share 收益周期', 'Cloud Share reward cycle', 'Chu kỳ thu nhập Cloud Share')];
  const anchor=state.computeAnchor??=now;
  const devices = state.fleetState==='phone-history'?[41,42,43,44]:[41,42];
  const deviceType=id=>({41:'BOX',42:'CLOUD',43:'PHONE',44:'MOBILE'})[id];
  const deviceName=id=>({41:'UVELBox S1',42:'Cloud Share',43:'Demo PHONE',44:'Demo MOBILE'})[id];
  const instance=id=>id===41?'REVIEW-S1':id===42?'DEMO-CLOUD':`DEMO-${deviceType(id)}`;
  const amount=id=>id===41?'0.023456':id===42?'0.000032':id===43?'0.100000':'0.200000';
  const total=devices.length===4?'0.323488':'0.023488';
  const task = (deviceId, status, history = false) => {
    const cloud = deviceId === 42, index = cloud ? 1 : 0;
    const start = history ? anchor - 600000 : now - 30000;
    const execution = simulated ? { executionMode: 'SIMULATED', proofKind: 'TASK_RECEIPT', modelExecuted: false }
      : cloud ? { executionMode: 'RULE_CYCLE', proofKind: 'RULE_SETTLEMENT', modelExecuted: false }
        : { executionMode: 'MODEL', proofKind: 'MODEL_EXECUTION', modelExecuted: true };
    return { ...proof, ...execution, protocolVersion: version, taskNo: `DEMO-TASK-${deviceId}-${history ? 'DONE' : 'LIVE'}`, deviceId,
      taskId: cloud ? 'cloud-cycle' : 'image-gen', taskName: deviceId>42?`${deviceType(deviceId)} ${text('任务周期','task cycle','chu kỳ tác vụ')}`:names[index], taskClass: 'IG', model: simulated ? '' : cloud ? 'Cloud reward' : 'SDXL', client: 'UVEL', status,
      rewardUsdt: cloud && simulated ? 0 : Number(amount(deviceId)), ...(simulated ? { rewardAsset: cloud ? 'UVT' : 'USDT', rewardAmount: cloud ? '0.123456' : amount(deviceId) } : {}),
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
    devices: empty ? [] : devices.map(deviceId => ({ deviceId, instanceNo: instance(deviceId), deviceType: deviceType(deviceId), lockUntil: null,
      recoveryPending: mode === 'recovering', recoveryReason: mode === 'recovering' ? 'LEGACY_COMPLETE_OUTCOME_UNKNOWN' : null,
      simulationState: state.stoppedDevices?.includes(deviceId) ? 'STOPPED' : 'RUNNING',
      currentTask: state.stoppedDevices?.includes(deviceId) || mode === 'recovering' ? null : task(deviceId, status), recentTasks: [task(deviceId, 'COMPLETED', true)] })) };
  // App 99cf4991's minute-batch fixture, extended to cover hardware and Cloud Share together.
  const batch = { batchNo: 'DEMO-BATCH-1', asset: 'USDT', amount: total, taskCount: devices.length, status: 'POSTED', windowStart: anchor - 600000, windowEnd: anchor - 540000, postedAt: anchor - 60000 };
  if (path === '/api/tasks/v2/settlements') return { ...proof, records: empty ? [] : [batch], nextCursor: null };
  if (path === '/api/tasks/v2/settlements/DEMO-BATCH-1') return { ...proof, ...batch, items: devices.map(deviceId => ({ taskNo: `DEMO-TASK-${deviceId}-DONE`, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceId, taskType: 'IG', amount: amount(deviceId), completedAt: anchor - 540000 })) };
  const receipts = devices.map(deviceId => {
    const done = task(deviceId, 'COMPLETED', true);
    return { ...done, settledAt: simulated?done.settledAt:done.completedAt, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceInstanceNo: instance(deviceId), deviceName: deviceName(deviceId), deviceType: deviceType(deviceId), deviceGpu: deviceId === 41 ? '4 × RTX 4090' : '', vramTotalGb: deviceId === 41 ? 96 : null,
      rewardNex: deviceId === 42 && simulated ? .123456 : 0, earningStatus: 'POSTED', proofHash: simulated ? null : 'a'.repeat(64), durationSec: 60 };
  });
  // Current summary DTO omits posting time; direct simulated receipt details carry it.
  if (path === '/api/tasks/receipts') return { ...proof, items: empty ? [] : receipts.map(({settledAt,...summary})=>summary), total: empty ? 0 : receipts.length, nextOffset: null, nextCursor: null };
  if (path.startsWith('/api/tasks/receipts/')) return receipts.find(row => row.receiptNo === decodeURIComponent(path.split('/').pop()));
  if (path === '/api/tasks/simulated/stop' && request.method() === 'POST') {
    const { deviceId, expectedVersion } = request.postDataJSON();
    if (!devices.includes(deviceId) || expectedVersion !== 1) throw Object.assign(new Error('DEVICE_VERSION_CONFLICT'), { status: 409 });
    state.stoppedDevices ??= []; state.stoppedDevices.push(deviceId);
    return { deviceId, simulationState: 'STOPPED' };
  }
  return undefined;
}
