// 周任务「服务端派了一个现在不可能完成的创世任务」——**观测闸,不是过滤器**。
//
// ══ 责任归属:为什么客户端不过滤 ═══════════════════════════════════════════════
// 2026-08-05 客户端曾有一道**真闸**:weekly-quest-hero.vue 把 useGenesisSaleGate 的
// 判定喂给 dispatchTier1(genesisPurchasable),关闭 / 售罄 / 熔断 / 未开售时就不派
// 「买创世」。2026-08-12 周任务整体改成服务端下发(GET /api/quests/state),客户端从
// 「决定派什么」退成「渲染服务端派了什么」,那道闸随之消失——mock/weekly-quests.ts
// 连同 genesisPurchasable 一起成了无人 import 的孤儿。
//
// 🔴 恢复成客户端过滤是**做不到**,不是不想做:
//   任务在客户端的唯一句柄是 questCode / name,而 questCode 在后台 H3 是**运营手输的
//   自由文本**(admin-ops `app/components/domain-views/h-tabs/h3-quest-events.tsx`
//   的 mission-create 表单:`String(bv.missionCode).trim()`,只要求「编号英文唯一」)。
//   没有枚举、没有分类字段、没有「这条任务指向哪个业务动作」。客户端只能按字符串猜,
//   而**猜错的两个方向代价不对称**:
//     · 猜漏 → 退回今天的状态(用户看见一条暂时做不了的任务);
//     · 猜错 → 把一条 CLAIMABLE 的创世任务藏掉 = **扣掉用户已经挣到的奖励**。
//   后者严格更坏,所以过滤留在派发端(后端交接书 U-16)。
//
// 🔴 客户端留下的是**报警**:同一套字符串启发式,判错只多打一行 console.error,
//   判漏就是今天的状态——两个方向都可接受,过滤则不是。
//   选 console.error 不是随手写的:运行时探针统一用 `scripts/lib/console-origin-filter.mjs`
//   收集 app console error 并断言 = 0,所以报警一响,既有那批运行时门自动转红。
//
// 机器门:`scripts/selfcheck-quest-genesis-tripwire.mjs`(行为固定靶 + 接线 + 反向钉 + 红测)。
import type { CanonicalQuest } from "@/api/quest-api";
import type { GenesisPurchaseBlock } from "@/store/genesis-config";

/**
 * 这条任务是否指向创世购买。
 *
 * 句柄只有两个自由文本字段,所以两个都扫:questCode 是运营手输的英文编号,
 * name 是下发的标题——三语文案都保留 "Genesis" 字面(zh「购入 Genesis 创世节点」/
 * vi「Sở hữu một Genesis Node」/ en「Acquire a Genesis Node」),只扫 code 会漏掉
 * 编号没带 genesis 的那种命名。**启发式,不是契约**——这正是它只配当报警不配当闸的原因。
 */
export function questLooksGenesisBound(quest: Pick<CanonicalQuest, "questCode" | "name">): boolean {
  return /genesis/i.test(quest.questCode) || /genesis/i.test(quest.name);
}

/**
 * 服务端派了、而本地闸判「现在买不了」的创世任务。
 *
 * 🔴 只算 PENDING。COMPLETED / CLAIMABLE 是用户**已经挣到**的奖励,创世关不关都得让他领;
 *   CLAIMED 已经结束。把这三档算进来,报警就会去指控一件正确的事,而顺着报警做过滤
 *   更会变成「关闭态吞掉已得奖励」——比它想防的那个问题更坏。
 */
export function unclaimableGenesisQuests(
  quests: readonly CanonicalQuest[],
  block: GenesisPurchaseBlock,
): CanonicalQuest[] {
  if (block === null) return [];
  return quests.filter((quest) => quest.status === "PENDING" && questLooksGenesisBound(quest));
}

/**
 * 报警文案。ASCII——它进的是 console / 探针日志,不上屏;
 * 硬编码中文哨兵扫的正是「注释之外的 CJK」,这里写中文会被(正确地)当成漏进 i18n 的用户文案。
 */
export function genesisQuestContractViolation(
  offenders: readonly CanonicalQuest[],
  block: GenesisPurchaseBlock,
): string {
  const codes = offenders.map((quest) => quest.questCode).join(", ");
  return `[quest-genesis] server dispatched ${offenders.length} unachievable genesis quest(s) `
    + `while genesis purchase is blocked (${String(block)}): ${codes}. `
    + "Backend handoff U-16: the dispatcher must not emit genesis quests while the sale is "
    + "closed / halted / sold out / pre-sale.";
}
