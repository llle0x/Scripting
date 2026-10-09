// 凭据默认保存在 Scripting Keychain；这里只保留可选的手动配置入口。
export const CONFIG = {
  veid: "",
  apiKey: "",
  name: "BandwagonHost",
  refreshMinutes: 30,
  widgetStyle: "minimal", // 可在设置页切换四种风格。
  useLiveInfo: true,
  cpuCores: 2, // 默认 2 个 vCPU；请在设置页填写自己 VPS 的核数。
};

export const DEBUG = false;
