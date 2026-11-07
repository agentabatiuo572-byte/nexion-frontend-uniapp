<template>
  <AppChassis active="team">
    <view class="detail-page nx-viz-motion">
      <SubPageHeader :back="AMBASSADOR_ROUTES.records" :title="t.headerTitles.teamAgentApplication" />
      <EmptyState v-if="readState === 'error' && !pack" kind="recoverable-error" :title="c.detailLoadError" :cta-label="t.agent.retry" @cta="retry" />
      <view v-else-if="!pack || !row" class="detail-loading" role="status" aria-busy="true"><text>{{ t.agent.loading }}</text></view>
      <CardStagger v-else class="detail-content">
        <!-- Page focus: soft-glass hero with the status tag, the amount and the four-node progress. -->
        <view class="detail-hero nx-soft-glass">
          <view class="detail-hero__top">
            <view class="detail-hero__category"><AmbassadorBucketIcon :bucket="pack.bucket" size="small" /><text>{{ pack.bucket ? t.agent.buckets[pack.bucket].title : c.noBucket }}</text></view>
            <NxTag v-if="statusKnown" :tone="presentation.tone" :label="c.statuses[presentation.status]" />
          </view>
          <text class="detail-hero__title">{{ row.city }}</text>
          <text class="detail-hero__date">{{ fmt(c.eventDate, { date: pack.eventDate }) }}</text>
          <view class="detail-hero__amount"><text class="detail-hero__key">{{ row.status === 'APPROVED' ? c.approvedAmount : c.amount }}</text><AmbassadorAmount :value="pack.budgetUsdt" size="hero" /></view>
          <AmbassadorTrack v-if="statusKnown && !pack.legacyApproved" size="hero" :presentation="presentation" :labels="c.steps" :label="c.progress" />
          <view class="detail-hero__meta"><text>{{ c.applicationId }}</text><text class="detail-hero__id">{{ pack.applicationId }}</text></view>
        </view>
        <view v-if="pack.legacyApproved" class="detail-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg><text>{{ c.legacy }}</text></view>
        <view v-else-if="pending && pack.bucket && pack.materialRevision === 0" class="detail-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg><text>{{ c.flowHint }}</text></view>

        <view v-if="!pack.legacyApproved && (pack.materialRevision > 0 || !pending)" class="detail-section">
          <view class="detail-section__head"><text class="detail-section__title">{{ pending ? c.reviewProgress : c.reviewResult }}</text></view>
          <view class="detail-reviews">
            <view v-for="stage in stages" :key="stage.key" class="detail-review" :class="{ 'detail-review--warn': pending && stage.review.status === 'NEEDS_MORE' }">
              <text class="detail-review__label">{{ stage.label }}</text>
              <view class="detail-review__status" :class="`detail-review__status--${stage.tone}`">
                <svg v-if="stage.review.status === 'PASSED'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></svg>
                <svg v-else-if="stage.review.status === 'NEEDS_MORE'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7v6M12 17h.01" /></svg>
                <svg v-else-if="pending" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7v5l3 2" /></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
                <text>{{ stage.status }}</text>
              </view>
              <text class="detail-review__time">{{ reviewTime(stage.review.reviewedAt) }}</text>
              <view v-if="stage.metric" class="detail-review__metric">
                <text class="detail-review__metric-key">{{ stage.metric.label }}</text>
                <view class="detail-review__metric-value" :class="{ 'detail-review__metric-value--long': stage.metric.value.length > 8 }"><text class="detail-review__metric-number">{{ stage.metric.value }}</text><text class="detail-review__metric-unit">{{ stage.metric.unit }}</text></view>
              </view>
            </view>
          </view>
          <view v-for="stage in opinions" :key="stage.key" class="detail-opinion" role="note">
            <view class="detail-opinion__head" :class="{ 'detail-opinion__head--active': pending && stage.review.status === 'NEEDS_MORE' }"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg><text>{{ c.opinion[stage.key] }}</text></view>
            <text class="detail-opinion__body">{{ stage.review.reason }}</text>
          </view>
          <view v-for="hint in approvalHints" :key="hint" class="detail-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg><text>{{ hint }}</text></view>
          <view v-if="row.status === 'REJECTED'" class="detail-hint detail-hint--support">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            <text>{{ c.rejectedHint }}</text>
            <view class="detail-link" role="link" tabindex="0" @click="contactSupport" @keydown.enter.prevent="contactSupport"><text>{{ c.contactSupport }}</text><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></view>
          </view>
        </view>

        <view v-if="editing && !pack.bucket" class="detail-section">
          <view class="detail-section__head"><text class="detail-section__title">{{ c.chooseBucket }}</text></view>
          <text class="detail-lead">{{ c.chooseBucketLead }}</text>
          <view class="detail-buckets" role="radiogroup" :aria-label="c.chooseBucket" @keydown.right.prevent="moveBucketFocus($event, 1)" @keydown.down.prevent="moveBucketFocus($event, 1)" @keydown.left.prevent="moveBucketFocus($event, -1)" @keydown.up.prevent="moveBucketFocus($event, -1)">
            <view v-for="(id, index) in AMBASSADOR_BUCKET_IDS" :key="id" class="detail-bucket" :class="{ 'detail-bucket--on': bucket === id }" role="radio"
              :tabindex="bucketTabStop(id, index) ? 0 : -1" :aria-checked="bucket === id" :aria-disabled="bucketLocked" :aria-label="t.agent.buckets[id].title"
              @click="chooseBucket(id)" @keydown.enter.prevent="chooseBucket(id)" @keydown.space.prevent="chooseBucket(id)">
              <AmbassadorBucketIcon :bucket="id" />
              <view class="detail-bucket__text"><text class="detail-bucket__title">{{ t.agent.buckets[id].title }}</text><text class="detail-bucket__rule">{{ t.agent.buckets[id].rule }}</text></view>
              <view class="detail-bucket__radio" aria-hidden="true" />
            </view>
          </view>
        </view>

        <view v-if="requirements.length && (editing || pack.materialRevision > 0)" class="detail-section">
          <view class="detail-section__head"><text class="detail-section__title">{{ c.materials }}</text><text class="detail-section__sub">{{ materialsSub }}</text></view>
          <view class="detail-card">
            <view v-for="requirement in requirements" :key="requirement.kind" class="detail-req">
              <view class="detail-req__head">
                <svg v-if="requirementState(requirement.kind) === 'flagged'" class="detail-req__icon detail-req__icon--warn" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7v6M12 17h.01" /></svg>
                <svg v-else-if="requirementState(requirement.kind) === 'done'" class="detail-req__icon detail-req__icon--ok" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="m7.5 12.2 3 3 6-6.4" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <svg v-else class="detail-req__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /></svg>
                <text class="detail-req__name">{{ kindLabel(requirement.kind) }}</text>
                <NxTag v-if="requirementState(requirement.kind) === 'flagged'" tone="warning" :label="c.needsMore" />
                <text v-else class="detail-req__count">{{ filesOf(requirement.kind).length ? ambassadorCount(c.files, filesOf(requirement.kind).length) : upload?.kind === requirement.kind ? c.uploadingShort : c.notAdded }}</text>
              </view>
              <view v-for="file in filesOf(requirement.kind)" :key="file.fileId" class="detail-file">
                <svg v-if="file.contentType === 'application/pdf'" class="detail-file__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                <svg v-else class="detail-file__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
                <view class="detail-file__text"><text class="detail-file__name">{{ file.name }}</text><text class="detail-file__size">{{ fileSize(file.sizeBytes) }}</text></view>
                <view class="detail-file__action" role="button" :tabindex="previewBusy ? -1 : 0" :aria-disabled="previewBusy" @click="viewFile(file)" @keydown.enter.prevent="viewFile(file)" @keydown.space.prevent="viewFile(file)"><text>{{ c.view }}</text></view>
                <view v-if="editing" class="detail-file__remove" role="button" :tabindex="busy ? -1 : 0" :aria-disabled="busy" :aria-label="fmt(c.remove, { name: file.name })" @click="removeFile(file.fileId)" @keydown.enter.prevent="removeFile(file.fileId)" @keydown.space.prevent="removeFile(file.fileId)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></view>
              </view>
              <view v-if="editing && upload && upload.kind === requirement.kind" class="detail-file" :class="{ 'detail-file--failed': upload.state === 'failed' }" role="status">
                <svg v-if="upload.state === 'uploading'" class="detail-file__icon detail-file__spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
                <svg v-else class="detail-file__icon detail-file__icon--warn" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7v6M12 17h.01" /></svg>
                <view class="detail-file__text"><text class="detail-file__name">{{ upload.name }}</text><text class="detail-file__size" :class="{ 'detail-file__size--warn': upload.state === 'failed' }">{{ upload.state === 'uploading' ? c.uploading : c.uploadFailed }}</text></view>
                <view v-if="upload.state === 'failed'" class="detail-file__action" role="button" tabindex="0" @click="retryUpload" @keydown.enter.prevent="retryUpload" @keydown.space.prevent="retryUpload"><text>{{ c.retryUpload }}</text></view>
                <view v-if="upload.state === 'uploading'" class="detail-file__action" role="button" tabindex="0" @click="cancelUpload" @keydown.enter.prevent="cancelUpload" @keydown.space.prevent="cancelUpload"><text>{{ c.cancel }}</text></view>
                <view v-else class="detail-file__remove" role="button" tabindex="0" :aria-label="fmt(c.remove, { name: upload.name })" @click="cancelUpload" @keydown.enter.prevent="cancelUpload" @keydown.space.prevent="cancelUpload"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></view>
              </view>
              <text v-if="editing && upload?.state === 'failed' && upload.kind === requirement.kind" class="detail-file-hint">{{ c.failedUploadHint }}</text>
              <view v-if="editing && !(upload?.state === 'uploading' && upload.kind === requirement.kind)" class="detail-add" role="button" :tabindex="addLocked ? -1 : 0" :aria-disabled="addLocked" @click="chooseFile(requirement.kind)" @keydown.enter.prevent="chooseFile(requirement.kind)" @keydown.space.prevent="chooseFile(requirement.kind)">
                <view class="detail-add__plus nx-frosted-button" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></view>
                <text>{{ filesOf(requirement.kind).length && requirementState(requirement.kind) !== 'flagged' ? c.add : addFirstLabel }}</text>
              </view>
            </view>
          </view>
          <view v-if="editing" class="detail-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg><text>{{ fileHint }}</text></view>
        </view>

        <view v-if="editing ? (pack.bucket || bucket) : pack.materialRevision > 0" class="detail-section">
          <view class="detail-section__head"><text class="detail-section__title">{{ c.statement }}</text></view>
          <view v-if="editing" class="detail-card detail-card--pad">
            <textarea v-model="statement" class="detail-textarea" :aria-label="c.statement" :placeholder="c.statementPlaceholder" placeholder-class="detail-placeholder" :disabled="busy" :maxlength="4000" auto-height />
            <view class="detail-counter"><text>{{ c.required }}</text><text>{{ statement.length }} / 4000</text></view>
          </view>
          <text v-else class="detail-note">{{ pack.statement || '—' }}</text>
        </view>

        <view v-if="editing && canLowerBudget" class="detail-section">
          <view class="detail-section__head"><text class="detail-section__title">{{ c.lowerBudget }}</text><text class="detail-section__sub">{{ c.optional }}</text></view>
          <view class="detail-card detail-card--pad">
            <view class="detail-control">
              <text class="detail-control__prefix">USDT</text>
              <text v-if="visibility.hidden" class="detail-control__value">{{ visibility.mask(budget) }}</text>
              <input v-else v-model="budget" class="detail-control__value detail-control__input" type="text" inputmode="decimal" :aria-label="c.lowerBudget" :disabled="busy" />
            </view>
            <text class="detail-help">{{ fmt(c.lowerHelp, { amount: visibility.mask(ambassadorAmountText(pack.budgetUsdt)) }) }}</text>
          </view>
        </view>
        <view class="detail-bar-space" />
      </CardStagger>
    </view>
    <template #pageFixed>
      <AmbassadorActionBar v-if="pack && row && editing">
        <view class="amb-bar__row">
          <NxButton v-if="editedBeyondCategory || editRequested" variant="secondary" :label="c.discard" :disabled="saving || picking || !!pendingSubmission" @click="discardChanges" />
          <NxButton class="amb-bar__main" variant="primary" :label="saving ? c.saving : c.submit" :disabled="!!submitBlocker" :busy="saving" @click="save" />
        </view>
        <text v-if="submitError" class="amb-bar__why detail-bar-error" role="alert">{{ submitError }}</text>
        <text v-else-if="submitBlocker || pack.materialRevision > 0" class="amb-bar__why">{{ submitBlocker || c.resubmitHint }}</text>
      </AmbassadorActionBar>
      <AmbassadorActionBar v-else-if="pack && row && editable">
        <NxButton variant="secondary" :label="c.replace" @click="enterEdit" />
        <text class="amb-bar__why">{{ c.replaceHint }}</text>
      </AmbassadorActionBar>
      <AmbassadorActionBar v-else-if="pack && row && row.status === 'APPROVED'">
        <NxButton variant="secondary" :label="c.newApplication" @click="openAgent" />
      </AmbassadorActionBar>
      <AmbassadorActionBar v-else-if="pack && row && row.status === 'REJECTED'">
        <NxButton variant="primary" :label="c.reapply" @click="openAgent" />
      </AmbassadorActionBar>
      <view v-if="previewSrc" class="detail-preview" role="dialog" aria-modal="true" :aria-label="c.preview">
        <view class="detail-preview__top">
          <view class="detail-preview__close nx-frosted-button" role="button" tabindex="0" :aria-label="c.closePreview" @click="closePreview" @keydown.enter.prevent="closePreview" @keydown.space.prevent="closePreview"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></view>
          <view class="detail-preview__titles"><text class="detail-preview__name">{{ previewFile?.name }}</text><text class="detail-preview__size">{{ previewFile ? fileSize(previewFile.sizeBytes) : '' }}</text></view>
        </view>
        <view class="detail-preview__stage"><image class="detail-preview__image" :src="previewSrc" mode="aspectFit" /></view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import EmptyState from "@/components/empty-state.vue";
