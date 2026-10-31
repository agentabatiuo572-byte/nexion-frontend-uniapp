import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { nativeSvgIcons } from "./native-svg-icons.mjs";

test("native build converts tab and wallet icons while leaving large illustrations alone", () => {
  const previous = process.env.UNI_PLATFORM;
  process.env.UNI_PLATFORM = "app";
  try {
    const plugin = nativeSvgIcons();
    const tab = readFileSync(new URL("../src/components/app-chassis.vue", import.meta.url), "utf8");
    const transformed = plugin.transform(tab, "app-chassis.vue")?.code;
    assert.ok(transformed);
    assert.match(transformed, /<NxNativeSvg[^>]*\bwidth="22" height="22"/);
    assert.match(transformed, /<path :d="tab\.icon"\s*\/>/);
    assert.equal((transformed.match(/<NxNativeSvg/g) ?? []).length, 6);

    const mixed = '<template><svg width="24" height="24"><path d="M1" /></svg><svg width="248" height="248"><path d="M2" /></svg></template>';
    assert.equal(plugin.transform(mixed, "test.vue")?.code,
      '<template><NxNativeSvg width="24" height="24"><path d="M1" /></NxNativeSvg><svg width="248" height="248"><path d="M2" /></svg></template>');
    process.env.UNI_PLATFORM = "h5";
    assert.equal(plugin.transform(tab, "app-chassis.vue"), null);
  } finally {
    if (previous === undefined) delete process.env.UNI_PLATFORM;
    else process.env.UNI_PLATFORM = previous;
  }
});

test("Lite checkout confirmation check retains the supported SVG bridge and H5 markup", () => {
  const previous = process.env.UNI_PLATFORM;
  try {
    const source = readFileSync(new URL("../src/pages/store/checkout.vue", import.meta.url), "utf8");
    process.env.UNI_PLATFORM = "app";
    const transformed = nativeSvgIcons().transform(source, "checkout.vue")?.code ?? source;
    const confirmed = transformed.slice(transformed.indexOf('v-else-if="step === \'confirmed\'"'), transformed.indexOf("<!-- === activating === -->"));
    assert.match(confirmed, /<NxNativeSvg width="32" height="32"[^>]*><path d="M20 6 9 17l-5-5"\s*\/><\/NxNativeSvg>/);
    assert.doesNotMatch(confirmed, /<svg\b/);
    process.env.UNI_PLATFORM = "h5";
    assert.equal(nativeSvgIcons().transform(source, "checkout.vue"), null);
  } finally {
    if (previous === undefined) delete process.env.UNI_PLATFORM;
    else process.env.UNI_PLATFORM = previous;
  }
});
