import { HStack, VStack, Text, Spacer, ProgressView, Button, Circle, ZStack } from "scripting";
import type { DynamicShapeStyle } from "scripting";
import { normalizeWidgetStyle } from "./styles";
import { RefreshWidgetIntent } from "./app_intents";
import { APIData, Result, Settings, calculateTraffic, calculateMemoryUsage, calculateDiskUsage, number, formatBytes, formatResetDate, daysUntilReset, formatUpdateTime, formatLoad } from "./service";

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

export function createProgressBar(percent: number, accent: DynamicShapeStyle = GREEN) {
  const value = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const color = value < 70 ? accent : value < 90 ? ORANGE : RED;
  return <ProgressView value={value} total={100} progressViewStyle="linear" tint={color} frame={{ height: 6 }} />;
}

function Footer({ result, compact = false }: { result: Result; compact?: boolean }) {
  const code = (result.error || result.warning)?.match(/API 错误 -?\d+/)?.[0];
  const message = result.cached ? `缓存数据${code ? ` · ${code}` : ""}`
    : result.warning ? code || (result.warning.includes("实时") ? "实时信息不可用" : "缓存保存失败") : "";
  if (compact) return <HStack spacing={3} padding={{ top: 1 }}>
    <Text font={8} foregroundStyle={SECONDARY} monospacedDigit lineLimit={1} minScaleFactor={0.8}>
      {`更新 ${formatUpdateTime(result.timestamp)}`}
    </Text>
    <Spacer minLength={0} />
    {message ? <Text font={8} foregroundStyle={ORANGE} lineLimit={1}>
      {result.cached ? "Cached" : result.warning?.includes("实时") ? "实时缺失" : "缓存失败"}
    </Text> : null}
  </HStack>;
  return <VStack spacing={2} padding={{ top: 2 }}>
    {message ? <HStack spacing={4}>
      <Text font={9} foregroundStyle={ORANGE} lineLimit={1}>{message}</Text>
      <Spacer minLength={0} />
      {result.cached ? <Text font={9} foregroundStyle={SECONDARY}>Cached</Text> : null}
    </HStack> : null}
    <HStack spacing={4}>
      <Text font={9} foregroundStyle={SECONDARY}>更新</Text>
      <Spacer minLength={0} />
      <Text font={9} foregroundStyle={SECONDARY} monospacedDigit lineLimit={1}>
        {formatUpdateTime(result.timestamp)}
      </Text>
    </HStack>
  </VStack>;
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
    <Footer result={result} compact />
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

// 风格仅改变排版和配色，统一复用真实 API 指标及缓存处理。
const TILE_BACKGROUND: DynamicShapeStyle = { light: "#EDF1F6", dark: "#20252E" };
const TRACK: DynamicShapeStyle = { light: "#DEE3E9", dark: "#2A303A" };
const BLUE: DynamicShapeStyle = { light: "#2563EB", dark: "#6DA6FF" };
const CYAN: DynamicShapeStyle = { light: "#027C91", dark: "#53D1E6" };
const AMBER: DynamicShapeStyle = { light: "#B35E00", dark: "#EEB666" };

function styleBackground(style: string): DynamicShapeStyle {
  return style === "dashboard" ? { light: "#FFFFFF", dark: "#141922" }
    : style === "ring" ? { light: "#F4FAFB", dark: "#102027" }
      : style === "focus" ? { light: "#F7F5F0", dark: "#1B1915" } : BACKGROUND;
}

function ResetLine({ data }: { data: APIData }) {
  return <HStack spacing={4}>
    <Text font={9} foregroundStyle={SECONDARY}>重置</Text>
    <Spacer minLength={0} />
    <Text font={9} foregroundStyle={SECONDARY} lineLimit={1}>{formatResetDate(data.data_next_reset)}</Text>
  </HStack>;
}

function MetricTile({ row, small, large }: { row: ResourceRowData; small: boolean; large: boolean }) {
  // 两行分离指标名称和值，适应小号宽度，不省略总容量。
  return <VStack alignment="leading" spacing={2} padding={small ? 4 : 7}
    frame={{ maxWidth: "infinity", alignment: "leading" }}
    background={{ style: TILE_BACKGROUND, shape: { type: "rect", cornerRadius: 8 } }}>
    <Text font={small ? 8 : 10} foregroundStyle={SECONDARY}>{row.label}</Text>
    <Text font={small ? 9 : large ? 14 : 11} fontWeight="medium" monospacedDigit
      lineLimit={1} minScaleFactor={0.7}>{row.value}</Text>
  </VStack>;
}

function ResourceTiles({ config, data, small, large }: {
  config: Settings; data: APIData; small: boolean; large: boolean;
}) {
  const rows = resourceRows(data, config);
  return <VStack spacing={small ? 4 : 7}>
    <HStack spacing={small ? 4 : 7}>
      <MetricTile row={rows[0]} small={small} large={large} />
      <MetricTile row={rows[1]} small={small} large={large} />
    </HStack>
    <HStack spacing={small ? 4 : 7}>
      <MetricTile row={rows[2]} small={small} large={large} />
      <MetricTile row={rows[3]} small={small} large={large} />
    </HStack>
  </VStack>;
}

function ResourceList({ config, data, large, small = false }: { config: Settings; data: APIData; large: boolean; small?: boolean }) {
  return <VStack spacing={large ? 13 : 3}>
    {resourceRows(data, config).map(row => small ? <HStack key={row.label} spacing={4}>
      <Text font={9} foregroundStyle={SECONDARY} frame={{ width: 30, alignment: "leading" }}>{row.label}</Text>
      <Text font={10} fontWeight="medium" monospacedDigit lineLimit={1} minScaleFactor={0.8}
        frame={{ maxWidth: "infinity", alignment: "trailing" }}>{row.value}</Text>
    </HStack> : <ResourceRow key={row.label} row={row} large={large} />)}
  </VStack>;
}

function ResourceGrid({ config, data }: { config: Settings; data: APIData }) {
  const rows = resourceRows(data, config);
  return <VStack spacing={7}>
    <HStack spacing={16}><ResourceRow row={rows[0]} /><ResourceRow row={rows[1]} /></HStack>
    <HStack spacing={16}><ResourceRow row={rows[2]} /><ResourceRow row={rows[3]} /></HStack>
  </VStack>;
}

function TrafficRing({ data, small }: { data: APIData; small: boolean }) {
  const traffic = trafficInfo(data);
  const value = traffic.valid ? traffic.percent : 0;
  const color = value < 70 ? CYAN : value < 90 ? ORANGE : RED;
  const diameter = small ? 38 : 74;
  return <ZStack frame={{ width: diameter, height: diameter }}>
    <Circle stroke={{ shapeStyle: TRACK, strokeStyle: { lineWidth: 4 } }} padding={3} />
    {value > 0 ? <Circle trim={{ from: 0, to: value / 100 }}
      stroke={{ shapeStyle: color, strokeStyle: { lineWidth: 4, lineCap: "round" } }}
      rotationEffect={-90} padding={3} /> : null}
    <Text font={small ? 10 : 15} fontWeight="semibold" monospacedDigit
      minScaleFactor={0.8} lineLimit={1}>{traffic.percentLabel}</Text>
  </ZStack>;
}

function StyledTraffic({ data, small, large, style }: {
  data: APIData; small: boolean; large: boolean; style: string;
}) {
  const traffic = trafficInfo(data);
  const usedParts = traffic.used.split(" ");
  if (style === "ring") return <VStack alignment="leading" spacing={4}>
    <HStack spacing={small ? 8 : 13}>
      <TrafficRing data={data} small={small} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {!small ? <Text font={11} foregroundStyle={SECONDARY}>本月流量</Text> : null}
        <Text font={small ? 14 : large ? 26 : 22} fontWeight="semibold" monospacedDigit
          lineLimit={1} minScaleFactor={0.7}>{traffic.used}</Text>
        <Text font={small ? 9 : 11} foregroundStyle={SECONDARY} lineLimit={1}>{`/ ${traffic.total}${traffic.exceeded ? " · 已超出" : ""}`}</Text>
      </VStack>
    </HStack>
    <ResetLine data={data} />
    {!small ? <Text font={11} foregroundStyle={traffic.exceeded ? RED : SECONDARY}>{traffic.remaining}</Text> : null}
  </VStack>;
  return <VStack alignment="leading" spacing={small ? 2 : 4}>
    {!(small && style === "focus") ? <HStack spacing={5}>
      <Text font={small ? 9 : 11} foregroundStyle={SECONDARY}>本月流量</Text>
      <Spacer minLength={0} />
      <Text font={small ? 11 : 14} fontWeight="semibold" monospacedDigit>{traffic.percentLabel}</Text>
    </HStack> : null}
    {style === "focus" ? <VStack alignment="leading" spacing={0}>
      <HStack alignment="firstTextBaseline" spacing={4}>
        <Text font={small ? 25 : large ? 46 : 36} fontWeight="semibold" monospacedDigit
          lineLimit={1} minScaleFactor={0.7}>{traffic.used === "--" ? "--" : usedParts[0]}</Text>
        {small ? <Text font={10} foregroundStyle={SECONDARY} monospacedDigit>{traffic.percentLabel}</Text> : null}
      </HStack>
      <Text font={small ? 9 : 11} foregroundStyle={SECONDARY} lineLimit={1} minScaleFactor={0.8}>
        {traffic.used === "--" ? `已用 -- / ${traffic.total}` : `${usedParts[1]} / ${traffic.total}`}
      </Text>
    </VStack> : <Text font={small ? 17 : large ? 28 : 23} fontWeight="semibold" monospacedDigit
      lineLimit={1} minScaleFactor={0.7}>{traffic.summary}</Text>}
    {createProgressBar(traffic.valid ? traffic.percent : 0, style === "focus" ? AMBER : BLUE)}
    <ResetLine data={data} />
    {!small ? <Text font={11} foregroundStyle={traffic.exceeded ? RED : SECONDARY}>{traffic.remaining}</Text> : null}
    {small && traffic.exceeded ? <Text font={8} foregroundStyle={RED} lineLimit={1}>已超出</Text> : null}
  </VStack>;
}

function StyledWidget({ config, result, family }: { config: Settings; result: Result; family: string }) {
  const small = family === "systemSmall";
  const large = family === "systemLarge" || family === "systemExtraLarge";
  const style = normalizeWidgetStyle(config.widgetStyle);
  const data = result.data || {};
  const resources = style === "dashboard" ? <ResourceTiles config={config} data={data} small={small} large={large} />
    : small || large ? <ResourceList config={config} data={data} large={large} small={small} />
      : <ResourceGrid config={config} data={data} />;
  // 数字焦点中号：左右分区；小号仍纵向排列以保证数字不裁切。
  return <VStack alignment="leading" spacing={small ? 3 : 6}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    {style === "focus" && !small && !large ? <HStack alignment="top" spacing={16}>
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <StyledTraffic data={data} small={false} large={false} style={style} />
      </VStack>
      <VStack spacing={8} padding={{ top: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <ResourceList config={config} data={data} large={false} />
      </VStack>
    </HStack> : <VStack alignment="leading" spacing={small ? 3 : 8}>
      <StyledTraffic data={data} small={small} large={large} style={style} />
      {large ? <Spacer minLength={12} /> : null}
      {resources}
    </VStack>}
    {!small ? <Spacer minLength={0} /> : null}
    {large ? <Text font={10} foregroundStyle={SECONDARY} lineLimit={1}>
      {`CPU 1 / 5 / 15 分钟：${formatLoad(data.load_average) || "--"}`}
    </Text> : null}
    <Footer result={result} compact={small} />
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
    : normalizeWidgetStyle(config.widgetStyle) !== "minimal" ? <StyledWidget config={config} result={result} family={family} />
      : family === "systemSmall" ? createSmallWidget(config, result)
      : family === "systemLarge" || family === "systemExtraLarge" ? createLargeWidget(config, result)
        : createMediumWidget(config, result, size);
  return <Button intent={RefreshWidgetIntent(undefined)} buttonStyle="plain"
    accessibilityLabel="刷新 VPS 数据"
    frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
    <VStack alignment="leading" spacing={0} foregroundStyle={PRIMARY}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      contentShape="rect" widgetBackground={styleBackground(normalizeWidgetStyle(config.widgetStyle))}>
      {/* 整张卡片作为后台刷新按钮，显式留出圆角安全区域。 */}
      <VStack alignment="leading" spacing={0} padding={12}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
        {content}
      </VStack>
    </VStack>
  </Button>;
}
