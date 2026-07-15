import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const phoneDigits = `650${String(Date.now()).slice(-7)}`;
const fullPhone = `+1${phoneDigits}`;
const accountId = `${fullPhone}@demo.nexion.ai`;
const referralCode = "NEXION-AB12";
// argv 优先于环境变量：WSL 调用 node.exe 时临时环境变量可能不会跨进 Windows
// 进程，而 argv 能稳定保留 EN/ZH 两轮运行时回归的目标语言。
const locale = process.argv[2] === "zh" || (process.argv[2] !== "en" && process.env.AUTH02_LOCALE === "zh") ? "zh" : "en";
const registeredTitle = locale === "zh" ? "该手机号已注册" : "This number is already registered";
const registeredBody = locale === "zh" ? "验证通过,正在登录…" : "Verification complete. Signing you in…";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitUntil(check, message, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];

page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error") errors.push(text);
});
page.on("pageerror", (error) => errors.push(error.message));

async function resolveAppFrame(selector = null) {
  let match = null;
  await waitUntil(async () => {
    const frames = [...page.frames().filter((frame) => frame !== page.mainFrame()), page.mainFrame()];
    for (const frame of frames) {
      if (!selector || (await frame.locator(selector).count())) {
        match = frame;
        return true;
      }
    }
    return false;
  }, `app frame not ready${selector ? ` for ${selector}` : ""}`);
  return match;
}

async function gotoRegister(sequence, withReferral = true) {
  await page.goto(
    `${baseUrl}/?auth02=${runId}-${sequence}#/pages/register/register${withReferral ? `?ref=${referralCode}` : ""}`,
    { waitUntil: "domcontentloaded" },
  );
  const frame = await resolveAppFrame(".rg-root");
  await frame.locator(".rg-phone__in input").waitFor({ state: "visible" });
  return frame;
}

async function gotoLogin(sequence) {
  await page.goto(
    `${baseUrl}/?auth02=${runId}-${sequence}#/pages/login/login`,
    { waitUntil: "domcontentloaded" },
  );
  const frame = await resolveAppFrame(".lg-root");
  await frame.locator(".lg-phone__in input").waitFor({ state: "visible" });
  return frame;
}

async function signOutToDefault(frame, phone) {
  await frame.evaluate(async (phoneToReset) => {
    const { useApp } = await import("/src/store/app.ts");
    const { useAuth } = await import("/src/store/auth.ts");
    const { useSession } = await import("/src/store/session.ts");
    const { rebindAccountScopedStores } = await import("/src/lib/account-scope.ts");
    const auth = useAuth();
    useApp().interruptAllTasks("runtime-auth02-sign-out");
    useSession().signOutSession();
    auth.signOut();
    useApp().bindAccount("default");
    rebindAccountScopedStores("default");
    window.__nexionAuthDev.reset(phoneToReset);
  }, phone);
}

async function enterPhoneAndSend(frame, digits = phoneDigits) {
  await frame.locator(".rg-phone__in input").fill(digits);
  await frame.locator(".rg-cta").click();
  await frame.locator(".rg-step2").waitFor({ state: "visible", timeout: 10_000 });
}

async function enterOtp(frame) {
  const inputs = frame.locator(".rg-otp__in input");
  assert((await inputs.count()) === 6, "OTP input count is not 6");
  for (let index = 0; index < 6; index += 1) await inputs.nth(index).fill("1");
}

