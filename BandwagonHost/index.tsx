import { Script, Widget, Navigation, NavigationStack, List, Section, Button, Link, Text, useState } from "scripting";
import { loadConfig, hasCredentials, loadData, Settings } from "./service";

export async function setupCredentials(config: Settings): Promise<boolean> {
  const confirm = await Dialog.confirm({
    title: hasCredentials(config) ? "修改 BandwagonHost API" : "尚未配置 BandwagonHost API",
    message: "凭据保存在此脚本的 Scripting Keychain，仅调用 KiwiVM 只读查询接口。",
    confirmLabel: "配置 API", cancelLabel: "取消",
  });
  if (!confirm) return false;
  const veid = await Dialog.prompt({ title: "输入 VEID", defaultValue: config.veid,
    confirmLabel: "下一步", cancelLabel: "取消" });
  if (veid === null) return false;
  if (!/^\d+$/.test(veid.trim())) {
    await Dialog.alert({ title: "VEID 无效", message: "请输入纯数字 VPS ID。" });
    return false;
  }
  const apiKey = await Dialog.prompt({ title: "输入 API Key", obscureText: true,
    confirmLabel: "保存", cancelLabel: "取消" });
  if (apiKey === null) return false;
  if (!apiKey.trim()) {
    await Dialog.alert({ title: "API Key 为空", message: "请输入 KiwiVM API Key。" });
    return false;
  }
  const oldVeid = Keychain.get("BWH_VEID");
  const oldKey = Keychain.get("BWH_API_KEY");
  // 两个键都保存成功才继续；部分失败时恢复旧配置。
  if (!Keychain.set("BWH_VEID", veid.trim()) || !Keychain.set("BWH_API_KEY", apiKey.trim())) {
    oldVeid === null ? Keychain.remove("BWH_VEID") : Keychain.set("BWH_VEID", oldVeid);
    oldKey === null ? Keychain.remove("BWH_API_KEY") : Keychain.set("BWH_API_KEY", oldKey);
    await Dialog.alert({ title: "保存失败", message: "无法保存到 Keychain，请解锁设备后重试。" });
    return false;
  }
  return true;
}

