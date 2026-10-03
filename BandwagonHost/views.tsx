import { HStack, VStack, Text, Spacer, ProgressView, Button } from "scripting";
import type { DynamicShapeStyle } from "scripting";
import { RefreshWidgetIntent } from "./app_intents";
import { APIData, Result, Settings, calculateTraffic, calculateMemoryUsage, calculateDiskUsage, number, formatBytes, formatResetDate, daysUntilReset, formatLoad } from "./service";

// 由小组件的原生环境解析颜色，支持预览主题选择和系统自动切换。
const BACKGROUND: DynamicShapeStyle = { light: "#F6F7F9", dark: "#111318" };
const PRIMARY: DynamicShapeStyle = { light: "#171A21", dark: "white" };
const SECONDARY: DynamicShapeStyle = { light: "#687180", dark: "#8E8E93" };
const GREEN: DynamicShapeStyle = { light: "#168D38", dark: "#30D158" };
const ORANGE: DynamicShapeStyle = { light: "#A65B00", dark: "#FF9F0A" };
const RED: DynamicShapeStyle = { light: "#D92D20", dark: "#FF453A" };
type DisplaySize = { width: number; height: number };

function trafficInfo(data: APIData) {
  const traffic = calculateTraffic(data);
  const valid = number(data.data_counter) !== null && number(data.plan_monthly_data) !== null && traffic.totalBytes > 0;
  const used = number(data.data_counter) !== null ? formatBytes(traffic.usedBytes) : "--";
  const total = number(data.plan_monthly_data) !== null ? formatBytes(traffic.totalBytes) : "--";
  const exceeded = valid && traffic.usedBytes > traffic.totalBytes;
  const summary = used !== "--" && total !== "--" && used.split(" ")[1] === total.split(" ")[1]
    ? `${used.split(" ")[0]} / ${total}` : `${used} / ${total}`;
  return { ...traffic, valid, used, total, summary, exceeded,
    percentLabel: valid ? `${traffic.percent.toFixed(1)}%` : "--",
    remaining: valid ? exceeded ? `已超出 ${formatBytes(traffic.usedBytes - traffic.totalBytes)}`
      : `剩余 ${formatBytes(traffic.remainingBytes)}` : "剩余 --" };
}

function compactUsage(used: number | null, total: number | null, disabled = false) {
  if (total === 0 && disabled) return "未启用";
  const fmt = (value: number | null) => value === null ? "--" : String(Number((value / 1024 ** 3).toFixed(2)));
  return `${fmt(used)} / ${fmt(total)} GB`;
}

// RAM 已用为套餐总量减可用量的估算；Swap 使用接口的总量和剩余量。
function resourceInfo(data: APIData, config: Settings) {
  const memory = calculateMemoryUsage(data.plan_ram, data.mem_available_kb);
  const swapKB = number(data.swap_total_kb);
  const swapTotal = swapKB !== null ? Math.min(swapKB * 1024, Number.MAX_SAFE_INTEGER) : number(data.plan_swap);
  const swap = calculateMemoryUsage(swapTotal, data.swap_available_kb);
  const disk = calculateDiskUsage(data);
  const loads = formatLoad(data.load_average);
  const cores = Number.isSafeInteger(config.cpuCores) && config.cpuCores > 0 ? `${config.cpuCores} 核` : "-- 核";
  return {
    memoryCompact: compactUsage(memory.usedBytes, memory.totalBytes),
    swapCompact: compactUsage(swap.usedBytes, swap.totalBytes, true),
    diskCompact: compactUsage(disk.usedBytes, disk.totalBytes),
    cpu: loads ? loads.split(" / ")[0] : "--",
    cores,
    loads,
  };
}

export function createProgressBar(percent: number) {
  const value = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const color = value < 70 ? GREEN : value < 90 ? ORANGE : RED;
  return <ProgressView value={value} total={100} progressViewStyle="linear" tint={color} frame={{ height: 6 }} />;
}

function Footer({ result }: { result: Result }) {
  if (!result.cached && !result.warning) return null;
  const code = (result.error || result.warning)?.match(/API 错误 -?\d+/)?.[0];
  const message = result.cached ? `缓存数据${code ? ` · ${code}` : ""}`
    : code || (result.warning?.includes("实时") ? "实时信息不可用" : "缓存保存失败");
  return <HStack spacing={4} padding={{ top: 2 }}>
    <Text font={9} foregroundStyle={ORANGE} lineLimit={1}>{message}</Text>
    <Spacer minLength={0} />
    {result.cached ? <Text font={9} foregroundStyle={SECONDARY}>Cached</Text> : null}
  </HStack>;
}

function Traffic({ data, small = false, large = false, compact = false }: {
  data: APIData; small?: boolean; large?: boolean; compact?: boolean;
}) {
  const traffic = trafficInfo(data);
  return <VStack alignment="leading" spacing={small ? 3 : compact ? 4 : 6}>
    {small || large || !compact ? <HStack spacing={5}>
      <Text font={small ? 11 : 12} foregroundStyle={SECONDARY}>流量</Text>
      <Spacer minLength={0} />
      <Text font={small ? 14 : 15} fontWeight="semibold" monospacedDigit
        foregroundStyle={traffic.exceeded ? RED : PRIMARY}>
        {small && traffic.exceeded ? `${traffic.percentLabel} 已超出` : traffic.percentLabel}
      </Text>
    </HStack> : null}
    <HStack alignment="firstTextBaseline" spacing={6}>
      {small ? <Text font={19} fontWeight="semibold" monospacedDigit lineLimit={1} minScaleFactor={0.75}
        frame={{ maxWidth: "infinity", alignment: "leading" }}>{traffic.used}</Text>
        : <Text font={large ? 30 : compact ? 23 : 26} fontWeight="semibold"
          monospacedDigit lineLimit={1} minScaleFactor={0.8}>{traffic.summary}</Text>}
      {small ? <Text font={10} foregroundStyle={SECONDARY} monospacedDigit lineLimit={1}
        minScaleFactor={0.8}>{`/ ${traffic.total}`}</Text> : null}
      {!small && !large && compact ? <Spacer minLength={0} /> : null}
      {!small && !large && compact ? <Text font={13} fontWeight="semibold" monospacedDigit>{traffic.percentLabel}</Text> : null}
    </HStack>
    {createProgressBar(traffic.valid ? traffic.percent : 0)}
    {!small ? <HStack spacing={6}>
      <Text font={11} foregroundStyle={traffic.exceeded ? RED : SECONDARY} lineLimit={1}>{traffic.remaining}</Text>
      <Spacer minLength={0} />
      <Text font={11} foregroundStyle={SECONDARY} lineLimit={1}>{daysUntilReset(data.data_next_reset)}</Text>
    </HStack> : null}
  </VStack>;
}

