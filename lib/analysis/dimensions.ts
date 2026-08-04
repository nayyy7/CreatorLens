// CreatorLens 维度分析
// 按可用离散字段分组，计算组内统计

import type { VideoRecord } from "@/types";
import { round2, round4 } from "./stats";

export interface DimensionGroup {
  label: string;
  sampleSize: number;
  avgViews: number;
  medianViews: number;
  avgCompletionRate: number | null;
  overallEngagementRate: number | null;
  relativePerformance: number | null; // 相对整体平均播放量的比值 - 1
  confidenceLevel: ConfidenceLevel;
}

export type ConfidenceLevel = "仅展示" | "低" | "中" | "较高";

export interface DimensionResult {
  dimension: string;
  dimensionLabel: string;
  groups: DimensionGroup[];
}

/**
 * 根据时长区间分组
 */
export function analyzeDurationBand(records: VideoRecord[]): DimensionResult {
  const groups = groupBy(records, (r) => r.duration_band || "未知");
  return {
    dimension: "duration_band",
    dimensionLabel: "时长区间",
    groups: computeGroups(groups, records),
  };
}

/**
 * 根据品类分组
 */
export function analyzeCategory(records: VideoRecord[]): DimensionResult {
  const groups = groupBy(records, (r) => r.category || "未知");
  return {
    dimension: "category",
    dimensionLabel: "商品品类",
    groups: computeGroups(groups, records),
  };
}

/**
 * 根据价格带分组
 */
export function analyzePriceBand(records: VideoRecord[]): DimensionResult {
  const groups = groupBy(records, (r) => r.price_band || "未填写");
  return {
    dimension: "price_band",
    dimensionLabel: "价格带",
    groups: computeGroups(groups, records),
  };
}

/**
 * 根据发布日期月份分组
 */
export function analyzePublishMonth(records: VideoRecord[]): DimensionResult {
  const groups = groupBy(records, (r) => {
    if (!r.publish_date) return "未知";
    const m = r.publish_date.slice(0, 7); // YYYY-MM
    return m || "未知";
  });
  return {
    dimension: "publish_month",
    dimensionLabel: "发布月份",
    groups: computeGroups(groups, records),
  };
}

/**
 * 根据目标人群分组
 */
export function analyzeTargetAudience(records: VideoRecord[]): DimensionResult {
  const groups = groupBy(records, (r) => r.target_audience || "未填写");
  return {
    dimension: "target_audience",
    dimensionLabel: "目标人群",
    groups: computeGroups(groups, records),
  };
}

/**
 * 运行所有可用维度分析
 */
export function analyzeAllDimensions(records: VideoRecord[]): DimensionResult[] {
  const valid = records.filter((r) => r.record_status !== "不可用");
  if (valid.length === 0) return [];

  const results: DimensionResult[] = [];

  // 必做维度
  results.push(analyzeDurationBand(valid));

  // 品类（仅当有多于一种时展示）
  const catResult = analyzeCategory(valid);
  const distinctCats = new Set(valid.map((r) => r.category).filter(Boolean));
  if (distinctCats.size > 1) results.push(catResult);

  // 价格带（仅当有数据时展示）
  const hasPriceBand = valid.some((r) => r.price_band);
  if (hasPriceBand) results.push(analyzePriceBand(valid));

  // 发布月份（仅当有多于一个月时展示）
  const months = new Set(
    valid
      .map((r) => r.publish_date?.slice(0, 7))
      .filter(Boolean)
  );
  if (months.size > 1) results.push(analyzePublishMonth(valid));

  // 目标人群
  const hasAudience = valid.some((r) => r.target_audience);
  if (hasAudience) results.push(analyzeTargetAudience(valid));

  return results;
}

// ─── 内部工具 ──────────────────────────────────

function groupBy(
  records: VideoRecord[],
  keyFn: (r: VideoRecord) => string
): Map<string, VideoRecord[]> {
  const map = new Map<string, VideoRecord[]>();
  for (const r of records) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function computeGroups(
  grouped: Map<string, VideoRecord[]>,
  allRecords: VideoRecord[]
): DimensionGroup[] {
  const allViews = allRecords
    .filter((r) => r.record_status !== "不可用")
    .map((r) => r.views);
  const overallAvgViews = allViews.length > 0 ? mean(allViews) : 0;

  const results: DimensionGroup[] = [];

  for (const [label, records] of grouped) {
    const n = records.length;
    const views = records.map((r) => r.views).sort((a, b) => a - b);
    const avgViews = round2(mean(views));
    const medianViews = median(views);

    const totalViews = sum(views);
    const totalInteractions = sum(
      records.map(
        (r) =>
          (r.likes ?? 0) + (r.comments ?? 0) + (r.favorites ?? 0) + (r.shares ?? 0)
      )
    );
    const overallEngagementRate =
      totalViews > 0 ? round4(totalInteractions / totalViews) : null;

    const completionRates = records
      .map((r) => r.completion_rate)
      .filter((v): v is number => v != null && !isNaN(v));
    const avgCompletionRate =
      completionRates.length > 0 ? round4(mean(completionRates)) : null;

    const relativePerformance =
      overallAvgViews > 0 ? round4(avgViews / overallAvgViews - 1) : null;

    const confidenceLevel = calcConfidence(n);

    results.push({
      label,
      sampleSize: n,
      avgViews,
      medianViews,
      avgCompletionRate,
      overallEngagementRate,
      relativePerformance,
      confidenceLevel,
    });
  }

  // 按样本量降序
  return results.sort((a, b) => b.sampleSize - a.sampleSize);
}

function calcConfidence(n: number): ConfidenceLevel {
  if (n <= 1) return "仅展示";
  if (n === 2) return "低";
  if (n <= 4) return "中";
  return "较高";
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : sum(arr) / arr.length;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
