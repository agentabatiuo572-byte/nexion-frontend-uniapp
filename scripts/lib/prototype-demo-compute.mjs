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
  const devices = [41, 42];
  const task = (deviceId, status, history = false) => {
    const cloud = deviceId === 42, index = cloud ? 1 : 0;
    const start = now - (history ? 120000 : 30000);
    const execution = simulated ? { executionMode: 'SIMULATED', proofKind: 'TASK_RECEIPT', modelExecuted: false }
      : cloud ? { executionMode: 'RULE_CYCLE', proofKind: 'RULE_SETTLEMENT', modelExecuted: false }
        : { executionMode: 'MODEL', proofKind: 'MODEL_EXECUTION', modelExecuted: true };
    return { ...proof, ...execution, protocolVersion: version, taskNo: `DEMO-TASK-${deviceId}-${history ? 'DONE' : 'LIVE'}`, deviceId,
      taskId: cloud ? 'cloud-cycle' : 'image-gen', taskName: names[index], taskClass: 'IG', model: simulated ? '' : cloud ? 'Cloud reward' : 'SDXL', client: 'UVEL', status,
      rewardUsdt: cloud && simulated ? 0 : cloud ? .000032 : .023456, ...(simulated ? { rewardAsset: cloud ? 'UVT' : 'USDT', rewardAmount: cloud ? '0.123456' : '0.023456' } : {}),
      requiredSeconds: 60, queuedAt: start - 1000, startedAt: status === 'QUEUED' ? null : start, completableAt: ['QUEUED', 'RECOVERING'].includes(status) ? null : start + 60000,
      completedAt: history ? start + 60000 : null, actualDurationSec: status === 'QUEUED' ? null : history ? 60 : 30,
      receiptNo: history && !['pending', 'blocked'].includes(mode) ? `DEMO-RECEIPT-${deviceId}` : null,
      settlementStatus: history ? mode === 'pending' ? 'PENDING' : mode === 'blocked' ? 'BLOCKED' : 'POSTED' : 'NONE',
      settlementBatchNo: history && !simulated && !['pending', 'blocked'].includes(mode) ? 'DEMO-BATCH-1' : null,
      settledAt: history ? start + 61000 : null, configVersion: 'compute-demo-3', proofNonce: null, proofExpiresAt: null, pausedAt: null, pausedSeconds: 0 };
  };
  const status = ({ queued: 'QUEUED', verifying: 'VERIFYING', recovering: 'RECOVERING', failed: 'FAILED', cancelled: 'CANCELLED' })[mode] || 'RUNNING';
  if (path === '/api/tasks/assignments' || path === '/api/tasks/v2/assignments') return { ...proof, protocolVersion: version, serverNow: now,
    pendingEarned: [{ asset: 'USDT', amount: mode === 'pending' ? '0.023488' : '0.000000', taskCount: mode === 'pending' ? 2 : 0 }],
    devices: empty ? [] : devices.map(deviceId => ({ deviceId, instanceNo: deviceId === 41 ? 'REVIEW-S1' : 'DEMO-CLOUD', deviceType: deviceId === 41 ? 'BOX' : 'CLOUD', lockUntil: null,
      recoveryPending: mode === 'recovering', recoveryReason: mode === 'recovering' ? 'LEGACY_COMPLETE_OUTCOME_UNKNOWN' : null,
      simulationState: state.stoppedDevices?.includes(deviceId) ? 'STOPPED' : 'RUNNING',
      currentTask: state.stoppedDevices?.includes(deviceId) || mode === 'recovering' ? null : task(deviceId, status), recentTasks: [task(deviceId, 'COMPLETED', true)] })) };
  // App 99cf4991's minute-batch fixture, extended to cover hardware and Cloud Share together.
  const batch = { batchNo: 'DEMO-BATCH-1', asset: 'USDT', amount: '0.023488', taskCount: 2, status: 'POSTED', windowStart: now - 120000, windowEnd: now - 60000, postedAt: now - 59000 };
  if (path === '/api/tasks/v2/settlements') return { ...proof, records: empty ? [] : [batch], nextCursor: null };
  if (path === '/api/tasks/v2/settlements/DEMO-BATCH-1') return { ...proof, ...batch, items: devices.map(deviceId => ({ taskNo: `DEMO-TASK-${deviceId}-DONE`, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceId, taskType: 'IG', amount: deviceId === 41 ? '0.023456' : '0.000032', completedAt: now - 60000 })) };
  const receipts = devices.map(deviceId => {
    const done = task(deviceId, 'COMPLETED', true);
    return { ...done, receiptNo: `DEMO-RECEIPT-${deviceId}`, deviceInstanceNo: deviceId === 41 ? 'REVIEW-S1' : 'DEMO-CLOUD', deviceName: deviceId === 41 ? 'UVELBox S1' : 'Cloud Share', deviceType: deviceId === 41 ? 'BOX' : 'CLOUD', deviceGpu: deviceId === 41 ? '4 × RTX 4090' : '', vramTotalGb: deviceId === 41 ? 96 : null,
      rewardNex: deviceId === 42 && simulated ? .123456 : 0, earningStatus: 'POSTED', proofHash: simulated ? null : 'a'.repeat(64), durationSec: 60 };
  });
  if (path === '/api/tasks/receipts') return { ...proof, items: empty ? [] : receipts, total: empty ? 0 : receipts.length, nextOffset: null, nextCursor: null };
  if (path.startsWith('/api/tasks/receipts/')) return receipts.find(row => row.receiptNo === decodeURIComponent(path.split('/').pop()));
  if (path === '/api/tasks/simulated/stop' && request.method() === 'POST') {
    const { deviceId, expectedVersion } = request.postDataJSON();
    if (!devices.includes(deviceId) || expectedVersion !== 1) throw Object.assign(new Error('DEVICE_VERSION_CONFLICT'), { status: 409 });
    state.stoppedDevices ??= []; state.stoppedDevices.push(deviceId);
    return { deviceId, simulationState: 'STOPPED' };
  }
  return undefined;
}
