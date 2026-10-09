# BandwagonHost — Scripting 小组件 1.2.2

只显示流量、内存、Swap、硬盘和 CPU，支持小号、中号、大号。

## 安装

1. 在 iPhone 用 Scripting 打开 BandwagonHost.scripting 并导入。
2. 运行项目，在设置引导页查看参数获取步骤，点击“配置 API”输入 VEID、API Key；默认存入此脚本的 Keychain，保存后自动查询并预览。
3. 添加 Scripting 桌面小组件，选择 BandwagonHost。
4. 再次运行项目进入设置页，可刷新、预览三种尺寸、修改凭据或 CPU 核数。

## 显示内容

- 流量：已用 / 额度、百分比、进度条；中号和大号同时显示剩余量及重置倒计时。
- 内存：估算已用量 / 套餐总容量，界面不额外标注估算符号。计算为 plan_ram - mem_available_kb × 1024；与系统面板的实际总内存和已用口径可能不同，缺少字段或可用量超出总量时显示 --。
- Swap：已用量 / 总容量；优先使用 swap_total_kb 和 swap_available_kb，缺少实时总量时回退 plan_swap；总量为零显示未启用。
- 硬盘：显示 ve_used_disk_space_b / 总容量，优先 ve_disk_quota_gb，回退 plan_disk。前者为 KVM 映射磁盘占用，不等同于 Linux / 分区文件系统的已用空间；接口未返回用量时显示 --。
- CPU：显示总核心数和 load_average。核心数可在 App 的“设置 CPU 核心数”中填写，或通过 CONFIG.cpuCores 设置；未配置显示 -- 核。小号、中号显示 1 分钟负载，大号显示 1 / 5 / 15 分钟负载。负载不是 CPU 使用率百分比。
- 不显示服务器名称、运行状态、IP、节点、机房、套餐等附加信息。
- 请求失败回退缓存，并保留必要的缓存 / 实时信息不可用提示；缺失指标显示 --。

## 配置和安全

config.ts 包含 CONFIG / DEBUG。默认不要将真实 API Key 写入源码。
网络仅调用 getServiceInfo / getLiveServiceInfo，每次超时 10 秒。
useLiveInfo=false 时不请求实时接口，内存和 CPU 的实时指标可能不可用。
缓存存入 FileManager.appGroupDocumentsDirectory/BandwagonHost/bandwagon_widget_cache.json，
不保存密钥；通过 ownerVeid 隔离 VPS；缓存不会主动过期删除。
流量额度和计数器同时乘 monthly_data_multiplier，无效倍率按 1。
百分比限制 0–100；超额显示已超出。MB/GB/TB 按 1024 换算。
点击整张组件通过普通 AppIntent 在后台调用 Widget.reloadAll()，由 widget.tsx 重新查询 API、更新缓存并渲染，不打开 Scripting 设置页。需要配置时，请在 Scripting 内运行本项目。交互式组件要求 iOS 17 或更新系统及支持 AppIntent 的 Scripting 版本；实际更新时间由 iOS 调度，默认请求 30 分钟后自动刷新。

项目全部使用 Scripting TS/TSX 和原生 API，包括原生 fetch；无 Node.js 依赖。
凭据只发往 api.64clouds.com，不实现任何 VPS 写操作。
脚本日志不打印密钥或完整 URL；分享 Scripting 平台网络日志前检查其自动记录内容。
已通过同步声明的严格类型检查和模拟测试；实际桌面布局仍需在 iPhone 确认。

1.0.4：显式 12pt 内容边距，修复圆角裁切；小号取消撑开高度的 Spacer，流量用量与额度采用独立字号。

1.0.4：所有尺寸加入内存总容量、硬盘总容量和手动配置的 CPU 总核数。

1.0.5：三种尺寸加入 Swap；RAM 标明估算已用，保留缺失字段的安全降级。

1.0.6：内存、Swap、硬盘统一 GB，资源标签和值统一对齐；小号四行、中号两行两列、大号四行。RAM 使用总量减可用量计算。

1.0.7：资源容量统一显示 GB，四舍五入至两位小数，去掉多余零和估算符号。

1.0.8：新增亮色主题；背景、主文字、次要文字、进度条与错误提示使用原生动态颜色。预览的主题选择浅色或深色，也可跟随系统。

1.0.9：小号增加流量重置日期；无有效时间戳时显示 --。

1.0.10：小号将重置日期并入流量区，资源顺序统一为 CPU、内存、Swap、硬盘；加宽标签列以显示完整 Swap。

1.1.0：点击组件刷新；新增原生设置引导页、参数获取说明、CPU 设置与三种尺寸预览。

1.1.1：发布前凭据检查；加入只读接口运行时白名单和缓存写入字段过滤。安全审查范围见 SECURITY.md。

1.2.0：将组件点击从打开脚本改为 AppIntent 后台刷新；设置页仍通过 Scripting 内运行项目打开。

1.2.1：脚本卡片增加中文名称“搬瓦工监控”、蓝色配色与用量图标；内部项目名仍为 BandwagonHost，设置页使用本地化标题。

1.2.2：三种尺寸底部显示上次成功查询时间；缓存保留原始时间，非当天数据显示月/日和时间，无有效时间显示 --。
