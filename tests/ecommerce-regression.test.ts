// CreatorLens 电商数据定向回归测试
// 使用 CreatorLens_Valid_Ecommerce_Content.xlsx 全链路验证

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseFile } from "@/lib/parsers";
import { validateAllRows } from "@/lib/validators";
import { runAnalysis } from "@/lib/analysis";
import { computeSummaryStats } from "@/lib/analysis/stats";
import { analyzeAllDimensions } from "@/lib/analysis/dimensions";

const FIXTURE_PATH = join(
  process.cwd(),
  "tests",
  "fixtures",
  "phase3",
  "CreatorLens_Valid_Ecommerce_Content.xlsx"
);

function loadFixture() {
  const buffer = readFileSync(FIXTURE_PATH);
  const result = parseFile(buffer, "CreatorLens_Valid_Ecommerce_Content.xlsx", buffer.length);
  if (result.error || result.blockingError) {
    throw new Error(`Fixture parse failed: ${result.error || result.blockingError}`);
  }
  const validation = validateAllRows(result.rows, result.sheetName);
  if (!validation.canAnalyze) {
    throw new Error(
      `Fixture validation failed: ${validation.blockingErrors.join("; ")}`
    );
  }
  return {
    sheetName: result.sheetName,
    validRecords: validation.validRecords,
    allRecords: validation.records,
    issues: validation.issues,
    summary: validation.summary,
  };
}

describe("电商数据回归测试", () => {
  const data = loadFixture();

  it("正确识别演示数据工作表", () => {
    expect(data.sheetName).toBe("演示数据");
  });

  it("有效样本数可复算", () => {
    // 20 条合成电商数据全部可分析
    expect(data.summary.totalRows).toBe(20);
    expect(data.summary.validRows).toBe(20);
    expect(data.summary.errorCount).toBe(0);
  });

  it("品类为小家电/便携榨汁杯（电商）", () => {
    const categories = new Set(data.validRecords.map((r) => r.category));
    expect(categories.has("小家电/便携榨汁杯")).toBe(true);
  });

  it("包含价格带电商维度数据", () => {
    const hasPriceBand = data.validRecords.some((r) => r.price_band);
    expect(hasPriceBand).toBe(true);
  });

  it("包含目标人群电商维度数据", () => {
    const hasAudience = data.validRecords.some((r) => r.target_audience);
    expect(hasAudience).toBe(true);
  });
});

describe("电商指标计算验证", () => {
  const data = loadFixture();
  const stats = computeSummaryStats(data.validRecords);

  it("播放量指标可手动复算", () => {
    // 20 条视频的播放量总和可复算
    const manualSum = data.validRecords.reduce((s, r) => s + r.views, 0);
    expect(stats.totalViews).toBe(manualSum);
    expect(stats.validCount).toBe(20);
    expect(stats.avgViews).toBeGreaterThan(0);
    expect(stats.medianViews).toBeGreaterThan(0);
  });

  it("整体互动率为加权口径", () => {
    const totalInteractions = data.validRecords.reduce(
      (s, r) => s + (r.likes ?? 0) + (r.comments ?? 0) + (r.favorites ?? 0) + (r.shares ?? 0),
      0
    );
    const expectedRate = totalInteractions / stats.totalViews;
    expect(stats.overallEngagementRate).toBeCloseTo(expectedRate, 4);
  });

  it("商品点击量和整体点击率计算正确", () => {
    const manualClicks = data.validRecords
      .filter((r) => r.product_clicks != null)
      .reduce((s, r) => s + (r.product_clicks ?? 0), 0);
    expect(stats.totalProductClicks).toBe(manualClicks);

    if (stats.totalProductClicks != null) {
      const expectedRate = stats.totalProductClicks / stats.totalViews;
      expect(stats.overallProductClickRate).toBeCloseTo(expectedRate, 4);
    }
  });

  it("订单量和转化率计算正确", () => {
    const manualOrders = data.validRecords
      .filter((r) => r.orders != null)
      .reduce((s, r) => s + (r.orders ?? 0), 0);
    expect(stats.totalOrders).toBe(manualOrders);

    if (stats.totalOrders != null && stats.totalProductClicks != null && stats.totalProductClicks > 0) {
      const expectedRate = stats.totalOrders / stats.totalProductClicks;
      expect(stats.overallConversionRate).toBeCloseTo(expectedRate, 4);
    }
  });
});

