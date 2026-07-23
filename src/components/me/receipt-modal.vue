<!--
  ReceiptModal — ported from
  Nexion-prototype/app/components/receipt/receipt-modal.tsx.
  Bottom-anchored detail sheet for a Proof-of-Compute (or KYC) receipt. Scrim +
  slide-up card (nx-step-in, tokens.css). Sections rendered generically from a
  computed `sections` descriptor (the source's Row/RowCopy/Section/DetailsRows
  components collapse into {k, v, accent, muted, strong, copyValue, hint} rows).
  framer AnimatePresence → v-if + CSS. ESC handler dropped (mobile).
  Tap-to-copy on hash/signature/wallet rows (uni.setClipboardData + toast +
  transient ✓ icon, mirrors prototype RowCopy). Driven by
  :receipt prop (null = hidden) + @close emit (P-032: page-mounted sheet,
  prop/emit — no chassis-level overlay host).
-->
<template>
  <view v-if="receipt" class="nx-receipt-scrim" :style="scrimStyle" @click="emit('close')">
    <view class="nx-step-in" :style="sheetStyle" @click.stop>
      <!-- Close -->
      <view class="grid place-items-center active:opacity-60" :style="closeBtnStyle" @click="emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </view>

      <!-- Header -->
      <view :style="headerStyle">
        <text class="block" :style="headerKickerStyle">{{ isKyc ? "Wallet Ownership Verification" : "Proof of Compute" }}</text>
        <view class="flex items-center" style="margin-top: 6px; gap: 8px">
          <text class="inline-flex items-center" :style="stampStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="stampColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <text style="margin-left: 4px">{{ isKyc ? "KYC VERIFIED" : "VERIFIED" }}</text>
          </text>
          <text style="font-size: 12px; color: var(--v5-ink-3)">{{ isKyc ? "Paired" : "Settled" }} · {{ fmtDate(receipt.settledAt) }}</text>
        </view>
      </view>

      <!-- Generic sections -->
      <view v-for="(sec, si) in sections" :key="si" :style="sectionStyle(si)">
        <text v-if="sec.heading" class="block" :style="sectionHeadStyle">{{ sec.heading }}</text>
        <view
          v-for="(row, ri) in sec.rows"
          :key="ri"
          class="flex items-baseline justify-between"
          :style="rowStyle"
        >
          <text class="shrink-0" style="color: var(--v5-ink-4)">{{ row.k }}</text>
          <view v-if="row.divider" :style="dividerStyle" />
          <view
            v-else-if="row.copyValue"
            class="flex items-center active:opacity-60"
            :style="copyRowStyle"
            @click="copyRow(row.copyKey ?? row.k, row.copyValue ?? '')"
          >
            <text class="truncate" style="color: var(--v5-brand)">{{ row.v }}</text>
            <text v-if="row.hint" style="color: var(--v5-ink-4); font-size: 12px">({{ row.hint }})</text>
            <!-- Check when just-copied, else Copy affordance (mirrors prototype RowCopy) -->
            <svg v-if="copiedField === (row.copyKey ?? row.k)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M20 6 9 17l-5-5" /></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          </view>
          <text v-else class="text-right truncate" :style="valueStyle(row)">{{ row.v }}</text>
        </view>
        <!-- KYC compliance checklist -->
        <view v-if="sec.checks" style="margin-top: 4px">
          <view v-for="chk in sec.checks" :key="chk" class="flex items-center" style="gap: 8px; padding: 2px 0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M20 6 9 17l-5-5" /></svg>
            <text style="font-size: 12px; color: color-mix(in srgb, var(--v5-ink) 85%, transparent)">{{ chk }}</text>
            <text style="margin-left: auto; font-size: 12px; color: color-mix(in srgb, var(--v5-tech-cyan) 70%, transparent)">passed</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, type CSSProperties } from "vue";
import type { Receipt, ReceiptDetails } from "@/mock/receipt";
import { shortenHex } from "@/mock/receipt";
import { useT } from "@/i18n/use-t";
import { toast } from "@/store/ui";

const props = defineProps<{ receipt: Receipt | null }>();
const emit = defineEmits<{ (e: "close"): void }>();

const t = useT();
const isKyc = computed(() => props.receipt?.category === "KY");
const stampColor = computed(() => (isKyc.value ? "var(--v5-tech-cyan)" : "var(--v5-brand)"));

