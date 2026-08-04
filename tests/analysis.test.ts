// CreatorLens 统计分析测试
// Phase 4: 验证所有统计计算、洞察生成、实验Brief

import { describe, it, expect } from "vitest";
import { computeSummaryStats } from "@/lib/analysis/stats";
import { analyzeAllDimensions, analyzeDurationBand } from "@/lib/analysis/dimensions";
import { generateInsights } from "@/lib/analysis/insights";
import { generateExperiments } from "@/lib/analysis/experiments";
import { generateBrief } from "@/lib/analysis/briefs";
import { runAnalysis } from "@/lib/analysis";
import type { VideoRecord } from "@/types";

function makeRecord(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    video_id: "V001", category: "小家电", title: "测试视频",
    views: 10000, likes: 500, comments: 50, favorites: 200, shares: 100,
    completion_rate: 0.4, five_sec_retention: 0.7,
    duration_seconds: 15, duration_band: "11-20秒",
    engagement_rate: 0.085, data_quality_score: 1, record_status: "可分析",
    ...overrides,
  };
}

function makeRecords(variations: Partial<VideoRecord>[]): VideoRecord[] {
  return variations.map((v, i) =>
    makeRecord({ video_id: `V${String(i + 1).padStart(3, "0")}`, ...v })
  );
}

describe("统计分析 (stats)", () => {
  it("总量、平均数、中位数计算正确", () => {
    const records = makeRecords([
      { views: 10000 }, { views: 20000 }, { views: 15000 },
      { views: 25000 }, { views: 12000 },
    ]);
    const stats = computeSummaryStats(records);
    expect(stats.validCount).toBe(5);
    expect(stats.totalViews).toBe(82000);
    expect(stats.avgViews).toBe(16400);
    expect(stats.medianViews).toBe(15000);
  });

  it("互动率采用加权口径", () => {
    const records = makeRecords([
      { video_id: "V001", views: 1000, likes: 100, comments: 0, favorites: 0, shares: 0, engagement_rate: 0.1 },
      { video_id: "V002", views: 10000, likes: 50, comments: 20, favorites: 20, shares: 10, engagement_rate: 0.01 },
    ]);
    const stats = computeSummaryStats(records);
    expect(stats.overallEngagementRate).toBeCloseTo(0.0182, 3);
  });

  it("分母为0时不出现NaN/Infinity", () => {
    const records = makeRecords([{ views: 0 }, { views: 10000 }]);
    const stats = computeSummaryStats(records);
    expect(isNaN(stats.avgViews)).toBe(false);
  });

  it("空字段不填0或编造数字", () => {
    const records = makeRecords([{
      video_id: "V001", views: 10000, likes: 0, comments: 0, favorites: 0, shares: 0,
      completion_rate: undefined, product_clicks: undefined, orders: undefined,
    }]);
    const stats = computeSummaryStats(records);
    expect(stats.avgCompletionRate).toBeNull();
    expect(stats.overallProductClickRate).toBeNull();
  });
});

describe("维度分析 (dimensions)", () => {
  it("标签分组正确且含置信度", () => {
    const records = makeRecords([
      { duration_band: "11-20秒", views: 15000 },
      { duration_band: "11-20秒", views: 12000 },
      { duration_band: "21-30秒", views: 8000 },
    ]);
    const result = analyzeDurationBand(records);
    const short = result.groups.find((g) => g.label === "11-20秒")!;
    expect(short.sampleSize).toBe(2);
    expect(short.confidenceLevel).toBe("低");
  });

  it("单样本标签置信度为仅展示", () => {
    const records = makeRecords([
      { duration_band: "11-20秒", views: 10000 },
      { duration_band: "11-20秒", views: 12000 },
      { duration_band: ">30秒", views: 5000 },
    ]);
    const result = analyzeDurationBand(records);
    const longGroup = result.groups.find((g) => g.label === ">30秒")!;
    expect(longGroup.confidenceLevel).toBe("仅展示");
  });
});