import CardStagger from "@/components/card-stagger.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import AmbassadorActionBar from "@/components/team/ambassador-action-bar.vue";
import AmbassadorAmount from "@/components/team/ambassador-amount.vue";
import AmbassadorBucketIcon from "@/components/team/ambassador-bucket-icon.vue";
import AmbassadorTrack from "@/components/team/ambassador-track.vue";
import { ambassadorApplicationApi, apiRuntimeConfig } from "@/api/runtime";
import type { AmbassadorApplication, AmbassadorMaterialAttachment, AmbassadorMaterialReview, AmbassadorMaterials, AmbassadorMaterialsInput } from "@/api/ambassador-application-api";
import { asApiError, isSettledRejection } from "@/api/errors";
import { acquireAmbassadorCommandKey, finishAmbassadorCommand } from "@/lib/ambassador-command-key";
import { ambassadorMaterialDraftCache, type AmbassadorMaterialDraft } from "@/lib/ambassador-draft-session";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { createAbortController } from "@/lib/abort-controller-compat";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { advisorChatRoute } from "@/lib/advisor-chat-route";
import { navTo, takeNavigationQuery } from "@/lib/route";
import { formatGroupedAmount } from "@/lib/amount-display";
import { AMBASSADOR_BUCKET_IDS, AMBASSADOR_ROUTES, ambassadorAmountText, ambassadorPacketFacts, ambassadorPresentation, type AmbassadorBucketId } from "@/lib/ambassador-display";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { ambassadorCopy, ambassadorCount } from "@/i18n/ambassador";
import { fmt } from "@/i18n/format";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useConversations } from "@/store/conversations";
import { useDataVisibility } from "@/store/data-visibility";
import { useLocaleStore } from "@/store/locale";
import { confirm, toast, useUI } from "@/store/ui";

