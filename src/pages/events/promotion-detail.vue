<!--
  Purchase-offer landing page (P-58): SKU_GIFT, FIRST_PURCHASE and REPURCHASE.
  Every reward, limit, right, term and time comes from the public promotion read;
  other templates are sent on to the store filter. The page's main action lives in
  the fixed bottom bar (DS-30) for every state. Sign-in, refusal, scheduled, paused and
  ended states follow the States board: no subtitle and no header rules button.
-->
<template>
  <AppChassis active="home">
    <view class="lp" :class="'lp--' + (kind ?? 'pending')" data-testid="promotion-landing">
      <SubPageHeader plain design back="/pages/events/events" :title="navTitle" :action-label="activity && !stateView ? t.promotion.homeRulesLink : undefined" :action="activity && !stateView ? openTerms : undefined">
        <template #actionIcon><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4M9.5 12h5M9.5 15.5h5" /></svg></template>
      </SubPageHeader>

      <EmptyState v-if="!activity && status === 'error'" kind="recoverable-error" :title="c.loadError" :desc="c.loadErrorNote" :cta-label="c.retry" @cta="retry" />
      <view v-else-if="!activity" class="lp-body" role="status" aria-busy="true" :aria-label="t.promotion.loading">
        <view class="lp-tags"><view class="lp-skel lp-skel--tag" /><view class="lp-skel lp-skel--chip" /></view>
        <view class="lp-skel lp-skel--title" />
        <view class="lp-skel-card" />
      </view>

      <view v-else class="lp-body">
        <view class="lp-tags lp-rise">
          <NxTag v-if="eligibilityTag" :tone="eligibilityTag.tone"><svg v-if="eligibilityTag.tone === 'success'" class="lp-tag-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{{ eligibilityTag.text }}</NxTag>
          <NxTag :tone="timeTag.tone">{{ timeTag.text }}</NxTag>
        </view>
        <text class="lp-title lp-rise lp-d1">{{ localized(activity.title, locale.code) }}</text>
        <text v-if="!stateView" class="lp-subtitle lp-rise lp-d1">{{ subtitle }}</text>

        <!-- Purchase gift: the purchased model leads, the gift follows (04.2). -->
        <template v-if="kind === 'gift' && stage">
          <view class="lp-stage" :class="'lp-stage--' + stageMode">
            <view class="lp-stage__machines">
              <view class="lp-stage__main lp-enter-main"><CatalogMachineImage class="lp-fill" :sku="stage.mainSku" :image-url="productImage(stage.mainSku)" :scope-key="activity.activityId + ':stage-main'" /></view>
              <view v-if="stage.giftSku" class="lp-stage__gift lp-enter-gift"><CatalogMachineImage class="lp-fill" :sku="stage.giftSku" :image-url="productImage(stage.giftSku)" :scope-key="activity.activityId + ':stage-gift'" /></view>
              <view v-else class="lp-stage__reward lp-enter-gift"><text class="lp-amount lp-stage__amount" :class="amountSize(stage.parts.amount)">{{ stage.parts.amount }}</text><text class="lp-unit" :class="{ 'lp-unit--uvt': stage.parts.asset === 'UVT' }">{{ stage.parts.unit }}</text></view>
              <view v-if="stageMode === 'full' && stage.giftSku" class="lp-stage__badge nx-frosted-button lp-pop" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12M12 8v12.5" /><path d="M12 8c-1.5-3.5-5.5-4-5.5-1.5S10 8 12 8zM12 8c1.5-3.5 5.5-4 5.5-1.5S14 8 12 8z" /></svg></view>
            </view>
            <template v-if="stageMode !== 'ended'">
              <view class="lp-stage__label lp-stage__label--buy"><text class="lp-field">{{ c.stageBuy }}</text><text class="lp-stage__buy">{{ stage.mainName }}</text></view>
              <view class="lp-stage__label lp-stage__label--get"><text class="lp-field">{{ stage.getLabel }}</text><text class="lp-stage__get">{{ stage.giftText }}</text></view>
            </template>
          </view>
          <view v-if="note" class="lp-note lp-rise lp-d2" :class="{ 'lp-note--tight': phase === 'ended' }"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path v-if="note.ended" d="M12 7.5V12l3 2" /><path v-else d="M12 11v5M12 8h.01" /></svg><text>{{ note.text }}</text></view>

          <view class="lp-section lp-section-head lp-rise lp-d2">
            <text class="lp-section-title">{{ activity.rewardRules.some(rule => rule.buyerReward.type === 'DISCOUNT_USDT') ? c.offerRules : c.giftRules }}</text>
            <view class="lp-link" role="button" tabindex="0" @click="openTerms" @keydown.enter.prevent="openTerms" @keydown.space.prevent="openTerms"><text>{{ c.fullRules }} ›</text></view>
          </view>
          <view v-for="ticket in giftTickets" :key="ticket.id" class="lp-rule lp-card lp-rise lp-d2">
            <view class="lp-rule__row">
              <view class="lp-rule__art"><CatalogMachineImage class="lp-fill" :sku="ticket.buySku" :image-url="productImage(ticket.buySku)" :scope-key="activity.activityId + ':' + ticket.id + ':buy'" /></view>
              <view class="lp-rule__copy"><text class="lp-field">{{ c.ticketBuy }}</text><text class="lp-rule__name">{{ ticket.buyName }}</text></view>
              <text class="lp-rule__qty">{{ ticket.buyQty }}</text>
            </view>
            <view class="lp-rule__tear" aria-hidden="true"><view class="lp-notch lp-notch--left" /><view class="lp-notch lp-notch--right" /><view class="lp-rule__arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg></view></view>
            <view class="lp-rule__row">
              <view class="lp-rule__art">
                <CatalogMachineImage v-if="ticket.giftSku" class="lp-fill" :sku="ticket.giftSku" :image-url="productImage(ticket.giftSku)" :scope-key="activity.activityId + ':' + ticket.id + ':gift'" />
                <view v-else class="lp-coin lp-coin--small" :class="ticket.parts.asset === 'UVT' ? 'lp-coin--uvt' : 'lp-coin--usdt'" aria-hidden="true"><text>{{ ticket.parts.asset === 'UVT' ? 'U' : '$' }}</text></view>
              </view>
              <view class="lp-rule__copy"><text class="lp-field">{{ ticket.getLabel }}</text><text class="lp-rule__name lp-rule__name--gift">{{ ticket.getName }}</text></view>
              <text v-if="ticket.getQty" class="lp-rule__qty">{{ ticket.getQty }}</text>
            </view>
            <view class="lp-rule__cells">
              <view v-for="cell in ticket.cells" :key="cell.label" class="lp-rule__cell"><text class="lp-field">{{ cell.label }}</text><text class="lp-rule__value">{{ cell.value }}</text></view>
            </view>
          </view>

          <template v-if="rights">
            <view class="lp-section lp-rise lp-d3"><text class="lp-section-title">{{ c.rightsTitle }}</text><text class="lp-section-note">{{ fmt(c.rightsSubtitle, { name: rights.name }) }}</text></view>
            <view class="lp-rights lp-rise lp-d3">
              <view class="lp-rights__term lp-card">
                <text class="lp-field">{{ c.validity }}</text>
                <view class="lp-rights__days"><template v-if="rights.days !== null"><text class="lp-rights__number">{{ rights.days }}</text><text class="lp-rights__unit">{{ c.days }}</text></template><text v-else class="lp-rights__long">{{ c.longTerm }}</text></view>
                <text class="lp-rights__effective">{{ rights.effective }}</text>
              </view>
              <view class="lp-rights__cell lp-card"><text class="lp-field">{{ c.activation }}</text><text class="lp-rights__value">{{ rights.activation }}</text></view>
              <view class="lp-rights__cell lp-card"><text class="lp-field">{{ c.task }}</text><text class="lp-rights__value">{{ rights.task }}</text></view>
              <view class="lp-rights__flags lp-card">
                <view v-for="flag in rights.flags" :key="flag.text" class="lp-rights__flag">
                  <view class="lp-flag-mark" :class="{ 'lp-flag-mark--yes': flag.yes }" aria-hidden="true"><svg v-if="flag.yes" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg><svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></view>
                  <text>{{ flag.text }}</text>
                </view>
              </view>
            </view>
          </template>

          <text class="lp-section lp-section-title lp-rise lp-d4">{{ c.arrivalTitle }}</text>
          <view class="lp-lines lp-rise lp-d4">
            <view v-if="giftTerms.terms" class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12M12 8v12.5" /></svg><text>{{ giftTerms.terms }}</text></view>
            <view v-if="giftTerms.refund" class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></svg><text>{{ giftTerms.refund }}</text></view>
            <view class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg><text>{{ activityTime }}</text></view>
          </view>
          <text class="lp-footnote lp-rise lp-d4">{{ c.eligibilityFootnote }}</text>
        </template>

        <!-- First purchase: the reward ticket is the page's hero. -->
        <template v-if="kind === 'first' && firstTicket">
          <view class="lp-ticket lp-rise lp-d2" :class="{ 'lp-ticket--muted': firstTicket.muted }">
            <view class="lp-ticket__main">
              <text class="lp-ticket__label">{{ firstTicket.label }}</text>
              <view class="lp-ticket__value"><text class="lp-amount lp-ticket__amount" :class="amountSize(firstTicket.parts.amount, true)">{{ firstTicket.parts.amount }}</text><text class="lp-ticket__unit" :class="{ 'lp-unit--uvt': firstTicket.parts.asset === 'UVT' && !firstTicket.muted }">{{ firstTicket.parts.unit }}</text></view>
              <view v-if="countdown && !firstTicket.muted" class="lp-countdown">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                <text v-if="countdown.before">{{ countdown.before }}</text><text class="lp-countdown__time">{{ countdown.head }}<text class="lp-tick">:</text>{{ countdown.tail }}</text><text v-if="countdown.after">{{ countdown.after }}</text>
              </view>
            </view>
            <view class="lp-ticket__stub">
              <view v-if="firstTicket.parts.asset !== 'DEVICE'" class="lp-coin" :class="[firstTicket.muted ? 'lp-coin--muted' : firstTicket.parts.asset === 'UVT' ? 'lp-coin--uvt' : 'lp-coin--usdt', { 'lp-pop': !firstTicket.muted }]" aria-hidden="true"><svg v-if="firstTicket.parts.asset === 'UVT'" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 6v6.5a4.5 4.5 0 0 0 9 0V6" /></svg><text v-else>$</text></view>
              <view v-else-if="firstTicket.giftSku" class="lp-ticket__gift lp-pop"><CatalogMachineImage class="lp-fill" :sku="firstTicket.giftSku" :image-url="productImage(firstTicket.giftSku)" :scope-key="activity.activityId + ':first-gift'" /></view>
              <text v-if="firstTicket.muted" class="lp-ticket__unavailable">{{ c.notAvailable }}</text>
              <view v-else class="lp-ticket__limit"><text class="lp-field">{{ c.perPerson }}</text><text class="lp-ticket__limit-value">{{ firstTicket.limit }}</text></view>
            </view>
            <view class="lp-ticket__tear" aria-hidden="true" /><view class="lp-notch lp-notch--top" aria-hidden="true" /><view class="lp-notch lp-notch--bottom" aria-hidden="true" />
          </view>
          <view v-if="note" class="lp-note lp-rise lp-d2"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path v-if="note.ended" d="M12 7.5V12l3 2" /><path v-else d="M12 11v5M12 8h.01" /></svg><text>{{ note.text }}</text></view>

          <text class="lp-section lp-section-title lp-rise lp-d3">{{ c.stepsTitle }}</text>
          <view class="lp-steps lp-rise lp-d3">
            <view v-for="(step, index) in steps" :key="step.title" class="lp-step lp-card"><text class="lp-step__number">{{ index + 1 }}</text><text class="lp-step__title">{{ step.title }}</text><text class="lp-step__note">{{ step.note }}</text></view>
          </view>
        </template>

        <!-- Repurchase: owned devices on a glass slab, then the empty slot to fill. -->
        <template v-if="kind === 'repurchase' && slab">
          <view class="lp-slab-wrap">
            <view class="lp-slab nx-soft-glass lp-rise lp-d2">
              <view v-if="slab.count !== null" class="lp-slab__head"><text class="lp-slab__label">{{ c.myDevices }}</text><text class="lp-slab__count"><text class="lp-slab__count-number">{{ slab.count }}</text> {{ c.deviceUnit }}</text></view>
              <view v-if="slab.fleetRow" class="lp-slab__fleet">
                <view v-for="(device, index) in slab.thumbs" :key="device.id" class="lp-owned lp-own" :class="'lp-own--' + index">
                  <view class="lp-owned__art"><CatalogMachineImage class="lp-fill" :sku="device.sku" :image-url="productImage(device.sku)" :scope-key="'owned:' + device.id" /><text v-if="index === slab.thumbs.length - 1 && slab.more" class="lp-owned__more">+{{ slab.more }}</text></view>
                  <text class="lp-owned__name">{{ device.label }}</text>
                </view>
                <view class="lp-slab__plus" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></view>
                <view class="lp-target lp-slot">
                  <view class="lp-target__art"><CatalogMachineImage class="lp-target__image" :sku="slab.target" :image-url="productImage(slab.target)" :scope-key="activity.activityId + ':target'" /></view>
                  <text class="lp-target__name">{{ slab.targetName }}</text>
                  <view class="lp-target__tag lp-pop"><NxTag :tone="slab.uvt ? 'uvt' : 'warning'">{{ slab.tagText }}</NxTag></view>
                </view>
              </view>
              <view v-else class="lp-slab__solo" :class="{ 'lp-slab__solo--muted': slab.refused }">
                <view class="lp-target lp-slot">
                  <view class="lp-target__art"><CatalogMachineImage class="lp-target__image" :sku="slab.target" :image-url="productImage(slab.target)" :scope-key="activity.activityId + ':target'" /></view>
                  <view v-if="!slab.refused" class="lp-target__tag lp-pop"><NxTag :tone="slab.uvt ? 'uvt' : 'warning'">{{ slab.tagText }}</NxTag></view>
                </view>
                <text class="lp-slab__text">{{ slab.line[0] }}<text class="lp-keep" :class="slab.uvt ? 'lp-unit--uvt' : 'lp-strong'">{{ slab.rewardText }}</text>{{ slab.line[1] }}</text>
              </view>
              <text v-if="slab.fleetRow" class="lp-slab__foot">{{ slab.line[0] }}<text class="lp-keep" :class="slab.uvt ? 'lp-unit--uvt' : 'lp-strong'">{{ slab.rewardText }}</text>{{ slab.line[1] }}</text>
            </view>
          </view>
          <view v-if="note" class="lp-note lp-rise lp-d2"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path v-if="note.ended" d="M12 7.5V12l3 2" /><path v-else d="M12 11v5M12 8h.01" /></svg><text>{{ note.text }}</text></view>
        </template>

        <!-- Eligible devices: each opens the product page with this offer attached. -->
        <template v-if="kind === 'first' || kind === 'repurchase'">
          <view class="lp-section lp-section-head lp-section-head--start lp-rise lp-d4"><text class="lp-section-title">{{ kind === 'first' ? c.devicesTitle : c.addableTitle }}</text><text class="lp-count">{{ products.length }}</text></view>
          <view v-for="item in products" :key="item.sku" class="lp-product lp-card lp-press lp-rise lp-d4" role="link" tabindex="0" :aria-label="item.name" @click="navTo(promotionDetailHref(item.sku, activity.activityId))" @keydown.enter.prevent="navTo(promotionDetailHref(item.sku, activity.activityId))">
            <view class="lp-product__art"><CatalogMachineImage class="lp-fill" :sku="item.sku" :image-url="productImage(item.sku)" :scope-key="activity.activityId + ':product'" /></view>
            <view class="lp-product__copy">
              <text class="lp-product__name">{{ item.name }}</text>
              <text v-if="item.tagline" class="lp-product__tagline">{{ item.tagline }}</text>
              <view v-if="item.price" class="lp-price"><text class="lp-price__currency">$</text><text class="lp-price__value">{{ item.price }}</text></view>
              <view v-if="item.tag" class="lp-product__tag"><NxTag :tone="item.tagTone">{{ item.tag }}</NxTag></view>
            </view>
            <svg class="lp-product__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </view>

          <text class="lp-section lp-section-title lp-rise lp-d5">{{ kind === 'first' ? c.keyRules : c.conditionsTitle }}</text>
          <view class="lp-lines lp-rise lp-d5">
            <view v-if="kind === 'repurchase'" class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="6" rx="1.6" /><rect x="4" y="13" width="16" height="6" rx="1.6" /><path d="M7.5 8h.01M7.5 16h.01" /></svg><text>{{ c.conditionOwn }}</text></view>
            <view v-if="limitSentence" class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><text>{{ limitSentence }}</text></view>
            <view v-if="kind === 'first' && rewardTerms" class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></svg><text>{{ rewardTerms }}</text></view>
            <view class="lp-line"><svg class="lp-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg><text>{{ activityTime }}</text></view>
          </view>
          <view class="lp-link lp-link--block lp-rise lp-d5" role="button" tabindex="0" @click="openTerms" @keydown.enter.prevent="openTerms" @keydown.space.prevent="openTerms"><text>{{ c.fullRules }} ›</text></view>
        </template>
      </view>
      <view class="lp-bar-space" aria-hidden="true" />
    </view>

    <PromotionTerms v-if="activity" :open="termsOpen" :title="localized(activity.title, locale.code)" :terms="promotionTermsText(activity, t.promotion, locale.code)" :rules="promotionTermsRules(activity, t.promotion, productName)" :disclosures="promotionDisclosures(activity)" @close="termsOpen = false" />

    <template #pageFixed>
      <view v-if="bar" class="lp-bar nx-glass-bar" :class="{ 'lp-bar--wide': bar.wide }">
        <view v-if="!bar.wide" class="lp-bar__info">
          <text v-if="bar.hint" class="lp-bar__hint">{{ bar.hint }}</text>
          <template v-else-if="barSummary">
            <text class="lp-field">{{ barSummary.label }}</text>
            <view v-if="barSummary.price" class="lp-price lp-price--bar"><text class="lp-price__currency">$</text><text class="lp-price__value">{{ barSummary.price }}</text></view>
            <view v-else class="lp-bar__reward"><text class="lp-price__value">{{ barSummary.amount }}</text><text class="lp-bar__unit" :class="{ 'lp-unit--uvt': barSummary.uvt }">{{ barSummary.unit }}</text></view>
          </template>
        </view>
        <!-- Offer actions keep the approved promotion action: brand fill or neutral glass with the shared glass rim. -->
        <view class="promotion-action lp-cta" :class="bar.variant === 'primary' ? 'primary lp-cta--primary' : 'lp-cta--neutral'" role="button" :tabindex="bar.disabled ? -1 : 0" :aria-disabled="bar.disabled ? 'true' : 'false'" :aria-label="bar.label" @click="act" @keydown.enter.prevent="act" @keydown.space.prevent="act"><text>{{ bar.label }}</text></view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import EmptyState from "@/components/empty-state.vue";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { onHide, onLoad, onShow } from '@dcloudio/uni-app';
