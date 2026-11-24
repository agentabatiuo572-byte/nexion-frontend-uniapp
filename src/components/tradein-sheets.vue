<!--
  Trade-in sheet flow — chassis-level bottom sheets. Ported from
  Nexion-prototype/app/components/tradein-sheets.tsx (Batch C, 2026-05-27).

  Five overlapping sheets share ONE `useTradeinSheet` discriminated-union state
  machine so only one is visible at a time (prevents double-open from rapid
  taps). Branch is gated by `state.kind`, not local props:

    1.   choice  — entry fork at checkout when the user owns ≥1 retirable
         device toward the target SKU. Trade in (→ tradein) or close the sheet
         to continue with the current checkout price.
    1.5  retire  — FEAT-DEV02 devices-page entry: pick a higher-priced upgrade
         target for the chosen device (select list, no free input) → tradein.
    2.   tradein — confirm card (lifetime output / ladder band / credit / est.
         payable). Confirm writes the checkout credit context
         (sheet.applyTradein) and routes to checkout — money + device mutation
         happen atomically in checkout's persist block, not here.
    3.   replace — entry for retrying a previously saved capacity purchase.
    4.   block   — mid-task gate, split by origin: replace → wait / force
         (forfeits reward); retire → view task / dismiss (no force teardown).

  Port notes:
    · framer slide/fade           → CSS @keyframes (tradein-fade / -slide-up)
    · lucide X/ArrowRightLeft/...  → inline <svg stroke="currentColor"/var()>
    · zustand getState/setState    → Pinia store refs (useApp().devices, etc.)
    · all bare text wrapped in <text> (cross-end, P-026/030)
    · <button> → <view @click> (P-036); uni.navigateTo replaces router.replace

  ⚠️ MOCK-ONLY CROSS-STORE COMPOSERS
  ---
  Touches stores: useApp (devices), useTradeinSheet;资金变更走 lib/money-receipt 收口点。
  Path B (replace/keep-buy/force) composers mutate app.devices + postMoneyBill here with
  documented rollback ordering. The FEAT-DEV02 trade-in path deliberately does
  NOT mutate here — it defers to checkout's single persist block. Production:
  each flow maps to a single server transaction; the client mirrors the rollback.

  Endpoints(逐条出处;PRD 未定义的显式标 TBD,不许当既定契约引用):
    - Trade-in:         POST /api/orders (PRD §7.5 — 携 tradeInDeviceId,server
                        同事务复算阶梯抵扣 + 下架旧机)
    - Path B replace:   POST /api/devices/deactivate + POST /api/orders
                        (deactivate 见 PRD §9.11c.1 composer endpoints,PRD 原文
                        标 "TBD; candidates";下单仍走 POST /api/orders)
    - Path B keep+buy:  POST /api/app/trade-in/capacity-keep
                        (wallet debit + paid order + inactive inventory device,
                        one server transaction)
-->
<template>
  <view v-if="sheetVisible" class="tis-root" role="dialog" aria-modal="true" :aria-labelledby="titleId">
    <view class="tis-backdrop nx-sheet-fade-in" @click="hide" />

    <view class="nx-glass-sheet tis-panel nx-sheet-slide-up" @click.stop>
      <view class="tis-close" role="button" tabindex="0" :aria-label="t.ui.close" @click="hide"  @keydown.enter.prevent="hide" @keydown.space.prevent="hide">
        <LiquidGlass :radius="22" tone="control" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </view>

      <!-- ─────────── 1. choice — checkout: credit a paid old device, or pay full price (boards B-5a, B-5b) ─────────── -->
      <template v-if="state.kind === 'choice' && choiceView">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ remoteApiEnabled ? t.tradein.checkoutReAdd : t.tradein.choiceTitle }}</text></view>
        <view class="tis-bd">
          <!-- One old device: the machine is the visual and the action a primary button (04 §4.0 项数少时换布局). -->
          <view v-if="choiceView.single" class="tis-hero">
            <view class="tis-hero__stage"><view class="tis-hero__floor" /><DeviceArt class="tis-hero__art" :device="choiceView.single.device" /></view>
            <text class="tis-hero__name">{{ choiceView.single.name }}</text>
            <text class="tis-hero__credit">{{ t.tradein.inventoryCreditLabel }} <text class="tis-num">{{ choiceView.single.credit }}</text></text>
            <text class="tis-hero__label">{{ t.tradein.sheetNetCostLabel }}</text>
            <text v-if="choiceView.single.net" class="tis-amt tis-amt--hero"><text class="tis-amt__cur">$</text>{{ choiceView.single.net.int }}<text class="tis-amt__dec">{{ choiceView.single.net.dec }}</text></text>
            <text v-else class="tis-amt tis-amt--hero tis-amt--unknown">—</text>
          </view>
          <view v-else-if="choiceView.rows.length">
            <!-- Every row shows the same figure, so its name is written once above the column (03 §3.6.1). -->
            <text class="tis-col-label" aria-hidden="true">{{ t.tradein.sheetNetCostLabel }}</text>
            <view class="tis-list">
              <view v-for="row in choiceView.rows" :key="row.id" class="tis-target" :class="{ 'tis-target--disabled': quoteLoading }" role="button" :tabindex="quoteLoading ? -1 : 0" :aria-disabled="quoteLoading" :aria-busy="quoteLoading" :aria-label="row.label" @click="onChooseTradein(row.id)"  @keydown.enter.prevent="onKeyboardActivate($event, () => onChooseTradein(row.id))" @keydown.space.prevent="onKeyboardActivate($event, () => onChooseTradein(row.id))">
                <DeviceArt class="tis-target__art" :device="row.device" />
                <view class="tis-target__meta">
                  <text class="tis-target__name">{{ row.name }}</text>
                  <view class="tis-target__sub"><text class="tis-target__price">{{ t.tradein.inventoryCreditLabel }} <text class="tis-num">{{ row.credit }}</text></text></view>
                </view>
                <text v-if="row.net" class="tis-amt tis-amt--row"><text class="tis-amt__cur">$</text>{{ row.net.int }}<text class="tis-amt__dec">{{ row.net.dec }}</text></text>
                <text v-else class="tis-amt tis-amt--row tis-amt--unknown">—</text>
                <!-- Each row opens its confirm step: a list entry, so a trailing chevron (03 §3.1). -->
                <svg class="tis-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </view>
            </view>
          </view>
        </view>
        <view class="tis-ft">
          <NxButton v-if="choiceView.single" variant="primary" :label="t.tradein.choiceSingleCta" :busy="quoteLoading" @click="onChooseTradein(choiceView.single.id)" />
          <NxButton class="tis-quiet" variant="text" :label="t.tradein.choiceFullPriceOption" :disabled="quoteLoading" @click="onChooseFullPrice" />
        </view>
      </template>

      <!-- ─────────── 1.5 retire — FEAT-DEV02 主动下架:选升级目标 ─────────── -->
      <!-- Shell rhythm (boards B-1…B-4): title, body blocks 16 apart, footer actions; the quiet exit is always last. -->
      <template v-else-if="state.kind === 'retire' && retireView">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ t.tradein.retireTitle }}</text></view>
        <view class="tis-bd">
          <view v-if="retireView.source" class="tis-lead">
            <view class="tis-source">
              <DeviceArt class="tis-source__art" :device="retireView.source" />
              <text class="tis-source__text">{{ retireView.subtitle }}</text>
            </view>
            <view class="tis-status" :class="`tis-status--${retireView.status.tone}`" role="status" :aria-busy="retireView.status.tone === 'loading'" v-if="retireView.status">
            <svg v-if="retireView.status.tone === 'loading'" class="tis-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".2" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            <svg v-else-if="retireView.status.tone === 'warn'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>
            <text class="tis-status__text">{{ retireView.status.text }}</text>
          </view>
          </view>
          <view class="tis-status" :class="`tis-status--${retireView.status.tone}`" role="status" :aria-busy="retireView.status.tone === 'loading'" v-else-if="retireView.status">
            <svg v-if="retireView.status.tone === 'loading'" class="tis-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".2" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            <svg v-else-if="retireView.status.tone === 'warn'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>
            <text class="tis-status__text">{{ retireView.status.text }}</text>
          </view>
          <!-- One target: the machine is the page's visual, and the action is a primary button (04 §4.0 项数少时换布局). -->
          <view v-if="retireSingle" class="tis-hero">
            <view class="tis-hero__stage"><view class="tis-hero__floor" /><CatalogMachineImage class="tis-hero__art" :sku="retireSingle.id" :image-url="retireSingle.imageUrl" scope-key="tradein-target" /></view>
            <text class="tis-hero__name">{{ retireSingle.name }}</text>
            <view class="tis-hero__sub"><text class="tis-target__price">{{ retireSingle.price }}</text><NxTag v-if="retireSingle.early" tone="brand">{{ t.tradein.retireEarlyTag }}</NxTag></view>
            <text class="tis-hero__label">{{ t.tradein.sheetNetCostLabel }}</text>
            <text v-if="retireSingle.net" class="tis-amt tis-amt--hero"><text class="tis-amt__cur">$</text>{{ retireSingle.net.int }}<text class="tis-amt__dec">{{ retireSingle.net.dec }}</text></text>
            <text v-else class="tis-amt tis-amt--hero tis-amt--unknown">—</text>
          </view>
          <view v-else-if="retireView.targets.length">
            <!-- Every row shows the same figure, so its name is written once above the column (03 §3.6.1). -->
            <text class="tis-col-label" aria-hidden="true">{{ t.tradein.sheetNetCostLabel }}</text>
            <view class="tis-list">
              <view v-for="p in retireView.targets" :key="p.id" class="tis-target" :class="{ 'tis-target--disabled': quoteLoading }" role="button" :tabindex="quoteLoading ? -1 : 0" :aria-disabled="quoteLoading" :aria-busy="quoteLoading" :aria-label="p.label" @click="onPickTarget(p.id)"  @keydown.enter.prevent="onKeyboardActivate($event, () => onPickTarget(p.id))" @keydown.space.prevent="onKeyboardActivate($event, () => onPickTarget(p.id))">
                <CatalogMachineImage class="tis-target__art" :sku="p.id" :image-url="p.imageUrl" scope-key="tradein-target" />
                <view class="tis-target__meta">
                  <text class="tis-target__name">{{ p.name }}</text>
                  <view class="tis-target__sub"><text class="tis-target__price">{{ p.price }}</text><NxTag v-if="p.early" tone="brand">{{ t.tradein.retireEarlyTag }}</NxTag></view>
                </view>
                <text v-if="p.net" class="tis-amt tis-amt--row"><text class="tis-amt__cur">$</text>{{ p.net.int }}<text class="tis-amt__dec">{{ p.net.dec }}</text></text>
                <text v-else class="tis-amt tis-amt--row tis-amt--unknown">—</text>
                <!-- Each target opens its confirm step: a list entry, so a trailing chevron (03 §3.1). -->
                <svg class="tis-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </view>
            </view>
          </view>
        </view>
        <view class="tis-ft">
          <NxButton v-if="retireSingle" variant="primary" :label="t.tradein.retireSingleCta" :busy="quoteLoading" @click="onPickTarget(retireSingle.id)" />
          <NxButton class="tis-quiet" variant="text" :label="t.tradein.sheetCancel" @click="hide" />
        </view>
      </template>

      <!-- ─────────── 2. tradein — 置换确认(去结算) ─────────── -->
      <!-- The original command could not be read yet: it is re-read automatically (03 §3.5.2), so only say so, no button.
           A readable original (pending) is a decision and opens the centred confirm below instead of this sheet. -->
      <template v-else-if="state.kind === 'tradein' && purchaseRecovery === 'error'">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ t.tradein.retireTitle }}</text></view>
        <view class="tis-bd">
          <view class="tis-status" role="status" aria-busy="true">
            <svg class="tis-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".2" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            <text class="tis-status__text">{{ t.tradein.recoveryReading }}</text>
          </view>
        </view>
        <view class="tis-ft"><NxButton class="tis-quiet" variant="text" :label="t.tradein.sheetCancel" @click="hide" /></view>
      </template>
      <!-- Eligibility not confirmed yet (PRD §7.5.3 F08): one small status, the in-place retry when the read failed, no quote. -->
      <template v-else-if="state.kind === 'tradein' && remoteApiEnabled && purchaseMessage === 'error'">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ t.tradein.retireTitle }}</text></view>
        <view class="tis-bd">
          <view class="tis-status-row">
            <view class="tis-status" :class="`tis-status--${(purchaseStatus === 'loading' || purchaseStatus === 'idle' ? 'loading' : 'warn')}`" role="status" :aria-busy="(purchaseStatus === 'loading' || purchaseStatus === 'idle' ? 'loading' : 'warn') === 'loading'">
            <svg v-if="(purchaseStatus === 'loading' || purchaseStatus === 'idle' ? 'loading' : 'warn') === 'loading'" class="tis-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".2" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            <svg v-else-if="(purchaseStatus === 'loading' || purchaseStatus === 'idle' ? 'loading' : 'warn') === 'warn'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>
            <text class="tis-status__text">{{ purchaseStatus === 'loading' || purchaseStatus === 'idle' ? t.store.purchaseEligibilityLoading : t.store.purchaseEligibilityError }}</text>
          </view>
            <view v-if="purchaseStatus === 'error' || purchaseStatus === 'ready'" class="nx-card-recovery-action nx-card-recovery-action--inline" role="button" tabindex="0" @click="onConfirmTradein" @keydown.enter.prevent="onKeyboardActivate($event, onConfirmTradein)" @keydown.space.prevent="onKeyboardActivate($event, onConfirmTradein)"><text>{{ t.store.purchaseEligibilityRetry }}</text></view>
          </view>
        </view>
        <view class="tis-ft"><NxButton class="tis-quiet" variant="text" :label="t.tradein.sheetCancel" @click="hide" /></view>
      </template>
      <template v-else-if="state.kind === 'tradein' && tradeinView">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ purchaseConfirmed ? t.tradein.retireTitle : t.tradein.purchaseBlockedTitle }}</text></view>
        <view class="tis-bd">
          <template v-if="purchaseConfirmed">
            <!-- Old machine → new machine: what is handed in and what arrives (board B-2). -->
            <view class="tis-pair" role="img" :aria-label="tradeinView.title">
              <view class="tis-pair__src" aria-hidden="true"><DeviceArt class="tis-pair__src-art" :device="tradeinView.oldDevice" /><text class="tis-pair__src-name">{{ tradeinView.oldName }}</text></view>
              <svg class="tis-pair__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
              <view class="tis-pair__dst" aria-hidden="true"><CatalogMachineImage class="tis-pair__dst-art" :sku="tradeinView.newKind" :image-url="tradeinView.newImageUrl" scope-key="tradein-target" /><text class="tis-pair__dst-name">{{ tradeinView.newName }}</text></view>
            </view>
            <view class="tis-due">
              <text class="tis-due__label">{{ t.tradein.sheetNetCostLabel }}</text>
              <text class="tis-amt tis-amt--hero"><text class="tis-amt__cur">$</text>{{ tradeinView.estNet.int }}<text class="tis-amt__dec">{{ tradeinView.estNet.dec }}</text></text>
            </view>
            <!-- The credit as a share of the target price, then the two amounts it is drawn from (03 §3.6 .nx-progress). -->
            <view class="tis-credit">
              <view class="nx-progress" role="progressbar" :aria-label="t.tradein.sheetCreditLabel" :aria-valuenow="tradeinView.creditPct ?? undefined" aria-valuemin="0" aria-valuemax="100"><view class="nx-progress__fill nx-viz-grow" :style="{ width: `${tradeinView.creditPct ?? 0}%` }" /></view>
              <view class="tis-credit__row">
                <view><text class="tis-credit__label">{{ t.tradein.sheetCreditLabel }}</text><text class="tis-credit__value tis-credit__value--brand">−${{ tradeinView.credit }}</text></view>
                <view class="tis-credit__end"><text class="tis-credit__label">{{ t.tradein.sheetTargetPriceLabel }}</text><text class="tis-credit__value">${{ tradeinView.targetPrice }}</text></view>
              </view>
            </view>
            <!-- What the credit is based on; the rule behind it sits in the hint bubble (03 §3.5.1). -->
            <view class="tis-basis">
              <text class="tis-basis__text"><text v-for="(part, index) in tradeinView.basis" :key="index" :class="{ 'tis-num': part.value }">{{ part.text }}</text></text>
              <NxHintBubble v-model:open="basisTipOpen" :text="t.tradein.basisTip" />
            </view>
          </template>
          <PurchaseEligibilityPanel v-if="remoteApiEnabled && purchaseBlocked" class="tis-purchase" :status="purchaseStatus" :snapshot="purchaseSnapshot" blocking-only />
        </view>
        <view class="tis-ft">
          <view v-if="purchaseConfirmed && (tradeinView.taskVoid || tradeinView.fundsGap)" class="tis-hints">
            <view v-if="tradeinView.taskVoid" class="tis-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
              <text class="tis-hint__text">{{ t.tradein.sheetTaskVoidHint }}</text>
            </view>
            <view v-if="tradeinView.fundsGap" class="tis-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3" /><path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" /><path d="M21 12h-4a2 2 0 0 0 0 4h4" /></svg>
              <text class="tis-hint__text"><text v-for="(part, index) in tradeinView.fundsGap" :key="index" :class="{ 'tis-num': part.value }">{{ part.text }}</text></text>
            </view>
          </view>
          <NxButton variant="primary" :label="confirmActionText" :disabled="purchaseActionDisabled" :busy="purchaseActionBusy" @click="onConfirmTradein" />
          <NxButton class="tis-quiet" variant="text" :label="t.tradein.sheetCancel" @click="hide" />
        </view>
      </template>

      <!-- ─────────── 3. replace — slot full: the new machine, what it costs, and which device steps down (boards B-6a, B-6b) ─────────── -->
      <template v-else-if="state.kind === 'replace' && replaceView">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ t.tradein.replaceTitle }}</text></view>
        <view class="tis-bd">
          <view class="tis-arrive">
            <view class="tis-arrive__stage"><view class="tis-arrive__floor" /><CatalogMachineImage class="tis-arrive__art" :sku="replaceView.newKind" :image-url="replaceView.newImageUrl" scope-key="tradein-target" /></view>
            <text class="tis-hero__name">{{ replaceView.newName }}</text>
          </view>
          <view class="tis-due">
            <text class="tis-due__label">{{ t.tradein.sheetNetCostLabel }}</text>
            <text class="tis-amt tis-amt--hero"><text class="tis-amt__cur">$</text>{{ replaceView.due.int }}<text class="tis-amt__dec">{{ replaceView.due.dec }}</text></text>
          </view>
          <!-- The device that steps down moves to the warehouse; it is not taken back (PRD §7.5.3), so no old → new arrow. -->
          <view class="tis-yield">
            <DeviceArt v-if="replaceView.source.device" class="tis-yield__art" :device="replaceView.source.device" />
            <text class="tis-yield__name">{{ replaceView.source.line }}</text>
            <view v-if="replaceView.source.online" class="tis-online"><view class="tis-online__dot" aria-hidden="true" /><text>{{ t.earn.online }}</text></view>
          </view>
        </view>
        <view class="tis-ft">
          <view class="tis-hints">
            <view v-if="replaceView.fundsGap" class="tis-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3" /><path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" /><path d="M21 12h-4a2 2 0 0 0 0 4h4" /></svg>
              <text class="tis-hint__text"><text v-for="(part, index) in replaceView.fundsGap" :key="index" :class="{ 'tis-num': part.value }">{{ part.text }}</text></text>
            </view>
            <view class="tis-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
              <text class="tis-hint__text">{{ t.tradein.replaceTaskHint }}</text>
            </view>
          </view>
          <NxButton variant="primary" :label="replaceView.replaceCta" :disabled="replaceView.insufficient" :busy="confirming" @click="onReplace" />
          <NxButton
            v-if="!remoteApiEnabled || (state.kind === 'replace' && state.canonicalCapacityQuote?.decision === 'CAPACITY_AVAILABLE')"
            class="tis-second" variant="secondary" :label="replaceView.keepCta" :disabled="replaceView.insufficient" :busy="confirming" @click="onKeepBuy" />
          <NxButton class="tis-quiet" variant="text" :label="t.tradein.replaceCancel" @click="hide" />
        </view>
      </template>

      <!-- 空态兜底:kind 已定但对应 view 为 null(设备/目标在弹层开着时消失,
           PR-D 债 #1)。置于全部具体分支之后、block 之前,只接住 view-null 漏网。 -->
      <template v-else-if="state.kind === 'retire' || state.kind === 'tradein' || state.kind === 'replace'">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ t.tradein.errReplaceUnavailable }}</text></view>
        <view class="tis-ft"><NxButton class="tis-quiet" variant="text" :label="t.tradein.sheetCancel" @click="hide" /></view>
      </template>

      <!-- ─────────── 4. block — the old device is running a job (boards B-7a, B-7b; not reachable in the remote build) ─────────── -->
      <template v-else-if="state.kind === 'block' && blockView">
        <view class="tis-hd"><text :id="titleId" class="tis-title">{{ blockTitle }}</text></view>
        <view class="tis-bd">
          <view class="tis-job">
            <DeviceArt v-if="blockView.device" class="tis-job__art" :device="blockView.device" />
            <view class="tis-job__meta">
              <view class="tis-job__head"><text class="tis-job__name">{{ blockView.name }}</text><text class="tis-job__pct">{{ blockView.pctText }}</text></view>
              <text class="tis-job__sub">{{ t.earn.currentTask }} · {{ blockView.taskType }}</text>
              <view class="nx-progress tis-job__bar" role="progressbar" :aria-label="t.earn.currentTask" :aria-valuenow="blockView.pct ?? undefined" aria-valuemin="0" aria-valuemax="100"><view class="nx-progress__fill nx-viz-grow" :style="{ width: `${blockView.pct ?? 0}%` }" /></view>
            </view>
          </view>
          <!-- retire 阻断:等作业完成即可置换(无 force,规格 DEV02A 异常2) -->
          <view v-if="state.origin === 'retire'" class="tis-status" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>
            <text class="tis-status__text">{{ t.tradein.retireBlockWarning }}</text>
          </view>
        </view>
        <view class="tis-ft">
          <template v-if="state.origin === 'retire'">
            <NxButton variant="primary" :label="t.tradein.retireBlockViewTask" @click="onGoTasks" />
            <NxButton class="tis-quiet" variant="text" :label="t.ui.close" @click="hide" />
          </template>
          <!-- The two buttons already state the choice; forcing is the destructive one, neutral glass with error text (03 §3.1). -->
          <template v-else>
            <NxButton variant="primary" :label="t.tradein.blockWaitCta" @click="onWait" />
            <NxButton class="tis-second tis-danger" variant="secondary" :label="t.tradein.blockForceCta" :busy="confirming" @click="onForce" />
          </template>
        </view>
      </template>
    </view>
  </view>
  <!-- The last trade-in's payment result is not confirmed: continuing it is a 决定 (03 §3.5.1), so a centred confirm with the
       device pair and the amount still due, the same anatomy as the capacity resume below. Back / Esc take 稍后再说. -->
  <NxNoticeDialog :open="recoveryNoticeOpen" icon="clock" tone="warning" :title="t.tradein.recoveryPending"
    :primary="purchaseActionText" :secondary="t.tradein.recoveryLater" @primary="onConfirmTradein" @secondary="hide">
    <view v-if="recoveryNotice" class="tis-dlg-pair" role="img" :aria-label="recoveryNotice.pairLabel">
      <view class="tis-dlg-pair__side" aria-hidden="true"><DeviceArt class="tis-dlg-pair__art tis-dlg-pair__art--src" :device="recoveryNotice.oldDevice" /><text class="tis-dlg-pair__name">{{ recoveryNotice.oldName }}</text></view>
      <svg class="tis-dlg-pair__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
      <view class="tis-dlg-pair__side" aria-hidden="true"><CatalogMachineImage class="tis-dlg-pair__art" :sku="recoveryNotice.newKind" :image-url="recoveryNotice.newImageUrl" scope-key="tradein-target" /><text class="tis-dlg-pair__name tis-dlg-pair__name--dst">{{ recoveryNotice.newName }}</text></view>
    </view>
    <view v-if="recoveryNotice" class="tis-dlg-due">
      <text class="tis-dlg-due__label">{{ t.tradein.recoveryDueLabel }}</text>
      <text v-if="recoveryNotice.due" class="tis-dlg-due__amount">{{ recoveryNotice.due.int }}<text class="tis-amt__dec">{{ recoveryNotice.due.dec }}</text><text class="tis-dlg-due__unit">USDT</text></text>
      <text v-else class="tis-dlg-due__amount tis-amt--unknown">—</text>
    </view>
  </NxNoticeDialog>
  <!-- Resuming the original payment is a 决定 (03 §3.5.1): a centred confirm, one solid action, a text exit, no close glyph.
       Back / Esc take the text exit; while the original command is being read the action shows busy at full ink and the
       exits stay live, since that step only reads (03 §3.5.2). The machine and the amount still due stand on their own lines (board B-6c).
       It steps aside while the payment layer it opened is up (that layer sits below z 960), and returns if the user backs out of it. -->
  <NxNoticeDialog :open="capacitySheetOpen && !!capacityOriginal && !payment.state.open" icon="clock" tone="warning"
    :title="capacityRecovery?.operation === 'replace' ? t.tradein.recoveryUnpaid : t.tradein.keepRecoveryUnpaid"
    :primary="recoveryCopy.resume" :secondary="t.tradein.recoveryLater" :busy="capacityResumeBusy" secondary-while-busy
    @primary="resumeCapacityCommand" @secondary="hide">
    <view v-if="capacityNotice" class="tis-dlg-machine">
      <CatalogMachineImage class="tis-dlg-machine__art" :sku="capacityNotice.target" :image-url="capacityNotice.imageUrl" scope-key="tradein-target" />
      <text class="tis-dlg-machine__name">{{ capacityNotice.name }}</text>
    </view>
    <view v-if="capacityNotice" class="tis-dlg-due">
      <text class="tis-dlg-due__label">{{ t.tradein.recoveryDueLabel }}</text>
      <text class="tis-dlg-due__amount">{{ capacityNotice.due.int }}<text class="tis-amt__dec">{{ capacityNotice.due.dec }}</text><text class="tis-dlg-due__unit">USDT</text></text>
    </view>
  </NxNoticeDialog>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { onHide, onShow } from "@/composables/use-tab-page-lifecycle";
