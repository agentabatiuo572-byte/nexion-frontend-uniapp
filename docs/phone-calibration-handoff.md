# 正式 APP 手机校准交接

实施目标为正式 Android APP，分支 test；原型未修改。功能契约见 PRD §4.7.3、§6.10、§6.11。

完整跨仓验收提示词与配置顺序见 [后端交接](https://github.com/agentabatiuo572-byte/nexion-backend/blob/test/docs/phone-calibration-handoff.md)。真机验收由同事执行，iOS 证明尚未实现；不把浏览器或模拟桥接测试称为真机验收。

本地关联目录：后端 D:/WORKS/PLAN/nexion-backend；后台 D:/WORKS/PLAN/.wt/phone-calibration-pc-20260928；H5 D:/WORKS/PLAN/Nexion-H5。

验收依赖：me-ui-parity.contract.test.ts 与 me-button-parity.contract.test.ts 读取兄弟目录 NX1.0-Prototype。应使用原型仓历史提交 b8538d45 的 src 参考副本；它与全部固定模板哈希一致。最新原型已改版，不能代入这组历史基线。当前本地参考为 D:/WORKS/PLAN/.wt/NX1.0-Prototype，使用 git archive 提取，不是开发工作树。两组对齐测试已通过，未修改页面或断言；首次引用错误资料的失败日志仍保留。
