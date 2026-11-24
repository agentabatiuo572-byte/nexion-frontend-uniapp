# 「我的」入口未读点预览

预览服务器启动后，向同源的 `POST /__demo/me-entry-dots` 发送 JSON。示例使用默认端口 5190。切换数据后可在同一个 App 会话下拉刷新或重新进入，已看记录继续保存在当前浏览器。

```sh
curl -sS http://127.0.0.1:5190/__demo/me-entry-dots \
  -H 'Content-Type: application/json' -d '{"wave":0}'
```

- `wave` 取 0–3。0 时商城订单、收益凭证与正式盒子设备为空，每增加一档各新增一条。开放周的同一项任务随波次从待完成推进到可领取。第一笔凭证可从 `/#/pages/me/receipts?receiptNo=CTR-00000000000040008000000000001BC6` 打开。
- `payment` 可用 `placed`、`paid`、`expired`、`failed` 初始化样本。placed 样本已超过付款截止，进入订单后仍可走原有取消确认。预览查回无进行中的支付意图，取消后订单列表返回已取消。也可让 placed 推进为已支付、过期或付款失败。`newerOrders:20` 将样本移出首批。
- 首次配置账号可选 `week: "empty"` 建立独立的空周，或使用默认开放周。`weekTarget: "genesis"` 配合 `genesisMarket: "open"` 发布创世任务，随后切 `genesisMarket: "closed"` 暂停业务，周任务定义保持冻结。恢复业务重用同一任务。周内用 `weeklyStatus` 推进到 `COMPLETED` 或 `CLAIMABLE`。
- 模拟跨周时，取配置响应的 `currentWeek.eligibleUntil`，把 `advanceServerTo` 设到该时间或稍后，再把验证页的设备时钟对齐响应的 `serverNow`。周快照读取和领取命令共用该预览服务端时间，前一周窗口关闭后才切到下一周。同一账号的预览时钟只向前推进。
- 首次配置账号可用 `dayOne: "PENDING"`、`"COMPLETED"` 或 `"CLAIMABLE"` 创建单任务新手实例，省略或设为 `null` 则为空。实例成员与窗口固定，状态只向前推进。真实「今日」页领取后同一实例读回 `CLAIMED`。
- `fail` 指定 `orders`、`missions`、`receipts` 或 `inventory` 返回 503，设为 `null` 恢复。用 `failStatus:403` 模拟身份失效。`delay` 可指定上述来源或 `receipt-detail`，用 `delayMs` 设置延迟，设为 `null` 恢复。延迟响应按请求开始时的夹具事实生成。
- 默认使用当前预览账号，可用 `accountId` 设置另一个预览账号。`reset:true` 启用新的独立预览样本。