describe("洞察生成 (insights)", () => {
  it("优先使用可操作维度生成洞察", () => {
    const records = makeRecords([
      { duration_band: "11-20秒", views: 15000, target_audience: "上班族" },
      { duration_band: "11-20秒", views: 12000, target_audience: "学生" },
      { duration_band: "21-30秒", views: 8000, target_audience: "上班族" },
      { duration_band: "21-30秒", views: 7000, target_audience: "学生" },
    ]);
    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const insights = generateInsights(records, stats, dims);

    expect(insights.length).toBeGreaterThan(0);
    // 第一条应该是可操作维度（时长或人群），不是循环结论
    const firstId = insights[0].id;
    expect(["rule_duration", "rule_audience", "rule_completion", "rule_price"]).toContain(firstId);
  });

  it("样本不足时不假设高置信度", () => {
    const records = makeRecords([
      { duration_band: "11-20秒", views: 15000 },
      { duration_band: ">30秒", views: 8000 },
    ]);
    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const insights = generateInsights(records, stats, dims);
    for (const ins of insights) {
      expect(ins.confidenceLevel).not.toBe("较高");
    }
  });

  it("洞察不使用因果断言", () => {
    const records = makeRecords(
      Array.from({ length: 10 }, (_, i) => ({
        views: 10000 + i * 1000, duration_band: i < 5 ? "11-20秒" : "21-30秒",
        completion_rate: 0.3 + (i % 5) * 0.1,
      }))
    );
    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const insights = generateInsights(records, stats, dims);
    for (const ins of insights) {
      expect(ins.title).not.toMatch(/导致|一定|保证/);
      expect(ins.facts).not.toMatch(/导致|一定|保证/);
    }
  });

  it("携带真实统计数据", () => {
    const records = makeRecords(
      Array.from({ length: 10 }, (_, i) => ({
        views: 10000 + i * 1000, duration_band: i < 6 ? "11-20秒" : "21-30秒",
        completion_rate: 0.3 + i * 0.05,
      }))
    );
    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const insights = generateInsights(records, stats, dims);
    for (const ins of insights) {
      expect(ins.groupA.median).toBeGreaterThan(0);
      expect(ins.groupB.median).toBeGreaterThan(0);
      expect(ins.absoluteDelta).toBeGreaterThan(0);
    }
  });
});

describe("实验与 Brief 生成", () => {
  it("实验标注建议且不代表统计显著", () => {
    const records = makeRecords(
      Array.from({ length: 10 }, (_, i) => ({ views: 10000 + i * 1000, duration_band: i < 5 ? "11-20秒" : "21-30秒" }))
    );
    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const insights = generateInsights(records, stats, dims);
    const experiments = generateExperiments(insights);
    for (const exp of experiments) {
      expect(exp.note).toContain("尚未执行");
      expect(exp.note).toContain("不代表统计显著");
    }
  });

  it("Brief 目标用户来自数据", () => {
    const records = makeRecords(
      Array.from({ length: 10 }, (_, i) => ({
        views: 5000 + i * 2000, duration_band: "11-20秒",
        target_audience: i < 5 ? "上班族" : "学生",
        completion_rate: 0.3 + i * 0.05,
      }))
    );
    const stats = computeSummaryStats(records);
    const dims = analyzeAllDimensions(records);
    const insights = generateInsights(records, stats, dims);
    const brief = generateBrief(records, stats, insights, [], { category: "小家电" });
    const hasUserLine = brief.generationPrompt.includes("目标用户") || brief.generationPrompt.includes("当前主要人群");
    expect(hasUserLine).toBe(true);
    expect(brief.generationPrompt).not.toContain("最终验收");
  });

  it("Brief 各段时长之和不超过推荐总时长", () => {
    const records = makeRecords(
      Array.from({ length: 10 }, (_, i) => ({ views: 5000 + i * 2000 }))
    );
    const brief = generateBrief(records, computeSummaryStats(records), [], []);
    // 结构: 3s + 4s + 5s + 3s = 15s
    expect(brief.contentStructure).toMatch(/3s.*4s.*5s.*3s/);
  });

  it("Brief 不含 VFlow", () => {
    const records = makeRecords(Array.from({ length: 10 }, (_, i) => ({ views: 10000 + i * 1000 })));
    const brief = generateBrief(records, computeSummaryStats(records), [], []);
    expect(brief.generationPrompt).not.toMatch(/vflow/gi);
    expect(brief.note).toContain("基于规则模板生成");
  });
});

describe("完整分析编排 (runAnalysis)", () => {
  it("不同数据产生不同报告", () => {
    const data1 = makeRecords(Array.from({ length: 10 }, (_, i) => ({ views: 50000 - i * 4000 })));
    const data2 = makeRecords(Array.from({ length: 10 }, (_, i) => ({ views: 5000 - i * 400 })));
    const r1 = runAnalysis({ projectId: "t1", records: data1 });
    const r2 = runAnalysis({ projectId: "t2", records: data2 });
    expect(r1.report.overview.metrics.medianViews).not.toBe(r2.report.overview.metrics.medianViews);
  });

  it("错误记录不参与统计", () => {
    const records = [
      makeRecord({ video_id: "V001", views: 10000, record_status: "可分析" }),
      makeRecord({ video_id: "V002", views: 20000, record_status: "可分析" }),
      makeRecord({ video_id: "V003", views: 99999, record_status: "不可用" }),
    ];
    const report = runAnalysis({ projectId: "test", records });
    expect(report.report.overview.summary.validVideoCount).toBe(2);
  });

  it("洞察证据不为空", () => {
    const records = makeRecords(
      Array.from({ length: 12 }, (_, i) => ({
        views: 10000 + i * 1000, duration_band: i < 6 ? "11-20秒" : "21-30秒",
        completion_rate: 0.3 + i * 0.05, target_audience: i < 4 ? "上班族" : "学生",
      }))
    );
    const report = runAnalysis({ projectId: "test", records });
    for (const ins of report.report.insights) {
      expect(ins.groupA.median).toBeGreaterThan(0);
      expect(ins.groupB.median).toBeGreaterThan(0);
      expect(ins.evidenceVideos.length).toBeGreaterThan(0);
    }
  });
});