async function snapshot(frame, expectedPhone = fullPhone, expectedAccount = accountId) {
  return frame.evaluate(async ({ expectedPhone, expectedAccount }) => {
    const { inspectAuthAccounts } = await import("/src/store/auth-account.ts");
    const { listRiskRecords } = await import("/src/store/risk-identity.ts");
    const { useAuth } = await import("/src/store/auth.ts");
    const accounts = inspectAuthAccounts();
    const risks = listRiskRecords();
    const bills = (uni.getStorageSync("nexion-bills-accounts-v1") || {})[expectedAccount]?.bills || [];
    const sponsorship = uni.getStorageSync("nexion-sponsorship-v1") || {};
    return {
      accountsForPhone: accounts.filter((account) => account.phoneE164 === expectedPhone),
      accountCount: accounts.length,
      riskCount: risks.filter((risk) => risk.accountKey === expectedAccount).length,
      bonusBills: bills.filter((bill) => bill.type === "bonus" && bill.ref?.startsWith("GIFT-")).map((bill) => bill.id).sort(),
      giftClaimed: sponsorship.bindingsByAccount?.[expectedAccount]?.giftClaimed === true,
      giftMirror: sponsorship.giftClaimedByAccount?.[expectedAccount] === true,
      auth: {
        isAuthenticated: useAuth().isAuthenticated,
        accountId: useAuth().accountId,
        onboardingComplete: useAuth().onboardingComplete,
      },
    };
  }, { expectedPhone, expectedAccount });
}

