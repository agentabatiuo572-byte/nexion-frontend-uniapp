// Isolated prototype state. This module is never part of the production app.
// Models the App side of /api/app/team/ambassador-applications as the server answers it: history,
// latest and create, the material packet (GET/POST), multipart material uploads and private file reads.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const base = '/api/app/team/ambassador-applications';
const proof = { source: 'server', sourceEnvironment: 'PRODUCTION', runId: '' };
const day = 86400000;
const SAMPLES = {
  png: { bytes: readFileSync(path.join(import.meta.dirname, '../fixtures/ambassador-sample.png')), contentType: 'image/png' },
  pdf: { bytes: readFileSync(path.join(import.meta.dirname, '../fixtures/ambassador-sample.pdf')), contentType: 'application/pdf' },
};
const REQUIREMENTS = { venue: ['attendance', 'activity', 'expense'], kol: ['promotion', 'traffic', 'expense'], print: ['materials', 'quota', 'expense'], dev: ['requirements', 'work_hours', 'acceptance', 'expense'] };
const LABELS = { attendance: 'Attendance and unique participants', activity: 'Evidence of the event', expense: 'Expense receipts', promotion: 'Promotional content', traffic: 'Traffic data', materials: 'Material inventory', quota: 'Quota usage', requirements: 'Requirements', work_hours: 'Work logs', acceptance: 'Delivery acceptance' };
const KINDS = new Set(Object.values(REQUIREMENTS).flat());
// Uploaded bytes stay in this server process; the shared demo state keeps only their metadata.
const uploadedBytes = new Map();

const text = (locale, zh, en, vi) => ({ zh, en, vi }[locale] ?? en);
const localized = (value, locale) => typeof value === 'string' ? value : text(locale, value.zh, value.en, value.vi);
/** The server's business calendar day (UTC+8), which final approval compares the event date with. */
const businessDay = (offset = 0) => new Date(Date.now() + 8 * 3600000 + offset * day).toISOString().slice(0, 10);
const reject = (message, status) => { throw Object.assign(new Error(message), { status }); };
const header = (request, name) => { const headers = request.headers?.() ?? {}; return headers[name] ?? headers[name.toLowerCase()]; };

function review(status, at, extra = {}) {
  return { status, reviewerLabel: status === 'PENDING' ? null : extra.stage === 'FINANCE' ? 'admin:demo-finance' : 'admin:demo-business', reviewedAt: at, reason: null, ...extra };
}
function sampleFile(id, applicationId, kind, sample, name) { return { fileId: id, applicationId, kind, sample, name }; }