import { runPassiveTabRead, invalidatePassiveTabRead } from "@/lib/passive-tab-read";
import { formatGroupedAmount } from "@/lib/amount-display";
import { computed, getCurrentInstance, inject, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import NxNoticeDialog from "@/components/ui/nx-notice-dialog.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxHintBubble from "@/components/ui/nx-hint-bubble.vue";
import DeviceArt from "@/components/device-art.vue";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import { capacityCheckoutHref, checkoutCapacityUnreadableTargetKey, describeCapacityOriginal, reportCheckoutKeepResumeKey, type CheckoutCapacityPaymentRow, type CheckoutKeepResume } from "@/components/checkout/checkout-keep-resume";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { useApp } from "@/store/app";
import { postMoneyBill, reportStuckFunds } from "@/lib/money-receipt";
import { usePendingCheckout } from "@/store/pending-checkout";
import { trialReservesSlotNow } from "@/store/free-trial";
import { toast } from "@/store/ui";
import { getProduct, PRODUCTS } from "@/mock/products";
import { DEVICE_SPECS, createDevice } from "@/store/device-types";
import { computeTradeInCredit, ladderBandFor, TRADEIN_LADDER_RULES } from "@/mock/tradein-config";
import { isDeviceTaskBlocked } from "@/mock/eligibility";
import { getMonthsSince, isPhaseReached, isTradeInTargetAvailable } from "@/store/product-phase";
import { useProductPhase } from "@/composables/use-product-phase";
import { navReset, navTo } from "@/lib/route";
import type { DeviceKind, Device } from "@/store/types";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { deviceName, deviceNameByKind } from "@/lib/device-copy";
import { fmt } from "@/i18n/format";
import { apiClient, apiRuntimeConfig, deviceE3Api, orderApi, purchaseEligibilityApi, remoteApiEnabled } from "@/api/runtime";
import type { PurchaseEligibilitySnapshot } from "@/api/purchase-eligibility-api";
import { resolvePurchaseEligibilityMessage } from "@/lib/purchase-eligibility-copy";
import PurchaseEligibilityPanel from "@/components/store/purchase-eligibility-panel.vue";
import LiquidGlass from "@/components/liquid-glass.vue";
import type { CanonicalCapacityReplaceQuote, CanonicalTradeinConfig, CanonicalTradeinQuote } from "@/api/device-e3-api";
import { productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { isProductAvailable } from "@/store/product-availability";
import { useOrders } from "@/store/orders";
import { completeVerifiedMutation } from "@/domain/e20-capacity-coordinator";
import { executeSelectedPurchase } from "@/lib/selected-purchase-payment";
import { onPurchaseRecordReleased, readCheckoutCapacityPayment, refusedPurchasePayment, resumeCheckoutCapacityPayment, usePurchasePayment } from "@/store/purchase-payment";
import { purchasePrincipalUsdt } from "@/api/device-e3-api";
import { readPaymentCommand } from "@/api/payment-command-api";
import { parseCanonicalTradeinResult,parseCanonicalCapacityKeepResult,type CanonicalTradeinResult,type CanonicalCapacityKeepResult } from "@/api/device-e3-api";
import { purchaseRecoveryCopy } from "@/lib/purchase-recovery-copy";
import { checkoutFlowCopy } from "@/lib/checkout-flow-copy";
import { CAPACITY_REPLACEMENT_PURCHASE_RETIRED, tradeinPaymentRejection, tradeinRejectionKey, TRADEIN_RUNTIME_RECOVERING } from "@/lib/order-payment-rejection";
import { asApiError, isApiRefusal } from "@/api/errors";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { releaseAccountCommandKey, readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";
import { readCheckoutTradein } from "@/lib/checkout-order-recovery";
import { CAPACITY_RECOVERY_TABLE, capacityIntent, capacityPaymentKind, readCapacityPending, type CapacityPending } from '@/lib/capacity-command-recovery';
import { releasePurchaseCallerRecord } from '@/lib/purchase-caller-record';
import { CAPACITY_COMMAND_TABLE, type PendingKeepCommand } from "@/lib/keep-command-recovery";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { deviceOnlineState } from "@/lib/hashpower";
import { taskProgressPercent } from "@/lib/task-progress";

const props = withDefaults(defineProps<{ active?: boolean; checkoutCapacityTarget?: string | null }>(), { active: true });
const emit = defineEmits<{ (event: "checkout-capacity-cleared", target: string): void }>();
// Each step renders exactly one .tis-title; the dialog takes its accessible name from whichever one is on screen.
const titleId = `tis-title-${getCurrentInstance()?.uid}`;
const sheet = useTradeinSheet();
const app = useApp();
const pending = usePendingCheckout();
const orders = useOrders();
const t = useT();
const locale = useLocaleStore();
const recoveryCopy = computed(()=>purchaseRecoveryCopy(locale.code));
// 上架节奏门(FEAT-DEV02b):置换目标必须已正式上架,或处于抢先购窗口(开关默认关)。
const phase = useProductPhase();
const monthsSinceJoin = computed(() => getMonthsSince(app.user.joinedAt));

const state = computed(() => sheet.state);
const reservedSlots = computed(() => (trialReservesSlotNow() ? 1 : 0));

// Double-tap guard shared across composers — handlers run synchronously; flips
// at entry and resets on early returns / before navigation. Without this, two
// rapid taps on a slow device could fire a composer twice before the device
// array mutation propagates → double-bill / double-debit (Batch C R1 P0 #5).
const confirming = ref(false);
const canonicalQuote = ref<CanonicalTradeinQuote | null>(null);
const canonicalQuoteOrigin = ref<{ environment: string; baseUrl: string } | null>(null);
const canonicalTradeinConfig = ref<CanonicalTradeinConfig | null>(null);
const canonicalTradeinConfigStatus = ref<"loading" | "ready" | "error">("loading");
const remoteRetireEligibleTargets = ref<Set<string>>(new Set());
// Server-quoted payable per eligible retire target (PRD §7.5.3: each row shows its post-credit price).
const remoteRetirePayables = ref<Map<string, number>>(new Map());
const remoteRetirePending = ref(false);
const remoteRetireLoadError = ref(false);
const remoteRetireOrigin = ref<{ environment: string; baseUrl: string } | null>(null);
const savedCapacity = ref<CapacityPending|null>(null);
const capacityRefusal = computed(() => savedCapacity.value && refusedPurchasePayment(app.accountKey, savedCapacity.value.key));
const capacityRecovery = computed(() => capacityRefusal.value ? null : savedCapacity.value);
const capacityOriginal = computed(() => capacityRecovery.value && describeCapacityOriginal(capacityRecovery.value, t.value));
const payment = usePurchasePayment();
const viewingCheckoutCapacityPayment = computed(() => {
  const original = capacityRecovery.value;
  const { open, accountKey, pending } = payment.state;
  return !!props.checkoutCapacityTarget && !!original && open && accountKey === app.accountKey
    && pending?.commandKey === original.key && pending.kind === capacityPaymentKind(original.operation);
});
const capacityRecoveryBusy = ref(false);
const capacityReadBusy = ref(false);
const capacityPageShown = ref(true);
let capacityRecoveryGeneration = 0;
let checkoutCapacityRead: { accountKey: string; target: string; at: number } | undefined;
const capacityResumeKey = ref<string | null>(null);
const capacityResumeAllowed = computed(() => capacityResumeKey.value !== null && capacityRecovery.value?.key === capacityResumeKey.value);
const capacitySheetOpen = computed(() => state.value.kind === "keep-recovery" && props.active
  && capacityPageShown.value && foregroundReadAllowed() && capacityResumeAllowed.value
  && !!props.checkoutCapacityTarget && state.value.targetKind === props.checkoutCapacityTarget
  && capacityOriginal.value?.target === props.checkoutCapacityTarget);
watch(capacitySheetOpen, (open, wasOpen) => {
  if (wasOpen && !open && state.value.kind === "keep-recovery") hide();
}, { flush: "sync" });
// recoverCapacityPurchase ignores a tap while either read is running, so the button shows busy for both.
const capacityResumeBusy = computed(() => capacityRecoveryBusy.value || capacityReadBusy.value);
const capacityIntentResume = ref<{ commandKey: string; intentNo: string; cutoff: number | null } | null>(null);
watch(capacityIntentResume, (resume, _previous, cleanup) => {
  if (resume?.cutoff == null || !Number.isFinite(resume.cutoff)) return;
  const timer = setTimeout(() => { capacityIntentResume.value = null; }, Math.max(0, resume.cutoff - Date.now()));
  cleanup(() => clearTimeout(timer));
});
const reportCheckoutKeepResume = inject(reportCheckoutKeepResumeKey, null);
const capacityUnreadableTarget = inject(checkoutCapacityUnreadableTargetKey, null);
function reportUnreadableCapacity(target: string | null) {
  if (capacityUnreadableTarget) capacityUnreadableTarget.value = target;
}
function invalidateCapacityRecovery() {
  capacityRecoveryGeneration++;
  capacityResumeKey.value = null;
  capacityIntentResume.value = null;
}
onShow(() => { capacityPageShown.value=true; });
onHide(() => { capacityPageShown.value=false; invalidateCapacityRecovery(); });
const stopCapacityRelease = onPurchaseRecordReleased((accountKey, key) => {
  if (accountKey !== app.accountKey || savedCapacity.value?.key !== key) return;
  savedCapacity.value = null;
  capacityResumeKey.value = null;
  capacityIntentResume.value = null;
});
onUnmounted(() => { invalidateCapacityRecovery(); reportCheckoutKeepResume?.(null); stopCapacityRelease(); });
// The checkout visit owns the permission for this original key across sheet dismissal.
watch([()=>app.accountKey,()=>app.accountBindingEpoch,()=>props.active,
  ()=>props.checkoutCapacityTarget,()=>apiRuntimeConfig.environment,()=>apiRuntimeConfig.baseUrl,
  ()=>!props.checkoutCapacityTarget || foregroundReadAllowed()], invalidateCapacityRecovery, {flush:'sync'});
watch([()=>app.accountKey,()=>app.accountBindingEpoch,()=>props.checkoutCapacityTarget,
  ()=>apiRuntimeConfig.environment,()=>apiRuntimeConfig.baseUrl], () => {
  const target = props.checkoutCapacityTarget;
  reportUnreadableCapacity(null);
  try {
    savedCapacity.value = remoteApiEnabled && target ? readCapacityPending(app.accountKey, target) : null;
  } catch {
    savedCapacity.value = null;
    reportUnreadableCapacity(target ?? null);
  }
}, {immediate:true,flush:'sync'});
if (reportCheckoutKeepResume) {
  watch((): CheckoutKeepResume | null => {
    const target = props.checkoutCapacityTarget;
    const pending = capacityRecovery.value;
    if (!target || !props.active || !capacityPageShown.value || !foregroundReadAllowed() || !pending) return null;
    if (capacityOriginal.value?.target !== target) return null;
    const identity = { target, commandKey: pending.key, operation: pending.operation };
    const intent = capacityIntentResume.value;
    if (intent?.commandKey === pending.key) return { ...identity, kind: "intent", open: () => openCapacityIntent(target) };
    return capacityResumeAllowed.value ? { ...identity, kind: "command" } : null;
  }, reportCheckoutKeepResume, { flush: "sync" });
}
useAutoRecovery({
  failed: () => remoteApiEnabled && !!props.checkoutCapacityTarget && props.active && capacityPageShown.value
    && !capacityReadBusy.value && !capacityRecoveryBusy.value && !confirming.value
    && !capacityResumeAllowed.value && !viewingCheckoutCapacityPayment.value,
  retry: () => recoverCapacityPurchase(false),
  // Reopening the browser tab must not restart the original payment lookup.
  retryNotBefore: () => checkoutCapacityRead?.target === props.checkoutCapacityTarget
    && checkoutCapacityRead?.accountKey === app.accountKey ? checkoutCapacityRead.at + 30_000 : 0,
  repeatMs: 15_000,
});
const quoteRequestGeneration = ref(0);
const quoteLoading = ref(false);
const retireTargetRead = ref<{ sourceId: string; targetKind: DeviceKind; price: number } | null>(null);
useAutoRecovery({
  active: () => props.active && state.value.kind === "retire",
  failed: () => retireTargetRead.value !== null,
  retry: async () => {
    const target = retireTargetRead.value;
    if (!target) return;
    const device = app.devices.find(row => row.id === target.sourceId);
    if (device) await openTradeinQuote(device, target.targetKind, target.price);
  },
  repeatMs: 30_000,
});
const purchaseSnapshot = ref<PurchaseEligibilitySnapshot | null>(null);
// One opening request is handed to the confirmation watcher once; retries and checkout always read again.
let purchaseOpeningRead: {
  account: ReturnType<typeof captureAccountScope>;
  oldDeviceId: string;
  sourceRowVersion: Device["rowVersion"];
  target: DeviceKind;
  origin: { environment: string; baseUrl: string };
  result: Promise<PurchaseEligibilitySnapshot | null>;
} | null = null;
const purchaseStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const purchaseReadFailed = ref(false);
const purchaseRecovery = ref<"none" | "pending" | "error">("none");
let purchaseReadGeneration = 0;
let purchaseSheetEpoch = 0;
let purchaseMounted = true;
let purchaseReturn: {
  account: ReturnType<typeof captureAccountScope>;
  accountKey: string;
  accountEpoch: number;
  oldDeviceId: string;
  newKind: DeviceKind;
  newPrice: number;
  quote: CanonicalTradeinQuote;
  origin: { environment: string; baseUrl: string };
} | null = null;
const purchaseScopeKey = computed(() => {
  const current = state.value;
  if (!props.active || current.kind !== "tradein") return "";
  const source = app.devices.find(device => device.id === current.oldDeviceId);
  const quote = canonicalQuote.value;
  const origin = canonicalQuoteOrigin.value;
  if (!source || !quote || !origin || origin.environment !== apiRuntimeConfig.environment || origin.baseUrl !== apiRuntimeConfig.baseUrl
      || quote.sourceDeviceId !== Number(source.id)
      || quote.targetProductNo !== current.newKind || quote.sourceRowVersion !== source.rowVersion) return "";
  return JSON.stringify([app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl, source.id, source.rowVersion,
    current.newKind, quote.targetDeviceStatus, quote.payableUsdt, quote.discountUsdt]);
});
const purchaseMessage = computed(() => resolvePurchaseEligibilityMessage(purchaseStatus.value, purchaseSnapshot.value));
const purchaseBlocked = computed(() => remoteApiEnabled && (purchaseMessage.value === "ineligible" || purchaseMessage.value === "quotaDepleted"));
const purchaseConfirmed = computed(() => !remoteApiEnabled || purchaseMessage.value === "eligible");
const purchaseActionBusy = computed(() => confirming.value || remoteApiEnabled && (purchaseStatus.value === "loading" || !props.active));
const purchaseActionDisabled = computed(() => purchaseActionBusy.value || remoteApiEnabled && purchaseMessage.value === "quotaDepleted");
const purchaseActionText = computed(() => purchaseRecovery.value === "pending" ? t.value.tradein.purchaseResume
  : !remoteApiEnabled || purchaseMessage.value === "eligible"
  ? tradeinView.value?.ctaText ?? ""
  : purchaseStatus.value === "loading" || purchaseStatus.value === "idle" ? t.value.store.purchaseEligibilityLoading
  : purchaseMessage.value === "ineligible" ? t.value.tradein.purchaseViewConditions
  : purchaseMessage.value === "quotaDepleted" ? t.value.tradein.purchaseQuotaDepleted : t.value.store.purchaseEligibilityRetry);

function readTradeinRecovery(): "none" | "pending" | "error" {
  const current = state.value;
  purchaseRecovery.value = "none";
  if (!remoteApiEnabled || current.kind !== "tradein" || !props.active) return "none";
  try {
    purchaseRecovery.value = readCheckoutTradein(app.accountKey, current.newKind) ? "pending" : "none";
  } catch {
    purchaseRecovery.value = "error";
  }
  return purchaseRecovery.value;
}

useAutoRecovery({
  active: () => props.active && state.value.kind === "tradein",
  failed: () => purchaseRecovery.value === "error"
    || (purchaseRecovery.value === "none" && purchaseReadFailed.value && purchaseStatus.value === "error"),
  retry: refreshTradeinPurchaseEligibility,
  repeatMs: 30_000,
});
async function refreshTradeinPurchaseEligibility(recovery = readTradeinRecovery()): Promise<boolean> {
  if (recovery !== "none" || !remoteApiEnabled || !purchaseMounted) return false;
  const key = purchaseScopeKey.value;
  if (!key) {
    purchaseStatus.value = "error";
    return false;
  }
  const request = ++purchaseReadGeneration;
  const account = captureAccountScope();
  const origin = { ...apiRuntimeConfig };
  const target = state.value.kind === "tradein" ? state.value.newKind : "";
  const current = () => purchaseMounted && props.active && request === purchaseReadGeneration
    && purchaseRecovery.value === "none" && key === purchaseScopeKey.value && isCurrentAccountScope(account)
    && origin.environment === apiRuntimeConfig.environment && origin.baseUrl === apiRuntimeConfig.baseUrl;
  purchaseReadFailed.value = false;
  purchaseStatus.value = "loading";
  purchaseSnapshot.value = null;
  const opening = purchaseOpeningRead;
  purchaseOpeningRead = null;
  try {
    const sheetState = state.value;
    const source = sheetState.kind === "tradein"
      ? app.devices.find(device => device.id === sheetState.oldDeviceId) : null;
    const snapshot = await (opening && opening.target === target && opening.oldDeviceId === source?.id
      && opening.sourceRowVersion === source.rowVersion && isCurrentAccountScope(opening.account)
      && opening.origin.environment === apiRuntimeConfig.environment && opening.origin.baseUrl === apiRuntimeConfig.baseUrl
      ? opening.result : purchaseEligibilityApi.get(target));
    if (!current()) return false;
    if (!snapshot) throw new Error("PURCHASE_ELIGIBILITY_UNAVAILABLE");
    purchaseSnapshot.value = snapshot;
    purchaseStatus.value = "ready";
    return resolvePurchaseEligibilityMessage("ready", snapshot) === "eligible";
  } catch {
    if (current()) { purchaseReadFailed.value = true; purchaseStatus.value = "error"; }
    return false;
  } finally {
    if (purchaseMounted && request === purchaseReadGeneration
        && (origin.environment !== apiRuntimeConfig.environment || origin.baseUrl !== apiRuntimeConfig.baseUrl)) {
      purchaseSnapshot.value = null;
      purchaseStatus.value = "error";
    }
  }
}
watch([purchaseScopeKey, state, () => app.accountKey, () => app.accountBindingEpoch, () => props.active,
  () => state.value.kind === "tradein" ? `${state.value.oldDeviceId}|${state.value.newKind}` : ""], () => {
  purchaseSheetEpoch++;
  purchaseReadGeneration++;
  purchaseSnapshot.value = null;
  purchaseStatus.value = "idle";
  purchaseReadFailed.value = false;
  confirming.value = false;
  if (readTradeinRecovery() !== "none") { purchaseOpeningRead = null; return; }
  if (remoteApiEnabled && props.active && state.value.kind === "tradein") {
    void refreshTradeinPurchaseEligibility("none");
  } else purchaseOpeningRead = null;
}, { flush: "sync" });
function restoreTradeinAfterConditions(): void {
  const pendingReturn = purchaseReturn;
  purchaseReturn = null;
  if (!pendingReturn || !props.active || state.value.kind !== "none"
      || app.accountKey !== pendingReturn.accountKey || app.accountBindingEpoch !== pendingReturn.accountEpoch
      || pendingReturn.origin.environment !== apiRuntimeConfig.environment || pendingReturn.origin.baseUrl !== apiRuntimeConfig.baseUrl
      || !isCurrentAccountScope(pendingReturn.account)) return;
  const source = app.devices.find(device => device.id === pendingReturn.oldDeviceId);
  if (!source || source.rowVersion !== pendingReturn.quote.sourceRowVersion) return;
  if (handleOriginalCapacityPurchase(pendingReturn.newKind)) return;
  canonicalQuoteOrigin.value = pendingReturn.origin;
  canonicalQuote.value = pendingReturn.quote;
  sheet.showTradein(pendingReturn.oldDeviceId, pendingReturn.newKind, pendingReturn.newPrice);
}
watch(() => props.active, active => { if (active) restoreTradeinAfterConditions(); }, { flush: "sync" });
onUnmounted(() => { capacityPageShown.value=false;capacityRecoveryGeneration++;purchaseMounted = false; purchaseReadGeneration++; purchaseSheetEpoch++; purchaseReturn = null; purchaseOpeningRead = null; });
function navigateTradeinCheckout(targetId: string): void {
  hide();
  const closedState = state.value;
  const navigationAccount = captureAccountScope();
  const cur = (getCurrentPages().slice(-1)[0] as { route?: string } | undefined)?.route ?? "";
  if (!cur.includes("store/checkout")) {
    setTimeout(() => {
      if (purchaseMounted && props.active && state.value === closedState && isCurrentAccountScope(navigationAccount)) {
        void navTo(`/pages/store/checkout?product=${encodeURIComponent(targetId)}`);
      }
    }, 260);
  }
}
let remoteRetireRequest = 0;
watch([state, () => props.active, () => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl, () => {
  const current = state.value;
  const ids = current.kind === "choice" ? current.tradeInSources
    : "oldDeviceId" in current ? [current.oldDeviceId] : [];
  return ids.map(id => `${id}:${app.devices.find(device => device.id === id)?.rowVersion}`).join("|");
}], () => {
  quoteRequestGeneration.value++;
  quoteLoading.value = false;
  retireTargetRead.value = null;
}, { flush: "sync" });
watch([() => app.accountKey, () => app.accountBindingEpoch], () => {
  quoteRequestGeneration.value += 1;
  canonicalQuote.value = null;
  canonicalQuoteOrigin.value = null;
  canonicalTradeinConfig.value = null;
  canonicalTradeinConfigStatus.value = "loading";
  remoteRetireEligibleTargets.value = new Set();
  remoteRetirePayables.value = new Map();
  remoteRetireRequest += 1;
  quoteLoading.value = false;
  retireTargetRead.value = null;
  // app.bindAccount is followed by the global account rebind in the same stack.
  void nextTick(() => loadCanonicalTradeinConfig());
}, { flush: "sync" });
watch([() => apiRuntimeConfig.environment, () => apiRuntimeConfig.baseUrl], () => {
  canonicalQuote.value = null;
  canonicalQuoteOrigin.value = null;
  purchaseOpeningRead = null;
  purchaseReturn = null;
  canonicalTradeinConfig.value = null;
  canonicalTradeinConfigStatus.value = "loading";
  void nextTick(() => loadCanonicalTradeinConfig());
}, { flush: "sync" });
let canonicalTradeinConfigRead: { key: string; result: Promise<void> } | null = null;
function canonicalTradeinConfigScope(): string {
  return JSON.stringify([captureAccountScope(), app.accountKey, app.accountBindingEpoch,
    apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl]);
}
function loadCanonicalTradeinConfig(retry = false): Promise<void> {
  if (!remoteApiEnabled || !purchaseMounted) return Promise.resolve();
  const key = canonicalTradeinConfigScope();
  if (canonicalTradeinConfigRead?.key === key) return canonicalTradeinConfigRead.result;
  if (retry) invalidatePassiveTabRead("tradein-config");
  const requestScope = captureAccountScope();
  // Read-only POSTs can advance the passive write revision; they do not change this config's owner.
  const current = () => purchaseMounted && key === canonicalTradeinConfigScope() && isCurrentAccountScope(requestScope);
  canonicalTradeinConfigStatus.value = "loading";
  const result = runPassiveTabRead("tradein-config", () => deviceE3Api.tradeinConfig()).then((value) => {
    if (current()) { canonicalTradeinConfigStatus.value = "ready"; canonicalTradeinConfig.value = value; }
  }).catch(() => {
    if (current()) { canonicalTradeinConfig.value = null; canonicalTradeinConfigStatus.value = "error"; }
  }).finally(() => {
    if (canonicalTradeinConfigRead?.result === result) canonicalTradeinConfigRead = null;
  });
  canonicalTradeinConfigRead = { key, result };
  return result;
}
onMounted(() => {
  void loadCanonicalTradeinConfig();
});

// ───────────────────────── helpers ─────────────────────────

/** Product catalog label for any DeviceKind. `phone` isn't in the store catalog
 *  (user-owned hardware), so fall back to the device spec name, then the raw
 *  kind — never a bare literal, never a missing i18n key. */
function kindLabel(kind: DeviceKind): string {
  // SKU name first (brand mark). Kinds with no store listing — phone, pc-gpu —
  // fall back to the localized device name, not the English DEVICE_SPECS one:
  // the user's own phone can be the traded-in / replaced device here.
  return getProduct(kind)?.name ?? deviceNameByKind(t.value, kind, DEVICE_SPECS[kind]?.name ?? kind);
}

/** FEAT-DEV02 预览抵扣(阶梯)。真值 server-authoritative;与结算持久块同一算法。 */
function previewCredit(oldDevice: Device, targetPriceUsdt: number): number {
  return computeTradeInCredit(
    oldDevice.paidPriceUsdt ?? 0,
    Math.max(0, oldDevice.cumulativeEarningsUsdt ?? 0),
    targetPriceUsdt,
  );
}

function hide() {
  purchaseReturn = null;
  quoteRequestGeneration.value += 1;
  quoteLoading.value = false;
  sheet.hide();
}

function onKeyboardActivate(event: KeyboardEvent, action: () => void) {
  if (event.repeat) return;
  action();
}

// ── deferred route past the sheet's exit so it doesn't flash on /me/devices ──
function goDevices() {
  setTimeout(() => {
    navReset({ url: "/pages/me/devices", fail: () => {} });
  }, 260);
}

// ───────────────────────── 1. choice ─────────────────────────

const choiceSources = computed(() => {
  const current = state.value;
  return current.kind === "choice" ? current.tradeInSources
    .map(id => app.devices.find(device => device.id === id))
    .filter((device): device is Device => !!device && (!remoteApiEnabled || device.paidPriceUsdt > 0)) : [];
});
const choiceReadKey = computed(() => {
  const current = state.value;
  if (!remoteApiEnabled || !props.active || current.kind !== "choice") return null;
  return JSON.stringify([app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl,
    current.targetKind, choiceSources.value.map(device => [device.id, device.rowVersion])]);
});
const choiceQuotes = ref(new Map<string, Pick<CanonicalTradeinQuote, "discountUsdt" | "payableUsdt"> | null>());
let choiceReadGeneration = 0;

async function loadChoiceQuotes(sources: Device[]) {
  const openingState = state.value;
  const key = choiceReadKey.value;
  if (key === null || openingState.kind !== "choice") return;
  const generation = choiceReadGeneration;
  const scope = captureAccountScope();
  const target = openingState.targetKind;
  const current = () => purchaseMounted && generation === choiceReadGeneration && choiceReadKey.value === key
    && state.value === openingState && isCurrentAccountScope(scope);
  await Promise.all(sources.map(async device => {
    const id = Number(device.id);
    const version = device.rowVersion;
    choiceQuotes.value.delete(device.id);
    try {
      const quote = await deviceE3Api.quote(id, target);
      if (!current()) return;
      const matches = quote.sourceDeviceId === id && quote.sourceRowVersion === version && quote.targetProductNo === target;
      choiceQuotes.value.set(device.id, matches ? { discountUsdt: quote.discountUsdt, payableUsdt: quote.payableUsdt } : null);
    } catch {
      if (current()) choiceQuotes.value.set(device.id, null);
    }
  }));
}

watch([choiceReadKey, state], () => {
  const generation = ++choiceReadGeneration;
  choiceQuotes.value.clear();
  if (choiceReadKey.value === null) return;
  void nextTick(() => {
    if (purchaseMounted && generation === choiceReadGeneration) return loadChoiceQuotes(choiceSources.value);
  });
}, { immediate: true, flush: "sync" });

useAutoRecovery({
  active: () => choiceReadKey.value !== null,
  failed: () => [...choiceQuotes.value.values()].includes(null),
  retry: () => loadChoiceQuotes(choiceSources.value.filter(device => choiceQuotes.value.get(device.id) === null)),
  repeatMs: 30_000,
});

const choiceView = computed(() => {
  const s = state.value;
  if (s.kind !== "choice") return null;
  const rows = choiceSources.value.map((d) => {
    const quote = choiceQuotes.value.get(d.id);
    const credit = remoteApiEnabled ? quote?.discountUsdt ?? null : previewCredit(d, s.newPrice);
    const net = remoteApiEnabled ? quote?.payableUsdt ?? null : Math.max(0, +(s.newPrice - (credit ?? 0)).toFixed(2));
    const name = deviceName(t.value, d);
    const creditText = credit == null ? "—" : `$${formatGroupedAmount(credit)}`;
    const netText = net == null ? "—" : `$${formatGroupedAmount(net)}`;
    return { id: d.id, device: d, name, credit: creditText, net: net == null ? null : amountParts(net),
      label: `${name} · ${t.value.tradein.inventoryCreditLabel} ${creditText} · ${t.value.tradein.sheetNetCostLabel} ${netText}` };
  });
  return { rows, single: rows.length === 1 ? rows[0] : null };
});

async function openTradeinQuote(oldDevice: Device, targetKind: DeviceKind, newPrice: number): Promise<void> {
  if (quoteLoading.value || !props.active || !purchaseMounted) return;
  if (handleOriginalCapacityPurchase(targetKind)) return;
  const requestGeneration = ++quoteRequestGeneration.value;
  if (!remoteApiEnabled) {
    canonicalQuote.value = null;
    sheet.showTradein(oldDevice.id, targetKind, newPrice);
    return;
  }
  quoteLoading.value = true;
  const requestScope = captureAccountScope();
  const requestOrigin = { ...apiRuntimeConfig };
  const openingState = state.value;
  const sourceRowVersion = oldDevice.rowVersion;
  const requestIsCurrent = () => purchaseMounted && props.active && state.value === openingState
    && requestGeneration === quoteRequestGeneration.value && isCurrentAccountScope(requestScope)
    && requestOrigin.environment === apiRuntimeConfig.environment && requestOrigin.baseUrl === apiRuntimeConfig.baseUrl
    && app.devices.find(device => device.id === oldDevice.id)?.rowVersion === sourceRowVersion;
  try {
    // Recover an existing command before starting a new quote or qualification read.
    let original;
    try {
      original = readCheckoutTradein(app.accountKey, targetKind);
    } catch (error) {
      if (openingState.kind !== "retire") throw error;
      retireTargetRead.value = { sourceId: oldDevice.id, targetKind, price: newPrice };
      return;
    }
    retireTargetRead.value = null;
    if (original) {
      sheet.showTradein(oldDevice.id, targetKind, newPrice);
      return;
    }
    // quote revalidates the source and E1; purchase eligibility also checks F4B.
    // Consume rejection here even when quote fails or the sheet closes first.
    const result = purchaseEligibilityApi.get(targetKind).catch(() => null);
    const quote = await deviceE3Api.quote(Number(oldDevice.id), targetKind);
    if (!requestIsCurrent()) return;
    if (quote.sourceDeviceId !== Number(oldDevice.id) || quote.targetProductNo !== targetKind
        || quote.sourceRowVersion !== sourceRowVersion) throw new Error("TRADEIN_QUOTE_SCOPE_MISMATCH");
    if (handleOriginalCapacityPurchase(targetKind)) return;
    purchaseOpeningRead = { account: requestScope, oldDeviceId: oldDevice.id, sourceRowVersion, target: targetKind, origin: requestOrigin, result };
    canonicalQuoteOrigin.value = requestOrigin;
    canonicalQuote.value = quote;
    sheet.showTradein(oldDevice.id, targetKind, newPrice);
  } catch (error) {
    if (!requestIsCurrent()) return;
    canonicalQuote.value = null;
    warnTradeinQuoteRefusal(error);
  } finally {
    if (purchaseMounted && requestGeneration === quoteRequestGeneration.value) quoteLoading.value = false;
  }
}

function onChooseTradein(deviceId: string) {
  const s = state.value;
  if (s.kind !== "choice" || quoteLoading.value || !s.tradeInSources.includes(deviceId)) return;
  const oldDevice = app.devices.find((d) => d.id === deviceId) ?? null;
  if (!oldDevice || (remoteApiEnabled && oldDevice.paidPriceUsdt <= 0)) {
    // Race: device disappeared between hint computation and click. Bail out
    // gracefully — user can retry from the product page.
    hide();
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  void openTradeinQuote(oldDevice, s.targetKind, s.newPrice);
}

function onChooseFullPrice() {
  const s = state.value;
  if (s.kind !== "choice" || quoteLoading.value) return;
  if (!handleOriginalCapacityPurchase(s.targetKind, true)) hide();
}

function warnTradeinQuoteRefusal(error: unknown) {
  const reason = tradeinPaymentRejection(error);
  const flow = checkoutFlowCopy(locale.code);
  if (reason) toast.warn(flow.cannotPay, flow[reason]);
  else toast.warn(t.value.tradein.errPleaseRetry);
}

// Only checkout owns readback. An unresolved capacity original takes precedence
// over opening another choice or requesting a quote for a different product.
function handleOriginalCapacityPurchase(target: DeviceKind, retryRefused = false): boolean {
  if (!remoteApiEnabled) return false;
  let checkoutTarget: string = target;
  try {
    const original = readCapacityPending(app.accountKey);
    if (!original) return false;
    checkoutTarget = original.quote ? original.quote.targetProductNo : original.targetProductNo;
    if (refusedPurchasePayment(app.accountKey, original.key)) {
      if (!retryRefused || checkoutTarget !== target) return false;
      void runCanonicalCapacityPurchase(original.operation, original.quote, true);
      return true;
    }
  } catch {
    // This entry already has a selected product. Let its checkout show the
    // unreadable-record state without guessing an original key.
  }
  hide();
  void navTo(capacityCheckoutHref(checkoutTarget));
  return true;
}

// ───────────────────── 1.5 retire — 主动下架:选升级目标 ─────────────────────

const remoteRetireLoadKey = computed(() => {
  const current = state.value;
  if (!props.active || current.kind !== "retire") return "closed";
  const config = canonicalTradeinConfig.value;
  const source = app.devices.find(device => device.id === current.oldDeviceId);
  return [app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl,
    current.oldDeviceId, source?.rowVersion, source?.paidPriceUsdt, source?.activatedAt,
    source?.pendingDeactivate, Boolean(source?.currentTask), productCatalogState.status, productCatalogState.revision,
    config?.enabled, config?.requireHigherPrice, config?.earlyAccessEnabled,
    config?.earlyAccessLeadDays].join("|");
});

async function loadRemoteRetireTargets() {
  const current = state.value;
  if (!remoteApiEnabled || !props.active || !purchaseMounted || current.kind !== "retire") return;
  const config = canonicalTradeinConfig.value;
  const source = app.devices.find((device) => device.id === current.oldDeviceId);
  if (!config?.enabled || !source || productCatalogState.status !== "ready") return;

  const request = ++remoteRetireRequest;
  const requestScope = captureAccountScope();
  const key = remoteRetireLoadKey.value;
  const requestOrigin = { ...apiRuntimeConfig };
  remoteRetireOrigin.value = requestOrigin;
  const requestIsCurrent = () => purchaseMounted && props.active && request === remoteRetireRequest
    && isCurrentAccountScope(requestScope) && key === remoteRetireLoadKey.value && state.value === current
    && requestOrigin.environment === apiRuntimeConfig.environment && requestOrigin.baseUrl === apiRuntimeConfig.baseUrl;
  const paid = source.paidPriceUsdt ?? 0;
  const candidates = PRODUCTS.filter(product => product.productType === "DEVICE"
    && (!config.requireHigherPrice || product.price > paid));
  remoteRetireLoadError.value = false;
  remoteRetirePending.value = candidates.length > 0;
  await Promise.allSettled(candidates.map(async ({ id }) => {
    try {
      const eligibility = await deviceE3Api.eligibility(id);
      if (!requestIsCurrent()) return;
      if (eligibility.targetProductNo !== id) { remoteRetireLoadError.value = true; return; }
      if (!eligibility.enabled || !eligibility.eligible || !eligibility.sources.some((candidate) => candidate.eligible
        && candidate.sourceDeviceId === Number(current.oldDeviceId))) {
        remoteRetireEligibleTargets.value.delete(id);
        remoteRetirePayables.value.delete(id);
        return;
      }
      remoteRetireEligibleTargets.value = new Set([...remoteRetireEligibleTargets.value, id]);
      // Each authorized row appears immediately. A pending/failed quote stays "—".
      const quote = await deviceE3Api.quote(Number(current.oldDeviceId), id);
      if (!requestIsCurrent()) return;
      if (quote.sourceDeviceId !== Number(current.oldDeviceId)
          || quote.targetProductNo !== id || quote.sourceRowVersion !== source.rowVersion) {
        remoteRetireLoadError.value = true; return;
      }
      remoteRetirePayables.value = new Map([...remoteRetirePayables.value, [id, quote.payableUsdt]]);
    } catch {
      if (requestIsCurrent()) remoteRetireLoadError.value = true;
    }
  }));
  if (purchaseMounted && props.active && request === remoteRetireRequest && state.value === current) {
    remoteRetirePending.value = false;
    if (requestOrigin.environment !== apiRuntimeConfig.environment || requestOrigin.baseUrl !== apiRuntimeConfig.baseUrl) {
      remoteRetireEligibleTargets.value = new Set();
      remoteRetirePayables.value = new Map();
      remoteRetireLoadError.value = true;
    }
  }
}

useAutoRecovery({
  active: () => remoteApiEnabled && props.active && state.value.kind === "retire",
  failed: () => canonicalTradeinConfigStatus.value === "error" || productCatalogState.status === "error"
    || (!remoteRetirePending.value && remoteRetireLoadError.value),
  async retry() {
    if (remoteRetireLoadError.value && !remoteRetirePending.value) {
      await loadRemoteRetireTargets();
      return;
    }
    await Promise.all([
      canonicalTradeinConfigStatus.value === "error" ? loadCanonicalTradeinConfig(true) : undefined,
      productCatalogState.status === "error" ? refreshProductCatalog() : undefined,
    ]);
  },
  repeatMs: 30_000,
});

watch([remoteRetireLoadKey, state], () => {
  remoteRetireRequest++;
  remoteRetireEligibleTargets.value = new Set();
  remoteRetirePayables.value = new Map();
  remoteRetireOrigin.value = null;
  remoteRetirePending.value = false;
  remoteRetireLoadError.value = false;
  void loadRemoteRetireTargets();
}, { immediate: true, flush: "sync" });

// Display parts of an amount: the main-amount figure keeps its whole part in the main ink, the decimals muted (01 §1.2).
function amountParts(value: number): { int: string; dec: string } {
  const [int, dec] = formatGroupedAmount(value).split(".");
  return { int, dec: dec === undefined ? "" : `.${dec}` };
}
// A translated sentence split around its placeholders, so the filled-in figures can take their own weight in any word order.
// A "$" written right before a placeholder (the existing "${amount}" copy, also as published at runtime) belongs to the figure.
function fmtParts(template: string, values: Record<string, string>): { text: string; value: boolean }[] {
  return template.split(/(\$?\{\w+\})/).filter(Boolean).map((part) => {
    const match = /^(\$?)\{(\w+)\}$/.exec(part);
    return match && match[2] in values ? { text: match[1] + values[match[2]], value: true } : { text: part, value: false };
  });
}

const retireView = computed(() => {
  const s = state.value;
  if (s.kind !== "retire") return null;
  const device = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  const loadingStatus = { tone: "loading" as const, text: t.value.store.purchaseEligibilityLoading };
  const failedStatus = { tone: "warn" as const, text: t.value.tradein.retireReadFailed };
  if (remoteApiEnabled && (productCatalogState.status !== "ready" || !canonicalTradeinConfig.value)) {
    const failed = productCatalogState.status === "error" || canonicalTradeinConfigStatus.value === "error";
    // While reading, the source stays named (03 §3.4); a failed read is one status line that says it retries itself (03 §3.5.2).
    return {
      source: failed ? null : device,
      subtitle: device ? fmt(t.value.tradein.retireSubtitle, { name: deviceName(t.value, device) }) : "",
      targets: [], loading: !failed, status: failed ? failedStatus : loadingStatus,
    };
  }
  if (!device) return null;
  const paid = device.paidPriceUsdt ?? 0;
  // 目标 = 目录中合规的可购 SKU(select 列表,不手输;规格 DEV02A ⑥)。
  // 「仅限更高价」与「已上架 ∨ 抢先购窗口」均为运营可配规则,消费 flag 不硬编码。
  const targets = PRODUCTS.filter(
    (p) =>
      p.productType === "DEVICE" && (!remoteApiEnabled || canonicalTradeinConfig.value?.enabled) &&
      (!(remoteApiEnabled ? canonicalTradeinConfig.value?.requireHigherPrice !== false : TRADEIN_LADDER_RULES.requireHigherPrice) || p.price > paid) &&
      (remoteApiEnabled
        ? remoteRetireEligibleTargets.value.has(p.id)
        : isTradeInTargetAvailable(p.unlocksAtPhase, phase.value, monthsSinceJoin.value)),
  ).map((p) => {
    // 抢先购窗口内的未正式上架目标,行尾加「抢先升级」标(默认关闭时零渲染)。
    const early = !!p.unlocksAtPhase && !isPhaseReached(phase.value, p.unlocksAtPhase)
      && (!remoteApiEnabled || canonicalTradeinConfig.value?.earlyAccessEnabled === true);
    const remotePayable = remoteRetirePayables.value.get(p.id);
    // A pending or failed quote reads a bare 「—」 (01 §1.2); the figure is the server quote, never estimated here.
    const net = remoteApiEnabled ? remotePayable ?? null : Math.max(0, p.price - previewCredit(device, p.price));
    const price = `$${formatGroupedAmount(p.price)}`;
    const label = fmt(t.value.tradein.retireTargetOption, { name: p.name, price, net: net == null ? "—" : `$${formatGroupedAmount(net)}` });
    return { id: p.id, name: p.name, price, imageUrl: p.imageUrl ?? null, early,
      net: net == null ? null : amountParts(net), label: early ? `${label} · ${t.value.tradein.retireEarlyTag}` : label };
  });
  const pending = remoteApiEnabled && remoteRetirePending.value;
  const failed = remoteApiEnabled && remoteRetireLoadError.value;
  return {
    // The source row names the device while there are targets or they are still being read; a final empty or failed read is one status line.
    source: targets.length || pending ? device : null,
    subtitle: fmt(t.value.tradein.retireSubtitle, { name: deviceName(t.value, device) }),
    targets, loading: pending,
    status: pending ? loadingStatus : failed ? failedStatus
      : targets.length ? null : { tone: "info" as const, text: t.value.tradein.retireNoTargets },
  };
});
// One target, fully read: the single-machine layout. While rows still arrive the list stays, so the layout does not flip mid-read.
const retireSingle = computed(() => retireView.value && !retireView.value.loading && retireView.value.targets.length === 1
  ? retireView.value.targets[0] : null);

function onPickTarget(productId: string) {
  const s = state.value;
  const origin = remoteRetireOrigin.value;
  if (!props.active || s.kind !== "retire" || quoteLoading.value
      || remoteApiEnabled && (!remoteRetireEligibleTargets.value.has(productId) || !origin
        || origin.environment !== apiRuntimeConfig.environment || origin.baseUrl !== apiRuntimeConfig.baseUrl)) return;
  const device = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  const p = getProduct(productId);
  if (!device || !p) {
    hide();
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  void openTradeinQuote(device, productId as DeviceKind, p.price);
}

// ───────────────────────── 2. tradein — 置换确认(去结算) ─────────────────────

const tradeinView = computed(() => {
  const s = state.value;
  if (s.kind !== "tradein") return null;
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!oldDevice) return null; // device vanished (already traded) — render nothing
  const remoteQuote = remoteApiEnabled ? canonicalQuote.value : null;
  if (remoteApiEnabled && (!remoteQuote || remoteQuote.sourceDeviceId !== Number(oldDevice.id)
      || remoteQuote.targetProductNo !== s.newKind)) return null;
  const paid = remoteQuote?.sourceActualPaidUsdt ?? oldDevice.paidPriceUsdt ?? 0;
  const earned = remoteQuote?.cumulativeOutputUsdt ?? Math.max(0, oldDevice.cumulativeEarningsUsdt ?? 0);
  const credit = remoteQuote?.discountUsdt ?? previewCredit(oldDevice, s.newPrice);
  const band = remoteQuote ? null : ladderBandFor(paid, earned);
  const creditRatePct = remoteQuote ? remoteQuote.creditRatePct : band?.creditPct ?? null;
  const estNet = remoteQuote?.payableUsdt ?? Math.max(0, +(s.newPrice - credit).toFixed(2));
  const targetPrice = remoteQuote?.targetPriceUsdt ?? s.newPrice;
  return {
    // The device pair's accessible name: what is handed in and what it becomes.
    title: fmt(t.value.tradein.sheetTitle, {
      from: kindLabel(oldDevice.kind),
      to: kindLabel(s.newKind),
    }),
    oldDevice,
    oldName: kindLabel(oldDevice.kind),
    newKind: s.newKind,
    newName: kindLabel(s.newKind),
    newImageUrl: getProduct(s.newKind)?.imageUrl ?? null,
    estNet: amountParts(estNet),
    credit: formatGroupedAmount(credit),
    targetPrice: formatGroupedAmount(targetPrice),
    // How much of the target price the credit covers, drawn from the two server figures; no bar position when either is unknown.
    creditPct: targetPrice > 0 ? Math.round(Math.min(100, Math.max(0, credit / targetPrice * 100))) : null,
    // 抵扣 = 比例 × 旧机实付净额 (PRD §7.5.1): the base and the rate behind the credit.
    basis: fmtParts(t.value.tradein.sheetBasis, { paid: `$${formatGroupedAmount(paid)}`, pct: creditRatePct == null ? "—" : String(creditRatePct) }),
    // An active old device loses its running job on payment (PRD §7.5.1, BUG-542); same condition as before, both branches.
    taskVoid: remoteQuote ? remoteQuote.targetDeviceStatus === "ACTIVE" : oldDevice.activatedAt != null,
    fundsGap: remoteQuote && !remoteQuote.sufficientFunds
      ? fmtParts(t.value.tradein.purchaseFundsGap, { amount: formatGroupedAmount(remoteQuote.walletShortfallUsdt) }) : null,
    ctaText: fmt(t.value.tradein.sheetCta, { amount: formatGroupedAmount(estNet) }),
  };
});
// Quota used up keeps the confirm label on the disabled button; the reason is the panel right above it (board B-4d).
const confirmActionText = computed(() => remoteApiEnabled && purchaseMessage.value === "quotaDepleted"
  ? tradeinView.value?.ctaText ?? "" : purchaseActionText.value);

async function onConfirmTradein() {
  const s = state.value;
  if (s.kind !== "tradein" || confirming.value || !props.active) return;
  const recovery = readTradeinRecovery();
  if (recovery === "pending") { navigateTradeinCheckout(s.newKind); return; }
  if (recovery === "error") return;
  if (handleOriginalCapacityPurchase(s.newKind)) return;
  const origin = canonicalQuoteOrigin.value;
  if (remoteApiEnabled && (!origin || origin.environment !== apiRuntimeConfig.environment || origin.baseUrl !== apiRuntimeConfig.baseUrl)) {
    canonicalQuote.value = null;
    purchaseSnapshot.value = null;
    purchaseStatus.value = "error";
    purchaseReturn = null;
    purchaseOpeningRead = null;
    return;
  }
  if (purchaseActionDisabled.value) return;
  if (remoteApiEnabled) {
    if (purchaseMessage.value === "ineligible" && purchaseScopeKey.value && canonicalQuote.value) {
      const pendingReturn = { account: captureAccountScope(), accountKey: app.accountKey,
        accountEpoch: app.accountBindingEpoch, oldDeviceId: s.oldDeviceId, newKind: s.newKind,
        newPrice: s.newPrice, quote: canonicalQuote.value, origin: origin! };
      hide();
      purchaseReturn = pendingReturn;
      if (!(await navTo(`/pages/team/quota?product=${encodeURIComponent(s.newKind)}&intent=tradein-conditions`))) restoreTradeinAfterConditions();
      return;
    }
    if (purchaseMessage.value !== "eligible") {
      await refreshTradeinPurchaseEligibility();
      return;
    }
    const epoch = purchaseSheetEpoch;
    confirming.value = true;
    const eligible = await refreshTradeinPurchaseEligibility();
    if (epoch !== purchaseSheetEpoch) return;
    confirming.value = false;
    if (!eligible) return;
    const recoveryAfterRead = readTradeinRecovery();
    if (recoveryAfterRead === "pending") { navigateTradeinCheckout(s.newKind); return; }
    if (recoveryAfterRead === "error") return;
  }
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!oldDevice) {
    hide();
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  // 入口后任务才开始的竞态:退回阻断提示(规格 DEV02A 异常2)。判定单源
  // isDeviceTaskBlocked——库存机的出厂任务不在跑,不阻断。
  if (!remoteApiEnabled && isDeviceTaskBlocked(oldDevice)) {
    sheet.showRetireBlock(oldDevice.id, oldDevice.name);
    return;
  }
  confirming.value = true;
  // FEAT-DEV02:确认 = 写入结算抵扣上下文,原子事务(净额扣款 + 移除旧机 + 新机
  // 新机继承原位置)统一发生在结算页持久块——本弹层不再直接动钱/动设备数组。
  sheet.applyTradein(oldDevice.id, s.newKind, remoteApiEnabled ? canonicalQuote.value ?? undefined : undefined);
  navigateTradeinCheckout(s.newKind);
  confirming.value = false;
}

// ───────────────────────── 3. replace (Path B) ─────────────────────────

const replaceView = computed(() => {
  const s = state.value;
  if (s.kind !== "replace") return null;
  // The arriving machine, what it costs, and the device that steps down (board B-6a); the runtime-published copy may still
  // carry {newKind}, so it is still passed to the button labels.
  const base = { newKind: s.newKind, newName: kindLabel(s.newKind), newImageUrl: getProduct(s.newKind)?.imageUrl ?? null,
    replaceCta: fmt(t.value.tradein.replaceReplaceCta, { newKind: kindLabel(s.newKind) }),
    keepCta: fmt(t.value.tradein.replaceKeepCta, { newKind: kindLabel(s.newKind) }) };
  if (remoteApiEnabled && s.canonicalCapacityQuote) {
    const quote = s.canonicalCapacityQuote;
    const device = quote.sourceDeviceId == null ? null : app.devices.find((d) => Number(d.id) === quote.sourceDeviceId) ?? null;
    return {
      ...base,
      due: amountParts(quote.payableUsdt),
      source: { device, online: !!device && deviceOnlineState(device, Date.now()) === "online",
        line: fmt(t.value.tradein.replaceSourceLine, { name: quote.sourceDeviceName ?? t.value.tradein.errReplaceUnavailable }) },
      insufficient: false, // The shared payment selector checks wallet balance; external methods remain available.
      fundsGap: null,
    };
  }
  const lowest = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!lowest) return null; // snapshot device vanished — render nothing
  const insufficient = s.newPrice - app.user.usdtBalance > 0;
  return {
    ...base,
    due: amountParts(s.newPrice),
    source: { device: lowest, online: deviceOnlineState(lowest, Date.now()) === "online",
      line: fmt(t.value.tradein.replaceSourceLine, { name: lowest.name }) },
    insufficient,
    // Same shortfall the composer checks; shown as one hint line above the disabled buttons (board B-6b).
    fundsGap: insufficient ? fmtParts(t.value.tradein.purchaseFundsGap, { amount: formatGroupedAmount(s.newPrice - app.user.usdtBalance) }) : null,
  };
});

function writeCapacityPending(accountKey:string,pending:CapacityPending|null):void {
  if (!writeAccountRow(CAPACITY_RECOVERY_TABLE,accountKey,{pending})
      || readCapacityPending(accountKey)?.key!==(pending?.key)) throw new Error('ACCOUNT_COMMAND_STORAGE_UNAVAILABLE');
  savedCapacity.value=pending;
  if (pending?.key !== capacityResumeKey.value) capacityResumeKey.value=null;
  capacityIntentResume.value=null;
}

function clearCapacityPurchase(accountKey: string, original: CapacityPending) {
  if (!releaseAccountCommandKey(CAPACITY_COMMAND_TABLE, accountKey, original.intent, original.key)) throw new Error('CAPACITY_COMMAND_RELEASE_FAILED');
  if (readCapacityPending(accountKey)?.key === original.key) writeCapacityPending(accountKey, null);
}

function rejectCapacityPurchase(accountKey: string, original: CapacityPending, message?: string) {
  if (original.operation === 'replace' && message === CAPACITY_REPLACEMENT_PURCHASE_RETIRED) {
    releasePurchaseCallerRecord(accountKey, 'CAPACITY_REPLACE', original.key);
  } else {
    clearCapacityPurchase(accountKey, original);
  }
  if (original.operation === 'replace' && message === TRADEIN_RUNTIME_RECOVERING) {
    toast.warn(t.value.tradein.errPleaseRetry);
    return;
  }
  hide();
  const reason = original.operation === 'replace' ? tradeinRejectionKey(message) : undefined;
  if (reason) {
    const flow = checkoutFlowCopy(locale.code);
    toast.warn(flow.cannotPay, flow[reason]);
  } else toast.warn(recoveryCopy.value.rejected);
}

async function runCanonicalCapacityPurchase(operation:'replace'|'keep',requestedQuote:CanonicalCapacityReplaceQuote|null,
    allowOriginalResume=false,readOnlyCurrent?:()=>boolean,resumeCurrent?:()=>boolean):Promise<"cleared" | void> {
  if (capacityRecoveryBusy.value || capacityReadBusy.value) return;
  const scope=captureAccountScope(),requestedIntent=requestedQuote?capacityIntent(operation,requestedQuote):null;
  const current=()=>isCurrentAccountScope(scope)&&(!readOnlyCurrent||readOnlyCurrent());
  if (readOnlyCurrent) capacityReadBusy.value=true;
  else capacityRecoveryBusy.value=true;
  try {
    let original=readCapacityPending(scope.accountKey, props.checkoutCapacityTarget ?? undefined);
    // Background recovery cannot create/replay a command, even if the saved row was released.
    if (readOnlyCurrent&&!original) return;
    if (!original) {
      const legacy=readAccountRow<{commands?:Record<string,string>}>(CAPACITY_COMMAND_TABLE,scope.accountKey,true)?.commands??{};
      const entries=Object.entries(legacy);
      if (entries.length) {
        if (!requestedQuote||entries.length!==1 || entries[0]![0]!==requestedIntent) throw new Error('CAPACITY_ORIGINAL_UNRESOLVED');
        original={operation,intent:requestedIntent!,key:entries[0]![1],quote:{...requestedQuote}};
        writeCapacityPending(scope.accountKey,original);
      }
    }
    if (!original) throw new Error("CAPACITY_ORIGINAL_UNRESOLVED");
    const command = original;
    let receipt:CanonicalTradeinResult|CanonicalCapacityKeepResult|null=null;
    const refused = refusedPurchasePayment(scope.accountKey, command.key);
    if (refused && readOnlyCurrent) return;
    if (!refused) {
      savedCapacity.value=original;
      let result = readOnlyCurrent && props.checkoutCapacityTarget
        ? await readCheckoutCapacityPayment(scope.accountKey, capacityPaymentKind(original.operation), original.key, current)
        : undefined;
      if (!current() || resumeCurrent?.() === false) return;
      if (result === null) return "cleared";
      result ??= await readPaymentCommand(apiClient, original.operation === 'replace' ? 'capacity-replace' : 'capacity-keep', original.key);
      if (!current() || resumeCurrent?.() === false) return;
      if (result.status === 'AWAITING_PAYMENT') {
        capacityResumeKey.value = null;
        capacityIntentResume.value = { commandKey: original.key, intentNo: result.intentNo, cutoff: result.cutoff };
        return;
      }
      capacityIntentResume.value = null;
      capacityResumeKey.value = result.status === 'NOT_SEEN' && result.canResumeSameKey ? original.key : null;
      if (result.status==='SUCCEEDED') receipt=original.operation==='replace'
        ?parseCanonicalTradeinResult(result.receipt):parseCanonicalCapacityKeepResult(result.receipt);
      else if (result.status==='REJECTED') {
        rejectCapacityPurchase(scope.accountKey, original, result.message);
        return "cleared";
      } else if (!capacityResumeAllowed.value || !allowOriginalResume) return;
    }
    const frozen = command.quote;
    const effectiveOperation = command.operation;
    const target = frozen ? frozen.targetProductNo : (command as PendingKeepCommand).targetProductNo;
    const payable = frozen ? frozen.payableUsdt : (command as PendingKeepCommand).payableUsdt;
    const summary = frozen ? frozen.targetProductName : kindLabel(target as DeviceKind);
    if (!receipt) {
      if (readOnlyCurrent) return;
      const purchaseIsCurrent = () => current() && props.active
        && (state.value.kind === "replace" || state.value.kind === "choice" || allowOriginalResume && state.value.kind === "keep-recovery")
        && readCapacityPending(scope.accountKey)?.key === command.key;
      receipt = await executeSelectedPurchase({ amount: payable, currency: "USDT", summary }, async authorization => {
        if (!purchaseIsCurrent()) return null;
        const key = command.key;
        if (effectiveOperation === "keep") return deviceE3Api.replayCapacityKeep(target, key, payable, authorization);
        try {
          return await deviceE3Api.capacityReplace(frozen!.sourceDeviceId!,target,key,frozen!,authorization);
        } catch (error) {
          if (!current() || !(tradeinPaymentRejection(error) || isApiRefusal(error, 503, TRADEIN_RUNTIME_RECOVERING))) throw error;
          rejectCapacityPurchase(scope.accountKey, command, asApiError(error).message);
          return null;
        }
      },purchaseIsCurrent,{kind:effectiveOperation==='replace'?'CAPACITY_REPLACE':'CAPACITY_KEEP',
        payload:{targetProductNo:target,expectedPayableUsdt:payable,...(effectiveOperation==='replace'?{sourceDeviceId:frozen!.sourceDeviceId}: {})},
        tradeinKey: command.key,
        refusedPaymentKey: refused?.commandKey,
        commandKey: () => {
          if (!purchaseIsCurrent()) throw new Error("CAPACITY_ORIGINAL_UNRESOLVED");
          return command.key;
        },
        onReplacementRefused: reason => {
          if (!current() || !props.active) return;
          if (effectiveOperation === 'replace') sheet.replacementPaymentRefusal = { targetProductNo: target, reason };
          savedCapacity.value = null;
          capacityResumeKey.value = null;
          capacityIntentResume.value = null;
          hide();
        },
        parseReceipt:raw=>effectiveOperation==='replace'?parseCanonicalTradeinResult(raw):parseCanonicalCapacityKeepResult(raw)});
      // The record may have been released with a payment the server no longer holds.
      if (!receipt) { savedCapacity.value=readCapacityPending(scope.accountKey); return; }
    }
    if (!current()) return;
    await completeCapacityPurchase(command, receipt, readOnlyCurrent);
  } catch {
    if (current() && readOnlyCurrent) {
      capacityResumeKey.value = null;
      capacityIntentResume.value = null;
    } else if (current() && resumeCurrent?.()) {
      hide();
      toast.warn(t.value.tradein.errPleaseRetry);
    } else if (current() && !resumeCurrent) {
      toast.warn(recoveryCopy.value.paymentPending);
    }
  } finally {
    if (readOnlyCurrent) capacityReadBusy.value=false;
    else {capacityRecoveryBusy.value=false;confirming.value=false;}
  }
}

async function completeCapacityPurchase(original: CapacityPending, receipt: CanonicalTradeinResult | CanonicalCapacityKeepResult,
    current?: () => boolean) {
  const payable = original.quote ? original.quote.payableUsdt : original.payableUsdt;
  if (Math.abs(purchasePrincipalUsdt(receipt) - payable) > 0.000001
      || (original.operation === 'replace' && (receipt as CanonicalTradeinResult).sourceDeviceId !== original.quote.sourceDeviceId))
    throw new Error('CAPACITY_RECEIPT_QUOTE_MISMATCH');
  if (original.operation === 'replace') {
    await submitCanonicalCapacityReplacement(original.quote, original.quote.targetProductNo as DeviceKind,
      { key: original.key, receipt: receipt as CanonicalTradeinResult }, current);
  } else {
    const target = original.quote ? original.quote.targetProductNo : original.targetProductNo;
    await submitCanonicalKeepBuy(target as DeviceKind,
      { key: original.key, intent: original.intent, receipt: receipt as CanonicalCapacityKeepResult }, current);
  }
}

function openCapacityIntent(target: string): boolean {
  const intent = capacityIntentResume.value;
  const original = capacityRecovery.value;
  if (!intent || original?.key !== intent.commandKey
      || intent.cutoff !== null && Date.now() >= intent.cutoff) return false;
  return openCheckoutCapacityPayment(original, target, intent.intentNo);
}

function openCapacityProgress(row: CheckoutCapacityPaymentRow): boolean {
  const target = props.checkoutCapacityTarget;
  const original = capacityRecovery.value;
  if (!target || original?.key !== row.commandKey || capacityPaymentKind(original.operation) !== row.kind) return false;
  return openCheckoutCapacityPayment(original, target, row.intentNo);
}
defineExpose({ openCapacityProgress });

function openCheckoutCapacityPayment(original: CapacityPending, target: string, intentNo?: string): boolean {
  const originalTarget = original.quote ? original.quote.targetProductNo : original.targetProductNo;
  if (!props.active || !capacityPageShown.value || props.checkoutCapacityTarget !== target || originalTarget !== target) return false;
  const scope = captureAccountScope();
  let generation = capacityRecoveryGeneration;
  const current = () => isCurrentAccountScope(scope) && props.active && capacityPageShown.value
    && props.checkoutCapacityTarget === target && generation === capacityRecoveryGeneration;
  const opened = resumeCheckoutCapacityPayment(scope.accountKey, capacityPaymentKind(original.operation), original.key, intentNo, {
    async onDelivered(result) {
      if (!current()) return;
      capacityRecoveryBusy.value = true;
      try {
        const receipt = original.operation === 'replace'
          ? parseCanonicalTradeinResult(result.receipt) : parseCanonicalCapacityKeepResult(result.receipt);
        await completeCapacityPurchase(original, receipt, current);
      } catch {
        // Checkout's existing readback continues if the completed payment cannot be verified here.
      } finally {
        capacityRecoveryBusy.value = false;
      }
    },
    onExpired() {
      if (!isCurrentAccountScope(scope) || savedCapacity.value?.key !== original.key) return;
      try {
        // The payment layer owns the expiry notice. Checkout only clears its original command.
        clearCapacityPurchase(scope.accountKey, original);
        if (props.active && capacityPageShown.value && props.checkoutCapacityTarget === target) emit("checkout-capacity-cleared", target);
      } catch {
        // The checkout's existing readback can retry cleanup.
      }
    },
  });
  if (opened) {
    invalidateCapacityRecovery();
    generation = capacityRecoveryGeneration;
  }
  return opened;
}

function resumeCapacityCommand() {
  if (capacitySheetOpen.value) void recoverCapacityPurchase(true);
}

async function recoverCapacityPurchase(resume=false):Promise<void> {
  const target = props.checkoutCapacityTarget;
  if (!target || !props.active || !capacityPageShown.value || capacityResumeBusy.value || confirming.value) return;
  const scope=captureAccountScope(),generation=capacityRecoveryGeneration;
  const openingSheet = state.value;
  const current=()=>isCurrentAccountScope(scope)&&props.active&&capacityPageShown.value&&generation===capacityRecoveryGeneration
    && foregroundReadAllowed() && (resume || !viewingCheckoutCapacityPayment.value);
  if (!current()) return;
  if (!resume) checkoutCapacityRead = { accountKey: scope.accountKey, target, at: Date.now() };
  try {
    const pending=readCapacityPending(scope.accountKey, target);
    reportUnreadableCapacity(null);
    if (!pending || refusedPurchasePayment(scope.accountKey, pending.key)) {
      savedCapacity.value = null;
      capacityResumeKey.value = null;
      capacityIntentResume.value = null;
      emit("checkout-capacity-cleared", target);
      return;
    }
    if (resume && pending.key !== capacityResumeKey.value) {
      capacityResumeKey.value = null;
      return;
    }
    const resumeCurrent = resume ? () => current() && state.value === openingSheet : undefined;
    const result = await runCanonicalCapacityPurchase(pending.operation, pending.quote, resume, resume ? undefined : current, resumeCurrent);
    if (result === "cleared" && current()) emit("checkout-capacity-cleared", target);
  } catch {
    if (!current()) return;
    reportUnreadableCapacity(target);
    savedCapacity.value = null;
    capacityResumeKey.value = null;
    capacityIntentResume.value = null;
    if (resume) toast.warn(t.value.tradein.errPleaseRetry);
  }
}

async function submitCanonicalCapacityReplacement(
  quote: CanonicalCapacityReplaceQuote,
  newKind: DeviceKind,
  recovered:{key:string;receipt:CanonicalTradeinResult},
  readOnlyCurrent?:()=>boolean,
): Promise<void> {
  const requestScope = captureAccountScope();
  const intent = capacityIntent("replace", quote);
  let commandKey = "";
  const requireCurrentAccount = () => {
    if (!isCurrentAccountScope(requestScope)||(readOnlyCurrent&&!readOnlyCurrent())) throw new Error("ACCOUNT_SCOPE_CHANGED");
  };
  try {
    if (quote.decision !== "REPLACE_REQUIRED" || quote.sourceDeviceId == null
        || quote.targetProductNo !== newKind || quote.decisionSource !== "server") {
      throw new Error("CAPACITY_REPLACEMENT_QUOTE_INVALID");
    }
    commandKey = recovered.key;
    const receipt = recovered.receipt;
    await completeVerifiedMutation({
      submit: async () => {
        requireCurrentAccount();
        return receipt;
      },
      readback: async (submitted) => {
        requireCurrentAccount();
        const persisted = (await orderApi.list()).orders
          .find((order) => order.orderNo === submitted.orderNo);
        requireCurrentAccount();
        return persisted;
      },
      verifyOrder(submitted, persisted) {
        requireCurrentAccount();
            if (!persisted || persisted.productNo!==quote.targetProductNo || persisted.sourceDeviceId !== submitted.sourceDeviceId
            || persisted.targetDeviceId !== submitted.targetDeviceId
            || persisted.tradeinNo !== submitted.tradeinNo
            || persisted.canonicalStatus !== "activated"
            || persisted.paymentStatus.toUpperCase() !== "PAID"
            || persisted.orderStatus.toUpperCase() !== "COMPLETED"
            || persisted.activationStatus.toUpperCase() !== "ACTIVATED"
            || typeof persisted.amountUsdt !== "number"
            || Math.abs(persisted.amountUsdt - purchasePrincipalUsdt(submitted)) > 0.000001
            || Math.abs(persisted.discountUsdt - submitted.discountUsdt) > 0.000001) {
          throw new Error("CAPACITY_REPLACEMENT_READBACK_MISMATCH");
        }
      },
      refreshOrders: async () => {
        requireCurrentAccount();
        await orders.refreshRemote();
        requireCurrentAccount();
      },
      // refreshRemoteFleet 自吞不 reject(resilience 门);适配层升回 throw 保住验证链语义。
      refreshFleet: async () => {
        requireCurrentAccount();
        if (!(await app.refreshRemoteFleet())) throw new Error("E3_FLEET_REFRESH_UNAVAILABLE");
        requireCurrentAccount();
      },
      verifyFleet(submitted) {
        requireCurrentAccount();
        const target = app.devices.find((device) => device.id === String(submitted.targetDeviceId));
        const source = app.devices.find((device) => device.id === String(submitted.sourceDeviceId));
        if (!target || target.activatedAt == null || (source && source.activatedAt != null)) {
          throw new Error("CAPACITY_REPLACEMENT_FLEET_READBACK_MISMATCH");
        }
      },
      commit() {
        requireCurrentAccount();
        if (!releaseAccountCommandKey(CAPACITY_COMMAND_TABLE, requestScope.accountKey, intent, commandKey)) {
          throw new Error("CAPACITY_COMMAND_RELEASE_FAILED");
        }
        writeCapacityPending(requestScope.accountKey,null);
        toast.success(fmt(t.value.tradein.replaceSuccessToast, {
          newKind: kindLabel(newKind),
          oldKind: quote.sourceDeviceName ?? t.value.tradein.errReplaceUnavailable,
        }));
        hide();
        goDevices();
      },
    });
  } catch {
    if (!isCurrentAccountScope(requestScope)||(readOnlyCurrent&&!readOnlyCurrent())) return;
    if (!readOnlyCurrent) toast.warn(t.value.tradein.errPleaseRetry);
  } finally {
    if (!readOnlyCurrent) confirming.value = false;
  }
}

function onReplace() {
  const s = state.value;
  if (s.kind !== "replace" || confirming.value) return;
  if (handleOriginalCapacityPurchase(s.newKind, true)) return;
  if (remoteApiEnabled) { hide(); return; }
  if (replaceView.value?.insufficient) return;
  const lowest = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  if (!lowest) return;
  confirming.value = true;
  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path B "Replace" branch.
  // Order: pending-task gate → moveToInventory(lowest) → addDevice(new) →
  //        activateDevice(new) → debit(newPrice) → bill / rollback.
  // Pending-task gate: refuse if a task is in-flight; user must choose
  // Force/Wait in the block sheet before reaching this path.
  if (lowest.currentTask !== null) {
    sheet.showBlock(lowest.id, lowest.name, s.newKind, s.newPrice);
    confirming.value = false;
    return;
  }
  if (lowest.activatedAt === null) {
    toast.warn(t.value.tradein.errDeviceAlreadyInactive);
    confirming.value = false;
    return;
  }
  // 先算再动:停掉旧机后新机能不能占到槽,用同一个谓词事先判(审计 R9 P1:事后失败再回滚,回滚里的再激活撞的是
  // 同一个槽位谓词,必然连环失败,把一台已付费旧机甩进库存)。
  if ((app.remoteSlotsUsed ?? (app.activeSlotCount + reservedSlots.value)) - 1 >= app.slotCap) {
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  if (!app.deactivateDevice(lowest.id)) { // move old → inventory (frees slot);没落盘 = 没停,别继续
    toast.warn(t.value.tradein.errPleaseRetry);
    confirming.value = false;
    return;
  }
  const newId = app.addDevice(s.newKind);
  const activated = !!newId && app.activateDevice(newId, reservedSlots.value);
  if (!activated) {
    if (newId && !app.discardSpawnedDevice(newId)) reportStuckFunds(app.captureMoney(), newId, "device");
    // persist-verdict-ok: 上面已按同一谓词预检过,这里的再激活只在落盘抖动时会失败;失败 = 旧机留在库存,设备页可手动激活
    app.activateDevice(lowest.id, reservedSlots.value);
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  // 收据即指令:amount 为负 = 扣款,扣款与这条 purchase 分录同生共死。
  const paid = postMoneyBill({
    type: "purchase",
    symbol: "USDT",
    amount: -s.newPrice,
    status: "posted",
    memo: fmt(t.value.tradein.replaceBillMemo, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  });
  if (paid !== "ok") {
    // 钱没扣成(余额不足)或没记上账(收口点已还原资金 + 弹错)——设备侧的改动必须一起退回,
    // 否则用户白得一台新机、老机还停着。
    // 新机已落盘(addDevice 只在落盘成功时给 id),撤销也必须落盘;撤不掉登记待对账(审计 R8 P1:直写内存不落盘 → 白得一台)

    if (!app.discardSpawnedDevice(newId)) reportStuckFunds(app.captureMoney(), newId, "device");
    // persist-verdict-ok: 回滚里的再激活失败 = 旧机留在库存,设备页可手动激活;不再追补偿
    app.activateDevice(lowest.id, reservedSlots.value);
    if (paid === "insufficient") toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: formatGroupedAmount(app.user.usdtBalance < 0 ? s.newPrice - app.user.usdtBalance : s.newPrice) }));
    confirming.value = false;
    return;
  }
  // 成交即兑现意图:同账号该商品仍在窗内的链上发票一并作废(否则浮动条继续催第二笔;审计 R9 P1)。
  // persist-verdict-ok: 作废不掉 = 票留在磁盘,浮动条继续露出可取消的旧票,不会二次扣款
  pending.settleProduct(s.newKind);
  toast.success(
    fmt(t.value.tradein.replaceSuccessToast, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  );
  confirming.value = false;
  hide();
  goDevices();
}

async function submitCanonicalKeepBuy(
  newKind: DeviceKind,
  recovered:{key:string;intent:string;receipt:CanonicalCapacityKeepResult},
  readOnlyCurrent?:()=>boolean,
): Promise<void> {
  const requestScope = captureAccountScope();
  let intent = "";
  let key = "";
  const requireCurrentAccount = () => {
    if (!isCurrentAccountScope(requestScope)||(readOnlyCurrent&&!readOnlyCurrent())) throw new Error("ACCOUNT_SCOPE_CHANGED");
  };
  try {
    intent = recovered.intent;
    key = recovered.key;
    const receipt = recovered.receipt;
    const activeAtPurchase = receipt.deviceStatus === "ACTIVE";
    await completeVerifiedMutation({
      submit: async () => {
        requireCurrentAccount();
        return receipt;
      },
      readback: async (submitted) => {
        requireCurrentAccount();
        const persisted = (await orderApi.list()).orders
          .find((order) => order.orderNo === submitted.orderNo);
        requireCurrentAccount();
        return persisted;
      },
      verifyOrder(submitted, persisted) {
        requireCurrentAccount();
        if (!persisted || persisted.productNo !== newKind
            || persisted.orderType.toUpperCase() !== "CAPACITY_KEEP"
            || persisted.canonicalStatus !== (activeAtPurchase ? "activated" : "inventory")
            || persisted.paymentStatus.toUpperCase() !== "PAID"
            || persisted.orderStatus.toUpperCase() !== "COMPLETED"
            || persisted.activationStatus.toUpperCase() !== (activeAtPurchase ? "ACTIVATED" : "INVENTORY")
            || persisted.targetDeviceId !== submitted.targetDeviceId
            || !persisted.targetDeviceInstanceNo
            || typeof persisted.amountUsdt !== "number"
            || Math.abs(persisted.amountUsdt - purchasePrincipalUsdt(submitted)) > 0.000001
            || Math.abs(persisted.discountUsdt) > 0.000001) {
          throw new Error("CAPACITY_KEEP_ORDER_READBACK_MISMATCH");
        }
      },
      refreshOrders: async () => {
        requireCurrentAccount();
        await orders.refreshRemote();
        requireCurrentAccount();
      },
      refreshFleet: async () => {
        requireCurrentAccount();
        if (!(await app.refreshRemoteFleet())) throw new Error("E3_FLEET_REFRESH_UNAVAILABLE");
        requireCurrentAccount();
      },
      verifyFleet(submitted) {
        requireCurrentAccount();
        const target = app.devices.find((device) => device.id === String(submitted.targetDeviceId));
        if (!target || target.activationUnconfirmed || (activeAtPurchase && target.activatedAt == null)) {
          throw new Error("CAPACITY_KEEP_FLEET_READBACK_MISMATCH");
        }
      },
      commit() {
        requireCurrentAccount();
        if (!releaseAccountCommandKey(CAPACITY_COMMAND_TABLE, requestScope.accountKey, intent, key)) {
          throw new Error("CAPACITY_COMMAND_RELEASE_FAILED");
        }
        writeCapacityPending(requestScope.accountKey,null);
        toast.success(activeAtPurchase ? fmt(t.value.tradein.keepBuySuccessToast, { newKind: kindLabel(newKind) }) : t.value.orders.inventoryToast);
        hide();
        goDevices();
      },
    });
  } catch {
    if (!isCurrentAccountScope(requestScope)||(readOnlyCurrent&&!readOnlyCurrent())) return;
    if (!readOnlyCurrent) toast.warn(t.value.tradein.errPleaseRetry);
  } finally {
    if (!readOnlyCurrent) confirming.value = false;
  }
}

function onKeepBuy() {
  const s = state.value;
  if (s.kind !== "replace" || confirming.value) return;
  if (handleOriginalCapacityPurchase(s.newKind, true)) return;
  if (remoteApiEnabled) { hide(); return; }
  if (replaceView.value?.insufficient) return;
  confirming.value = true;
  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path B "Keep & buy" branch.
  // Order: addDevice (default inactive) → postMoneyBill(扣款 ⊗ 记账,单次落盘)。
  // 注释曾写「debit → bill / rollback」两步 —— 那是迁到收口点之前的形态,已过期。No demotion.
  const newId = app.addDevice(s.newKind);
  if (!newId) {
    // 新机没落盘 → 不扣钱(否则钱扣了机器没了)
    toast.warn(t.value.tradein.errPleaseRetry);
    confirming.value = false;
    return;
  }
  const paid = postMoneyBill({
    type: "purchase",
    symbol: "USDT",
    amount: -s.newPrice,
    status: "posted",
    memo: fmt(t.value.tradein.keepBuyBillMemo, { newKind: kindLabel(s.newKind) }),
  });
  if (paid !== "ok") {
    // 新机已落盘(addDevice 只在落盘成功时给 id),撤销也必须落盘;撤不掉登记待对账(审计 R8 P1:直写内存不落盘 → 白得一台)

    if (!app.discardSpawnedDevice(newId)) reportStuckFunds(app.captureMoney(), newId, "device");
    if (paid === "insufficient") toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: formatGroupedAmount(app.user.usdtBalance < 0 ? s.newPrice - app.user.usdtBalance : s.newPrice) }));
    confirming.value = false;
    return;
  }
  // 成交即兑现意图:同账号该商品仍在窗内的链上发票一并作废(否则浮动条继续催第二笔;审计 R9 P1)。
  // persist-verdict-ok: 作废不掉 = 票留在磁盘,浮动条继续露出可取消的旧票,不会二次扣款
  pending.settleProduct(s.newKind);
  toast.success(fmt(t.value.tradein.keepBuySuccessToast, { newKind: kindLabel(s.newKind) }));
  confirming.value = false;
  hide();
  goDevices();
}

// ───────────────────────── 4. block (pending task) ─────────────────────────

const blockTitle = computed(() => {
  const s = state.value;
  if (s.kind !== "block") return "";
  return fmt(t.value.tradein.blockTitle, { deviceName: s.oldDeviceName });
});
// The running job behind the block (boards B-7a, B-7b): the device, its job type and progress; unknown reads 「—」.
const blockView = computed(() => {
  const s = state.value;
  if (s.kind !== "block") return null;
  const device = app.devices.find((d) => d.id === s.oldDeviceId) ?? null;
  const pct = device ? taskProgressPercent(device.currentTask, Date.now(), device.interruptedAt,
    device.kind === "phone" ? device.phoneValidUntil : null) : null;
  return { device, name: s.oldDeviceName, taskType: device?.currentTask?.type ?? "—", pct, pctText: pct == null ? "—" : `${pct}%` };
});

function onWait() {
  // Cancel the replace flow — user retries once the task is done.
  hide();
}

// retire 阻断:查看任务 → earn 页(该设备任务区)。
function onGoTasks() {
  hide();
  setTimeout(() => {
    navTo("/earn");
  }, 260);
}

function onForce() {
  const s = state.value;
  if (s.kind !== "block" || s.origin !== "replace" || confirming.value) return;
  const lowest = app.devices.find((d) => d.id === s.oldDeviceId);
  if (!lowest) {
    hide();
    return;
  }
  confirming.value = true;
  if (remoteApiEnabled) {
    // Remote replacement is only admitted from a fresh server capacity quote;
    // never execute the legacy local force composer against canonical state.
    toast.warn(t.value.tradein.errPleaseRetry);
    confirming.value = false;
    return;
  }
  // ⚠️ MOCK-ONLY CROSS-STORE COMPOSER — Path B "Force replace" branch.
  //
  // Task-forfeit safety (Batch C R2 P0): deactivateDevice wipes `currentTask`
  // as a side effect, so we snapshot the task BEFORE moving to inventory, then
  // restore both activatedAt AND currentTask via direct device-array writes on
  // any rollback. Success path skips the restore (task stays forfeit — the
  // whole point).
  //
  // Order: snapshot task → addDevice(new) → deactivate(old, clears task) →
  //   activate(new) → postMoneyBill(扣款 ⊗ 记账,单次落盘)。Each failure restores the old device's task.
  const taskSnapshot = lowest.currentTask;
  // 先算再动:停掉旧机后新机能不能占到槽,用同一个谓词事先判(与 onReplace 同一条;审计 R9 P1)。
  if ((app.remoteSlotsUsed ?? (app.activeSlotCount + reservedSlots.value)) - 1 >= app.slotCap) {
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  const newId = app.addDevice(s.newKind);
  if (!newId) {
    toast.warn(t.value.tradein.errPleaseRetry); // 新机没落盘 → 旧机与任务原封不动
    confirming.value = false;
    return;
  }
  if (!app.deactivateDevice(lowest.id)) { // frees slot + wipes currentTask;没落盘 = 没停,撤掉新机别继续
    if (!app.discardSpawnedDevice(newId)) reportStuckFunds(app.captureMoney(), newId, "device");
    toast.warn(t.value.tradein.errPleaseRetry);
    confirming.value = false;
    return;
  }
  const activated = app.activateDevice(newId, reservedSlots.value);
  if (!activated) {
    // Rollback: remove new, restore the snapshotted task, re-activate old.
    if (!app.discardSpawnedDevice(newId)) reportStuckFunds(app.captureMoney(), newId, "device");

    // persist-verdict-ok: 任务快照恢复不成 = 旧机任务已丢(deactivate 抹的),与其余回滚同一残余,已在 toast 里告知重试
    app.patchDevice(lowest.id, { currentTask: taskSnapshot });
    // persist-verdict-ok: 回滚里的再激活失败 = 旧机留在库存,设备页可手动激活;不再追补偿
    app.activateDevice(lowest.id, reservedSlots.value);
    toast.warn(t.value.tradein.errReplaceSlotConflict);
    confirming.value = false;
    return;
  }
  // 成功即任务作废(deactivate 已抹掉);失败则连同任务一起还原。PRODUCTION:
  // server atomically refunds/keeps the partial task reward + recycles slot +
  // writes ledger in one tx with idempotency key {userId}-{oldId}-{newKind}-{nonce}.
  const paid = postMoneyBill({
    type: "purchase",
    symbol: "USDT",
    amount: -s.newPrice,
    status: "posted",
    memo: fmt(t.value.tradein.forceReplaceBillMemo, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  });
  if (paid !== "ok") {
    if (!app.discardSpawnedDevice(newId)) reportStuckFunds(app.captureMoney(), newId, "device");

    // persist-verdict-ok: 任务快照恢复不成 = 旧机任务已丢(deactivate 抹的),与其余回滚同一残余,已在 toast 里告知重试
    app.patchDevice(lowest.id, { currentTask: taskSnapshot });
    // persist-verdict-ok: 回滚里的再激活失败 = 旧机留在库存,设备页可手动激活;不再追补偿
    app.activateDevice(lowest.id, reservedSlots.value);
    if (paid === "insufficient") toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: formatGroupedAmount(app.user.usdtBalance < 0 ? s.newPrice - app.user.usdtBalance : s.newPrice) }));
    confirming.value = false;
    return;
  }
  // 成交即兑现意图:同账号该商品仍在窗内的链上发票一并作废(否则浮动条继续催第二笔;审计 R9 P1)。
  // persist-verdict-ok: 作废不掉 = 票留在磁盘,浮动条继续露出可取消的旧票,不会二次扣款
  pending.settleProduct(s.newKind);
  toast.success(
    fmt(t.value.tradein.replaceSuccessToast, {
      newKind: kindLabel(s.newKind),
      oldKind: kindLabel(lowest.kind),
    }),
  );
  confirming.value = false;
  hide();
  goDevices();
}