// ── tap-to-copy (matches prototype RowCopy: copy on tap, transient ✓ icon) ──
// Backend-replaceable: copies the full underlying value; no real backend call.
const copiedField = ref<string | null>(null);
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the uni clipboard API below.
  }
  return new Promise((resolve) => {
    try {
      uni.setClipboardData({
        data: text,
        showToast: false,
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    } catch {
      resolve(false);
    }
  });
}

async function copyRow(field: string, value: string): Promise<void> {
  const ok = await writeClipboard(value);
  if (!ok) return;
  copiedField.value = field;
  toast.success(t.value.receipt.copied);
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    copiedField.value = null;
    copyResetTimer = null;
  }, 1400);
}

onUnmounted(() => {
  if (copyResetTimer) clearTimeout(copyResetTimer);
});

interface DescRow {
  k: string;
  v?: string;
  accent?: boolean;
  muted?: boolean;
  strong?: boolean;
  copyValue?: string;
  copyKey?: string;
  hint?: string;
  divider?: boolean;
}
interface DescSection {
  heading?: string;
  rows: DescRow[];
  checks?: string[];
}

function detailRows(d: ReceiptDetails): DescRow[] {
  switch (d.kind) {
    case "IG":
      return [
        { k: "resolution", v: d.resolution },
        { k: "batch_size", v: String(d.batchSize) },
        { k: "output", v: `${d.outputCount} images` },
      ];
    case "VG":
      return [
        { k: "resolution", v: d.resolution },
        { k: "clip_duration", v: `${d.durationSec}s` },
        { k: "fps", v: String(d.fps) },
        { k: "frames", v: String(d.frames) },
      ];
    case "LL":
      return [
        { k: "model_size", v: d.modelSize },
        { k: "input_tokens", v: d.inputTokens.toLocaleString() },
        { k: "output_tokens", v: d.outputTokens.toLocaleString() },
        { k: "latency", v: `p50 ${d.latencyP50ms}ms · p95 ${d.latencyP95ms}ms` },
      ];
    case "FT":
      return [
        { k: "training_steps", v: String(d.trainingSteps) },
        { k: "final_loss", v: d.finalLoss.toFixed(3) },
      ];
    case "EM":
      return [
        { k: "chunks", v: d.chunksCount.toLocaleString() },
        { k: "total_tokens", v: d.totalTokens.toLocaleString() },
        { k: "embedding_dim", v: String(d.embeddingDim) },
      ];
    case "SP":
      return [
        { k: "audio_duration", v: `${(d.audioDurationSec / 60).toFixed(1)} min` },
        { k: "wer", v: d.wer.toFixed(3) },
        { k: "language", v: d.languageDetected },
      ];
  }
}

