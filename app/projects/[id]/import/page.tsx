"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  Beaker,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dropzone } from "@/components/upload/dropzone";
import type { ImportResponse, ValidationIssue } from "@/lib/schemas";
import type { AnalysisStatus } from "@/types";

type PageState =
  | "empty"
  | "uploading"
  | "validated"
  | "analyzing"
  | "upload_error"
  | "api_error";

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [pageState, setPageState] = useState<PageState>("empty");
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  // 从 store 获取项目信息（或 API）
  const [project, setProject] = useState<{ name: string; category: string; targetAudience?: string; analysisGoal?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProject(data.project);
      })
      .catch(() => {});
  }, [projectId]);

  // 上传文件
  const handleFileSelect = useCallback(
    async (file: File) => {
      setPageState("uploading");
      setErrorMessage("");
      setImportResult(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`/api/projects/${projectId}/import`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.error || "文件处理失败");
          setPageState("upload_error");
          if (data.blockingErrors) {
            setImportResult(data);
          }
          return;
        }

        setImportResult(data);
        setPageState("validated");
      } catch {
        setErrorMessage("网络错误，请检查连接后重试");
        setPageState("api_error");
      }
    },
    [projectId]
  );

  // 载入演示数据
  const handleLoadDemo = useCallback(async () => {
    setPageState("uploading");
    setErrorMessage("");
    setImportResult(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/import/demo`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "演示数据加载失败");
        setPageState("upload_error");
        if (data.blockingErrors) {
          setImportResult(data);
        }
        return;
      }

      setImportResult(data);
      setPageState("validated");
    } catch {
      setErrorMessage("网络错误，请检查连接后重试");
      setPageState("api_error");
    }
  }, [projectId]);

  // 开始分析（调用真实 API）
  const handleStartAnalysis = useCallback(async () => {
    setPageState("analyzing");
    setAnalysisStatus({
      projectId,
      currentNode: "metric_calculation",
      nodes: [
        { node: "data_cleaning", label: "数据校验", status: "completed" },
        { node: "metric_calculation", label: "指标计算", status: "running" },
        { node: "insight_generation", label: "洞察生成", status: "pending" },
        { node: "experiment_brief_generation", label: "实验与 Brief 生成", status: "pending" },
      ],
    });

    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "分析失败");
        setPageState("upload_error");
        return;
      }

      router.push(`/reports/${json.analysisId}`);
    } catch {
      setErrorMessage("网络错误，分析请求失败");
      setPageState("api_error");
    }
  }, [projectId, router]);

  // 重试
  const handleRetry = useCallback(() => {
    setPageState("empty");
    setImportResult(null);
    setErrorMessage("");
    setShowErrors(false);
    setShowWarnings(false);
  }, []);

  if (!project) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">加载项目信息...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          工作台
        </Link>
        <span>/</span>
        <Link href="/projects/new" className="hover:text-foreground transition-colors">
          新建项目
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-48">
          {project.name}
        </span>
      </div>

      {/* 项目信息 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {project.name}
            <Badge variant="secondary" className="text-xs">导入数据</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>品类：{project.category}</span>
            {project.targetAudience && <span>目标人群：{project.targetAudience}</span>}
            {project.analysisGoal && (
              <span className="max-w-md truncate">分析目标：{project.analysisGoal}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="mb-6" />

      <div className="space-y-6">
        <h2 className="text-lg font-semibold">导入数据</h2>

        {/* ─── 空状态 + 上传中 ───────────────── */}
        {(pageState === "empty" || pageState === "uploading") && (
          <div className="space-y-4">
            <Dropzone
              onFileSelect={handleFileSelect}
              disabled={pageState === "uploading"}
            />
            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <div>
                <p>支持 .xlsx、.xls、.csv 格式，文件大小不超过 10 MB</p>
                <p className="mt-0.5">
                  必须包含 video_id、category、views 等核心字段；建议使用官方数据模板，以获得完整分析结果。
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">或</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoadDemo}
              disabled={pageState === "uploading"}
            >
              <Beaker className="size-4 mr-2" />
              载入演示数据（20 条合成便携榨汁杯数据）
            </Button>

            {pageState === "uploading" && (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <Loader2 className="size-8 animate-spin text-primary mb-4" />
                  <p className="font-medium">正在解析文件...</p>
                  <p className="text-sm text-muted-foreground">
                    正在扫描表头、校验字段和计算派生指标
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── 上传/网络错误 ─────────────────── */}
        {(pageState === "upload_error" || pageState === "api_error") && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center py-8 text-center">
              <div className="rounded-full bg-destructive/10 p-2 mb-3">
                {pageState === "api_error" ? (
                  <AlertCircle className="size-6 text-destructive" />
                ) : (
                  <XCircle className="size-6 text-destructive" />
                )}
              </div>
              <p className="font-medium text-destructive">
                {pageState === "api_error" ? "网络错误" : "文件处理失败"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {errorMessage}
              </p>
              {importResult?.blockingErrors && importResult.blockingErrors.length > 0 && (
                <div className="mt-3 text-sm text-destructive">
                  {importResult.blockingErrors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleRetry}
              >
                <RefreshCw className="size-3.5 mr-1" />
                重新上传
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── 校验成功 ──────────────────────── */}
        {pageState === "validated" && importResult && (
          <div className="space-y-6">
            {/* 文件信息 */}
            <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <div className="rounded-md bg-primary/10 p-2">
                <FileSpreadsheet className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{importResult.file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.sheet && `工作表：${importResult.sheet} · `}
                  {importResult.summary.totalRows} 条记录 · {importResult.summary.validRows} 条可用
                </p>
              </div>
            </div>

            {/* 校验统计 */}
            <div className="grid grid-cols-3 gap-3">
              <StatBadge label="有效记录" count={importResult.summary.validRows} variant="success" />
              <StatBadge label="警告" count={importResult.summary.warningCount} variant="warning" />
              <StatBadge label="错误" count={importResult.summary.errorCount} variant="error" />
            </div>

            {/* 阻塞错误 */}
            {importResult.blockingErrors.length > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">无法开始分析</p>
                      {importResult.blockingErrors.map((e, i) => (
                        <p key={i} className="mt-1">{e}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 行错误（可展开） */}
            {importResult.rowErrors.length > 0 && (
              <div>
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
                >
                  {showErrors ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  行级错误（{importResult.rowErrors.length}）
                </button>
                {showErrors && (
                  <div className="mt-2 rounded-lg border border-destructive/30 overflow-hidden">
                    <IssueTable issues={importResult.rowErrors} />
                  </div>
                )}
              </div>
            )}

            {/* 行警告（可展开） */}
            {importResult.rowWarnings.length > 0 && (
              <div>
                <button
                  onClick={() => setShowWarnings(!showWarnings)}
                  className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:underline"
                >
                  {showWarnings ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  行级警告（{importResult.rowWarnings.length}）
                </button>
                {showWarnings && (
                  <div className="mt-2 rounded-lg border border-amber-200 overflow-hidden">
                    <IssueTable issues={importResult.rowWarnings} />
                  </div>
                )}
              </div>
            )}

            {/* 数据预览 */}
            <div>
              <h3 className="text-sm font-medium mb-3">
                数据预览（仅展示前 5 条，共 {importResult.summary.validRows} 条）
              </h3>
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <PreviewTable rows={importResult.previewRows} />
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="size-4 mr-1" />
                重新上传
              </Button>
              <Button
                onClick={handleStartAnalysis}
                disabled={!importResult.canAnalyze}
              >
                开始分析
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── 分析中（Mock） ────────────────── */}
        {pageState === "analyzing" && analysisStatus && (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-4">
                <p className="font-medium text-center mb-4">正在分析...</p>
                {analysisStatus.nodes.map((node) => (
                  <div key={node.node} className="flex items-center gap-3 text-sm">
                    {node.status === "completed" && (
                      <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                    )}
                    {node.status === "running" && (
                      <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                    )}
                    {(node.status === "pending" || node.status === "failed") && (
                      <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <span
                      className={
                        node.status === "running"
                          ? "font-medium"
                          : node.status === "failed"
                          ? "text-destructive"
                          : ""
                      }
                    >
                      {node.label}
                    </span>
                    {node.status === "failed" && node.error && (
                      <span className="text-xs text-destructive">{node.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── 子组件 ──────────────────────────────────

function StatBadge({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "success" | "warning" | "error";
}) {
  const icons = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  };
  const colors = {
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  const Icon = icons[variant];

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${colors[variant]}`}>
      <Icon className="size-4" />
      <div>
        <p className="text-lg font-semibold">{count}</p>
        <p className="text-xs opacity-80">{label}</p>
      </div>
    </div>
  );
}

function IssueTable({ issues }: { issues: ValidationIssue[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">行号</TableHead>
          <TableHead className="w-24">video_id</TableHead>
          <TableHead className="w-24">字段</TableHead>
          <TableHead>说明</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue, i) => (
          <TableRow key={i}>
            <TableCell>{issue.row}</TableCell>
            <TableCell className="font-mono text-xs">{issue.video_id || "-"}</TableCell>
            <TableCell className="font-mono text-xs">{issue.field}</TableCell>
            <TableCell className="text-sm">{issue.message}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PreviewTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">无可用数据</p>;

  const keys = Object.keys(rows[0]).slice(0, 8);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {keys.map((k) => (
            <TableHead key={k} className="whitespace-nowrap text-xs">{k}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {keys.map((k) => (
              <TableCell key={k} className="text-xs max-w-32 truncate">
                {String(row[k] ?? "-")}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
