// CreatorLens 分析编排器
// Phase 5: 串联统计 → 维度 → 规则洞察 → 检索 → 实验 → Brief → LLM 上下文
// runAnalysis 保持同步；LLM 调用在 Route Handler 异步执行

import type { VideoRecord, Report, GroupComparison, KnowledgeRef, AnalysisSnapshot } from "@/types";
import { computeSummaryStats, topByViews } from "./stats";
import { analyzeAllDimensions } from "./dimensions";
import { generateInsights, type RuleInsight } from "./insights";
import { generateExperiments } from "./experiments";
import { generateBrief } from "./briefs";
import { retrieveCards, type RetrievalOutput } from "../knowledge/retrieval";
import { buildLLMContextData, type LLMContextData } from "./llm-insights";

export interface AnalysisInput {
  projectId: string;
  project?: {
    name?: string;
    category?: string;
    priceBand?: string;
    targetAudience?: string;
    analysisGoal?: string;
  };
  records: VideoRecord[];
}

export interface AnalysisOutput {
  report: Report;
  /** 检索结果 */
  retrievalOutput: RetrievalOutput;
  /** LLM 上下文数据（供 Route Handler 异步调用） */
  llmContextData: LLMContextData;
  /** Phase 4 规则洞察（供降级和校验使用） */
  ruleInsights: RuleInsight[];
}

/**
 * 执行完整分析，返回 Report + 检索结果 + LLM 上下文
 * Phase 5: 新增检索步骤和 LLM 上下文构建
 */
