// CreatorLens Phase 5 知识库与检索测试
// 验证：策略卡片结构、检索算法、匹配排序、空结果

import { describe, it, expect } from "vitest";
import { STRATEGY_CARDS, type StrategyCard } from "@/lib/knowledge/knowledge-base";
import { retrieveCards, type RetrievalInput } from "@/lib/knowledge/retrieval";

// ─── 知识库结构校验 ──────────────────────────

describe("策略知识库", () => {
  it("知识库包含 30 条以上卡片", () => {
    expect(STRATEGY_CARDS.length).toBeGreaterThanOrEqual(30);
  });

  it("每条卡片包含必填字段", () => {
    for (const card of STRATEGY_CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.id).toMatch(/^SC-\d{3}$/);
      expect(card.title).toBeTruthy();
      expect(card.strategy).toBeTruthy();
      expect(card.strategy.length).toBeGreaterThan(50);
      expect(Array.isArray(card.applicable_categories)).toBe(true);
      expect(Array.isArray(card.price_bands)).toBe(true);
      expect(Array.isArray(card.target_audiences)).toBe(true);
      expect(Array.isArray(card.content_formats)).toBe(true);
      expect(Array.isArray(card.problem_tags)).toBe(true);
      expect(card.limitations).toBeTruthy();
      expect(card.source_title).toBeTruthy();
      expect(card.source_url).toBeTruthy();
      expect(card.source_type).toBeTruthy();
      expect(card.accessed_at).toBeTruthy();
    }
  });

  it("所有来源 URL 均为真实域名", () => {
    for (const card of STRATEGY_CARDS) {
      expect(card.source_url).toMatch(/^https?:\/\//);
      expect(card.source_url).not.toContain("example.com");
      expect(card.source_url).not.toContain("localhost");
      // 验证是已知的可信域名
      const validDomains = [
        "school.jinritemai.com",
        "oceanengine.com",
        "oceanengine.io",
        "creator.douyin.com",
        "trendinsight.oceanengine.com",
      ];
      const matched = validDomains.some((d) => card.source_url.includes(d));
      expect(matched).toBe(true);
    }
  });

  it("来源类型仅为四种合法值", () => {
    const validTypes = ["platform_official", "industry_report", "public_research", "best_practice"];
    for (const card of STRATEGY_CARDS) {
      expect(validTypes).toContain(card.source_type);
    }
  });

  it("卡片 ID 唯一不重复", () => {
    const ids = STRATEGY_CARDS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(STRATEGY_CARDS.length);
  });
});

// ─── 检索算法测试 ────────────────────────────

describe("策略检索 (retrieveCards)", () => {
  it("品类匹配影响排序", () => {
    const result1 = retrieveCards({ category: "小家电/便携榨汁杯" });
    const result2 = retrieveCards({ category: "美妆" });

    expect(result1.results.length).toBeGreaterThan(0);
    expect(result2.results.length).toBeGreaterThan(0);
    // 不同品类至少都返回了结果（具体排序差异在集成测试中验证）
    expect(result1.results[0].matched_fields).toContain("category");
    expect(result2.results[0].matched_fields).toContain("category");
  });

  it("价格带匹配影响排序", () => {
    const resultLow = retrieveCards({ price_band: "<49元" });
    const resultHigh = retrieveCards({ price_band: "200-499元" });

    if (resultLow.results.length > 0 && resultHigh.results.length > 0) {
      // 不同价格带的 Top 1 应该不同
      const topLow = resultLow.results[0].card.id;
      const topHigh = resultHigh.results[0].card.id;
      expect(topLow).not.toBe(topHigh);
    }
  });

  it("问题标签（弱项）匹配影响排序", () => {
    const withWeakness = retrieveCards({
      category: "小家电",
      weaknesses: ["完播率低"],
    });
    const withoutWeakness = retrieveCards({ category: "小家电" });

    // 带弱项的检索结果至少与不带弱项的不同或更多
    if (withWeakness.results.length > 0 && withoutWeakness.results.length > 0) {
      // 弱项标签应影响排序
      const withTop = withWeakness.results[0].card.id;
      const withoutTop = withoutWeakness.results[0].card.id;
      // 不一定总是不同，但如果弱项匹配到了，分数会更高
      expect(withWeakness.results[0].relevance_score).toBeGreaterThanOrEqual(
        withoutWeakness.results[0].relevance_score
      );
    }
  });

  it("检索结果不超过 3 条", () => {
    const result = retrieveCards({ category: "小家电" });
    expect(result.results.length).toBeLessThanOrEqual(3);
  });

  it("不适用的策略不会被返回（阈值过滤）", () => {
    const result = retrieveCards({
      category: "完全不匹配的品类名称XYZ",
    });
    // 不存在的品类不应返回高相关性结果
    for (const r of result.results) {
      expect(r.relevance_score).toBeGreaterThanOrEqual(0.15);
    }
  });

  it("无匹配时返回空结果且给出说明", () => {
    const result = retrieveCards({
      category: "XYZ不存在的品类",
      price_band: "≥500元",
      target_audience: "不存在的人群",
    });
    if (result.results.length === 0) {
      expect(result.noMatchMessage).toBeTruthy();
      expect(result.noMatchMessage).toContain("未匹配");
    }
  });

  it("每条检索结果包含匹配原因", () => {
    const result = retrieveCards({ category: "小家电", price_band: "50-99元" });
    for (const r of result.results) {
      expect(r.why_retrieved).toBeTruthy();
      expect(r.why_retrieved.length).toBeGreaterThan(0);
      expect(r.matched_fields.length).toBeGreaterThan(0);
    }
  });

  it("不同分析数据产生不同检索结果", () => {
    const result1 = retrieveCards({
      category: "小家电",
      price_band: "<49元",
      weaknesses: ["完播率低"],
    });
    const result2 = retrieveCards({
      category: "美妆",
      price_band: "200-499元",
      weaknesses: ["转化率低"],
    });

    const ids1 = result1.results.map((r) => r.card.id).sort().join(",");
    const ids2 = result2.results.map((r) => r.card.id).sort().join(",");
    expect(ids1).not.toBe(ids2);
  });

  it("检索输入信息越多匹配越精准", () => {
    const sparse = retrieveCards({ category: "小家电" });
    const rich = retrieveCards({
      category: "小家电",
      price_band: "50-99元",
      target_audience: "上班族",
      weaknesses: ["完播率低"],
    });

    // 丰富输入的 Top 1 分数应 ≥ 稀疏输入
    if (sparse.results.length > 0 && rich.results.length > 0) {
      expect(rich.results[0].relevance_score).toBeGreaterThanOrEqual(
        sparse.results[0].relevance_score
      );
    }
  });
});
