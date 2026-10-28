# App 最新 UI 与 UVT 候选整合

来源：干净 detached `9d06e56b` 合并 fetch 后 `origin/test=e4fd6db3`，保留远端 3 提交、174 文件。仅本 App 工作树写入，不推送、不操作 H5、服务器、浏览器或真机。

| 用例 | 操作与预期 | 核验 |
| --- | --- | --- |
| MERGE-01 | 保留最新 UI 布局、滚动、筛选和隐私遮罩；商品/昵称直接显示源值 | 冲突逐项核对、真实组件行为测试 |
| MERGE-02 | UVT 实际资产/兑换方向维持新值；旧协议字段名与历史待处理命令身份保留 | 资产/兑换 API 与恢复测试、合并新增源码差异 |
| MERGE-03 | all/either 仅正最低条件参与，全零无最低条件，售罄仍阻断 | purchase-gate-zero 测试 |
| MERGE-04 | UID/手机号独立、换账号清空、迟到头像请求不污染新账号 | profile identity/API/lifecycle 测试 |
| MERGE-05 | 团队暖目录刷新、失败恢复、隐私、筛选和新积分榜不破坏数据事实 | 团队相关行为测试 |
| MERGE-06 | 合并后类型与 APP 目标可编译 | type-check；全新 `artifacts/native-post-ui` 输出 |

冲突四处：market-board 保留 compact 英文单位及源设备名；live-social-proof 保留新滚动/可见性与源名称；upgrade-spotlight 保留 title class 与源名称；commissions 保留新筛选/隐私且资产参数为 UVT。social-proof 旧品牌归一断言改为直接显示源名称，仍核原商品 key、计数和快照未变。

本轮验证只证明本地源码与合成边界。全库已知失败基线不在修复范围；未执行真实 App/真机验收。H5 同期与最终推送由主任务负责。

结果：38 个定向文件共 911 项通过（首组 22 文件 634 项；补充组 16 文件 277 项，首次 3 项失败后只复跑其 2 文件 22 项）。补充失败均在测试适配：空行情板的新常驻未知提示与旧隐藏断言冲突，以及真实组件新增的 USD/英文词条/隐私/团队说明依赖未注入；已同步夹具和真实预期，未删业务断言或跳过用例。

Vue 类型检查通过；APP 目标 `uni build -p app` 编译通过，输出 `artifacts/native-post-ui/app`，未覆盖既有构建证据。日志位于同目录的 targeted-tests.log、integration-tests.log、fixture-recheck.log、typecheck.log、build.log，不纳入提交。

核对合并后的新增生产源码，没有新增旧 NEX 资产请求、旧兑换方向或名称替换。仍保留 amountNEX/monthNEX 等既有协议字段与历史命令恢复兼容，含义不等同于资产枚举。`brand-copy` 入口保持原值返回。最新 UI 提交的三份 PRD 增量原样保留，并在 UVT 规范记录整合边界。
