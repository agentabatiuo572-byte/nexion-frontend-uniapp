import { previewAccountId } from './prototype-demo-identity.mjs';

export const trialReceiptOptions = [
  ['normal', '正常响应'],
  ['succeeded', '响应丢失 · 已成功'],
  ['rejected', '响应丢失 · 已被拒'],
  ['not-seen', '未受理'],
  ['processing', '处理中'],
  ['indeterminate', '无法确认'],
  ['unsupported', '旧后端无回执接口'],
];

const setting = { start: 'trialStartReceiptState', cancel: 'trialCancelReceiptState' };
const response = (status, message, data = null) => ({
  status,
  body: { code: status === 200 ? 0 : status, message, data },
});
const success = data => response(200, 'success', data);
const unavailable = () => response(503, 'TRIAL_COMMAND_RESPONSE_UNAVAILABLE');
const validKey = raw => typeof raw === 'string' && raw.trim() && raw.trim().length <= 128;

export function createTrialLifecyclePreview(state, execute) {
  const commands = new Map();
  const scope = (account, kind, key) => JSON.stringify([account, kind, key]);

  function finish(command) {
    const { kind, mode, run } = command;
    let result;
    if (mode === 'rejected') {
      // Both errors are retained by the production lifecycle idempotency scope.
      result = response(409, kind === 'start' ? 'TRIAL_KILL_SWITCH_DISABLED' : 'TRIAL_CANCEL_CONFLICT');
    } else {
      try { result = success(run()); }
      catch (error) {
        if (!Number.isInteger(error.status)) throw error;
        result = response(error.status, error.message, error.data ?? null);
      }
    }
    command.result = result;
    delete command.run;
    const { status, body } = result;
    command.receipt = status === 200 && body.data?.claimNo ? { status: 'SUCCEEDED', claimNo: body.data.claimNo }
      : status >= 400 && status < 500 ? { status: 'REJECTED', code: body.code, message: body.message }
      : { status: 'INDETERMINATE' };
    return result;
  }

  return {
    reset: () => commands.clear(),
    release(kind) {
      for (const command of commands.values())
        if (command.kind === kind && command.receipt.status === 'PROCESSING') finish(command);
    },
    read(url, kind, headers) {
      const account = previewAccountId(state, headers);
      if (!account) return response(403, 'AUTH_REQUIRED');
      if (!Object.hasOwn(setting, kind)) return response(422, 'TRIAL_COMMAND_KIND_INVALID');
      if (state[setting[kind]] === 'unsupported') return response(404, 'RESOURCE_NOT_FOUND');
      const rawKey = url.searchParams.get('commandKey');
      if (!validKey(rawKey)) return response(422, rawKey?.trim() ? 'IDEMPOTENCY_KEY_INVALID' : 'IDEMPOTENCY_KEY_REQUIRED');
      const commandKey = rawKey.trim();
      const command = commands.get(scope(account, kind, commandKey));
      return success({ kind, commandKey, ...(command?.receipt ?? { status: 'NOT_SEEN' }) });
    },
    submit(url, kind, headers, body) {
      const account = previewAccountId(state, headers);
      if (!account) return response(403, 'AUTH_REQUIRED');
      const rawKey = headers['idempotency-key'];
      if (!validKey(rawKey)) return response(422, rawKey?.trim() ? 'IDEMPOTENCY_KEY_INVALID' : 'IDEMPOTENCY_KEY_REQUIRED');
      const key = rawKey.trim();
      const identity = JSON.stringify(kind === 'start'
        ? [body.paymentMethodId ?? null, body.deviceName ?? null] : String(body.reason ?? '').trim().toLowerCase());
      const scopedKey = scope(account, kind, key);
      const previous = commands.get(scopedKey);
      if (previous) {
        if (identity !== previous.identity) return response(409, 'IDEMPOTENCY_KEY_CONFLICT');
        return previous.result ?? response(409, 'IDEMPOTENCY_REQUEST_IN_PROGRESS');
      }
      const mode = state[setting[kind]] ?? 'normal';
      if (mode === 'not-seen') {
        state[setting[kind]] = 'normal';
        return unavailable();
      }
      const command = {
        kind, mode, identity,
        receipt: { status: mode === 'indeterminate' ? 'INDETERMINATE' : 'PROCESSING' },
        run: () => execute(url, { method: () => 'POST', headers: () => headers, postDataJSON: () => body }),
      };
      commands.set(scopedKey, command);
      if (mode === 'indeterminate') {
        command.result = unavailable();
        delete command.run;
        return command.result;
      }
      if (mode === 'processing') return unavailable();
      const result = finish(command);
      return mode === 'normal' ? result : unavailable();
    },
  };
}
