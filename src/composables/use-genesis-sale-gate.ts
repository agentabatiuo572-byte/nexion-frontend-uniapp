import { ref, computed, onMounted, onUnmounted, type ComputedRef } from "vue";
import {
  useGenesisConfig,
  isPreSale,
  genesisPurchaseBlock,
  genesisShowsUrgency,
  type GenesisPurchaseBlock,
} from "@/store/genesis-config";
import { useGenesis } from "@/store/genesis";

/**
 * useGenesisSaleGate — 创世购买可用性的**唯一消费入口**(规格 FEAT-GEN09 + FEAT-GEN10)。
 *
 * 判定本体是纯函数 `genesisPurchaseBlock`(store/genesis-config.ts),本 composable
 * 只负责把响应式输入喂给它 + 提供秒级 tick 让倒计时与到点解锁实时生效。
 *
 * 🔴 **页面不许自己再判一次**。改造前「能不能买」在创世页的按钮文案与点击处理里
 * 各写了一套 if 链,顺序一致纯属巧合;任一处加条件而另一处忘改,就会出现
 * 「按钮写着可买、点了没反应」或「按钮灰着却能点进结算」。机器门:
 * `scripts/selfcheck-genesis-gate.mjs`。
 *
 * MOCK-ONLY:marketStatus / saleStartAt / showCountdown 均 server-canonical(admin G4)。
 */
export interface UseGenesisSaleGateResult {
  /** 最高优先级的阻断原因;`null` = 可购买。页面据此出文案与行为,不再自判。 */
  block: ComputedRef<GenesisPurchaseBlock>;
  /** 市场关闭态(= block === "marketClosed"),给需要单独渲染关闭说明的地方用。 */
  marketClosed: ComputedRef<boolean>;
  /** 是否允许展示紧迫感元素(倒计时 / 剩余名额)。关闭态与售罄态一律 false。 */
  showUrgency: ComputedRef<boolean>;
  /** 关闭态文案变体键(默认 "default")。 */
  closedNoticeKey: ComputedRef<string>;
  /** 未开售(预售锁定态)。到点自动翻 false。 */
  preSale: ComputedRef<boolean>;
  /** 是否显示倒计时具体时间。**关闭态下恒 false**(规格 ④:不对不可购买的东西制造紧迫感)。 */
  showTime: ComputedRef<boolean>;
  /** 倒计时天数(0 时不显天)。 */
  countdownDays: ComputedRef<number>;
  /** 倒计时时分秒 HH:MM:SS。 */
  countdownClock: ComputedRef<string>;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function useGenesisSaleGate(): UseGenesisSaleGateResult {
  const cfg = useGenesisConfig();
  const genesis = useGenesis();
  const nowTs = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    nowTs.value = Date.now();
    timer = setInterval(() => {
      nowTs.value = Date.now();
    }, 1000);
  });
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  const block = computed(() =>
    genesisPurchaseBlock({
      configLoaded: cfg.loaded,
      marketStatus: cfg.config.marketStatus,
      // 🔴 熔断槽位:前端目前无生产者(后台 J1 有 genesis 闸但未接线),恒 false。
      //   理由与「为什么不删这个参数」写在 genesis-config.ts 的 GenesisPurchaseInput.halted。
      halted: false,
      remaining: genesis.totalSlots - genesis.soldSlots,
      saleStartAt: cfg.config.saleStartAt,
      now: nowTs.value,
    }),
  );

  const marketClosed = computed(() => block.value === "marketClosed");
  const showUrgency = computed(() => genesisShowsUrgency(block.value));
  const closedNoticeKey = computed(() => cfg.config.closedNoticeKey);

  const preSale = computed(() => isPreSale(cfg.config.saleStartAt, nowTs.value));
  // 🔴 倒计时受 showUrgency 闸:市场关闭时即使 saleStartAt 还没到,也不显示倒计时。
  const showTime = computed(
    () => showUrgency.value && preSale.value && cfg.config.showCountdown && cfg.config.saleStartAt != null,
  );

  const remainMs = computed(() => {
    const start = cfg.config.saleStartAt;
    if (start == null) return 0;
    return Math.max(0, start - nowTs.value);
  });
  const countdownDays = computed(() => Math.floor(remainMs.value / 86400_000));
  const countdownClock = computed(() => {
    const totalSec = Math.floor(remainMs.value / 1000);
    const hh = Math.floor((totalSec % 86400) / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  });

  return { block, marketClosed, showUrgency, closedNoticeKey, preSale, showTime, countdownDays, countdownClock };
}
