import { ref, computed, onMounted, onUnmounted, type ComputedRef } from "vue";
import { useGenesisConfig, isPreSale } from "@/store/genesis-config";

/**
 * useGenesisSaleGate — 预售锁定倒计时门(规格 FEAT-GEN09)。
 *
 * saleStartAt 是独立于上所信号(nexListed)的一次性「开始认购」时间锚。未到点 =
 * 预售锁定(最外层门,在资格门之前);showCountdown 控制是否显示具体倒计时时间。
 * 秒级 tick 驱动实时倒计时与到点自动解锁(不缓存布尔,边界靠 now 实时比较)。
 * MOCK-ONLY:saleStartAt/showCountdown server-canonical(admin G4)。
 */
export interface UseGenesisSaleGateResult {
  /** 未开售(锁定态)。到点自动翻 false。 */
  preSale: ComputedRef<boolean>;
  /** 是否显示倒计时具体时间(preSale && showCountdown)。false 时只显「即将开售」。 */
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

  const preSale = computed(() => isPreSale(cfg.config.saleStartAt, nowTs.value));
  const showTime = computed(() => preSale.value && cfg.config.showCountdown && cfg.config.saleStartAt != null);

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

  return { preSale, showTime, countdownDays, countdownClock };
}
