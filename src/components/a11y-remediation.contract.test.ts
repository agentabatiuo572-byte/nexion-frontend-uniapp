import { describe, expect, it } from "vitest";

const sources = import.meta.glob([
  "./me/device-deactivate-sheet.vue",
  "./me/theme-picker-sheet.vue",
  "./me/nickname-sheet.vue",
  "./me/receipt-modal.vue",
  "./slot-action-sheet.vue",
  "./tradein-sheets.vue",
  "./me/theme-row.vue",
  "../pages/me/wallet-withdraw.vue",
  "../pages/me/language.vue",
  "../pages/me/security.vue",
  "../pages/me/wallet.vue",
  "../pages/team/team.vue",
  "../pages/compute-share/download.vue",
  "../pages/learn/course.vue",
  "../pages/me/proof.vue",
  "./earn/capacity-explainer-sheet.vue",
  "./me/fx-rate-line.vue",
  "./me/tradein-ladder-sheet.vue",
  "./home/conversion-banner.vue",
  "../pages/developer/developer.vue",
], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const read = (relative: string) => sources[relative] ?? "";

describe("accessibility remediation contracts", () => {
  it.each([
    ["./me/device-deactivate-sheet.vue", "nx-device-deactivate-root", "props.device !== null"],
    ["./me/theme-picker-sheet.vue", "nx-theme-picker-root", "props.open"],
    ["./me/nickname-sheet.vue", "nx-nickname-sheet-root", "props.open"],
    ["./me/receipt-modal.vue", "nx-receipt-modal-root", "props.receipt !== null"],
  ])("makes %s a named, focus-trapped dialog", (file, root, openExpression) => {
    const source = read(file);
    expect(source).toContain(`class=\"${root}\" role=\"dialog\" aria-modal=\"true\"`);
    expect(source).toContain(`useDialogA11y(computed(() => ${openExpression}), \".${root}\"`);
  });

  it("keeps sheet actions keyboard-operable and blocks insufficient replacement", () => {
    expect(read("./slot-action-sheet.vue")).toContain('class="sas-close" role="button" tabindex="0"');
    const tradein = read("./tradein-sheets.vue");
    expect(tradein).toContain(':aria-disabled="replaceView.insufficient || confirming"');
    expect(tradein).toContain(':aria-busy="confirming"');
    expect(tradein).toContain('if (replaceView.value?.insufficient) return;');
    expect(tradein).toContain('class="tis-close" role="button" tabindex="0"');
  });

  it("preserves a single keyboard focus stop for theme and withdrawal radio groups", () => {
    const themeRow = read("./me/theme-row.vue");
    expect(themeRow).toContain('data-theme-mode="light"');
    expect(themeRow).toContain('nextTick(() =>');
    const withdraw = read("../pages/me/wallet-withdraw.vue");
    expect(withdraw).toContain('nx-withdraw-network-radio');
    expect(withdraw).toContain('@keydown.left.prevent="moveNetwork(-1)"');
    expect(withdraw).toContain('function moveNetwork(delta: number)');
  });

  it("keeps language and destructive security controls keyboard-operable", () => {
    const language = read("../pages/me/language.vue");
    expect(language).toContain(':aria-pressed="l.code === code"');
    expect(language).toContain('@keydown.space.prevent="pick(l.code)"');
    expect(language).toContain('@keydown.enter.prevent="retryCurrentProfileLocale"');
    expect(language).toContain('@keydown.space.prevent="goAccount"');

    const security = read("../pages/me/security.vue");
    expect(security).toContain('@keydown.space.prevent="editingPwd = !editingPwd"');
    expect(security).toContain('@keydown.enter.prevent="submitPasswordChange"');
    expect(security).toContain('@keydown.space.prevent="handleRevoke(s)"');
    expect(security).toContain('@keydown.enter.prevent="handleRevokeAll"');
    expect(security).toContain('@keydown.space.prevent="handleDeleteAccount"');
    expect(security).toContain('@keydown.enter.prevent="handleCancelAccountDeletion"');
  });

  it("uses the shared semantic activation contract on wallet, team, download, learning and developer actions", () => {
    const wallet = read("../pages/me/wallet.vue");
    expect(wallet).toContain('role="button" tabindex="0" :aria-label="t.wallet.nexBalance"');
    expect(wallet).toContain('role="button" tabindex="0" :aria-label="t.wallet.topUp"');

    const team = read("../pages/team/team.vue");
    expect(team).toContain('class="nx-team-rank-link relative overflow-hidden rounded-2xl active:opacity-95" role="button" tabindex="0"');
    expect(team).toContain('class="nx-team-leaderboard-link active:opacity-95" role="button" tabindex="0"');

    const download = read("../pages/compute-share/download.vue");
    expect(download).toContain('role="button" tabindex="0" :aria-label="t.computeShare.downloadCta"');
    expect(download).toContain('role="button"');
    expect(download).toContain(':aria-pressed="selectedModel === model"');

    const course = read("../pages/learn/course.vue");
    expect(course).toContain('role="button" tabindex="0" :aria-label="t.learning.courseUnavailable"');
    expect(course).toContain(':aria-pressed="answers[index] === optionIndex"');

    const developer = read("../pages/developer/developer.vue");
    expect(developer).toContain('role="tablist"');
    expect(developer).toContain('role="tab" tabindex="0"');
    expect(developer).toContain(':aria-selected="tab === o.value ? \'true\' : \'false\'"');
    expect(developer).toContain('role="button" tabindex="0" :aria-label="t.developer.formSubmit"');

    const proof = read("../pages/me/proof.vue");
    expect(proof).toContain('@keydown.enter.stop.prevent="refreshRemoteProof"');
    expect(proof).toContain('@keydown.space.stop.prevent="copyLink"');
    expect(proof).toContain('@keydown.enter.stop.prevent="nativeShare"');
    expect(proof).toContain('@keydown.space.stop.prevent="d.onClick"');
  });

  it.each([
    ["./earn/capacity-explainer-sheet.vue", "nx-capacity-explainer-root", "visible.value"],
    ["./me/fx-rate-line.vue", "nx-fx-sheet-root", "sheetOpen.value"],
    ["./me/tradein-ladder-sheet.vue", "nx-tradein-ladder-root", "props.device !== null"],
  ])("makes %s a labelled, escaped and focus-trapped dialog", (file, root, openExpression) => {
    const source = read(file);
    expect(source).toMatch(new RegExp(`class="${root}[^\"]*"[^>]*role="dialog" aria-modal="true"`));
    expect(source).toContain(`useDialogA11y(computed(() => ${openExpression}), ".${root}"`);
  });

  it("names weekly recovery by the underlying state instead of presenting every case as a generic retry", () => {
    const banner = read("./home/conversion-banner.vue");
    expect(banner).toContain('weeklyRetryLabel');
    expect(banner).toContain('weeklyRetryAriaLabel');
    expect(banner).toContain('t.value.weeklyQuest.retryLogin');
    expect(banner).toContain('t.value.weeklyQuest.retryNetwork');
    expect(banner).toContain('t.value.weeklyQuest.noTaskAction');
  });
});
