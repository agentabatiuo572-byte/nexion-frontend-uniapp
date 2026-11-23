# 「我的」入口未读点预览

预览服务器启动后，向同源的 `POST /__demo/me-entry-dots` 发送 JSON。此接口只在本机预览使用，切换数据后可在同一个 App 会话下拉刷新或重新进入，不改本机的已看记录。

```sh
curl -sS http://127.0.0.1:5788/__demo/me-entry-dots \
  -H 'Content-Type: application/json' -d '{"wave":0}'
```

- `wave` 取 0–3。0 为空，每增加一档新增一笔已交付订单、一项任务、一张收益凭证和一台设备。凭证详情号为 `CTR-DEMO-ME-DOT-1` 等。
- `payment` 取 `placed`、`paid`、`expired`、`failed`、`none`。放置样本已超付款截止点，只有服务端状态变更才解除常亮。`newerOrders:20` 将样本移出首批。
- `weeklyStatus` 可把第一项任务切换为 `COMPLETED` 或 `CLAIMABLE`。可用 `dayOne` 的 `PENDING`、`COMPLETED`、`CLAIMABLE` 或 `null` 切换新手组。
- `fail` 可指定 `orders`、`missions`、`receipts` 或 `inventory` 返回 503，设为 `null` 恢复。用 `failStatus:403` 模拟身份失效。
- `delay` 可指定上述来源或 `receipt-detail`，用 `delayMs` 设置延迟，设为 `null` 恢复。响应内容在开始延时前固定。
- 默认使用当前预览账号，可用 `accountId` 设置另一预览账号的数据。用 `reset:true` 重置对应账号的服务端夹具。