// 遮罩只拦指针不拦键盘:不接这一层,弹层打开后 Tab 会直接走到背景(那里有花钱的按钮),
// 且没有 Esc、关掉后焦点也回不到触发它的控件。
// A readable original trade-in (pending) is answered in the centred confirm, not in the sheet (03 §3.5.1 决定).
const recoveryNoticeOpen = computed(() => props.active && state.value.kind === "tradein" && purchaseRecovery.value === "pending");
const sheetVisible = computed(() => props.active && state.value.kind !== "none"
  && state.value.kind !== "keep-recovery" && !recoveryNoticeOpen.value
  && (state.value.kind !== "tradein" || !!tradeinView.value || purchaseRecovery.value !== "none"));
// The confirm shows the original command's devices and the amount it still owes, read from the same saved record the
// pending state came from; an unreadable record shows 「—」.
const recoveryNotice = computed(() => {
  const s = state.value;
  if (!recoveryNoticeOpen.value || s.kind !== "tradein") return null;
  let quote: CanonicalTradeinQuote | null = null;
  try { quote = readCheckoutTradein(app.accountKey, s.newKind)?.tradeinQuote ?? null; } catch { quote = null; }
  const oldDevice = app.devices.find((d) => d.id === s.oldDeviceId);
  const oldName = oldDevice ? kindLabel(oldDevice.kind) : quote?.sourceProductName ?? "—";
  const newName = kindLabel(s.newKind);
  return { oldDevice, oldName, newKind: s.newKind, newName, newImageUrl: getProduct(s.newKind)?.imageUrl ?? null,
    pairLabel: fmt(t.value.tradein.sheetTitle, { from: oldName, to: newName }), due: quote ? amountParts(quote.payableUsdt) : null };
});
// The capacity resume confirm (board B-6c): the machine and the amount still due, from the saved original command.
const capacityNotice = computed(() => {
  const original = capacityOriginal.value;
  if (!original) return null;
  return { target: original.target, name: original.productName, imageUrl: getProduct(original.target)?.imageUrl ?? null,
    due: amountParts(original.payableUsdt) };
});
// The basis hint bubble (03 §3.5.1). While it is open, Esc and back close the bubble first and leave the sheet up.
const basisTipOpen = ref(false);
watch([sheetVisible, () => state.value], () => { basisTipOpen.value = false; });
function closeSheetLayer() {
  if (basisTipOpen.value) basisTipOpen.value = false;
  else hide();
}
useDialogA11y(sheetVisible, ".tis-root", closeSheetLayer, true);