const t = useT();
const app = useApp(), auth = useAuth(), locale = useLocaleStore(), visibility = useDataVisibility();
const c = computed(() => ambassadorCopy(locale.code));
const DIALOG_OWNER = "ambassador-application-detail";

const applicationId = ref<number | null>(null);
const row = ref<AmbassadorApplication | null>(null);
const pack = ref<AmbassadorMaterials | null>(null);
const readState = ref<"loading" | "ready" | "error">("loading");
const attachments = ref<AmbassadorMaterialAttachment[]>([]);
const statement = ref(""), budget = ref(""), bucket = ref<AmbassadorBucketId>();
const saving = ref(false), picking = ref(false), submitError = ref(""), editRequested = ref(false);
// A submission whose outcome is unknown: its draft and command key stay until a server read settles it.
const pendingSubmission = ref<AmbassadorMaterialDraft['pendingSubmission']>(null);
// The server refused the submission because the application is closed: no more editing on this page.
const locked = ref(false);
// The application's own status must be reread (after new materials, or when the packet says it closed).
const statusStale = ref(false);
interface UploadDraft { kind: string; path: string; name: string; key: string; state: "uploading" | "failed" }
const upload = ref<UploadDraft | null>(null);
const previewFile = ref<AmbassadorMaterialAttachment | null>(null), previewSrc = ref(""), previewBusy = ref(false);
function draftsForScope() {
  return ambassadorMaterialDraftCache.forScope({ accountKey: app.accountKey, accountEpoch: app.accountBindingEpoch,
    authenticated: auth.isAuthenticated, environment: apiRuntimeConfig.environment, baseUrl: apiRuntimeConfig.baseUrl });
}
ambassadorMaterialDraftCache.observeScope(app, auth, apiRuntimeConfig);

const presentation = computed(() => ambassadorPresentation(pack.value && row.value ? ambassadorPacketFacts(row.value.status, pack.value) : { status: "PENDING", bucket: null }));
// A packet that says the application is no longer pending is final even before the list catches up.
const pending = computed(() => row.value?.status === "PENDING" && !locked.value && !pack.value?.approvalBlockers.includes("APPLICATION_NOT_PENDING"));
// Closed but the list has not caught up: show no guessed decision until the status is reread.
const statusKnown = computed(() => pending.value || row.value?.status !== "PENDING");
const editable = computed(() => auth.isAuthenticated && pending.value && pack.value?.canSubmit === true && !pack.value.legacyApproved);
const canLowerBudget = computed(() => !!pack.value && [pack.value.businessReview, pack.value.financeReview].some(review => review.status === "NEEDS_MORE"));
// Nothing submitted yet, returned for more, or a missing category: the page opens ready to edit.
const editing = computed(() => editable.value && (editRequested.value || !pack.value?.bucket || pack.value.materialState === "NOT_SUBMITTED" || pack.value.materialState === "NEEDS_MORE"));
const busy = computed(() => saving.value || picking.value || upload.value?.state === "uploading");
// Unsubmitted work includes an upload that is still running or has failed: a refresh would drop it.
// Choosing the missing category alone is not offered for discarding; files, notes and amounts are.
const editedBeyondCategory = computed(() => !!pack.value && (!!upload.value || statement.value !== pack.value.statement || budget.value !== String(pack.value.budgetUsdt)
  || JSON.stringify(attachments.value.map(file => [file.fileId, file.kind])) !== JSON.stringify(pack.value.attachments.map(file => [file.fileId, file.kind]))));
const dirty = computed(() => editedBeyondCategory.value || (!!pack.value && (bucket.value ?? null) !== pack.value.bucket));
const bucketLocked = computed(() => busy.value || attachments.value.length > 0 || !!upload.value);
const addLocked = computed(() => busy.value || !!upload.value || attachments.value.length >= 12);
const shownAttachments = computed(() => editing.value ? attachments.value : pack.value?.attachments ?? []);
const requirements = computed(() => pack.value?.bucket ? pack.value.requirements : editing.value && bucket.value ? pack.value?.requirementsByBucket?.[bucket.value] ?? [] : []);
const materialsSub = computed(() => !pack.value?.bucket && bucket.value ? t.value.agent.buckets[bucket.value].title
  : editing.value ? fmt(c.value.filesOfLimit, { n: attachments.value.length }) : ambassadorCount(c.value.files, shownAttachments.value.length));
