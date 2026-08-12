export interface LearningAttemptIdentity {
  accountKey: string;
  courseId: string;
  version: string;
}

interface PendingLearningAttempt extends LearningAttemptIdentity { key: string; }
interface LearningAttemptState {
  schema: 1;
  pending: Record<string, PendingLearningAttempt>;
  generations: Record<string, number>;
}
export interface LearningAttemptStorage { read(): unknown; write(value: LearningAttemptState): void; }

const STORAGE_KEY = "nexgrid-learning-pending-attempts-v1";
const empty = (): LearningAttemptState => ({ schema: 1, pending: {}, generations: {} });

function normalize(value: LearningAttemptIdentity): LearningAttemptIdentity {
  const accountKey = value.accountKey.trim().toLowerCase();
  const courseId = value.courseId.trim();
  const version = value.version.trim();
  if (!accountKey || !courseId || !version) throw new Error("LEARNING_ATTEMPT_IDENTITY_INVALID");
  return { accountKey, courseId, version };
}
function scopeOf(value: LearningAttemptIdentity): string { const item = normalize(value); return JSON.stringify([item.accountKey, item.courseId, item.version]); }
function hash53(value: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed; let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < value.length; index += 1) { const code = value.charCodeAt(index); h1 = Math.imul(h1 ^ code, 2654435761); h2 = Math.imul(h2 ^ code, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function key(scope: string, generation: number): string { return `learning-quiz-${hash53(`${scope}\u0000${generation}`, 0)}${hash53(`${scope}\u0000${generation}`, 0x9e3779b9)}`; }
function state(value: unknown): LearningAttemptState {
  const candidate = value && typeof value === "object" ? value as Partial<LearningAttemptState> : null;
  if (!candidate || candidate.schema !== 1 || !candidate.pending || !candidate.generations || typeof candidate.pending !== "object" || typeof candidate.generations !== "object") return empty();
  const pending: Record<string, PendingLearningAttempt> = {};
  for (const [scope, item] of Object.entries(candidate.pending)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PendingLearningAttempt>;
    if (typeof row.key !== "string" || typeof row.accountKey !== "string" || typeof row.courseId !== "string" || typeof row.version !== "string") continue;
    pending[scope] = { key: row.key, accountKey: row.accountKey, courseId: row.courseId, version: row.version };
  }
  const generations: Record<string, number> = {};
  for (const [scope, generation] of Object.entries(candidate.generations)) if (Number.isSafeInteger(generation) && Number(generation) >= 0) generations[scope] = Number(generation);
  return { schema: 1, pending, generations };
}

export class LearningAttemptKeyRegistry {
  constructor(private readonly storage: LearningAttemptStorage) {}
  getOrCreate(identity: LearningAttemptIdentity): string {
    const item = normalize(identity); const scope = scopeOf(item); const current = state(this.storage.read());
    if (current.pending[scope]) return current.pending[scope].key;
    const value = key(scope, current.generations[scope] ?? 0);
    current.pending[scope] = { ...item, key: value }; this.storage.write(current);
    return state(this.storage.read()).pending[scope]?.key ?? value;
  }
  finish(identity: LearningAttemptIdentity, attemptKey: string): boolean {
    const scope = scopeOf(identity); const current = state(this.storage.read());
    if (!current.pending[scope] || current.pending[scope].key !== attemptKey) return false;
    delete current.pending[scope]; current.generations[scope] = (current.generations[scope] ?? 0) + 1; this.storage.write(current); return true;
  }
}

const storage: LearningAttemptStorage = { read: () => uni.getStorageSync(STORAGE_KEY), write: (value) => uni.setStorageSync(STORAGE_KEY, value) };
const registry = new LearningAttemptKeyRegistry(storage);
export function pendingLearningAttemptKey(identity: LearningAttemptIdentity): string { return registry.getOrCreate(identity); }
export function finishPendingLearningAttempt(identity: LearningAttemptIdentity, key: string): boolean { return registry.finish(identity, key); }