/** One coherent account per scenario: at most one pending application, history newest first. */
function seed(scenario, empty) {
  const files = {};
  const add = (file) => { files[file.fileId] = file; return file.fileId; };
  const venueFiles = (id, prefix) => [
    add(sampleFile(`${prefix}-a1`, id, 'attendance', 'png', { zh: '签到表-1102.png', en: 'sign-in-sheet-1102.png', vi: 'bang-diem-danh-1102.png' })),
    add(sampleFile(`${prefix}-b1`, id, 'activity', 'png', { zh: '现场照片-01.png', en: 'venue-photo-01.png', vi: 'anh-hien-truong-01.png' })),
    add(sampleFile(`${prefix}-b2`, id, 'activity', 'png', { zh: '现场照片-02.png', en: 'venue-photo-02.png', vi: 'anh-hien-truong-02.png' })),
    add(sampleFile(`${prefix}-b3`, id, 'activity', 'png', { zh: '现场照片-03.png', en: 'venue-photo-03.png', vi: 'anh-hien-truong-03.png' })),
    add(sampleFile(`${prefix}-c1`, id, 'expense', 'pdf', { zh: '场地租赁发票.pdf', en: 'venue-rental-invoice.pdf', vi: 'hoa-don-thue-dia-diem.pdf' })),
  ];
  const statement = { zh: '在胡志明市第一郡举办 UVEL 社区见面会。签到表由现场二维码签到导出，附现场照片 3 张，费用凭证为场地租赁发票。', en: 'UVEL community meetup in District 1, Ho Chi Minh City. The sign-in sheet was exported from on-site QR check-in; three venue photos are attached, and the expense receipt is the venue rental invoice.', vi: 'Buổi gặp gỡ cộng đồng UVEL tại Quận 1, TP. Hồ Chí Minh. Bảng điểm danh xuất từ mã QR tại chỗ, kèm 3 ảnh hiện trường; chứng từ chi phí là hóa đơn thuê địa điểm.' };
  const at = (offset, time) => `${businessDay(offset)}T${time}:00`;
  const history = [
    { app: { applicationId: 5, status: 'APPROVED', city: { zh: '河内 · 还剑郡', en: 'Hanoi · Hoan Kiem', vi: 'Hà Nội · Hoàn Kiếm' }, eventDate: businessDay(-19), budgetUsdt: 3000, bucket: 'venue', submittedAt: new Date(Date.now() - 30 * day).toISOString() },
      rec: { revision: 1, attachments: [add(sampleFile('f5-a', 5, 'attendance', 'png', { zh: '签到表-1020.png', en: 'sign-in-sheet-1020.png', vi: 'bang-diem-danh-1020.png' })), add(sampleFile('f5-b', 5, 'activity', 'png', { zh: '现场合影.png', en: 'group-photo.png', vi: 'anh-tap-the.png' })), add(sampleFile('f5-c', 5, 'expense', 'pdf', { zh: '场地与餐饮发票.pdf', en: 'venue-and-catering-invoice.pdf', vi: 'hoa-don-dia-diem-an-uong.pdf' }))],
        statement: { zh: '河内还剑郡线下见面会，签到 146 人，附场地与餐饮发票。', en: 'Offline meetup in Hoan Kiem, Hanoi with 146 sign-ins; venue and catering invoice attached.', vi: 'Gặp mặt offline tại Hoàn Kiếm, Hà Nội, 146 lượt điểm danh; kèm hóa đơn địa điểm và ăn uống.' },
        business: review('PASSED', at(-17, '16:40'), { reason: { zh: '签到与现场照片一致。', en: 'Sign-ins match the venue photos.', vi: 'Điểm danh khớp với ảnh hiện trường.' }, verifiedAttendees: 146 }),
        finance: review('PASSED', at(-16, '11:15'), { stage: 'FINANCE', reason: { zh: '发票金额完整。', en: 'Invoice total is complete.', vi: 'Hóa đơn đầy đủ.' }, recognizedBudgetUsdt: 3000 }) } },
    { app: { applicationId: 4, status: 'REJECTED', city: { zh: '岘港 · 美溪沙滩', en: 'Da Nang · My Khe Beach', vi: 'Đà Nẵng · Biển Mỹ Khê' }, eventDate: businessDay(-57), budgetUsdt: 2500, bucket: 'kol', submittedAt: new Date(Date.now() - 70 * day).toISOString() },
      rec: { revision: 1, attachments: [add(sampleFile('f4-a', 4, 'promotion', 'png', { zh: '推广海报.png', en: 'promo-poster.png', vi: 'poster-quang-ba.png' })), add(sampleFile('f4-b', 4, 'traffic', 'png', { zh: '后台流量截图.png', en: 'traffic-dashboard.png', vi: 'anh-luu-luong.png' })), add(sampleFile('f4-c', 4, 'expense', 'pdf', { zh: '达人合作发票.pdf', en: 'creator-invoice.pdf', vi: 'hoa-don-hop-tac.pdf' }))],
        statement: { zh: '与本地达人合作推广 UVEL 社区活动。', en: 'Promotion of the UVEL community event with a local creator.', vi: 'Hợp tác với người sáng tạo địa phương quảng bá sự kiện cộng đồng UVEL.' },
        business: review('NEEDS_MORE', at(-53, '09:30'), { reason: { zh: '推广内容未提及申请城市，流量截图无法对应到本次活动。', en: 'The promotion does not mention the city, and the traffic screenshot cannot be matched to this event.', vi: 'Nội dung quảng bá không nhắc đến thành phố đăng ký, ảnh lưu lượng không khớp với sự kiện này.' }, verifiedAttendees: null }),
        finance: review('PENDING', null, { stage: 'FINANCE' }) } },
    { app: { applicationId: 2, status: 'APPROVED', city: { zh: '胡志明市 · 第三郡', en: 'Ho Chi Minh City · District 3', vi: 'TP. Hồ Chí Minh · Quận 3' }, eventDate: businessDay(-70), budgetUsdt: 800, bucket: 'print', submittedAt: new Date(Date.now() - 90 * day).toISOString() },
      rec: { revision: 0 } },
  ];
  const pendingVenue = (materialState) => {
    const future = materialState === 'draft' || materialState === 'future';
    const app = { applicationId: 7, status: 'PENDING', city: { zh: '胡志明市 · 第一郡', en: 'Ho Chi Minh City · District 1', vi: 'TP. Hồ Chí Minh · Quận 1' }, eventDate: businessDay(future ? 7 : -6), budgetUsdt: 3000, bucket: 'venue', submittedAt: new Date(Date.now() - 9 * day).toISOString() };
    if (materialState === 'draft') return { app, rec: { revision: 0 } };
    const rec = { revision: 1, attachments: venueFiles(7, 'f7'), statement };
    // Submitted without two required kinds: the server lists them as missing although no file exists.
    if (materialState === 'partial') return { app, rec: { ...rec, attachments: rec.attachments.slice(0, 1), business: null, finance: null } };
    const businessPassed = (n) => review('PASSED', at(-4, '14:20'), { reason: { zh: '签到表与现场照片一致。', en: 'The sign-in sheet matches the venue photos.', vi: 'Bảng điểm danh khớp với ảnh hiện trường.' }, verifiedAttendees: n });
    const financePassed = (amount) => review('PASSED', at(-3, '10:05'), { stage: 'FINANCE', reason: { zh: '发票已核对。', en: 'Invoices checked.', vi: 'Đã đối chiếu hóa đơn.' }, recognizedBudgetUsdt: amount });
    if (materialState === 'review') Object.assign(rec, { business: businessPassed(128), finance: review('PENDING', null, { stage: 'FINANCE' }) });
    if (materialState === 'more-finance') Object.assign(rec, { business: businessPassed(132), finance: review('NEEDS_MORE', at(-3, '10:05'), { stage: 'FINANCE', reason: { zh: '发票合计 2,400 USDT，低于申请额。请补充其余发票，或下调申请额后重新提交。', en: 'Invoices total 2,400 USDT, below the request. Add the remaining invoices, or lower the amount and resubmit.', vi: 'Tổng hóa đơn 2.400 USDT, thấp hơn số tiền đề nghị. Hãy bổ sung các hóa đơn còn lại hoặc giảm số tiền rồi nộp lại.' }, recognizedBudgetUsdt: 2400, missingKinds: ['expense'] }) });
    if (materialState === 'more-business') Object.assign(rec, { business: review('NEEDS_MORE', at(-4, '14:20'), { reason: { zh: '现场照片看不出活动名称，请补充带横幅或签到台的照片。', en: 'The photos do not show the event name. Add photos with the banner or sign-in desk.', vi: 'Ảnh hiện trường không thấy tên sự kiện. Hãy bổ sung ảnh có băng rôn hoặc bàn điểm danh.' }, verifiedAttendees: 0, missingKinds: ['activity'] }), finance: financePassed(3000) });
    if (materialState === 'passed' || materialState === 'future') Object.assign(rec, { business: businessPassed(146), finance: financePassed(3000) });
    if (materialState === 'passed-short') Object.assign(rec, { business: businessPassed(146), finance: financePassed(2000) });
    if (materialState === 'passed-precise') Object.assign(rec, { business: businessPassed(146), finance: financePassed(2999.999999) });
    return { app, rec };
  };
  let rows = [];
  if (empty || scenario === 'none') rows = [];
  else if (scenario === 'approved') rows = history;
  else if (scenario === 'rejected') rows = history.filter(row => row.app.applicationId !== 5);
  else if (scenario === 'bucket') rows = [history[0], history[1], { app: { applicationId: 3, status: 'PENDING', city: { zh: '芽庄 · 陈富街', en: 'Nha Trang · Tran Phu Street', vi: 'Nha Trang · Đường Trần Phú' }, eventDate: businessDay(20), budgetUsdt: 1500, bucket: null, submittedAt: new Date(Date.now() - 80 * day).toISOString() }, rec: { revision: 0 } }, history[2]];
  else rows = [pendingVenue(scenario), ...history];
  for (const id of Object.keys(files)) if (!rows.some(row => row.app.applicationId === files[id].applicationId)) delete files[id];
  return { applications: rows.map(row => ({ ...proof, ...row.app })), materials: Object.fromEntries(rows.map(row => [row.app.applicationId, row.rec])), files, commands: {}, uploads: {}, nextId: 8, nextFile: 1 };
}

