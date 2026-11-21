# 购买付款预览

- 银行卡购买付款在预览服务器上打开本地模拟收银台。关闭后重新打开可核对同一付款单号。
- 先用「一直等待到账」建立付款单。通过 `POST /__demo/state` 设置 `{"paymentState":"read-error"}` 可在当前 App 页面模拟读取返回 503。设置 `{"paymentState":"intent-missing"}` 会移除选择时已有的未到账付款单，按原付款单号读取返回 404 `PURCHASE_PAYMENT_INTENT_NOT_FOUND`。原订单仍可付款。通过接口切换可保持 App 页面，观察下一次静默读取。