let addFirstLabelValue = (copy: ReturnType<typeof ambassadorCopy>) => copy.addFirst;
let fileHintValue = (copy: ReturnType<typeof ambassadorCopy>) => copy.fileHint;
// #ifdef APP-PLUS
addFirstLabelValue = copy => copy.addFirstNative;
fileHintValue = copy => copy.nativeFileHint;
// #endif
const addFirstLabel = computed(() => addFirstLabelValue(c.value));
const fileHint = computed(() => fileHintValue(c.value));
const submitBlocker = computed(() => {
  const reasons = c.value.reasons;
  if (!editing.value) return "";
  if (!bucket.value) return reasons.bucket;
  const noFiles = !attachments.value.length && !upload.value, noStatement = !statement.value.trim();
  if (noFiles && noStatement) return reasons.filesAndStatement;
  if (noFiles) return reasons.files;
  if (noStatement) return reasons.statement;
  if (upload.value) return upload.value.state === "uploading" ? reasons.uploading : reasons.failedUpload;
  return dirty.value ? "" : reasons.unchanged;
});

function filesOf(kind: string) { return shownAttachments.value.filter(file => file.kind === kind); }
function kindLabel(kind: string): string {
  return c.value.kinds[kind] ?? requirements.value.find(item => item.kind === kind)?.label ?? "—";
}
/** Submitted packets: a kind the server still lists as missing stays flagged (with or without files) until a new version is submitted. */
function requirementState(kind: string): "flagged" | "done" | "empty" {
  if (pack.value?.bucket && pack.value.materialRevision > 0 && pack.value.missingKinds.includes(kind)) return "flagged";
  return filesOf(kind).length ? "done" : "empty";
}
function fileSize(size: number): string { return `${Math.max(0.1, size / 1024 / 1024).toFixed(1)} MB`; }
function reviewTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const stages = computed(() => {
  const value = pack.value;
  if (!value) return [];
  const status = (review: AmbassadorMaterialReview) => review.status === "PASSED" || review.status === "NEEDS_MORE" ? c.value.reviewStates[review.status] : pending.value ? c.value.reviewStates.waiting : c.value.reviewStates.none;
  const tone = (review: AmbassadorMaterialReview) => review.status === "PASSED" ? "ok" : review.status === "NEEDS_MORE" ? "warn" : "wait";
  const attendees = value.businessReview.verifiedAttendees, recognized = value.financeReview.recognizedBudgetUsdt;
  // Only the venue category is checked for attendance; an expected figure stays "—" until the review records one.
  return [
    { key: "business" as const, label: c.value.business, review: value.businessReview, status: status(value.businessReview), tone: tone(value.businessReview),
      metric: attendees != null || (pending.value && value.bucket === "venue") ? { label: c.value.attendees, value: attendees != null ? visibility.mask(attendees) : "—", unit: attendees != null && !visibility.hidden ? c.value.people : "" } : null },
    { key: "finance" as const, label: c.value.finance, review: value.financeReview, status: status(value.financeReview), tone: tone(value.financeReview),
      metric: recognized != null || pending.value ? { label: c.value.recognized, value: recognized != null ? visibility.mask(formatGroupedAmount(recognized, "full")) : "—", unit: recognized != null ? "USDT" : "" } : null },
  ];
});
// Every recorded review carries a reason; returns read as a warning while the application is open.
const opinions = computed(() => stages.value.filter(stage => stage.review.reason));
// Facts already on screen (track, review cells, requirement rows) are not repeated as hints. Admin-side
// approval rules are never shown; an amount or attendance hint appears only once a reviewer recorded a figure.
const SILENT_BLOCKERS = new Set(["APPLICATION_NOT_PENDING", "APPLICATION_BUCKET_REQUIRED", "MATERIALS_NOT_SUBMITTED", "AMBASSADOR_REQUIRED_MATERIAL_MISSING", "BUSINESS_REVIEW_REQUIRED",
  "FINANCE_REVIEW_REQUIRED", "MATERIALS_NEEDS_MORE", "MATERIAL_REVISION_STALE", "SELF_REVIEW_APPROVAL_FORBIDDEN", "PERMISSION_DENIED"]);
const approvalHints = computed(() => {
  const value = pack.value;
  if (!value || !pending.value || value.legacyApproved) return [];
  const hints = new Set<string>();
  for (const code of value.approvalBlockers) {
    if (code === "RECOGNIZED_AMOUNT_INSUFFICIENT") { if (value.financeReview.recognizedBudgetUsdt != null) hints.add(c.value.hints[code]); }
    else if (code === "AMBASSADOR_VERIFIED_ATTENDEES_INVALID") { if (value.businessReview.verifiedAttendees != null) hints.add(c.value.hints[code]); }
    else if (code === "EVENT_NOT_COMPLETED") hints.add(c.value.hints[code]);
    else if (!SILENT_BLOCKERS.has(code)) hints.add(c.value.blocked);
  }
  return [...hints];
});

let visible = false, disposed = false, generation = 0;
// Reads are ordered on their own: a later read or a confirmed submission overtakes an earlier read
// without touching uploads (those follow `generation`, which only changes with the account or environment).
let readSeq = 0;
let uploadController: AbortController | null = null, previewController: AbortController | null = null;
function scope() {
  const account = app.accountKey, binding = app.accountBindingEpoch, id = applicationId.value;
  const environment = apiRuntimeConfig.environment, baseUrl = apiRuntimeConfig.baseUrl, currentGeneration = generation;
  return () => !disposed && auth.isAuthenticated && account === app.accountKey && binding === app.accountBindingEpoch
    && id === applicationId.value && environment === apiRuntimeConfig.environment && baseUrl === apiRuntimeConfig.baseUrl && currentGeneration === generation;
}
function releasePath(path: string) {
  // #ifdef H5
  if (path.startsWith("blob:")) URL.revokeObjectURL(path);
  // #endif
}
function closePreview() { if (previewSrc.value) releasePath(previewSrc.value); previewSrc.value = ""; previewFile.value = null; }
useDialogA11y(computed(() => !!previewSrc.value), ".detail-preview", closePreview, true);
function cancelUpload() {
  uploadController?.abort(); uploadController = null;
  if (upload.value) releasePath(upload.value.path);
  upload.value = null;
}
/** Back to the submitted packet: drops local edits and any upload draft. */
function resetDraft() {
  const value = pack.value;
  if (value) draftsForScope().delete(value.applicationId);
  cancelUpload(); submitError.value = "";
  attachments.value = value ? [...value.attachments] : []; statement.value = value?.statement ?? "";
  budget.value = value ? String(value.budgetUsdt) : ""; bucket.value = value?.bucket ?? undefined;
}
function discardChanges() {
  if (saving.value || picking.value || pendingSubmission.value) return;
  resetDraft(); editRequested.value = false;
}
function enterEdit() { if (editable.value) editRequested.value = true; }
/** A known decision is final; a late read of the same application never reopens it. */
function applyRow(found: AmbassadorApplication) {
  row.value = row.value && row.value.status !== "PENDING" && found.status === "PENDING" ? { ...found, status: row.value.status } : found;
}

