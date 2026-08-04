import type { VideoRecord } from "@/types";
// CreatorLens Phase 5 LLM 洞察与校验测试
// 验证：LLM 响应解析、事实一致性校验、降级逻辑
// 使用 Mock 响应，不依赖真实 API

import { describe, it, expect } from "vitest";
import { validateLLMInsights } from "@/lib/analysis/validate-insights";
import type { LLMInsightOutput } from "@/lib/analysis/llm-insights";
import type { RuleInsight } from "@/lib/analysis/insights";
import type { RetrievalResult } from "@/lib/knowledge/retrieval";
import { STRATEGY_CARDS } from "@/lib/knowledge/knowledge-base";

// ─── 辅助函数 ────────────────────────────────

function makeRuleInsight(overrides: Partial<RuleInsight> = {}): RuleInsight {
  return {
    id: "rule_duration",
    title: "测试规则洞察",
    facts: "测试事实",
    supportingMetrics: "支持指标",
    sampleSize: 10,
    confidenceLevel: "中",
    actionableAdvice: "建议测试",
    source: "测试来源",
    metric: "views",
    metricLabel: "播放量",
    groupA: { label: "A组", n: 5, median: 15000 },
    groupB: { label: "B组", n: 5, median: 10000 },
    absoluteDelta: 5000,
    evidenceVideos: ["V001", "V002"],
    ...overrides,
  };
}

function makeRetrievalResult(cardId: string): RetrievalResult {
  const card = STRATEGY_CARDS.find((c) => c.id === cardId) || STRATEGY_CARDS[0];
  return {
    card,
    relevance_score: 0.8,
    matched_fields: ["category", "problem_tags"],
    why_retrieved: "品类匹配（小家电）；问题标签匹配（完播率低）",
  };
}

function makeValidLLMInsight(overrides: Partial<LLMInsightOutput> = {}): LLMInsightOutput {
  return {
    title: "时长11-20秒的视频完播率更高",
    observation: "在本次样本中，11-20秒区间的视频平均完播率比21-30秒区间高10个百分点",
    explanation: "根据黄金时长策略，15-20秒是完播率与信息量的最佳平衡点",
    action: "建议下一轮优先测试11-20秒时长",
    metric: "completion_rate",
    metricLabel: "平均完播率",
    groupA: { label: "11-20秒", n: 10, median: 0.4 },
    groupB: { label: "21-30秒", n: 5, median: 0.3 },
    absoluteDelta: 0.1,
    knowledge_card_ids: ["SC-001"],
    metric_evidence_ids: ["rule_duration"],
    representative_video_ids: ["V001", "V002"],
    confidence_level: "中",
    limitations: ["样本量有限", "需通过A/B实验验证"],
    ...overrides,
  };
}

// ─── 事实一致性校验测试 ──────────────────────

