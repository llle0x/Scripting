import { fetch } from "scripting";
import { CONFIG, DEBUG } from "./config";
import { normalizeWidgetStyle } from "./styles";

export type APIData = Record<string, unknown>;
export type Settings = typeof CONFIG;
export type Snapshot = {
  timestamp: number;
  ownerVeid: string;
  serviceInfo: APIData;
  liveInfo: APIData | null;
};
export type Result = {
  data: APIData | null;
  cached: boolean;
  timestamp: number;
  error: string | null;
  warning: string | null;
};

const FIELDS = [
  "hostname", "node_alias", "node_location", "node_location_id", "plan",
  "plan_monthly_data", "data_counter", "data_next_reset", "monthly_data_multiplier",
  "plan_ram", "plan_disk", "plan_swap", "ip_addresses", "ve_status", "vz_status",
  "load_average", "mem_available_kb", "swap_available_kb", "swap_total_kb",
  "ve_used_disk_space_b", "ve_disk_quota_gb",
];

export function debug(message: string) {
  // 只调用本函数输出受控的状态、字段名；不输出响应值或原始异常。
  if (DEBUG) console.log(`[BWH] ${message}`);
}

export function asObject(value: unknown): APIData | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as APIData : null;
}

export function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim() : "";
}

export function number(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function loadConfig(): Settings {
  const minutes = number(CONFIG.refreshMinutes);
  const readCredential = (key: string) => {
    try { return text(Keychain.get(key)); }
    catch { debug("Keychain 暂不可读"); return ""; }
  };
  return {
    ...CONFIG,
    veid: readCredential("BWH_VEID") || text(CONFIG.veid),
    apiKey: readCredential("BWH_API_KEY") || text(CONFIG.apiKey),
    cpuCores: number(readCredential("BWH_CPU_CORES")) || number(CONFIG.cpuCores) || 0,
    widgetStyle: normalizeWidgetStyle(readCredential("BWH_WIDGET_STYLE") || CONFIG.widgetStyle),
    name: text(CONFIG.name) || "BandwagonHost",
    refreshMinutes: minutes && minutes > 0 ? Math.min(minutes, 10080) : 30,
  };
}

export function hasCredentials(config: Settings): boolean {
  return /^\d+$/.test(config.veid) && config.apiKey.length > 0;
}

function selectFields(data: APIData): APIData {
  const selected: APIData = {};
  // 不缓存完整响应：排除 email、任何凭据和未使用的隐私字段。
  for (const field of FIELDS) {
    if (data[field] !== null && data[field] !== undefined) selected[field] = data[field];
  }
  return selected;
}

export function sanitizeError(value: unknown, config: Settings): string {
  let message = text(value) || "请求失败";
  for (const secret of [config.apiKey, encodeURIComponent(config.apiKey)]) {
    if (secret) message = message.split(secret).join("[已隐藏]");
  }
  message = message.replace(/api_key\s*[=:]\s*[^\s&"'<>]+/gi, "api_key=[已隐藏]");
  return message.replace(/https?:\/\/[^\s<>]+/gi, "[链接已隐藏]").slice(0, 180);
}

class APIError extends Error {}

export async function requestAPI(endpoint: "getServiceInfo" | "getLiveServiceInfo", config: Settings): Promise<APIData> {
  // TypeScript 类型之外再做运行时限制，拒绝调用其他 KiwiVM 接口。
  if (endpoint !== "getServiceInfo" && endpoint !== "getLiveServiceInfo") {
    throw new APIError("不支持的查询接口");
  }
  // 仅允许两个只读接口，不跟随重定向，不把带凭据 URL 传给日志。
  const url = `https://api.64clouds.com/v1/${endpoint}?veid=${encodeURIComponent(config.veid)}&api_key=${encodeURIComponent(config.apiKey)}`;
  try {
    const response = await fetch(url, {
      method: "GET", timeout: 10,
      headers: { Accept: "application/json" },
      handleRedirect: async () => null,
      debugLabel: `BWH ${endpoint}`,
    });
    debug(`${endpoint} HTTP ${response.status}`);
    if (!response.ok) throw new APIError(`HTTP ${response.status}`);
    const data = asObject(await response.json());
    if (!data) throw new APIError("API 返回格式无效");
    const rawCode = text(data.error);
    const code = rawCode ? Number(rawCode) : NaN;
    if (!Number.isFinite(code)) throw new APIError("API 缺少有效 error 字段");
    if (code !== 0) throw new APIError(`API 错误 ${code}：${sanitizeError(data.message, config)}`);
    debug(`${endpoint} 成功；字段 ${Object.keys(selectFields(data)).join(", ")}`);
    return selectFields(data);
  } catch (error) {
    debug(`${endpoint} 失败`);
    // 原始网络错误可能包含完整 URL，绝不输出或直接转交给 UI。
    if (error instanceof APIError) throw error;
    throw new APIError("网络请求失败或超时（10 秒）");
  }
}

export const fetchServiceInfo = (config: Settings) => requestAPI("getServiceInfo", config);
export const fetchLiveInfo = (config: Settings) => requestAPI("getLiveServiceInfo", config);

function cachePath(): string {
  // 普通 Documents 不支持 Widget 访问，必须使用本地 App Group 共享目录。
  return `${FileManager.appGroupDocumentsDirectory}/BandwagonHost/bandwagon_widget_cache.json`;
}

export async function loadCache(veid: string): Promise<Snapshot | null> {
  try {
    const path = cachePath();
    if (!await FileManager.exists(path)) return null;
    const raw = asObject(JSON.parse(await FileManager.readAsString(path)));
    if (!raw || raw.ownerVeid !== veid || !asObject(raw.serviceInfo)) return null;
    const timestamp = number(raw.timestamp);
    if (timestamp === null || timestamp <= 0) return null;
    debug("缓存命中");
    return {
      ownerVeid: veid, timestamp,
      serviceInfo: selectFields(raw.serviceInfo as APIData),
      liveInfo: asObject(raw.liveInfo) ? selectFields(raw.liveInfo as APIData) : null,
    };
  } catch {
    debug("缓存不可读");
    return null;
  }
}

export async function saveCache(snapshot: Snapshot): Promise<boolean> {
  try {
    await FileManager.createDirectory(`${FileManager.appGroupDocumentsDirectory}/BandwagonHost`, true);
    // 写入边界再次过滤，额外字段即使意外进入 snapshot 也不会落盘。
    const safeSnapshot: Snapshot = {
      timestamp: snapshot.timestamp, ownerVeid: snapshot.ownerVeid,
      serviceInfo: selectFields(snapshot.serviceInfo),
      liveInfo: snapshot.liveInfo ? selectFields(snapshot.liveInfo) : null,
    };
    await FileManager.writeAsString(cachePath(), JSON.stringify(safeSnapshot));
    return true;
  } catch {
    debug("缓存写入失败");
    return false;
  }
}

export function mergeInfo(base: APIData, live: APIData | null): APIData {
  // 仅合并实际存在的字段，避免实时接口的 null 覆盖有效基础数据。
  return { ...selectFields(base), ...(live ? selectFields(live) : {}) };
}

export async function loadData(config: Settings): Promise<Result> {
  try {
    const serviceInfo = await fetchServiceInfo(config);
    let liveInfo: APIData | null = null;
    let warning: string | null = null;
    if (config.useLiveInfo) {
      try { liveInfo = await fetchLiveInfo(config); }
      catch (error) { warning = `实时信息不可用：${sanitizeError((error as Error).message, config)}`; }
    }
    const timestamp = Date.now();
    if (!await saveCache({ timestamp, ownerVeid: config.veid, serviceInfo, liveInfo })) {
      warning = warning ? `${warning}；缓存保存失败` : "缓存保存失败";
    }
    return { data: mergeInfo(serviceInfo, liveInfo), cached: false, timestamp, error: null, warning };
  } catch (error) {
    const message = sanitizeError((error as Error).message, config);
    const cached = await loadCache(config.veid);
    if (cached) return {
      data: mergeInfo(cached.serviceInfo, config.useLiveInfo ? cached.liveInfo : null),
      cached: true, timestamp: cached.timestamp, error: message, warning: null,
    };
    return { data: null, cached: false, timestamp: 0, error: message, warning: null };
  }
}

export function calculateTraffic(data: APIData) {
  // KiwiVM 文档：额度和计数器都乘 monthly_data_multiplier。
  // 无效或缺失倍率退回 1；不只放大其中一个数，以免错误改变使用率。
  const multiplier = number(data.monthly_data_multiplier);
  const m = multiplier && multiplier > 0 ? multiplier : 1;
  const safeProduct = (value: unknown) => Math.min((number(value) ?? 0) * m, Number.MAX_SAFE_INTEGER);
  const usedBytes = safeProduct(data.data_counter);
  const totalBytes = safeProduct(data.plan_monthly_data);
  const remainingBytes = Math.max(0, totalBytes - usedBytes);
  const percent = totalBytes > 0 ? Math.min(100, Math.max(0, usedBytes / totalBytes * 100)) : 0;
  return { usedBytes, totalBytes, remainingBytes, percent };
}

export function formatBytes(bytes: unknown): string {
  const n = number(bytes);
  if (n === null) return "--";
  const unit = n >= 1024 ** 4 ? "TB" : n >= 1024 ** 3 ? "GB" : "MB";
  const divisor = unit === "TB" ? 1024 ** 4 : unit === "GB" ? 1024 ** 3 : 1024 ** 2;
  const value = n / divisor;
  return `${Number(value.toFixed(value < 10 ? 2 : 1))} ${unit}`;
}

function resetDate(timestamp: unknown): Date | null {
  const n = number(timestamp);
  if (n === null || n <= 0) return null;
  // 官方为秒；额外兼容毫秒，拒绝超出 Date 范围的数值。
  const date = new Date(n < 1e12 ? n * 1000 : n);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatResetDate(timestamp: unknown): string {
  const date = resetDate(timestamp);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : "--";
}

export const formatDate = formatResetDate;

export function daysUntilReset(timestamp: unknown, now = Date.now()): string {
  const date = resetDate(timestamp);
  if (!date) return "--";
  if (date.getTime() <= now) return "等待流量重置";
  return `${Math.ceil((date.getTime() - now) / 86400000)} 天后重置`;
}

export function getIPInfo(ipAddresses: unknown) {
  const addresses = (Array.isArray(ipAddresses) ? ipAddresses : typeof ipAddresses === "string" ? [ipAddresses] : [])
    .filter((value): value is string => typeof value === "string")
    .map(value => value.trim()).filter(Boolean);
  const ipv4 = addresses.filter(value => {
    const parts = value.split(".");
    return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  });
  // KiwiVM 也可能返回 IPv6 /64 子网，保留原始地址或网段。
  const ipv6 = addresses.filter(value => value.includes(":") && /^[0-9a-f:.]+(?:\/\d{1,3})?$/i.test(value));
  return { ipv4, ipv6, primary: ipv4[0] || ipv6[0] || addresses[0] || "--" };
}

export function getStatus(data: APIData): { label: string; color: "#30D158" | "#FF453A" | "#8E8E93" } {
  for (const field of [data.ve_status, data.vz_status]) {
    const value = text(field).toLowerCase();
    if (value === "running") return { label: "Running", color: "#30D158" };
    if (value === "stopped" || value === "offline") return { label: value === "offline" ? "Offline" : "Stopped", color: "#FF453A" };
  }
  return { label: "Unknown", color: "#8E8E93" };
}

export function formatLoad(value: unknown): string {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? value.trim().split(/[\s,]+/) : [];
  // 保留 1 / 5 / 15 分钟的位置，不能把缺失第一项后的值前移。
  const loads = parts.slice(0, 3).map(number);
  return loads.some(n => n !== null) ? loads.map(n => n === null ? "--" : n.toFixed(2)).join(" / ") : "";
}

export function calculateMemoryUsage(totalBytes: unknown, availableKB: unknown) {
  const total = number(totalBytes);
  const kb = number(availableKB);
  const available = kb !== null ? Math.min(kb * 1024, Number.MAX_SAFE_INTEGER) : null;
  // RAM 套餐容量与系统实际容量可能不同；不把不一致的值伪装成 0 已用。
  const used = total !== null && available !== null && available <= total ? total - available : null;
  return { totalBytes: total, availableBytes: available, usedBytes: used };
}

export function calculateDiskUsage(data: APIData) {
  // KVM 返回映射磁盘占用（字节）和镜像实际容量（GB）。不是推算或截图固定值。
  const liveGB = number(data.ve_disk_quota_gb);
  const totalBytes = liveGB !== null && liveGB > 0
    ? Math.min(liveGB * 1024 ** 3, Number.MAX_SAFE_INTEGER) : number(data.plan_disk);
  const usedBytes = number(data.ve_used_disk_space_b);
  return { usedBytes, totalBytes };
}

// 使用成功查询的时间戳；缓存回退不会把失败时间伪装成更新时间。
export function formatUpdateTime(timestamp: unknown, now = Date.now()): string {
  const n = number(timestamp);
  if (n === null || n <= 0) return "--";
  const date = new Date(n);
  if (!Number.isFinite(date.getTime())) return "--";
  const today = new Date(now);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  return sameDay ? time : `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