/** Show a packet unless a newer revision is already confirmed on this page. */
function acceptPack(value: AmbassadorMaterials): boolean {
  if (pack.value && value.materialRevision < pack.value.materialRevision) return false;
  pack.value = value;
  return true;
}
function sameMaterials(value: AmbassadorMaterials, input: AmbassadorMaterialsInput): boolean {
  const files = (list: { fileId: string; kind: string }[]) => list.map(file => `${file.kind}:${file.fileId}`).sort().join("|");
  return files(value.attachments) === files(input.attachments) && value.statement === input.statement
    && (input.budgetUsdt === undefined || value.budgetUsdt === input.budgetUsdt) && (input.bucket === undefined || value.bucket === input.bucket);
}
/**
 * An unconfirmed submission is settled only by server facts: a newer revision with the same files,
 * notes and amount means it landed. Nothing is resent automatically.
 */
function settlePendingSubmission(value: AmbassadorMaterials, closed: boolean) {
  const sent = pendingSubmission.value;
  if (!sent) return;
  if (value.materialRevision > sent.input.expectedMaterialRevision && sameMaterials(value, sent.input)) {
    finishAmbassadorCommand(sent.account, sent.identity);
    pendingSubmission.value = null;
    acceptPack(value); resetDraft(); editRequested.value = false;
    toast.success(c.value.saved, "");
    if (row.value?.status === "PENDING") { statusStale.value = true; void recoverStatus(); }
  } else if (closed) {
    // A closed application refuses any further submission; its packet is the final fact.
    finishAmbassadorCommand(sent.account, sent.identity);
    pendingSubmission.value = null;
    acceptPack(value); resetDraft(); editRequested.value = false;
  }
}

/** Resolves false only when this read failed. Unsubmitted edits keep their packet until they are discarded. */
async function load(): Promise<boolean> {
  const id = applicationId.value;
  if (id === null || !auth.isAuthenticated) return true;
  const current = scope(), seq = ++readSeq;
  if (!pack.value) readState.value = "loading";
  try {
    const [rows, value] = await Promise.all([ambassadorApplicationApi.history(), ambassadorApplicationApi.materials(id)]);
    if (!current() || seq !== readSeq) return true;
    const found = rows.find(item => item.applicationId === id);
    if (!found) throw new Error("AMBASSADOR_APPLICATION_NOT_FOUND");
    applyRow(found);
    const closed = row.value?.status !== "PENDING" || value.approvalBlockers.includes("APPLICATION_NOT_PENDING");
    if (!pack.value) {
      const drafts = draftsForScope(), draft = drafts.get(id);
      acceptPack(value); resetDraft();
      if (draft && !closed && draft.materialRevision === value.materialRevision) {
        attachments.value = draft.attachments; statement.value = draft.statement; budget.value = canLowerBudget.value ? draft.budget : String(value.budgetUsdt); bucket.value = draft.bucket;
        editRequested.value = draft.editRequested || dirty.value; pendingSubmission.value = draft.pendingSubmission;
        submitError.value = draft.pendingSubmission ? c.value.saveUnknown : draft.submitError;
      } else if (draft?.pendingSubmission) {
        // A landed command can be confirmed by the newer server packet; other stale drafts are dropped.
        pendingSubmission.value = draft.pendingSubmission;
        settlePendingSubmission(value, closed);
        if (pendingSubmission.value) { editRequested.value = true; submitError.value = c.value.saveUnknown; }
      }
    }
    // Reviews can change without a material revision. Keep edits, but use the current review facts.
    if (pack.value?.materialRevision === value.materialRevision) {
      const wasEditing = editing.value;
      acceptPack(value);
      if (!canLowerBudget.value) budget.value = String(value.budgetUsdt);
      if (wasEditing && dirty.value) editRequested.value = true;
    }
    if (pendingSubmission.value) settlePendingSubmission(value, closed);
    else if (closed || (!busy.value && !dirty.value)) { if (acceptPack(value)) resetDraft(); if (closed) editRequested.value = false; }
    statusStale.value = row.value?.status === "PENDING" && value.approvalBlockers.includes("APPLICATION_NOT_PENDING");
    readState.value = "ready";
    return true;
  } catch {
    if (!current() || seq !== readSeq) return true;
    readState.value = "error";
    return false;
  }
}
function retry() { void load(); }
async function pullRefresh() {
  if (saving.value || picking.value) return;
  // An unconfirmed submission is checked against the server without discarding its draft.
  if (dirty.value && !pendingSubmission.value) {
    const discard = await confirm({ owner: DIALOG_OWNER, title: c.value.discardPrompt, confirmLabel: c.value.discard, cancelLabel: c.value.cancel });
    if (!discard) return;
    discardChanges();
  }
  if (!await load()) throw new Error("AMBASSADOR_DETAIL_REFRESH_FAILED");
}
/** The list row is the only source of the application's own status; failures stay with automatic recovery. */
async function refreshStatus(): Promise<void> {
  const current = scope(), id = applicationId.value;
  const found = (await ambassadorApplicationApi.history()).find(item => item.applicationId === id);
  if (!current() || !found) return;
  applyRow(found);
  statusStale.value = row.value?.status === "PENDING" && (locked.value || !!pack.value?.approvalBlockers.includes("APPLICATION_NOT_PENDING"));
}

function chooseBucket(id: AmbassadorBucketId) { if (editing.value && !pack.value?.bucket && !bucketLocked.value) bucket.value = id; }
function moveBucketFocus(event: KeyboardEvent, delta: number) {
  const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'));
  const next = items[(items.indexOf(document.activeElement as HTMLElement) + delta + items.length) % items.length];
  next?.focus();
  next?.click();
}
/** Roving tab stop: the chosen category, or the first one before anything is chosen. */
function bucketTabStop(id: AmbassadorBucketId, index: number) { return bucket.value ? bucket.value === id : index === 0; }
function removeFile(id: string) { if (editing.value && !busy.value) attachments.value = attachments.value.filter(file => file.fileId !== id); }

