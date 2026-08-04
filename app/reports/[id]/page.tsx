"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Database, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewSection } from "@/components/report/overview-section";
import { InsightsSection } from "@/components/report/insights-section";
import { ExperimentsSection } from "@/components/report/experiments-section";
import { BriefsSection } from "@/components/report/briefs-section";
import { KnowledgeSection } from "@/components/report/knowledge-section";
import type { Report } from "@/types";

type PageState = "loading" | "ready" | "not_found" | "error";

interface ReportData {
  report: Report;
  project: {
    name: string;
    category: string;
    targetAudience?: string;
    analysisGoal?: string;
  } | null;
}

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<ReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function fetchReport() {
    setPageState("loading");
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 404) {
          setPageState("not_found");
          setErrorMsg(json.error || "报告不存在");
        } else {
          setPageState("error");
          setErrorMsg(json.error || "获取报告失败");
        }
        return;
      }

      setData(json);
      setPageState("ready");
    } catch {
      setPageState("error");
      setErrorMsg("网络错误，请检查连接后重试");
    }
  }

  // ─── 加载中 ────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="flex flex-col items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">正在加载报告...</p>
      </div>
    );
  }

  // ─── 报告不存在 ────────────────────────────
  if (pageState === "not_found") {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="rounded-full bg-muted p-4 inline-block mb-4">
          <FileText className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">报告不可用</h2>
        <p className="text-muted-foreground mb-6">{errorMsg}</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-1" />
            返回工作台
          </Button>
        </Link>
      </div>
    );
  }

  // ─── 加载错误 ──────────────────────────────
  if (pageState === "error") {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 inline-block mb-4">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">加载失败</h2>
        <p className="text-muted-foreground mb-6">{errorMsg}</p>
        <Button variant="outline" onClick={fetchReport}>
          重新加载
        </Button>
      </div>
    );
  }

  const { report, project } = data!;

  return (
    <div className="mx-auto max-w-4xl">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          返回工作台
        </Link>
      </div>

      {/* 报告标题 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="gap-1">
            <Database className="size-3" />
            基于上传数据生成
          </Badge>
          {report.insightSource === "llm" && (
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
              <Sparkles className="size-3" />
              AI 辅助分析
            </Badge>
          )}
          {report.insightSource === "hybrid" && (
            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
              部分 AI 增强
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {report.generatedAt.slice(0, 10)}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project?.name ?? "分析报告"}
        </h1>
        {project && (
          <p className="text-sm text-muted-foreground mt-1">
            {project.category}
            {project.targetAudience ? ` · ${project.targetAudience}` : ""}
            {" · "}
            {report.overview.summary.validVideoCount} 条有效视频
          </p>
        )}
      </div>

      {/* 低样本提示 */}
      {report.overview.summary.validVideoCount < 10 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">样本量较小</p>
              <p className="mt-0.5">
                当前仅 {report.overview.summary.validVideoCount} 条有效视频，洞察和趋势的可信度有限，建议累计更多数据后重新分析。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 报告内容 Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="overview">账号概览</TabsTrigger>
          <TabsTrigger value="insights">
            核心洞察
            {report.insights.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {report.insights.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="experiments">A/B 实验</TabsTrigger>
          <TabsTrigger value="briefs">创作 Brief</TabsTrigger>
          <TabsTrigger value="knowledge">知识库</TabsTrigger>
          <TabsTrigger value="methodology">指标说明</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewSection data={report.overview} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsSection
            insights={report.insights}
            insightSource={report.insightSource}
          />
        </TabsContent>

        <TabsContent value="experiments">
          <ExperimentsSection experiments={report.experiments} />
        </TabsContent>

        <TabsContent value="briefs">
          <BriefsSection briefs={report.briefs} />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeSection
            refs={report.knowledgeRefs}
            noMatchMessage={report.analysisSnapshot?.fallbackReason === "未配置 LLM API Key" || !report.knowledgeRefs?.length ? "当前项目上下文未匹配到相关策略知识" : undefined}
          />
        </TabsContent>

        <TabsContent value="methodology">
          <MethodologySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MethodologySection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">指标计算口径</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <h4 className="font-medium mb-1">整体指标</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>整体互动率</strong> = 总互动量（点赞+评论+收藏+分享）÷ 总播放量（加权口径）</li>
            <li><strong>整体商品点击率</strong> = 总商品点击数 ÷ 总播放量（加权口径，仅在字段存在时计算）</li>
            <li><strong>整体转化率</strong> = 总成交数 ÷ 总商品点击数（加权口径，仅在字段存在时计算）</li>
            <li><strong>平均完播率</strong> = 各视频完播率的算术平均</li>
            <li><strong>播放量中位数</strong> = 全部有效视频播放量的中位数</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-1">维度分组</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>分组依据：数据中实际存在的离散字段（时长区间、品类等）</li>
            <li>相对表现 = 组内平均播放量 ÷ 整体平均播放量 − 1</li>
            <li>置信度：1 条→仅展示、2 条→低、3−4 条→中、≥5 条→较高</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-1">洞察规则</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>基于规则模板生成，非 AI 自由生成</li>
            <li>所有数字可追溯到原始数据</li>
            <li>使用&ldquo;在本次样本中&rdquo;&ldquo;数据显示&rdquo;等审慎表述</li>
            <li>不声称因果关系或预测收益</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