// 刷新先保存共享缓存，再向 iOS 提交 Widget 更新请求。
async function refreshData(config: Settings): Promise<string> {
  if (!hasCredentials(config)) return "请先配置 VEID 和 API Key。";
  const result = await loadData(config);
  Widget.reloadAll();
  if (result.cached) return `刷新失败，继续使用缓存。${result.error || ""}`;
  if (!result.data) return result.error || "查询失败，请检查配置和网络。";
  const time = new Date(result.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return `数据已更新 · ${time}${result.warning ? `\n${result.warning}` : ""}`;
}

function SettingsPage({ initialStatus }: { initialStatus: string }) {
  const dismiss = Navigation.useDismiss();
  const [config, setConfig] = useState(loadConfig());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await task(); }
    catch {
      // 不展示原始异常，避免系统网络错误携带凭据 URL。
      setStatus("操作失败，请检查网络和 Scripting 权限后重试。");
    } finally { setBusy(false); }
  }

  async function configure() {
    if (!await setupCredentials(loadConfig())) return;
    const next = loadConfig();
    setConfig(next);
    setStatus("正在获取服务数据…");
    setStatus(await refreshData(next));
    // 保存配置后自动查询并进入中号预览。
    await Widget.preview({ family: "systemMedium" });
  }

  async function configureCPU() {
    const value = await Dialog.prompt({ title: "CPU 总核心数",
      message: "填写套餐的 vCPU 数量，或通过 SSH 执行 nproc 查看。",
      defaultValue: String(config.cpuCores || ""), confirmLabel: "保存", cancelLabel: "取消" });
    if (value === null) return;
    const cores = Number(value.trim());
    if (!Number.isSafeInteger(cores) || cores <= 0) {
      await Dialog.alert({ title: "核数无效", message: "请输入正整数，例如 2。" });
      return;
    }
    if (!Keychain.set("BWH_CPU_CORES", String(cores))) {
      await Dialog.alert({ title: "保存失败", message: "请解锁设备后重试。" });
      return;
    }
    setConfig(loadConfig());
    Widget.reloadAll();
    setStatus(`CPU 总核心数已保存：${cores} 核`);
  }

  const ready = hasCredentials(config);
  return <NavigationStack>
    <List listStyle="insetGroup" navigationTitle="BandwagonHost"
      navigationBarTitleDisplayMode="inline"
      toolbar={{ cancellationAction: <Button title="完成" action={dismiss} disabled={busy} /> }}>
      <Section header={<Text>配置与刷新</Text>}
        footer={<Text>点击桌面组件会打开 Scripting 并刷新数据。桌面显示的更新时间由 iOS 调度。</Text>}>
        <Text>{ready ? "API 已配置 · 密钥已隐藏" : "尚未配置 API"}</Text>
        <Text>{status}</Text>
        <Button title={ready ? "修改 API 配置" : "配置 API"} systemImage="key"
          action={() => { void perform(configure); }} disabled={busy} />
        <Button title={busy ? "正在处理…" : "立即刷新"} systemImage="arrow.clockwise"
          disabled={busy || !ready} action={() => { void perform(async () => {
            setStatus("正在获取服务数据…");
            setStatus(await refreshData(loadConfig()));
          }); }} />
        <Button title={`CPU 核心数 · ${config.cpuCores || "--"} 核`} systemImage="cpu"
          action={() => { void perform(configureCPU); }} disabled={busy} />
      </Section>
      <Section header={<Text>获取搬瓦工参数</Text>}
        footer={<Text>只需 VEID、API Key 和 CPU 核数。内存、Swap、硬盘及流量数据自动查询。API Key 请仅输入本机配置框，不要分享。</Text>}>
        <Text>1. 登录搬瓦工客户中心，找到需要查看的 VPS，进入它的 KiwiVM 控制面板。</Text>
        <Link url="https://bandwagonhost.com/clientarea.php"><Text>打开搬瓦工客户中心</Text></Link>
        <Text>2. 在 KiwiVM 左侧进入 API 页面，复制该 VPS 的 VEID（纯数字）。</Text>
        <Text>3. 在同一页面点击 Show API Key，复制 API Key，回到本页点击“配置 API”。</Text>
        <Link url="https://kiwivm.64clouds.com/"><Text>打开 KiwiVM 面板</Text></Link>
        <Text>4. CPU 核数填写套餐的 vCPU 数量；也可登录 VPS，通过 SSH 执行 nproc。当前设置见上方“CPU 核心数”，可随时修改。</Text>
      </Section>
      <Section header={<Text>组件预览</Text>}
        footer={<Text>在预览页面切换亮色 / 深色主题。预览为 App 内效果，桌面布局以实际小组件为准。</Text>}>
        <Button title="小号 · 紧凑指标与重置日期" systemImage="square"
          action={() => { void perform(async () => { await Widget.preview({ family: "systemSmall" }); }); }} disabled={busy} />
        <Button title="中号 · 流量与资源概览" systemImage="rectangle"
          action={() => { void perform(async () => { await Widget.preview({ family: "systemMedium" }); }); }} disabled={busy} />
        <Button title="大号 · 完整指标" systemImage="rectangle.portrait"
          action={() => { void perform(async () => { await Widget.preview({ family: "systemLarge" }); }); }} disabled={busy} />
      </Section>
      <Section header={<Text>添加到 iPhone 桌面</Text>}>
        <Text>长按桌面进入编辑，添加 Scripting 小组件，选择尺寸，再编辑小组件并选择 BandwagonHost 项目。</Text>
      </Section>
    </List>
  </NavigationStack>;
}

async function main() {
  // Widget 的链接只携带操作名；不会将 VEID 或密钥放入 URL。
  const config = loadConfig();
  const status = Script.queryParameters.action === "refresh" && hasCredentials(config)
    ? await refreshData(config)
    : hasCredentials(config) ? "已准备好，可刷新数据或预览组件。" : "按下方步骤获取参数，然后配置 API。";
  await Navigation.present({ element: <SettingsPage initialStatus={status} /> });
}

// Scripting 入口以普通脚本执行，避免使用顶层 await。
main()
  .catch(async () => {
    await Dialog.alert({ title: "运行失败", message: "请检查 Scripting 版本、Keychain 和网络访问权限后重试。" });
  })
  .finally(() => Script.exit());
