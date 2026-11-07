<template>
  <view class="amb-materials">
    <button class="amb-materials__toggle" :aria-expanded="opened" @click="toggle">
      <text>{{ opened ? copy.hide : copy.title }}<text v-if="!opened && application.materialState"> · {{ copy.states[application.materialState] }}</text></text><text aria-hidden="true">{{ opened ? '−' : '+' }}</text>
    </button>
    <view v-if="opened" class="amb-materials__body">
      <text v-if="loading" role="status">{{ copy.loading }}</text>
      <view v-else-if="loadError" class="amb-materials__stack" role="alert">
        <text>{{ copy.loadError }}</text><button class="amb-materials__action" @click="load">{{ copy.retry }}</button>
      </view>
      <template v-else-if="pack">
        <view class="amb-materials__heading">
          <text>{{ fmt(copy.revision, { n: pack.materialRevision }) }} · {{ copy.states[pack.materialState] }}</text>
          <button class="amb-materials__action" :disabled="busy" @click="refresh">{{ copy.refresh }}</button>
        </view>
        <text v-if="pack.legacyApproved || pending" class="amb-materials__hint">{{ pack.legacyApproved ? copy.legacy : copy.flowHint }}</text>
        <template v-if="!pack.legacyApproved">
          <view v-for="stage in reviews" :key="stage.label" class="amb-materials__review">
            <view class="amb-materials__heading"><text>{{ stage.label }}</text><text :class="{ 'amb-materials__warning': stage.review.status === 'NEEDS_MORE' }">{{ copy.states[stage.review.status] }}</text></view>
            <text v-if="stage.review.reviewerLabel || stage.review.reviewedAt" class="amb-materials__hint">{{ stage.review.reviewerLabel }} · {{ reviewTime(stage.review.reviewedAt) }}</text>
            <text v-if="stage.review.reason">{{ stage.review.reason }}</text>
            <text v-if="stage.review.verifiedAttendees != null">{{ copy.attendees }} · {{ visibility.mask(stage.review.verifiedAttendees) }}</text>
            <text v-if="stage.review.recognizedBudgetUsdt != null">{{ copy.recognized }} · {{ visibility.mask(String(stage.review.recognizedBudgetUsdt)) }} USDT</text>
          </view>
          <template v-if="pending">
            <view v-if="missingKinds.length" class="amb-materials__warning" role="status">{{ copy.missing }} · {{ missingKinds.map(kindLabel).join(' / ') }}</view>
            <text v-else-if="requirements.length && (pack.businessReview.status !== 'PASSED' || pack.financeReview.status !== 'PASSED')" class="amb-materials__hint">{{ copy.complete }}</text>
            <text v-for="blocker in blockerLabels" :key="blocker" class="amb-materials__hint">{{ blocker }}</text>
          </template>
        </template>

        <view v-if="editable && !pack.bucket" class="amb-materials__stack">
          <text>{{ copy.chooseBucket }}</text>
          <picker :range="bucketLabels" :value="bucketIndex" :disabled="busy || !!attachments.length || !!upload" @change="chooseBucket">
            <view class="amb-materials__field">{{ bucket ? t.agent.buckets[bucket].title : copy.chooseBucket }} ▾</view>
          </picker>
        </view>
        <view v-for="requirement in requirements" :key="requirement.kind" class="amb-materials__requirement">
          <view class="amb-materials__heading">
            <text>{{ kindLabel(requirement.kind) }}<text v-if="requirement.required" class="amb-materials__hint"> · {{ copy.required }}</text></text>
            <button v-if="editable" class="amb-materials__action" :disabled="busy || attachments.length >= 12" @click="chooseFile(requirement.kind)">{{ copy.add }}</button>
          </view>
          <view v-for="file in attachments.filter(item => item.kind === requirement.kind)" :key="file.fileId" class="amb-materials__file">
            <text class="amb-materials__filename">{{ file.name }} · {{ fileSize(file.sizeBytes) }}</text>
            <view class="amb-materials__buttons">
              <button class="amb-materials__action" :disabled="previewBusy" @click="viewFile(file)">{{ copy.view }}</button>
              <button v-if="editable" class="amb-materials__action" :disabled="busy" @click="removeFile(file.fileId)">{{ copy.remove }}</button>
            </view>
          </view>
        </view>
        <view v-if="upload" class="amb-materials__review" role="status">
          <text>{{ kindLabel(upload.kind) }} · {{ upload.name }}</text>
          <text>{{ upload.state === 'uploading' ? copy.uploading : copy.uploadFailed }}</text>
          <view class="amb-materials__buttons">
            <button v-if="upload.state === 'failed'" class="amb-materials__action" @click="retryUpload">{{ copy.retry }}</button>
            <button class="amb-materials__action" @click="cancelUpload">{{ copy.cancel }}</button>
          </view>
        </view>
        <view class="amb-materials__stack">
          <text>{{ copy.statement }}<text v-if="editable" class="amb-materials__hint"> · {{ copy.required }}</text></text>
          <textarea v-if="editable" v-model="statement" class="amb-materials__field amb-materials__statement" :aria-label="copy.statement" :disabled="busy" :maxlength="4000" auto-height />
          <text v-else class="amb-materials__hint">{{ pack.statement || '—' }}</text>
        </view>
        <template v-if="editable">
          <text class="amb-materials__hint">{{ fileHint }}</text>
          <text class="amb-materials__hint">{{ copy.resubmitHint }}</text>
          <view v-if="pack.materialState === 'NEEDS_MORE'" class="amb-materials__stack">
            <text>{{ copy.lowerBudget }}</text>
            <text v-if="visibility.hidden" class="amb-materials__field">{{ visibility.mask(budget) }}</text>
            <input v-else v-model="budget" class="amb-materials__field" type="text" inputmode="decimal" :aria-label="copy.lowerBudget" :disabled="busy" />
          </view>
          <text v-if="submitError" class="amb-materials__warning" role="alert">{{ submitError }}</text>
          <view class="amb-materials__buttons">
            <button class="amb-materials__submit" :disabled="busy || !!upload || !dirty || !bucket || !attachments.length || !statement.trim()" @click="save">{{ saving ? copy.saving : copy.submit }}</button>
            <button v-if="dirty" class="amb-materials__action" :disabled="busy" @click="discard">{{ copy.cancel }}</button>
          </view>
        </template>
      </template>
    </view>
    <view v-if="previewSrc" class="amb-materials__preview" role="dialog" aria-modal="true" :aria-label="copy.preview">
      <button class="amb-materials__action" tabindex="0" @click="closePreview">{{ copy.cancel }}</button>
      <image :src="previewSrc" mode="aspectFit" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import { ambassadorApplicationApi, apiRuntimeConfig } from "@/api/runtime";
