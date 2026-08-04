"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Timer,
  MousePointerClick,
  ShoppingCart,
  Calendar,
  FileWarning,
  BarChart3,
  Package,
  TrendingUp,
} from "lucide-react";
import type { AccountOverview } from "@/types";

interface OverviewSectionProps {
  data: AccountOverview;
}

export function OverviewSection({ data }: OverviewSectionProps) {
  const { summary, metrics } = data;

  return (
    <div className="space-y-6">
      {/* 指标卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="总播放量"
          value={metrics.totalViews?.toLocaleString() ?? "-"}
          icon={Eye}
        />
        <MetricCard
          label="播放量中位数"
          value={metrics.medianViews.toLocaleString()}
          icon={BarChart3}
        />
        <MetricCard
          label="平均完播率"
          value={`${(metrics.avgCompletionRate * 100).toFixed(0)}%`}
          icon={Timer}
        />
        <MetricCard
          label="整体互动率"
          value={`${(metrics.avgEngagementRate * 100).toFixed(1)}%`}
          icon={MousePointerClick}
        />
      </div>

      {/* 电商指标卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="商品点击率"
          value={
            metrics.avgProductClickRate != null
              ? `${(metrics.avgProductClickRate * 100).toFixed(1)}%`
              : "未提供"
          }
          icon={ShoppingCart}
        />
        <MetricCard
          label="商品总点击"
          value={
            metrics.totalProductClicks != null
              ? metrics.totalProductClicks.toLocaleString()
              : "未提供"
          }
          icon={MousePointerClick}
        />
        <MetricCard
          label="总订单量"
          value={
            metrics.totalOrders != null
              ? metrics.totalOrders.toLocaleString()
              : "未提供"
          }
          icon={Package}
        />
        <MetricCard
          label="整体转化率"
          value={
            metrics.overallConversionRate != null
              ? `${(metrics.overallConversionRate * 100).toFixed(1)}%`
              : "未提供"
          }
          icon={TrendingUp}
        />
      </div>

      {/* 数据摘要 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">数据摘要</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryItem
              icon={Calendar}
              label="分析时间范围"
              value={`${summary.dateRange.start} — ${summary.dateRange.end}`}
            />
            <SummaryItem
              icon={Eye}
              label="有效视频数"
              value={`${summary.validVideoCount} 条`}
            />
            <SummaryItem
              icon={FileWarning}
              label="缺失字段"
              value={summary.missingFieldCount > 0 ? `${summary.missingFieldCount} 个` : "无"}
            />
          </div>
        </CardContent>
      </Card>

      {/* 分组对比 */}
      {data.groupComparisons.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分组对比</CardTitle>
            <CardDescription>
              按不同维度分组后的指标中位数对比
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.groupComparisons.map((g, idx) => (
                <div key={idx} className="space-y-2">
                  <p className="text-sm font-medium">{g.dimension}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {g.groupA.label}：<strong>{g.groupA.median.toFixed(2)}</strong>
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-muted-foreground">
                      {g.groupB.label}：<strong>{g.groupB.median.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top / Bottom 视频 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <VideoRankCard title="表现最佳 Top 3" videos={data.topVideos} variant="top" />
        <VideoRankCard title="表现最弱 Bottom 3" videos={data.bottomVideos} variant="bottom" />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="size-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function VideoRankCard({
  title,
  videos,
  variant,
}: {
  title: string;
  videos: AccountOverview["topVideos"];
  variant: "top" | "bottom";
}) {
  const borderColor =
    variant === "top" ? "border-l-green-500" : "border-l-red-400";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {videos.map((v) => (
          <div
            key={v.video_id}
            className={`rounded-md border-l-4 ${borderColor} bg-muted/30 px-4 py-3`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">
                {v.video_id} {v.title ? `· ${v.title}` : ""}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {v.views.toLocaleString()} 播放
                {v.product_clicks != null ? ` · ${v.product_clicks.toLocaleString()} 点击` : ""}
                {v.orders != null ? ` · ${v.orders.toLocaleString()} 单` : ""}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {v.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
