# Android 本机 EM 执行与构建

手机任务使用真实 `all-MiniLM-L6-v2` FP32 ONNX 模型，不使用BGE-M3云执行替代。Android App的renderjs桥在Worker里运行ONNX Runtime Web WASM CPU；目前iOS与H5只查看状态。只有模型SHA验证且真实ORT session加载成功，App才向服务端申报engineReady。

固定版本：ONNX Runtime Web `1.23.2`，模型revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`。模型权重SHA256 `6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452`；安装profile digest为 `sha256:4fd205f37776262f8e8d3224ce5a4ed0b19bd106129046da04322a6bd19b4562`，两者含义不同。

正常native资源构建前执行：

```text
npm ci
npm run prepare:phone-compute
```

资源准备脚本复制固定npm版本的ORT文件，bundle生产Worker，生成 `src/static/phone-compute/manifest.json`；清除旧构建权重，APK/WGT不携带90MB模型。此目录为可重建的构建资产，native发布流程必须运行准备步骤并将ORT、Worker和许可证带入正常签名/发布产物。

首次前台准备时，Android通过原生 `uni.downloadFile` 从固定官方HTTPS revision下载90,405,214字节模型，页面显示进度；完成后用 `uni.saveFile` 移到App私有 `_doc/uniapp_save/` 持久目录，缓存键绑定revision和权重SHA。后续启动和任务只读同一缓存，Worker每次仍核对完整SHA后才加载ORT，不重复联网下载。文件丢失或大小不符重新下载；SHA不符时清除该缓存并显示重试，不能申报已就绪。下载/保存失败保持不可用并提供重试，后台及离开会话不能因下载完成而启动推理。模型缓存不包含账号凭据或任务结果，不能把HBuilder壳的缓存当作正式APK的缓存。

手机普通APP会话通过 `/api/app/compute-v2/phone/{next,heartbeat,complete,receipt,exited}` 工作。服务端从当前会话取得绑定手机，不接受App指定owner/device/installation或云runner。输入固定2条，基础模板每条最多120token，服务端每单在CLS后分别加入8个随机词表ID并冻结完整矩阵，每条最终最多128token。手机直接使用收到的矩阵跑encoder、masked mean pool和L2归一化，输出little-endian float32 `[2,384]`、3072字节。Python独立进程用同一图与冻结tokens复算，旧向量不能通过新挑战的独立复算，真正验证后才进入现有分钟结算。

本地journal按账号和安装实例隔离：next请求前写CLAIM_INTENT，开始计算前写COMPUTE_INTENT，完成后先保存完整原bundle再提交。结果确认未知只回读或重传原bundle，不重新推理；恢复时看到旧COMPUTE_INTENT先确认旧Worker退出并结束原代际。只有Worker真的terminate后才发送exited，低电、断网、后台和退出会话均先停止本机执行。计时只用于实际超时中止，不能让任务自动成功。

验收必须区分桌面引擎烟测、HBuilder调试预验和正式Android APK。正式通过需要当前发布APK在SM-A5760或其他受支持真机完成派单→本机推理→独立验真→分钟入账→下一单，并覆盖一次中断恢复与错误产物拒绝。模型峰值RAM<0.5GB是待实测门槛，不能用90MB文件大小代替。未完成的阶段不能记为通过。

2026-11-02已运行桌面和SM-A5760 HBuilder全模型预验，后者2×16token（含每行8个随机挑战ID）首个取证样本185ms；独立PythonORT复算最大误差9.6857548×10⁻⁸、最小余弦1。旧向量重绑新输入与正确元数据后被拒绝。此阶段没有业务领取或结算，且临时烟测入口已移除，不替代正式APK与完整业务验收。无真实task的接口失败显示等待任务服务，只有真实task才显示恢复任务状态。

同日已在同一SM-A5760完成首次官方下载90,405,214字节→私有持久保存→生产Worker文件读取/SHA/ORT→真实推理，以及完整进程重启后缓存命中（新增下载0字节）→真实推理。两次推理分别199ms、202ms（不是下载耗时），完整产物逐字相同，分别独立Python复算通过。实际savedFilePath形态为 `_doc/uniapp_save/<timestamp>.onnx`。此为HBuilder缓存预验，正式APK首次下载/缓存、下载中后台失败后前台重试及业务断网恢复仍待实景验证。
