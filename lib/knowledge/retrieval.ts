// CreatorLens 轻量策略检索
// Phase 5: 可解释的标签匹配 + 关键词评分
// 同步执行，无外部依赖

import { STRATEGY_CARDS, type StrategyCard } from "./knowledge-base";

// ─── 类型 ────────────────────────────────────

export interface RetrievalInput {
  category?: string;
  price_band?: string;
  target_audience?: string;
  content_format?: string;
  duration_band?: string;
  /** Phase 4 发现的弱项或机会点，如 "完播率低"、"互动不足" */
  weaknesses?: string[];
}

export interface RetrievalResult {
  card: StrategyCard;
  relevance_score: number;
  matched_fields: string[];
  why_retrieved: string;
}

export interface RetrievalOutput {
  results: RetrievalResult[];
  /** 无匹配时的说明 */
  noMatchMessage?: string;
  /** 检索使用的输入 */
  input: RetrievalInput;
}

// ─── 弱项到问题标签的映射 ──────────────────

const WEAKNESS_TAG_MAP: Record<string, string[]> = {
  "完播率低": ["完播率低", "平均观看时长短"],
  "完播率偏低": ["完播率低", "平均观看时长短"],
  "平均观看时长短": ["平均观看时长短", "完播率低"],
  "2秒跳出率高": ["2秒跳出率高", "5秒留存率低"],
  "5秒留存率低": ["5秒留存率低", "2秒跳出率高"],
  "互动不足": ["互动不足", "评论率低", "分享率低"],
  "互动率低": ["互动不足", "评论率低", "分享率低"],
  "评论率低": ["评论率低", "互动不足"],
  "分享率低": ["分享率低", "互动不足"],
  "点击率低": ["点击率低", "曝光高点击低"],
  "曝光高点击低": ["曝光高点击低", "点击率低"],
  "转化率低": ["转化率低", "点击率高但转化低"],
  "点击率高但转化低": ["点击率高但转化低", "转化率低"],
  "完播率高但无转化": ["完播率高但无转化"],
  "曝光低": ["曝光低"],
  "粉丝增长慢": ["粉丝增长慢"],
};

// ─── 品类大类提取 ──────────────────────────

function extractCategoryGroup(category: string): string {
  if (!category) return "";
  const c = category.toLowerCase();
  if (c.includes("家电") || c.includes("小家电") || c.includes("数码") || c.includes("电子")) {
    return "家电数码";
  }
  if (c.includes("美妆") || c.includes("护肤") || c.includes("彩妆") || c.includes("化妆")) {
    return "美妆个护";
  }
  if (c.includes("食品") || c.includes("饮料") || c.includes("零食") || c.includes("茶") || c.includes("咖啡")) {
    return "食品饮料";
  }
  if (c.includes("服饰") || c.includes("服装") || c.includes("鞋") || c.includes("包")) {
    return "服饰配饰";
  }
  if (c.includes("母婴") || c.includes("亲子") || c.includes("儿童") || c.includes("宝宝")) {
    return "母婴亲子";
  }
  if (c.includes("个护") || c.includes("家清") || c.includes("清洁") || c.includes("日用")) {
    return "个护家清";
  }
  return "";
}

// ─── 主检索函数 ─────────────────────────────

const MIN_SCORE_THRESHOLD = 0.15;
const MAX_RESULTS = 3;