async function chooseFile(kind: string) {
  if (!editing.value || busy.value || upload.value) return;
  if (attachments.value.length >= 12) { toast.info(c.value.limit, ""); return; }
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
      releasePath(selected.path); toast.error(c.value.invalidFile, ""); return;
    }
    const key = `app-ambassador-file:${requireCryptoUuid()}`;
    upload.value = { kind, path: selected.path, name: selected.name, key, state: "failed" };
  } catch { if (current()) toast.error(c.value.pickFailed, ""); }
  finally { if (current()) picking.value = false; }
  if (current() && upload.value) await retryUpload();
}
async function retryUpload() {
  const draft = upload.value, id = applicationId.value;
  if (!editing.value || !draft || draft.state === "uploading" || id === null) return;
  const current = scope();
  const controller = createAbortController(); uploadController = controller; draft.state = "uploading";
  try {
    const file = await ambassadorApplicationApi.uploadMaterialFile(id, draft.path, draft.kind, draft.key, controller.signal);
    if (!current() || upload.value !== draft) return;
    attachments.value = [...attachments.value, file];
    releasePath(draft.path); upload.value = null;
  } catch (cause) {
    if (!current() || upload.value !== draft) return;
    draft.state = "failed";
    if ([413, 415].includes(asApiError(cause).status ?? 0)) toast.error(c.value.invalidFile, "");
  } finally { if (uploadController === controller) uploadController = null; }
}
const SAVE_ERRORS = ["MATERIAL_REVISION_STALE", "APPLICATION_BUCKET_REQUIRED"] as const;
async function save() {
  if (pack.value && !canLowerBudget.value) budget.value = String(pack.value.budgetUsdt);
  if (!editing.value || busy.value || upload.value || !dirty.value || !pack.value || !bucket.value || !attachments.value.length || !statement.value.trim()) return;
  const amount = Number(budget.value);
  if (!/^\d+(?:\.\d+)?$/.test(budget.value) || !Number.isFinite(amount) || amount <= 0 || amount > pack.value.budgetUsdt) {
    submitError.value = c.value.invalidBudget; return;
  }
  const id = pack.value.applicationId, current = scope(), account = app.accountKey;
  const input: AmbassadorMaterialsInput = { expectedMaterialRevision: pack.value.materialRevision,
    attachments: attachments.value.map(({ fileId, kind }) => ({ fileId, kind })), statement: statement.value.trim(),
    ...(canLowerBudget.value && amount !== pack.value.budgetUsdt ? { budgetUsdt: amount } : {}), ...(!pack.value.bucket ? { bucket: bucket.value } : {}) };
  const identity = JSON.stringify(["materials", id, input]);
  saving.value = true; submitError.value = "";
  try {
    const key = acquireAmbassadorCommandKey(account, identity);
    pendingSubmission.value = { account, identity, input };
    const value = await ambassadorApplicationApi.submitMaterials(id, input, key);
    if (!current()) return;
    finishAmbassadorCommand(account, identity);
    pendingSubmission.value = null;
    // Reads that started before this confirmation carry older facts.
    readSeq++;
    acceptPack(value); resetDraft(); editRequested.value = false;
    toast.success(c.value.saved, "");
    if (row.value?.status === "PENDING") { statusStale.value = true; void recoverStatus(); }
  } catch (cause) {
    if (!current()) return;
    const code = asApiError(cause).message;
    const mapped = code === "AMBASSADOR_BUDGET_INVALID" || (SAVE_ERRORS as readonly string[]).includes(code);
    const settled = isSettledRejection(cause) || mapped || code === "APPLICATION_NOT_PENDING";
    if (code === "APPLICATION_NOT_PENDING") {
      // The application was decided meanwhile: stop editing now and show the decision the server holds.
      finishAmbassadorCommand(account, identity);
      pendingSubmission.value = null;
      locked.value = true; editRequested.value = false; statusStale.value = true;
      toast.error(c.value.saveErrors.APPLICATION_NOT_PENDING, "");
      void load();
      return;
    }
    if (settled) { finishAmbassadorCommand(account, identity); pendingSubmission.value = null; }
    // Unknown outcome: keep the draft and the original key; later reads settle it, nothing is resent.
    // A definite refusal says so; anything else is unconfirmed, never a failure the user should repeat.
    submitError.value = code === "AMBASSADOR_BUDGET_INVALID" ? c.value.invalidBudget
      : mapped ? c.value.saveErrors[code as typeof SAVE_ERRORS[number]]
      : settled ? c.value.saveRejected : c.value.saveUnknown;
  } finally { if (current()) saving.value = false; }
}
async function viewFile(file: AmbassadorMaterialAttachment) {
  const id = applicationId.value;
  if (previewBusy.value || id === null) return;
  const current = scope(), controller = createAbortController(); previewController = controller; previewBusy.value = true;
  try {
    const path = await ambassadorApplicationApi.materialFile(id, file.fileId, controller.signal);
    if (!current()) { releasePath(path); return; }
    if (file.contentType !== "application/pdf") { closePreview(); previewFile.value = file; previewSrc.value = path; return; }
    // #ifdef H5
    const link = document.createElement("a"); link.href = path; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => releasePath(path), 60_000);
    // #endif
    // #ifndef H5
    await new Promise<void>((resolve, reject) => uni.openDocument({ filePath: path, fileType: "pdf", success: () => resolve(), fail: reject }));
    // #endif
  } catch { if (current()) toast.error(c.value.previewFailed, ""); }
  finally { if (previewController === controller) { previewController = null; previewBusy.value = false; } }
}
async function contactSupport() {
  const current = scope();
  const route = await advisorChatRoute(useConversations());
  if (current() && visible) void navTo(route);
}
/** New and repeat applications start on the ambassador page; return to it when it is already below. */
function openAgent() {
  let pages: { route?: string }[] = [];
  try { pages = getCurrentPages() as { route?: string }[]; } catch { /* unavailable */ }
  const index = pages.map(page => page.route).lastIndexOf("pages/team/agent");
  if (index >= 0 && index < pages.length - 1) uni.navigateBack({ delta: pages.length - 1 - index, fail: () => void navTo(AMBASSADOR_ROUTES.agent) });
  else void navTo(AMBASSADOR_ROUTES.agent);
}

