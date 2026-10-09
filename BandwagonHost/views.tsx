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
  // 已用和总量分别保留单位，避免独立数字的含义不明确。
  const summary = `${used} / ${total}`;
  return { ...traffic, valid, used, total, summary, exceeded,
    percentLabel: valid ? `${traffic.percent.toFixed(1)}%` : "--",
    remaining: valid ? exceeded ? `已超出 ${formatBytes(traffic.usedBytes - traffic.totalBytes)}`
      : `剩余 ${formatBytes(traffic.remainingBytes)}` : "剩余 --" };
}

function compactUsage(used: number | null, total: number | null, disabled = false) {
  if (total === 0 && disabled) return "未启用";
  const fmt = (value: number | null) => value === null ? "--" : String(Number((value / 1024 ** 3).toFixed(2)));
  return `${fmt(used)} GB / ${fmt(total)} GB`;
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
  return <VStack spacing={2} padding={{ top: compact ? 1 : 2 }}
    frame={{ maxWidth: "infinity", alignment: "leading" }}>
    {message ? <HStack spacing={3}>
      <Text font={compact ? 8 : 9} foregroundStyle={ORANGE} lineLimit={1} minScaleFactor={0.8}>
        {compact ? result.cached ? "缓存数据" : result.warning?.includes("实时") ? "实时缺失" : "缓存失败" : message}
      </Text>
      <Spacer minLength={0} />
      {result.cached ? <Text font={compact ? 8 : 9} foregroundStyle={SECONDARY}>Cached</Text> : null}
    </HStack> : null}
    <HStack alignment="firstTextBaseline" spacing={4}>
      <Text font={compact ? 8 : 9} foregroundStyle={SECONDARY} lineLimit={1}>点击刷新</Text>
      <Spacer minLength={0} />
      <Text font={compact ? 8 : 9} foregroundStyle={SECONDARY} monospacedDigit
        lineLimit={1} minScaleFactor={0.75}>
        {`更新 ${formatUpdateTime(result.timestamp)}`}
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
  return <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
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
    <Spacer minLength={0} />
    <Footer result={result} compact />
  </VStack>;
}

export function createMediumWidget(config: Settings, result: Result, _size: DisplaySize) {
  return <WideWidget config={config} result={result} large={false} />;
}

export function createLargeWidget(config: Settings, result: Result) {
  return <WideWidget config={config} result={result} large />;
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

function TrafficRing({ data, small, diameter: requestedDiameter }: { data: APIData; small: boolean; diameter?: number }) {
  const traffic = trafficInfo(data);
  const value = traffic.valid ? traffic.percent : 0;
  const color = value < 70 ? CYAN : value < 90 ? ORANGE : RED;
  const diameter = requestedDiameter || (small ? 42 : 76);
  const innerWidth = diameter - 16;
  return <ZStack frame={{ width: diameter, height: diameter }}>
    <Circle stroke={{ shapeStyle: TRACK, strokeStyle: { lineWidth: 4 } }}
      frame={{ width: diameter - 6, height: diameter - 6 }} />
    {value > 0 ? <Circle trim={{ from: 0, to: value / 100 }}
      stroke={{ shapeStyle: color, strokeStyle: { lineWidth: 4, lineCap: "round" } }}
      frame={{ width: diameter - 6, height: diameter - 6 }} rotationEffect={-90} /> : null}
    <VStack spacing={0} frame={{ width: innerWidth, alignment: "center" }}>
      <Text font={small ? 10 : diameter < 60 ? 13 : 17} fontWeight="semibold" monospacedDigit
        frame={{ width: innerWidth, alignment: "center" }}
        minScaleFactor={0.65} lineLimit={1}>
        {traffic.valid ? traffic.percent.toFixed(1) : "--"}
      </Text>
      <Text font={small ? 7 : 10} foregroundStyle={SECONDARY}>%</Text>
    </VStack>
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
        <Text font={small ? 23 : large ? 42 : 30} fontWeight="semibold" monospacedDigit
          lineLimit={1} minScaleFactor={0.7}>{traffic.used === "--" ? "--" : usedParts[0]}</Text>
        {traffic.used !== "--" ? <Text font={small ? 10 : 13} foregroundStyle={SECONDARY}>
          {usedParts[1]}
        </Text> : null}
        {small ? <Spacer minLength={0} /> : null}
        {small ? <Text font={9} foregroundStyle={SECONDARY} monospacedDigit
          lineLimit={1} minScaleFactor={0.8}>{traffic.percentLabel}</Text> : null}
      </HStack>
      <Text font={small ? 9 : 11} foregroundStyle={SECONDARY} lineLimit={1} minScaleFactor={0.8}>
        {`/ ${traffic.total}`}
      </Text>
    </VStack> : <Text font={small ? 17 : large ? 28 : 23} fontWeight="semibold" monospacedDigit
      lineLimit={1} minScaleFactor={0.7}>{traffic.summary}</Text>}
    {createProgressBar(traffic.valid ? traffic.percent : 0, style === "focus" ? AMBER : BLUE)}
    <ResetLine data={data} />
    {!small ? <Text font={11} foregroundStyle={traffic.exceeded ? RED : SECONDARY}>{traffic.remaining}</Text> : null}
    {small && traffic.exceeded ? <Text font={8} foregroundStyle={RED} lineLimit={1}>已超出</Text> : null}
  </VStack>;
}

