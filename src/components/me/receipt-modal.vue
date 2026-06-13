<!--
  ReceiptModal — ported from
  Nexion-prototype/app/components/receipt/receipt-modal.tsx.
  Bottom-anchored detail sheet for a Proof-of-Compute (or KYC) receipt. Scrim +
  slide-up card (nx-step-in, tokens.css). Sections rendered generically from a
  computed `sections` descriptor (the source's Row/RowCopy/Section/DetailsRows
  components collapse into {k, v, accent, muted, strong, copyValue, hint} rows).
  Copy rows use uni.setClipboardData (P-028). framer AnimatePresence → v-if +
  CSS. ESC handler dropped (mobile). Explorer/Share buttons toast a hint.
  Driven by :receipt prop (null = hidden) + @close emit (P-032: page-mounted
  sheet, prop/emit — no chassis-level overlay host).
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
          <text style="font-size: 11px; color: var(--v5-ink-3)">{{ isKyc ? "Paired" : "Settled" }} · {{ fmtDate(receipt.settledAt) }}</text>
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
          <view v-else-if="row.copyValue" class="flex items-center active:opacity-70" style="gap: 4px" @click="copy(row.copyValue)">
            <text class="truncate" style="color: var(--v5-brand)">{{ row.v }}</text>
            <text v-if="row.hint" style="color: var(--v5-ink-4); font-size: 10px">({{ row.hint }})</text>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          </view>
          <text v-else class="text-right truncate" :style="valueStyle(row)">{{ row.v }}</text>
        </view>
        <!-- KYC compliance checklist -->
        <view v-if="sec.checks" style="margin-top: 4px">
          <view v-for="chk in sec.checks" :key="chk" class="flex items-center" style="gap: 8px; padding: 2px 0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M20 6 9 17l-5-5" /></svg>
            <text style="font-size: 11.5px; color: color-mix(in srgb, var(--v5-ink) 85%, transparent)">{{ chk }}</text>
            <text style="margin-left: auto; font-size: 10px; color: color-mix(in srgb, var(--v5-tech-cyan) 70%, transparent)">passed</text>
          </view>
        </view>
      </view>

      <!-- CTAs -->
      <view class="grid grid-cols-2" :style="ctaWrapStyle">
        <view class="grid place-items-center active:opacity-80" :style="ctaBtnStyle" @click="onExplorer">
          <view class="inline-flex items-center" style="gap: 6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            <text :style="ctaTextStyle">{{ t.receipt.viewOnExplorer }}</text>
          </view>
        </view>
        <view class="grid place-items-center active:opacity-80" :style="ctaBtnStyle" @click="onShare">
          <view class="inline-flex items-center" style="gap: 6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
            <text :style="ctaTextStyle">{{ t.receipt.share }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { toast } from "@/store/ui";
import type { Receipt, ReceiptDetails } from "@/mock/receipt";
import { shortenHex } from "@/mock/receipt";

const props = defineProps<{ receipt: Receipt | null }>();
const emit = defineEmits<{ (e: "close"): void }>();

const t = useT();

const isKyc = computed(() => props.receipt?.category === "KY");
const stampColor = computed(() => (isKyc.value ? "var(--v5-tech-cyan)" : "var(--v5-brand)"));

interface DescRow {
  k: string;
  v?: string;
  accent?: boolean;
  muted?: boolean;
  strong?: boolean;
  copyValue?: string;
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
          { k: "paired_wallet", copyValue: r.kycWalletAddress ?? "0x", v: shortenHex(r.kycWalletAddress ?? "0x", 6, 4) },
          { k: "network", v: r.kycNetwork ?? "—" },
          { k: "signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
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
          { k: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
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
        { k: "client_addr", copyValue: r.clientAddress, v: shortenHex(r.clientAddress, 6, 4) },
        { k: "signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
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
        { k: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
        { k: "block", v: `#${r.blockNumber.toLocaleString()}` },
      ],
    },
  ];
});

function copy(value: string) {
  uni.setClipboardData({ data: value, showToast: false, fail: () => {} });
  toast.success("Copied", value.substring(0, 18) + "…");
}
function onExplorer() {
  toast.info("Explorer link opens in new tab");
}
function onShare() {
  toast.success("Share link copied to clipboard");
}

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
  fontSize: "10.5px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--v5-ink-4)",
};
const stampStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  padding: "1px 6px",
  borderRadius: "6px",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: stampColor.value,
  border: `1px solid color-mix(in srgb, ${stampColor.value} 45%, transparent)`,
  background: `color-mix(in srgb, ${stampColor.value} 8%, transparent)`,
}));
function sectionStyle(si: number): CSSProperties {
  return {
    padding: "10px 20px",
    borderTop: si === 0 ? "none" : "1px solid color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
  };
}
const sectionHeadStyle: CSSProperties = {
  marginBottom: "6px",
  fontSize: "10.5px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-tech-cyan)",
};
const rowStyle: CSSProperties = { gap: "12px", fontSize: "11.5px", padding: "1px 0" };
const dividerStyle: CSSProperties = {
  flex: "1",
  height: "1px",
  margin: "6px 0",
  background: "color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
};
function valueStyle(row: DescRow): CSSProperties {
  return {
    color: row.accent ? "var(--v5-brand)" : row.muted ? "var(--v5-ink-3)" : "color-mix(in srgb, white 95%, transparent)",
    fontWeight: row.strong ? 600 : 400,
  };
}
const ctaWrapStyle: CSSProperties = { padding: "8px 20px 20px", gap: "8px" };
const ctaBtnStyle: CSSProperties = {
  height: "40px",
  borderRadius: "8px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-surface-2)",
};
const ctaTextStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-2)" };
</script>
