import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("remote Nova uses the authenticated local-AI backend instead of HOLD or mock templates", () => {
  const chat = read("src/pages/support/chat.vue");
  const messages = read("src/pages/support/messages.vue");
  const runtime = read("src/api/runtime.ts");

  assert.match(chat, /novaAiApi\.chat/);
  assert.match(chat, /novaAiApi\.status/);
  assert.match(chat, /nova\.bindRemoteAccount\(app\.accountKey\)/);
  assert.doesNotMatch(chat, /if \(remoteApiEnabled\)[\s\S]{0,180}NOVA_PROVIDER_HOLD/);
  assert.match(messages, /key: "ai"/);
  assert.doesNotMatch(messages, /if \(!remoteApiEnabled\) available\.push\(\{ key: "ai"/);
  assert.match(runtime, /export const novaAiApi = createNovaAiApi\(apiClient\)/);
});

test("local AI contract keeps provider truth and sensitive-data warning visible", () => {
  const api = read("src/api/nova-ai-api.ts");
  const en = read("src/i18n/messages/en.ts");
  const zh = read("src/i18n/messages/zh.ts");
  const vi = read("src/i18n/messages/vi.ts");
  assert.match(api, /OLLAMA_LOCAL/);
  assert.match(api, /LOCAL_MACHINE/);
  assert.match(en, /password[\s\S]{0,120}OTP[\s\S]{0,120}private key/i);
  for (const messages of [en, zh, vi]) {
    assert.match(messages, /localSafetyNotice/);
    assert.match(messages, /localUnavailable/);
  }
});

test("human support routes never inherit Nova connection or HOLD state", () => {
  const chat = read("src/pages/support/chat.vue");

  assert.match(chat, /const novaProviderHold = ref\(false\)/);
  assert.match(chat, /const novaStatusLoading = ref\(false\)/);
  assert.match(chat, /isAi\.value && novaStatusLoading\.value/);
  assert.match(chat, /isAi\.value && novaProviderHold\.value/);
  assert.match(
    chat,
    /isAi\.value \? novaProviderHold\.value : conv\.value\?\.sessionStatus === "closed"/,
  );
});

test("remote tab routes keep a persistent Nova launcher without mock push timers", () => {
  const chassis = read("src/components/app-chassis.vue");
  const bubble = read("src/components/nova/nova-bubble.vue");

  assert.match(chassis, /<NovaBubble v-if="isTabRoute"\s*\/>/);
  assert.doesNotMatch(chassis, /NovaBubble[^>]+!remoteApiEnabled/);
  assert.match(bubble, /const visible = computed\(\(\) => remoteApiEnabled \|\| totalUnread\.value > 0\)/);
  assert.match(bubble, /v-if="showUnreadBadge"/);
  assert.match(bubble, /const showUnreadBadge = computed\(\(\) => totalUnread\.value > 0\)/);
  assert.match(bubble, /remoteApiEnabled \? nova\.unread : nova\.unread \+ conversations\.totalUnread/);
  assert.match(
    bubble,
    /navTo\(remoteApiEnabled \? "\/pages\/support\/chat\?type=ai" : "\/pages\/support\/messages"\)/,
  );
  assert.match(bubble, /if \(remoteApiEnabled\) \{[\s\S]{0,120}notifications\.refreshRemote\(\);[\s\S]{0,80}return;/);
});