function demo(state) {
  state.ambassadorDemo ??= seed(state.ambassadorState || 'none', state.dataState === 'empty');
  return state.ambassadorDemo;
}
const applicationView = (app, record, files, locale) => ({ ...app, city: localized(app.city, locale), materialRevision: record.revision, materialState: packet(app, record, files, locale).materialState });
function reviewView(value, locale, stage) {
  const view = { status: value?.status ?? 'PENDING', reviewerLabel: value?.reviewerLabel ?? null, reviewedAt: value?.reviewedAt ?? null, reason: value?.reason ? localized(value.reason, locale) : null };
  return stage === 'BUSINESS' ? { ...view, verifiedAttendees: value?.verifiedAttendees ?? null } : { ...view, recognizedBudgetUsdt: value?.recognizedBudgetUsdt ?? null };
}
function attachmentView(file, locale) {
  const bytes = file.sample ? SAMPLES[file.sample].bytes : uploadedBytes.get(file.fileId);
  return { fileId: file.fileId, kind: file.kind, name: localized(file.name, locale), contentType: file.sample ? SAMPLES[file.sample].contentType : file.contentType, sizeBytes: bytes?.length ?? file.sizeBytes };
}
/** The packet as AmbassadorMaterialService.packet() derives it for the App (admin = null). */
function packet(app, record, files, locale) {
  const bucket = app.bucket, current = record.revision > 0;
  const required = bucket ? REQUIREMENTS[bucket] : [];
  const attachments = current ? record.attachments.map(id => attachmentView(files[id], locale)) : [];
  const business = current ? record.business : null, finance = current ? record.finance : null;
  const needsMore = [business, finance].some(item => item?.status === 'NEEDS_MORE');
  const requested = [business, finance].filter(item => item?.status === 'NEEDS_MORE').flatMap(item => item.missingKinds ?? []);
  const missingKinds = [...new Set([...required.filter(kind => !current || !attachments.some(file => file.kind === kind)), ...requested])];
  const materialState = !current ? 'NOT_SUBMITTED' : needsMore ? 'NEEDS_MORE' : business?.status === 'PASSED' && finance?.status === 'PASSED' && !missingKinds.length ? 'PASSED' : 'PENDING';
  const blockers = [];
  if (app.status !== 'PENDING') blockers.push('APPLICATION_NOT_PENDING');
  if (!bucket) blockers.push('APPLICATION_BUCKET_REQUIRED');
  if (!current) blockers.push('MATERIALS_NOT_SUBMITTED');
  else {
    if (missingKinds.length) blockers.push('AMBASSADOR_REQUIRED_MATERIAL_MISSING');
    if (business?.status !== 'PASSED') blockers.push('BUSINESS_REVIEW_REQUIRED');
    if (finance?.status !== 'PASSED') blockers.push('FINANCE_REVIEW_REQUIRED');
    if (needsMore) blockers.push('MATERIALS_NEEDS_MORE');
    if (bucket === 'venue' && !(business?.verifiedAttendees >= 100)) blockers.push('AMBASSADOR_VERIFIED_ATTENDEES_INVALID');
    if (!(app.budgetUsdt > 0) || finance?.recognizedBudgetUsdt == null || finance.recognizedBudgetUsdt < app.budgetUsdt) blockers.push('RECOGNIZED_AMOUNT_INSUFFICIENT');
    if (app.eventDate > businessDay()) blockers.push('EVENT_NOT_COMPLETED');
  }
  const requirementsFor = (id) => REQUIREMENTS[id].map(kind => ({ kind, label: LABELS[kind], required: true }));
  return { applicationId: app.applicationId, bucket, eventDate: app.eventDate, budgetUsdt: app.budgetUsdt, materialRevision: record.revision, materialState,
    requirements: bucket ? requirementsFor(bucket) : [], requirementsByBucket: Object.fromEntries(Object.keys(REQUIREMENTS).map(id => [id, requirementsFor(id)])),
    attachments, businessReview: reviewView(business, locale, 'BUSINESS'), financeReview: reviewView(finance, locale, 'FINANCE'), missingKinds,
    statement: current ? localized(record.statement, locale) : '', canSubmit: app.status === 'PENDING', canReviewBusiness: false, canReviewFinance: false, canApprove: false,
    approvalBlockers: blockers, legacyApproved: app.status === 'APPROVED' && !current };
}
function owned(data, id) {
  const app = data.applications.find(row => row.applicationId === id);
  if (!app) reject('AMBASSADOR_APPLICATION_NOT_FOUND', 404);
  return app;
}
const sameInput = (app, input) => app.eventDate === input.eventDate && localized(app.city, 'en') === input.city.trim() && app.budgetUsdt === input.budgetUsdt && app.bucket === input.bucket;

