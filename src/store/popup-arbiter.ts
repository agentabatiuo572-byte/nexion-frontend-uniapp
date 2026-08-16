import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 自动弹层占屏仲裁 —— 全站「同一时刻只允许一个会吃交互的浮层占屏」的唯一裁决点。
 *
 * 背景(2026-08-16 独立走查实测):首页里程碑庆祝浮层叠在已弹出的代金券领取弹层
 * 正上方并模糊背景数十秒;换语言重进首页时试用弹层抢在代金券之前。根因不是某处
 * 写错,而是每个弹出面各自判断该不该弹 —— 互斥靠两两手写 `!对方.open`,全站只有
 * 代金券↔试用这一对,加第三个面(庆祝)时没人补,于是它对谁都不让。
 *
 * 🔴 裁决必须住在 store 里,不能写进宿主组件:全站 80 个页面共用 app-chassis,
 * 而 uni 在页面栈里**不卸载**被压住的页面(只 display:none),全局浮层宿主又挂在
 * chassis 内部 —— 页面栈深 N 就有 N 份宿主各跑各的定时器,读的却是同一份 store。
 * 组件里判断会有 N 份副本同时判断;store 里判断天然收敛到一份。
 *
 * 本 store **只管「此刻谁占屏」**,不碰「多久能再弹一次」—— 各弹出面自己的
 * cooldownHours / maxPerSession / 持久化键原样留在各自 store 里,一行不改。
 *
 * Real backend: 优先级表随 auto-push 配置下发(与 trial-config 的 autoPush* 同口径,
 * PRD §9.11b),运营可调而不发版;客户端常量只作为拉取失败时的兜底。
 */

/**
 * 会吃交互(铺遮罩、挡住底下按钮)的自动弹出面,**按优先级从高到低**。
 * 主人 2026-08-16 拍板 A1:代金券 → 试用 → 庆祝。
 *
 * 🔴 顺序即优先级。改这个数组就是改漏斗顺序 —— 不再靠「延迟数字谁小谁先」
 * 隐式表达(旧写法 1300ms vs 1500ms,任何人调延迟都会不知情地改掉漏斗顺序)。
 */
export const POPUP_PRIORITY = ["voucher-claim", "trial-claim", "milestone"] as const;

export type PopupId = (typeof POPUP_PRIORITY)[number];

export const usePopupArbiter = defineStore("popupArbiter", () => {
  /** 此刻占屏的面;null = 空屏,谁都可以申请。会话态,不持久化。 */
  const current = ref<PopupId | null>(null);

  /**
   * 申请占屏。主人 2026-08-16 拍板 C1「永不顶替,先到先得」——
   * 已经有别人占着就直接失败,**不比优先级、不抢屏**:高优先级的面晚到也只能等,
   * 绝不在用户手指伸向按钮的瞬间把弹层换成别的。
   * 同一个 id 重复申请视为成功(幂等 —— N 份宿主副本会各调一次)。
   */
  function acquire(id: PopupId): boolean {
    if (current.value !== null && current.value !== id) return false;
    current.value = id;
    return true;
  }

  /** 归还占屏。只有持有者能归还 —— 防止 A 关闭时顺手把 B 刚拿到的令牌抹掉。 */
  function release(id: PopupId) {
    if (current.value === id) current.value = null;
  }

  /** 除 `self` 外是否有人占屏 —— 宿主用它判断「这一轮该不该让路」。 */
  function busyForOthers(self: PopupId): boolean {
    return current.value !== null && current.value !== self;
  }

  return { current, acquire, release, busyForOthers };
});
