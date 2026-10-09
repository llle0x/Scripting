// 风格 ID 保持稳定，中文名称仅用于设置页面。
export const WIDGET_STYLES = [
  { id: "minimal", name: "极简列表" },
  { id: "dashboard", name: "分区仪表" },
  { id: "ring", name: "环形概览" },
  { id: "focus", name: "数字焦点" },
] as const;

export function normalizeWidgetStyle(value: unknown): string {
  return WIDGET_STYLES.some(style => style.id === value) ? value as string : "minimal";
}

export function widgetStyleName(value: unknown): string {
  return WIDGET_STYLES.find(style => style.id === value)?.name || "极简列表";
}