type ResourceRowData = { label: string; value: string };

function resourceRows(data: APIData, config: Settings): ResourceRowData[] {
  const resources = resourceInfo(data, config);
  return [
    { label: "CPU", value: `负载 ${resources.cpu} · ${resources.cores}` },
    { label: "内存", value: resources.memoryCompact },
    { label: "Swap", value: resources.swapCompact },
    { label: "硬盘", value: resources.diskCompact },
  ];
}

function ResourceRow({ row, large = false }: { row: ResourceRowData; large?: boolean }) {
  return <HStack alignment="firstTextBaseline" spacing={6}
    frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <Text font={large ? 12 : 10} foregroundStyle={SECONDARY}
      lineLimit={1} minScaleFactor={0.9}
      frame={{ width: large ? 44 : 34, alignment: "leading" }}>{row.label}</Text>
    <Text font={large ? 15 : 11} fontWeight="medium" monospacedDigit lineLimit={1} minScaleFactor={0.85}
      frame={{ maxWidth: "infinity", alignment: "trailing" }}>{row.value}</Text>
  </HStack>;
}

export function createSmallWidget(config: Settings, result: Result) {
  const data = result.data || {};
  return <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <VStack alignment="leading" spacing={3}>
      <Traffic data={data} small />
      <HStack spacing={4}>
        <Text font={9} foregroundStyle={SECONDARY}>重置</Text>
        <Spacer minLength={0} />
        <Text font={9} foregroundStyle={SECONDARY} lineLimit={1}>{formatResetDate(data.data_next_reset)}</Text>
      </HStack>
    </VStack>
    <VStack spacing={3} padding={{ top: 2 }}>
      {resourceRows(data, config).map(row => <ResourceRow key={row.label} row={row} />)}
    </VStack>
    <Footer result={result} />
  </VStack>;
}

export function createMediumWidget(config: Settings, result: Result, _size: DisplaySize) {
  const data = result.data || {};
  const rows = resourceRows(data, config);
  return <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    <Traffic data={data} compact />
    <Spacer minLength={7} />
    {/* 中号采用两行两列，避免四个窄列挤压单位和总量。 */}
    <VStack spacing={7}>
      <HStack spacing={18}>
        <ResourceRow row={rows[0]} />
        <ResourceRow row={rows[1]} />
      </HStack>
      <HStack spacing={18}>
        <ResourceRow row={rows[2]} />
        <ResourceRow row={rows[3]} />
      </HStack>
    </VStack>
    <Footer result={result} />
  </VStack>;
}

export function createLargeWidget(config: Settings, result: Result) {
  const data = result.data || {};
  const resources = resourceInfo(data, config);
  return <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    <Traffic data={data} large />
    <Spacer minLength={12} />
    <VStack spacing={14}>
      {resourceRows(data, config).map(row => <ResourceRow key={row.label} row={row} large />)}
    </VStack>
    <Text font={10} foregroundStyle={SECONDARY} lineLimit={1} padding={{ top: 8 }}>
      {`CPU 1 / 5 / 15 分钟：${resources.loads || "--"}`}
    </Text>
    <Footer result={result} />
  </VStack>;
}

export function createErrorWidget(config: Settings, message: string, unconfigured = false) {
  return <VStack alignment="leading" spacing={7}>
    <Text font={14} fontWeight="semibold" lineLimit={1}>{config.name}</Text>
    <Text font={14} foregroundStyle={ORANGE}>{unconfigured ? "未配置 API" : "服务信息不可用"}</Text>
    <Text font={11} foregroundStyle={SECONDARY} lineLimit={4}>
      {unconfigured ? "请在 Scripting 中运行一次脚本完成配置" : message}
    </Text>
  </VStack>;
}

export function createWidget(config: Settings, result: Result, family: string, unconfigured = false,
  size: DisplaySize = { width: 338, height: 158 }) {
  const content = unconfigured || !result.data ? createErrorWidget(config, result.error || "请求失败", unconfigured)
    : family === "systemSmall" ? createSmallWidget(config, result)
      : family === "systemLarge" || family === "systemExtraLarge" ? createLargeWidget(config, result)
        : createMediumWidget(config, result, size);
  return <Button intent={RefreshWidgetIntent(undefined)} buttonStyle="plain"
    accessibilityLabel="刷新 VPS 数据"
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
    <VStack alignment="leading" spacing={0} foregroundStyle={PRIMARY}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      contentShape="rect" widgetBackground={BACKGROUND}>
      {/* 整张卡片作为后台刷新按钮，显式留出圆角安全区域。 */}
      <VStack alignment="leading" spacing={0} padding={12}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
        {content}
      </VStack>
    </VStack>
  </Button>;
}
