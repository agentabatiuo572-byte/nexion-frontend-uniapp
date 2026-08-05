import { ref, computed, onMounted, onUnmounted, type ComputedRef } from "vue";
import {
  useGenesisConfig,
  isPreSale,
  genesisPurchaseBlock,
  genesisShowsUrgency,
  genesisSecondaryBlock,
  type GenesisPurchaseBlock,
} from "@/store/genesis-config";
import { useGenesis } from "@/store/genesis";
import { useT } from "@/i18n/use-t";

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
 * MOCK-ONLY:marketOpenState / saleStartAt / showCountdown 均 server-canonical(admin G4)。
 */
export interface UseGenesisSaleGateResult {
  /** 最高优先级的阻断原因;`null` = 可购买。页面据此出文案与行为,不再自判。 */
  block: ComputedRef<GenesisPurchaseBlock>;
  /** 二级市场(承接他人挂单)的阻断原因。
   *
   *  与主售的差别只有一处:**二级不受主售名额与开售时间影响** —— 卖的是别人手里的存量,
   *  主售售罄或未开售都不妨碍转让。所以这里把那两档喂成「恒不命中」,
   *  而不是靠调用方漏判来「碰巧不拦」。
   *  🔴 放在 composable 里是为了让 store 的 `acquireSecondary` 与本页**共用同一套口径**;
   *  上一版页面自己写 `marketClosed`、store 自己写另一套条件,两处早已不一致(验收 P1-5/P1-6)。 */
  secondaryBlock: ComputedRef<GenesisPurchaseBlock>;
  /** 市场关闭态(= block === "marketClosed"),给需要单独渲染关闭说明的地方用。 */
  marketClosed: ComputedRef<boolean>;
  /** 是否允许展示紧迫感元素(倒计时 / 剩余名额)。关闭态与售罄态一律 false。 */
  showUrgency: ComputedRef<boolean>;
  /** 关闭态文案变体键(默认 "default")。 */
  closedNoticeKey: ComputedRef<string>;
  /**
   * 三档**阻断说明**文案的唯一出口:`configUnavailable` / `marketClosed` / `halted`。
   *
   * 🔴 只管这三档,其余档返回 `null` —— 因为 `soldOut` / `preSale` / 可购买态的措辞
   *    **各面本就不同**(创世页售罄说「已售罄」、商城卡说「去二级市场」),那是各面的
   *    CTA 词汇,不是重复。把五档一起合并会把商城卡的售罄文案悄悄改掉。
   *
   * 🔴 返回 `null` 而不是兜底成 `marketClosed.default`:上一版有两处靠 `default:` 兜住
   *    可购买态(block 为 null 时也算出一句「市场暂未开放」),只因外层另有闸挡着才没露出来。
   *    返回 null 让调用方必须显式处理自己的档,那种「靠外层碰巧挡住」的写法会当场暴露。
   */
  blockText: ComputedRef<string | null>;
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
    // 🔴 消费者进场即重读配置源(hydrate-once 修复的 UI 面):config 是共享 Pinia store,
    //   任一消费者 refresh,所有已挂载消费者的 computed 一起更新。
    cfg.refresh();
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
      marketOpenState: cfg.config.marketOpenState,
      // 🔴 熔断槽位:前端目前无生产者(后台 J1 有 genesis 闸但未接线),恒 false。
      //   理由与「为什么不删这个参数」写在 genesis-config.ts 的 GenesisPurchaseInput.halted。
      halted: false,
      remaining: genesis.totalSlots - genesis.soldSlots,
      saleStartAt: cfg.config.saleStartAt,
      now: nowTs.value,
    }),
  );

  // 走共享纯函数,与 store 的 acquireSecondary 同一套输入口径(见其定义处的注释)。
  const secondaryBlock = computed(() =>
    genesisSecondaryBlock({ loaded: cfg.loaded, marketOpenState: cfg.config.marketOpenState, now: nowTs.value }),
  );

  const marketClosed = computed(() => block.value === "marketClosed");
  const showUrgency = computed(() => genesisShowsUrgency(block.value));
  const closedNoticeKey = computed(() => cfg.config.closedNoticeKey);

  // 三档阻断说明的**唯一映射出口**。改造前这段 switch 在 4 个页面各写了一份
  // (还有 2 个页面连写都没写、直接写死 `.default`,于是售罄时说成「暂未开放」,
  //  与创世页同刻互相矛盾 —— 独立验收 P1-3)。合并到这里之后没有第二处能写错。
  const t = useT();
  const blockText = computed<string | null>(() => {
    const notices = t.value.genesis.marketClosed;
    switch (block.value) {
      case "configUnavailable":
        return notices.configUnavailable;
      case "halted":
        return notices.halted;
      case "marketClosed":
        // 变体键来自后台下拉白名单;取不到时回落 default(hydrate 已做白名单校验,这里是二道保险)。
        return notices[closedNoticeKey.value as "default"] ?? notices.default;
      default:
        // soldOut / preSale / 可购买 —— 各面措辞不同,由调用方自己出。
        return null;
    }
  });

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

  return { block, secondaryBlock, marketClosed, showUrgency, closedNoticeKey, blockText, preSale, showTime, countdownDays, countdownClock };
}
