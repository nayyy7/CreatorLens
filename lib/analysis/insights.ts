// CreatorLens 规则洞察生成
// 优先基于可操作变量，承载真实分组统计

import type { VideoRecord } from "@/types";
import type { SummaryStats } from "./stats";
import type { DimensionResult } from "./dimensions";

export interface RuleInsight {
  id: string;
  title: string;
  facts: string;
  supportingMetrics: string;
  sampleSize: number;
  confidenceLevel: "较高" | "中" | "低";
  actionableAdvice: string;
  source: string;
  // 真实统计数据
  metric: string;
  metricLabel: string;
  groupA: { label: string; n: number; median: number };
  groupB: { label: string; n: number; median: number };
  absoluteDelta: number;
  evidenceVideos: string[];
}

/**
 * 生成规则洞察（最多 3 条，优先可操作维度）
 */
export function generateInsights(
  records: VideoRecord[],
  stats: SummaryStats,
  dimensions: DimensionResult[]
): RuleInsight[] {
  const candidates: RuleInsight[] = [];
  const valid = records.filter((r) => r.record_status !== "不可用");
  if (valid.length < 3) return [];

  // ─── P0：时长区间（可操作） ─────────────────
  const durDim = dimensions.find((d) => d.dimension === "duration_band");
  if (durDim && durDim.groups.length >= 2) {
    const withCompletion = durDim.groups.filter(
      (g) => g.sampleSize >= 2 && g.avgCompletionRate != null && g.avgCompletionRate > 0
    );
    if (withCompletion.length >= 2) {
      const sorted = [...withCompletion].sort(
        (a, b) => (b.avgCompletionRate ?? 0) - (a.avgCompletionRate ?? 0)
      );
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (best && worst && best !== worst &&
          (best.avgCompletionRate ?? 0) > (worst.avgCompletionRate ?? 0)) {
        const absDelta = (best.avgCompletionRate ?? 0) - (worst.avgCompletionRate ?? 0);
        candidates.push({
          id: "rule_duration",
          title: `时长区间"${best.label}"完播率更高`,
          facts: `在本次样本中，${best.label}区间的 ${best.sampleSize} 条视频平均完播率为 ${((best.avgCompletionRate ?? 0) * 100).toFixed(1)}%，"${worst.label}"区间的 ${worst.sampleSize} 条为 ${((worst.avgCompletionRate ?? 0) * 100).toFixed(1)}%，相差 ${(absDelta * 100).toFixed(1)} 个百分点。`,
          supportingMetrics: `平均完播率：${best.label} ${((best.avgCompletionRate ?? 0) * 100).toFixed(1)}% vs ${worst.label} ${((worst.avgCompletionRate ?? 0) * 100).toFixed(1)}%；样本量 ${best.sampleSize} vs ${worst.sampleSize}`,
          sampleSize: best.sampleSize + worst.sampleSize,
          confidenceLevel: groupConfidence(best.sampleSize, worst.sampleSize),
          actionableAdvice: `建议下一轮优先采用 ${best.label} 时长，测试其对完播率的提升是否可复制。控制卖点和发布时间一致。`,
          source: `duration_band 维度分析（${best.label} vs ${worst.label}，完播率对比）`,
          metric: "completion_rate",
          metricLabel: "平均完播率",
          groupA: { label: best.label, n: best.sampleSize, median: (best.avgCompletionRate ?? 0) },
          groupB: { label: worst.label, n: worst.sampleSize, median: (worst.avgCompletionRate ?? 0) },
          absoluteDelta: absDelta,
          evidenceVideos: getEvidenceVideos(valid, "duration_band", best.label, 2),
        });
      }
    }
  }

  // ─── P0：目标人群（可操作） ─────────────────
  const audDim = dimensions.find((d) => d.dimension === "target_audience");
  if (audDim && audDim.groups.length >= 2) {
    const sorted = [...audDim.groups]
      .filter((g) => g.sampleSize >= 2)
      .sort((a, b) => (b.medianViews || 0) - (a.medianViews || 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best && worst && best !== worst && best.medianViews > 0 && worst.medianViews > 0) {
      const absDelta = best.medianViews - worst.medianViews;
      candidates.push({
        id: "rule_audience",
        title: `面向"${best.label}"人群的视频播放表现更突出`,
        facts: `在本次样本中，标注为"${best.label}"的 ${best.sampleSize} 条视频播放中位数为 ${best.medianViews.toLocaleString()}，"${worst.label}"的 ${worst.sampleSize} 条为 ${worst.medianViews.toLocaleString()}，相差 ${Math.round((best.medianViews / worst.medianViews - 1) * 100)}%。`,
        supportingMetrics: `中位数播放量对比：${best.label} ${best.medianViews.toLocaleString()} vs ${worst.label} ${worst.medianViews.toLocaleString()}；样本量 ${best.sampleSize} vs ${worst.sampleSize}`,
        sampleSize: best.sampleSize + worst.sampleSize,
        confidenceLevel: groupConfidence(best.sampleSize, worst.sampleSize),
        actionableAdvice: `针对"${best.label}"人群的内容获得更高关注，建议在创作新视频时以该人群为核心受众设计 Hook 和场景。`,
        source: `target_audience 维度分析（${best.label} vs ${worst.label}）`,
        metric: "views",
        metricLabel: "播放量中位数",
        groupA: { label: best.label, n: best.sampleSize, median: best.medianViews },
        groupB: { label: worst.label, n: worst.sampleSize, median: worst.medianViews },
        absoluteDelta: absDelta,
        evidenceVideos: getEvidenceVideosByField(valid, "target_audience", best.label, 2),
      });
    }
  }

  // ─── P1：完播率分组（行为指标，可操作） ────
  if (stats.avgCompletionRate != null && stats.avgCompletionRate > 0) {
    const withCompletion = valid.filter((r) => r.completion_rate != null);
    if (withCompletion.length >= 4) {
      const above = withCompletion.filter((r) => (r.completion_rate ?? 0) > (stats.avgCompletionRate ?? 0));
      const below = withCompletion.filter((r) => (r.completion_rate ?? 0) <= (stats.avgCompletionRate ?? 0));

      if (above.length >= 2 && below.length >= 2) {
        const aboveAvgViews = above.reduce((s, r) => s + r.views, 0) / above.length;
        const belowAvgViews = below.reduce((s, r) => s + r.views, 0) / below.length;

        if (aboveAvgViews > belowAvgViews) {
          const aboveMed = median(above.map((r) => r.views));
          const belowMed = median(below.map((r) => r.views));
          const absDelta = aboveMed - belowMed;

          candidates.push({
            id: "rule_completion",
            title: `完播率高于均值的视频获得更多播放`,
            facts: `在本次样本中，完播率高于均值（${(stats.avgCompletionRate * 100).toFixed(1)}%）的 ${above.length} 条视频，播放中位数为 ${aboveMed.toLocaleString()}；低于均值的 ${below.length} 条视频为 ${belowMed.toLocaleString()}。数据显示完播率与播放分布呈正向关联，优化完播率可能带来更多曝光。`,
            supportingMetrics: `完播率阈值：${(stats.avgCompletionRate * 100).toFixed(1)}%；高完播率组中位数：${aboveMed.toLocaleString()}；低完播率组中位数：${belowMed.toLocaleString()}；样本量 ${above.length} vs ${below.length}`,
            sampleSize: withCompletion.length,
            confidenceLevel: groupConfidence(above.length, below.length),
            actionableAdvice: "优化视频前 3 秒的吸引力以提高完播率，测试不同 Hook 对完播率的影响。",
            source: "完播率分组对比分析",
            metric: "views",
            metricLabel: "播放量中位数",
            groupA: { label: `完播率>${(stats.avgCompletionRate * 100).toFixed(0)}%`, n: above.length, median: aboveMed },
            groupB: { label: `完播率≤${(stats.avgCompletionRate * 100).toFixed(0)}%`, n: below.length, median: belowMed },
            absoluteDelta: absDelta,
            evidenceVideos: above.slice(0, 2).map((r) => r.video_id),
          });
        }
      }
    }
  }

  // ─── P1：价格带（可操作，仅当有多个价格带）───
  const priceDim = dimensions.find((d) => d.dimension === "price_band");
  if (priceDim && priceDim.groups.length >= 2) {
    const withData = priceDim.groups.filter((g) => g.sampleSize >= 1 && g.medianViews > 0);
    if (withData.length >= 2) {
      const sorted = [...withData].sort((a, b) => (b.medianViews || 0) - (a.medianViews || 0));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const absDelta = best.medianViews - worst.medianViews;

      if (best !== worst && absDelta > 0) {
        candidates.push({
          id: "rule_price",
          title: `"${best.label}"价格带内容播放表现更好`,
          facts: `在本次样本中，"${best.label}"价格带（${best.sampleSize} 条）播放中位数为 ${best.medianViews.toLocaleString()}，"${worst.label}"价格带（${worst.sampleSize} 条）为 ${worst.medianViews.toLocaleString()}。`,
          supportingMetrics: `中位数播放量：${best.label} ${best.medianViews.toLocaleString()} vs ${worst.label} ${worst.medianViews.toLocaleString()}`,
          sampleSize: best.sampleSize + worst.sampleSize,
          confidenceLevel: groupConfidence(best.sampleSize, worst.sampleSize),
          actionableAdvice: `调整内容定位以匹配 ${best.label} 价格带用户的购买预期，在视频中突出对应价位的核心卖点。`,
          source: `price_band 维度分析（${best.label} vs ${worst.label}）`,
          metric: "views",
          metricLabel: "播放量中位数",
          groupA: { label: best.label, n: best.sampleSize, median: best.medianViews },
          groupB: { label: worst.label, n: worst.sampleSize, median: worst.medianViews },
          absoluteDelta: absDelta,
          evidenceVideos: getEvidenceVideosByField(valid, "price_band", best.label, 2),
        });
      }
    }
  }

  // ─── 排序：可操作维度优先，同优先级按置信度 ──
  const priority: Record<string, number> = {
    rule_duration: 1,
    rule_audience: 1,
    rule_completion: 2,
    rule_price: 2,
  };

  candidates.sort((a, b) => {
    const pa = priority[a.id] || 3;
    const pb = priority[b.id] || 3;
    if (pa !== pb) return pa - pb;
    const levelOrder = { "较高": 3, "中": 2, "低": 1 };
    return (levelOrder[b.confidenceLevel] || 0) - (levelOrder[a.confidenceLevel] || 0);
  });

  return candidates.slice(0, 3);
}

// ─── 工具函数 ──────────────────────────────────

function groupConfidence(n1: number, n2: number): "较高" | "中" | "低" {
  const min = Math.min(n1, n2);
  if (min >= 5) return "较高";
  if (min >= 3) return "中";
  return "低";
}

function getEvidenceVideos(
  records: VideoRecord[],
  field: keyof VideoRecord,
  value: string,
  count: number
): string[] {
  return records
    .filter((r) => String(r[field] ?? "") === value)
    .sort((a, b) => b.views - a.views)
    .slice(0, count)
    .map((r) => r.video_id);
}

function getEvidenceVideosByField(
  records: VideoRecord[],
  field: keyof VideoRecord,
  value: string,
  count: number
): string[] {
  return records
    .filter((r) => {
      const v = r[field];
      return v != null && String(v) === value;
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, count)
    .map((r) => r.video_id);
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
