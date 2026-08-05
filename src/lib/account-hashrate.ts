// 账号总有效算力(TOPS)—— 首页「你的排名」入参 `myTotalHashrate` 的唯一生产者
// (规格 FEAT-HOME02 ③)。lib/network-rank.ts 只负责「算力 → 百分位 → 名次」,
// 算力本身由这里聚合出来。
//
// 🔴 本文件**只做聚合**,单台的算力口径一条都不新造,全部回既有模型取:
//   · 手机的实时有效算力 = lib/hashpower.ts `computeLiveHashpower`
//     (设备卡上那个跳动的 TOPS 就是它,components/earn/device-card-pc.vue:456);
//   · 手机的算力天花板   = `device.capabilityTops`(标定值),缺失时同款回退
//     `fallbackCapability()` —— 与设备卡同一行写法(device-card-pc.vue:451);
//   · 非手机的天花板     = 设备自己那行 GPU 规格串 `device.gpu`(如 "8× NVIDIA A100"),
//     用 lib/gpu-tiers.ts 既有的 `matchGpuTier()` 解成档位 TOPS,再乘串里写明的张数。
//     🔴 这不是新造的换算:型号→TOPS 的映射仓里本来就有(GPU_TIERS.keywords 已含
//     rtx 4090 / rtx 5090 / a100 / h100),电脑 GPU 一直走它。上一版按「日产反推」
//     另立了第二把尺子,读数与设备自己那行规格最多差 5.6 倍(8× H100 规格 5,280、
//     反推 35,106),只要有任何一处把单台 TOPS 显示出来就当场自相矛盾。两把尺子已合并。
//     覆盖不到型号关键词的串(cloud-share 的 "Distributed")落到 `matchGpuTier` 自带的
//     G2 兜底 —— 那是它既有的声明行为,不在这里另发明补丁。
//
// ⚠️ **已知天花板(台账 P1-3),两处都在本文件之外,别在这里另发明公式去凑**:
//   ① `lib/gpu-tiers.ts` 最高档 G6 把 RTX 4090 / 5090 / A100 / H100 收在同一档(660),
//      于是 Pro / Pro v2 / Rack P1 / Rack P2 四个 SKU 天花板并列 5280 —— $1,199 与
//      $7,499 的机器读数相同,映射对数据中心卡之间的差异没有分辨力。
//   ② `mock/platform-config.ts` 分位表最高档只到 150 TOPS,超出即封顶 96%。
//   叠加的后果(实测):手机+S1 = 2,667.5 TOPS、手机+10 台 Rack P2 = 52,827.5 TOPS,
//   名次都是 57,281 —— 规格用户故事「加算力看到排名前进」对所有付费账号失效。
//   要解:先给 G6 以上补档,再把分位表抬到硬件量级(两件事必须一起做,只抬分位表会
//   立刻暴露 ① 的四并列)。本文件产出的算力本身是对的,不是这两条的成因。
//
// 🔴 **任务量递减不进排名**。store/device-lifecycle.ts 的 `getEfficiency` **降的不是算力**:
// 平台语义是硬件算力恒定不变,随时间递减的是它**能接到的任务量**。该文件自陈是
// 「hardware degradation」那套说法的继任者,档位表叫 `TASK_CAPACITY_BANDS`,豁免清单
// 注释写的是 "exempt from the **task-mix decline**",后台开关叫「参与任务递减」;它乘的是
// `device.baseRate`(USD/日),产物全是钱(app.ts settleDevice 已经在用)。
// 所以把「接多少活」乘进「跑多快」**本身就是语义错**,不是「会不会倒退」的权衡题。
// 真乘了才会出现「用户什么都不做算力也下降、名次持续倒退」,规格阳光路径4「名次永不倒退」
// 当场失效(今天被分位表 96% 封顶掩盖,一抬档就发作)。这里取天花板不打折 —— 拿掉之后
// 算力不随时间变,单调性天然成立,**不需要任何单调性兜底代码**。
// 排名格回答的也正是「你投入了多少算力」:那是采购决策,不该因设备变老而惩罚,
// 何况任务量递减已经在收益侧罚过一次,进排名等于罚两遍。
//
// 「在不在产」的权威是 app.ts `settleDevice` 那张不结算清单(未激活 / status 非 online /
// pausedReason 非空),**不是** `isDeviceOnline` —— 后者只回答「有没有常驻 App 心跳」
// (决定拿满档还是拿 hosted 档)。拿它当在产判据的后果:H5 上一台正按 $0.036/日 真给钱、
// 设备卡显示 16.4 TOPS 的手机,在排名里被算成 0,首页对着一个正在赚钱的用户说
// 「未上榜,激活设备就上榜」。心跳新鲜与否照旧原样传给既有单台模型,由它给档。
//
// 🔴 不吃抖动:`computeLiveHashpower` 的 jitter 是展示用的呼吸感(≈0.955–1.0 来回摆)。
// 让它进名次,排名每秒抖一次、还会倒退 —— 规格 ③「同输入必同输出」与阳光路径 4
// 「名次永不倒退」当场失效。这里给它一个**固定种子**把抖动冻成常数因子,
// 而不是另写一份「无抖动版算力」(那就成了第二套口径)。
//
// Backend-replaceable:PROD 由服务端在 `GET /api/platform/rank` 里算同一个和,
// client 这份是 mock 期的同构实现。
import type { Device } from "@/store/types";
import { computeLiveHashpower, isDeviceOnline } from "./hashpower";
import { fallbackCapability } from "./device-capability";
import { matchGpuTier } from "./gpu-tiers";

