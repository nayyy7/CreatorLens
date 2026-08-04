import { NextRequest, NextResponse } from "next/server";
import { getProject, getRecords, setReport } from "@/lib/store";
import { runAnalysis } from "@/lib/analysis";
import { generateLLMInsights } from "@/lib/analysis/llm-insights";
import { validateLLMInsights } from "@/lib/analysis/validate-insights";
import type { Insight, InsightSource, AnalysisSnapshot } from "@/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = getProject(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "项目不存在" },
        { status: 404 }
      );
    }

    const records = getRecords(id);
    if (!records || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "未找到已校验的数据，请先上传文件" },
        { status: 400 }
      );
    }

    // 服务端重新校验：过滤不可用记录
    const validRecords = records.filter((r) => r.record_status !== "不可用");
    if (validRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "没有可分析的有效数据" },
        { status: 400 }
      );
    }

    if (validRecords.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: `有效记录仅 ${validRecords.length} 条，不足最低要求 10 条`,
        },
        { status: 400 }
      );
    }

    // ─── Phase A: 同步分析 ──────────────────
    const { report, retrievalOutput, llmContextData, ruleInsights } = runAnalysis({
      projectId: id,
      project: {
        name: project.name,
        category: project.category,
        targetAudience: project.targetAudience,
        analysisGoal: project.analysisGoal,
      },
      records: validRecords,
    });

    let insightSource: InsightSource = "rule";

    // ─── Phase B: 异步 LLM 增强（如果 API key 可用）───
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const llmResponse = await generateLLMInsights(llmContextData);

        if (llmResponse && llmResponse.insights.length > 0) {
          // 事实一致性校验
          const validationReport = validateLLMInsights(
            llmResponse.insights,
            ruleInsights,
            retrievalOutput.results
          );

          if (validationReport.passed && validationReport.validInsights.length > 0) {
            // LLM 洞察校验通过 → 替换规则洞察
            const llmInsights: Insight[] = validationReport.validInsights.map(
              (llmInsight, idx) => ({
                id: `llm_${Date.now()}_${idx}`,
                title: llmInsight.title,
                claimType: "correlation" as const,
                metric: llmInsight.metric,
                metricLabel: llmInsight.metricLabel,
                groupA: llmInsight.groupA,
                groupB: llmInsight.groupB,
                absoluteDelta: llmInsight.absoluteDelta,
                relativeDelta:
                  llmInsight.groupB.median > 0
                    ? Math.round(
                        (llmInsight.groupA.median / llmInsight.groupB.median - 1) *
                          10000
                      ) / 10000
                    : null,
                confidenceLevel: llmInsight.confidence_level,
                limitations: [
                  ...llmInsight.limitations,
                  "由 AI 辅助生成，已通过事实一致性校验",
                  "不代表因果结论，建议通过 A/B 实验验证",
                ],
                knowledgeRefs: llmInsight.knowledge_card_ids,
                recommendedAction: llmInsight.action,
                evidenceVideos: llmInsight.representative_video_ids.slice(0, 3),
                source: `LLM 证据化洞察（基于 ${ruleInsights.length} 条统计证据和 ${retrievalOutput.results.length} 条知识卡片）`,
                supportingMetrics: `样本量：${llmInsight.groupA.n} vs ${llmInsight.groupB.n}；${llmInsight.metricLabel} 差异：${llmInsight.absoluteDelta}`,
                facts: llmInsight.observation,
                aiAssisted: true,
                observation: llmInsight.observation,
                explanation: llmInsight.explanation,
                knowledgeCardRefs: llmInsight.knowledge_card_ids.map(
                  (cardId) => {
                    const card = retrievalOutput.results.find(
                      (r) => r.card.id === cardId
                    );
                    return {
                      id: cardId,
                      title: card?.card.title || cardId,
                      source_title: card?.card.source_title || "",
                      source_url: card?.card.source_url || "",
                      match_reason: card?.why_retrieved || "",
                    };
                  }
                ),
              })
            );

            report.insights = llmInsights;
            insightSource = "llm";

            // 更新快照
            const snapshot = report.analysisSnapshot as AnalysisSnapshot;
            snapshot.llmInsightCount = llmResponse.insights.length;
            snapshot.validatedInsightCount = validationReport.validInsights.length;
            snapshot.llmModel = process.env.LLM_MODEL || "gpt-4o-mini";
            snapshot.fallbackReason = undefined;
          } else {
            // 校验失败 → 保持规则洞察，记录原因
            const snapshot = report.analysisSnapshot as AnalysisSnapshot;
            snapshot.fallbackReason = `校验失败：${validationReport.failures
              .map((f) => f.reason)
              .join("；")}`;
            insightSource = "hybrid";
            console.warn(
              "[Analysis] LLM insights validation failed:",
              validationReport.failures
            );
          }
        } else {
          // LLM 返回空洞察 → 保持规则洞察
          const snapshot = report.analysisSnapshot as AnalysisSnapshot;
          snapshot.fallbackReason = "LLM 未生成洞察（返回空结果）";
          insightSource = "rule";
        }
      } catch (err) {
        // LLM 调用异常 → 保持规则洞察
        const snapshot = report.analysisSnapshot as AnalysisSnapshot;
        snapshot.fallbackReason = `LLM 调用异常：${err instanceof Error ? err.message : String(err)}`;
        insightSource = "rule";
        console.warn("[Analysis] LLM call failed, using rule insights:", err);
      }
    } else {
      // 无 API key → 规则洞察
      const snapshot = report.analysisSnapshot as AnalysisSnapshot;
      snapshot.fallbackReason = "未配置 LLM API Key";
      insightSource = "rule";
    }

    report.insightSource = insightSource;

    // 存储报告
    setReport(id, report);

    // 更新项目状态
    project.status = "completed";
    project.updatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      analysisId: id,
      insightSource,
      summary: {
        validVideos: report.overview.summary.validVideoCount,
        totalViews: validRecords.reduce((s, r) => s + r.views, 0),
        insights: report.insights.length,
        experiments: report.experiments.length,
        retrievalCards: retrievalOutput.results.length,
        noMatchMessage: retrievalOutput.noMatchMessage,
      },
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { success: false, error: "分析失败，请稍后重试" },
      { status: 500 }
    );
  }
}