import type { AmbassadorApplication, AmbassadorMaterialAttachment, AmbassadorMaterials, AmbassadorMaterialsInput } from "@/api/ambassador-application-api";
import { asApiError, isSettledRejection } from "@/api/errors";
import { acquireAmbassadorCommandKey, finishAmbassadorCommand } from "@/lib/ambassador-command-key";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { createAbortController } from "@/lib/abort-controller-compat";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useDataVisibility } from "@/store/data-visibility";
import { useLocaleStore } from "@/store/locale";
import { useT } from "@/i18n/use-t";
import { ambassadorMaterialsCopy } from "@/i18n/ambassador-materials";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";

const props = defineProps<{ application: AmbassadorApplication }>();
const emit = defineEmits<{ (event: "updated", materials: AmbassadorMaterials): void }>();
const app = useApp(), auth = useAuth(), locale = useLocaleStore(), visibility = useDataVisibility(), t = useT();
const pageOwner = getCurrentInstance()?.root;
const copy = computed(() => ambassadorMaterialsCopy(locale.code));
const opened = ref(false), loading = ref(false), loadError = ref(false), saving = ref(false), picking = ref(false);
const pack = ref<AmbassadorMaterials | null>(null), attachments = ref<AmbassadorMaterialAttachment[]>([]);
const statement = ref(""), budget = ref(""), bucket = ref<AmbassadorMaterialsInput["bucket"]>();
const submitError = ref(""), previewSrc = ref(""), previewBusy = ref(false);
const bucketIds = ["venue", "kol", "print", "dev"] as const;
const bucketLabels = computed(() => bucketIds.map(id => t.value.agent.buckets[id].title));
const bucketIndex = computed(() => Math.max(0, bucketIds.findIndex(id => id === bucket.value)));
const requirements = computed(() => pack.value?.bucket ? pack.value.requirements : bucket.value ? pack.value?.requirementsByBucket?.[bucket.value] ?? [] : []);
const missingKinds = computed(() => pack.value?.bucket ? pack.value.missingKinds : requirements.value.filter(item => item.required).map(item => item.kind));
const fileHint = computed(() => {
  let hint = copy.value.fileHint;
// #ifdef APP-PLUS
  hint = copy.value.nativeFileHint;
// #endif
  return hint;
});
const reviews = computed(() => pack.value ? [
  { label: copy.value.business, review: pack.value.businessReview },
  { label: copy.value.finance, review: pack.value.financeReview },
] : []);
function blockerLabel(code: string): string {
  if (code === "AMBASSADOR_REQUIRED_MATERIAL_MISSING") return copy.value.missing;
  if (code === "AMBASSADOR_VERIFIED_ATTENDEES_INVALID") return `${copy.value.attendees} ≥ 100`;
  return copy.value.blockers[code] ?? copy.value.blocked;
}
const blockerLabels = computed(() => [...new Set((pack.value?.approvalBlockers ?? []).map(blockerLabel))]);
const pending = computed(() => props.application.status === "PENDING"
  && !pack.value?.approvalBlockers.includes("APPLICATION_NOT_PENDING"));
