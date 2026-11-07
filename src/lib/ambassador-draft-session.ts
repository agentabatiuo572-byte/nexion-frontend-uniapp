import { effectScope, reactive, watch } from 'vue';
import type { AmbassadorApplicationInput, AmbassadorMaterialAttachment, AmbassadorMaterialsInput } from '@/api/ambassador-application-api';

interface Scope { accountKey: string; accountEpoch: number }
export interface AmbassadorDraftForm {
  date: string; city: string; budgetText: string;
  bucketId: AmbassadorApplicationInput['bucket'] | ''; bucketTitle: string;
}
const emptyForm = (): AmbassadorDraftForm => ({ date: '', city: '', budgetText: '3000', bucketId: '', bucketTitle: '' });
export interface AmbassadorDraftSession extends Scope {
  form: AmbassadorDraftForm;
  touched: boolean;
  pending: symbol | null;
}
export function clearAmbassadorDraft(session: AmbassadorDraftSession, defaultBudget = '3000') {
  Object.assign(session.form, emptyForm(), { budgetText: defaultBudget });
  session.touched = false;
}
export function createAmbassadorDraftCache() {
  let active: AmbassadorDraftSession | undefined;
  return {
    forAccount(scope: Scope): AmbassadorDraftSession {
      if (!active || active.accountKey !== scope.accountKey || active.accountEpoch !== scope.accountEpoch) {
        if (active) { clearAmbassadorDraft(active); active.pending = null; }
        active = reactive({ ...scope, form: emptyForm(), touched: false, pending: null });
      }
      return active;
    },
  };
}
// One live account slot, never a per-account archive or persisted personal data.
export const ambassadorDraftCache = createAmbassadorDraftCache();
export function beginAmbassadorDraftSubmit(session: AmbassadorDraftSession): symbol | null {
  if (session.pending) return null;
  return session.pending = Symbol('ambassador-submit');
}
export function endAmbassadorDraftSubmit(session: AmbassadorDraftSession, token: symbol, succeeded = false) {
  if (session.pending !== token) return;
  if (succeeded) clearAmbassadorDraft(session);
  session.pending = null;
}

export interface AmbassadorMaterialDraft {
  materialRevision: number;
  attachments: AmbassadorMaterialAttachment[];
  statement: string;
  budget: string;
  bucket: AmbassadorApplicationInput['bucket'] | undefined;
  editRequested: boolean;
  submitError: string;
  pendingSubmission: { account: string; identity: string; input: AmbassadorMaterialsInput } | null;
}
interface MaterialScope extends Scope { authenticated: boolean; environment: string; baseUrl: string }
let materialScope: MaterialScope | undefined;
let materialScopeObserved = false;
const materialDrafts = new Map<number, AmbassadorMaterialDraft>();
// One live binding, memory only. A rebind also invalidates drafts when the account key stays the same.
export const ambassadorMaterialDraftCache = {
  observeScope(account: { accountKey: string; accountBindingEpoch: number }, auth: { isAuthenticated: boolean }, runtime: { environment: string; baseUrl: string }) {
    if (materialScopeObserved) return;
    materialScopeObserved = true;
    // The cache outlives detail pages, so its account observer must too. It retains only app stores.
    effectScope(true).run(() => watch(() => ({ accountKey: account.accountKey, accountEpoch: account.accountBindingEpoch,
      authenticated: auth.isAuthenticated, environment: runtime.environment, baseUrl: runtime.baseUrl }),
    scope => { ambassadorMaterialDraftCache.forScope(scope); }, { immediate: true, flush: 'sync' }));
  },
  forScope(scope: MaterialScope): Map<number, AmbassadorMaterialDraft> {
    if (!materialScope || scope.accountKey !== materialScope.accountKey || scope.accountEpoch !== materialScope.accountEpoch
      || scope.authenticated !== materialScope.authenticated || scope.environment !== materialScope.environment || scope.baseUrl !== materialScope.baseUrl) {
      materialDrafts.clear();
      materialScope = { ...scope };
    }
    return materialDrafts;
  },
};