export function ambassadorDemo(url, state, request, locale = 'zh') {
  const pathname = url.pathname;
  const materials = pathname.match(/^\/api\/app\/team\/ambassador-applications\/(\d+)\/materials$/);
  if (pathname !== base && pathname !== base + '/latest' && !materials) return undefined;
  const data = demo(state);
  const method = request.method();
  if (materials) {
    const id = Number(materials[1]), app = owned(data, id), record = data.materials[id];
    if (method === 'GET') return packet(app, record, data.files, locale);
    if (method !== 'POST') return undefined;
    const key = header(request, 'Idempotency-Key');
    if (!key) reject('IDEMPOTENCY_KEY_REQUIRED', 400);
    const input = request.postDataJSON() || {};
    const hash = JSON.stringify(input);
    if (data.commands[key]) return data.commands[key].hash === hash ? structuredClone(data.commands[key].result) : reject('IDEMPOTENCY_KEY_CONFLICT', 409);
    if (state.ambassadorIoState === 'save-unknown-once') { state.ambassadorIoState = 'normal'; reject('暂时无法连接，请稍后再试', 503); }
    if (state.ambassadorIoState === 'save-reject-once') { state.ambassadorIoState = 'normal'; reject('AMBASSADOR_MATERIAL_SUBMISSION_INVALID', 422); }
    // The application is decided while the user edits: the server refuses the new version.
    if (state.ambassadorIoState === 'close-on-submit-once') { state.ambassadorIoState = 'normal'; app.status = 'REJECTED'; reject('APPLICATION_NOT_PENDING', 409); }
    if (app.status !== 'PENDING') reject('APPLICATION_NOT_PENDING', 409);
    if (input.expectedMaterialRevision !== record.revision) reject('MATERIAL_REVISION_STALE', 409);
    const statement = typeof input.statement === 'string' ? input.statement.trim() : '';
    if (!statement || input.statement.length > 4000 || !Array.isArray(input.attachments) || input.attachments.length < 1 || input.attachments.length > 12) reject('AMBASSADOR_MATERIAL_SUBMISSION_INVALID', 422);
    let bucket = app.bucket;
    if (!bucket) { if (!REQUIREMENTS[input.bucket]) reject('APPLICATION_BUCKET_REQUIRED', 422); bucket = input.bucket; }
    else if (input.bucket !== undefined && input.bucket !== bucket) reject('AMBASSADOR_BUCKET_CHANGE_FORBIDDEN', 422);
    const ids = input.attachments.map(item => item?.fileId);
    if (new Set(ids).size !== ids.length) reject('AMBASSADOR_MATERIAL_ATTACHMENT_INVALID', 422);
    for (const item of input.attachments) {
      const file = data.files[item?.fileId];
      if (!REQUIREMENTS[bucket].includes(item?.kind)) reject('AMBASSADOR_MATERIAL_ATTACHMENT_INVALID', 422);
      if (!file || file.applicationId !== id || file.kind !== item.kind) reject('AMBASSADOR_MATERIAL_FILE_FORBIDDEN', 403);
      if (!file.sample && !uploadedBytes.has(file.fileId)) reject('AMBASSADOR_MATERIAL_FILE_MISSING', 409);
    }
    let budget = app.budgetUsdt;
    if (input.budgetUsdt !== undefined && input.budgetUsdt !== app.budgetUsdt) {
      const returned = record.revision > 0 && [record.business, record.finance].some(item => item?.status === 'NEEDS_MORE');
      if (!returned) reject('AMBASSADOR_BUDGET_DECREASE_REQUIRES_RETURN', 422);
      if (!Number.isFinite(input.budgetUsdt) || input.budgetUsdt <= 0 || input.budgetUsdt > app.budgetUsdt || !/^\d+(?:\.\d{1,6})?$/.test(String(input.budgetUsdt))) reject('AMBASSADOR_BUDGET_INVALID', 422);
      budget = input.budgetUsdt;
    }
    // A new version: both reviews start over; earlier passes never carry forward.
    Object.assign(app, { bucket, budgetUsdt: budget });
    data.materials[id] = { revision: record.revision + 1, attachments: ids, statement, business: null, finance: null };
    const result = packet(app, data.materials[id], data.files, locale);
    data.commands[key] = { hash, result };
    // The new version is stored, but the reply is lost on the way back.
    if (state.ambassadorIoState === 'save-lands-unknown-once') { state.ambassadorIoState = 'normal'; reject('暂时无法连接，请稍后再试', 503); }
    return structuredClone(result);
  }
  const views = () => data.applications.map(app => applicationView(app, data.materials[app.applicationId], data.files, locale));
  if (method === 'POST' && pathname === base) {
    const key = header(request, 'Idempotency-Key');
    const input = request.postDataJSON() || {};
    const hash = JSON.stringify([input.eventDate, input.city, input.budgetUsdt, input.bucket]);
    if (key && data.commands[key]) return data.commands[key].hash === hash ? structuredClone(data.commands[key].result) : reject('IDEMPOTENCY_KEY_CONFLICT', 409);
    if (!state.highestRank && state.ambassadorRank !== 'v5') reject('DEMO_APPLICATION_RANK_REQUIRED', 403);
    if (!['venue', 'kol', 'print', 'dev'].includes(input.bucket) || !/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate || '')
      || typeof input.city !== 'string' || !input.city.trim() || !Number.isFinite(input.budgetUsdt) || input.budgetUsdt < 100 || input.budgetUsdt > 10000) reject('DEMO_APPLICATION_INVALID', 400);
    const pending = data.applications.find(app => app.status === 'PENDING');
    // The same intent under a new key returns the pending application; a different one is refused.
    if (pending) return sameInput(pending, input) ? applicationView(pending, data.materials[pending.applicationId], data.files, locale) : reject('AMBASSADOR_APPLICATION_PENDING', 409);
    const app = { ...proof, applicationId: data.nextId++, status: 'PENDING', city: input.city.trim(), eventDate: input.eventDate, budgetUsdt: input.budgetUsdt, bucket: input.bucket, submittedAt: new Date().toISOString() };
    data.applications.unshift(app);
    data.materials[app.applicationId] = { revision: 0 };
    const result = applicationView(app, data.materials[app.applicationId], data.files, locale);
    if (key) data.commands[key] = { hash, result };
    return structuredClone(result);
  }
  if (method !== 'GET') return undefined;
  if (pathname === base && state.ambassadorIoState === 'history-fail-once') { state.ambassadorIoState = 'normal'; reject('暂时无法加载，请重试', 503); }
  const rows = views();
  if (pathname === base + '/latest') return rows[0] ?? { ...proof, applicationId: null, status: 'NONE' };
  const pageNum = Math.max(1, Number(url.searchParams.get('pageNum') || 1)), pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 20)));
  const page = rows.slice((pageNum - 1) * pageSize, pageNum * pageSize);
  return { ...proof, rows: page, pageNum, pageSize, total: rows.length, hasMore: (pageNum - 1) * pageSize + page.length < rows.length };
}

