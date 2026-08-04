"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  BarChart3,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Sparkles,
  Eye,
  Target,
} from "lucide-react";
import type { Insight } from "@/types";

interface InsightsSectionProps {
  insights: Insight[];
  insightSource?: "rule" | "llm" | "hybrid";
}

export function InsightsSection({ insights, insightSource }: InsightsSectionProps) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Lightbulb className="size-10 text-muted-foreground mb-3" />
          <p className="font-medium">暂无洞察</p>
          <p className="text-sm text-muted-foreground">
            样本不足，无法生成有统计意义的洞察
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasAI = insights.some((i) => i.aiAssisted);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">核心洞察</h3>
        <Badge variant="secondary" className="ml-2">
          {insights.length} 条
        </Badge>
        {hasAI && (
          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
            <Sparkles className="size-3" />
            AI 辅助生成
          </Badge>
        )}
        {!hasAI && insightSource === "rule" && (
          <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
            规则引擎
          </Badge>
        )}
      </div>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const isAI = insight.aiAssisted;

  return (
    <Card className={isAI ? "border-purple-200" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            {insight.title}
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAI && (
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] gap-0.5">
                <Sparkles className="size-2.5" />
                AI 辅助
              </Badge>
            )}
            <ConfidenceBadge level={insight.confidenceLevel} />
          </div>
        </div>
        <CardDescription>
          {isAI
            ? "基于账号真实数据 + 策略知识库的综合分析"
            : "相关性发现 · 需通过实验验证"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── LLM 增强：数据观察 ── */}
        {isAI && insight.observation && (
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Eye className="size-4 text-primary" />
              数据观察
            </div>
            <p className="text-sm text-muted-foreground">{insight.observation}</p>
          </div>
        )}

        {/* ── 数据证据（统计对比）── */}
        {!isAI && (
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <BarChart3 className="size-4 text-primary" />
              账号数据证据
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{insight.groupA.label}</p>
                <p className="font-semibold text-lg">
                  {formatMetricValue(insight.groupA.median, insight.metric)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{insight.groupB.label}</p>
                <p className="font-semibold text-lg">
                  {formatMetricValue(insight.groupB.median, insight.metric)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              绝对差值：{formatMetricValue(insight.absoluteDelta, insight.metric, true)}
              {insight.relativeDelta != null && (
                <> · 相对差异：{(insight.relativeDelta * 100).toFixed(0)}%</>
              )}
              {insight.evidenceVideos.length > 0 && (
                <> · 代表视频：{insight.evidenceVideos.join("、")}</>
              )}
            </p>
          </div>
        )}

        {/* ── LLM 增强：策略解释 ── */}
        {isAI && insight.explanation && (
          <div className="rounded-md bg-purple-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <BookOpen className="size-4 text-purple-600" />
              策略解释
            </div>
            <p className="text-sm text-muted-foreground">{insight.explanation}</p>
            {/* 知识来源 */}
            {insight.knowledgeCardRefs && insight.knowledgeCardRefs.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-purple-700">参考策略卡片：</p>
                {insight.knowledgeCardRefs.map((ref, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-purple-500 shrink-0">•</span>
                    <span>
                      {ref.title}
                      {ref.source_title ? `（来源：${ref.source_title}）` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 统计证据（LLM 洞察也展示）── */}
        {isAI && (
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <BarChart3 className="size-3.5" />
              统计证据
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{insight.groupA.label}</p>
                <p className="font-semibold">
                  {formatMetricValue(insight.groupA.median, insight.metric)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{insight.groupB.label}</p>
                <p className="font-semibold">
                  {formatMetricValue(insight.groupB.median, insight.metric)}
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              差异：{formatMetricValue(insight.absoluteDelta, insight.metric, true)}
              {insight.relativeDelta != null && (
                <> · 相对：{(insight.relativeDelta * 100).toFixed(0)}%</>
              )}
              {insight.evidenceVideos.length > 0 && (
                <> · 代表视频：{insight.evidenceVideos.join("、")}</>
              )}
            </p>
          </div>
        )}

        {/* ── 限制条件 ── */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">限制条件</p>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {insight.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── 建议动作 ── */}
        <div className="flex items-start gap-2 rounded-md bg-primary/5 p-4">
          {isAI ? (
            <Target className="size-4 text-primary shrink-0 mt-0.5" />
          ) : (
            <ArrowRight className="size-4 text-primary shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium text-primary">
              {isAI ? "可执行建议" : "建议动作"}
            </p>
            <p className="text-sm mt-1">{insight.recommendedAction}</p>
          </div>
        </div>

        {/* ── 知识来源标签（非 LLM 洞察的简化展示）── */}
        {!isAI && insight.knowledgeRefs.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">知识库参考</p>
              <p className="mt-1">{insight.knowledgeRefs.join("、")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatMetricValue(value: number, metric: string, isDelta = false): string {
  if (metric === "completion_rate" || metric === "product_click_rate" || metric === "engagement_rate") {
    const pct = isDelta ? value * 100 : value * 100;
    return `${pct.toFixed(isDelta ? 1 : 0)}%`;
  }
  if (metric === "views") {
    if (isDelta) return value.toLocaleString();
    return value >= 10000
      ? (value / 10000).toFixed(1) + "万"
      : value.toLocaleString();
  }
  return isDelta ? value.toFixed(1) : value.toLocaleString();
}

function ConfidenceBadge({ level }: { level: string }) {
  switch (level) {
    case "高":
    case "较高":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0">
          可信度：{level}
        </Badge>
      );
    case "中":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 shrink-0">
          可信度：中
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="shrink-0">
          可信度：低
        </Badge>
      );
  }
}