// 中号指标分成名称、数值两行，给 GB 单位和总量留出整列宽度。
function WideMetric({ row, data, large = false, tile = false }: {
  row: ResourceRowData; data: APIData; large?: boolean; tile?: boolean;
}) {
  const ram = calculateMemoryUsage(data.plan_ram, data.mem_available_kb);
  const swapKB = number(data.swap_total_kb);
  const swap = calculateMemoryUsage(swapKB === null ? data.plan_swap : Math.min(swapKB * 1024, Number.MAX_SAFE_INTEGER), data.swap_available_kb);
  const disk = calculateDiskUsage(data);
  const metric = row.label === "内存" ? ram : row.label === "Swap" ? swap : row.label === "硬盘" ? disk : null;
  const percent = metric && metric.usedBytes !== null && metric.totalBytes !== null && metric.totalBytes > 0
    ? Math.min(100, Math.max(0, metric.usedBytes / metric.totalBytes * 100)) : null;
  return <VStack alignment="leading" spacing={large ? 5 : 1}
    padding={tile ? large ? 10 : { horizontal: 5, vertical: 2 } : 0}
    frame={{ maxWidth: "infinity", alignment: "leading" }}
    background={tile ? { style: TILE_BACKGROUND, shape: { type: "rect", cornerRadius: 10 } } : undefined}>
    <Text font={large ? 11 : 8} foregroundStyle={SECONDARY}>{row.label}</Text>
    <Text font={large ? 15 : 11} fontWeight="medium" monospacedDigit lineLimit={1}
      minScaleFactor={0.75} frame={{ maxWidth: "infinity", alignment: "leading" }}>{row.value}</Text>
    {large && percent !== null ? createProgressBar(percent, BLUE) : null}
  </VStack>;
}

function WideResources({ config, data, large = false, tile = false }: {
  config: Settings; data: APIData; large?: boolean; tile?: boolean;
}) {
  const rows = resourceRows(data, config);
  if (large && !tile) return <VStack spacing={9}>
    {rows.map(row => <VStack key={row.label} spacing={4}>
      <ResourceRow row={row} large />
      {row.label !== "CPU" ? <WideMetricBar label={row.label} data={data} /> : null}
    </VStack>)}
  </VStack>;
  return <VStack spacing={large ? 10 : 3}>
    <HStack spacing={large ? 14 : 12}>
      <WideMetric row={rows[0]} data={data} large={large} tile={tile} />
      <WideMetric row={rows[1]} data={data} large={large} tile={tile} />
    </HStack>
    <HStack spacing={large ? 14 : 12}>
      <WideMetric row={rows[2]} data={data} large={large} tile={tile} />
      <WideMetric row={rows[3]} data={data} large={large} tile={tile} />
    </HStack>
  </VStack>;
}

function WideMetricBar({ label, data }: { label: string; data: APIData }) {
  const kb = number(data.swap_total_kb);
  const metric = label === "内存" ? calculateMemoryUsage(data.plan_ram, data.mem_available_kb)
    : label === "Swap" ? calculateMemoryUsage(kb === null ? data.plan_swap : Math.min(kb * 1024, Number.MAX_SAFE_INTEGER), data.swap_available_kb)
      : calculateDiskUsage(data);
  if (metric.usedBytes === null || metric.totalBytes === null || metric.totalBytes <= 0) return null;
  return createProgressBar(Math.min(100, Math.max(0, metric.usedBytes / metric.totalBytes * 100)), BLUE);
}

function LoadDetails({ data }: { data: APIData }) {
  const parts = (formatLoad(data.load_average) || "-- / -- / --").split(" / ");
  return <HStack spacing={14} padding={{ top: 4 }}>
    {["1 分钟负载", "5 分钟负载", "15 分钟负载"].map((label, index) =>
      <VStack key={label} alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={9} foregroundStyle={SECONDARY}>{label}</Text>
        <Text font={13} fontWeight="medium" monospacedDigit>{parts[index] || "--"}</Text>
      </VStack>)}
  </HStack>;
}