export function retrieveCards(
  input: RetrievalInput,
  topK: number = MAX_RESULTS
): RetrievalOutput {
  const k = Math.min(topK, MAX_RESULTS);

  if (STRATEGY_CARDS.length === 0) {
    return {
      results: [],
      noMatchMessage: "知识库为空，暂无策略卡片",
      input,
    };
  }

  // 扩展弱项标签
  const expandedWeaknessTags: string[] = [];
  if (input.weaknesses) {
    for (const w of input.weaknesses) {
      const mapped = WEAKNESS_TAG_MAP[w] || [w];
      expandedWeaknessTags.push(...mapped);
    }
  }
  // 去重
  const uniqueWeaknessTags = [...new Set(expandedWeaknessTags)];

  const categoryGroup = input.category ? extractCategoryGroup(input.category) : "";
  const categoryExact = input.category || "";

  const scored: RetrievalResult[] = [];

  for (const card of STRATEGY_CARDS) {
    let score = 0;
    const matchedFields: string[] = [];

    // 1. 品类匹配（权重 0.3）
    const categoryMatchExact = card.applicable_categories.some(
      (c) => categoryExact && (c === categoryExact || categoryExact.includes(c) || c.includes(categoryExact))
    );
    const categoryMatchGroup = card.applicable_categories.some(
      (c) => categoryGroup && extractCategoryGroup(c) === categoryGroup
    );
    const categoryMatchAny = card.applicable_categories.includes("全部品类") ||
      card.applicable_categories.length === 0;

    if (categoryMatchExact) {
      score += 0.3;
      matchedFields.push("category");
    } else if (categoryMatchGroup) {
      score += 0.15;
      matchedFields.push("category_group");
    } else if (categoryMatchAny) {
      score += 0.05;
    }

    // 2. 价格带匹配（权重 0.2）
    const priceMatch = input.price_band &&
      (card.price_bands.length === 0 ||
        card.price_bands.some((p) => p === input.price_band));
    if (priceMatch) {
      score += 0.2;
      matchedFields.push("price_band");
    } else if (card.price_bands.length === 0) {
      score += 0.05; // 不限价格带的小加分
    }

    // 3. 目标人群匹配（权重 0.2）
    const audienceMatch = input.target_audience &&
      (card.target_audiences.length === 0 ||
        card.target_audiences.some((a) => a === input.target_audience));
    if (audienceMatch) {
      score += 0.2;
      matchedFields.push("target_audience");
    } else if (card.target_audiences.length === 0) {
      score += 0.05;
    }

    // 4. 内容形式/时长匹配（权重 0.15）
    let formatMatch = false;
    if (input.content_format) {
      formatMatch = card.content_formats.some(
        (f) => f === input.content_format || input.content_format?.includes(f)
      );
    }
    if (input.duration_band) {
      const durMatch = card.content_formats.some(
        (f) => f.includes(input.duration_band!) || card.strategy.includes(input.duration_band!)
      );
      if (durMatch) formatMatch = true;
    }
    if (formatMatch) {
      score += 0.15;
      matchedFields.push("content_format");
    }

    // 5. 弱项/问题标签匹配（权重 0.15）—— 最重要的信号
    if (uniqueWeaknessTags.length > 0) {
      const problemMatches = card.problem_tags.filter((pt) =>
        uniqueWeaknessTags.some((wt) => pt.includes(wt) || wt.includes(pt))
      );
      if (problemMatches.length > 0) {
        // 匹配越多越好，上限 0.15
        const problemScore = Math.min(0.15, problemMatches.length * 0.05);
        score += problemScore;
        matchedFields.push("problem_tags");
      }
    }

    // 只有分数 > 0 的才进入候选
    if (score > 0) {
      scored.push({
        card,
        relevance_score: Math.round(score * 100) / 100,
        matched_fields: matchedFields,
        why_retrieved: buildWhyRetrieved(matchedFields, card, input),
      });
    }
  }

  // 按分数降序排序
  scored.sort((a, b) => b.relevance_score - a.relevance_score);

  // 过滤低于阈值的
  const qualified = scored.filter((s) => s.relevance_score >= MIN_SCORE_THRESHOLD);

  // Top K
  const results = qualified.slice(0, k);

  return {
    results,
    noMatchMessage: results.length === 0
      ? "当前项目上下文未匹配到相关策略知识，洞察仅基于账号数据生成。建议丰富品类、价格带或目标人群信息以提升匹配效果。"
      : undefined,
    input,
  };
}

// ─── 匹配原因生成 ────────────────────────────

function buildWhyRetrieved(
  matchedFields: string[],
  card: StrategyCard,
  input: RetrievalInput
): string {
  const parts: string[] = [];

  for (const field of matchedFields) {
    switch (field) {
      case "category":
        parts.push(`品类匹配（${input.category}）`);
        break;
      case "category_group":
        parts.push(`品类大类匹配（${extractCategoryGroup(input.category || "")}）`);
        break;
      case "price_band":
        parts.push(`价格带匹配（${input.price_band}）`);
        break;
      case "target_audience":
        parts.push(`目标人群匹配（${input.target_audience}）`);
        break;
      case "content_format":
        parts.push(`内容形式匹配`);
        break;
      case "problem_tags":
        const matchedProblems = card.problem_tags.filter((pt) =>
          (input.weaknesses || []).some((w) => pt.includes(w) || w.includes(pt))
        );
        parts.push(`问题标签匹配（${matchedProblems.slice(0, 2).join("、")}）`);
        break;
    }
  }

  return parts.length > 0 ? parts.join("；") : "综合相关性匹配";
}
