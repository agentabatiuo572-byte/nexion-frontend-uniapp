<!--
  ReceiptModal — ported from
  Nexion-prototype/app/components/receipt/receipt-modal.tsx.
  Bottom-anchored detail sheet for a Proof-of-Compute (or KYC) receipt. Scrim +
  slide-up card (nx-step-in, tokens.css). Sections rendered generically from a
  computed `sections` descriptor (the source's Row/RowCopy/Section/DetailsRows
  components collapse into {k, v, accent, muted, strong, copyValue, hint} rows).
  framer AnimatePresence → v-if + CSS. ESC handler dropped (mobile).
  Tap-to-copy on hash/signature/wallet rows (uni.setClipboardData + toast +
  transient ✓ icon, mirrors prototype RowCopy) and the footer Explorer/Share
  CTAs are wired. Explorer/Share copy the tx_hash reference to the clipboard
  (no real explorer/share backend in the mock — backend-replaceable). Driven by
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
        <text class="block" :style="headerKickerStyle">{{ isKyc ? "钱包归属验证" : "算力证明" }}</text>
        <view class="flex items-center" style="margin-top: 6px; gap: 8px">
          <text class="inline-flex items-center" :style="stampStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="stampColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <text style="margin-left: 4px">{{ isKyc ? "KYC 已验证" : "已验证" }}</text>
          </text>
          <text style="font-size: 11px; color: var(--v5-ink-3)">{{ isKyc ? "已配对" : "已结算" }} · {{ fmtDate(receipt.settledAt) }}</text>
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
            <text v-if="row.hint" style="color: var(--v5-ink-4); font-size: 11px">({{ row.hint }})</text>
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
            <text style="font-size: 11.5px; color: color-mix(in srgb, var(--v5-ink) 85%, transparent)">{{ chk }}</text>
            <text style="margin-left: auto; font-size: 11px; color: color-mix(in srgb, var(--v5-tech-cyan) 70%, transparent)">已通过</text>
          </view>
        </view>
      </view>

      <!-- Footer CTAs (mirror prototype: View on Explorer / Share) -->
      <view :style="ctaRowStyle">
        <view class="flex items-center justify-center active:scale-95" :style="ctaBtnStyle" @click="onExplorer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          <text :style="ctaLabelStyle">{{ t.receipt.viewOnExplorer }}</text>
        </view>
        <view class="flex items-center justify-center active:scale-95" :style="ctaBtnStyle" @click="onShare">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98" /><path d="m15.41 6.51-6.82 3.98" /></svg>
          <text :style="ctaLabelStyle">{{ t.receipt.share }}</text>
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

