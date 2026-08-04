// CreatorLens LLM 证据化洞察生成
// Phase 5: 将统计事实 + 检索结果交给 LLM，生成结构化洞察
// 所有数字由服务端代码计算，LLM 仅负责解释和融合
// 任何失败均返回 null，由调用方降级到规则洞察

import type { VideoRecord } from "@/types";
import type { SummaryStats } from "./stats";
import type { DimensionResult } from "./dimensions";
import type { RuleInsight } from "./insights";
import type { RetrievalResult } from "../knowledge/retrieval";

// ─── 输入类型 ────────────────────────────────

export interface LLMContextData {
  /** 项目信息 */
  project: {
    category?: string;
    targetAudience?: string;
    analysisGoal?: string;
  };
  /** 样本概览 */
  sampleSummary: {
    validVideoCount: number;
    dateRange: string;
  };
  /** 核心统计（仅发送关键指标） */
  stats: {
    medianViews: number;
    avgViews: number;
    totalViews: number;
    avgCompletionRate: number | null;
    overallEngagementRate: number | null;
    overallProductClickRate: number | null;
    overallConversionRate: number | null;
    totalProductClicks: number | null;
    totalOrders: number | null;
  };
  /** 维度分析摘要（仅发送分组差异） */
  dimensionSummaries: {
    dimension: string;
    dimensionLabel: string;
    groups: {
      label: string;
      sampleSize: number;
      medianViews: number;
      avgCompletionRate: number | null;
      confidenceLevel: string;
    }[];
  }[];
  /** Phase 4 规则洞察（作为参考，LLM 需引用其 ID） */
  ruleInsights: {
    id: string;
    title: string;
    groupA: { label: string; n: number; median: number };
    groupB: { label: string; n: number; median: number };
    metricLabel: string;
    confidenceLevel: string;
  }[];
  /** Top 3 检索结果 */
  retrievalResults: {
    id: string;
    title: string;
    strategy: string;
    why_retrieved: string;
  }[];
  /** 代表视频 ID */
  representativeVideoIds: string[];
}

// ─── 输出类型 ────────────────────────────────

export interface LLMInsightOutput {
  title: string;
  observation: string;
  explanation: string;
  action: string;
  metric: string;
  metricLabel: string;
  groupA: { label: string; n: number; median: number };
  groupB: { label: string; n: number; median: number };
  absoluteDelta: number;
  knowledge_card_ids: string[];
  metric_evidence_ids: string[];
  representative_video_ids: string[];
  confidence_level: "较高" | "中" | "低";
  limitations: string[];
}

export interface LLMResponse {
  insights: LLMInsightOutput[];
}

// ─── 配置 ────────────────────────────────────

function getLLMConfig() {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  return { apiKey, model, baseUrl };
}

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 1;

// ─── 构建上下文数据 ──────────────────────────

export function buildLLMContextData(
  stats: SummaryStats,
  dimensions: DimensionResult[],
  ruleInsights: RuleInsight[],
  retrievalResults: RetrievalResult[],
  records: VideoRecord[],
  project?: { category?: string; targetAudience?: string; analysisGoal?: string }
): LLMContextData {
  const validRecords = records.filter((r) => r.record_status !== "不可用");

  return {
    project: {
      category: project?.category,
      targetAudience: project?.targetAudience,
      analysisGoal: project?.analysisGoal,
    },
    sampleSummary: {
      validVideoCount: stats.validCount,
      dateRange: stats.dateRange
        ? `${stats.dateRange.start} — ${stats.dateRange.end}`
        : "未知",
    },
    stats: {
      medianViews: stats.medianViews,
      avgViews: stats.avgViews,
      totalViews: stats.totalViews,
      avgCompletionRate: stats.avgCompletionRate,
      overallEngagementRate: stats.overallEngagementRate,
      overallProductClickRate: stats.overallProductClickRate,
      overallConversionRate: stats.overallConversionRate,
      totalProductClicks: stats.totalProductClicks,
      totalOrders: stats.totalOrders,
    },
    dimensionSummaries: dimensions.map((d) => ({
      dimension: d.dimension,
      dimensionLabel: d.dimensionLabel,
      groups: d.groups.map((g) => ({
        label: g.label,
        sampleSize: g.sampleSize,
        medianViews: g.medianViews,
        avgCompletionRate: g.avgCompletionRate,
        confidenceLevel: g.confidenceLevel,
      })),
    })),
    ruleInsights: ruleInsights.map((ri) => ({
      id: ri.id,
      title: ri.title,
      groupA: ri.groupA,
      groupB: ri.groupB,
      metricLabel: ri.metricLabel,
      confidenceLevel: ri.confidenceLevel,
    })),
    retrievalResults: retrievalResults.map((rr) => ({
      id: rr.card.id,
      title: rr.card.title,
      strategy: rr.card.strategy,
      why_retrieved: rr.why_retrieved,
    })),
    representativeVideoIds: validRecords
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .map((r) => r.video_id),
  };
}

