# 「我的」入口未读点预览

预览服务器启动后，向同源的 `POST /__demo/me-entry-dots` 发送 JSON。此接口只在本机预览使用，切换数据后可在同一个 App 会话下拉刷新或重新进入，不改本机的已看记录。

```sh
curl -sS http://127.0.0.1:5788/__demo/me-entry-dots \
  -H 'Content-Type: application/json' -d '{"wave":0}'
```

- `wave` 取 0–3。0 时商城订单、收益凭证和设备为空，每增加一档各新增一条。开放周从第一档起始终有同一项任务，增加 wave 会把它从待完成推进为可领取。第一笔凭证可从 `/#/pages/me/receipts?receiptNo=CTR-00000000000040008000000000001BC6` 打开。
- `payment` 取 `placed`、`paid`、`expired`、`failed`、`none`。放置样本已超付款截止点，只有服务端状态变更才解除常亮。`newerOrders:20` 将样本移出首批。
- `weeklyStatus` 可将当前周的任务向前推进到 `COMPLETED` 或 `CLAIMABLE`。在任务中心「本周」领取后，原任务与实例会读回为 `CLAIMED`。用 `weekState: "closed"` 读空周期，`weekState: "next"` 在下一周发放同码的待完成任务。验证下一周点亮时，先将预览页面的时钟推进到新周期。可用 `dayOne` 的 `PENDING`、`COMPLETED`、`CLAIMABLE` 或 `null` 切换新手组。
- `fail` 可指定 `orders`、`missions`、`receipts` 或 `inventory` 返回 503，设为 `null` 恢复。用 `failStatus:403` 模拟身份失效。
- `delay` 可指定上述来源或 `receipt-detail`，用 `delayMs` 设置延迟，设为 `null` 恢复。响应内容在开始延时前固定。
- 默认使用当前预览账号，可用 `accountId` 设置另一预览账号的数据。用 `reset:true` 重置对应账号的服务端夹具。