import AppChassis from '@/components/app-chassis.vue';
import SubPageHeader from '@/components/sub-page-header.vue';
import CatalogMachineImage from '@/components/catalog-machine-image.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import PromotionTerms from '@/components/promotion/promotion-terms.vue';
import { promotionApi, remoteApiEnabled, sessionVault } from '@/api/runtime';
import type { PublicPromotion, PublicPurchaseRule } from '@/api/promotion-contracts';
import { useApp } from '@/store/app';
import { useLocaleStore } from '@/store/locale';
import { refreshProductCatalog } from '@/store/product-catalog';
import { useT } from '@/i18n/use-t';
import { fmt, fmtMoney } from '@/i18n/format';
import { landingCopy } from '@/i18n/promotion-landing';
import { navReplace, navTo, takeNavigationQuery } from '@/lib/route';
import { displayDeadline, localized } from '@/lib/promotion-display';
import { formatDayMonth, formatDisplayDateTime, formatDisplayTime } from '@/lib/display-date';
import { createPromotionReadFence, isPromotionActive, promotionDetailHref, promotionDisclosures, promotionStoreHref } from '@/lib/promotion-entry';
import { landingKind, landingProduct, landingProductImage, landingProductName, litePromotion, promotionLandingHref, promotionRemaining, promotionTermsRules, promotionTermsText, rewardParts, rewardPartsText, type RewardParts } from '@/lib/promotion-landing';
import { productCopy } from '@/lib/product-copy';
import { getProductMedia } from '@/lib/product-media';

