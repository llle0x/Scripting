# 灵动岛秒数

将 IslandSeconds.scripting 导入 Scripting，运行一次即可启动；再次运行可停止或重新对时。

1.0.1：重新对时直接更新当前活动，失败时保留活动及其 ID，不再先停止再重建。

使用系统 DateLabel 的 timer 样式，以前一个整分钟为起点计时，裁切显示末尾两位秒数（00–59），与设备时间的秒数对齐。脚本启动活动后退出，无每秒 JS 更新、无后台保活、无网络请求。只在脚本私有 Storage 保存本活动 ID 和计时起点。

紧凑态左侧宽 19 pt，字号 15 pt，右侧空白，无图标和单位。iOS 决定岛的整体宽度和紧凑/最小/展开状态，无法强制消除系统留白或始终占据左侧。多活动时最小态的位置也由系统选择。

两位数字是对系统计时文字的视觉裁切，并非官方秒数格式。已在 iPhone 上确认未裁切计时文字可以显示；已改为内部 120 pt 右对齐、外部裁切，20 pt 版本已获用户确认正常；现进一步改为 19 pt（字号 15 pt），效果待确认。请检查 09→10、59→00、跨小时及锁屏后返回；若边缘裁切不理想，微调 live_activity.tsx 的 19 pt 宽度。系统可能限制锁屏/息屏刷新和活动持续时间，不能保证永久逐秒显示。系统改时后可重新对时。

官方参考：
- https://scriptingapp.github.io/guide/LiveActivity.md
- https://scriptingapp.github.io/guide/Views/Time-based%20label%20views.md
- https://scriptingapp.github.io/guide/View%20Modifiers/fixedSize.md
- https://scriptingapp.github.io/guide/View%20Modifiers/clipped.md

2026-09-19 已连接 Scripting 真机调试，按 App 同步声明修正全局 Dialog/Storage 和异步 LiveActivity.from，用 activityId 保存本活动 ID。完整 TypeScript 检查通过；手机执行日志确认 Live Activity started; state=active。真机截图确认原生计时文字正常显示。移除 fixedSize，改用显式宽度与文字右对齐后，手机日志确认布局 update=true；20 pt 两位秒数裁切已获用户确认正常，现测试字号 15 pt、宽度 19 pt 版本。