export function runAnalysis(input: AnalysisInput): AnalysisOutput {
  const { projectId, project, records } = input;
  const valid = records.filter((r) => r.record_status !== "不可用");

  // ─── 统计 ──────────────────────────────────
  const stats = computeSummaryStats(valid);

  // ─── Top/Bottom ────────────────────────────
  const topByViewsList = topByViews(valid, 3);

  // ─── 维度 ──────────────────────────────────
  const dimensions = analyzeAllDimensions(valid);

  // ─── Phase 4 规则洞察（始终生成，作为降级方案）───
  const ruleInsights = generateInsights(valid, stats, dimensions);

  // ─── Phase 5: 策略知识检索 ────────────────
  // 从 Phase 4 结果中提取弱项
  const weaknesses: string[] = [];
  if (stats.avgCompletionRate != null && stats.avgCompletionRate < 0.35) {
    weaknesses.push("完播率低");
  }
  if (stats.overallEngagementRate != null && stats.overallEngagementRate < 0.05) {
    weaknesses.push("互动不足");
  }
  if (stats.overallProductClickRate != null && stats.overallProductClickRate < 0.03) {
    weaknesses.push("点击率低");
  }
  if (stats.overallConversionRate != null && stats.overallConversionRate < 0.02) {
    weaknesses.push("转化率低");
  }

  // 获取最常见的时长区间
  const durBandCounts = new Map<string, number>();
  for (const r of valid) {
    if (r.duration_band) {
      durBandCounts.set(r.duration_band, (durBandCounts.get(r.duration_band) || 0) + 1);
    }
  }
  let topDurationBand = "";
  let topDurCount = 0;
  for (const [band, count] of durBandCounts) {
    if (count > topDurCount) { topDurCount = count; topDurationBand = band; }
  }

  const retrievalOutput = retrieveCards({
    category: project?.category || getTopCategory(valid),
    price_band: project?.priceBand || getTopPriceBand(valid),
    target_audience: project?.targetAudience || getTopAudienceFromRecords(valid),
    duration_band: topDurationBand,
    weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
  });

  // ─── 实验 ──────────────────────────────────
  const experiments = generateExperiments(ruleInsights);

  // ─── Brief ──────────────────────────────────
  const brief = generateBrief(valid, stats, ruleInsights, experiments, project);

  // ─── 构建知识引用（从检索结果）─────────────
  const knowledgeRefs: KnowledgeRef[] = retrievalOutput.results.map((rr) => ({
    id: rr.card.id,
    title: rr.card.title,
    summary: rr.card.strategy,
    source: rr.card.source_title,
    applicableCategory: rr.card.applicable_categories.join("、"),
    applicablePriceBand: rr.card.price_bands.join("、") || "不限",
    matchReason: rr.why_retrieved,
    sourceUrl: rr.card.source_url,
    sourceType: rr.card.source_type,
  }));

  // ─── 构建报告（Phase 4 规则洞察作为初始洞察）───
  const now = new Date().toISOString();

  const report: Report = {
    projectId,
    generatedAt: now,
    overview: {
      summary: {
        validVideoCount: stats.validCount,
        dateRange: stats.dateRange || { start: "未知", end: "未知" },
        missingFieldCount: records.length - valid.length,
      },
      metrics: {
        medianViews: stats.medianViews,
        avgViews: stats.avgViews,
        totalViews: stats.totalViews,
        avgCompletionRate: stats.avgCompletionRate ?? 0,
        avgEngagementRate: stats.overallEngagementRate ?? 0,
        avgProductClickRate: stats.overallProductClickRate ?? undefined,
        totalProductClicks: stats.totalProductClicks ?? undefined,
        overallConversionRate: stats.overallConversionRate ?? undefined,
        totalOrders: stats.totalOrders ?? undefined,
      },
      topVideos: topByViewsList.map((v) => ({
        video_id: v.video_id,
        title: v.title,
        views: v.views,
        completion_rate: v.completion_rate,
        engagement_rate: v.engagement_rate,
        product_clicks: v.product_clicks,
        orders: v.orders,
        tags: [v.duration_band, v.category].filter(Boolean) as string[],
      })),
      bottomVideos: valid
        .sort((a, b) => a.views - b.views)
        .slice(0, 3)
        .map((r) => ({
          video_id: r.video_id,
          title: r.title,
          views: r.views,
          completion_rate: r.completion_rate,
          engagement_rate: r.engagement_rate,
          product_clicks: r.product_clicks,
          orders: r.orders,
          tags: [r.duration_band].filter(Boolean) as string[],
        })),
      groupComparisons: dimensions.flatMap((d) => {
        const sorted = [...d.groups].filter((g) => g.sampleSize > 0).sort((a, b) => b.sampleSize - a.sampleSize);
        const entries: GroupComparison[] = [];
        for (let i = 0; i < sorted.length; i += 2) {
          const a = sorted[i];
          const b = sorted[i + 1];
          entries.push({
            dimension: d.dimensionLabel,
            groupA: { label: `${a.label} (n=${a.sampleSize})`, n: a.sampleSize, median: a.medianViews },
            groupB: b
              ? { label: `${b.label} (n=${b.sampleSize})`, n: b.sampleSize, median: b.medianViews }
              : { label: "-", n: 0, median: 0 },
          });
        }
        if (entries.length === 1 && entries[0].groupB.n === 0) {
          entries[0].groupB = { label: "整体均值", n: valid.length, median: stats.avgViews };
        }
        if (entries.length > 1) {
          for (let i = 1; i < entries.length; i++) {
            entries[i].dimension = "";
          }
        }
        return entries;
      }),
    },
    // 初始使用规则洞察，LLM 成功后会替换
    insights: ruleInsights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      claimType: "correlation" as const,
      metric: insight.metric,
      metricLabel: insight.metricLabel,
      groupA: insight.groupA,
      groupB: insight.groupB,
      absoluteDelta: insight.absoluteDelta,
      relativeDelta: insight.groupB.median > 0
        ? Math.round((insight.groupA.median / insight.groupB.median - 1) * 10000) / 10000
        : null,
      confidenceLevel: insight.confidenceLevel,
      limitations: [
        "基于规则模板生成，尚未经过受控实验验证",
        "在本次样本中观察到的关联不代表因果关系",
        "AI 增强暂不可用，展示规则洞察",
      ],
      knowledgeRefs: [],
      recommendedAction: insight.actionableAdvice,
      evidenceVideos: insight.evidenceVideos,
      source: insight.source,
      supportingMetrics: insight.supportingMetrics,
      facts: insight.facts,
      aiAssisted: false,
    })),
    experiments: experiments.map((exp) => ({
      id: exp.id,
      insightId: exp.insightId,
      hypothesis: exp.hypothesis,
      testVariable: exp.testVariable,
      controlVariables: exp.controlVariables,
      versionA: exp.versionA,
      versionB: exp.versionB,
      primaryMetric: exp.primaryMetric,
      secondaryMetrics: exp.secondaryMetrics,
      minSamples: exp.minSamples,
      decisionRule: exp.decisionRule,
      note: exp.note,
    })),
    briefs: [
      {
        id: brief.id,
        experimentId: brief.experimentId || "",
        goal: brief.contentDirection,
        productInfo: `${project?.category || ""} · 目标用户：${project?.targetAudience || getTopAudienceFromRecords(valid)}`,
        recommendedHook: brief.openingStyle,
        contentStructure: brief.contentStructure,
        controls: [
          "商品与卖点不变",
          "发布时间段相近",
          "风格与拍摄方式一致",
        ],
        generationPrompt: brief.generationPrompt,
        references: brief.references.map((ref) => ({
          insightId: ref.insightId,
          title: ref.title,
          metric: ref.metric,
          sampleSize: ref.sampleSize,
          confidenceLevel: ref.confidenceLevel,
        })),
      },
    ],
    knowledgeRefs,
    insightSource: "rule",
  };

  // ─── 构建 LLM 上下文 ──────────────────────
  const llmContextData = buildLLMContextData(
    stats,
    dimensions,
    ruleInsights,
    retrievalOutput.results,
    records,
    project
  );

  // ─── 分析快照 ──────────────────────────────
  const snapshot: AnalysisSnapshot = {
    analysisId: projectId,
    promptVersion: "phase5-v1",
    generatedAt: now,
    retrievalInput: {
      category: project?.category,
      price_band: project?.priceBand,
      target_audience: project?.targetAudience,
      duration_band: topDurationBand,
      weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
    },
    retrievedCardIds: retrievalOutput.results.map((r) => r.card.id),
    llmInsightCount: 0,
    validatedInsightCount: 0,
    fallbackReason: "LLM 尚未调用",
  };
  report.analysisSnapshot = snapshot;

  return { report, retrievalOutput, llmContextData, ruleInsights };
}

// ─── 辅助函数 ────────────────────────────────

function getTopAudienceFromRecords(records: VideoRecord[]): string {
  const count = new Map<string, number>();
  for (const r of records) {
    const a = r.target_audience;
    if (a) count.set(a, (count.get(a) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, v] of count) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return best;
}

function getTopCategory(records: VideoRecord[]): string {
  const count = new Map<string, number>();
  for (const r of records) {
    const c = r.category;
    if (c) count.set(c, (count.get(c) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, v] of count) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return best;
}

function getTopPriceBand(records: VideoRecord[]): string | undefined {
  const count = new Map<string, number>();
  for (const r of records) {
    const p = r.price_band;
    if (p) count.set(p, (count.get(p) || 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [k, v] of count) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return best;
}