const app = useApp(), locale = useLocaleStore(), t = useT();
const c = computed(() => landingCopy(locale.code));
const activity = ref<PublicPromotion | null>(null), status = ref<'loading' | 'ready' | 'error'>('loading');
const reading = ref(false);
const readAt = ref(0), now = ref(0), pageVisible = ref(false), termsOpen = ref(false);
const firstOfferId = ref<string | null>(null);
const fence = createPromotionReadFence();
let activityId = '';

const kind = computed(() => activity.value ? landingKind(activity.value) : null);
const rule = computed(() => activity.value?.rewardRules[0] ?? null);
const phase = computed(() => activity.value?.state === 'ACTIVE' ? 'active' : activity.value?.state === 'SCHEDULED' ? 'scheduled' : 'ended');
// A paused offer is closed like an ended one, so it keeps that layout; only its label and note say paused.
const paused = computed(() => activity.value?.state === 'PAUSED');
// The public read answers INELIGIBLE for every offer that is not running, so a refusal only counts while it runs.
const refused = computed(() => phase.value === 'active' && activity.value?.eligibility === 'INELIGIBLE');
const signInNeeded = computed(() => phase.value === 'active' && activity.value?.eligibility === 'SIGN_IN_REQUIRED');
const stateView = computed(() => phase.value !== 'active' || refused.value || signInNeeded.value);
const stageMode = computed(() => phase.value === 'ended' ? 'ended' : signInNeeded.value ? 'signin' : 'full');
const readIdentity = () => `${app.accountKey}:${app.accountBindingEpoch}:${locale.code}`;