// ─── Prompt 构建 ─────────────────────────────

function buildSystemPrompt(): string {
  return `你是一名电商短视频数据分析助手。你的任务是基于预先计算好的统计数据，结合行业策略知识，生成结构化洞察。

你必须严格遵守以下规则：
1. 所有数字（播放量、完播率、样本量、差值等）必须来自下方提供的统计数据，不得自行计算、估测或编造
2. 不得编造任何来源、论文、作者、网址或平台规则
3. 使用审慎表达："在本次样本中观察到""可能与…相关""建议通过实验验证"
4. 禁止使用因果断言："证明了""一定会""导致""必然"
5. 如果统计数据显示差异不大或样本不足，如实说明，不要强行给出结论
6. 每条洞察必须至少关联 1 条统计证据（metric_evidence_ids）和 1 条知识卡片（knowledge_card_ids）
7. 最多生成 3 条洞察；无法生成有意义的洞察时返回空数组`;
}

function buildUserPrompt(data: LLMContextData): string {
  // 将数据序列化为结构化 JSON
  const dataBlock = {
    "项目信息": data.project,
    "样本概览": data.sampleSummary,
    "核心统计指标": data.stats,
    "维度分析（分组对比）": data.dimensionSummaries,
    "规则洞察（统计证据，需引用）": data.ruleInsights.map((ri) => ({
      id: ri.id,
      title: ri.title,
      groupA: ri.groupA,
      groupB: ri.groupB,
      metric: ri.metricLabel,
      confidence: ri.confidenceLevel,
    })),
    "策略知识卡片（行业方法论，需引用）": data.retrievalResults.map((rr) => ({
      id: rr.id,
      title: rr.title,
      strategy: rr.strategy,
      why_retrieved: rr.why_retrieved,
    })),
    "代表视频 ID": data.representativeVideoIds,
  };

  const outputSchema = {
    insights: [
      {
        title: "洞察标题（简洁，包含对比方向和维度）",
        observation: "数据观察：在本次样本中发现了什么统计差异，引用具体数字",
        explanation: "策略解释：结合知识卡片，分析可能的原因和方法论依据",
        action: "可执行建议：下一轮创作可以测试什么",
        metric: "指标字段名（如 views, completion_rate）",
        metricLabel: "指标中文名（如 播放量中位数、平均完播率）",
        groupA: { label: "优势组标签", n: 0, median: 0 },
        groupB: { label: "对照组标签", n: 0, median: 0 },
        absoluteDelta: 0,
        knowledge_card_ids: ["引用的策略卡片 ID"],
        metric_evidence_ids: ["引用的统计证据 ID（来自规则洞察的 id）"],
        representative_video_ids: ["代表视频 ID"],
        confidence_level: "较高 | 中 | 低",
        limitations: ["适用限制 1", "适用限制 2"],
      },
    ],
  };

  return `以下是服务端计算好的账号统计数据：

${JSON.stringify(dataBlock, null, 2)}

请基于以上数据生成最多 3 条证据化洞察。你必须严格按照以下 JSON Schema 输出（不要输出 Markdown 代码块，直接输出 JSON）：

${JSON.stringify(outputSchema, null, 2)}

重要提醒：
- groupA 和 groupB 的 label、n、median 必须从上方数据中复制，不得修改
- knowledge_card_ids 必须引用上方"策略知识卡片"中实际存在的 id
- metric_evidence_ids 必须引用上方"规则洞察"中实际存在的 id
- 如果某个知识卡片不适用某条洞察，不要引用它
- 如果没有合适的洞察可生成，返回 {"insights": []}`;
}

// ─── LLM 调用 ────────────────────────────────

