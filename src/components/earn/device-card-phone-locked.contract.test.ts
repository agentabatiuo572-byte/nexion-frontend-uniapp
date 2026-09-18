import { describe, expect, it } from "vitest";
import source from "./device-card-pc.vue?raw";

// The phone loss-ad previously shipped baked constants (110/38/9 → "−$157/day",
// a literal "142" task count) that the App presented as real, current
// opportunity. Every displayed number must now derive from the server
// task-pricing projection through the same VRAM gate the hardware card uses.
describe("phone locked-tasks loss-ad derives from the server projection", () => {
  it("takes the locked list and its total from the VRAM-gated projection", () => {
    expect(source).toMatch(/phoneTeasers\s*=\s*computed<LockedTeaser\[\]>\(\(\)\s*=>\s*earnConfig\.lockedTeasers\(props\.device\.vramTotal/);
    expect(source).toMatch(/phoneLockedDaily\s*=\s*computed\(\(\)\s*=>\s*phoneTeasers\.value\.reduce\(\(s,\s*it\)\s*=>\s*s\s*\+\s*it\.dailyPotentialUSD,\s*0\)\)/);
    expect(source).toMatch(/v-for="\(it, i\) in phoneTeasers"/);
    expect(source).toMatch(/−\$\{\{\s*phoneLockedDaily\s*\}\}/);
    expect(source).toMatch(/\{\{\s*it\.dailyPotentialUSD\s*\}\}/);
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