function reset() {
  generation++; cancelUpload(); previewController?.abort(); previewController = null; previewBusy.value = false; closePreview();
  row.value = null; pack.value = null; attachments.value = []; statement.value = ""; budget.value = ""; bucket.value = undefined;
  saving.value = false; picking.value = false; submitError.value = ""; editRequested.value = false; readState.value = "loading";
  pendingSubmission.value = null; locked.value = false; statusStale.value = false; readSeq++;
}
onLoad((options) => {
  const query = new URLSearchParams(takeNavigationQuery("/pages/team/agent-application"));
  const raw = String((options as Record<string, string | undefined> | undefined)?.id ?? query.get("id") ?? "");
  const id = Number(raw);
  applicationId.value = /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : null;
  if (applicationId.value === null) readState.value = "error";
});
watch([() => app.accountKey, () => app.accountBindingEpoch, () => auth.isAuthenticated, () => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl], () => {
  draftsForScope();
  reset();
  if (visible) void load();
}, { flush: "sync" });
let releaseActiveRefresh = () => {};
onShow(() => {
  visible = true;
  // Returning from the system picker or the background never discards an unsubmitted draft.
  void load();
  releaseActiveRefresh();
  releaseActiveRefresh = registerActivePageRefresh(pullRefresh, "pages/team/agent-application");
});
watch(foregroundReadAllowed, (allowed, wasAllowed) => { if (allowed && !wasAllowed && visible) void load(); });
onHide(() => { visible = false; releaseActiveRefresh(); closePreview(); previewController?.abort(); });
onUnload(() => {
  if (pack.value && pending.value && (dirty.value || editRequested.value || pendingSubmission.value)) {
    draftsForScope().set(pack.value.applicationId, { materialRevision: pack.value.materialRevision,
      attachments: [...attachments.value], statement: statement.value, budget: budget.value, bucket: bucket.value,
      editRequested: editRequested.value, submitError: submitError.value, pendingSubmission: pendingSubmission.value });
  }
  visible = false; disposed = true; releaseActiveRefresh(); useUI().clearConfirmsBy(DIALOG_OWNER);
  // reset() releases uploads and page state; the detached draft keeps only completed files and material edits.
  reset();
});
useAutoRecovery({ failed: () => readState.value === "error" && applicationId.value !== null, retry: load });
// Status rereads after new materials or a closed packet recover like any read: backoff, foreground and pull-down.
const { retry: recoverStatus } = useAutoRecovery({ failed: () => statusStale.value, retry: refreshStatus });
// An unconfirmed submission keeps being checked read-only while the page is shown (DS 03 §3.5.2), at a low rate.
useAutoRecovery({ failed: () => pendingSubmission.value !== null && !saving.value, retry: load, repeatMs: 30_000 });
</script>