describe("电商维度分析", () => {
  const data = loadFixture();
  const dims = analyzeAllDimensions(data.validRecords);

  it("包含时长区间维度", () => {
    const durDim = dims.find((d) => d.dimension === "duration_band");
    expect(durDim).toBeDefined();
    expect(durDim!.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("包含价格带维度", () => {
    const priceDim = dims.find((d) => d.dimension === "price_band");
    expect(priceDim).toBeDefined();
  });

  it("包含目标人群维度", () => {
    const audienceDim = dims.find((d) => d.dimension === "target_audience");
    expect(audienceDim).toBeDefined();
  });

  it("分组置信度符合样本量规则", () => {
    for (const dim of dims) {
      for (const group of dim.groups) {
        if (group.sampleSize <= 1) expect(group.confidenceLevel).toBe("仅展示");
        if (group.sampleSize === 2) expect(group.confidenceLevel).toBe("低");
      }
    }
  });
});

describe("电商洞察与建议", () => {
  const data = loadFixture();
  const result = runAnalysis({
    projectId: "ecommerce_test",
    project: { name: "电商测试", category: "小家电/便携榨汁杯" },
    records: data.validRecords,
  });
  const insights = result.report.insights;
  const experiments = result.report.experiments;
  const brief = result.report.briefs[0];

  it("生成电商相关洞察", () => {
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.title).not.toMatch(/知识|经验|课程|教育|学习平台/i);
    }
  });

  it("洞察不使用因果断言", () => {
    for (const insight of insights) {
      expect(insight.title).not.toMatch(/导致|一定|保证/);
    }
  });

  it("A/B 实验标注为建议实验", () => {
    for (const exp of experiments) {
      expect(exp.note).toContain("尚未执行");
    }
  });

  it("创作 Brief 面向电商运营场景", () => {
    expect(brief.generationPrompt).toContain("视频生成指令");
    expect(brief.generationPrompt).not.toMatch(/vflow/gi);
  });
});

describe("更换数据后结果变化", () => {
  it("不同数据集产生不同报告", () => {
    const data1 = loadFixture();
    const report1 = runAnalysis({
      projectId: "test_ecommerce_1",
      records: data1.validRecords,
    });

    // 用一半数据生成第二个报告
    const halfRecords = data1.validRecords.slice(0, 10);
    const report2 = runAnalysis({
      projectId: "test_ecommerce_2",
      records: halfRecords,
    });

    // 指标不同
    expect(report1.report.overview.metrics.medianViews).not.toBe(
      report2.report.overview.metrics.medianViews
    );
    expect(report1.report.overview.summary.validVideoCount).toBe(20);
    expect(report2.report.overview.summary.validVideoCount).toBe(10);
  });
});

describe("无旧数据定位残留", () => {
  it("报告和统计不含非电商定位术语", () => {
    const data = loadFixture();
    const result = runAnalysis({
      projectId: "test_clean",
      records: data.validRecords,
    });

    const reportStr = JSON.stringify(result.report);
    const banned = ["知识分享", "经验分享", "课程", "教育平台", "讲师"];
    for (const word of banned) {
      expect(reportStr).not.toContain(word);
    }
  });

  it("不存在针对特定品类硬编码的判断", () => {
    const data = loadFixture();
    const result = runAnalysis({
      projectId: "test_hardcode",
      records: data.validRecords,
    });

    // 洞察标题和建议不应硬编码特定品类名称（应为数据驱动）
    for (const insight of result.report.insights) {
      const combined = insight.title + insight.recommendedAction;
      expect(combined).not.toContain("便携榨汁杯");
      expect(combined).not.toContain("盈Go");
    }
  });
});
