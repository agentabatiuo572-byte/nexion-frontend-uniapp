import { describe, expect, it } from "vitest";
import source from "./device-card-pc.vue?raw";
import { en } from "../../i18n/messages/en";
import { vi as viDict } from "../../i18n/messages/vi";
import { zh } from "../../i18n/messages/zh";

// The phone loss-ad previously shipped baked constants (110/38/9 → "−$157/day",
// a literal "142" task count) that the App presented as real, current
// opportunity. Every displayed number must now derive from the server
// task-pricing projection through the same VRAM gate the hardware card uses.
//
// The server's dailyPotential is an estimate (average task duration × reward ×
// queue saturation), not income the user actually lost, so the card must not
// render it as a subtracted loss. The sign and the label are asserted here
// because a "−$X lost every day" headline is exactly the misreading the
// estimate semantics forbid.
describe("phone locked-tasks loss-ad derives from the server projection", () => {
  it("takes the locked list and its total from the VRAM-gated projection", () => {
    expect(source).toMatch(/phoneTeasers\s*=\s*computed<LockedTeaser\[\]>\(\(\)\s*=>\s*earnConfig\.lockedTeasers\(props\.device\.vramTotal/);
    expect(source).toMatch(/phoneLockedDaily\s*=\s*computed\(\(\)\s*=>\s*phoneTeasers\.value\.reduce\(\(s,\s*it\)\s*=>\s*s\s*\+\s*it\.dailyPotentialUSD,\s*0\)\)/);
    expect(source).toMatch(/v-for="\(it, i\) in phoneTeasers"/);
    expect(source).toMatch(/\$\{\{\s*phoneLockedDaily\s*\}\}/);
    expect(source).toMatch(/\{\{\s*it\.dailyPotentialUSD\s*\}\}/);
  });

  it("never renders the estimate as a subtracted loss", () => {
    // U+2212 minus, the glyph the false loss-ad used.
    expect(source).not.toMatch(/−\$\{\{\s*(phone|hw)LockedDaily\s*\}\}/);
    for (const dict of [en, viDict, zh]) {
      expect(dict.earn.lockedMissedDaily).not.toMatch(/lost|mất|流失/);
    }
  });

  it("labels the figure as an estimate and disclaims actual lost income", () => {
    expect(source).toMatch(/t\.earn\.lockedPotentialDisclaimer/);
    expect(source).toMatch(/t\.earn\.lockedMissedDaily/);
    for (const dict of [en, viDict, zh]) {
      // The disclaimer must name the estimate basis, so a future edit cannot
      // quietly restore the "income you lost" reading.
      expect(dict.earn.lockedPotentialDisclaimer).toMatch(/est|ước tính|估算/i);
    }
  });

  it("derives the unlock count instead of printing a baked number", () => {
    expect(source).toMatch(/unlockText\s*=\s*computed\(\(\)\s*=>\s*t\.value\.earn\.unlockNMoreTasks\.replace\("\{n\}",\s*String\(phoneTeasers\.value\.length\)\)\)/);
    expect(source).not.toMatch(/replace\("\{n\}",\s*"142"\)/);
  });

  it("no longer ships the baked loss constants", () => {
    expect(source).not.toContain("LOCKED_ITEMS");
    expect(source).not.toContain("lockedTotalDaily");
    for (const baked of ["Llama 70B inference", "Flux.1 [dev] HD", "SDXL Turbo bulk"]) {
      expect(source).not.toContain(baked);
    }
  });

  it("hides the loss-ad entirely when the projection has nothing locked", () => {
    expect(source).toMatch(/v-if="device\.kind === 'phone' && phoneLockedVisible && phoneTeasers\.length"/);
  });
});
