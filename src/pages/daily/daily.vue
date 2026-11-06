<!--
  Daily Check-in (P-65) — streak energy ring + milestone tickets + streak
  power-ups + streak saver + top-streakers podium + UVT card + recent history,
  with the check-in action in a fixed bottom bar (DS-30).

  Wrapped in <AppChassis active="me"> (reached from /me/wallet). Uses the points
  store (signIn / claimMilestone / useSaver / streak / history). USDT/UVT
  milestone rewards credit the wallet + write a bill (composed in the handler).
  The Day-30 "Lucky Spin" milestone grants a bonus spin ticket and opens the
  Lucky Spin sheet (useLuckySpin.grantBonusTicket + openSheet); badge stays a
  toast-only unlock. Haptic feedback → uni.vibrateShort. TOP_STREAKERS is faithful mock data.
  The ring covers the current milestone stage; a successful check-in fills
  today's segment, bursts once and floats the actual reward (07 签到成功奖励).
-->
<template>
  <AppChassis active="me">
    <view class="dly" :class="{ 'dly--instant': returned }">
      <SubPageHeader back="/pages/me/me" plain />



      <!-- Streak energy ring -->
      <view class="dly-hero" :class="{ 'dly-hero--glow': dailyFactsVisible }" :role="dailyFactsVisible ? undefined : 'status'" :aria-label="t.daily.activeStreak">
        <view ref="ringRef" class="dly-rw" :class="{ 'nx-loops-paused': !ringLoops.running.value }">
          <svg v-if="!dailyFactsVisible" class="dly-ring" width="248" height="248" viewBox="0 0 248 248" aria-hidden="true"><circle class="dly-ring__ph" cx="124" cy="124" r="104" /></svg>
          <svg v-else class="dly-ring" width="248" height="248" viewBox="0 0 248 248" role="img" :aria-label="ringLabel">
            <circle v-for="s in ringSegments" :key="`t${s.i}`" class="dly-ring__tr" cx="124" cy="124" r="104" :stroke-dasharray="s.dash" :stroke-linecap="ringCap" :transform="`rotate(${s.rotate} 124 124)`" />
            <circle v-for="s in ringSegments.slice(0, ring.done)" :key="`d${s.i}`" class="dly-ring__dn" :class="{ 'dly-ring__dn--new': successFx && s.i === ring.done - 1 }" cx="124" cy="124" r="104" :stroke-dasharray="s.dash" :stroke-linecap="ringCap" :transform="`rotate(${s.rotate} 124 124)`" :style="{ stroke: ringDoneStroke(s.i), '--i': s.i }" />
            <circle v-if="ringTodayIndex !== null" class="dly-ring__td" :class="{ 'dly-ring__td--breathe': ringBreathing }" cx="124" cy="124" r="104" :stroke-dasharray="ringSegments[ringTodayIndex].dash" :stroke-linecap="ringCap" :transform="`rotate(${ringSegments[ringTodayIndex].rotate} 124 124)`" />
          </svg>
          <template v-if="dailyFactsVisible">
            <view class="dly-spk" style="left: -18px; top: 70px; width: 6px; height: 6px; background: var(--v5-warning); opacity: .7" />
            <view class="dly-spk" style="left: -4px; top: 186px; width: 4px; height: 4px; background: var(--v5-brand-2); opacity: .6" />
            <view class="dly-spk" style="right: -20px; top: 52px; width: 4px; height: 4px; background: var(--v5-brand-2); opacity: .6" />
            <view class="dly-spk" style="right: -12px; top: 170px; width: 7px; height: 7px; background: var(--v5-warning); opacity: .5" />
            <view v-if="ring.next !== null" class="dly-gift" :class="{ 'dly-gift--reached': ring.reached }" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>
            </view>
          </template>
          <view class="dly-ctr" aria-hidden="true">
            <svg v-if="dailyFactsVisible" class="dly-flame" :class="{ 'dly-flame--off': successFx && successFx.atRing }" width="30" height="30" viewBox="0 0 24 24"><defs><linearGradient id="dly-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color: var(--v5-brand-2)" /><stop offset="1" style="stop-color: var(--v5-warning)" /></linearGradient></defs><path fill="url(#dly-flame)" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
            <text class="dly-num" :class="{ 'dly-num--q': !dailyFactsVisible }">{{ dailyFactsVisible ? displayStreak : '—' }}</text>
            <text class="dly-lbl">{{ t.daily.activeStreak }}</text>
          </view>
          <view v-if="successFx" :key="`b${successFx.key}`" class="dly-burst" :style="burstStyle" aria-hidden="true">
            <view class="dly-burst__ring" />
            <view v-for="r in 8" :key="r" class="dly-burst__ray" :style="{ transform: `rotate(${(r - 1) * 45}deg)` }" />
          </view>
          <view v-if="successFx && successFx.atRing" :key="`f${successFx.key}`" class="dly-fly" role="status">
            <text>+{{ successFx.amount }}</text><text class="dly-fly__u">UVT</text><text v-if="successFx.multiplier > 1" class="dly-fly__u">{{ successFx.multiplier }}×</text>
            <text class="dly-sr">{{ successFx.summary }}</text>
          </view>
        </view>
        <template v-if="!dailyFactsVisible">
          <text v-if="!remoteRefreshError && faucet.remoteReadState !== 'error'" class="dly-next dly-next--mut">{{ t.daily.loading }}</text>
        </template>
        <template v-else>
          <text class="dly-next">{{ heroLine.before }}<text v-if="heroLine.reward" class="dly-next__r">{{ heroLine.reward }}</text>{{ heroLine.after }}</text>
          <view v-if="luckyOdds" class="dly-lucky">
            <view class="dly-lucky__k">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="16" cy="8" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="8" cy="16" r="1.2" fill="currentColor" /><circle cx="16" cy="16" r="1.2" fill="currentColor" /></svg>
              <text>{{ t.daily.luckyLabel }}</text>
            </view>
            <view class="dly-chip"><text class="dly-chip__m">1.5×</text><text>{{ luckyOdds.p15 }}%</text></view>
            <view class="dly-chip"><text class="dly-chip__m">2×</text><text>{{ luckyOdds.p2 }}%</text></view>
          </view>
          <text v-else class="dly-lucky dly-lucky--hint">{{ t.daily.luckyHint }}</text>
        </template>
      </view>

      <!-- Streak saver: right under the ring while it can restore a broken streak -->
      <view v-if="streakBroken" class="dly-sec">
        <view class="dly-sv dly-sv--br">
          <view class="dly-stk" aria-hidden="true"><view class="dly-stk__a" /><view class="dly-stk__b"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg></view><text class="dly-stk__n">×{{ dailyFactsVisible ? faucet.streakSavers : '—' }}</text></view>
          <view class="dly-svt"><text class="dly-svt__h">{{ t.daily.saver.label }}</text><text>{{ saverHeadlineText }}</text><text>{{ dailyFactsVisible ? saverCountText : '—' }}</text></view>
          <view class="dly-svb-hit" role="button" tabindex="0" :aria-disabled="!streakBroken || remoteRefreshing || saverSubmitting ? 'true' : 'false'" @click="handleUseSaver" @keydown.enter.prevent="handleUseSaver" @keydown.space.prevent="handleUseSaver">
            <view class="dly-svb nx-frosted-button dly-svb--on" :class="{ 'dly-svb--off': remoteRefreshing || saverSubmitting }"><text>{{ t.daily.saver.use }}</text></view>
          </view>
        </view>
      </view>

      <!-- Milestone rewards (while loading: placeholder tickets right under the ring, no title) -->
      <view class="dly-sec" :class="{ 'dly-sec--sk': !dailyFactsVisible }">
        <view v-if="dailyFactsVisible" class="dly-sh">
          <text class="dly-sh__h">{{ t.daily.milestones.label }}</text>
          <text v-if="dailyFactsVisible && claimableCount > 0" class="dly-pill">{{ fmt(t.daily.milestones.claimableCount, { n: claimableCount }) }}</text>
        </view>
        <scroll-view scroll-x class="dly-rail" :scroll-left="railLeft" :show-scrollbar="false">
          <view class="dly-rail__track">
            <template v-if="!dailyFactsVisible">
              <view v-for="n in 3" :key="n" class="dly-tk dly-tk--sk" aria-hidden="true"><view class="dly-tk__tp"><view class="dly-bone" style="width: 48px" /><view class="dly-bone" style="width: 32px; margin-top: auto" /><view class="dly-bone" style="width: 64px; height: 18px; margin-top: 8px" /></view></view>
            </template>
            <view v-for="(m, i) in (dailyFactsVisible ? milestones : [])" v-else :key="m.day" class="dly-rail__item" :style="{ '--i': i }">
              <view class="dly-tk" :class="{ 'dly-tk--got': isMilestoneClaimed(m), 'dly-tk--can': isMilestoneUnlocked(m) && !isMilestoneClaimed(m) }">
                <view v-if="isMilestoneUnlocked(m) && !isMilestoneClaimed(m)" class="dly-tk__sheen" aria-hidden="true"><view /></view>
                <view class="dly-tk__tp">
                  <view class="dly-tk__d">
                    <text>{{ m.labelText ?? t.daily.milestones[m.labelKey] }}</text>
                    <view v-if="isMilestoneClaimed(m)" class="dly-tk__ck" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></view>
                    <view v-else-if="m.reward.type !== 'unknown'" class="dly-tk__ti" aria-hidden="true">
                      <svg v-if="m.reward.type === 'uvt'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-nex-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></svg>
                      <svg v-else-if="m.reward.type === 'usdt'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                      <svg v-else-if="m.reward.type === 'spin'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>
                      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>
                    </view>
                  </view>
                  <text v-if="ticketUnit(m)" class="dly-tk__u" :class="{ 'dly-tk__u--nx': m.reward.type === 'uvt' }">{{ ticketUnit(m) }}</text>
                  <text class="dly-tk__v" :class="{ 'dly-tk__v--t': m.reward.type === 'badge' || m.reward.type === 'unknown' }">{{ ticketValue(m) }}</text>
                </view>
                <view class="dly-tk__pf" />
                <view class="dly-tk__sb">
                  <view v-if="isMilestoneUnlocked(m) && !isMilestoneClaimed(m)" class="dly-claim active:opacity-85" role="button" tabindex="0" aria-disabled="false" @click="handleClaimMilestone(m)" @keydown.enter.prevent="handleClaimMilestone(m)" @keydown.space.prevent="handleClaimMilestone(m)"><text>{{ t.daily.milestones.claim }}</text></view>
                  <view v-else class="dly-tk__st" role="button" tabindex="0" aria-disabled="true" @click="handleClaimMilestone(m)" @keydown.enter.prevent="handleClaimMilestone(m)" @keydown.space.prevent="handleClaimMilestone(m)">
                    <text v-if="isMilestoneClaimed(m)">{{ t.daily.milestones.claimed }}</text>
                    <text v-else-if="m.day === nextLockedDay" class="dly-tk__nxt">{{ daysLeftText(m.day) }}</text>
                    <template v-else>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      <text>{{ daysLeftText(m.day) }}</text>
                    </template>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- Streak Power-Ups -->
      <StreakPowerUps class="dly-sec" :facts-visible="dailyFactsVisible" />

      <!-- Streak saver (resting place while the streak is intact) -->
      <view v-if="!streakBroken" class="dly-sec">
        <view class="dly-sv dly-card">
          <view class="dly-stk" aria-hidden="true"><view class="dly-stk__a" /><view class="dly-stk__b"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg></view><text class="dly-stk__n">×{{ dailyFactsVisible ? faucet.streakSavers : '—' }}</text></view>
          <view class="dly-svt"><text class="dly-svt__h">{{ t.daily.saver.label }}</text><text>{{ saverHeadlineText }}</text><text>{{ dailyFactsVisible ? saverCountText : '—' }}</text></view>
          <view class="dly-svb-hit" role="button" tabindex="0" aria-disabled="true" @click="handleUseSaver" @keydown.enter.prevent="handleUseSaver" @keydown.space.prevent="handleUseSaver">
            <view class="dly-svb nx-frosted-button dly-svb--off"><text>{{ t.daily.saver.use }}</text></view>
          </view>
        </view>
      </view>

      <!-- Top Streakers -->
      <view class="dly-sec">
        <view class="dly-sh">
          <text class="dly-sh__h">{{ t.daily.topStreakers.label }}</text>
          <text class="dly-meta">{{ dailyFactsVisible ? yourBestParts.before : '—' }}<text v-if="dailyFactsVisible" class="dly-meta__b">{{ yourBestParts.n }}</text>{{ dailyFactsVisible ? yourBestParts.after : '' }}</text>
        </view>
        <view v-if="dailyFactsVisible" class="dly-lb dly-card">
          <EmptyState v-if="leaderRows.length === 0" kind="empty-list" :title="t.empty.listTitle" :desc="t.empty.listDesc" compact />
          <template v-else>
            <view class="dly-pod">
              <view v-for="p in podium" :key="p.name" class="dly-pc" :style="{ gridColumn: p.rank === 1 ? 2 : p.rank === 2 ? 1 : 3, '--t': p.rank === 1 ? 'var(--v5-warning)' : p.rank === 2 ? 'var(--v5-aura-sky)' : 'var(--v5-brand-2)' }">
                <view class="dly-av" :class="{ 'dly-av--big': p.rank === 1 }">
                  <svg v-if="p.rank === 1" class="dly-crown" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /></svg>
                  <text>{{ p.initial }}</text>
                </view>
                <text class="dly-pn">{{ p.name }}</text>
                <view class="dly-pd"><text>{{ p.countryCode }}</text><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg><text class="dly-pd__b">{{ p.streak }}</text></view>
                <view class="dly-pl" :class="`dly-pl--${p.rank}`"><text>{{ p.rank }}</text></view>
              </view>
            </view>
            <view v-for="(s, i) in leaderRest" :key="s.name" class="dly-lr">
              <text class="dly-lr__rk">{{ i + 4 }}</text>
              <view class="dly-lr__n"><text class="dly-lr__name">{{ s.name }}</text><text class="dly-lr__cc">{{ s.countryCode }}</text></view>
              <view class="dly-lr__s"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg><text>{{ s.streak }}</text></view>
            </view>
          </template>
        </view>
      </view>

      <!-- UVT -->
      <view class="dly-sec">
        <view class="dly-wl dly-card">
          <view class="dly-wk"><text>{{ t.daily.balance }}</text><view class="dly-uvt"><text class="dly-uvt__i">U</text><text>{{ t.daily.points }}</text></view></view>
          <view class="dly-wa">
            <template v-if="balanceParts"><text class="dly-wa__i">{{ balanceParts.whole }}</text><text class="dly-wa__c">{{ balanceParts.fraction }}</text></template>
            <text v-else class="dly-wa__i">—</text>
            <text class="dly-wa__u">{{ t.daily.points }}</text>
          </view>
          <view class="dly-w2">
            <view><text>{{ t.daily.lifetime }} · {{ t.daily.earned }}</text><text class="dly-w2__b">{{ lifetimeEarned }}</text></view>
            <view><text>{{ t.daily.spent }} · {{ t.daily.onPayouts }}</text><text class="dly-w2__b">{{ lifetimeSpent }}</text></view>
          </view>
          <text v-if="remoteApiEnabled" class="dly-wn">{{ t.daily.ledgerScope }}</text>
          <view v-if="remoteApiEnabled && app.remoteFleetStatus === 'error'" class="dly-wn" role="status">
            <text class="block">{{ app.remoteFleetHasSnapshot ? t.wallet.fundsStaleBody : t.wallet.fundsUnavailableBody }}</text>

          </view>
          <text v-if="remoteApiEnabled && summaryForDisplay != null && (summaryForDisplay?.settledRewardsNex == null || summaryForDisplay?.withdrawalOffsetNexSpent == null)" class="dly-wn">{{ t.home.quickFactsFailed }}</text>
          <view class="dly-wlk active:opacity-70" role="button" tabindex="0" @click="goWithdraw" @keydown.enter.prevent="goWithdraw" @keydown.space.prevent="goWithdraw">
            <view class="dly-wlk__l"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg><text>{{ pointsUnlockText }}</text></view>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>
      </view>

      <!-- History -->
      <view class="dly-sec">
        <view class="dly-sh"><text class="dly-sh__h">{{ t.daily.recent }}</text></view>
        <view class="dly-hs">
          <view v-if="remoteApiEnabled && summaryForDisplay == null" class="dly-hs__msg">
            <text>{{ bills.summaryStatus === 'error' ? '—' : t.home.quickFactsLoading }}</text>

          </view>
          <EmptyState v-else-if="historyRows.length === 0" kind="empty-list" :title="t.empty.listTitle" :desc="t.empty.listDesc" compact />
          <view v-for="(h, i) in historyRows" v-else :key="`${h.ts}-${i}`" class="dly-hr">
            <view class="dly-hr__w"><text class="dly-hr__t">{{ h.reason }}</text><text class="dly-hr__ts">{{ formatTs(h.ts) }}</text></view>
            <text class="dly-hr__dl" :class="{ 'dly-hr__dl--p': h.delta > 0 }">{{ h.delta > 0 ? "+" : "" }}{{ formatAmount(h.delta) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Check-in sits in the thumb zone (DS-30). -->
    <template #pageFixed>
      <view class="dly-bar">
        <!-- The ring is scrolled away: the same reward rises above the bar instead. -->
        <view v-if="successFx && !successFx.atRing" :key="`bf${successFx.key}`" class="dly-fly dly-fly--bar" role="status">
          <view class="dly-fly__pill"><text>+{{ successFx.amount }}</text><text class="dly-fly__u">UVT</text><text v-if="successFx.multiplier > 1" class="dly-fly__u">{{ successFx.multiplier }}×</text></view>
          <text class="dly-sr">{{ successFx.summary }}</text>
        </view>
        <view v-if="dailyFactsVisible && lastSignedToday" class="dly-done nx-frosted-button" role="status">
          <view class="dly-done__ok"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></view>
          <text class="dly-done__t">{{ t.daily.checkedInShort }}</text>
          <view class="dly-done__cd">
            <svg class="dly-done__clk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            <text v-if="countdownParts.before">{{ countdownParts.before }}</text>
            <text class="dly-done__time">{{ countdownParts.time }}</text>
            <text v-if="countdownParts.after">{{ countdownParts.after }}</text>
          </view>
        </view>
        <view v-else-if="!checkInStateConfirmed" class="dly-cta dly-cta--sync" role="status"><text>{{ t.daily.checkInUnconfirmed }}</text></view>
        <view v-else class="dly-cta active:opacity-90" role="button" tabindex="0" :aria-busy="checkInSubmitting ? 'true' : 'false'" :aria-disabled="lastSignedToday || remoteRefreshing || checkInSubmitting || !checkInStateConfirmed ? 'true' : 'false'" @click="handleCheckIn" @keydown.enter.prevent="handleCheckIn" @keydown.space.prevent="handleCheckIn">
          <view class="dly-cta__sheen" aria-hidden="true" />
          <view v-if="checkInSubmitting" class="dly-cta__spin" aria-hidden="true" />
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
          <text>{{ checkInCtaText }}</text>
        </view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useSlotActionSheet } from "@/store/slot-action-sheet";
import { formatGroupedAmount as formatAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";
import SubPageHeader from "@/components/sub-page-header.vue";
import StreakPowerUps from "@/components/daily/streak-power-ups.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { dateLocale, fmt } from "@/i18n/format";
import { formatTrialDateTime } from "@/lib/trial-date";
import { useNexFaucet } from "@/store/nex-faucet";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { resolveWalletBillMemo } from "@/lib/wallet-bill-display";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { remoteApiEnabled, sessionVault, apiRuntimeConfig } from "@/api/runtime";
import { useAuth } from "@/store/auth";
import { binarySessionReady as accountSessionReady } from "@/lib/binary-session-ready";
import { createScopedReadCoalescer } from "@/lib/binary-read-coalescer";
import { captureRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { postMoneyBillsOnce } from "@/lib/money-receipt";
import { useLuckySpin } from "@/store/lucky-spin";
import { toast } from "@/store/ui";
import { dailyBadgeName, dailyBaseReward, dailyLuckyOdds, dailyMilestoneRewardKind, dailyMilestoneRewardText, type DailyMilestoneRewardKind, dailyRewardLabels, dailyStreakRing, dailyUpcomingMilestone } from "./daily-reward-view";
import { dailyCheckInSuccessCopy } from "./daily-success-copy";
import { uiLocale } from "@/i18n";

const ONE_DAY_MS = 86400 * 1000;

interface Milestone {
  day: number;
  rewardKey: "reward3" | "reward7" | "reward14" | "reward21" | "reward30" | "reward60" | "reward100";
  labelKey: "day3" | "day7" | "day14" | "day21" | "day30" | "day60" | "day100";
  reward: { type: DailyMilestoneRewardKind; amount: number };
  tint: string;
  iconPath: string;
  iconPath2?: string;
  labelText?: string;
  rewardText?: string;
  badgeName?: string;
  status?: "LOCKED" | "CLAIMABLE" | "CLAIMED";
}

// Icon paths (lucide): Sparkles / Gift / TrendingUp / Star / Trophy / ShieldCheck.
const MILESTONES: Milestone[] = [
  { day: 3, rewardKey: "reward3", labelKey: "day3", reward: { type: "uvt", amount: 5 }, tint: "var(--v5-nex)", iconPath: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" },
  { day: 7, rewardKey: "reward7", labelKey: "day7", reward: { type: "uvt", amount: 15 }, tint: "var(--v5-nex)", iconPath: "M20 12v10H4V12", iconPath2: "M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7" },
  { day: 14, rewardKey: "reward14", labelKey: "day14", reward: { type: "usdt", amount: 1 }, tint: "var(--v5-warning)", iconPath: "M16 7h6v6", iconPath2: "m22 7-8.5 8.5-5-5L2 17" },
  { day: 21, rewardKey: "reward21", labelKey: "day21", reward: { type: "uvt", amount: 100 }, tint: "var(--v5-nex)", iconPath: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" },
  { day: 30, rewardKey: "reward30", labelKey: "day30", reward: { type: "spin", amount: 1 }, tint: "var(--v5-brand-2)", iconPath: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6", iconPath2: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" },
  { day: 60, rewardKey: "reward60", labelKey: "day60", reward: { type: "usdt", amount: 10 }, tint: "var(--v5-warning)", iconPath: "M16 7h6v6", iconPath2: "m22 7-8.5 8.5-5-5L2 17" },
  { day: 100, rewardKey: "reward100", labelKey: "day100", reward: { type: "badge", amount: 1 }, tint: "var(--v5-brand)", iconPath: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", iconPath2: "m9 12 2 2 4-4" },
];

const MOCK_TOP_STREAKERS = [
  { name: "Daniel_K", countryCode: "US", streak: 412 },
  { name: "Mei_C", countryCode: "SG", streak: 387 },
  { name: "Lukas_F", countryCode: "DE", streak: 341 },
  { name: "Carlos_M", countryCode: "BR", streak: 298 },
  { name: "Priya_S", countryCode: "IN", streak: 256 },
];

const t = useT();
const faucet = useNexFaucet();
const dailyFactsReady = computed(() => !remoteApiEnabled || faucet.remoteReadState === 'ready');
const app = useApp();
const locale = useLocaleStore();
const auth = useAuth();
// Presentation never authorizes check-in, milestone claims or saver commands.
const dailyHasRead = ref(faucet.remoteReadState === 'ready');
watch(() => faucet.remoteReadState, state => {
  if (state === 'ready') dailyHasRead.value = true;
  else if (state === 'idle' || state === 'error') dailyHasRead.value = false;
}, { flush: 'sync' });
watch(() => [app.accountKey, app.accountBindingEpoch, locale.code], () => { dailyHasRead.value = false; }, { flush: 'sync' });
watch(() => apiRuntimeConfig?.environment, () => { dailyHasRead.value = false; }, { flush: 'sync' });
const dailyFactsVisible = computed(() => !remoteApiEnabled || (!summaryEnvironmentInvalidated.value && dailyHasRead.value));
const remoteSessionReady = computed(() => accountSessionReady({
  remote: remoteApiEnabled, authenticated: auth.isAuthenticated,
  accountId: auth.accountId, appAccountKey: app.accountKey,
  sessionUserId: sessionVault.read()?.user.userId ?? null,
}));
let pageActive = true;
let pageVisit = 0;
let readCoalescer = createScopedReadCoalescer();
let dailyPageScope: string | null = null;
const bills = useBills();
const summaryScope = computed(() => JSON.stringify([app.accountKey, app.accountBindingEpoch, locale.code]));
const summaryReadScope = ref('');
const summaryEnvironmentInvalidated = ref(false);
watch(() => apiRuntimeConfig?.environment, () => { summaryEnvironmentInvalidated.value = true; }, { flush: 'sync' });
watch([() => bills.summary, () => bills.summaryStatus], () => {
  if (bills.summaryStatus === 'ready' && bills.summary) summaryReadScope.value = summaryScope.value;
}, { immediate: true, flush: 'sync' });
const summaryForDisplay = computed(() => !summaryEnvironmentInvalidated.value && bills.summaryStatus !== 'error' && summaryReadScope.value === summaryScope.value ? bills.summary : null);

async function refreshBalance(coalesce = true) {
  if (remoteApiEnabled && remoteSessionReady.value && pageActive) await (coalesce ? app.ensureRemoteFleet() : app.refreshRemoteFleet()).catch(() => false);
}
async function refreshLedger(force = false) {
  if (remoteApiEnabled && remoteSessionReady.value && pageActive) await bills.refreshSummary({ force }).catch(() => {});
}
const luckySpin = useLuckySpin();
const luckyOdds = computed(() => dailyLuckyOdds(faucet.remoteRules));
const checkInCtaText = computed(() => {
  if (!remoteApiEnabled) return t.value.daily.checkInCta;
  const base = dailyBaseReward(faucet.remoteRules);
  return base === null ? t.value.daily.checkInAction : fmt(t.value.daily.checkInBase, { n: base });
});
const leaderRows = computed(() => remoteApiEnabled ? faucet.topStreakers : MOCK_TOP_STREAKERS);
const milestoneRewardLabels = computed(() => dailyRewardLabels(t.value.daily.milestones));
const milestones = computed<Milestone[]>(() => remoteApiEnabled
  ? faucet.remoteMilestones.map((m) => ({
      day: m.milestoneDay,
      rewardKey: "reward3",
      labelKey: "day3",
      labelText: fmt(t.value.daily.milestones.dayLabel, { n: m.milestoneDay }),
      rewardText: dailyMilestoneRewardText(m, milestoneRewardLabels.value),
      badgeName: dailyBadgeName(m.badgeCode, milestoneRewardLabels.value) ?? undefined,
      status: m.status,
      reward: { type: dailyMilestoneRewardKind(m.rewardType), amount: m.rewardAmount },
      tint: "var(--v5-nex)", iconPath: "m12 3v18M3 12h18",
    }))
  : MILESTONES);

const remoteRefreshError = ref(false);
const remoteRefreshing = ref(false);
const checkInSubmitting = ref(false);
const saverSubmitting = ref(false);
const remoteInitialLoading = ref(remoteApiEnabled);
// 🔴 签到写闸(BUG 154)。`faucet.remoteReadState === 'ready'` 只说明**曾经**读到过账号状态:
// 刷新失败时它按设计保持 ready(nex-faucet-remote-resilience.test.ts「keeps the last
// confirmed daily state when a state refresh fails」——已确认的快照不许被一次失败清空)。
// 而签到的前置事实是「今天还没签」,它**只有一次成功的读取能证明**;读取失败时
// remoteCheckedInToday 停在 false,于是"未知"被当成"未签"——正是这个 bug。
// 所以写闸必须同时确认**承载这份快照的这次读取真的跑成了**:
//   · remoteRefreshError —— 本轮 refreshDaily 的读取失败(页面已挂错误条 + 重试);
//   · remoteSessionReady  —— 冷会话/未恢复:refreshDaily 会提前 return,连错误条都不会置,
//     这正是「重新同步后仍无法确认状态」那条路径,必须一起 fail-closed。
// 冷会话围栏复用 lib/binary-session-ready,不另造第二套。
const checkInStateConfirmed = computed(() => !remoteApiEnabled
  || (remoteSessionReady.value && faucet.remoteReadState === 'ready' && !remoteRefreshError.value));
let dailyRefreshRequest = 0;
useAutoRecovery({ failed: () => remoteApiEnabled && bills.summaryStatus === "error", retry: () => refreshLedger(true) });
useAutoRecovery({ failed: () => remoteApiEnabled && !useSlotActionSheet().open && app.remoteFleetStatus === "error", retry: () => refreshBalance(false) });
useAutoRecovery({ failed: () => remoteApiEnabled && !remoteRefreshing.value && (remoteRefreshError.value || faucet.remoteReadState === "error"), retry: refreshDaily });
async function refreshDaily() {
  if (!remoteApiEnabled || !remoteSessionReady.value || !pageActive || remoteRefreshing.value) return;
  const request = ++dailyRefreshRequest;
  remoteRefreshing.value = true;
  remoteRefreshError.value = false;
  try {
    const ok = await faucet.ensureRemote();
    if (request === dailyRefreshRequest && !ok) remoteRefreshError.value = true;
  } catch {
    if (request === dailyRefreshRequest) remoteRefreshError.value = true;
  } finally {
    if (request === dailyRefreshRequest) {
      remoteRefreshing.value = false;
      remoteInitialLoading.value = false;
    }
  }
}
function readDailyPage() {
  if (!remoteApiEnabled || !pageActive) return;
  const runtime = captureRuntimeRevision();
  const scope = {accountKey: app.accountKey, accountBindingEpoch: app.accountBindingEpoch, runtime};
  const scopeKey = remoteSessionReady.value
    ? JSON.stringify([scope.accountKey, scope.accountBindingEpoch, runtime.runId, runtime.epoch]) : null;
  if (dailyPageScope !== scopeKey) {
    dailyPageScope = scopeKey;
    dailyRefreshRequest += 1;
    remoteRefreshing.value = false;
    remoteRefreshError.value = false;
    remoteInitialLoading.value = true;
    readCoalescer = createScopedReadCoalescer();
  }
  if (scopeKey === null) return;
  void readCoalescer.run(scope, () => Promise.all([refreshDaily(), refreshLedger(), refreshBalance()]).then(() => undefined));
}
watch(() => [app.accountKey, app.accountBindingEpoch] as const, readDailyPage);
watch(remoteSessionReady, readDailyPage, { immediate: true, flush: 'post' });
watch(() => locale.code, () => { void nextTick(readDailyPage); });
// Catalog preparation publishes before the remaining account-scoped stores bind.
const unsubscribeDailyRuntime = subscribeRuntimeRevision(() => { void nextTick(readDailyPage); });
onHide(() => { pageActive = false; pageVisit += 1; });
onShow(() => { pageActive = true; readDailyPage(); });
onUnmounted(() => { pageActive = false; dailyRefreshRequest += 1; unsubscribeDailyRuntime(); });

// Per-second tick for the countdown.
// It stops while the page is hidden and resumes on show; the countdown is recomputed from the clock.
const tick = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
function startTick() {
  if (timer) return;
  timer = setInterval(() => {
    tick.value += 1;
    if (remoteApiEnabled && faucet.remoteNextResetAt > 0
        && Date.now() >= faucet.remoteNextResetAt && tick.value % 30 === 0 && !remoteRefreshing.value) {
      void refreshDaily();
    }
  }, 1000);
}
onHide(() => {
  if (timer) clearInterval(timer);
  timer = null;
});
onShow(() => {
  tick.value += 1;
  startTick();
});
onMounted(() => {
  startTick();
  // 🔴 这里曾挂过一个 reconcileFaucetBills()「签到/里程碑发币没落盘就补发」——**已撤销**。
  // 实景走查当场证伪:判据是「有领取状态、无对应账单行 ⇒ 补发」,它分不清
  //   ① 从没发过(该补)与 ② 发过了但账单行丢了(不该补)。
  // 而 ② 是**可达**的:账单表走裸 writeAccountRow(无 CAS 无合并),另一标签页写一次就会
  // 覆盖掉本页刚写的分录,而余额在账户快照里按增量合并**幸存**(实测靶
  // scripts/measure-bills-crosstab-loss.mjs)。此时自愈会二次发钱 ——
  // 浏览器实测:余额 11940 → 11943,凭空多发一次。
  // 少发是用户损失,多发是平台损失且不可追回 —— 在拿到**权威的「已付」标记**之前,
  // 这个判据不可能正确。
  // 🔴 **权威「已付」标记要等真后端**(主人 2026-08-05 拍板:不在前端做存储层事务重构,
  //   提案已被独立证伪判定不可行,见 docs/changes/2026-08-04-change2-proposal.md)。
  //   在那之前,这里**永远不要**加「按账单缺失来补发」的自愈——它必然是二次发钱的入口。
  //   已焊门:scripts/selfcheck-claim-idempotency.mjs。
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const streak = computed(() => faucet.signInStreak);
const lastSignedToday = computed(() => remoteApiEnabled ? faucet.remoteCheckedInToday
  : faucet.lastSignedInAt > 0 && isSameDay(faucet.lastSignedInAt, Date.now()));
const claimedSet = computed(() => new Set(faucet.claimedMilestones));

function isMilestoneClaimed(m: Milestone): boolean {
  return remoteApiEnabled ? m.status === "CLAIMED" : claimedSet.value.has(m.day);
}

function isMilestoneUnlocked(m: Milestone): boolean {
  return remoteApiEnabled
    ? m.status === "CLAIMABLE" || m.status === "CLAIMED"
    : streak.value >= m.day;
}

const nextMilestone = computed(() => dailyUpcomingMilestone(streak.value, milestones.value.map(m => ({
  day: m.day, rewardText: m.rewardText ?? t.value.daily.milestones[m.rewardKey], claimed: isMilestoneClaimed(m),
}))));

const nextResetMs = computed(() => {
  void tick.value;
  if (remoteApiEnabled) return Math.max(0, faucet.remoteNextResetAt - Date.now());
  const next = today();
  next.setDate(next.getDate() + 1);
  return next.getTime() - Date.now();
});

const streakBroken = computed(() => {
  if (faucet.lastSignedInAt === 0) return false;
  return Date.now() - faucet.lastSignedInAt > 2 * ONE_DAY_MS && faucet.streakSavers > 0;
});

// The reward part of `daysToReward` is coloured, so the sentence renders in three pieces.
const heroLine = computed(() => {
  if (streak.value === 0) return { before: t.value.daily.startStreak, reward: "", after: "" };
  const next = nextMilestone.value;
  if (!next) return { before: t.value.daily.noNextMilestone, reward: "", after: "" };
  const [before, after = ""] = fmt(t.value.daily.daysToReward, {
    n: next.remainingDays,
    unit: next.remainingDays === 1 ? t.value.daily.dayShort : t.value.daily.daysShort,
  }).split("{reward}");
  return { before, reward: next.rewardText, after };
});
const countdownParts = computed(() => {
  const [before, after = ""] = t.value.daily.nextClaimShort.split("{time}");
  return { before: before.trim(), time: formatCountdown(nextResetMs.value), after: after.trim() };
});
const saverHeadlineText = computed(() => t.value.daily.saver.headline);
const saverCountText = computed(() =>
  faucet.streakSavers > 0 ? fmt(t.value.daily.saver.count, { n: faucet.streakSavers }) : t.value.daily.saver.empty,
);
const yourBestText = computed(() =>
  fmt(t.value.daily.topStreakers.yourBest, { n: faucet.longestStreak || streak.value || 0 }),
);
const pointsUnlockText = computed(() => t.value.daily.pointsUnlockHint);
const lifetimeEarned = computed(() =>
  remoteApiEnabled ? summaryForDisplay.value != null && summaryForDisplay.value?.settledRewardsNex != null
    ? formatAmount(summaryForDisplay.value.settledRewardsNex) : '—'
    : formatAmount(faucet.history.reduce((s, h) => s + (h.delta > 0 ? h.delta : 0), 0)),
);
const lifetimeSpent = computed(() =>
  remoteApiEnabled ? summaryForDisplay.value != null && summaryForDisplay.value?.withdrawalOffsetNexSpent != null
    ? formatAmount(summaryForDisplay.value.withdrawalOffsetNexSpent) : '—'
    : formatAmount(-faucet.history.reduce((s, h) => s + (h.delta < 0 ? h.delta : 0), 0)),
);
const historyRows = computed(() => remoteApiEnabled
  ? (summaryForDisplay.value != null ? summaryForDisplay.value?.recentNexBills ?? [] : []).map(b => ({
      ts: b.ts, delta: b.amount,
      reason: resolveWalletBillMemo(b, t.value.bills.memo as Record<string, string>)
        + (b.status === 'pending' ? ` · ${t.value.wallet.pending}` : ''),
    }))
  : faucet.history.slice(0, 10));
function daysLeftText(day: number): string {
    const remaining = Math.max(0, day - streak.value);
    if (remaining === 0) return ({ zh: '领取资格待确认', en: 'Eligibility awaiting confirmation', vi: 'Đang chờ xác nhận điều kiện', id: 'Kelayakan menunggu konfirmasi', ms: 'Kelayakan menunggu pengesahan', fil: 'Hinihintay makumpirma ang eligibility', ru: 'Право на награду ждёт подтверждения', kk: 'Алу құқығы расталуда', uz: 'Olish huquqi hali tasdiqlanmagan' })[uiLocale(locale.code)];
    return fmt(t.value.daily.milestones.daysLeft, { n: remaining });
}
function formatTs(ts: number): string {
  return Number.isFinite(new Date(ts).getTime()) ? formatTrialDateTime(ts, dateLocale()) : "—";
}

/** 签到分录的稳定幂等键 = 当天日期(签到一天一次)。带时间戳的话判重永不命中 = 假幂等。 */
function signInRef(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `SIGNIN-${d.getFullYear()}${mm}${dd}`;
}


async function handleCheckIn() {
  if (!pageActive || !dailyFactsReady.value) return;
  // 写闸:账号今日签到状态**本次已确认**才允许发写请求(见 checkInStateConfirmed)。
  // 只靠 aria-disabled 不够——键盘合成 click、程序化调用都会绕过属性闸。
  if (!checkInStateConfirmed.value) {
    toast.error(t.value.authOtp.errorServiceUnavailable);
    return;
  }
  if (lastSignedToday.value || remoteRefreshing.value || checkInSubmitting.value) return;
  if (remoteApiEnabled) {
    const walletAccountKey = app.accountKey;
    const walletAccountEpoch = app.accountBindingEpoch;
    const submittingVisit = pageVisit;
    const streakBefore = streak.value;
    checkInSubmitting.value = true;
    try {
      const remote = await faucet.checkInRemote();
      if (!pageActive || pageVisit !== submittingVisit || app.accountKey !== walletAccountKey || app.accountBindingEpoch !== walletAccountEpoch) return;
      if (!remote.ok) {
        toast.error(remote.reason === "B1_COVERAGE_BELOW_REDLINE"
          ? t.value.binary.blockReasons.COVERAGE_BELOW_REDLINE
          : remote.reason === "B1_COVERAGE_DATA_UNAVAILABLE"
            ? t.value.binary.blockReasons.B1_COVERAGE_UNRELIABLE
            : t.value.authOtp.errorServiceUnavailable);
        return;
      }
      // The rising reward replaces the success toast (07 签到成功奖励).
      playCheckInSuccess(streakBefore, remote.gained, remote.multiplier, dailyCheckInSuccessCopy(remote, t.value.daily).body);
      void refreshLedger(true);
      if (app.accountKey === walletAccountKey && app.accountBindingEpoch === walletAccountEpoch) {
        void refreshBalance(false);
      }
    } finally {
      checkInSubmitting.value = false;
    }
    return;
  }
  const streakBefore = streak.value;
  const r = faucet.signIn();
  if (!r.ok) {
    // conflict = 别的标签页刚签过(store 已刷新到最新);否则就是本页自己今天已签。
    if (r.conflict) toast.warn(t.value.errors.staleTitle, t.value.errors.staleMsg);
    return;
  }
  // Faucet store tracks streak only; crediting NEX to the wallet is composed here
  // (store never imports app). MOCK-ONLY NON-ATOMIC: PROD POST /api/faucet/sign-in
  // atomically grants NEX and emits the matching bill in one idempotent transaction.
  //
  // 🔴 这一处的顺序**反不过来**(与 quest / event / achievement 三族不同):发多少 NEX 是
  // signIn() 自己摇出来的(随机倍率 + 连签奖励),不先跑它就不知道金额。于是失败面是
  // 「今天已签、NEX 没到」,而签到一天一次、当天再点也没用。
  // 对策照仓里既有的自愈教条(App.vue reconcileBills:「别记,从现有数据推出来」)——
  // ref 用**当天日期**保持稳定,进页面时若发现「今天签过但账上没有那条分录」就补发;
  // 幂等出口保证补发不会变成第二次发钱。
  const paid = postMoneyBillsOnce([{ type: "bonus", symbol: "UVT", amount: r.gained, status: "posted",
    memo: `Daily check-in · ${r.streak}-day streak`, ref: signInRef(faucet.lastSignedInAt) }]);
  // 签到发奖这一跳就是上面那个 POST /api/faucet/sign-in —— 地区拒绝以它的结果回来。
  // 🔴 翻译不出来(`null`)就是普通结果,原样落回下面的 `!== "ok"` 出口:
  //    发钱失败仍然是发钱失败,不许被说成地区受限。
  const geo = geoPolicyUserMessage(paid, t.value.geoPolicy);
  if (geo) {
    toast.error(geo);
    return;
  }
  if (paid !== "ok") return;
  try {
    uni.vibrateShort({ fail: () => {} });
  } catch {
    // vibrate unavailable
  }
  playCheckInSuccess(streakBefore, r.gained, r.multiplier, dailyCheckInSuccessCopy(r, t.value.daily).body);
}

async function handleClaimMilestone(m: Milestone) {
  if (!dailyFactsReady.value) return;
  if (isMilestoneClaimed(m)) {
    toast.info(t.value.daily.milestones.claimedToast, "");
    return;
  }
  if (!isMilestoneUnlocked(m)) {
    toast.info(t.value.daily.milestones.lockedToast, "");
    return;
  }
  if (remoteApiEnabled) {
    if (!await faucet.claimMilestoneRemote(m.day)) {
      toast.error(t.value.authOtp.errorServiceUnavailable);
      return;
    }
    toast.success(m.rewardText ?? dailyMilestoneRewardText(
      { rewardType: m.reward.type, rewardAmount: m.reward.amount, badgeCode: null }, milestoneRewardLabels.value,
    ), fmt(t.value.daily.milestones.claimedDay, { n: m.day }));
    void refreshLedger(true);
    return;
  }
  const gainedNex = m.reward.type === "uvt" ? m.reward.amount : 0;
  const rewardDisplay = t.value.daily.milestones[m.rewardKey];
  // 🔴 必须先看 ok:上面两道预判读的是本页内存态,而里程碑领取是**一次性**的。
  // 别的标签页刚领过时 store 会按磁盘最新态拒掉,此时还往下走就是白发一份奖励。
  const claim = faucet.claimMilestone(m.day, gainedNex, `Milestone Day-${m.day}: ${rewardDisplay}`);
  if (!claim.ok) {
    if (claim.conflict) toast.warn(t.value.errors.staleTitle, t.value.errors.staleMsg);
    else toast.info(t.value.daily.milestones.claimedToast, "");
    return;
  }
  // USDT / NEX milestone rewards actually credit the wallet + write a bill.
  if (m.reward.type === "usdt" || m.reward.type === "uvt") {
    // MOCK-ONLY NON-ATOMIC: PROD milestone-claim endpoint TBD must atomically
    // grant the reward and emit the matching bill in one idempotent transaction.
    // 🔴 ref 去掉时间戳:里程碑一档只能领一次,`STREAK-D{day}` 天生稳定。带时间戳的话
    // 判重永不命中,幂等出口会退化成普通出口、自愈也补不上(补一次就多发一次)。
    // 顺序保持「先 claim 后发钱」——那是有意的(见上方注释:claim 才是按磁盘最新态的权威判定,
    // 反过来会在别的标签页刚领过时白发一份)。代价是发钱失败会留「已领、没到账」,
    // 这条残迹目前**没有自动补救**,而且**按主人 2026-08-05 的拍板会一直如此**:
    // 曾挂过的自愈已撤销(判据分不清「没发过」与「发过但账单丢了」,实测会二次发钱);
    // 曾提案用存储层事务根治,独立证伪判定不可行。这是 mock 期的已知边界,由真后端事务收口。
    // 发钱失败对用户是**响的**(有失败提示),不是静默吞掉。
    const paid = postMoneyBillsOnce([{
      type: "bonus",
      symbol: m.reward.type === "usdt" ? "USDT" : "UVT",
      amount: m.reward.amount,
      status: "posted",
      memo: `Streak milestone · Day-${m.day}`,
      ref: `STREAK-D${m.day}`,
    }]);
    // 同签到:里程碑发奖是本页第二个发钱跳,地区拒绝以它的结果回来。
    // `null` = 普通结果 → 原样走下面的 `!== "ok"` 出口。
    const geo = geoPolicyUserMessage(paid, t.value.geoPolicy);
    if (geo) {
      toast.error(geo);
      return;
    }
    if (paid !== "ok") return;
  }
  // Day-30 "spin" milestone grants a bonus Lucky Spin ticket + opens the wheel.
  if (m.reward.type === "spin") {
    luckySpin.grantBonusTicket(m.reward.amount);
    luckySpin.openSheet();
  }
  // spin / badge milestones are non-currency unlocks → claim (+ spin sheet above).
  toast.success(rewardDisplay, fmt(t.value.daily.milestones.claimedDay, { n: m.day }));
}

async function handleUseSaver() {
  if (!dailyFactsReady.value) return;
  if (!streakBroken.value || remoteRefreshing.value || saverSubmitting.value) return;
  if (remoteApiEnabled) {
    saverSubmitting.value = true;
    try {
      if (await faucet.useSaverRemote()) toast.success(t.value.daily.saver.restored, "");
      else toast.error(t.value.authOtp.errorServiceUnavailable);
    } finally {
      saverSubmitting.value = false;
    }
    return;
  }
  const r = faucet.useSaver();
  if (r.ok) {
    toast.success(t.value.daily.saver.restored, "");
  } else if (r.conflict) {
    toast.warn(t.value.errors.staleTitle, t.value.errors.staleMsg);
  } else {
    toast.info(t.value.daily.saver.onlyWhenBroken, "");
  }
}

function goWithdraw() {
  navTo("/pages/me/wallet-withdraw-method");
}


// ── presentation ──
// Retained pages skip the entrance on return (uni re-shows the hidden page).
const returned = ref(false);

const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;
// The ring and its breathing run only while on screen; a success off screen floats above the bar.
const ringLoops = useLoopsInView(".dly-rw");
const ringRef = ringLoops.elRef;
const ring = computed(() => dailyStreakRing(streak.value, milestones.value.map(m => m.day), lastSignedToday.value));
const ringSegments = computed(() => {
  const step = 360 / ring.value.segments;
  // Rounded caps blur together on dense stages; past 14 segments they become flat ticks.
  const gap = ring.value.segments <= 14 ? 12 : step * 0.3;
  const arc = ((step - gap) / 360) * RING_C;
  return Array.from({ length: ring.value.segments }, (_, i) => ({
    i,
    rotate: -90 + gap / 2 + i * step,
    centre: -90 + (i + 0.5) * step,
    dash: `${arc} ${RING_C - arc}`,
  }));
});
const ringCap = computed(() => ring.value.segments <= 14 ? "round" : "butt");
const ringTodayIndex = computed(() => !lastSignedToday.value && ring.value.next !== null ? ring.value.done : null);
const ringBreathing = computed(() => ringTodayIndex.value !== null && checkInStateConfirmed.value);
// Amber → coral across the signed segments; a lone segment signed today is already the coral end.
function ringDoneStroke(i: number): string {
  const mix = ring.value.done > 1 ? Math.round((i / (ring.value.done - 1)) * 100) : lastSignedToday.value ? 100 : 0;
  return `color-mix(in srgb, var(--v5-brand-2) ${mix}%, var(--v5-warning))`;
}
const ringLabel = computed(() => ring.value.next === null || ring.value.reached
  ? fmt(t.value.daily.ringLabelAll, { n: streak.value })
  : fmt(t.value.daily.ringLabel, { n: streak.value, day: ring.value.next, left: ring.value.next - streak.value }));
// The burst sits on today's freshly filled segment, or on the gift when a milestone day empties the stage.
const burstStyle = computed(() => {
  const done = ring.value.done;
  if (ring.value.next === null || done === 0) return { left: "124px", top: "20px" };
  const angle = (ringSegments.value[done - 1].centre * Math.PI) / 180;
  return { left: `${124 + RING_R * Math.cos(angle)}px`, top: `${124 + RING_R * Math.sin(angle)}px` };
});

const claimableCount = computed(() => milestones.value.filter(m => isMilestoneUnlocked(m) && !isMilestoneClaimed(m)).length);
const nextLockedDay = computed(() => milestones.value
  .filter(m => !isMilestoneUnlocked(m) && !isMilestoneClaimed(m))
  .reduce<number | null>((day, m) => day === null || m.day < day ? m.day : day, null));
function ticketUnit(m: Milestone): string {
  const labels = milestoneRewardLabels.value;
  return m.reward.type === "uvt" ? labels.nex : m.reward.type === "usdt" ? labels.usdt
    : m.reward.type === "spin" ? labels.spin : m.reward.type === "badge" ? labels.badge : "";
}
function ticketValue(m: Milestone): string {
  if (m.reward.type === "uvt" || m.reward.type === "usdt") return formatAmount(m.reward.amount);
  if (m.reward.type === "spin") return `×${m.reward.amount}`;
  if (m.reward.type === "badge") return m.badgeName ?? (remoteApiEnabled ? milestoneRewardLabels.value.badge : t.value.daily.milestones.badgeStreakMaster);
  return m.rewardText ?? "";
}
// Open the rail on the first claimable ticket (else the next one), keeping its left neighbour in view.
const railLeft = ref(0);
let railPlaced = false;
watch(() => dailyFactsVisible.value ? milestones.value.length : 0, (count) => {
  if (!count || railPlaced) return;
  railPlaced = true;
  const claimable = milestones.value.findIndex(m => isMilestoneUnlocked(m) && !isMilestoneClaimed(m));
  const target = claimable >= 0 ? claimable : milestones.value.findIndex(m => m.day === nextLockedDay.value);
  if (target > 1) void nextTick(() => { railLeft.value = (target - 1) * 138; });
}, { immediate: true });

const yourBestParts = computed(() => {
  const [before, after = ""] = t.value.daily.topStreakers.yourBest.split("{n}");
  return { before, n: String(faucet.longestStreak || streak.value || 0), after };
});
const podium = computed(() => leaderRows.value.slice(0, 3).map((s, i) => ({ ...s, rank: i + 1, initial: s.name.trim().charAt(0).toUpperCase() })));
const leaderRest = computed(() => leaderRows.value.slice(3));
const balanceParts = computed(() => {
  if (remoteApiEnabled && !app.remoteFleetHasSnapshot) return null;
  const [whole, fraction] = formatAmount(app.user.nexBalance).split(".");
  return { whole, fraction: fraction === undefined ? "" : `.${fraction}` };
});

// Check-in success: today's segment fills, the count steps up and the actual
// reward floats for 1900ms. Leaving the page or switching account cancels it.
const successFx = ref<{ key: number; amount: string; multiplier: number; summary: string; atRing: boolean } | null>(null);
const countingStreak = ref<number | null>(null);
const displayStreak = computed(() => countingStreak.value ?? streak.value);
let successTimer: ReturnType<typeof setTimeout> | null = null;
let countTimer: ReturnType<typeof setTimeout> | null = null;
function clearCheckInSuccess() {
  if (successTimer) clearTimeout(successTimer);
  if (countTimer) clearTimeout(countTimer);
  successTimer = null;
  countTimer = null;
  successFx.value = null;
  countingStreak.value = null;
}
function playCheckInSuccess(from: number, gained: number, multiplier: number, summary: string) {
  clearCheckInSuccess();
  successFx.value = { key: Date.now(), amount: formatAmount(gained), multiplier, summary, atRing: ringLoops.running.value };
  successTimer = setTimeout(clearCheckInSuccess, 1900);
  const to = streak.value;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || to <= from) return;
  const stepMs = Math.max(30, 480 / (to - from));
  countingStreak.value = from;
  const step = () => {
    const next = (countingStreak.value ?? from) + 1;
    countingStreak.value = next >= to ? null : next;
    if (next < to) countTimer = setTimeout(step, stepMs);
  };
  countTimer = setTimeout(step, 200);
}
onHide(() => { returned.value = true; clearCheckInSuccess(); });
onUnmounted(clearCheckInSuccess);
watch(() => [app.accountKey, app.accountBindingEpoch], clearCheckInSuccess);
</script>

<style scoped>
/* Design: uvel-docs P-65 boards (Main / DailyLight / DailySigned / DailyStates). One aura only — behind the ring. */
.dly { --dly-glow: 30%; --dly-glow2: 14%; --dly-dash: color-mix(in srgb, var(--v5-ink) 16%, transparent); --dly-well: inset 0 1px 3px color-mix(in srgb, var(--v5-bg) 50%, transparent); padding-bottom: calc(84px + env(safe-area-inset-bottom)); font-family: var(--font-v5); color: var(--v5-ink); }
[data-theme="light"] .dly { --dly-glow: 20%; --dly-glow2: 9%; --dly-dash: var(--v5-border-strong); --dly-well: inset 0 1px 3px color-mix(in srgb, var(--v5-ink) 10%, transparent); }
.dly-card { position: relative; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .dly-card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.dly-sec { display: block; margin-top: var(--ui-space-section-gap); }
.dly-sec--sk { margin-top: 20px; }
.dly-sh { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; margin: 0 18px 12px; }
.dly-sh__h { min-width: 0; font: 600 17px/24px var(--font-v5); color: var(--v5-ink); }
.dly-meta { flex: none; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.dly-meta__b { font: 500 13px/18px var(--font-metric); color: var(--v5-ink); }
.dly-pill { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: color-mix(in srgb, var(--v5-warning) 16%, transparent); font: 500 12px/16px var(--font-v5); color: var(--v5-warning-ink); white-space: nowrap; }
.dly-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Read failure (States C) */
.dly-warn { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 16px 12px; padding: 6px 6px 6px 14px; border-radius: 16px; background: color-mix(in srgb, var(--v5-warning) 8%, transparent); }
.dly-warn__t { font: 400 12px/16px var(--font-v5); color: var(--v5-warning-ink); }
.dly-warn__b { flex: none; display: flex; align-items: center; min-height: 44px; padding: 0 12px; font: 500 13px/18px var(--font-v5); color: var(--v5-ink); cursor: pointer; }

/* Ring */
.dly-hero { position: relative; display: flex; flex-direction: column; align-items: center; margin-top: 4px; text-align: center; animation: dly-rise 520ms cubic-bezier(.16, 1, .3, 1) both; }
.dly-hero--glow::before { content: ""; position: absolute; left: 50%; top: -34px; width: 380px; height: 330px; margin-left: -190px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-warning) var(--dly-glow), transparent), color-mix(in srgb, var(--v5-brand-2) var(--dly-glow2), transparent) 62%, transparent); filter: blur(6px); pointer-events: none; }
.dly-rw { position: relative; width: 248px; height: 248px; }
.dly-ring { position: absolute; inset: 0; overflow: visible; }
.dly-ring circle { fill: none; stroke-width: 14; }
.dly-ring__ph { stroke: color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.dly-ring__tr { stroke: color-mix(in srgb, var(--v5-ink) 9%, transparent); }
.dly-ring__dn { animation: dly-lit 380ms ease-out both; animation-delay: calc(var(--i) * 80ms + 260ms); }
.dly-ring__dn--new { animation-delay: 0ms; }
.dly-ring__td { stroke: var(--v5-brand); }
.dly-ring__td--breathe { opacity: .35; animation: dly-breathe 2.4s ease-in-out 900ms infinite; }
/* Light theme: blue thinned to .35 over the beige track reads as lavender, so the low point stays at .6. */
[data-theme="light"] .dly-ring__td--breathe { opacity: .6; animation-name: dly-breathe-light; }
.nx-loops-paused .dly-ring__td--breathe { animation-play-state: paused; }
.dly-spk { position: absolute; border-radius: 50%; pointer-events: none; }
.dly-gift.dly-gift--reached { background: var(--v5-warning); box-shadow: 0 0 0 4px var(--v5-bg); color: var(--v5-bg); }
.dly-gift { position: absolute; left: 104px; top: 0; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, var(--v5-warning) 18%, var(--v5-bg)); box-shadow: 0 0 0 4px var(--v5-bg), inset 0 0 0 1.5px color-mix(in srgb, var(--v5-warning) 70%, transparent); color: var(--v5-warning-ink); }
.dly-ctr { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dly-num { margin-top: 2px; font: 500 76px/76px var(--font-metric); letter-spacing: -.05em; color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.dly-num--q { color: var(--v5-ink-4); }
.dly-lbl { margin-top: 6px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.dly-next { position: relative; display: block; margin: 14px 16px 0; font: 500 15px/22px var(--font-v5); color: var(--v5-ink); }
.dly-next--mut { font-weight: 400; color: var(--v5-ink-3); }
.dly-next__r { color: var(--v5-warning-ink); white-space: nowrap; }
.dly-lucky { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; margin: 10px 16px 0; }
.dly-lucky--hint { display: block; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-lucky__k { display: inline-flex; align-items: center; gap: 4px; margin-right: 2px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 6%, transparent); font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-chip__m { font: 500 12px/16px var(--font-metric); color: var(--v5-warning-ink); }

/* Check-in success (DailySigned) */
.dly-burst { position: absolute; width: 0; height: 0; pointer-events: none; animation: dly-burst 600ms cubic-bezier(.2, .8, .2, 1) both; }
.dly-burst__ring { position: absolute; left: -15px; top: -15px; width: 30px; height: 30px; border-radius: 50%; box-shadow: 0 0 0 2px color-mix(in srgb, var(--v5-warning) 60%, transparent); }
.dly-burst__ray { position: absolute; left: -1.5px; top: -24px; width: 3px; height: 9px; border-radius: 2px; background: var(--v5-warning); transform-origin: 1.5px 24px; }
.dly-burst__ray:nth-child(even) { top: -22px; height: 6px; background: var(--v5-brand-2); transform-origin: 1.5px 22px; }
/* The reward rests where the flame sits (below the gift), and the flame steps aside meanwhile. */
.dly-flame { transition: opacity 240ms ease; }
.dly-flame--off { opacity: 0; }
.dly-fly { position: absolute; left: -30px; right: -30px; top: 58px; font: 500 22px/28px var(--font-metric); letter-spacing: -.01em; color: var(--v5-brand); animation: dly-fly 1900ms linear both; pointer-events: none; }
.dly-fly--bar { left: 0; right: 0; top: auto; bottom: 100%; margin-bottom: 12px; display: flex; justify-content: center; animation-name: dly-fly-bar; }
/* Over scrolled content the reward needs its own ground to stay readable. */
.dly-fly__pill { display: inline-flex; align-items: baseline; padding: 4px 16px; border-radius: 999px; background: color-mix(in srgb, var(--v5-bg) 82%, transparent); box-shadow: inset 0 0 0 1px var(--v5-sticky-bar-border); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.dly-fly__u { margin-left: 4px; font: 500 13px/18px var(--font-v5); letter-spacing: 0; }

/* Milestone tickets */
.dly-rail { width: 100%; white-space: nowrap; }
.dly-rail :deep(.uni-scroll-view) { scroll-snap-type: x mandatory; scroll-padding: 0 16px; scrollbar-width: none; }
.dly-rail :deep(.uni-scroll-view::-webkit-scrollbar) { display: none; }
.dly-rail__track { display: inline-flex; gap: 10px; padding: 4px 16px 6px; vertical-align: top; }
.dly-rail__item { flex: none; scroll-snap-align: start; }
/* The slide-in runs on the ticket, not the snap item, so the snap never re-aligns mid-animation. */
.dly-rail__item > .dly-tk { animation: dly-slidein 460ms cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--i) * 60ms + 380ms); }
.dly-tk { position: relative; display: flex; flex-direction: column; width: 128px; height: 166px; box-sizing: border-box; border-radius: 18px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); overflow: hidden; white-space: normal; }
[data-theme="light"] .dly-tk { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.dly-tk::before, .dly-tk::after { content: ""; position: absolute; top: 96px; width: 16px; height: 16px; border-radius: 50%; background: var(--v5-bg); }
.dly-tk::before { left: -8px; }
.dly-tk::after { right: -8px; }
.dly-tk__tp { display: flex; flex-direction: column; height: 104px; padding: 12px 12px 10px; box-sizing: border-box; }
.dly-tk__d { display: flex; align-items: center; justify-content: space-between; font: 500 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-tk__ti { display: grid; place-items: center; width: 22px; height: 22px; }
.dly-tk__ck { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); color: var(--v5-ink-3); }
.dly-tk__u { margin-top: auto; font: 500 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-tk__u--nx { color: var(--v5-nex-ink); }
.dly-tk__v { font: 600 26px/30px var(--font-amount); letter-spacing: -.02em; color: var(--v5-ink); white-space: nowrap; }
.dly-tk__v--t { padding-top: 6px; font: 500 15px/20px var(--font-v5); letter-spacing: 0; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.dly-tk__u + .dly-tk__v--t { padding-top: 0; }
.dly-tk__pf { margin: 0 12px; border-top: 1.5px dashed var(--dly-dash); }
.dly-tk__sb { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 10px; }
.dly-tk__st { display: flex; align-items: flex-start; justify-content: center; gap: 4px; min-height: 44px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); text-align: center; }
.dly-tk__st svg { flex: none; margin-top: 2px; }
.dly-tk__nxt { font-weight: 500; color: var(--v5-warning-ink); }
.dly-claim { display: flex; align-items: center; justify-content: center; width: 100%; height: 44px; border-radius: 999px; background: var(--v5-brand); color: var(--v5-on-brand); font: 500 14px/20px var(--font-v5); cursor: pointer; }
.dly-tk--can { border: 1.5px solid transparent; background: linear-gradient(var(--v5-surface), var(--v5-surface)) padding-box, linear-gradient(155deg, var(--v5-warning), var(--v5-brand-2) 55%, color-mix(in srgb, var(--v5-brand-2) 10%, transparent)) border-box; box-shadow: none; }
[data-theme="light"] .dly-tk--can { box-shadow: var(--v5-glass-shadow); }
.dly-tk--can::before { left: -9.5px; }
.dly-tk--can::after { right: -9.5px; }
.dly-tk--can .dly-tk__d { color: var(--v5-warning-ink); }
.dly-tk__sheen { position: absolute; inset: 0; overflow: hidden; border-radius: 16px; pointer-events: none; }
.dly-tk__sheen > view { position: absolute; top: 0; bottom: 0; left: 0; width: 46px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .16), transparent); transform: translateX(-120%) skewX(-18deg); animation: dly-sheen 1100ms ease-out 1000ms 1 both; }
.dly-tk--got .dly-tk__u, .dly-tk--got .dly-tk__v { color: var(--v5-ink-3); }
.dly-tk--sk { background: transparent; box-shadow: none; border: 1.5px dashed var(--dly-dash); }
.dly-tk--sk::before, .dly-tk--sk::after { display: none; }
.dly-bone { display: block; height: 10px; border-radius: 5px; background: color-mix(in srgb, var(--v5-ink) 7%, transparent); }

/* Streak saver */
.dly-sv { display: flex; align-items: center; gap: 14px; margin: 0 16px; padding: 16px; }
.dly-sv--br { position: relative; border-radius: 22px; border: 1.5px solid transparent; background: linear-gradient(var(--v5-surface), var(--v5-surface)) padding-box, linear-gradient(155deg, var(--v5-brand-2), var(--v5-warning) 60%, color-mix(in srgb, var(--v5-warning) 10%, transparent)) border-box; }
[data-theme="light"] .dly-sv--br { box-shadow: var(--v5-glass-shadow); }
.dly-stk { position: relative; flex: none; width: 54px; height: 58px; }
.dly-stk__a, .dly-stk__b { position: absolute; left: 8px; top: 3px; width: 38px; height: 50px; border-radius: 10px; }
.dly-stk__a { transform: rotate(-10deg) translateX(-4px); background: color-mix(in srgb, var(--v5-brand-2) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-brand-2) 26%, transparent); }
.dly-stk__b { display: grid; place-items: center; transform: rotate(6deg) translateX(4px); background: color-mix(in srgb, var(--v5-brand-2) 20%, var(--v5-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-brand-2) 45%, transparent); color: var(--v5-brand-2); }
.dly-stk__n { position: absolute; right: -4px; bottom: -2px; display: grid; place-items: center; min-width: 22px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: var(--v5-ink); color: var(--v5-bg); font: 500 11px/14px var(--font-metric); }
.dly-svt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.dly-svt__h { font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.dly-svb-hit { flex: none; display: flex; align-items: center; min-height: 44px; cursor: pointer; }
.dly-svb { display: flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 999px; font: 500 13px/18px var(--font-v5); white-space: nowrap; }
.dly-svb--on { --ui-button-fill: color-mix(in srgb, var(--v5-brand-2) 18%, transparent); }
.dly-svb--off { opacity: .5; }
/* Narrow screens: the button moves to a second row under the text (illustration 54 + gap 14), so the copy keeps its width. */
@media (max-width: 374px) {
  .dly-sv { flex-wrap: wrap; row-gap: 4px; }
  .dly-svt { flex: 1 1 calc(100% - 68px); }
  .dly-svb-hit { margin-left: 68px; }
}

/* Leaderboard podium */
.dly-lb { margin: 0 16px; padding: 8px; }
.dly-pod { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 8px; height: 196px; padding: 0 10px; border-radius: 16px; background: var(--v5-surface-2); box-shadow: var(--dly-well); }
[data-theme="light"] .dly-pod { background: var(--v5-surface-3); }
.dly-pc { grid-row: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
.dly-av { position: relative; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, var(--t) 22%, var(--v5-surface)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--t) 55%, transparent); font: 600 15px/20px var(--font-v5); color: var(--v5-ink); }
.dly-av--big { width: 48px; height: 48px; }
.dly-crown { position: absolute; top: -15px; left: 50%; margin-left: -9px; color: var(--v5-warning-ink); }
.dly-pn { max-width: 100%; margin-top: 6px; font: 500 13px/18px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dly-pd { display: flex; align-items: center; gap: 3px; margin-top: 1px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-pd svg { color: var(--v5-brand-2); }
.dly-pd__b { font: 500 12px/16px var(--font-metric); color: var(--v5-ink); }
.dly-pl { display: grid; place-items: center; width: 100%; margin-top: 8px; border-radius: 10px 10px 0 0; background: color-mix(in srgb, var(--v5-ink) 7%, transparent); font: 500 18px/22px var(--font-metric); color: var(--v5-ink-3); }
.dly-pl--1 { height: 60px; background: color-mix(in srgb, var(--v5-warning) 20%, transparent); box-shadow: inset 0 2px 0 var(--v5-warning); color: var(--v5-warning-ink); }
.dly-pl--2 { height: 44px; }
.dly-pl--3 { height: 32px; }
.dly-lr { display: flex; align-items: center; gap: 10px; box-sizing: content-box; min-height: 52px; padding: 0 10px; }
.dly-lr + .dly-lr { border-top: 1px solid var(--v5-border); }
.dly-lr__rk { width: 20px; font: 500 13px/18px var(--font-metric); color: var(--v5-ink-3); }
.dly-lr__n { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.dly-lr__name { min-width: 0; font: 500 14px/20px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dly-lr__cc { flex: none; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-lr__s { display: flex; align-items: center; gap: 4px; font: 500 14px/20px var(--font-metric); color: var(--v5-ink); }
.dly-lr__s svg { color: var(--v5-brand-2); }

/* UVT card */
.dly-wl { margin: 0 16px; padding: 16px 16px 0; overflow: hidden; }
.dly-wk { display: flex; align-items: center; justify-content: space-between; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.dly-uvt { display: inline-flex; align-items: center; gap: 5px; font: 500 12px/16px var(--font-v5); color: var(--v5-nex-ink); }
.dly-uvt__i { display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: var(--v5-nex-ink); color: var(--v5-bg); font: 600 10px/10px var(--font-v5); }
.dly-wa { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px; margin-top: 6px; font-family: var(--font-amount); font-weight: 600; line-height: 1; letter-spacing: -.024em; color: var(--v5-ink); }
.dly-wa__i { font-size: 38px; }
.dly-wa__c { font-size: 24px; color: var(--v5-ink-3); }
.dly-wa__u { margin-left: 6px; font: 500 12px/16px var(--font-v5); letter-spacing: 0; color: var(--v5-nex-ink); }
.dly-w2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; padding: 12px 0; border-top: 1px solid var(--v5-border); }
.dly-w2 > view { display: flex; flex-direction: column; gap: 4px; min-width: 0; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-w2 > view + view { padding-left: 14px; border-left: 1px solid var(--v5-border); }
.dly-w2__b { font: 500 17px/22px var(--font-metric); color: var(--v5-ink); }
.dly-wn { display: block; padding-bottom: 12px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-wlk { display: flex; align-items: center; justify-content: space-between; gap: 10px; box-sizing: content-box; min-height: 48px; margin: 0 -16px; padding: 0 16px; border-top: 1px solid var(--v5-border); font: 500 13px/18px var(--font-v5); color: var(--v5-ink); cursor: pointer; }
.dly-wlk__l { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dly-wlk__l svg { flex: none; color: var(--v5-warning-ink); }
.dly-wlk > svg { flex: none; color: var(--v5-ink-3); }

/* Recent */
.dly-hs { margin: 0 18px; }
.dly-hs__msg { display: block; padding: 12px 0; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.dly-hr { display: flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: content-box; min-height: 60px; }
.dly-hr + .dly-hr { border-top: 1px solid var(--v5-border); }
.dly-hr__w { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dly-hr__t { font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.dly-hr__ts { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.dly-hr__dl { flex: none; font: 500 14px/20px var(--font-metric); color: var(--v5-ink); white-space: nowrap; }
.dly-hr__dl--p { color: var(--v5-success-ink); }

/* Bottom action bar (DS-30) */
.dly-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; padding: 12px 16px max(34px, calc(env(safe-area-inset-bottom) + 14px)); background: var(--v5-sticky-bar-bg); box-shadow: inset 0 1px 0 var(--v5-sticky-bar-border); -webkit-backdrop-filter: blur(16px) saturate(125%); backdrop-filter: blur(16px) saturate(125%); animation: dly-barup 520ms cubic-bezier(.16, 1, .3, 1) 300ms both; }
.dly-cta { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 52px; padding: 6px 20px; box-sizing: border-box; border-radius: 999px; background: var(--v5-brand); color: var(--v5-on-brand); font: 500 15px/20px var(--font-v5); text-align: center; overflow: hidden; cursor: pointer; }
.dly-cta svg { flex: none; }
.dly-cta__sheen { position: absolute; top: 0; bottom: 0; left: 0; width: 60px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .28), transparent); transform: translateX(-120%) skewX(-18deg); animation: dly-sheen 1200ms ease-out 900ms 1 both; pointer-events: none; }
.dly-cta__spin { flex: none; width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: dly-spin 800ms linear infinite; }
.dly-cta--sync { background: none; color: var(--v5-ink); }
.dly-cta--sync svg { color: var(--v5-warning-ink); }
.dly-done { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 18px 0 8px; box-sizing: border-box; border-radius: 999px; }
.dly-done__ok { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--v5-success-ink) 16%, transparent); color: var(--v5-success-ink); }
.dly-done__t { flex: 1; min-width: 0; font: 500 15px/20px var(--font-v5); color: var(--v5-ink); }
.dly-done__cd { flex: none; display: flex; align-items: center; gap: 6px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.dly-done__time { font: 500 15px/20px var(--font-metric); color: var(--v5-ink); font-variant-numeric: tabular-nums; }
@media (max-width: 374px) {
  .dly-done { padding-right: 14px; gap: 8px; }
  .dly-done__clk { display: none; }
}

/* Retained page shown again: no second entrance. */
.dly--instant .dly-hero, .dly--instant .dly-ring__dn, .dly--instant .dly-rail__item > .dly-tk, .dly--instant .dly-tk__sheen > view { animation: none; }

@keyframes dly-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes dly-slidein { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
@keyframes dly-lit { from { opacity: 0; } to { opacity: 1; } }
@keyframes dly-breathe { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes dly-breathe-light { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
@keyframes dly-barup { from { transform: translateY(100%); } to { transform: none; } }
@keyframes dly-sheen { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(420%) skewX(-18deg); } }
@keyframes dly-spin { to { transform: rotate(360deg); } }
@keyframes dly-burst { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(1.2); } }
/* 07 签到成功奖励: rise from the streak number to the flame spot, hold, then drift 12px up and out (clear of the gift). */
@keyframes dly-fly { 0% { opacity: 0; transform: translateY(56px); } 28% { opacity: 1; transform: none; } 66% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-12px); } }
@keyframes dly-fly-bar { 0% { opacity: 0; transform: translateY(40px); } 28% { opacity: 1; transform: none; } 66% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-28px); } }
@keyframes dly-fly-fade { 0% { opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .dly-hero, .dly-ring__dn, .dly-rail__item > .dly-tk, .dly-tk__sheen > view, .dly-cta__sheen, .dly-bar, .dly-burst { animation: none; }
  .dly-ring__td--breathe, [data-theme="light"] .dly-ring__td--breathe { opacity: 1; animation: none; }
  .dly-tk__sheen, .dly-cta__sheen { display: none; }
  /* The reward stays readable for the full 1900ms, fading in place (overrides the global reduce catch-all). */
  .dly .dly-fly, .dly-bar .dly-fly { animation: dly-fly-fade 1900ms linear both !important; animation-delay: 0s !important; }
}
</style>