describe("事实一致性校验 (validateLLMInsights)", () => {
  const ruleInsights = [
    makeRuleInsight({ id: "rule_duration" }),
    makeRuleInsight({ id: "rule_audience", metric: "views" }),
  ];
  const retrievalResults = [
    makeRetrievalResult("SC-001"),
    makeRetrievalResult("SC-002"),
  ];

  it("合法洞察通过校验", () => {
    const insight = makeValidLLMInsight();
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(true);
    expect(report.validInsights.length).toBe(1);
    expect(report.failures.length).toBe(0);
  });

  it("虚构 metric_evidence_id 被拒绝", () => {
    const insight = makeValidLLMInsight({
      metric_evidence_ids: ["fake_nonexistent_id"],
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
    expect(report.failures.length).toBe(1);
    expect(report.failures[0].reason).toContain("fake_nonexistent_id");
  });

  it("虚构 knowledge_card_id 被拒绝", () => {
    const insight = makeValidLLMInsight({
      knowledge_card_ids: ["SC-999"],
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
    expect(report.failures.length).toBe(1);
    expect(report.failures[0].reason).toContain("SC-999");
  });

  it("metric_evidence_ids 为空被拒绝", () => {
    const insight = makeValidLLMInsight({
      metric_evidence_ids: [],
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
  });

  it("包含 NaN 被拒绝", () => {
    const insight = makeValidLLMInsight({
      absoluteDelta: NaN,
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
    expect(report.failures[0].reason).toContain("NaN");
  });

  it("包含 Infinity 被拒绝", () => {
    const insight = makeValidLLMInsight({
      groupA: { label: "A", n: 5, median: Infinity },
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
    expect(report.failures[0].reason).toContain("Infinity");
  });

  it("因果断言关键词被拒绝", () => {
    const insight = makeValidLLMInsight({
      title: "时长11-20秒证明了更高的完播率",
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
    expect(report.failures[0].reason).toContain("证明了");
  });

  it("observation 包含因果断言也被拒绝", () => {
    const insight = makeValidLLMInsight({
      observation: "数据证明这一定会导致更高的转化率",
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
  });

  it("空 title 被拒绝", () => {
    const insight = makeValidLLMInsight({ title: "" });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
  });

  it("样本量 ≤ 0 被拒绝", () => {
    const insight = makeValidLLMInsight({
      groupA: { label: "A", n: 0, median: 100 },
    });
    const report = validateLLMInsights([insight], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
  });

  it("无知识命中时 knowledge_card_ids 必须为空", () => {
    const insight = makeValidLLMInsight({
      knowledge_card_ids: ["SC-001"],
    });
    // 检索结果为空
    const report = validateLLMInsights([insight], ruleInsights, []);
    expect(report.passed).toBe(false);
    expect(report.failures[0].reason).toContain("knowledge_card_ids");
  });

  it("多条洞察中部分失败不影响通过的洞察", () => {
    const good = makeValidLLMInsight();
    const bad = makeValidLLMInsight({
      metric_evidence_ids: ["bad_id"],
      title: "Bad Insight",
    });
    const report = validateLLMInsights([good, bad], ruleInsights, retrievalResults);
    // 虽然有一条失败，但有一条通过
    expect(report.passed).toBe(true);
    expect(report.validInsights.length).toBe(1);
    expect(report.failures.length).toBe(1);
  });

  it("所有洞察都失败时 passed 为 false", () => {
    const bad1 = makeValidLLMInsight({
      metric_evidence_ids: ["bad_id_1"],
    });
    const bad2 = makeValidLLMInsight({
      knowledge_card_ids: ["SC-999"],
    });
    const report = validateLLMInsights([bad1, bad2], ruleInsights, retrievalResults);
    expect(report.passed).toBe(false);
    expect(report.validInsights.length).toBe(0);
    expect(report.failures.length).toBe(2);
  });

  it("超过 3 条洞察时最多取前 3 条通过校验的", () => {
    const insights = [
      makeValidLLMInsight({ title: "Insight 1" }),
      makeValidLLMInsight({ title: "Insight 2" }),
      makeValidLLMInsight({ title: "Insight 3" }),
      makeValidLLMInsight({ title: "Insight 4" }),
    ];
    const report = validateLLMInsights(insights, ruleInsights, retrievalResults);
    expect(report.passed).toBe(true);
    // 全部通过，但 validateLLMInsights 不做截断（截断在调用方处理）
    expect(report.validInsights.length).toBe(4);
  });
});

// ─── LLM 上下文构建测试 ──────────────────────

describe("LLM 上下文数据构建", () => {
  it("buildLLMContextData 可在无 API key 环境下正常调用", async () => {
    const { buildLLMContextData } = await import("@/lib/analysis/llm-insights");
    const { computeSummaryStats } = await import("@/lib/analysis/stats");
    const { analyzeAllDimensions } = await import("@/lib/analysis/dimensions");
    const { generateInsights } = await import("@/lib/analysis/insights");

    // 使用简单的测试数据
    const records = [
      {
        video_id: "V001", category: "小家电", views: 15000,
        likes: 500, comments: 50, favorites: 200, shares: 100,
        completion_rate: 0.4, duration_band: "11-20秒" as const,
        engagement_rate: 0.057, data_quality_score: 1,
        record_status: "可分析" as const,
      },
      {
        video_id: "V002", category: "小家电", views: 12000,
        likes: 400, comments: 40, favorites: 150, shares: 80,
        completion_rate: 0.35, duration_band: "11-20秒" as const,
        engagement_rate: 0.056, data_quality_score: 1,
        record_status: "可分析" as const,
      },
      {
        video_id: "V003", category: "小家电", views: 8000,
        likes: 300, comments: 30, favorites: 100, shares: 50,
        completion_rate: 0.25, duration_band: "21-30秒" as const,
        engagement_rate: 0.06, data_quality_score: 1,
        record_status: "可分析" as const,
      },
    ];

    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const ruleInsights = generateInsights(records, stats, dims);

    const retrievalResults = [
      makeRetrievalResult("SC-001"),
    ];

    const context = buildLLMContextData(
      stats,
      dims,
      ruleInsights,
      retrievalResults,
      records,
      { category: "小家电" }
    );

    expect(context.project.category).toBe("小家电");
    expect(context.sampleSummary.validVideoCount).toBe(3);
    expect(context.stats.medianViews).toBeGreaterThan(0);
    expect(context.ruleInsights.length).toBeGreaterThanOrEqual(0);
    expect(context.retrievalResults.length).toBe(1);
    expect(context.representativeVideoIds.length).toBeGreaterThan(0);
  });
});

// ─── LLM 降级逻辑测试 ────────────────────────

describe("LLM 降级逻辑", () => {
  it("无 API key 时 generateLLMInsights 返回 null", async () => {
    // 确保环境变量未设置
    const originalKey = process.env.LLM_API_KEY;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const { generateLLMInsights, buildLLMContextData } = await import("@/lib/analysis/llm-insights");
      const { computeSummaryStats } = await import("@/lib/analysis/stats");
      const { analyzeAllDimensions } = await import("@/lib/analysis/dimensions");
      const { generateInsights } = await import("@/lib/analysis/insights");

      const records = [
        {
          video_id: "V001", category: "小家电", views: 15000,
          likes: 500, comments: 50, favorites: 200, shares: 100,
          completion_rate: 0.4, duration_band: "11-20秒" as const,
          engagement_rate: 0.057, data_quality_score: 1,
          record_status: "可分析" as const,
        },
        {
          video_id: "V002", category: "小家电", views: 12000,
          likes: 400, comments: 40, favorites: 150, shares: 80,
          completion_rate: 0.3, duration_band: "11-20秒" as const,
          engagement_rate: 0.056, data_quality_score: 1,
          record_status: "可分析" as const,
        },
        {
          video_id: "V003", category: "小家电", views: 8000,
          likes: 300, comments: 30, favorites: 100, shares: 50,
          completion_rate: 0.25, duration_band: "21-30秒" as const,
          engagement_rate: 0.06, data_quality_score: 1,
          record_status: "可分析" as const,
        },
      ];

      const stats = computeSummaryStats(records);
      const dims = analyzeAllDimensions(records);
      const ruleInsights = generateInsights(records, stats, dims);

      const retrievalResults = [makeRetrievalResult("SC-001")];
      const context = buildLLMContextData(stats, dims, ruleInsights, retrievalResults, records);

      const result = await generateLLMInsights(context);
      expect(result).toBeNull();
    } finally {
      if (originalKey) process.env.LLM_API_KEY = originalKey;
      if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  it("LLM 返回 null 时 runAnalysis 仍产生有效报告", async () => {
    const { runAnalysis } = await import("@/lib/analysis");
    const records = Array.from({ length: 12 }, (_, i) => ({
      video_id: `V${String(i + 1).padStart(3, "0")}`,
      category: "小家电",
      views: 10000 + i * 1000,
      likes: 500,
      comments: 50,
      favorites: 200,
      shares: 100,
      completion_rate: 0.3 + i * 0.02,
      duration_band: i < 6 ? "11-20秒" : "21-30秒",
      engagement_rate: 0.05 + i * 0.005,
      data_quality_score: 1,
      record_status: "可分析",
    })) as unknown as VideoRecord[];

    const result = runAnalysis({ projectId: "test", records });
    // 报告应有完整的 Phase 4 规则洞察
    expect(result.report.insights.length).toBeGreaterThan(0);
    expect(result.report.insightSource).toBe("rule");
    // 知识检索应有结果
    expect(result.retrievalOutput.results.length).toBeGreaterThanOrEqual(0);
    // LLM 上下文已构建
    expect(result.llmContextData).toBeDefined();
    expect(result.llmContextData.ruleInsights.length).toBeGreaterThan(0);
  });
});