<style scoped>
.detail-page { color: var(--v5-ink); }
.detail-loading { padding: var(--v5-space-8) var(--v5-space-4) 0; text-align: center; color: var(--v5-ink-3); }
.detail-content { display: flex; flex-direction: column; padding-top: var(--v5-space-4); }
.detail-hero { display: block; margin: 0 var(--v5-space-4); padding: var(--ui-space-inset-hero); border-radius: var(--ui-radius-surface); }
.detail-hero__top { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-inline); }
.detail-hero__category { display: inline-flex; align-items: center; gap: var(--v5-space-2); min-width: 0; font: var(--ui-type-description-weight, 400) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-hero__title { display: block; margin-top: var(--ui-space-inline); font: 600 20px/28px var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.detail-hero__date { display: block; margin-top: var(--v5-space-1); font: var(--ui-type-description-weight, 400) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-hero__amount { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: var(--v5-space-1) var(--ui-space-inline); margin-top: var(--v5-space-4); }
.detail-hero__key { font: var(--ui-type-description-weight, 400) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-hero__meta { display: flex; align-items: center; justify-content: space-between; margin-top: var(--v5-space-4); padding-top: var(--ui-space-inline); border-top: 1px solid var(--v5-border); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-hero__id { font-family: var(--font-metric); color: var(--v5-ink-2); }
.detail-hint { display: flex; gap: var(--v5-space-2); margin: var(--ui-space-inline) var(--v5-space-4) 0; font: var(--ui-type-note-weight, 400) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-hint > svg { flex: none; margin-top: var(--v5-space-1); }
.detail-hint--support { flex-wrap: wrap; align-items: center; }
.detail-hint--support > svg { margin-top: 0; }
.detail-link { display: inline-flex; align-items: center; gap: 2px; padding: calc((44px - 18px) / 2) 0; margin: calc((18px - 44px) / 2) 0; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3); cursor: pointer; }
.detail-section { margin-top: var(--ui-space-section-gap); }
.detail-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--ui-space-inline); margin: 0 var(--v5-space-4) var(--ui-space-inline); }
.detail-section__title { font: var(--ui-type-section-weight, 600) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.detail-section__sub { min-width: 0; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; text-align: end; }
.detail-reviews { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ui-space-card-gap); margin: 0 var(--v5-space-4); }
.detail-review { display: flex; flex-direction: column; min-height: 120px; box-sizing: border-box; padding: var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.detail-review--warn { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--v5-warning-ink) 55%, transparent), var(--v5-glass-shadow); }
.detail-review__label { font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-review__status { display: flex; align-items: center; gap: var(--v5-space-2); margin-top: var(--v5-space-2); font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.detail-review__status > svg { flex: none; }
.detail-review__status--ok { color: var(--v5-success-ink); }
.detail-review__status--warn { color: var(--v5-warning-ink); }
.detail-review__status--wait { color: var(--v5-ink-3); }
.detail-review__time { display: block; min-height: 16px; margin-top: var(--v5-space-1); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
.detail-review__metric { margin-top: auto; padding-top: var(--ui-space-inline); border-top: 1px solid var(--v5-border); }
.detail-review__metric-key { display: block; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-review__metric-value { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--v5-space-1); margin-top: var(--v5-space-1); font: 500 20px/26px var(--font-metric); color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.detail-review__metric-value--long { font-size: 14px; line-height: 20px; }
.detail-review__metric-number { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
.detail-review__metric-unit { font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-opinion { margin: var(--ui-space-inline) var(--v5-space-4) 0; padding: var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.detail-opinion__head { display: flex; align-items: center; gap: var(--v5-space-2); font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-opinion__head--active { color: var(--v5-warning-ink); }
.detail-opinion__body { display: block; margin-top: var(--v5-space-2); font: var(--ui-type-body-weight, 400) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5); color: var(--v5-ink-2); overflow-wrap: anywhere; white-space: pre-line; }
.detail-lead { display: block; margin: calc(-1 * var(--v5-space-1)) var(--v5-space-4) var(--ui-space-inline); font: var(--ui-type-description-weight, 400) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-buckets { display: flex; flex-direction: column; gap: var(--v5-space-2); margin: 0 var(--v5-space-4); }
.detail-bucket { display: flex; align-items: center; gap: var(--ui-space-inline); min-height: 64px; box-sizing: border-box; padding: var(--ui-space-inline) 14px; border-radius: var(--v5-radius-m); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); cursor: pointer; }
.detail-bucket--on { background: color-mix(in srgb, var(--v5-brand) 10%, var(--v5-surface)); box-shadow: inset 0 0 0 1.5px var(--v5-brand); }
.detail-bucket[aria-disabled="true"]:not(.detail-bucket--on) { opacity: .5; cursor: default; }
.detail-bucket__text { flex: 1; min-width: 0; }
.detail-bucket__title { display: block; font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.detail-bucket__rule { display: block; margin-top: var(--v5-space-1); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-bucket__radio { display: grid; place-items: center; flex: none; width: 22px; height: 22px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--v5-ink-4); }
.detail-bucket--on .detail-bucket__radio { border: 2px solid var(--v5-brand); }
.detail-bucket--on .detail-bucket__radio::after { content: ""; width: 12px; height: 12px; border-radius: 50%; background: var(--v5-brand); }
.detail-card { margin: 0 var(--v5-space-4); padding: 0 var(--v5-space-4); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.detail-card--pad { padding: var(--ui-space-inset); }
.detail-req { padding: 14px 0; border-bottom: 1px solid var(--v5-border); }
.detail-req:last-child { border-bottom: 0; }
.detail-req__head { display: flex; align-items: center; gap: var(--v5-space-2); min-height: 24px; }
.detail-req__icon { flex: none; color: var(--v5-ink-4); }
.detail-req__icon--ok { color: var(--v5-success-ink); }
.detail-req__icon--warn { color: var(--v5-warning-ink); }
.detail-req__name { flex: 1; min-width: 0; font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: anywhere; }
.detail-req__count { flex: none; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-file { display: flex; align-items: center; gap: var(--v5-space-2); min-height: 48px; margin-top: var(--v5-space-2); padding-left: var(--ui-space-inline); border-radius: var(--v5-radius-s); background: var(--v5-surface-2); }
.detail-file--failed { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-warning-ink) 45%, transparent); }
.detail-file__icon { flex: none; color: var(--v5-ink-3); }
.detail-file__icon--warn { color: var(--v5-warning-ink); }
.detail-file__spin { color: var(--v5-brand); animation: spin 900ms linear infinite; }
.detail-file__text { flex: 1; min-width: 0; padding: var(--v5-space-1) 0; }
.detail-file__name { display: block; font: var(--ui-type-description-weight, 400) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-file__size { display: block; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-file__size--warn { color: var(--v5-warning-ink); }
.detail-file__action { display: grid; place-items: center; flex: none; min-width: 44px; height: 44px; box-sizing: border-box; padding: 0 var(--v5-space-2); font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); color: var(--v5-brand); cursor: pointer; }
.detail-file__action:last-child { margin-right: var(--v5-space-1); }
.detail-file__remove { display: grid; place-items: center; flex: none; width: 44px; height: 44px; color: var(--v5-ink-3); cursor: pointer; }
.detail-file__action[aria-disabled="true"], .detail-file__remove[aria-disabled="true"] { opacity: .5; cursor: default; }
/* Why the add buttons are dimmed while a failed upload is listed (design system 03 §3.4). */
.detail-file-hint { display: block; margin-top: var(--v5-space-1); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-add { display: flex; align-items: center; justify-content: center; gap: var(--v5-space-2); width: 100%; min-height: 44px; margin-top: var(--v5-space-2); box-sizing: border-box; border-radius: var(--v5-radius-s); border: 1.5px dashed color-mix(in srgb, var(--v5-ink) 18%, transparent); font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); color: var(--v5-ink-2); cursor: pointer; }
.detail-add[aria-disabled="true"] { opacity: .5; cursor: default; }
.detail-add__plus { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; color: var(--v5-ink); }
/* uni-textarea's inner wrapper inherits min-height as its content minimum; subtract the padding so the field is 96px. */
.detail-textarea { display: block; width: 100%; min-height: calc(96px - 2 * var(--ui-space-inline)); word-break: normal; overflow-wrap: break-word; box-sizing: border-box; padding: var(--ui-space-inline); border-radius: var(--v5-radius-s); background: var(--v5-surface-3); font: var(--ui-type-input-weight, 400) var(--ui-type-input)/var(--ui-type-input-lh) var(--font-v5); color: var(--v5-ink); }
.detail-placeholder { color: var(--v5-ink-3); }
.detail-counter { display: flex; justify-content: space-between; margin-top: var(--v5-space-2); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
.detail-note { display: block; margin: 0 var(--v5-space-4); padding: var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); font: var(--ui-type-body-weight, 400) var(--ui-type-body)/var(--ui-type-body-lh) var(--font-v5); color: var(--v5-ink-2); overflow-wrap: anywhere; white-space: pre-line; }
.detail-control { display: flex; align-items: center; gap: var(--v5-space-2); min-height: 44px; box-sizing: border-box; padding: 0 var(--ui-space-inline); border-radius: var(--v5-radius-s); background: var(--v5-surface-3); font: var(--ui-type-input-weight, 400) var(--ui-type-input)/var(--ui-type-input-lh) var(--font-v5); color: var(--v5-ink); }
.detail-control__prefix { flex: none; font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-control__value { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; }
.detail-control__input { min-height: 44px; background: transparent; color: var(--v5-ink); font: inherit; }
.detail-help { display: block; margin-top: var(--v5-space-2); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-textarea:focus, .detail-control:focus-within { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.detail-file__action:focus-visible, .detail-file__remove:focus-visible, .detail-add:focus-visible, .detail-bucket:focus-visible, .detail-link:focus-visible, .detail-preview__close:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.detail-bar-space { height: calc(150px + env(safe-area-inset-bottom)); }
.detail-bar-error { color: var(--v5-warning-ink); }
.detail-preview { position: fixed; z-index: 800; inset: 0; display: flex; flex-direction: column; background: var(--v5-bg); color: var(--v5-ink); }
.detail-preview__top { display: flex; align-items: center; gap: var(--ui-space-inline); padding: calc(var(--v5-space-2) + env(safe-area-inset-top)) var(--v5-space-4) 0; }
.detail-preview__close { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; }
.detail-preview__titles { flex: 1; min-width: 0; margin-right: calc(44px + var(--ui-space-inline)); text-align: center; }
.detail-preview__name { display: block; font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-preview__size { display: block; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.detail-preview__stage { flex: 1; min-height: 0; display: flex; padding: var(--v5-space-6) var(--v5-space-4) calc(var(--v5-space-8) + env(safe-area-inset-bottom)); }
.detail-preview__image { width: 100%; height: 100%; }
@media (prefers-reduced-motion: reduce) { .detail-file__spin { animation: none; } }
</style>
