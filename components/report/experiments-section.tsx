"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Target, Gauge, CheckCircle2 } from "lucide-react";
import type { Experiment } from "@/types";

interface ExperimentsSectionProps {
  experiments: Experiment[];
}

export function ExperimentsSection({ experiments }: ExperimentsSectionProps) {
  if (experiments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <FlaskConical className="size-10 text-muted-foreground mb-3" />
          <p className="font-medium">暂无实验方案</p>
          <p className="text-sm text-muted-foreground">
            请先从洞察中选择至少一条生成 A/B 实验
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">A/B 测试方案</h3>
        <Badge variant="secondary" className="ml-2">
          单变量实验
        </Badge>
      </div>
      {experiments.map((exp) => (
        <ExperimentCard key={exp.id} experiment={exp} />
      ))}
    </div>
  );
}

function ExperimentCard({ experiment: exp }: { experiment: Experiment }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">实验假设</CardTitle>
        <CardDescription>{exp.hypothesis}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 测试变量 */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Target className="size-4 text-primary" />
            测试变量
          </div>
          <p className="text-sm bg-muted rounded-md px-3 py-2">
            唯一变量：<strong>{exp.testVariable}</strong>
          </p>
        </div>

        {/* A/B 版本 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold text-primary mb-1">版本 A</p>
            <p className="text-xs text-muted-foreground">
              <strong>Hook：</strong>{exp.versionA.hook}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>结构：</strong>{exp.versionA.structure}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold text-accent-foreground mb-1">版本 B</p>
            <p className="text-xs text-muted-foreground">
              <strong>Hook：</strong>{exp.versionB.hook}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>结构：</strong>{exp.versionB.structure}
            </p>
          </div>
        </div>

        {/* 控制变量 */}
        <div>
          <p className="text-sm font-medium mb-1.5">控制变量（保持一致）</p>
          <div className="flex flex-wrap gap-1">
            {exp.controlVariables.map((v) => (
              <Badge key={v} variant="outline" className="text-xs">
                {v}
              </Badge>
            ))}
          </div>
        </div>

        {/* 指标与判定 */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
          <Gauge className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong>主要指标：</strong>{exp.primaryMetric}
            </p>
            <p>
              <strong>辅助指标：</strong>{exp.secondaryMetrics.join("、")}
            </p>
            <p>
              <strong>最小执行量：</strong>每版本至少 {exp.minSamples} 条
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>判定规则：</strong>{exp.decisionRule}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
