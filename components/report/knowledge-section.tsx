"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, Tag, AlertCircle, FileText } from "lucide-react";
import type { KnowledgeRef } from "@/types";

interface KnowledgeSectionProps {
  refs: KnowledgeRef[];
  noMatchMessage?: string;
}

export function KnowledgeSection({ refs, noMatchMessage }: KnowledgeSectionProps) {
  if (refs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <BookOpen className="size-10 text-muted-foreground mb-3" />
          <p className="font-medium">暂无匹配知识</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {noMatchMessage ||
              "当前项目上下文未匹配到相关策略卡片，洞察仅基于账号数据生成。建议丰富品类、价格带或目标人群信息以提升匹配效果。"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">知识库引用</h3>
        <Badge variant="secondary" className="ml-2">
          {refs.length} 条命中
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        以下策略卡片为行业通用方法论参考，不等同于对当前账号的因果判断。建议结合自身品类特点验证后使用。
      </p>
      <div className="grid gap-3">
        {refs.map((item) => (
          <StrategyCard key={item.id} card={item} />
        ))}
      </div>
    </div>
  );
}

function StrategyCard({ card }: { card: KnowledgeRef }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{card.title}</CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {card.id}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 策略内容 */}
        <div className="rounded-md bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <FileText className="size-3" />
            策略
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {card.summary}
          </p>
        </div>

        {/* 匹配信息 */}
        {card.matchReason && (
          <div className="flex items-start gap-2 text-xs">
            <Tag className="size-3 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground">匹配原因：</span>
              <span className="text-muted-foreground">{card.matchReason}</span>
            </div>
          </div>
        )}

        {/* 适用场景 */}
        <div className="flex flex-wrap gap-1">
          {card.applicableCategory && card.applicableCategory !== "不限" && (
            <Badge variant="outline" className="text-[10px]">
              品类：{card.applicableCategory}
            </Badge>
          )}
          {card.applicablePriceBand && card.applicablePriceBand !== "不限" && (
            <Badge variant="outline" className="text-[10px]">
              价格带：{card.applicablePriceBand}
            </Badge>
          )}
        </div>

        {/* 来源 */}
        <div className="flex items-start gap-2 text-xs">
          <ExternalLink className="size-3 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">来源</p>
            <p className="text-muted-foreground">{card.source}</p>
            {card.sourceUrl && (
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {card.sourceUrl}
              </a>
            )}
            {card.sourceType && (
              <Badge variant="outline" className="text-[10px] mt-1">
                {formatSourceType(card.sourceType)}
              </Badge>
            )}
          </div>
        </div>

        {/* 免责声明 */}
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="size-3 shrink-0 mt-0.5" />
          <span>
            此卡片为行业通用策略，不等同于对当前账号的因果判断。建议结合自身数据验证后使用。
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatSourceType(type: string): string {
  switch (type) {
    case "platform_official":
      return "平台官方";
    case "industry_report":
      return "行业报告";
    case "public_research":
      return "公开研究";
    case "best_practice":
      return "最佳实践";
    default:
      return type;
  }
}