const editable = computed(() => auth.isAuthenticated && pending.value && pack.value?.canSubmit === true && !pack.value.legacyApproved);
const dirty = computed(() => !!pack.value && (statement.value !== pack.value.statement || budget.value !== String(pack.value.budgetUsdt)
  || (bucket.value ?? null) !== pack.value.bucket || JSON.stringify(attachments.value.map(file => [file.fileId, file.kind])) !== JSON.stringify(pack.value.attachments.map(file => [file.fileId, file.kind]))));
interface UploadDraft { kind: string; path: string; name: string; key: string; state: "uploading" | "failed" }
const upload = ref<UploadDraft | null>(null);
const busy = computed(() => saving.value || picking.value || upload.value?.state === "uploading");
let uploadController: AbortController | null = null, previewController: AbortController | null = null;
let disposed = false, generation = 0;
function scope() {
  const account = app.accountKey, binding = app.accountBindingEpoch, id = props.application.applicationId;
  const environment = apiRuntimeConfig.environment, baseUrl = apiRuntimeConfig.baseUrl, currentGeneration = generation;
  return () => !disposed && auth.isAuthenticated && account === app.accountKey && binding === app.accountBindingEpoch
    && id === props.application.applicationId && environment === apiRuntimeConfig.environment && baseUrl === apiRuntimeConfig.baseUrl && currentGeneration === generation;
}
function kindLabel(kind: string): string {
  return copy.value.kinds[kind] ?? requirements.value.find(item => item.kind === kind)?.label ?? copy.value.missing;
}
function fileSize(size: number): string { return `${(size / 1024 / 1024).toFixed(2)} MiB`; }
function reviewTime(value: string | null): string { return value ? new Date(value).toLocaleString() : ""; }
function chooseBucket(event: { detail: { value: string | number } }) {
  if (!busy.value && !attachments.value.length && !upload.value) bucket.value = bucketIds[Number(event.detail.value)];
}
function toggle() { opened.value = !opened.value; if (opened.value && !pack.value && !loading.value) void load(); }
function discard() {
  if (!pack.value || busy.value) return;
  cancelUpload(); attachments.value = [...pack.value.attachments]; statement.value = pack.value.statement;
  budget.value = String(pack.value.budgetUsdt); bucket.value = pack.value.bucket ?? undefined; submitError.value = "";
}
async function load() {
  if (!auth.isAuthenticated || !props.application.applicationId || busy.value || dirty.value) return;
  const current = scope(), id = props.application.applicationId;
  loading.value = true; loadError.value = false;
  try {
    const value = await ambassadorApplicationApi.materials(id);
    if (!current()) return;
    pack.value = value; discard(); emit("updated", value);
  } catch { if (current()) loadError.value = true; }
  finally { if (current()) loading.value = false; }
}
function refresh() {
  if (!dirty.value) { void load(); return; }
  uni.showModal({ title: copy.value.refresh, content: copy.value.discardPrompt, confirmText: copy.value.refresh, cancelText: copy.value.cancel,
    success(result) { if (result.confirm) { discard(); void load(); } } });
}
function releasePath(path: string) {
  // #ifdef H5
  if (path.startsWith("blob:")) URL.revokeObjectURL(path);
  // #endif
}
function closePreview() { if (previewSrc.value) releasePath(previewSrc.value); previewSrc.value = ""; }
useDialogA11y(computed(() => !!previewSrc.value), ".amb-materials__preview", closePreview, true);
function cancelUpload() {
  uploadController?.abort(); uploadController = null;
  if (upload.value) releasePath(upload.value.path);
  upload.value = null;
}
function removeFile(id: string) { if (editable.value && !busy.value) attachments.value = attachments.value.filter(file => file.fileId !== id); }