/** 排名口径的固定抖动种子(见文件头)。任何常数都行,重点是**不随时间变**。 */
const RANK_JITTER_SEED = 0;

/** 规格串开头写明的张数:"8× NVIDIA A100" → 8;没写数量的按 1 张。 */
const GPU_COUNT_RE = /^\s*(\d+)\s*[×x*]\s*/i;

/** 在线加成系数(配置 store 的 `config.onlineBonus`,后端可接管)。 */
export interface OnlineBonusInput {
  h5BaseFactor: number;
  continuityFullHours: number;
}

/** 单台的算力天花板(TOPS)。手机用自己的标定值,其余读设备自己那行 GPU 规格串。 */
export function deviceBaselineTops(device: Device): number {
  if (device.kind === "phone") return device.capabilityTops ?? fallbackCapability().tops;
  const gpu = device.gpu ?? "";
  return Number(GPU_COUNT_RE.exec(gpu)?.[1] ?? 1) * matchGpuTier(gpu).tops;
}

/**
 * 单台的**有效**算力(TOPS)。不在产 → 0(规格 ③「不计」)。
 *
 * 注意零值有两种来源且都正确:设备不在产(这里判),以及设备在产但条件因子把它压到 0
 * (如手机断网 → network 因子 0,由既有模型判)。两者都不该由本文件解释成「未上榜」——
 * 那是 network-rank.ts 的事。
 */
export function deviceEffectiveTops(device: Device, now: number, onlineBonus: OnlineBonusInput): number {
  // 在产判据 = settleDevice 的不结算清单(见文件头)。cloud-share 不在其中:
  // 它不走 settleDevice 计息是收益侧的安排,算力照样在网。
  if (device.activatedAt === null || device.status !== "online" || device.pausedReason != null) return 0;
  const baselineTops = deviceBaselineTops(device);

  if (device.kind === "phone") {
    return computeLiveHashpower({
      baselineTops,
      // 心跳新鲜 → 满档;H5 / App 被杀 → 既有模型的 hosted 档(与设备卡上那个数同源)。
      online: isDeviceOnline(device, now),
      isCharging: device.isCharging !== false,
      isOnline: device.isWifiConnected !== false,
      thermalState: device.thermalState,
      continuityMs: device.miningSince ? Math.max(0, now - device.miningSince) : 0,
      nowSeed: RANK_JITTER_SEED,
      onlineBonus,
    }).effectiveTops;
  }

  return baselineTops;
}

/**
 * 账号总有效算力 = 全部已激活且在线设备的有效算力之和。
 * 无设备 / 全部未激活 / 全部离线 → 0(**不在这里判「未上榜」**,那是排名函数的三态)。
 *
 * 非有限值(配置或设备数据坏了)按 0 计:让 NaN 流进 computeRank 会被它判成
 * `unranked`(未上榜),用户看到的是「你还没上榜」而不是「数据更新中」—— 错的状态。
 */
export function accountTotalHashrate(
  devices: readonly Device[],
  now: number,
  onlineBonus: OnlineBonusInput,
): number {
  return devices.reduce((sum, device) => {
    const tops = deviceEffectiveTops(device, now, onlineBonus);
    return Number.isFinite(tops) && tops > 0 ? sum + tops : sum;
  }, 0);
}
