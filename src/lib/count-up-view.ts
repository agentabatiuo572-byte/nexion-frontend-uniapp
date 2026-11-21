import { formatAmount, formatGroupedAmount } from "./amount-display";
import { formatFinanceAmount } from "./finance-amount-display";
import { formatUsdOverviewParts } from "./usd-display";

/**
 * Entrance count played in the view layer (renderjs; same thread on H5). The logic layer renders
 * the final text and sends one config per change of the figure; this module writes the in-between
 * frames straight into the text nodes of the `.nx-count--<part>` elements inside the host, so the
 * logic layer does not re-render every frame. Formatting matches the logic templates part by part.
 */
export type CountUpKind = "grouped" | "finance" | "usd" | "plus";
export interface CountUpConfig { hostId: string; kind: CountUpKind; follow: boolean; value: number | null; count: boolean }

// Templates bind `:change:count-up="countUp.update"` to the renderjs module of that name.
declare module "vue" {
  interface ComponentCustomProperties { countUp: { update(value: CountUpConfig): void } }
}

const DURATION = 900;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function textParts(kind: CountUpKind, value: number): Record<string, string> {
  if (kind === "plus") return { int: `+${formatAmount(value)}` };
  if (kind === "usd") {
    const parts = formatUsdOverviewParts(value)!;
    return { prefix: parts.prefix, int: parts.integer, frac: `.${parts.fraction}` };
  }
  const [int, frac] = (kind === "finance" ? formatFinanceAmount(value) : formatGroupedAmount(value)).split(".");
  return { int, frac: `.${frac}` };
}

type Part = { written: string | null; official: string };
type Run = { config: CountUpConfig; start: number; base: number; baseEased: number; shown: number; frame: number; parts: WeakMap<Element, Part>; started: boolean; done: boolean };
const runs = new Map<string, Run>();
const owned = new WeakMap<object, Set<string>>();

// H5 wraps the text in a <span>; App's view layer sets it on <uni-text> itself. Either way the
// element's first text node is the one the framework writes, so it is looked up on every frame.
function textNode(el: Element): Text | null {
  return document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
}

/** `texts` null restores what the framework last wrote into each part. */
function write(run: Run, texts: Record<string, string> | null) {
  const host = document.getElementById(run.config.hostId);
  for (const el of Array.from(host?.querySelectorAll('[class*="nx-count--"]') ?? [])) {
    const node = textNode(el);
    if (!node) continue;
    let part = run.parts.get(el);
    if (!part) run.parts.set(el, part = { written: null, official: node.nodeValue ?? "" });
    // Anything the framework wrote since our last frame is the current official text.
    else if (node.nodeValue !== part.written) part.official = node.nodeValue ?? "";
    const key = /nx-count--(\w+)/.exec(el.getAttribute("class") ?? "")?.[1] ?? "";
    const next = texts?.[key] ?? part.official;
    if (node.nodeValue !== next) node.nodeValue = next;
    part.written = texts ? next : null;
  }
}

function stop(run: Run, texts: Record<string, string> | null) {
  if (run.frame) cancelAnimationFrame(run.frame);
  run.frame = 0;
  run.done = true;
  write(run, texts);
}

// One clock for the start, mid-count retargets and frames: a frame's rAF timestamp can precede them.
const progress = (run: Run) => Math.min(1, Math.max(0, (performance.now() - run.start) / DURATION));

function shownAt(run: Run, t: number) {
  const value = run.config.value!;
  if (run.config.follow) return value * ease(t);
  const span = 1 - run.baseEased;
  return span > 0 ? run.base + (value - run.base) * (ease(t) - run.baseEased) / span : value;
}

function step(hostId: string) {
  const run = runs.get(hostId);
  if (!run || run.done) return;
  const t = progress(run);
  const value = run.config.value!;
  if (t >= 1) { stop(run, textParts(run.config.kind, value)); return; }
  write(run, textParts(run.config.kind, run.shown = shownAt(run, t)));
  run.frame = requestAnimationFrame(() => step(hostId));
}

function reducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const countUpView = {
  beforeUnmount(this: object) {
    for (const hostId of owned.get(this) ?? []) {
      const run = runs.get(hostId);
      if (run?.frame) cancelAnimationFrame(run.frame);
      runs.delete(hostId);
    }
    owned.delete(this);
  },
  methods: {
    update(this: object, config: CountUpConfig) {
      if (!config) return;
      let hosts = owned.get(this);
      if (!hosts) owned.set(this, hosts = new Set());
      hosts.add(config.hostId);
      let run = runs.get(config.hostId);
      if (!run) runs.set(config.hostId, run = { config, start: 0, base: 0, baseEased: 0, shown: 0, frame: 0, parts: new WeakMap(), started: false, done: false });
      if (!run.started) {
        // A mount counts at most once, decided by its first figure: unknown ("—") waits for one.
        run.config = config;
        if (config.value === null) return;
        run.started = true;
        if (!config.count || reducedMotion()) { run.done = true; return; }
        run.start = performance.now();
        write(run, textParts(config.kind, 0)); // the first painted frame already shows 0
        run.frame = requestAnimationFrame(() => step(config.hostId));
        return;
      }
      if (run.done) { run.config = config; return; }
      if (!config.count || config.value === null) { run.config = config; stop(run, null); return; }
      if (config.value !== run.config.value && !config.follow) {
        // A new target mid-count (a snapshot replaced by the live read): converge from what is shown.
        run.base = run.shown;
        run.baseEased = ease(progress(run));
      }
      run.config = config;
      // Cover the final text this patch just wrote with the current frame.
      write(run, textParts(config.kind, run.shown = shownAt(run, progress(run))));
    },
  },
};