// ── footer CTAs (mirror prototype onExplorer / onShare) ──
// No real explorer/share backend in the mock — copy the reference to the
// clipboard so the action has a tangible result on both App + H5.
function onExplorer(): void {
  const r = props.receipt;
  if (!r) return;
  void writeClipboard(r.txHash).then((ok) => {
    if (ok) toast.success(t.value.receipt.explorerHint);
  });
}
function onShare(): void {
  const r = props.receipt;
  if (!r) return;
  void writeClipboard(r.txHash).then((ok) => {
    if (ok) toast.success(t.value.receipt.shareHint);
  });
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
        { k: "分辨率", v: d.resolution },
        { k: "批量大小", v: String(d.batchSize) },
        { k: "输出", v: `${d.outputCount} 张图片` },
      ];
    case "VG":
      return [
        { k: "分辨率", v: d.resolution },
        { k: "片段时长", v: `${d.durationSec}秒` },
        { k: "帧率", v: String(d.fps) },
        { k: "帧数", v: String(d.frames) },
      ];
    case "LL":
      return [
        { k: "模型规模", v: d.modelSize },
        { k: "输入 token", v: d.inputTokens.toLocaleString() },
        { k: "输出 token", v: d.outputTokens.toLocaleString() },
        { k: "延迟", v: `p50 ${d.latencyP50ms}ms · p95 ${d.latencyP95ms}ms` },
      ];
    case "FT":
      return [
        { k: "训练步数", v: String(d.trainingSteps) },
        { k: "最终损失", v: d.finalLoss.toFixed(3) },
      ];
    case "EM":
      return [
        { k: "分块数", v: d.chunksCount.toLocaleString() },
        { k: "总 token", v: d.totalTokens.toLocaleString() },
        { k: "嵌入维度", v: String(d.embeddingDim) },
      ];
    case "SP":
      return [
        { k: "音频时长", v: `${(d.audioDurationSec / 60).toFixed(1)} 分钟` },
        { k: "词错误率", v: d.wer.toFixed(3) },
        { k: "识别语言", v: d.languageDetected },
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
          { k: "合规编号", v: r.id, accent: true },
          { k: "类型", v: r.type },
          { k: "项目", v: r.model },
          { k: "机构", v: r.client },
        ],
      },
      {
        rows: [
          { k: "已配对钱包", copyKey: "paired_wallet", copyValue: r.kycWalletAddress ?? "0x", v: shortenHex(r.kycWalletAddress ?? "0x", 6, 4) },
          { k: "网络", v: r.kycNetwork ?? "—" },
          { k: "签名", copyKey: "kyc_signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
        ],
      },
      {
        heading: "合规框架",
        rows: [],
        checks: r.kycChecks ?? [],
      },
      {
        rows: [
          { k: "验证金", v: `${r.gross.toFixed(2)} USDT` },
          { k: "用途", v: "钱包归属证明", muted: true },
          { k: "已入账", v: `+$${r.netPaid.toFixed(2)}`, accent: true, strong: true },
        ],
      },
      {
        rows: [
          { k: "交易哈希", copyKey: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
          { k: "区块", v: `#${r.blockNumber.toLocaleString()}` },
          { k: "验证时间", v: fmtDate(r.settledAt) },
        ],
      },
    ];
  }
  // Task receipt
  return [
    {
      rows: [
        { k: "任务编号", v: r.id, accent: true },
        { k: "类型", v: r.type },
        { k: "模型", v: r.model },
        ...(r.details ? detailRows(r.details) : []),
      ],
    },
    {
      rows: [
        { k: "客户", v: r.client },
        { k: "客户地址", copyKey: "client_addr", copyValue: r.clientAddress, v: shortenHex(r.clientAddress, 6, 4) },
        { k: "签名", copyKey: "signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
      ],
    },
    {
      rows: [
        { k: "设备", v: r.deviceName },
        { k: "GPU", v: r.deviceGpu },
        { k: "GPU 指纹", v: r.deviceFingerprint },
      ],
    },
    {
      rows: [
        { k: "时长", v: fmtDuration(r.durationSec) },
        ...(r.vramTotalGb > 0 ? [{ k: "显存峰值", v: `${r.vramPeakGb.toFixed(1)} / ${r.vramTotalGb} GB` }] : []),
        { k: "能耗", v: `${r.energyKwh.toFixed(3)} kWh` },
      ],
    },
    {
      rows: [
        { k: "单价", v: r.unitPriceLabel },
        { k: "单位", v: r.unitsLabel },
        { k: "总额", v: `$${r.gross.toFixed(4)}` },
        { k: "网络费", v: `-$${r.fee.toFixed(4)}`, muted: true },
        { k: "实付", v: `+$${r.netPaid.toFixed(4)} USDT`, accent: true, strong: true },
      ],
    },
    {
      rows: [
        { k: "交易哈希", copyKey: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
        { k: "区块", v: `#${r.blockNumber.toLocaleString()}` },
      ],
    },
  ];
});

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分 ${s.toString().padStart(2, "0")}秒(共 ${sec} 秒)`;
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
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--v5-ink-4)",
};
const stampStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  // Prototype: px-1.5 py-0.5 = 2px 6px, rounded-md = 6px, rotate(-4deg).
  padding: "2px 6px",
  borderRadius: "6px",
  fontSize: "11px",
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
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-tech-cyan)",
};
// Prototype Section uses `space-y-1` = 4px gap between rows. `padding: 2px 0`
// on every row yields the same 4px inter-row spacing.
const rowStyle: CSSProperties = { gap: "12px", fontSize: "11.5px", padding: "2px 0" };
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
// Prototype CTA wrap: `px-5 pb-5 pt-2 grid grid-cols-2 gap-2`.
const ctaRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
  padding: "8px 20px 20px",
};
// Prototype CTA button: `h-10 rounded-lg bg-[var(--v5-surface)] border
// border-[var(--v5-surface-2)] text-[12px] flex items-center justify-center
// gap-1.5`. Height bumped 40→44px to clear the mobile 44pt tap-target rule.
const ctaBtnStyle: CSSProperties = {
  height: "44px",
  borderRadius: "8px",
  background: "var(--v5-surface-bg)",
  border: "1px solid var(--v5-surface-2)",
  gap: "6px",
};
const ctaLabelStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink)" };
</script>
