// Loopback preview command and receipt routes for B87. Never loaded by the App.
import { randomUUID } from 'node:crypto';
import { demoTeamBusinessDate } from './prototype-demo-events.mjs';
import { rankSalaryPaidFacts, rankSalaryReadback } from './prototype-demo-rank-presets.mjs';
import { postDemoWalletEntries } from './prototype-demo-wallet.mjs';

const claimPath = '/api/team/rank/salary/claim';
const receiptsPath = '/api/team/rank/salary/claims/';
const validKey = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,95}$/;
const validMonth = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;
const validAmount = /^\d{1,12}(\.\d{1,6})?$/;
const canonicalAmount = value => value.replace(/^0+(?=\d)/, '').replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export function isRankSalaryCommand(path, method) {
  return method === 'POST' && path === claimPath || method === 'GET' && path.startsWith(receiptsPath);
}

const respond = (status, message, data = null) => ({status, body:{code:status === 200 ? 0 : status,message,data}});
const ok = data => respond(200, 'success', data);
const unsettled = status => ({status, month:null, rankCode:null, amountUsdt:null, claimNo:null, rejectionCode:null, httpStatus:0});
const rejected = (month, httpStatus, rejectionCode, amountUsdt = null) =>
  ({status:'REJECTED', month, rankCode:null, amountUsdt, claimNo:null, rejectionCode, httpStatus});
const commandResult = receipt => receipt.status === 'REJECTED'
  ? respond(receipt.httpStatus, receipt.rejectionCode, receipt) : ok(receipt);
const unknownResult = () => respond(504, 'PREVIEW_SALARY_RESPONSE_LOST');

function complete(state, accountId, item, businessDate, now) {
  if (rankSalaryPaidFacts(state, now).some(fact => fact.month === item.month)) {
    return rejected(item.month, 409, 'SALARY_ALREADY_CLAIMED');
  }
  const followingMonth = new Date(Date.UTC(Number(item.month.slice(0,4)), Number(item.month.slice(5)), 1)).toISOString().slice(0,10);
  const standardEnd = new Date(Date.parse(followingMonth + 'T00:00:00+07:00')).toISOString();
  const at = Math.min(now, Date.parse(businessDate + 'T23:59:59.999+07:00'));
  const claimNo = 'SAL-' + randomUUID();
  const paid = {...item, status:'CLAIMED', claimNo, claimedAt:new Date(at).toISOString(),
    expiresAt:at < Date.parse(standardEnd) ? standardEnd : item.expiresAt};
  postDemoWalletEntries(state, {
    bizType:'TEAM_COMMISSION', bizNo:claimNo + '-RELEASE', asset:'USDT', direction:'IN',
    amount:Number(item.amountUsdt), amountExact:item.amountUsdt, at, category:'refer',
  });
  (state.rankSalaryClaims ??= []).push({accountId, item:paid});
  return {status:'SUCCEEDED', month:item.month, rankCode:item.rankCode, amountUsdt:item.amountUsdt, claimNo, rejectionCode:null, httpStatus:0};
}

export function demoRankSalaryCommand(state, path, method, accountId, key, request, now = Date.now()) {
  if (!accountId) return respond(403, 'USER_SUBJECT_REQUIRED');
  if (method === 'GET') key = decodeURIComponent(path.slice(receiptsPath.length));
  if (typeof key !== 'string' || !validKey.test(key)) return respond(422, 'SALARY_IDEMPOTENCY_KEY_INVALID');

  const commands = state.rankSalaryCommands ??= [];
  let command = commands.find(row => row.accountId === accountId && row.key === key);
  if (method === 'GET') {
    if (!command || (command.mode === 'not-found' && !command.receipt)) return ok(unsettled('NOT_FOUND'));
    if (command.failReceipt) {
      command.failReceipt = false;
      return respond(503, 'SALARY_RECEIPT_UNAVAILABLE');
    }
    return ok(command.receipt ?? unsettled('PROCESSING'));
  }

  if (!request) return respond(422, 'VRANK_SALARY_REQUEST_REQUIRED');
  const {month, amountUsdt} = request;
  if (typeof month !== 'string' || !validMonth.test(month)) return respond(422, 'VRANK_SALARY_MONTH_INVALID');
  if (typeof amountUsdt !== 'string' || !validAmount.test(amountUsdt)) return respond(422, 'VRANK_SALARY_AMOUNT_INVALID');
  if (command?.month !== undefined && command.month !== month) return respond(409, 'IDEMPOTENCY_KEY_CONFLICT');
  if (command?.receipt) return commandResult(command.receipt);
  if (command?.mode === 'processing') return respond(409, 'IDEMPOTENCY_REQUEST_IN_PROGRESS');

  const salary = rankSalaryReadback(state, now);
  const item = salary?.months.find(row => row.month === month);
  const finish = receipt => {
    if (!command) {
      command = {accountId, key, month, mode};
      commands.push(command);
    }
    command.month = month;
    command.receipt = receipt;
    return commandResult(receipt);
  };
  const mode = command ? 'success' : state.rankSalaryClaimState;
  if (item?.status === 'CLAIMED') return finish(rejected(month, 409, 'SALARY_ALREADY_CLAIMED'));
  if (item?.status !== 'CLAIMABLE' || state.dataState === 'empty') return finish(rejected(month, 409, 'SALARY_NOT_CLAIMABLE'));

  const next = salary.upcoming;
  if (mode === 'amount-changed' && next?.month === month && Number(next.amountUsdt) > 0
      && demoTeamBusinessDate(Date.parse(next.claimableFrom)).slice(0,7) === month) {
    (state.rankSalaryTransitions ??= []).push({accountId, month});
    return finish(rejected(month, 409, 'SALARY_AMOUNT_CHANGED', next.amountUsdt));
  }
  if (canonicalAmount(amountUsdt) !== canonicalAmount(item.amountUsdt)) return finish(rejected(month, 409, 'SALARY_AMOUNT_CHANGED', item.amountUsdt));
  if (mode === 'not-claimable') {
    (state.rankSalaryExpirations ??= []).push({accountId, month});
    return finish(rejected(month, 409, 'SALARY_NOT_CLAIMABLE'));
  }
  if (mode === 'coverage-low') return finish(rejected(month, 422, 'COVERAGE_BELOW_REDLINE'));
  if (mode === 'coverage-unavailable') return finish(rejected(month, 503, 'COVERAGE_UNAVAILABLE'));
  if (mode === 'credit-unavailable') return finish(rejected(month, 503, 'SALARY_CREDIT_UNAVAILABLE'));
  if (mode === 'already-claimed') {
    complete(state, accountId, item, salary.businessDate, now);
    return finish(rejected(month, 409, 'SALARY_ALREADY_CLAIMED'));
  }

  if (mode === 'not-found') {
    commands.push({accountId, key, mode});
    return unknownResult();
  }
  if (mode === 'processing') {
    const pending = {accountId, key, month, mode};
    commands.push(pending);
    setTimeout(() => {
      if (state.rankSalaryCommands === commands) pending.receipt = complete(state, accountId, item, salary.businessDate, Date.now());
    }, 2_000).unref();
    return unknownResult();
  }
  const result = finish(complete(state, accountId, item, salary.businessDate, now));
  if (mode === 'receipt-unavailable') {
    command.failReceipt = true;
    return unknownResult();
  }
  return result;
}
