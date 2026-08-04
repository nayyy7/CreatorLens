// CreatorLens 创作 Brief 生成
// 基于规则模板，提供下一轮内容创作方向

import type { VideoRecord } from "@/types";
import type { SummaryStats } from "./stats";
import type { RuleInsight } from "./insights";
import type { RuleExperiment } from "./experiments";

export interface RuleBrief {
  id: string;
  experimentId?: string;
  contentDirection: string;
  openingStyle: string;
  recommendedDuration: string;
  contentStructure: string;
  expressionStyle: string;
  optimizationMetric: string;
  generationPrompt: string;
  note: string;
  references: BriefReference[];
}

export interface BriefReference {
  insightId: string;
  title: string;
  metric: string;
  sampleSize: number;
  confidenceLevel: string;
}

export function generateBrief(
  records: VideoRecord[],
  stats: SummaryStats,
  insights: RuleInsight[],
  experiments: RuleExperiment[],
  project?: { name?: string; category?: string; targetAudience?: string }
): RuleBrief {
  const valid = records.filter((r) => r.record_status !== "不可用");

  // ─── 目标用户 ─────────────────────────
  const targetAudience = project?.targetAudience
    || getTopAudience(valid)
    || "暂不限定";

  // ─── 推荐时长 ─────────────────────────
  const bestDurationBand = getBestDurationBand(valid);
  const recommendedDuration = bestDurationBand || "15 秒";

  // ─── 内容方向 ─────────────────────────
  const contentDirection = insights.length > 0
    ? `基于 ${stats.validCount} 条有效视频的电商数据分析，优化方向：${insights.map((i) => i.title).join("；")}。`
    : `基于 ${stats.validCount} 条有效视频的电商数据，优化内容策略。`;

  // ─── 开场方式 ─────────────────────────
  const openingStyle = "开场在 3 秒内展示产品效果或核心利益点，快速建立用户兴趣。避免铺垫过长或纯文字介绍。";

  // ─── 内容结构（各段之和 = 15s） ──────
  const contentStructure = "开场吸引（3s）→ 核心卖点展示（4s）→ 使用场景/效果证明（5s）→ 明确 CTA（3s）";
  // 3 + 4 + 5 + 3 = 15s ✓

  // ─── 表达风格 ─────────────────────────
  const expressionStyle = "采用真实使用场景、自然光线、产品特写与效果对比，建立可感知的信任感。适合抖音竖屏信息流。";

  // ─── 优化指标 ─────────────────────────
  const optimizationMetric = "优先优化：完播率；辅助观察：互动率、商品点击率、5 秒留存率。";

  // ─── 视频生成指令 ────────────────────
  const productInfo = project?.category || "商品";
  // 从洞察中提取建议测试人群
  const audienceInsight = insights.find((i) => i.id === "rule_audience");
  const recommendedAudience = audienceInsight?.groupA?.label;
  const audienceLine = recommendedAudience && recommendedAudience !== targetAudience
    ? `当前主要人群：${targetAudience}（数据分布）\n建议测试人群：${recommendedAudience}（洞察推荐）`
    : `目标用户：${targetAudience}`;

  const generationPrompt = [
    "【视频生成指令】",
    `商品：${productInfo}`,
    audienceLine,
    `建议时长：${recommendedDuration}`,
    "内容结构：开场吸引（3s）→ 核心卖点展示（4s）→ 效果证明（5s）→ 明确 CTA（3s）",
    "风格：真实使用场景，自然光线，第一人称或产品特写",
    "比例：9:16 竖屏",
    "关键要求：前3秒必须出现视觉亮点；CTA 必须明确（点击购买/领券/关注）",
    "",
    "可直接复制到视频生成模型中使用",
  ].join("\n");

  // ─── 依据 ────────────────────────────
  const references: BriefReference[] = insights.map((ins) => ({
    insightId: ins.id,
    title: ins.title,
    metric: ins.metricLabel,
    sampleSize: ins.sampleSize,
    confidenceLevel: ins.confidenceLevel,
  }));

  return {
    id: `brief_${Date.now()}`,
    experimentId: experiments[0]?.id,
    contentDirection,
    openingStyle,
    recommendedDuration,
    contentStructure,
    expressionStyle,
    optimizationMetric,
    generationPrompt,
    note: "基于规则模板生成，建议人工确认",
    references,
  };
}

function getBestDurationBand(records: VideoRecord[]): string | null {
  const groups = new Map<string, { views: number[] }>();
  for (const r of records) {
    const band = r.duration_band || "11-20秒";
    if (!groups.has(band)) groups.set(band, { views: [] });
    groups.get(band)!.views.push(r.views);
  }

  let best: string | null = null;
  let bestMed = 0;
  for (const [band, data] of groups) {
    const sorted = data.views.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    if (med > bestMed) {
      bestMed = med;
      best = band;
    }
  }
  return best;
}

function getTopAudience(records: VideoRecord[]): string | null {
  const count = new Map<string, number>();
  for (const r of records) {
    const a = r.target_audience;
    if (a) count.set(a, (count.get(a) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, v] of count) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return best;
}
