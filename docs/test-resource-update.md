# TEST 日常资源更新

运营选择登记好的资源产物并完成审批。客户低于整包最低门槛时优先进入整包升级。App 检查 DCloud 应用标识和 Android 实际包名或 iOS 实际 bundle ID，产品宿主两端均为 `ai.uvel.app`。宿主满足整包策略、应用身份及原生构建均匹配时，客户端按实际资源构建号判断日常更新。日常更新允许稍后处理。

## 签发和登记

2026-11-22 已核实，现有 `ai.uvel.app` 构建 2026112201 与正式候选共用 Android 签名证书。此产品宿主及其配套资源当前只留本地。签发工具会拦截该证书；产品路径需先取得获准的 TEST 专属宿主并登记独立证书指纹。更换签名会影响已有安装的原地升级，需要单独决定。三星标准调试基座使用已核实的 DCloud 证书，按下节操作。

1. 使用 Windows PowerShell 7，在 TEST 发布操作者的 Windows 账号下运行 `./scripts/test-resource-key.ps1` 读取已登记公钥。首次登记才使用 `-Create`。同名密钥存在时读取原公钥。Windows CNG 软件提供程序保存不可导出的 P-256 签名密钥。App 钉住未压缩 SEC1 公钥，Java TEST 配置 SPKI DER 的 Base64。更换 Windows 账号或设备需要重新核对信任根。公钥文件位于 `src/services/test-resource-trust.json`。
2. 留存已确认的签名宿主 APK、独立验收回执中的 APK SHA-256，以及当时完整的 `app-plus` 编译输出目录。用相同编译器、插件、UTS 代理和原生配置编译本次 `test` 提交。构建时使用 TEST API、同一 appId、更高的资源构建号和新版本名称。
3. 执行下面的签发命令。脚本核验 APK 签名及包名，将冻结的基准目录与 APK 内置资源对照，再比较本次编译的原生模块、引擎文件与 manifest。资源包只收录可安装的前端资源。该版本每个产物只授权实际验证过的一个原生构建号。输出的 `.wgt` 和同名 `.json` 一起交付。

```powershell
./scripts/sign-test-resource.ps1 -HostApk $verifiedApk -HostSha256 $receiptSha256 `
  -HostResources $frozenHostWww -Resources $newWww -OutputDirectory $artifactDirectory `
  -Java $jdkJavaExe -ApkSignerJar $androidApkSignerJar -Aapt2 $androidAapt2Exe
```

4. 在本环境既有的 TEST 工件发布入口上传 `.wgt`。最终地址为 `https://api-test.uvel.ai/app-updates/android/<sha256>.wgt`。读回完整文件并核对 `.json` 中的大小、SHA-256 及签名，再将该 JSON 对应字段交给服务端 TEST 产物目录。后台保存、独立审批和发布之后，App 才会读取这个候选。
5. 在匹配的手机上核对下载、校验、重启以及重启后的实际资源版本。断网或签名、大小、摘要、appId、宿主构建校验失败时保留现有版本并允许重试。已安装的较高构建继续运行。应记录运行前后的宿主和资源构建，分开核对。

## 三星标准调试基座

标准调试基座的实际 Android 包名为 `io.dcloud.HBuilder`，运行 appId 为 `HBuilder`，原生构建号为 `1532`。该流程使用 5.32 编译器和这台三星已核验的标准基座 APK。基准项目资源来自正常的调试同步。先从已安装手机回读 `app-service.js` 的 SHA-256，核实它与冻结编译目录同名文件一致，再给上述命令传入 `-DebugDeviceJsSha256 $deviceResourceSha256`。签发工具同时核对已记录的标准 APK 摘要及签名证书，输出 manifest 的 id 固定为 `HBuilder`。客户端与 Java 同时匹配测试 API、应用身份及原生构建。在 `ai.uvel.app` 的 5.33 整包上，需要单独签发适用于该宿主的产物。

## 签名协议

UTF-8 编码以下九个字段，以单个 LF 相连，末尾没有换行。

```text
uvel-test-resource-v1
platform
appId
versionName
latestBuild
minNativeBuild
maxNativeBuild
sizeBytes
sha256
```

数字用十进制整数，摘要用小写十六进制。签名是 SHA-256 与 ECDSA P-256 的 IEEE P1363 格式，以 128 个小写十六进制字符传输。客户端在下载前验签，下载后在 App 私有目录按块计算 SHA-256，再使用 `plus.runtime.install` 并保留运行时版本校验。安装成功后用户选择重启。