</script>

<style scoped>
.tis-root {
  position: fixed;
  inset: 0;
  z-index: 895;
}
/* Same scrim as the shared NxSheet: a plain dim layer, no blur (03 §3.5). Entrance: .nx-sheet-fade-in / .nx-sheet-slide-up,
   which carry the reduced-motion fallback (07 §7.1). */
.tis-backdrop {
  position: absolute;
  inset: 0;
  background: #0008;
}
.tis-panel { border-radius: var(--nx-glass-radius) var(--nx-glass-radius) 0 0; box-shadow: var(--nx-glass-edge);
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  box-sizing: border-box;
  max-height: min(88%, calc(100% - var(--nx-overlay-top)));
  overflow-y: auto;
  background: var(--nx-glass-fill);
  border: none;
  padding: 18px 16px;
  padding-bottom: var(--nx-overlay-bottom);
}
.tis-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 44px; /* 44×44 点按区(移动端最小触控标准;PR-D 债 #4) */
  height: 44px;
  border-radius: 999px;
  isolation: isolate;
  display: grid;
  place-items: center;
  z-index: 2;
  transition: opacity 0.15s;
}
/* The close control is the shared neutral glass circle (03 §3.1 关闭); the glyph sits above the glass layer. */
.tis-close svg {
  position: relative;
}
/* 《08》§2:尺寸早就补到 44 了,但按下反馈一直缺 */
.tis-close:active {
  opacity: 0.7;
}
.tis-title {
  display: block;
  font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);
  color: var(--v5-ink);
}
/* ── Retire and confirm states (boards B-1…B-4): title, body blocks 16 apart, footer actions. ── */
.tis-hd { padding-right: 48px; }
.tis-hd .tis-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
.tis-hd .tis-title:lang(zh) { letter-spacing: 0; }
.tis-bd { display: flex; flex-direction: column; gap: var(--v5-space-4); margin-top: var(--v5-space-3); }
.tis-ft { display: flex; flex-direction: column; gap: var(--v5-space-1); margin-top: var(--v5-space-3); }
/* The text exit is its label line; 12px above and below give it the board's 44px row under the primary. */
.tis-quiet { margin-block: var(--v5-space-3); }
.tis-num { font-weight: 500; font-variant-numeric: tabular-nums; }
/* Main-amount figures (01 §1.2): Montserrat, tabular, $ and decimals in the auxiliary ink. */
.tis-amt { font-family: var(--font-amount); font-variant-numeric: tabular-nums; font-weight: 500; color: var(--v5-ink); white-space: nowrap; }
.tis-amt__cur { color: var(--v5-ink-3); font-size: max(12px, .55em); }
.tis-amt__dec { color: var(--v5-ink-3); }
.tis-amt--row { flex: none; font-size: var(--ui-type-card-figure); line-height: var(--ui-type-card-figure-lh); }
.tis-amt--hero { display: block; font-size: var(--ui-type-wallet-amount); line-height: var(--ui-type-wallet-amount-lh); letter-spacing: -0.02em; }
.tis-amt--unknown { color: var(--v5-ink-3); }
/* Status line: one sentence with its icon; loading spins, a failed read is the warning ink (design-rules: warnings stand out). */
.tis-status { flex: 1 1 auto; min-width: 0; display: flex; align-items: flex-start; gap: var(--v5-space-2); color: var(--v5-ink-2); }
.tis-status > svg { flex: none; margin-top: calc(var(--v5-space-1) / 2); }
.tis-status--warn > svg { color: var(--v5-warning-ink); }
.tis-status__text { min-width: 0; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-2); overflow-wrap: break-word; }
.tis-spin { color: var(--v5-brand); animation: tis-spin 800ms linear infinite; }
@keyframes tis-spin { to { transform: rotate(360deg); } }
/* Status beside its retry: when the text would be squeezed past two lines the retry drops to the next line, right-aligned (03 §3.6.1). */
.tis-status-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v5-space-1) var(--v5-space-2); }
.tis-status-row > .tis-status { flex: 1 1 calc(var(--ui-type-description) * 16); }
/* Retire: the source device and what to pick for it. */
.tis-lead { display: flex; flex-direction: column; gap: calc(var(--v5-space-1) * 1.5); margin-top: -10px; }
.tis-source { display: flex; align-items: center; gap: var(--v5-space-2); }
.tis-source__art { flex: none; width: 36px; height: 36px; margin: -4px 0; }
.tis-source__text { min-width: 0; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: break-word; }
.tis-col-label { display: block; padding: 0 32px 6px 0; text-align: right; white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-list { overflow: hidden; border-radius: var(--v5-radius-m); background: var(--v5-surface-2); padding: var(--v5-space-1) 0; }
.tis-target { display: flex; align-items: center; gap: var(--v5-space-3); padding: var(--ui-space-row-y) var(--v5-space-3) var(--ui-space-row-y) var(--v5-space-2); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.tis-target + .tis-target { border-top: 1px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.tis-target:active { background: color-mix(in srgb, var(--v5-ink) 4%, transparent); }
.tis-target:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: -2px; }
.tis-target--disabled { opacity: .5; cursor: default; }
.tis-target__art { flex: none; width: 64px; height: 64px; margin: -4px 0; }
.tis-target__meta { flex: 1 1 auto; min-width: 0; }
.tis-target__name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: break-word; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.tis-target__sub { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v5-space-1) calc(var(--v5-space-1) * 1.5); margin-top: calc(var(--v5-space-1) / 2); }
.tis-target__price { white-space: nowrap; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
.tis-chev { flex: none; margin-left: -4px; color: var(--v5-ink-4); }
/* Retire with one target: the machine on a floor shadow, its price and what is left to pay. */
.tis-hero { display: flex; flex-direction: column; align-items: center; text-align: center; border-radius: var(--v5-radius-m); background: var(--v5-surface-2); padding: var(--v5-space-2) var(--v5-space-4) var(--v5-space-5); }
.tis-hero__stage { position: relative; display: grid; place-items: center; width: 200px; height: 160px; }
.tis-hero__floor { position: absolute; left: 50%; bottom: 20px; width: 150px; height: 22px; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 16%, transparent), transparent); pointer-events: none; }
.tis-hero__art { position: relative; width: 172px; height: 172px; }
.tis-hero__name { display: block; overflow-wrap: break-word; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); color: var(--v5-ink); }
.tis-hero__sub { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--v5-space-1) calc(var(--v5-space-1) * 1.5); margin-top: calc(var(--v5-space-1) / 2); }
.tis-hero__label { display: block; margin-top: var(--v5-space-3); white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Confirm: old → new machine, what is left to pay, the credit and its base. */
.tis-pair { display: flex; align-items: center; justify-content: center; gap: calc(var(--v5-space-1) * 1.5); }
.tis-pair__src, .tis-pair__dst { display: flex; align-items: center; gap: calc(var(--v5-space-1) * 1.5); }
.tis-pair__src { min-width: 0; }
.tis-pair__dst { flex: none; }
.tis-pair__src-art { flex: none; width: 48px; height: 48px; opacity: .82; }
.tis-pair__dst-art { flex: none; width: 56px; height: 56px; }
.tis-pair__src-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-pair__dst-name { white-space: nowrap; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); color: var(--v5-ink); }
.tis-pair__arrow { flex: none; margin: 0 4px; color: var(--v5-ink-4); }
.tis-due { text-align: center; }
.tis-due__label { display: block; white-space: nowrap; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-credit__row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--v5-space-3); margin-top: var(--v5-space-2); }
.tis-credit__end { text-align: right; }
.tis-credit__label { display: block; white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-credit__value { display: block; white-space: nowrap; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.tis-credit__value--brand { color: var(--v5-brand); }
.tis-basis { display: flex; align-items: center; justify-content: center; gap: calc(var(--v5-space-1) * 1.5); }
.tis-basis__text { min-width: 0; text-align: center; overflow-wrap: break-word; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-bd .tis-purchase { margin: 0; }
/* Footer hints: this order's consequences, one line each at 390 zh, warning icon, main ink (design-rules: warnings stand out). */
.tis-hints { display: flex; flex-direction: column; gap: var(--v5-space-2); padding: var(--v5-space-1) 0 var(--v5-space-3); }
.tis-hint { display: flex; align-items: flex-start; gap: calc(var(--v5-space-1) * 1.5); }
.tis-hint > svg { flex: none; margin-top: calc(var(--v5-space-1) / 2); color: var(--v5-warning-ink); }
.tis-hint__text { min-width: 0; overflow-wrap: break-word; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink); }
/* Recovery confirm (B-4e): the device pair stacked small, then the amount still due. */
.tis-dlg-pair { align-self: stretch; display: flex; align-items: flex-start; justify-content: center; gap: var(--ui-space-row-y); margin-top: var(--v5-space-4); }
.tis-dlg-pair__side { display: flex; flex-direction: column; align-items: center; gap: calc(var(--v5-space-1) / 2); width: 104px; min-width: 0; }
.tis-dlg-pair__art { width: 44px; height: 44px; }
.tis-dlg-pair__art--src { opacity: .82; }
.tis-dlg-pair__name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-dlg-pair__name--dst { font-weight: 500; color: var(--v5-ink); }
.tis-dlg-pair__arrow { flex: none; margin-top: var(--v5-space-3); color: var(--v5-ink-4); }
.tis-dlg-due { display: flex; flex-direction: column; align-items: center; gap: calc(var(--v5-space-1) / 2); margin-top: var(--v5-space-4); }
.tis-dlg-due__label { white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-dlg-due__amount { white-space: nowrap; font-family: var(--font-amount); font-weight: 500; font-size: var(--ui-type-page-title); line-height: var(--ui-type-page-title-lh); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; color: var(--v5-ink); }
.tis-dlg-due__unit { margin-left: var(--v5-space-1); letter-spacing: 0; font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Retire / choice with one item: the stated credit under the name (board B-5b). */
.tis-hero__credit { display: block; margin-top: calc(var(--v5-space-1) / 2); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); font-variant-numeric: tabular-nums; }
/* Slot full (B-6a): the arriving machine on its floor shadow, then the device that steps down in a surface-2 row. */
.tis-arrive { display: flex; flex-direction: column; align-items: center; text-align: center; }
.tis-arrive__stage { position: relative; display: grid; place-items: center; width: 180px; height: 120px; }
.tis-arrive__floor { position: absolute; left: 50%; bottom: 14px; width: 140px; height: 20px; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 16%, transparent), transparent); pointer-events: none; }
.tis-arrive__art { position: relative; width: 128px; height: 128px; }
.tis-yield { display: flex; align-items: center; gap: var(--v5-space-3); padding: var(--v5-space-2) var(--v5-space-4) var(--v5-space-2) var(--v5-space-2); border-radius: var(--v5-radius-m); background: var(--v5-surface-2); }
.tis-yield__art { flex: none; width: 52px; height: 52px; margin: -2px 0; }
.tis-yield__name { flex: 1 1 auto; min-width: 0; overflow-wrap: break-word; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
/* Confirmed online keeps the fixed English Online with a green dot (01 §1.1). */
.tis-online { flex: none; display: inline-flex; align-items: center; gap: calc(var(--v5-space-1) * 1.5); white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-online__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--v5-success-ink); }
/* A second full-width action sits 8px under the primary (board: 4px spacer + the footer's 4px gap). */
.tis-second { margin-top: var(--v5-space-1); }
/* The destructive choice keeps the neutral glass and only swaps its text to the error colour (03 §3.1). */
.tis-ft .tis-danger { --ui-button-ink: var(--v5-danger); color: var(--v5-danger); }
/* Block (B-7a/7b): the device with its running job and progress (03 §3.6 .nx-progress). */
.tis-job { display: flex; align-items: center; gap: var(--v5-space-3); padding: var(--v5-space-3) var(--v5-space-4) var(--v5-space-3) var(--v5-space-2); border-radius: var(--v5-radius-m); background: var(--v5-surface-2); }
.tis-job__art { flex: none; width: 64px; height: 64px; margin: -4px 0; }
.tis-job__meta { flex: 1 1 auto; min-width: 0; }
.tis-job__head { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-3); }
.tis-job__name { min-width: 0; overflow-wrap: break-word; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.tis-job__pct { flex: none; white-space: nowrap; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-metric); font-weight: 500; color: var(--v5-ink-3); }
.tis-job__sub { display: block; margin-top: calc(var(--v5-space-1) / 2); overflow-wrap: break-word; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.tis-job__bar { margin-top: 10px; }
/* Capacity resume (B-6c): the machine and its name, then the amount due. */
.tis-dlg-machine { display: flex; flex-direction: column; align-items: center; gap: var(--v5-space-1); max-width: 100%; margin-top: var(--v5-space-4); }
.tis-dlg-machine__art { width: 64px; height: 64px; }
.tis-dlg-machine__name { max-width: 100%; overflow-wrap: break-word; font: 500 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink); }
/* 360 band (≤374): smaller machines so the pair and the rows keep the 16px edge (board ≤374 rule). */
@media (max-width: 374px) {
  .tis-pair__src-art { width: 40px; height: 40px; }
  .tis-pair__dst-art { width: 48px; height: 48px; }
  .tis-pair__src-name { max-width: 76px; }
  .tis-target { gap: var(--ui-space-row-y); }
  .tis-target__art { width: 52px; height: 52px; }
}
@media (prefers-reduced-motion: reduce) {
  .tis-spin { animation: none; }
}
</style>
