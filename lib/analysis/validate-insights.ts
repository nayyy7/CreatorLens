// CreatorLens 事实一致性校验
// Phase 5: 校验 LLM 生成的洞察，确保所有引用可追溯、数字可验证
// 校验失败 → 丢弃该条洞察，使用规则洞察降级

import type { LLMInsightOutput } from "./llm-insights";
import type { RuleInsight } from "./insights";
import type { RetrievalResult } from "../knowledge/retrieval";

// ─── 校验结果 ────────────────────────────────

export interface ValidationFailure {
  insightIndex: number;
  reason: string;
}

export interface ValidationReport {
  /** 是否有至少一条洞察通过校验 */
  passed: boolean;
  /** 校验失败的记录 */
  failures: ValidationFailure[];
  /** 通过校验的洞察 */
  validInsights: LLMInsightOutput[];
}

// ─── 因果断言禁止词 ─────────────────────────

const CAUSAL_KEYWORDS = [
  "证明了",
  "一定会",
  "必然",
  "导致",
  "决定了",
  "因果关系",
  "必定",
  "绝对",
  "肯定是",
  "毫无疑问",
];

// ─── NaN/Infinity 检测 ──────────────────────

function hasInvalidNumber(value: number): boolean {
  return typeof value !== "number" || isNaN(value) || !isFinite(value);
}

// ─── 主校验函数 ──────────────────────────────

export function validateLLMInsights(
  llmInsights: LLMInsightOutput[],
  ruleInsights: RuleInsight[],
  retrievalResults: RetrievalResult[],
): ValidationReport {
  const failures: ValidationFailure[] = [];
  const validInsights: LLMInsightOutput[] = [];

  // 构建可用的 ID 集合
  const validRuleInsightIds = new Set(ruleInsights.map((ri) => ri.id));
  const validKnowledgeCardIds = new Set(retrievalResults.map((rr) => rr.card.id));
  const retrievalCardsEmpty = retrievalResults.length === 0;

  for (let i = 0; i < llmInsights.length; i++) {
    const insight = llmInsights[i];
    let rejected = false;

    // ─── 规则 1：metric_evidence_ids 至少 1 个，且全部存在 ──
    if (!insight.metric_evidence_ids || insight.metric_evidence_ids.length === 0) {
      failures.push({
        insightIndex: i,
        reason: "metric_evidence_ids 为空，洞察缺少统计证据引用",
      });
      rejected = true;
    } else {
      for (const evidenceId of insight.metric_evidence_ids) {
        if (!validRuleInsightIds.has(evidenceId)) {
          failures.push({
            insightIndex: i,
            reason: `metric_evidence_id "${evidenceId}" 不在本次分析的统计证据中（可用 ID：${[...validRuleInsightIds].join(", ") || "无"}）`,
          });
          rejected = true;
          break;
        }
      }
    }

    // ─── 规则 2：knowledge_card_ids 全部存在 ──
    if (!rejected) {
      if (retrievalCardsEmpty && insight.knowledge_card_ids.length > 0) {
        failures.push({
          insightIndex: i,
          reason: "本次检索无知识命中，但洞察包含 knowledge_card_ids，引用不存在",
        });
        rejected = true;
      } else if (!retrievalCardsEmpty) {
        for (const cardId of insight.knowledge_card_ids) {
          if (!validKnowledgeCardIds.has(cardId)) {
            failures.push({
              insightIndex: i,
              reason: `knowledge_card_id "${cardId}" 不在本次 Top 3 检索结果中（可用 ID：${[...validKnowledgeCardIds].join(", ")}）`,
            });
            rejected = true;
            break;
          }
        }
      }
    }

    // ─── 规则 3：无数值异常 ──
    if (!rejected) {
      if (hasInvalidNumber(insight.absoluteDelta)) {
        failures.push({ insightIndex: i, reason: "absoluteDelta 包含 NaN 或 Infinity" });
        rejected = true;
      }
      if (hasInvalidNumber(insight.groupA.median) || hasInvalidNumber(insight.groupA.n)) {
        failures.push({ insightIndex: i, reason: "groupA 的 median 或 n 包含 NaN 或 Infinity" });
        rejected = true;
      }
      if (hasInvalidNumber(insight.groupB.median) || hasInvalidNumber(insight.groupB.n)) {
        failures.push({ insightIndex: i, reason: "groupB 的 median 或 n 包含 NaN 或 Infinity" });
        rejected = true;
      }
    }

    // ─── 规则 4：无因果断言 ──
    if (!rejected) {
      const combinedText = [
        insight.title,
        insight.observation,
        insight.explanation,
        insight.action,
      ].join(" ");

      for (const keyword of CAUSAL_KEYWORDS) {
        if (combinedText.includes(keyword)) {
          failures.push({
            insightIndex: i,
            reason: `包含因果断言关键词："${keyword}"。应使用"在本次样本中""可能相关""建议通过实验验证"等审慎表达`,
          });
          rejected = true;
          break;
        }
      }
    }

    // ─── 规则 5：基本字段不为空 ──
    if (!rejected) {
      if (!insight.title || !insight.title.trim()) {
        failures.push({ insightIndex: i, reason: "title 为空" });
        rejected = true;
      }
      if (!insight.observation || !insight.observation.trim()) {
        failures.push({ insightIndex: i, reason: "observation 为空" });
        rejected = true;
      }
      if (!insight.groupA.label || !insight.groupB.label) {
        failures.push({ insightIndex: i, reason: "groupA 或 groupB 的 label 为空" });
        rejected = true;
      }
    }

    // ─── 规则 6：样本量合理性 ──
    if (!rejected) {
      if (insight.groupA.n <= 0 || insight.groupB.n <= 0) {
        failures.push({ insightIndex: i, reason: "groupA 或 groupB 的样本量 ≤ 0" });
        rejected = true;
      }
    }

    if (rejected) {
      continue;
    }

    validInsights.push(insight);
  }

  return {
    passed: validInsights.length > 0,
    failures,
    validInsights,
  };
}