/** Upload (multipart) and private file reads carry raw bytes, so the server hands them over unparsed. */
export function ambassadorBinaryRoute(pathname, method) {
  if (method === 'POST' && /^\/api\/app\/team\/ambassador-applications\/\d+\/materials\/files$/.test(pathname)) return 'upload';
  if (method === 'GET' && /^\/api\/app\/team\/ambassador-applications\/\d+\/materials\/files\/[^/]+$/.test(pathname)) return 'file';
  return null;
}

function multipart(body, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!boundary) reject('AMBASSADOR_MATERIAL_UPLOAD_INVALID', 400);
  const marker = Buffer.from('--' + (boundary[1] || boundary[2]));
  const parts = {};
  let start = body.indexOf(marker);
  while (start >= 0) {
    const next = body.indexOf(marker, start + marker.length);
    if (next < 0) break;
    const part = body.subarray(start + marker.length + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, split).toString('utf8'), content = part.subarray(split + 4);
    const name = /name="([^"]*)"/.exec(head)?.[1];
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    if (name) parts[name] = filename === undefined ? content.toString('utf8') : { filename, bytes: content };
    start = next;
  }
  return parts;
}
const sniff = (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'image/png'
  : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : bytes.subarray(0, 5).toString('latin1') === '%PDF-' ? 'application/pdf' : null;

export async function ambassadorBinaryResponse(url, state, request, locale = 'zh') {
  const data = demo(state);
  const id = Number(url.pathname.split('/')[5]);
  const app = owned(data, id);
  if (request.method === 'GET') {
    const fileId = decodeURIComponent(url.pathname.split('/').pop());
    const file = data.files[fileId];
    if (!file || file.applicationId !== id) reject('AMBASSADOR_MATERIAL_FILE_NOT_FOUND', 404);
    const bytes = file.sample ? SAMPLES[file.sample].bytes : uploadedBytes.get(fileId);
    if (!bytes) reject('AMBASSADOR_MATERIAL_FILE_UNAVAILABLE', 503);
    return { file: { bytes, contentType: file.sample ? SAMPLES[file.sample].contentType : file.contentType, name: localized(file.name, locale) } };
  }
  const key = request.headers['idempotency-key'];
  if (!key) reject('IDEMPOTENCY_KEY_REQUIRED', 400);
  if (state.ambassadorIoState === 'upload-fail-once') { state.ambassadorIoState = 'normal'; reject('暂时无法上传，请重试', 503); }
  if (state.ambassadorIoState === 'upload-slow') await new Promise(resolve => setTimeout(resolve, 4000));
  if (app.status !== 'PENDING') reject('APPLICATION_NOT_PENDING', 409);
  const parts = multipart(request.body, request.headers['content-type']);
  const kind = parts.kind, file = parts.file;
  if (typeof kind !== 'string' || !(app.bucket ? REQUIREMENTS[app.bucket].includes(kind) : KINDS.has(kind)) || !file?.bytes) reject('AMBASSADOR_MATERIAL_UPLOAD_INVALID', 422);
  if (!file.bytes.length || file.bytes.length > 10 * 1024 * 1024) reject('AMBASSADOR_MATERIAL_FILE_TOO_LARGE', 413);
  const contentType = sniff(file.bytes);
  if (!contentType) reject('AMBASSADOR_MATERIAL_FILE_TYPE_UNSUPPORTED', 415);
  const name = file.filename.split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '').trim().slice(0, 180) || 'file';
  const hash = createHash('sha256').update(kind).update(name).update(file.bytes).digest('hex');
  const previous = data.uploads[key];
  if (previous) return previous.hash === hash && previous.applicationId === id ? { data: attachmentView(data.files[previous.fileId], locale) } : reject('IDEMPOTENCY_KEY_CONFLICT', 409);
  const fileId = `demo-upload-${data.nextFile++}`;
  uploadedBytes.set(fileId, file.bytes);
  data.files[fileId] = { fileId, applicationId: id, kind, name, contentType, sizeBytes: file.bytes.length, sample: null };
  data.uploads[key] = { hash, fileId, applicationId: id };
  return { data: attachmentView(data.files[fileId], locale) };
}