function WideTraffic({ data, style, large = false }: { data: APIData; style: string; large?: boolean }) {
  const traffic = trafficInfo(data);
  const color = style === "focus" ? AMBER : style === "ring" ? CYAN : style === "dashboard" ? BLUE : GREEN;
  const title = <HStack spacing={5}>
    <Text font={10} foregroundStyle={SECONDARY}>本月流量</Text>
    <Spacer minLength={0} />
    <Text font={large ? 15 : 12} fontWeight="semibold" monospacedDigit
      foregroundStyle={traffic.exceeded ? RED : PRIMARY}>{traffic.percentLabel}</Text>
  </HStack>;
  const total = <Text font={large ? 13 : 11} foregroundStyle={SECONDARY}
    lineLimit={1} minScaleFactor={0.75}>{`/ ${traffic.total}`}</Text>;
  return <VStack alignment="leading" spacing={large ? 6 : 3}>
    {style === "ring" ? <HStack spacing={large ? 16 : 12}>
      <TrafficRing data={data} small={false} diameter={large ? 86 : 44} />
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={10} foregroundStyle={SECONDARY}>本月流量</Text>
        <Text font={large ? 30 : 23} fontWeight="semibold" monospacedDigit
          lineLimit={1} minScaleFactor={0.75}>{traffic.used}</Text>
        {total}
      </VStack>
    </HStack> : <VStack alignment="leading" spacing={large ? 5 : 2}>
      {!(style === "dashboard" && !large) ? title : null}
      <HStack alignment="firstTextBaseline" spacing={6}>
        <Text font={large ? style === "focus" ? 32 : 30 : style === "focus" ? 27 : 20}
          fontWeight="semibold" monospacedDigit lineLimit={1} minScaleFactor={0.7}>{traffic.used}</Text>
        {style !== "focus" ? total : null}
        {style === "dashboard" && !large ? <Spacer minLength={0} /> : null}
        {style === "dashboard" && !large ? <Text font={11} fontWeight="semibold" monospacedDigit>
          {traffic.percentLabel}
        </Text> : null}
      </HStack>
      {style === "focus" ? total : null}
      {createProgressBar(traffic.valid ? traffic.percent : 0, color)}
    </VStack>}
    {style === "focus" && !large ? <VStack alignment="leading" spacing={2}>
      <Text font={10} foregroundStyle={traffic.exceeded ? RED : SECONDARY} lineLimit={1}>{traffic.remaining}</Text>
      <Text font={10} foregroundStyle={SECONDARY} lineLimit={1}>{`${formatResetDate(data.data_next_reset)}重置`}</Text>
    </VStack> : <HStack spacing={6}>
      <Text font={10} foregroundStyle={traffic.exceeded ? RED : SECONDARY} lineLimit={1}
        minScaleFactor={0.8}>{traffic.remaining}</Text>
      <Spacer minLength={0} />
      <Text font={10} foregroundStyle={SECONDARY} lineLimit={1}>
        {`${formatResetDate(data.data_next_reset)}重置`}
      </Text>
    </HStack>}
  </VStack>;
}

function WideWidget({ config, result, large }: { config: Settings; result: Result; large: boolean }) {
  const data = result.data || {};
  const style = normalizeWidgetStyle(config.widgetStyle);
  return <VStack alignment="leading" spacing={large ? 6 : 3}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    {style === "focus" && !large ? <HStack alignment="top" spacing={14}>
      <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <WideTraffic data={data} style={style} />
      </VStack>
      <VStack spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {resourceRows(data, config).map(row => <WideMetric key={row.label} row={row} data={data} />)}
      </VStack>
    </HStack> : <VStack alignment="leading" spacing={large ? 12 : 4}>
      <WideTraffic data={data} style={style} large={large} />
      <WideResources config={config} data={data} large={large} tile={style === "dashboard"} />
    </VStack>}
    {large ? <LoadDetails data={data} /> : null}
    <Spacer minLength={0} />
    <Footer result={result} />
  </VStack>;
}

function StyledWidget({ config, result, family }: { config: Settings; result: Result; family: string }) {
  if (family !== "systemSmall") return <WideWidget config={config} result={result}
    large={family === "systemLarge" || family === "systemExtraLarge"} />;
  const style = normalizeWidgetStyle(config.widgetStyle);
  const data = result.data || {};
  return <VStack alignment="leading" spacing={3}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    <StyledTraffic data={data} small large={false} style={style} />
    {style === "dashboard" ? <ResourceTiles config={config} data={data} small large={false} />
      : <ResourceList config={config} data={data} large={false} small />}
    <Spacer minLength={0} />
    <Footer result={result} compact />
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