export async function generateLLMInsights(
  contextData: LLMContextData
): Promise<LLMResponse | null> {
  const { apiKey, model, baseUrl } = getLLMConfig();

  // 无 API key → 降级
  if (!apiKey) {
    console.log("[LLM] No API key configured, skipping LLM insights");
    return null;
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(contextData);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[LLM] API error (${response.status}): ${errorText}`);

        // 4xx 错误不重试
        if (response.status >= 400 && response.status < 500) {
          return null;
        }
        // 5xx 继续重试
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;

      if (!content) {
        console.error("[LLM] Empty response content");
        return null;
      }

      // 解析 JSON 响应
      const parsed = parseLLMResponse(content);
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        console.error(`[LLM] Request timeout (attempt ${attempt + 1})`);
        lastError = new Error("Request timeout");
        continue;
      }

      console.error(`[LLM] Network error (attempt ${attempt + 1}):`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      // 网络错误继续重试
      continue;
    }
  }

  console.error(`[LLM] All ${MAX_RETRIES + 1} attempts failed:`, lastError?.message);
  return null;
}

// ─── 响应解析 ────────────────────────────────

function parseLLMResponse(content: string): LLMResponse | null {
  try {
    // 尝试直接解析
    let parsed: unknown;

    // 如果内容包含 markdown 代码块，提取 JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    } else {
      // 尝试找到 JSON 对象的起始位置
      const startIdx = content.indexOf("{");
      if (startIdx >= 0) {
        const jsonStr = content.slice(startIdx);
        parsed = JSON.parse(jsonStr);
      } else {
        parsed = JSON.parse(content);
      }
    }

    if (!parsed || typeof parsed !== "object") {
      console.error("[LLM] Parsed response is not an object");
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    if (!Array.isArray(obj.insights)) {
      console.error("[LLM] Response missing 'insights' array");
      return null;
    }

    // 基本结构校验
    const insights: LLMInsightOutput[] = [];
    for (let i = 0; i < obj.insights.length; i++) {
      const item = obj.insights[i] as Record<string, unknown>;

      // 必填字段检查
      if (!item.title || !item.observation || !item.explanation || !item.action) {
        console.error(`[LLM] Insight ${i} missing required string fields`);
        continue;
      }
      if (!item.metric || !item.metricLabel) {
        console.error(`[LLM] Insight ${i} missing metric fields`);
        continue;
      }
      if (!item.groupA || !item.groupB) {
        console.error(`[LLM] Insight ${i} missing groupA/groupB`);
        continue;
      }
      if (!Array.isArray(item.knowledge_card_ids) || !Array.isArray(item.metric_evidence_ids)) {
        console.error(`[LLM] Insight ${i} missing ID arrays`);
        continue;
      }

      const groupA = item.groupA as Record<string, unknown>;
      const groupB = item.groupB as Record<string, unknown>;

      insights.push({
        title: String(item.title),
        observation: String(item.observation),
        explanation: String(item.explanation),
        action: String(item.action),
        metric: String(item.metric),
        metricLabel: String(item.metricLabel),
        groupA: {
          label: String(groupA.label || ""),
          n: Number(groupA.n) || 0,
          median: Number(groupA.median) || 0,
        },
        groupB: {
          label: String(groupB.label || ""),
          n: Number(groupB.n) || 0,
          median: Number(groupB.median) || 0,
        },
        absoluteDelta: Number(item.absoluteDelta) || 0,
        knowledge_card_ids: (item.knowledge_card_ids as unknown[]).map(String),
        metric_evidence_ids: (item.metric_evidence_ids as unknown[]).map(String),
        representative_video_ids: Array.isArray(item.representative_video_ids)
          ? (item.representative_video_ids as unknown[]).map(String)
          : [],
        confidence_level: validateConfidenceLevel(String(item.confidence_level || "低")),
        limitations: Array.isArray(item.limitations)
          ? (item.limitations as unknown[]).map(String)
          : ["基于 AI 生成，需人工审核"],
      });
    }

    return { insights: insights.slice(0, 3) };
  } catch (err) {
    console.error("[LLM] JSON parse error:", err);
    return null;
  }
}

function validateConfidenceLevel(level: string): "较高" | "中" | "低" {
  if (level === "较高" || level === "高") return "较高";
  if (level === "中") return "中";
  return "低";
}