async function chooseFile(kind: string) {
  if (!editable.value || busy.value || upload.value) return;
  if (attachments.value.length >= 12) { toast.info(copy.value.limit, ""); return; }
  const current = scope(); picking.value = true;
  try {
    const selected = await new Promise<{ path: string; name: string; size: number; type?: string } | null>((resolve, reject) => {
      const fail = (cause: { errMsg?: string; code?: number }) => {
        let cancelled = /cancel(?:led|ed)?/i.test(cause.errMsg ?? "");
        // #ifdef APP-PLUS
        cancelled = cancelled || cause.errMsg === "chooseImage:fail" && cause.code === 0;
        // #endif
        if (cancelled) resolve(null); else reject(cause);
      };
      // #ifdef H5
      uni.chooseFile({ count: 1, type: "all", extension: [".png", ".jpg", ".jpeg", ".pdf"], success(result) {
        const file = (Array.isArray(result.tempFiles) ? result.tempFiles[0] : result.tempFiles) as { path: string; name?: string; size: number; type?: string };
        if (!file) return resolve(null);
        resolve({ path: file.path, name: file.name ?? file.path.split("/").pop() ?? "", size: file.size, type: file.type });
      }, fail });
      // #endif
      // #ifndef H5
      uni.chooseImage({ count: 1, sizeType: ["original"], sourceType: ["album", "camera"], success(result) {
        const file = Array.isArray(result.tempFiles) ? result.tempFiles[0] : result.tempFiles;
        const path = result.tempFilePaths[0];
        if (!path) return resolve(null);
        resolve({ path, name: path.split("/").pop() ?? "", size: file.size });
      }, fail });
      // #endif
    });
    if (!selected) return;
    if (!current()) { releasePath(selected.path); return; }
    if (selected.size <= 0 || selected.size > 10 * 1024 * 1024 || !/\.(?:png|jpe?g|pdf)$/i.test(selected.name)
      || selected.type && !["image/png", "image/jpeg", "application/pdf"].includes(selected.type)) {
      releasePath(selected.path); toast.error(copy.value.invalidFile, ""); return;
    }
    const key = `app-ambassador-file:${requireCryptoUuid()}`;
    upload.value = { kind, path: selected.path, name: selected.name, key, state: "failed" };
  } catch { if (current()) toast.error(copy.value.uploadFailed, ""); }
  finally { if (current()) picking.value = false; }
  if (current() && upload.value) await retryUpload();
}
async function retryUpload() {
  const draft = upload.value;
  if (!editable.value || !draft || draft.state === "uploading" || !props.application.applicationId) return;
  const current = scope(), id = props.application.applicationId;
  const controller = createAbortController(); uploadController = controller; draft.state = "uploading";
  try {
    const file = await ambassadorApplicationApi.uploadMaterialFile(id, draft.path, draft.kind, draft.key, controller.signal);
    if (!current() || upload.value !== draft) return;
    attachments.value = [...attachments.value, file];
    releasePath(draft.path); upload.value = null;
  } catch (cause) {
    if (!current() || upload.value !== draft) return;
    draft.state = "failed";
    if ([413, 415].includes(asApiError(cause).status ?? 0)) toast.error(copy.value.invalidFile, "");
  } finally { if (uploadController === controller) uploadController = null; }
}
async function save() {
  if (!editable.value || busy.value || upload.value || !dirty.value || !pack.value || !bucket.value || !attachments.value.length || !statement.value.trim()) return;
  const amount = Number(budget.value);
  if (!/^\d+(?:\.\d+)?$/.test(budget.value) || !Number.isFinite(amount) || amount <= 0 || amount > pack.value.budgetUsdt) {
    submitError.value = copy.value.invalidBudget; return;
  }
  const id = pack.value.applicationId, current = scope(), account = app.accountKey;
  const input: AmbassadorMaterialsInput = { expectedMaterialRevision: pack.value.materialRevision,
    attachments: attachments.value.map(({ fileId, kind }) => ({ fileId, kind })), statement: statement.value.trim(),
    ...(amount !== pack.value.budgetUsdt ? { budgetUsdt: amount } : {}), ...(!pack.value.bucket ? { bucket: bucket.value } : {}) };
  const identity = JSON.stringify(["materials", id, input]);
  saving.value = true; submitError.value = "";
  try {
    const key = acquireAmbassadorCommandKey(account, identity);
    const value = await ambassadorApplicationApi.submitMaterials(id, input, key);
    if (!current()) return;
    finishAmbassadorCommand(account, identity); pack.value = value;
    attachments.value = [...value.attachments]; statement.value = value.statement; budget.value = String(value.budgetUsdt); bucket.value = value.bucket ?? undefined;
    toast.success(copy.value.saved, ""); emit("updated", value);
  } catch (cause) {
    if (!current()) return;
    if (isSettledRejection(cause)) finishAmbassadorCommand(account, identity);
    const error = asApiError(cause);
    submitError.value = copy.value.blockers[error.message] ?? copy.value.saveFailed;
  } finally { if (current()) saving.value = false; }
}
async function viewFile(file: AmbassadorMaterialAttachment) {
  if (previewBusy.value || !props.application.applicationId) return;
  const current = scope(), controller = createAbortController(); previewController = controller; previewBusy.value = true;
  try {
    const path = await ambassadorApplicationApi.materialFile(props.application.applicationId, file.fileId, controller.signal);
    if (!current()) { releasePath(path); return; }
    if (file.contentType !== "application/pdf") { closePreview(); previewSrc.value = path; return; }
    // #ifdef H5
    const link = document.createElement("a"); link.href = path; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => releasePath(path), 60_000);
    // #endif
    // #ifndef H5
    await new Promise<void>((resolve, reject) => uni.openDocument({ filePath: path, fileType: "pdf", success: () => resolve(), fail: reject }));
    // #endif
  } catch { if (current()) toast.error(copy.value.loadError, ""); }
  finally { if (previewController === controller) { previewController = null; previewBusy.value = false; } }
}
function reset() {
  generation++; cancelUpload(); previewController?.abort(); previewController = null; previewBusy.value = false; closePreview();
  pack.value = null; attachments.value = []; statement.value = ""; budget.value = ""; bucket.value = undefined;
  loading.value = false; saving.value = false; picking.value = false; submitError.value = ""; loadError.value = false;
}
// A history reread can replace the application object without changing its owner or id.
watch([() => app.accountKey, () => app.accountBindingEpoch, () => auth.isAuthenticated,
  () => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl, () => props.application.applicationId], () => { reset(); opened.value = false; });
