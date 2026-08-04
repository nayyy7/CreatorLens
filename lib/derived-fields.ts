// CreatorLens 系统派生字段计算
// 服务端重新计算，不信任 Excel 中的公式或缓存值

import type { DurationBand, RecordStatus } from "@/types";

/**
 * 计算互动率 engagement_rate
 * 公式：(likes + comments + favorites + shares) / views
 * 分母为 0 或缺失时返回 undefined
 */
export function calcEngagementRate(
  likes: number | undefined,
  comments: number | undefined,
  favorites: number | undefined,
  shares: number | undefined,
  views: number | undefined
): number | undefined {
  if (!views || views <= 0) return undefined;
  const numerator = (likes ?? 0) + (comments ?? 0) + (favorites ?? 0) + (shares ?? 0);
  if (numerator === 0) return 0;
  const rate = numerator / views;
  return round4(rate);
}

/**
 * 计算商品点击率 product_click_rate
 * 公式：product_clicks / views
 */
export function calcProductClickRate(
  productClicks: number | undefined,
  views: number | undefined
): number | undefined {
  if (!views || views <= 0 || productClicks == null) return undefined;
  const rate = productClicks / views;
  return round4(rate);
}

/**
 * 计算转化率 conversion_rate
 * 公式：orders / product_clicks
 */
export function calcConversionRate(
  orders: number | undefined,
  productClicks: number | undefined
): number | undefined {
  if (!productClicks || productClicks <= 0 || orders == null) return undefined;
  const rate = orders / productClicks;
  return round4(rate);
}

/**
 * 判断时长区间
 */
export function calcDurationBand(seconds: number | undefined): DurationBand {
  if (seconds == null) return "11-20秒"; // 默认中位
  if (seconds <= 10) return "≤10秒";
  if (seconds <= 20) return "11-20秒";
  if (seconds <= 30) return "21-30秒";
  return ">30秒";
}

/**
 * 计算数据质量分 data_quality_score（0-1）
 * 检查 5 个维度的完整性
 */
export function calcDataQualityScore(record: {
  video_id?: string;
  category?: string;
  views?: number;
  title?: string;
  script_or_subtitle?: string;
  hook_text?: string;
  completion_rate?: number;
  five_sec_retention?: number;
}): number {
  let score = 0;
  // 1. 标识完整 (video_id)
  if (record.video_id && record.video_id.trim()) score++;
  // 2. 品类完整 (category)
  if (record.category && record.category.trim()) score++;
  // 3. 播放量有效 (views > 0)
  if (record.views && record.views > 0) score++;
  // 4. 内容文本至少一项
  if (
    (record.title && record.title.trim()) ||
    (record.script_or_subtitle && record.script_or_subtitle.trim()) ||
    (record.hook_text && record.hook_text.trim())
  )
    score++;
  // 5. 质量指标至少一项
  if (
    record.completion_rate != null ||
    record.five_sec_retention != null
  )
    score++;

  return score / 5;
}

/**
 * 判断记录状态
 */
export function calcRecordStatus(
  qualityScore: number,
  hasContentIssues: boolean
): RecordStatus {
  if (qualityScore >= 0.8 && !hasContentIssues) return "可分析";
  if (qualityScore >= 0.6) return "警告";
  return "不可用";
}

/**
 * 归一化百分比
 * 返回 { value, warnings }
 */
export function normalizePercentage(
  raw: number | string | undefined
): { value: number | undefined; warnings: string[] } {
  const warnings: string[] = [];

  if (raw == null || raw === "") return { value: undefined, warnings };

  let num = typeof raw === "string" ? parseFloat(raw) : raw;

  if (isNaN(num)) {
    return { value: undefined, warnings: ["无法解析为数字"] };
  }

  if (num < 0 || num > 100) {
    return { value: undefined, warnings: [`百分比值 ${num} 超出有效范围 (0-100)`] };
  }

  if (num > 1) {
    num = num / 100;
    warnings.push(`百分比值已从 ${raw} 自动转换为 ${num}`);
  }

  // 归一化后再次校验
  if (num < 0 || num > 1) {
    return { value: undefined, warnings: [`归一化后值 ${num} 仍超出 0-1 范围`] };
  }

  return { value: round4(num), warnings };
}

/**
 * 四舍五入到 4 位小数
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Excel 日期序列号转 YYYY-MM-DD
 */
export function excelDateToString(serial: number): string {
  // Excel 日期从 1900-01-01 开始（含闰年 bug）
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  const date = new Date(excelEpoch.getTime() + serial * msPerDay);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 判断是否为 Excel 日期序列号（正整数，范围 30000-60000 = 1982-2064）
 */
export function isExcelDateSerial(n: number): boolean {
  return Number.isInteger(n) && n > 30000 && n < 80000;
}