const sections = computed<DescSection[]>(() => {
  const r = props.receipt;
  if (!r) return [];
  if (r.category === "KY") {
    return [
      {
        rows: [
          { k: "compliance_id", v: r.id, accent: true },
          { k: "type", v: r.type },
          { k: "program", v: r.model },
          { k: "authority", v: r.client },
        ],
      },
      {
        rows: [
          { k: "paired_wallet", copyKey: "paired_wallet", copyValue: r.kycWalletAddress ?? "0x", v: shortenHex(r.kycWalletAddress ?? "0x", 6, 4) },
          { k: "network", v: r.kycNetwork ?? "—" },
          { k: "signature", copyKey: "kyc_signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
        ],
      },
      {
        heading: "Compliance frameworks",
        rows: [],
        checks: r.kycChecks ?? [],
      },
      {
        rows: [
          { k: "deposit", v: `${r.gross.toFixed(2)} USDT` },
          { k: "purpose", v: "Wallet ownership proof", muted: true },
          { k: "credited", v: `+$${r.netPaid.toFixed(2)}`, accent: true, strong: true },
        ],
      },
      {
        rows: [
          { k: "tx_hash", copyKey: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
          { k: "block", v: `#${r.blockNumber.toLocaleString()}` },
          { k: "verified_at", v: fmtDate(r.settledAt) },
        ],
      },
    ];
  }
  // Task receipt
  return [
    {
      rows: [
        { k: "job_id", v: r.id, accent: true },
        { k: "type", v: r.type },
        { k: "model", v: r.model },
        ...(r.details ? detailRows(r.details) : []),
      ],
    },
    {
      rows: [
        { k: "client", v: r.client },
        { k: "client_addr", copyKey: "client_addr", copyValue: r.clientAddress, v: shortenHex(r.clientAddress, 6, 4) },
        { k: "signature", copyKey: "signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
      ],
    },
    {
      rows: [
        { k: "device", v: r.deviceName },
        { k: "gpu", v: r.deviceGpu },
        { k: "gpu_fingerprint", v: r.deviceFingerprint },
      ],
    },
    {
      rows: [
        { k: "duration", v: fmtDuration(r.durationSec) },
        ...(r.vramTotalGb > 0 ? [{ k: "vram_peak", v: `${r.vramPeakGb.toFixed(1)} / ${r.vramTotalGb} GB` }] : []),
        { k: "energy", v: `${r.energyKwh.toFixed(3)} kWh` },
      ],
    },
    {
      rows: [
        { k: "unit_price", v: r.unitPriceLabel },
        { k: "units", v: r.unitsLabel },
        { k: "gross", v: `$${r.gross.toFixed(4)}` },
        { k: "network_fee", v: `-$${r.fee.toFixed(4)}`, muted: true },
        { k: "net_paid", v: `+$${r.netPaid.toFixed(4)} USDT`, accent: true, strong: true },
      ],
    },
    {
      rows: [
        { k: "tx_hash", copyKey: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
        { k: "block", v: `#${r.blockNumber.toLocaleString()}` },
      ],
    },
  ];
});

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s (${sec} sec)`;
}
function fmtDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── styles ──
const scrimStyle: CSSProperties = {
  position: "fixed",
  left: "0",
  right: "0",
  top: "0",
  bottom: "0",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  background: "rgba(0,0,0,0.7)",
};
const sheetStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxHeight: "85%",
  overflowY: "auto",
  paddingBottom: "10px",
  background: "var(--v5-on-brand)",
  border: "1px solid var(--v5-surface-2)",
  borderRadius: "16px",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
};
const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: "12px",
  right: "12px",
  width: "32px",
  height: "32px",
  borderRadius: "999px",
  zIndex: 10,
};
const headerStyle: CSSProperties = {
  padding: "20px 20px 12px",
  borderBottom: "1px solid color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
};
const headerKickerStyle: CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--v5-ink-4)",
};
const stampStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  // Prototype: px-1.5 py-0.5 = 2px 6px, rounded-md = 6px, rotate(-4deg).
  padding: "2px 6px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: stampColor.value,
  background: `color-mix(in srgb, ${stampColor.value} 8%, transparent)`,
  transform: "rotate(-4deg)",
}));
function sectionStyle(si: number): CSSProperties {
  return {
    padding: "10px 20px",
    borderTop: si === 0 ? "none" : "1px solid color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
  };
}
const sectionHeadStyle: CSSProperties = {
  marginBottom: "6px",
  fontSize: "12px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-tech-cyan)",
};
// Prototype Section uses `space-y-1` = 4px gap between rows. `padding: 2px 0`
// on every row yields the same 4px inter-row spacing.
const rowStyle: CSSProperties = { gap: "12px", fontSize: "12px", padding: "2px 0" };
const dividerStyle: CSSProperties = {
  flex: "1",
  height: "1px",
  margin: "6px 0",
  background: "color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
};
function valueStyle(row: DescRow): CSSProperties {
  // Prototype default value = text-white/95 on a dark (`--v5-on-brand`) sheet.
  // Use theme-safe `var(--v5-ink) 95%` (resolves to near-white on dark, stays
  // legible if the light theme is ever applied) — also matches the KYC checks'
  // theme-aware `var(--v5-ink) 85%` instead of a hardcoded literal white.
  return {
    color: row.accent ? "var(--v5-brand)" : row.muted ? "var(--v5-ink-3)" : "color-mix(in srgb, var(--v5-ink) 95%, transparent)",
    fontWeight: row.strong ? 600 : 400,
  };
}
// Prototype RowCopy: `flex items-center gap-1` (4px) — value + hint + copy icon.
const copyRowStyle: CSSProperties = { gap: "4px" };
</script>