onShow(() => { if (opened.value && !busy.value && !dirty.value) void load(); }, pageOwner);
onHide(() => { closePreview(); previewController?.abort(); }, pageOwner);
onBeforeUnmount(() => { disposed = true; reset(); });
</script>

<style scoped>
.amb-materials { margin-top: var(--v5-space-3); font: 400 12px/1.6 var(--font-v5); color: var(--v5-ink); }
.amb-materials button { margin: 0; padding: 0; border: 0; border-radius: 0; background: none; font: inherit; line-height: 1.6; text-align: start; }
.amb-materials button::after { border: 0; }
.amb-materials button[disabled] { opacity: .45; }
.amb-materials__toggle, .amb-materials__heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--v5-space-2); }
.amb-materials__toggle { width: 100%; min-height: 44px; color: var(--v5-brand); }
.amb-materials__body, .amb-materials__stack, .amb-materials__review { display: flex; flex-direction: column; gap: var(--v5-space-2); }
.amb-materials__body { padding: var(--v5-space-3) 0; gap: var(--v5-space-4); }
.amb-materials__review, .amb-materials__requirement { padding: var(--v5-space-3); border: 1px solid var(--v5-border); border-radius: 12px; overflow-wrap: anywhere; }
.amb-materials__hint { color: var(--v5-ink-3); }
.amb-materials__warning { color: var(--v5-warning-ink); }
.amb-materials__buttons { display: flex; align-items: center; flex-wrap: wrap; gap: var(--v5-space-3); }
.amb-materials__action { min-height: 40px; color: var(--v5-brand); flex-shrink: 0; }
.amb-materials__file { padding-top: var(--v5-space-2); border-top: 1px solid var(--v5-border); margin-top: var(--v5-space-2); }
.amb-materials__filename { display: block; overflow-wrap: anywhere; color: var(--v5-ink-2); }
.amb-materials__field { width: 100%; box-sizing: border-box; min-height: 44px; padding: var(--v5-space-2) var(--v5-space-3); border: 1px solid var(--v5-border); border-radius: 12px; background: var(--v5-surface); color: var(--v5-ink); font: inherit; }
.amb-materials__statement { min-height: 80px; }
.amb-materials .amb-materials__submit { min-height: 44px; padding: var(--v5-space-2) var(--v5-space-3); background: var(--v5-brand); color: var(--v5-on-brand, #fff); border-radius: 12px; }
.amb-materials__preview { position: fixed; z-index: 100; inset: 0; display: flex; flex-direction: column; padding: var(--v5-space-5); background: var(--v5-surface); }
.amb-materials__preview image { width: 100%; flex: 1; min-height: 0; }
</style>