async function assertAuthDirectorySchemaBarrier(frame) {
  const suffix = String(Date.now()).slice(-7);
  const legacyPhone = `+1655${suffix}`;
  const legacyAccount = `${legacyPhone}@demo.nexion.ai`;
  const recoveryPhone = `+1658${suffix}`;
  const recoveryAccount = `${recoveryPhone}@demo.nexion.ai`;
  const cleanupPhone = `+1659${suffix}`;
  const cleanupAccount = `${cleanupPhone}@demo.nexion.ai`;
  const pendingPhone = `+1656${suffix}`;
  const pendingAccount = `${pendingPhone}@demo.nexion.ai`;
  const freshPhone = `+1657${suffix}`;
  const result = await frame.evaluate(async ({ legacyPhone, legacyAccount, recoveryPhone, recoveryAccount, cleanupPhone, cleanupAccount, pendingPhone, pendingAccount, freshPhone }) => {
    const { buildCandidateRecord, readRiskRecordsStrict } = await import("/src/store/risk-identity.ts");
    const {
      AUTH_ACCOUNT_STORAGE_KEY,
      AUTH_ACCOUNT_LEGACY_MIGRATION_KEY,
      resolveAuthAccount,
      resolveAuthAccountById,
    } = await import("/src/store/auth-account.ts");
    const { otpSend, otpVerify, registerVerifiedPhone } = await import("/src/store/auth-otp.ts");
    const { commitRegistration } = await import("/src/store/risk-cluster.ts");
    const { completeSignIn } = await import("/src/auth/complete-sign-in.ts");
    const riskKey = "nexion-risk-registry-v1";
    const reset = () => localStorage.clear();
    const reserve = async (phone) => {
      const sent = await otpSend(phone, "register");
      if (!sent.ok) return { ok: false, stage: "send", sent };
      const verified = await otpVerify(phone, "register", sent.requestId, "111111");
      if (!verified.ok) return { ok: false, stage: "verify", verified };
      return registerVerifiedPhone(phone, verified.verifyToken, {
        sponsorCode: null,
        giftRoute: "pending_review",
      });
    };

    // A/B: schema1 is the only legacy provenance. Its first migration seals risk to
    // schema2; a later directory deletion must not recreate an active account.
    reset();
    uni.setStorageSync(riskKey, {
      schema: 1,
      accounts: { [legacyAccount]: buildCandidateRecord(legacyAccount, null) },
    });
    uni.removeStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    const legacyFirst = resolveAuthAccount(legacyPhone);
    const legacyRiskAfterMigration = readRiskRecordsStrict();
    const legacyDirectory = uni.getStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    uni.removeStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    const legacyAfterDeletePhone = resolveAuthAccount(legacyPhone);
    const legacyAfterDeleteId = resolveAuthAccountById(legacyAccount);
    const legacyDirectoryRecreated = uni.getStorageSync(AUTH_ACCOUNT_STORAGE_KEY);

    // C: schema1→schema2 的两 key 迁移中，目录写失败一次也必须保留可恢复证据；
    // 恢复写入后只补完这个明确的 legacy 事务，不能把普通 schema2 缺目录重建。
    reset();
    uni.setStorageSync(riskKey, {
      schema: 1,
      accounts: { [recoveryAccount]: buildCandidateRecord(recoveryAccount, null) },
    });
    const originalSetStorageSync = uni.setStorageSync;
    let blockedDirectoryWrite = false;
    uni.setStorageSync = (key, value) => {
      if (!blockedDirectoryWrite && key === AUTH_ACCOUNT_STORAGE_KEY) {
        blockedDirectoryWrite = true;
        throw new Error("runtime injected auth-directory write failure");
      }
      return originalSetStorageSync.call(uni, key, value);
    };
    let interruptedLegacyMigration;
    try {
      interruptedLegacyMigration = resolveAuthAccount(recoveryPhone);
    } finally {
      uni.setStorageSync = originalSetStorageSync;
    }
    const recoveryRiskAfterFailure = readRiskRecordsStrict();
    const recoveryDirectoryAfterFailure = uni.getStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    const recoveryJournalAfterFailure = uni.getStorageSync(AUTH_ACCOUNT_LEGACY_MIGRATION_KEY);
    const recoveredLegacy = resolveAuthAccount(recoveryPhone);
    const recoveryDirectory = uni.getStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    const recoveryJournalAfterSuccess = uni.getStorageSync(AUTH_ACCOUNT_LEGACY_MIGRATION_KEY);

    // D: 目录成功后 journal 的 remove 即使失败，也必须留下 committed 栅栏；此时
    // 再删除目录不得触发 legacy 恢复，避免普通 schema2 数据复活为 active。
    reset();
    uni.setStorageSync(riskKey, {
      schema: 1,
      accounts: { [cleanupAccount]: buildCandidateRecord(cleanupAccount, null) },
    });
    const originalRemoveStorageSync = uni.removeStorageSync;
    let blockedJournalCleanup = false;
    uni.removeStorageSync = (key) => {
      if (!blockedJournalCleanup && key === AUTH_ACCOUNT_LEGACY_MIGRATION_KEY) {
        blockedJournalCleanup = true;
        throw new Error("runtime injected legacy journal cleanup failure");
      }
      return originalRemoveStorageSync.call(uni, key);
    };
    let cleanupMigration;
    try {
      cleanupMigration = resolveAuthAccount(cleanupPhone);
    } finally {
      uni.removeStorageSync = originalRemoveStorageSync;
    }
    const cleanupJournalAfterFailure = uni.getStorageSync(AUTH_ACCOUNT_LEGACY_MIGRATION_KEY);
    uni.removeStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    const cleanupAfterDirectoryDelete = resolveAuthAccount(cleanupPhone);
    const cleanupDirectoryRecreated = uni.getStorageSync(AUTH_ACCOUNT_STORAGE_KEY);

    // E: a real pending reservation that has reached K1 risk persistence writes
    // schema2. Removing only the directory must fail closed for both lookup paths.
    reset();
    const pendingReserve = await reserve(pendingPhone);
    const pendingRiskCommitted = pendingReserve.ok && commitRegistration(pendingAccount, { sponsorId: null });
    const pendingBeforeDelete = resolveAuthAccountById(pendingAccount);
    const pendingRisk = readRiskRecordsStrict();
    uni.removeStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    const pendingAfterDeletePhone = resolveAuthAccount(pendingPhone);
    const pendingAfterDeleteId = resolveAuthAccountById(pendingAccount);
    const pendingSignIn = completeSignIn({ identity: pendingAccount });

    // F: an empty store still permits a genuine pending reservation for a new phone.
    reset();
    const freshReserve = await reserve(freshPhone);
    const freshById = resolveAuthAccountById(`${freshPhone}@demo.nexion.ai`);
    const freshDirectory = uni.getStorageSync(AUTH_ACCOUNT_STORAGE_KEY);
    return {
      legacyFirst,
      legacyRiskAfterMigration,
      legacyDirectory,
      legacyAfterDeletePhone,
      legacyAfterDeleteId,
      legacyDirectoryRecreated,
      blockedDirectoryWrite,
      interruptedLegacyMigration,
      recoveryRiskAfterFailure,
      recoveryDirectoryAfterFailure,
      recoveryJournalAfterFailure,
      recoveredLegacy,
      recoveryDirectory,
      recoveryJournalAfterSuccess,
      blockedJournalCleanup,
      cleanupMigration,
      cleanupJournalAfterFailure,
      cleanupAfterDirectoryDelete,
      cleanupDirectoryRecreated,
      pendingReserve,
      pendingRiskCommitted,
      pendingBeforeDelete,
      pendingRisk,
      pendingAfterDeletePhone,
      pendingAfterDeleteId,
      pendingSignIn,
      freshReserve,
      freshById,
      freshDirectory,
    };
  }, { legacyPhone, legacyAccount, recoveryPhone, recoveryAccount, cleanupPhone, cleanupAccount, pendingPhone, pendingAccount, freshPhone });

  assert(result.legacyFirst?.ok && result.legacyFirst.account?.status === "active" && result.legacyFirst.account?.onboardingComplete, "schema1 legacy account did not migrate as active/onboarding-complete");
  assert(result.legacyRiskAfterMigration?.ok && result.legacyRiskAfterMigration.sourceSchema === 2, "legacy migration did not seal risk storage to schema2");
  assert(result.legacyDirectory?.schema === 2, "legacy migration did not write auth directory schema2");
  assert(!result.legacyAfterDeletePhone?.ok && result.legacyAfterDeletePhone.error === "account_directory_unavailable", "schema2 legacy directory deletion recreated an active phone account");
  assert(!result.legacyAfterDeleteId?.ok && result.legacyAfterDeleteId.error === "account_directory_unavailable", "schema2 legacy directory deletion recreated an active account id");
  assert(!result.legacyDirectoryRecreated, "schema2 legacy directory was unexpectedly rewritten after deletion");
  assert(result.blockedDirectoryWrite, "legacy migration failure injection did not block the auth-directory write");
  assert(!result.interruptedLegacyMigration?.ok && result.interruptedLegacyMigration.error === "account_directory_unavailable", "interrupted legacy migration did not fail safely for the current request");
  assert(result.recoveryRiskAfterFailure?.ok && result.recoveryRiskAfterFailure.sourceSchema === 2, "interrupted legacy migration did not preserve sealed risk evidence");
  assert(!result.recoveryDirectoryAfterFailure, "interrupted legacy migration unexpectedly wrote the auth directory");
  assert(result.recoveryJournalAfterFailure?.state === "risk-sealed-pending-directory", "interrupted legacy migration did not preserve its recoverable journal state");
  assert(result.recoveredLegacy?.ok && result.recoveredLegacy.account?.status === "active", "legacy migration did not recover after a transient auth-directory write failure");
  assert(result.recoveryDirectory?.schema === 2, "recovered legacy migration did not write the auth directory");
  assert(!result.recoveryJournalAfterSuccess, "legacy migration recovery journal was not cleared after a successful directory write");
  assert(result.blockedJournalCleanup, "legacy migration cleanup-failure injection did not block journal removal");
  assert(result.cleanupMigration?.ok && result.cleanupMigration.account?.status === "active", "legacy migration did not finish before the injected journal cleanup failure");
  assert(result.cleanupJournalAfterFailure?.state === "directory-committed", "failed journal cleanup did not retain a committed fail-closed barrier");
  assert(!result.cleanupAfterDirectoryDelete?.ok && result.cleanupAfterDirectoryDelete.error === "account_directory_unavailable", "committed legacy migration recreated an account after directory deletion");
  assert(!result.cleanupDirectoryRecreated, "committed legacy migration unexpectedly rewrote a deleted directory");
  assert(result.pendingReserve?.ok && result.pendingRiskCommitted, "pending reservation did not reach persisted K1 state");
  assert(result.pendingBeforeDelete?.ok && result.pendingBeforeDelete.account?.status === "pending", "pending reservation was not preserved before deletion");
  assert(result.pendingRisk?.ok && result.pendingRisk.sourceSchema === 2, "pending K1 persistence did not seal risk storage to schema2");
  assert(!result.pendingAfterDeletePhone?.ok && result.pendingAfterDeletePhone.error === "account_directory_unavailable", "pending phone became resolvable after directory deletion");
  assert(!result.pendingAfterDeleteId?.ok && result.pendingAfterDeleteId.error === "account_directory_unavailable", "pending account id became resolvable after directory deletion");
  assert(result.pendingSignIn?.ok === false && result.pendingSignIn.error === "account_directory_unavailable", "pending account bypassed canonical sign-in after directory deletion");
  assert(result.freshReserve?.ok && !result.freshReserve.alreadyCommitted, "empty storage did not permit a new pending reservation");
  assert(result.freshById?.ok && result.freshById.account?.status === "pending", "fresh reservation did not remain pending");
  assert(result.freshDirectory?.schema === 2, "fresh reservation did not create auth directory schema2");
}

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  let localeFrame = await gotoRegister("schema-barrier");
  await assertAuthDirectorySchemaBarrier(localeFrame);
  await page.evaluate(() => localStorage.clear());
  localeFrame = await gotoRegister("locale");
  await localeFrame.evaluate(async (nextLocale) => {
    const { useLocaleStore } = await import("/src/store/locale.ts");
    useLocaleStore().setLocale(nextLocale);
  }, locale);

  // 新号在验证码前不泄露账号状态，验码后才走设置密码；成功后只创建一套账号、风控
  // 与礼包副作用。
  let frame = await gotoRegister("new");
  assert(!(await frame.locator("body").innerText()).includes(registeredTitle), "new-number page disclosed account status before OTP");
  await enterPhoneAndSend(frame);
  assert(!(await frame.locator("body").innerText()).includes(registeredTitle), "OTP send disclosed account status");
  await enterOtp(frame);
  await frame.locator(".rg-step3").waitFor({ state: "visible", timeout: 10_000 });

  const beforeCreate = await frame.evaluate((phone) => window.__nexionAuthDev.inspect(phone), fullPhone);
  assert(beforeCreate.account?.ok && beforeCreate.account.account === null, "new phone became active before password submit");
  assert(beforeCreate.verifyTokens?.[0]?.nextAction === "continue_registration", "new-number OTP did not continue registration");

  const passwords = frame.locator(".rg-step3 input");
  await passwords.nth(0).fill("StrongPass123!");
  await passwords.nth(1).fill("StrongPass123!");
  await frame.locator(".rg-cta").click();
  await waitUntil(() => Promise.resolve(page.url().includes("#/pages/register/success")), "new-number registration did not reach success page");
  frame = await resolveAppFrame(".rs-root");
  const afterCreate = await snapshot(frame);
  assert(afterCreate.accountsForPhone.length === 1 && afterCreate.accountCount === 1, "new registration did not create exactly one account");
  assert(afterCreate.riskCount === 1, "new registration did not create exactly one risk record");
  assert(afterCreate.bonusBills.length === 2, "new registration did not create two welcome-gift bills");
  assert(afterCreate.giftClaimed && afterCreate.giftMirror, "welcome gift was not safely bound to this account");
  assert(afterCreate.auth.isAuthenticated && afterCreate.auth.accountId === accountId, "new registration did not establish the expected session");
  assert(!afterCreate.auth.onboardingComplete, "new registration skipped onboarding");

  // 将该账号完成 onboarding 后按真实登出链退出，证明回访入口恢复的是同一账号而非
  // 再走注册副作用。
  await frame.evaluate(async (phone) => {
    const { useApp } = await import("/src/store/app.ts");
    const { useAuth } = await import("/src/store/auth.ts");
    const { markAuthAccountOnboardingComplete } = await import("/src/store/auth-account.ts");
    const { useSession } = await import("/src/store/session.ts");
    const { rebindAccountScopedStores } = await import("/src/lib/account-scope.ts");
    const auth = useAuth();
    if (!markAuthAccountOnboardingComplete(auth.accountId)) throw new Error("onboarding account fact did not persist");
    auth.completeOnboarding();
    useApp().interruptAllTasks("runtime-auth02-sign-out");
    useSession().signOutSession();
    auth.signOut();
    useApp().bindAccount("default");
    rebindAccountScopedStores("default");
    window.__nexionAuthDev.reset(phone);
  }, fullPhone);

  // 已注册号同样不在发码前泄露状态；验码后立即进入既有登录链，目标页 toast
  // 持续展示双行反馈；这个过程中不得挂载密码页或再次进入注册成功页。
  frame = await gotoRegister("existing");
  assert(!(await frame.locator("body").innerText()).includes(registeredTitle), "existing-number page disclosed account status before OTP");
  await enterPhoneAndSend(frame);
  assert(!(await frame.locator("body").innerText()).includes(registeredTitle), "existing-number OTP send disclosed account status");
  await frame.evaluate(() => {
    window.__auth02SawPassword = false;
    const inspect = () => {
      if (document.querySelector(".rg-step3")) window.__auth02SawPassword = true;
    };
    new MutationObserver(inspect).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    inspect();
  });
  await enterOtp(frame);
  await waitUntil(() => Promise.resolve(!page.url().includes("#/pages/register/register")), "existing-number OTP did not switch to the existing sign-in route");
  assert(!(await frame.evaluate(() => window.__auth02SawPassword)), "existing-number flow mounted the password step");
  frame = await resolveAppFrame();
  const toastFrame = await resolveAppFrame(".nx-toast");
  const toast = toastFrame.locator(".nx-toast").first();
  const toastText = await toast.innerText();
  const toastA11y = await toast.evaluate((element) => ({
    role: element.getAttribute("role"),
    live: element.getAttribute("aria-live"),
    atomic: element.getAttribute("aria-atomic"),
  }));
  assert(toastText.includes(registeredTitle), "existing-number handoff feedback did not persist to the destination toast");
  assert(toastText.includes(registeredBody), "existing-number handoff toast did not explain automatic sign-in");
  assert(toastA11y.role === "status" && toastA11y.live === "polite" && toastA11y.atomic === "true", "existing-number handoff toast is not announced to assistive technology");
  if (process.env.AUTH02_SCREENSHOT) {
    await toast.screenshot({ path: process.env.AUTH02_SCREENSHOT });
  }
  const afterExistingSignIn = await snapshot(frame);
  assert(afterExistingSignIn.auth.isAuthenticated && afterExistingSignIn.auth.accountId === accountId, "existing-number flow authenticated the wrong account");
  assert(afterExistingSignIn.auth.onboardingComplete, "existing-number flow lost completed onboarding state");
  assert(afterExistingSignIn.accountCount === afterCreate.accountCount && afterExistingSignIn.accountsForPhone.length === 1, "existing-number flow created another account");
  assert(afterExistingSignIn.riskCount === afterCreate.riskCount, "existing-number flow created another risk record");
  assert(JSON.stringify(afterExistingSignIn.bonusBills) === JSON.stringify(afterCreate.bonusBills), "existing-number flow created duplicate welcome-gift bills");
  assert(afterExistingSignIn.giftClaimed && afterExistingSignIn.giftMirror, "existing-number flow changed gift ownership");

  // 登录收口不能让不存在的手机号身份绕过目录直接建立会话。
  const unregisteredGuard = await frame.evaluate(async ({ expectedAccount, phone }) => {
    const { completeSignIn } = await import("/src/auth/complete-sign-in.ts");
    const { useAuth } = await import("/src/store/auth.ts");
    const result = completeSignIn({ identity: `${phone}@demo.nexion.ai` });
    return { result, accountId: useAuth().accountId, expectedAccount };
  }, { expectedAccount: accountId, phone: `+1651${String(Date.now()).slice(-7)}` });
  assert(unregisteredGuard.result?.ok === false && unregisteredGuard.result.error === "account_not_found", "unregistered phone bypassed the account directory");
  assert(unregisteredGuard.accountId === unregisteredGuard.expectedAccount, "rejected sign-in changed the active account");

  // 登录 OTP 第六位触发验码后立刻“更换手机号”，旧异步响应不得在退回步骤一后
  // 把已注册账号重新登录。
  await signOutToDefault(frame, fullPhone);
  let loginFrame = await gotoLogin("stale-login");
  await loginFrame.locator(".lg-switch").click();
  await loginFrame.locator(".lg-phone__in input").fill(phoneDigits);
  await loginFrame.locator(".lg-cta").click();
  await loginFrame.locator(".lg-otp").waitFor({ state: "visible", timeout: 10_000 });
  const loginOtpInputs = loginFrame.locator(".lg-otp__in input");
  assert((await loginOtpInputs.count()) === 6, "login OTP input count is not 6");
  for (let index = 0; index < 6; index += 1) await loginOtpInputs.nth(index).fill("1");
  await loginFrame.locator(".lg-resend__change").click();
  await page.waitForTimeout(1_200);
  assert(page.url().includes("#/pages/login/login"), "stale login OTP response navigated away from the login page");
  await loginFrame.locator(".lg-phone__in input").waitFor({ state: "visible" });
  const staleLoginState = await loginFrame.evaluate(async (expectedAccount) => {
    const { useApp } = await import("/src/store/app.ts");
    const { useAuth } = await import("/src/store/auth.ts");
    const { readAccountSessionRecords, useSession } = await import("/src/store/session.ts");
    const auth = useAuth();
    const session = useSession();
    return {
      auth: { isAuthenticated: auth.isAuthenticated, accountId: auth.accountId },
      session: { status: session.status, sessionId: session.sessionId, activeTargetSessions: readAccountSessionRecords(expectedAccount).length },
      appAccountKey: useApp().accountKey,
    };
  }, accountId);
  assert(!staleLoginState.auth.isAuthenticated && staleLoginState.auth.accountId === "default", "stale login OTP response restored authentication");
  assert(staleLoginState.session.sessionId === "" && staleLoginState.session.activeTargetSessions === 0, `stale login OTP response recreated a session: ${JSON.stringify(staleLoginState)}`);
  assert(staleLoginState.appAccountKey === "default", "stale login OTP response rebound the app account scope");

  // K1 落表失败时，注册页面虽已暂时切到新作用域，也必须恢复此前已登录账号；解除
  // 故障后的重试只能完成一份风险/礼包/账单副作用。
  const resumeOldForRollback = await loginFrame.evaluate(async (identity) => {
    const { completeSignIn } = await import("/src/auth/complete-sign-in.ts");
    return completeSignIn({ identity });
  }, accountId);
  assert(resumeOldForRollback?.ok, "could not restore the existing account before rollback test");
  const rollbackDigits = `653${String(Date.now()).slice(-7)}`;
  const rollbackPhone = `+1${rollbackDigits}`;
  const rollbackAccount = `${rollbackPhone}@demo.nexion.ai`;
  frame = await gotoRegister("risk-rollback");
  await enterPhoneAndSend(frame, rollbackDigits);
  await enterOtp(frame);
  await frame.locator(".rg-step3").waitFor({ state: "visible", timeout: 10_000 });
  const rollbackPasswords = frame.locator(".rg-step3 input");
  await rollbackPasswords.nth(0).fill("StrongPass123!");
  await rollbackPasswords.nth(1).fill("StrongPass123!");
  await frame.evaluate(() => {
    const original = Storage.prototype.setItem;
    let consumed = false;
    Storage.prototype.setItem = function setItemWithRiskFailure(key, value) {
      if (!consumed && String(key).includes("nexion-risk-registry-v1")) {
        consumed = true;
        throw new Error("runtime_auth02_injected_risk_storage_failure");
      }
      return original.call(this, key, value);
    };
    window.__auth02RestoreRiskStorage = () => { Storage.prototype.setItem = original; };
  });
  try {
    await frame.locator(".rg-cta").click();
    await frame.locator(".rg-error").waitFor({ state: "visible", timeout: 10_000 });
    const rolledBack = await frame.evaluate(async ({ oldAccount, newAccount }) => {
      const { useApp } = await import("/src/store/app.ts");
      const { useAuth } = await import("/src/store/auth.ts");
      const { useSession } = await import("/src/store/session.ts");
      const { resolveAuthAccountById } = await import("/src/store/auth-account.ts");
      const { getRiskRecord } = await import("/src/store/risk-identity.ts");
      const auth = useAuth();
      const session = useSession();
      return {
        auth: { isAuthenticated: auth.isAuthenticated, accountId: auth.accountId },
        session: { accountKey: session.accountKey, status: session.status, sessionId: session.sessionId },
        appAccountKey: useApp().accountKey,
        pending: resolveAuthAccountById(newAccount),
        riskForNewAccount: getRiskRecord(newAccount),
        oldAccount,
      };
    }, { oldAccount: accountId, newAccount: rollbackAccount });
    assert(rolledBack.auth.isAuthenticated && rolledBack.auth.accountId === rolledBack.oldAccount, "K1 failure did not retain the prior authenticated account");
    assert(rolledBack.session.accountKey === rolledBack.oldAccount && rolledBack.session.status === "active", "K1 failure changed the prior session scope");
    assert(rolledBack.appAccountKey === rolledBack.oldAccount, "K1 failure did not restore the prior app account scope");
    assert(rolledBack.pending?.ok && rolledBack.pending.account?.status === "pending", "K1 failure did not preserve only the new pending reservation");
    assert(rolledBack.riskForNewAccount === null, "K1 failure wrote a partial risk identity");
  } finally {
    await frame.evaluate(() => window.__auth02RestoreRiskStorage?.());
  }
  await frame.locator(".rg-cta").click();
  await waitUntil(() => Promise.resolve(page.url().includes("#/pages/register/success")), "retry after K1 failure did not reach success page");
  frame = await resolveAppFrame(".rs-root");
  const afterRollbackRetry = await snapshot(frame, rollbackPhone, rollbackAccount);
  assert(afterRollbackRetry.auth.isAuthenticated && afterRollbackRetry.auth.accountId === rollbackAccount, "retry after K1 failure did not establish the new account session");
  assert(afterRollbackRetry.accountsForPhone.length === 1 && afterRollbackRetry.riskCount === 1, "retry after K1 failure did not converge on one account and risk record");
  assert(afterRollbackRetry.bonusBills.length === 2 && afterRollbackRetry.giftClaimed && afterRollbackRetry.giftMirror, "retry after K1 failure duplicated or lost welcome-gift side effects");

  // 验码请求尚未返回时改号，旧响应不能污染新号码步骤或生成账号。
  const stalePhoneDigits = `652${String(Date.now()).slice(-7)}`;
  const stalePhone = `+1${stalePhoneDigits}`;
  frame = await gotoRegister("stale", false);
  await enterPhoneAndSend(frame, stalePhoneDigits);
  await enterOtp(frame);
  await frame.locator(".rg-resend__change").click();
  await page.waitForTimeout(800);
  assert(await frame.locator(".rg-phone").count() === 1, "stale OTP response did not return to the changed-number step");
  assert(await frame.locator(".rg-step3").count() === 0, "stale OTP response entered the password step");
  const staleAccount = await frame.evaluate((phone) => window.__nexionAuthDev.inspect(phone), stalePhone);
  assert(staleAccount.account?.ok && staleAccount.account.account === null, "stale OTP response created an account");

  assert(errors.length === 0, `browser console/page errors: ${errors.join(" | ")}`);
  console.log(`FEAT-AUTH02 runtime PASS (${locale}): new registration + readable existing-number handoff + no duplicate side effects`);
} finally {
  await browser.close();
}
