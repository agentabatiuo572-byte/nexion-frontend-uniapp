type DialMotion = "idle" | "scan" | "finish-scan" | "enter";
type DialView = { cancelMotion?: () => void; scanStart?: number };
type Owner = { callMethod(name: string, motion: DialMotion): void };

const SWEEP_MS = 1600;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// An older WebView may lack the Web Animations API; the dial then falls back to the clock below.
const runningAnimation = (node: Element | null | undefined) =>
  node && typeof node.getAnimations === "function" ? node.getAnimations()[0] : undefined;

export const calibrationDialView = {
  beforeUnmount(this: DialView) { this.cancelMotion?.(); },
  methods: {
    update(this: DialView, motion: DialMotion, previous: DialMotion | undefined, owner: Owner) {
      if (motion === previous) return;
      this.cancelMotion?.();
      if (motion === "idle") return;
      if (motion === "scan") {
        this.scanStart = performance.now();
        return;
      }

      let frame = 0, timer = 0, cancelled = false;
      this.cancelMotion = () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
      const finish = () => { if (!cancelled) owner.callMethod("onDialMotionEnd", motion); };

      // The view has applied this page update (including the inline SVG) by its next frame.
      frame = requestAnimationFrame(() => {
        const dial = document.querySelector(".cn-score");
        if (motion === "finish-scan") {
          // Reduced motion has a static dial: hand the result over at once.
          if (reducedMotion()) { finish(); return; }
          const spin = runningAnimation(dial?.querySelector(".cn-sweep"));
          if (spin?.effect) {
            // Finish the CSS animation at its next full turn and hold it at the starting angle
            // while its completion crosses the App bridge. The keyframes and speed stay the same.
            const turn = Math.floor(Number(spin.currentTime) / SWEEP_MS) + 1;
            spin.effect.updateTiming({ iterations: turn, fill: "forwards" });
            void spin.finished.then(finish, finish);
          } else {
            const elapsed = performance.now() - (this.scanStart ?? performance.now());
            timer = window.setTimeout(finish, SWEEP_MS - elapsed % SWEEP_MS);
          }
          return;
        }

        const count = dial?.querySelector(".cn-score__v--count");
        const target = dial?.querySelector(".cn-score__v--final")?.textContent;
        if (!count || !target || reducedMotion()) { finish(); return; }
        const value = Number(target), places = target.split(".")[1]?.length ?? 0;
        const start = performance.now();
        const pulse = runningAnimation(dial?.querySelector(".cn-burst"));
        const draw = (now: number) => {
          const elapsed = now - start;
          const progress = Math.max(0, Math.min(1, (elapsed - 100) / 900));
          const text = progress === 1 ? target : (value * (1 - (1 - progress) ** 3)).toFixed(places);
          if (count.textContent !== text) count.textContent = text;
          if (elapsed >= 1400 && pulse?.playState !== "running") finish();
          else frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      });
    },
  },
};
