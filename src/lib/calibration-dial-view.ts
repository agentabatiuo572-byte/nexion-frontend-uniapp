export type DialMotion = {
  kind: "idle" | "scan" | "scan-result" | "scan-stop" | "handoff" | "read";
  host: string;
  run: number;
  target?: string;
  at?: number;
  readyAfter?: number;
};
export type DialMotionReceipt = { run: number; kind: "scan" | "ready" | "done"; at?: number };
type DialView = { cancelMotion?: () => void; scanStart?: { frame: number; wall: number } };
type Owner = { callMethod(name: string, receipt: DialMotionReceipt): void };

const TURN_MS = 3000;
const MIN_COUNT_MS = 1500;
const TICK_LEAD_MS = 120;
const BACKFILL_MS = 4;
const SCAN_FADE_MS = 160;
const SCAN_BUTTON_MS = 450;
const SCAN_SETTLE_MS = 500;
const READ_SETTLE_MS = 1400;
const clamp = (fraction: number) => Math.max(0, Math.min(1, fraction));
const nextTurn = (elapsed: number) => (Math.floor(elapsed / TURN_MS) + 1) * TURN_MS;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const calibrationDialView = {
  beforeUnmount(this: DialView) { this.cancelMotion?.(); },
  methods: {
    update(this: DialView, motion: DialMotion, previous: DialMotion | undefined, owner: Owner) {
      if (previous?.kind === motion.kind && previous.run === motion.run && previous.target === motion.target
        && previous.readyAfter === motion.readyAfter) return;
      this.cancelMotion?.();
      if (motion.kind === "idle") return;

      const receive = (kind: DialMotionReceipt["kind"], at?: number) =>
        owner.callMethod("onDialMotionEnd", { run: motion.run, kind, at });
      const reduce = reducedMotion();
      if (reduce) {
        if (motion.kind === "scan-result" || motion.kind === "scan-stop") receive("scan");
        if (motion.kind === "read" || motion.kind === "handoff") receive("done");
        return;
      }

      const started = performance.now();
      if (motion.kind === "scan") this.scanStart = { frame: started, wall: Date.now() };
      const { frame: scanStart, wall: scanWallStart } = this.scanStart ?? { frame: started, wall: Date.now() };
      const resultAt = started - scanStart;
      const finishTurn = nextTurn(resultAt);
      const target = motion.target ?? "";
      const places = target.split(".")[1]?.length ?? 0;
      const value = Number(target);
      const countEnd = finishTurn - resultAt < MIN_COUNT_MS ? finishTurn + TURN_MS : finishTurn;
      const getDial = () => document.getElementById(motion.host)?.querySelector<HTMLElement>(".cn-score");
      let text: Node | null = null;
      let frame = 0;
      this.cancelMotion = () => cancelAnimationFrame(frame);
      const drawNumber = (progress: number) => {
        if (!text?.isConnected) {
          const digits = getDial()?.querySelector(".cn-score__v--count");
          text = digits ? document.createTreeWalker(digits, NodeFilter.SHOW_TEXT).nextNode() : null;
        }
        if (!text) return;
        const next = progress === 1 ? target : (value * progress).toFixed(places);
        if (text.nodeValue !== next) text.nodeValue = next;
      };

      if (motion.kind === "read" || motion.kind === "handoff") {
        const read = motion.kind === "read";
        const age = read ? 0 : Math.max(0, Date.now() - (motion.at ?? Date.now()));
        const readyAfter = read ? motion.readyAfter ?? 1000 : SCAN_BUTTON_MS;
        const settleAfter = read ? READ_SETTLE_MS : SCAN_SETTLE_MS;
        let ready = false;
        const draw = (now: number) => {
          const elapsed = now - started + age;
          if (read) drawNumber(1 - (1 - clamp((elapsed - 100) / 900)) ** 3);
          if (!ready && elapsed >= readyAfter) {
            ready = true;
            receive("ready");
          }
          if (elapsed >= settleAfter) receive("done");
          else frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return;
      }

      const count = motion.kind === "scan-result";
      const stop = motion.kind === "scan-stop";
      let face: Element | null = null;
      let ticks: SVGElement[] = [];
      let inkTicks: SVGElement[] = [];
      let lightAt: number[] = [];
      let reported = false;
      const draw = (now: number) => {
        const dial = getDial();
        if (!dial) return; // The logic layer releases an unresolved bridge wait.
        const svg = dial.querySelector(".cn-score__svg svg");
        if (svg !== face) {
          // App's SVG wrapper can replace its inner markup when the dial is measured.
          face = svg;
          ticks = Array.from(face?.querySelectorAll<SVGElement>(".cn-ticks line") ?? []);
          inkTicks = Array.from(face?.querySelectorAll<SVGElement>(".cn-ticks-base line") ?? []);
          lightAt = ticks.map((_, index) => {
            const lead = countEnd - TURN_MS + index * TURN_MS / ticks.length - TICK_LEAD_MS;
            return lead < resultAt ? resultAt + index * BACKFILL_MS : lead;
          });
          if (!count) {
            dial.style.removeProperty("--cn-detecting-opacity");
            dial.style.removeProperty("--cn-number-opacity");
            dial.style.removeProperty("--cn-glow-opacity");
            ticks.forEach(tick => { tick.style.opacity = ""; });
            inkTicks.forEach(tick => { tick.style.opacity = ""; });
          }
        }
        const elapsed = Math.max(0, now - scanStart);
        const end = count ? countEnd : stop ? finishTurn : Infinity;
        const tail = Math.max(0, elapsed - end);
        const angle = elapsed >= end ? 0 : (elapsed % TURN_MS) * 360 / TURN_MS;
        dial.style.setProperty("--cn-sweep-at", angle + "deg");
        dial.style.setProperty("--cn-sweep-opacity", String(1 - clamp(tail / SCAN_FADE_MS)));
        if (count) {
          const sinceResult = elapsed - resultAt;
          const progress = clamp(sinceResult / (countEnd - resultAt));
          drawNumber(progress);
          dial.style.setProperty("--cn-detecting-opacity", String(1 - clamp(sinceResult / 120)));
          dial.style.setProperty("--cn-number-opacity", String(clamp((sinceResult - 80) / 250)));
          dial.style.setProperty("--cn-glow-opacity", String(progress));
          ticks.forEach((tick, index) => {
            const lit = elapsed >= countEnd ? 1 : clamp((elapsed - lightAt[index]) / TICK_LEAD_MS);
            tick.style.opacity = String(lit);
            inkTicks[index].style.opacity = String(1 - lit);
          });
          if (elapsed >= countEnd && !reported) {
            reported = true;
            receive("scan", scanWallStart + countEnd);
          }
        }
        if (stop && elapsed >= finishTurn + SCAN_FADE_MS) {
          receive("scan");
          return;
        }
        if (elapsed < end + SCAN_FADE_MS) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    },
  },
};