// Catalog names and images follow the signed-in session; reading the account keys keeps them reactive.
function productName(sku: string): string { void app.accountKey; void app.accountBindingEpoch; return activity.value ? landingProductName(activity.value, sku) : sku; }
function productImage(sku: string): string | undefined { void app.accountKey; void app.accountBindingEpoch; return landingProductImage(sku); }
const priceText = (price: number) => fmtMoney(price).replace(/^\$/, '').replace(/\.00$/, '');
// Long published amounts step down before they could clip (01.2).
function amountSize(amount: string, hero = false) { return amount.length > 6 ? 'lp-amount--s' : amount.length > 4 || (hero && amount.length > 3) ? 'lp-amount--m' : ''; }
const capText = (limit: PublicPurchaseRule['maxGroups']) => limit.mode === 'LIMITED' ? fmt(c.value.capValue, { n: limit.value }) : c.value.unlimited;
const partsText = (parts: RewardParts) => rewardPartsText(parts, t.value.promotion);
// An order discount is named by its own label, so the amount alone follows it.
const plainAmount = (parts: RewardParts) => parts.asset === 'DISCOUNT' ? `${parts.amount} ${parts.unit}` : partsText(parts);
const rulePartsOf = () => activity.value && rule.value ? rewardParts(activity.value, rule.value.buyerReward) : null;
function shortStart(value: string): string {
  const date = new Date(Date.parse(value)), time = formatDisplayTime(value, false, 0), two = (part: number) => String(part).padStart(2, '0');
  if (locale.code === 'zh') return `${two(date.getUTCMonth() + 1)}/${two(date.getUTCDate())} ${time} UTC`;
  if (locale.code === 'vi') return `${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)} ${time} UTC`;
  if (locale.code !== 'en') return `${formatDayMonth(date.getUTCMonth() + 1, date.getUTCDate(), locale.code, true)} ${time} UTC`;
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)} ${time} UTC`;
}

const navTitle = computed(() => kind.value === 'gift' ? c.value.navGift : kind.value === 'first' ? c.value.navFirst : kind.value === 'repurchase' ? c.value.navRepurchase : c.value.navPending);
const subtitle = computed(() => {
  const parts = rulePartsOf(), discount = parts?.asset === 'DISCOUNT';
  if (kind.value === 'gift') return discount ? c.value.subtitleGiftDiscount : parts && parts.asset !== 'DEVICE' ? fmt(c.value.subtitleGiftReward, { unit: parts.unit }) : c.value.subtitleGift;
  if (kind.value === 'first') return discount ? c.value.subtitleFirstDiscount : fmt(c.value.subtitleFirst, { unit: parts?.unit ?? '' });
  return discount ? c.value.subtitleRepurchaseDiscount : fmt(c.value.subtitleRepurchase, { unit: parts?.unit ?? '' });
});

const eligibilityTag = computed(() => {
  const a = activity.value, k = kind.value;
  if (!a || !k || phase.value !== 'active') return null;
  if (a.eligibility === 'ESTIMATE_ELIGIBLE') return { tone: 'success' as const, text: k === 'gift' ? c.value.eligibleGift : k === 'first' ? c.value.eligibleFirst : c.value.eligibleRepurchase };
  if (a.eligibility === 'INELIGIBLE') return { tone: 'neutral' as const, text: k === 'gift' ? c.value.ineligibleGift : k === 'first' ? c.value.ineligibleFirst : c.value.ineligibleRepurchase };
  if (a.eligibility === 'SIGN_IN_REQUIRED') return { tone: 'neutral' as const, text: t.value.promotion.signIn };
  return null;
});
const timeTag = computed(() => {
  const a = activity.value!;
  if (phase.value === 'scheduled') return { tone: 'brand' as const, text: fmt(c.value.startsAt, { time: shortStart(a.startsAt) }) };
  if (paused.value) return { tone: 'neutral' as const, text: c.value.pausedTag };
  if (phase.value === 'ended') return { tone: 'unavailable' as const, text: t.value.promotion.ended };
  return { tone: 'warning' as const, text: promotionRemaining(a, t.value.promotion) };
});
// The public read has no reason codes, so the App's own copy explains a refusal; a published message wins.
const note = computed(() => {
  const a = activity.value;
  if (!a) return null;
  if (paused.value) return { ended: false, text: c.value.pausedNote };
  if (phase.value === 'ended') return { ended: true, text: fmt(kind.value === 'gift' ? c.value.endedNoteGift : c.value.endedNoteReward, { time: displayDeadline(a.endsAt, locale.code) }) };
  if (phase.value !== 'active') return null;
  const message = localized(a.eligibilityMessage, locale.code);
  if (message) return { ended: false, text: message };
  if (refused.value && kind.value !== 'repurchase') return { ended: false, text: kind.value === 'gift' ? c.value.ineligibleNoteGift : c.value.ineligibleNoteFirst };
  return null;
});
const activityTime = computed(() => activity.value ? fmt(c.value.activityTime, { time: `${formatDisplayDateTime(activity.value.startsAt, locale.code, false, 0)} – ${displayDeadline(activity.value.endsAt, locale.code)}` }) : '');
const limitSentence = computed(() => {
  const r = rule.value;
  if (!r) return '';
  const person = r.maxGroupsPerPerson.mode === 'LIMITED' ? fmt(c.value.personLimited, { n: r.maxGroupsPerPerson.value }) : c.value.personUnlimited;
  const order = r.maxGroups.mode === 'LIMITED' ? fmt(c.value.orderLimited, { n: r.maxGroups.value }) : c.value.orderUnlimited;
  return fmt(c.value.limitSentence, { person, order });
});
const rewardTerms = computed(() => rule.value ? localized(rule.value.buyerReward.disclosure.terms, locale.code) : '');

const stage = computed(() => {
  const a = activity.value, r = rule.value;
  if (!a || !r) return null;
  const parts = rewardParts(a, r.buyerReward);
  return { mainSku: r.productNo, mainName: productName(r.productNo), giftSku: r.buyerReward.type === 'DEVICE' ? r.buyerReward.giftProductNo : null, getLabel: parts.asset === 'DISCOUNT' ? t.value.promotion.orderDiscount : c.value.stageGet, giftText: plainAmount(parts), parts };
});
const giftTickets = computed(() => {
  const a = activity.value;
  if (!a) return [];
  return a.rewardRules.map(r => {
    const reward = r.buyerReward, parts = rewardParts(a, reward), device = reward.type === 'DEVICE';
    const countMode = r.repeatMode === 'PER_GROUP' ? fmt(c.value.perGroup, { n: r.minBuyQty }) : r.minBuyQty > 1 ? fmt(c.value.oncePerOrderMin, { n: r.minBuyQty }) : c.value.oncePerOrder;
    return {
      id: r.ruleId, buySku: r.productNo, buyName: productName(r.productNo), buyQty: fmt(c.value.qtyDevice, { n: r.minBuyQty }),
      giftSku: reward.type === 'DEVICE' ? reward.giftProductNo : null, parts,
      getLabel: parts.asset === 'DISCOUNT' ? t.value.promotion.orderDiscount : c.value.ticketGet,
      getName: device ? parts.unit : plainAmount(parts), getQty: device ? fmt(c.value.qtyGift, { n: parts.amount }) : '',
      cells: [{ label: c.value.countMode, value: countMode }, { label: c.value.orderCap, value: capText(r.maxGroups) }, { label: c.value.personCap, value: capText(r.maxGroupsPerPerson) }],
    };
  });
});
// Benefits appear only when the gift is a device and its rights were published.
const rights = computed(() => {
  const gift = activity.value?.rewardRules.map(r => r.buyerReward).find(reward => reward.type === 'DEVICE' && reward.disclosure.deviceRights);
  const d = gift?.disclosure.deviceRights;
  if (!gift || !d) return null;
  const copy = c.value;
  return {
    name: gift.disclosure.deviceName ?? '', days: d.durationDays,
    effective: d.effectiveOn === 'ISSUED' ? copy.effectiveIssued : copy.effectiveActivated,
    activation: d.activationMode === 'AUTO' ? copy.activationAuto : copy.activationManual,
    task: d.taskEnabled ? copy.taskOn : copy.taskOff,
    flags: [
      { yes: d.countsAsDeviceHolding, text: d.countsAsDeviceHolding ? copy.holdingYes : copy.holdingNo },
      { yes: d.countsForRank, text: d.countsForRank ? copy.rankYes : copy.rankNo },
      { yes: d.transferable, text: d.transferable ? copy.transferYes : copy.transferNo },
      { yes: d.exchangeable, text: d.exchangeable ? copy.exchangeYes : copy.exchangeNo },
    ],
  };
});
const giftTerms = computed(() => {
  const d = rule.value?.buyerReward.disclosure;
  const terms = d ? localized(d.terms, locale.code) : '', refund = d ? localized(d.refundTerms, locale.code) : '';
  return { terms, refund: refund !== terms ? refund : '' };
});

const firstTicket = computed(() => {
  const a = activity.value, r = rule.value;
  if (!a || !r) return null;
  const parts = rewardParts(a, r.buyerReward);
  const limit = r.maxGroupsPerPerson.mode === 'LIMITED' ? fmt(c.value.limitTimes, { n: r.maxGroupsPerPerson.value }) : c.value.limitNone;
  return { parts, label: parts.asset === 'DISCOUNT' ? t.value.promotion.orderDiscount : c.value.firstReward, giftSku: r.buyerReward.type === 'DEVICE' ? r.buyerReward.giftProductNo : null, limit, muted: phase.value === 'ended' || refused.value };
});
// A discount is taken off at checkout; nothing is issued to My rewards.
const steps = computed(() => {
  const discount = rulePartsOf()?.asset === 'DISCOUNT';
  return [{ title: c.value.step1, note: c.value.step1Note }, { title: c.value.step2, note: c.value.step2Note }, discount ? { title: c.value.step3Discount, note: c.value.step3DiscountNote } : { title: c.value.step3, note: c.value.step3Note }];
});
// Counts down to the start of a scheduled offer, otherwise to its end, on the server clock of the read.
const countdown = computed(() => {
  const a = activity.value;
  if (!a || phase.value === 'ended') return null;
  const left = Date.parse(phase.value === 'scheduled' ? a.startsAt : a.endsAt) - Date.parse(a.serverTime) - (now.value - readAt.value);
  if (!Number.isFinite(left)) return null;
  const minutes = Math.max(0, Math.floor(left / 60000)), pad = (value: number) => String(value).padStart(2, '0');
  const [before, after = ''] = (phase.value === 'scheduled' ? c.value.startsIn : c.value.endsIn).split('{time}');
  return { before: before.trim(), after: after.trim(), head: `${Math.floor(minutes / 1440)}d ${pad(Math.floor(minutes % 1440 / 60))}h`, tail: pad(minutes % 60) };
});

const products = computed(() => {
  const a = activity.value;
  if (!a) return [];
  return a.productNos.map(sku => {
    const product = landingProduct(sku), r = a.rewardRules.find(item => item.productNo === sku) ?? a.rewardRules[0];
    const parts = r ? rewardParts(a, r.buyerReward) : null;
    const tag = !parts ? '' : parts.asset === 'DISCOUNT' ? partsText(parts) : fmt(kind.value === 'first' ? c.value.firstTag : c.value.repurchaseTag, { reward: partsText(parts) });
    return {
      sku, name: productName(sku), tagline: product ? productCopy(t.value, product, remoteApiEnabled, locale.code).tagline : '', price: product ? priceText(product.price) : '',
      tag, tagTone: parts?.asset === 'UVT' ? 'uvt' as const : 'warning' as const,
    };
  });
});

// Owned devices are read from the existing fleet snapshot only; without one the row stays hidden.
const ownedDevices = computed(() => {
  void app.accountKey; void app.accountBindingEpoch;
  if (!sessionVault.read() || !app.remoteFleetHasSnapshot) return null;
  return app.devices.filter(device => device.kind !== 'phone' && device.kind !== 'pc-gpu');
});
const slab = computed(() => {
  const a = activity.value, r = rule.value;
  if (!a || !r) return null;
  const parts = rewardParts(a, r.buyerReward), discount = parts.asset === 'DISCOUNT', owned = ownedDevices.value;
  const fleetRow = !!owned && owned.length > 0 && !refused.value;
  const line = refused.value ? (discount ? c.value.emptyLineDiscount : c.value.emptyLine) : fmt(discount ? c.value.addLineDiscount : c.value.addLine, { n: r.minBuyQty, name: productName(r.productNo) });
  const [before, after = ''] = line.split('{reward}');
  return {
    // A refused member with devices gets no count: "N devices" would contradict the first-purchase prompt.
    count: owned && !(refused.value && owned.length > 0) ? owned.length : null, fleetRow, refused: refused.value,
    thumbs: fleetRow ? owned.slice(0, 3).map(device => { const sku = device.kind; return { id: device.id, sku, label: getProductMedia(sku)?.tierCode ?? device.name }; }) : [],
    more: fleetRow && owned.length > 3 ? owned.length - 3 : 0,
    target: r.productNo, targetName: productName(r.productNo), rewardText: partsText(parts), tagText: discount ? partsText(parts) : '+' + partsText(parts), uvt: parts.asset === 'UVT', line: [before, after],
  };
});

type Bar = { wide?: boolean; hint?: string; label: string; variant: 'primary' | 'neutral'; disabled?: boolean; href?: string };
const bar = computed<Bar | null>(() => {
  const a = activity.value, k = kind.value, copy = c.value;
  if (!a || !k) return null;
  if (phase.value === 'scheduled') return { hint: copy.orderAfterStart, label: copy.notStarted, variant: 'primary', disabled: true };
  if (phase.value === 'ended') return { wide: true, label: copy.otherOffers, variant: 'neutral', href: '/pages/events/events' };
  if (refused.value) {
    if (k !== 'repurchase') return { wide: true, label: copy.otherOffers, variant: 'neutral', href: '/pages/events/events' };
    return firstOfferId.value ? { hint: copy.firstHint, label: copy.seeFirst, variant: 'primary', href: promotionLandingHref(firstOfferId.value) } : { wide: true, label: copy.goStore, variant: 'primary', href: promotionStoreHref() };
  }
  if (signInNeeded.value) return { label: copy.signInBuy, variant: 'primary', href: '/pages/login/login?return=' + encodeURIComponent(promotionLandingHref(a.activityId)) };
  return { label: k === 'gift' ? copy.buyNow : k === 'first' ? copy.firstOrder : copy.addNow, variant: 'primary', href: a.productNos.length === 1 ? promotionDetailHref(a.productNos[0], a.activityId) : promotionStoreHref(a.activityId) };
});
// One product shows its name and price; first purchase and multi-product offers lead with the reward.
const barSummary = computed(() => {
  const a = activity.value, parts = rulePartsOf();
  if (!a || !parts) return null;
  const product = kind.value !== 'first' && a.productNos.length === 1 ? landingProduct(a.productNos[0]) : undefined;
  if (product) return { label: product.name, price: priceText(product.price), amount: '', unit: '', uvt: false };
  const device = parts.asset === 'DEVICE';
  const label = parts.asset === 'DISCOUNT' ? t.value.promotion.orderDiscount : kind.value === 'first' ? c.value.firstReward : c.value.rewardLabel;
  return { label, price: '', amount: device ? parts.unit : parts.amount, unit: device ? '× ' + parts.amount : parts.unit, uvt: parts.asset === 'UVT' };
});

function openTerms() { termsOpen.value = true; }
function act() { if (bar.value?.href && !bar.value.disabled) navTo(bar.value.href); }
async function load() {
  if (!pageVisible.value) return;
  const ticket = fence.next(), identity = readIdentity(), signedIn = !!sessionVault.read();
  if (!activityId || !remoteApiEnabled) { status.value = 'error'; return; }
  reading.value = true;
  if (!activity.value) status.value = 'loading';
  // Join the shared catalog read so names, prices and images match the store.
  const catalogRead = signedIn ? refreshProductCatalog() : Promise.resolve(true);
  try {
    const [item] = await Promise.all([promotionApi.get(activityId, signedIn), catalogRead]);
    if (!fence.current(ticket) || identity !== readIdentity()) return;
    if (!landingKind(item)) { void navReplace(promotionStoreHref(activityId)); return; }
    // Lite: phone products and their rules never appear; a phone-only offer is not shown on the web.
    const lite = litePromotion(item);
    if (!lite) { void navReplace('/pages/events/events'); return; }
    activity.value = lite; readAt.value = Date.now(); now.value = readAt.value; status.value = 'ready';
    if (item.template === 'REPURCHASE' && item.state === 'ACTIVE' && item.eligibility === 'INELIGIBLE') void readFirstOffer(ticket, identity, signedIn).catch(() => { /* Without the offer list the store stays the next step. */ });
  } catch (cause) {
    if (!fence.current(ticket) || identity !== readIdentity()) return;
    // A refused session drops the old account's view; any other failure keeps a shown offer as it was.
    if (cause instanceof Error && 'status' in cause && (cause.status === 401 || cause.status === 403)) activity.value = null;
    status.value = 'error';
  } finally {
    if (fence.current(ticket) && identity === readIdentity()) reading.value = false;
  }
}
// Reads on until the first running first-purchase offer; the list has no template filter.
async function readFirstOffer(ticket: number, identity: string, signedIn: boolean) {
  let cursor: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof promotionApi.list>> = await promotionApi.list({ limit: 20, cursor }, signedIn);
    if (!fence.current(ticket) || identity !== readIdentity()) return;
    const offer = page.items.find(item => item.template === 'FIRST_PURCHASE' && isPromotionActive(item) && litePromotion(item));
    if (offer) { firstOfferId.value = offer.activityId; return; }
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor);
  firstOfferId.value = null;
}
function retry() { void load(); }

onLoad(options => {
  const query = new URLSearchParams(takeNavigationQuery('/pages/events/promotion-detail'));
  activityId = String(options?.id ?? query.get('id') ?? '').trim();
});
watch([() => app.accountKey, () => app.accountBindingEpoch], () => {
  fence.invalidate(); activity.value = null; firstOfferId.value = null; termsOpen.value = false; status.value = 'loading';
  void load();
}, { flush: 'sync' });
watch(() => locale.code, () => { fence.invalidate(); void load(); });
// Only the first-purchase countdown ticks, and only while the page is shown.
let ticker: ReturnType<typeof setInterval> | null = null;
watch([() => kind.value === 'first' && phase.value !== 'ended', pageVisible], ([counting, shown]) => {
  if (ticker !== null) { clearInterval(ticker); ticker = null; }
  if (counting && shown) { now.value = Date.now(); ticker = setInterval(() => { now.value = Date.now(); }, 1000); }
});
// When the offer starts or ends while the page is shown, read it once more so eligibility and the action follow.
let boundary: ReturnType<typeof setTimeout> | null = null;
watch([activity, readAt, pageVisible], () => {
  if (boundary !== null) { clearTimeout(boundary); boundary = null; }
  const a = activity.value, edge = a?.state === 'SCHEDULED' ? a.startsAt : a?.state === 'ACTIVE' ? a.endsAt : null;
  if (!a || !edge || !pageVisible.value) return;
  const delay = Date.parse(edge) - Date.parse(a.serverTime) - (Date.now() - readAt.value);
  // A boundary already passed is not re-read in a loop; one beyond the timer range is caught by the next show.
  if (!Number.isFinite(delay) || delay <= 0 || delay > 2_000_000_000) return;
  boundary = setTimeout(() => { boundary = null; void load(); }, delay + 1000);
});
onShow(() => { pageVisible.value = true; void load(); });
onHide(() => { pageVisible.value = false; fence.invalidate(); termsOpen.value = false; });
onBeforeUnmount(() => { pageVisible.value = false; fence.invalidate(); if (ticker !== null) clearInterval(ticker); if (boundary !== null) clearTimeout(boundary); });
useAutoRecovery({ failed: () => remoteApiEnabled && !!activityId && status.value === 'error' && !reading.value, retry: load });
</script>

<style src="../../components/promotion/promotion.css"></style>
<style scoped>
/* Theme strengths from the P-58 boards: ambient light, the device slab and the stage floor. */
.lp { position: relative; overflow-x: clip; color: var(--v5-ink); }
.lp-body { position: relative; padding: 0 16px; }
.lp-fill { position: absolute; inset: 0; }
.lp-card { background: var(--v5-surface); border-radius: var(--ui-radius-surface); box-shadow: var(--v5-glass-shadow); }
.lp-field { display: block; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.lp-tag-icon { margin-right: 4px; flex: none; }
.lp-title { display: block; margin-top: 12px; font: var(--ui-type-page-title-weight) var(--ui-type-page-title)/var(--ui-type-page-title-lh) var(--font-v5); overflow-wrap: anywhere; }
.lp-subtitle { display: block; margin-top: 4px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-section { display: block; margin-top: var(--ui-space-section-gap); }
.lp-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.lp-section-head--start { justify-content: flex-start; gap: 6px; }
.lp-section-title { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); }
.lp-section-note { display: block; margin-top: 4px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-count { font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Text links keep an 18px line; the 44px hit area is an overlay that takes no layout. */
.lp-link { position: relative; display: inline-flex; align-items: center; flex: none; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.lp-link::before { content: ''; position: absolute; inset: -13px -8px; }
.lp-link--block { display: flex; width: fit-content; margin-top: 14px; }
.lp-link:focus-visible, .lp-product:focus-visible, .lp-cta:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
.lp-amount { font-family: var(--font-amount); font-weight: 500; letter-spacing: -.03em; font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.lp-unit { font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-strong { color: var(--v5-ink); font-weight: var(--ui-type-list-title-weight); }
.lp-keep { white-space: nowrap; }

/* Read states (States board, last cell) */
.lp-skel { border-radius: 999px; background: var(--v5-surface-3); }
.lp-skel--tag { width: 88px; height: 24px; }
.lp-skel--chip { width: 56px; height: 24px; }
.lp-skel--title { width: 200px; max-width: 60%; height: 26px; margin-top: 16px; border-radius: 8px; }
.lp-skel-card { display: flex; flex-direction: column; justify-content: center; min-height: 184px; margin-top: 20px; padding: 0 20px; box-sizing: border-box; border-radius: 24px; background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.lp-skel-card__label { font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-skel-card__value { margin-top: 6px; font: 500 40px/44px var(--font-amount); font-variant-numeric: tabular-nums; color: var(--v5-ink-4); }
.lp-recovery { margin-top: 16px; }
.lp-recovery__title { display: block; font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); color: var(--v5-ink); }
.lp-recovery__note { display: block; margin-top: 2px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-recovery .lp-recovery__retry { padding: 0 4px; }

/* Shared icon rows */
.lp-lines { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.lp-line, .lp-note { display: flex; align-items: flex-start; gap: 10px; font: var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5); color: var(--v5-ink-2); overflow-wrap: anywhere; }
.lp-note { margin-top: 16px; }
.lp-note--tight { margin-top: 8px; }
.lp-line-icon { flex: none; margin-top: 1px; color: var(--v5-ink-3); }
.lp-footnote { display: block; margin-top: 16px; font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); color: var(--v5-ink-3); }

/* Gift stage: 222/140 devices on one shared floor; sign-in 210/134; ended 200/128, dimmed. */
.lp-stage { position: relative; height: 268px; margin-top: 4px; }
.lp-stage--signin { height: 250px; }
.lp-stage--ended { height: 226px; }
.lp-stage__machines { position: absolute; inset: 0; }
.lp-stage--ended .lp-stage__machines { opacity: .55; filter: grayscale(.7); }
.lp-stage__main { position: absolute; left: 0; top: 6px; width: 222px; height: 222px; }
.lp-stage__gift { position: absolute; right: 4px; top: 86px; width: 140px; height: 140px; }
.lp-stage--signin .lp-stage__main { width: 210px; height: 210px; }
.lp-stage--signin .lp-stage__gift { top: 82px; width: 134px; height: 134px; }
.lp-stage--ended .lp-stage__main { width: 200px; height: 200px; }
.lp-stage--ended .lp-stage__gift { top: 80px; width: 128px; height: 128px; }
/* Gift badge: the shared frosted material with the neutral 7% fill, no extra sheen. */
.lp-stage__badge.nx-frosted-button { position: absolute; left: 196px; top: 108px; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 7%, transparent); color: var(--v5-warning); }
.lp-stage__reward { position: absolute; right: 14px; top: 96px; display: flex; align-items: baseline; gap: 6px; }
.lp-stage__amount { font-size: 56px; line-height: 60px; }
.lp-stage__label { position: absolute; bottom: 0; display: flex; flex-direction: column; gap: 2px; max-width: 48%; }
.lp-stage__label--buy { left: 18px; }
.lp-stage__label--get { right: 14px; align-items: flex-end; text-align: right; }
.lp-stage--signin .lp-stage__label { gap: 0; }
.lp-stage__buy { font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.lp-stage__get { font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); color: var(--v5-brand); }

/* Gift rule ticket */
.lp-rule { position: relative; margin-top: 12px; }
.lp-rule__row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.lp-rule__art { position: relative; flex: none; width: 48px; height: 48px; display: grid; place-items: center; }
.lp-rule__copy { flex: 1; min-width: 0; }
.lp-rule__name { display: block; margin-top: 2px; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.lp-rule__name--gift { font-weight: var(--ui-type-card-title-weight); color: var(--v5-brand); }
.lp-rule__qty { flex: none; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-rule__tear { position: relative; margin: 0 16px; border-top: 1.5px dashed var(--v5-border-strong); }
.lp-notch { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: var(--v5-bg); }
.lp-rule__tear .lp-notch--left { left: -25px; top: -10px; }
.lp-rule__tear .lp-notch--right { right: -25px; top: -10px; }
.lp-rule__arrow { position: absolute; left: 13px; top: -12px; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: var(--v5-surface-2); color: var(--v5-ink-3); box-shadow: 0 0 0 3px var(--v5-surface); }
.lp-rule__cells { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--v5-border); border-radius: 0 0 var(--ui-radius-surface) var(--ui-radius-surface); background: var(--v5-surface-2); }
.lp-rule__cell { min-width: 0; padding: 12px 12px 12px 16px; }
.lp-rule__cell + .lp-rule__cell { padding-left: 12px; }
.lp-rule__value { display: block; margin-top: 4px; font: var(--ui-type-list-title-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }

/* Reward coins: UVT purple stays a flat identifier (01.1.2); the glyph is white in both themes, as on the wallet coins. */
.lp-coin { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 999px; color: white; font: 500 22px/1 var(--font-amount); font-variant-numeric: tabular-nums; box-shadow: inset 0 2px 4px color-mix(in srgb, white 35%, transparent), inset 0 -3px 6px color-mix(in srgb, black 18%, transparent); }
.lp-coin--small { width: 40px; height: 40px; font-size: 17px; }
.lp-coin--uvt { background: var(--v5-nex); }
.lp-coin--usdt { background: var(--v5-warning); }
.lp-coin--muted { background: var(--v5-surface-3); color: var(--v5-ink-4); box-shadow: none; }

/* Device rights */
.lp-rights { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.lp-rights__term { grid-row: span 2; display: flex; flex-direction: column; min-width: 0; padding: 16px; border-radius: 20px; }
.lp-rights__days { display: flex; align-items: baseline; gap: 4px; margin-top: auto; padding-top: 12px; }
.lp-rights__number { font: 500 40px/44px var(--font-metric); letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.lp-rights__unit { font: var(--ui-type-list-title-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-rights__long { font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); color: var(--v5-ink); }
.lp-rights__effective { display: block; margin-top: 6px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-rights__cell { min-width: 0; padding: 14px; border-radius: 20px; }
.lp-rights__value { display: block; margin-top: 4px; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.lp-rights__flags { grid-column: span 2; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 20px; }
.lp-rights__flag { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 14px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink); }
.lp-rights__flag:nth-child(n+3) { padding-top: 0; }
.lp-flag-mark { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; background: var(--v5-surface-3); color: var(--v5-ink-3); }
.lp-flag-mark--yes { background: var(--v5-success-soft); color: var(--v5-success-ink); }

/* First-purchase ticket */
.lp-ticket { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 108px; min-height: 184px; margin-top: 20px; border-radius: 24px; background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); overflow: hidden; }
.lp-ticket__main { display: flex; flex-direction: column; min-width: 0; padding: 20px 20px 18px; }
.lp-ticket__label { display: block; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-ticket__value { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: 6px; min-width: 0; }
.lp-ticket__amount { font-size: 64px; line-height: 64px; }
.lp-ticket__unit { font: var(--ui-type-list-title-weight) var(--ui-type-card-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }
.lp-amount--m { font-size: 48px; line-height: 52px; }
.lp-amount--s { font-size: 36px; line-height: 40px; }
.lp-countdown { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: auto; padding-top: 12px; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-countdown__time { font: 500 12px/16px var(--font-jet-mono); font-variant-numeric: tabular-nums; color: var(--v5-ink); white-space: nowrap; }
.lp-ticket__stub { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 12px 8px; background: var(--v5-surface-2); text-align: center; }
.lp-ticket__gift { position: relative; width: 64px; height: 64px; }
.lp-ticket__limit-value { display: block; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.lp-ticket__unavailable { font: var(--ui-type-list-title-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-ticket__tear { position: absolute; right: 107px; top: 14px; bottom: 14px; border-left: 1.5px dashed var(--v5-border-strong); }
.lp-ticket .lp-notch { right: 98px; width: 20px; height: 20px; }
.lp-ticket .lp-notch--top { top: -10px; }
.lp-ticket .lp-notch--bottom { bottom: -10px; }
.lp-ticket--muted .lp-ticket__amount, .lp-ticket--muted .lp-ticket__unit { color: var(--v5-ink-4); }

.lp-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.lp-step { min-width: 0; padding: 14px 12px; border-radius: 18px; }
.lp-step__number { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 12px/16px var(--font-jet-mono); }
.lp-step__title { display: block; margin-top: 12px; font: var(--ui-type-list-title-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.lp-step__note { display: block; margin-top: 4px; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); overflow-wrap: anywhere; }

/* Product cards: 104px art on first purchase, 100px on repurchase. */
.lp-product { display: flex; align-items: center; gap: 14px; margin-top: 12px; padding: 12px 14px 12px 12px; cursor: pointer; }
.lp-product__art { position: relative; flex: none; width: 112px; height: 112px; border-radius: 16px; background: var(--v5-surface-2); overflow: hidden; }
.lp-product__art > .lp-fill { inset: 4px; }
.lp--repurchase .lp-product__art > .lp-fill { inset: 6px; }
.lp-product__copy { flex: 1; min-width: 0; }
.lp-product__name { display: block; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.lp-product__tagline { display: block; margin-top: 2px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-product__tag { margin-top: 8px; }
.lp-product__chevron { flex: none; color: var(--v5-ink-4); }
.lp-price { display: flex; align-items: baseline; gap: 2px; margin-top: 8px; }
.lp-price__currency { font: 500 12px/16px var(--font-amount); font-variant-numeric: tabular-nums; color: var(--v5-ink-3); }
.lp-price__value { font: 500 20px/24px var(--font-amount); letter-spacing: -.01em; font-variant-numeric: tabular-nums; color: var(--v5-ink); }

/* Repurchase slab: the shared frosted material with the board's fill, rim and light shadow only. */
.lp-slab-wrap { position: relative; margin-top: 20px; }
.lp-slab.nx-soft-glass { position: relative; display: block; padding: 18px; border-radius: 26px; color: var(--v5-ink); }
.lp-slab__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.lp-slab__label { font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-slab__count { font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.lp-slab__count-number { font: 500 15px/20px var(--font-jet-mono); color: var(--v5-ink); }
/* Owned devices, "+" and the empty slot sit side by side from the left, whatever the count. */
.lp-slab__fleet { display: flex; align-items: flex-end; gap: 6px; margin-top: 14px; }
.lp-owned { flex: 0 1 60px; min-width: 0; text-align: center; }
.lp-owned__art { position: relative; width: 100%; aspect-ratio: 1; }
.lp-owned__more { position: absolute; right: -6px; top: -6px; z-index: 1; min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: var(--v5-surface-3); color: var(--v5-ink-2); font: var(--ui-type-chip-weight) var(--ui-type-chip)/22px var(--font-v5); text-align: center; }
.lp-owned__name { display: block; margin-top: 2px; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lp-slab__plus { flex: none; align-self: center; margin: 0 4px 18px; color: var(--v5-ink-4); }
.lp-target { position: relative; flex: none; width: 88px; text-align: center; }
.lp-target__art { display: grid; place-items: center; width: 88px; height: 88px; box-sizing: border-box; border: 1.5px dashed var(--v5-aura-sky); border-radius: 20px; }
.lp-target__image { width: 74px; height: 74px; }
.lp-target__name { display: block; margin-top: 2px; font: var(--ui-type-chip-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; }
/* The UVT tag sits on a near-opaque ring of the slab colour so the dashed slot never shows through. */
.lp-target__tag { position: absolute; right: -10px; top: -12px; display: flex; border-radius: 999px; background: color-mix(in srgb, var(--v5-surface) 90%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--v5-surface) 90%, transparent); }
.lp-slab__solo { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.lp-slab__solo:first-child { margin-top: 0; }
.lp-slab__solo--muted .lp-target { flex: 0 1 88px; min-width: 0; }
.lp-slab__solo--muted .lp-target__art { width: 100%; border-color: var(--v5-border-strong); opacity: .7; }
.lp-slab__solo--muted .lp-target__image { max-width: 100%; }
.lp-slab__solo--muted .lp-slab__text { flex: 0 1 auto; }
.lp-slab__solo--muted .lp-target__image { filter: grayscale(.6); }
.lp-slab__text { flex: 1; min-width: 0; font: var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5); color: var(--v5-ink-2); overflow-wrap: anywhere; }
.lp-slab__foot { display: block; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--v5-border); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-subheading-lh) var(--font-v5); color: var(--v5-ink); }

/* Bottom action bar (DS-30), shared soft glass: the last line sits about 30px above it. */
.lp-bar-space { height: calc(80px + env(safe-area-inset-bottom)); }
.lp-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px calc(30px + env(safe-area-inset-bottom)); animation: lp-bar .45s cubic-bezier(.2,.8,.2,1) .2s backwards; }
.lp-bar__info { flex: 1; min-width: 0; }
.lp-bar__hint { font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.lp-bar .lp-price { margin-top: 2px; }
.lp-price--bar .lp-price__currency { font-size: 13px; line-height: 18px; }
.lp-bar .lp-price__value { font-size: 24px; line-height: 28px; letter-spacing: -.02em; }
.lp-bar__reward { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; margin-top: 2px; }
.lp-bar__unit { font: var(--ui-type-chip-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Approved offer action (03.1): L size, button role type; primary is a solid brand fill, neutral the 7% glass, both with the shared rim. */
.lp-cta.promotion-action { flex: none; min-width: min(172px, 50%); height: 48px; min-height: 48px; padding: 0 20px; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); cursor: pointer; }
.lp-cta--primary.promotion-action { background: var(--v5-brand); }
.lp-cta--neutral.promotion-action { background: color-mix(in srgb, var(--v5-ink) 7%, transparent); }
.lp-cta.promotion-action[aria-disabled=true], .lp-cta.promotion-action[aria-disabled=true]:active { opacity: .5; transform: none; cursor: default; }
.lp-bar--wide .lp-cta { flex: 1; }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .lp-cta--neutral.promotion-action { background: var(--v5-surface-2); }
  .lp-slab.nx-soft-glass { background: var(--v5-surface-2); }
}

/* UVT units stay purple wherever they sit (01.1.1); declared after the unit roles above. */
.lp-unit--uvt { color: var(--v5-nex-ink); }

/* Motion: one-time entrance, 0.97 press; only the countdown colon keeps moving. */
@keyframes lp-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes lp-stage { from { opacity: 0; transform: translateY(18px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes lp-pop { 0% { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
@keyframes lp-slot { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes lp-bar { from { transform: translateY(100%); } to { transform: none; } }
@keyframes lp-tick { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .35; } }
.lp-rise { animation: lp-rise .5s cubic-bezier(.2,.8,.2,1) backwards; }
.lp-d1 { animation-delay: .06s; } .lp-d2 { animation-delay: .12s; } .lp-d3 { animation-delay: .18s; } .lp-d4 { animation-delay: .24s; } .lp-d5 { animation-delay: .3s; }
.lp-enter-main { animation: lp-stage .6s cubic-bezier(.2,.8,.2,1) .05s backwards; }
.lp-enter-gift { animation: lp-stage .6s cubic-bezier(.2,.8,.2,1) .25s backwards; }
.lp-pop { animation: lp-pop .45s cubic-bezier(.2,.8,.2,1) .5s backwards; }
.lp-own { animation: lp-rise .45s cubic-bezier(.2,.8,.2,1) backwards; }
.lp-own--0 { animation-delay: .15s; } .lp-own--1 { animation-delay: .22s; } .lp-own--2 { animation-delay: .29s; }
.lp-slot { animation: lp-slot .5s cubic-bezier(.2,.8,.2,1) .42s backwards; }
.lp-slot .lp-pop { animation-delay: .7s; }
.lp-tick { animation: lp-tick 1s steps(1) infinite; }
.lp-press { transition: transform 120ms ease-out; }
.lp-press:active { transform: scale(.97); }

@media (max-width: 374px) {
  .lp-stage, .lp-stage--signin { height: calc(46px + 58vw); }
  .lp-stage--ended { height: calc(26px + 54vw); }
  .lp-stage__main, .lp-stage--signin .lp-stage__main, .lp-stage--ended .lp-stage__main { width: 60%; height: auto; aspect-ratio: 1; }
  .lp-stage__gift, .lp-stage--signin .lp-stage__gift, .lp-stage--ended .lp-stage__gift { width: 38%; height: auto; aspect-ratio: 1; }
  .lp-stage__badge.nx-frosted-button { left: 53%; }
  .lp-product__art { width: 88px; height: 88px; }
  .lp-ticket { grid-template-columns: minmax(0, 1fr) 96px; }
  .lp-ticket__tear { right: 95px; }
  .lp-ticket .lp-notch { right: 86px; }
  .lp-rule__cell, .lp-rule__cell + .lp-rule__cell { padding: 12px 8px 12px 12px; }
  .lp-target, .lp-target__art { width: 76px; }
  .lp-target__art { height: 76px; }
  .lp-target__image { width: 64px; height: 64px; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-rise, .lp-enter-main, .lp-enter-gift, .lp-pop, .lp-own, .lp-slot, .lp-bar, .lp-tick { animation: none; }
  .lp-press { transition: none; }
  .lp-press:active, .lp-cta.promotion-action:active { transform: none; }
}
</style>
