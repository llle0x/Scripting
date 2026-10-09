# 安全说明

2026-10-03，版本 1.3.0。审查范围为本目录源码及 BandwagonHost.scripting 导入包。

- 发布版 config.ts 的 veid / apiKey 均为空，无真实凭据。配置时 API Key 使用隐藏输入，保存至 Scripting Keychain，优先读取 Keychain。
- 仅请求 https://api.64clouds.com/v1/ 的 getServiceInfo / getLiveServiceInfo；运行时白名单拒绝其他接口。请求 10 秒超时，禁止跟随重定向。无重启、停止、重装等操作。
- 凭据通过 HTTPS 查询参数发给搬瓦工 API。组件刷新使用无参数的 AppIntent，不携带凭据或打开页面；兼容旧版 action=refresh 链接，但链接亦不携带凭据。
- 脚本不输出密钥、完整请求 URL 或原始网络异常；API 错误信息会清除密钥及 URL。DEBUG 默认关闭。
- 共享缓存只保存字段白名单中的服务器指标和所属 VEID，不保存密钥。缓存包含 IP / 主机名等服务器信息，应留在本机，勿上传。
- 发布内容按明确文件列表打包，不包含手机 Keychain、本地缓存、调试目录或日志。

## 使用者注意

保持源码中的凭据为空，通过设置页配置。如果自行将密钥写入源码，不要提交或分享该文件及导入包。API Key 具有 KiwiVM 赋予的权限；本项目仅实现只读操作，并不会将密钥本身变成只读密钥。

Scripting 平台的网络检查器可能记录请求 URL；本项目无法控制宿主 App 的日志。分享网络日志或截图前自行检查并移除凭据。

## 验证边界

已执行源码与导入包凭据扫描、严格 TypeScript 检查和模拟请求 / 缓存 / 错误处理测试。这是有限范围的代码审查，不是对 iOS Keychain、宿主 App 或搬瓦工服务的安全认证。审查不读取用户手机中的实际密钥。

风格选择为本机 Keychain 的 BWH_WIDGET_STYLE（非敏感设置），仅保存预定义风格 ID；读取时按白名单验证，无效值回退极简列表。
