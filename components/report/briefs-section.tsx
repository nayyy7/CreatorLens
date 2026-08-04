"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Copy, Check, MonitorPlay } from "lucide-react";
import { useState } from "react";
import type { CreativeBrief } from "@/types";

interface BriefsSectionProps {
  briefs: CreativeBrief[];
}

export function BriefsSection({ briefs }: BriefsSectionProps) {
  if (briefs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <FileText className="size-10 text-muted-foreground mb-3" />
          <p className="font-medium">暂无创作 Brief</p>
          <p className="text-sm text-muted-foreground">
            请先从洞察生成 A/B 实验后再创建 Brief
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">创作 Brief</h3>
      </div>
      {briefs.map((brief) => (
        <BriefCard key={brief.id} brief={brief} />
      ))}
    </div>
  );
}

function BriefCard({ brief }: { brief: CreativeBrief }) {
  const [copied, setCopied] = useState(false);

  function handleCopyPrompt() {
    navigator.clipboard.writeText(brief.generationPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">创作目标</CardTitle>
        <CardDescription>{brief.goal}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 商品信息 */}
        <InfoBlock label="商品信息" content={brief.productInfo} />

        {/* 推荐 Hook */}
        <InfoBlock label="推荐 Hook（含实验版本）" content={brief.recommendedHook} />

        {/* 内容结构 */}
        <InfoBlock label="内容结构" content={brief.contentStructure} />

        {/* 控制项 */}
        <div>
          <p className="text-sm font-medium mb-1.5">控制项</p>
          <div className="flex flex-wrap gap-1">
            {brief.controls.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        {/* 视频生成指令 */}
        <div className="rounded-md bg-muted p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MonitorPlay className="size-4 text-primary" />
              视频生成指令
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleCopyPrompt}
              className="h-7 text-xs"
            >
              {copied ? (
                <>
                  <Check className="size-3" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="size-3" /> 复制
                </>
              )}
            </Button>
          </div>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {brief.generationPrompt}
          </pre>
        </div>

        {/* 依据 */}
        {brief.references && brief.references.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">依据</p>
            {brief.references.map((ref, i) => (
              <p key={i}>
                洞察「{ref.title}」· {ref.metric} · 样本量 {ref.sampleSize} · 置信度 {ref.confidenceLevel}
              </p>
            ))}
          </div>
        )}
        {/* 标注 */}
        <p className="text-xs text-muted-foreground">{brief.note || "基于规则模板生成，建议人工确认"}</p>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
    </div>
  );
}
