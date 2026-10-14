# APP专属客服交接

本页仅记录APP交付边界；客服中心整体索引及同事待测项见[PC总索引](https://github.com/agentabatiuo572-byte/nexion-frontend-pc/blob/test/docs/acceptance/support-center-handoff-20261014.md)与[客户消息待测明细](https://github.com/agentabatiuo572-byte/nexion-frontend-pc/blob/test/docs/acceptance/support-customer-message-pending-20261014.md)。

## 交付范围

统一专属客服入口，兼容advisor/support历史；接收SKU/LINK卡片并限制目标类型和可用性；显示原消息姓名、时间及经鉴权的已确认作者头像；未知或读取失败的未读显示“-”。新建恢复仍绑定原账号、权限运行作用域与原命令键。中、英、越及本仓PRD正文、产品更新日志一并交付。

## 快照与验证

- 工作分支：`codex/cs-app-delivery-20261014`。客服候选提交：`81ab8d64058ded5098e58a31b43593d7afbab72d`；整合来源：`origin/test`的`bb0ed7949db3825e0ce1bfd638ef47fb6b1b5b67`。最终提交以该分支Git历史为准，本页不把候选写成已合入远端test。
- 候选新增差异：真实`npm run type-check`通过，8个定向Vitest文件145/145通过（含时区稳定测试）。整合最新test后，真实type-check、17个客服连接Vitest文件326/326及权限契约17/17通过；独立`npm run build:h5:prod`通过（33.45s），生产产物边界检查272文件通过，属于生产构建证明，不是full通过。
- **Full BLOCKED：H5同步不一致。** `D:/WORKS/PLAN/Nexion-H5`是现行active镜像，来源pin仍为ce497623及其它任务的源工作树；只读同步检查返回APP_H5_SYNC_FAILED。未改镜像、未新建或复制H5。2026-10-10的full只证明旧候选，不能代签当前树；feature代码交接不等于已经合入test。

## 明确待测

主人决定客户消息controller端到端测试先交同事，本轮不标通过。仍需正常客户登录，核客户发送/坐席接收/作者身份/卡片/鉴权头像/实时事件/回执、刷新与重连、撤权和旧类别兼容。管理端证据、纯组件测试及本页说明均不能替代该客户认证链。

APP原生真机消息、键盘/图片/私有头像行为未由本轮候选定向测试证明；实际页面与后台权限拒绝须按整体待测明细核验。未通过完整门时只可作为feature待测交接，不宣称正式test交付或生产启用。
