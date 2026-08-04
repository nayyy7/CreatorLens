// CreatorLens 统计分析引擎
// 纯函数，所有计算基于真实上传数据

import type { VideoRecord } from "@/types";

// ─── 基础统计 ────────────────────────────────

export interface SummaryStats {
  validCount: number;
  totalViews: number;
  avgViews: number;
  medianViews: number;
  maxViews: number;
  minViews: number;
  dateRange: { start: string; end: string } | null;
  // 互动
  totalInteractions: number;
  overallEngagementRate: number | null;   // 加权：总互动 ÷ 总播放
  avgEngagementRate: number | null;       // 单条互动率的算术平均
  // 商品
  totalProductClicks: number | null;
  overallProductClickRate: number | null; // 加权：总点击 ÷ 总播放
  totalOrders: number | null;
  overallConversionRate: number | null;   // 加权：总订单 ÷ 总点击
  // 留存
  avgCompletionRate: number | null;
  avgFiveSecRetention: number | null;
}

export function computeSummaryStats(records: VideoRecord[]): SummaryStats {
  const valid = records.filter((r) => r.record_status !== "不可用");
  const n = valid.length;

  if (n === 0) {
    return emptyStats();
  }

  // 播放量
  const views = valid.map((r) => r.views).sort((a, b) => a - b);
  const totalViews = sum(views);
  const avgViews = round2(totalViews / n);
  const medianViews = median(views);
  const maxViews = views[n - 1];
  const minViews = views[0];

  // 日期范围
  const dates = valid
    .map((r) => r.publish_date)
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d))
    .sort();
  const dateRange =
    dates.length >= 2
      ? { start: dates[0], end: dates[dates.length - 1] }
      : dates.length === 1
      ? { start: dates[0], end: dates[0] }
      : null;

  // 互动（加权口径）
  const totalLikes = sum(valid.map((r) => r.likes ?? 0));
  const totalComments = sum(valid.map((r) => r.comments ?? 0));
  const totalFavorites = sum(valid.map((r) => r.favorites ?? 0));
  const totalShares = sum(valid.map((r) => r.shares ?? 0));
  const totalInteractions = totalLikes + totalComments + totalFavorites + totalShares;
  const overallEngagementRate =
    totalViews > 0 ? round4(totalInteractions / totalViews) : null;

  // 单条互动率平均
  const individualRates = valid
    .map((r) => r.engagement_rate)
    .filter((v): v is number => v != null && !isNaN(v));
  const avgEngagementRate =
    individualRates.length > 0 ? round4(mean(individualRates)) : null;

  // 商品
  const productClicks = valid
    .map((r) => r.product_clicks)
    .filter((v): v is number => v != null && !isNaN(v));
  const totalProductClicks = sum(productClicks);
  const overallProductClickRate =
    totalViews > 0 && productClicks.length > 0
      ? round4(totalProductClicks / totalViews)
      : null;

  const orders = valid
    .map((r) => r.orders)
    .filter((v): v is number => v != null && !isNaN(v));
  const totalOrders = sum(orders);
  const overallConversionRate =
    totalProductClicks > 0 && orders.length > 0
      ? round4(totalOrders / totalProductClicks)
      : null;

  // 留存
  const completionRates = valid
    .map((r) => r.completion_rate)
    .filter((v): v is number => v != null && !isNaN(v));
  const avgCompletionRate =
    completionRates.length > 0 ? round4(mean(completionRates)) : null;

  const fiveSecRet = valid
    .map((r) => r.five_sec_retention)
    .filter((v): v is number => v != null && !isNaN(v));
  const avgFiveSecRetention =
    fiveSecRet.length > 0 ? round4(mean(fiveSecRet)) : null;

  return {
    validCount: n,
    totalViews,
    avgViews,
    medianViews,
    maxViews,
    minViews,
    dateRange,
    totalInteractions,
    overallEngagementRate,
    avgEngagementRate,
    totalProductClicks: productClicks.length > 0 ? totalProductClicks : null,
    overallProductClickRate,
    totalOrders: orders.length > 0 ? totalOrders : null,
    overallConversionRate,
    avgCompletionRate,
    avgFiveSecRetention,
  };
}

function emptyStats(): SummaryStats {
  return {
    validCount: 0,
    totalViews: 0,
    avgViews: 0,
    medianViews: 0,
    maxViews: 0,
    minViews: 0,
    dateRange: null,
    totalInteractions: 0,
    overallEngagementRate: null,
    avgEngagementRate: null,
    totalProductClicks: null,
    overallProductClickRate: null,
    totalOrders: null,
    overallConversionRate: null,
    avgCompletionRate: null,
    avgFiveSecRetention: null,
  };
}

// ─── Top 视频 ─────────────────────────────────

export interface RankedVideo {
  video_id: string;
  title?: string;
  views: number;
  completion_rate?: number;
  engagement_rate: number;
  product_clicks?: number;
  orders?: number;
  duration_band?: string;
  category?: string;
}

export function topByViews(records: VideoRecord[], count = 3): RankedVideo[] {
  return records
    .filter((r) => r.record_status !== "不可用")
    .sort((a, b) => b.views - a.views)
    .slice(0, count)
    .map(toRanked);
}

export function topByEngagement(records: VideoRecord[], count = 3): RankedVideo[] {
  return records
    .filter((r) => r.record_status !== "不可用")
    .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
    .slice(0, count)
    .map(toRanked);
}

export function topByProductClicks(records: VideoRecord[], count = 3): RankedVideo[] {
  return records
    .filter(
      (r) => r.record_status !== "不可用" && r.product_clicks != null
    )
    .sort((a, b) => (b.product_clicks ?? 0) - (a.product_clicks ?? 0))
    .slice(0, count)
    .map(toRanked);
}

function toRanked(r: VideoRecord): RankedVideo {
  return {
    video_id: r.video_id,
    title: r.title,
    views: r.views,
    completion_rate: r.completion_rate,
    engagement_rate: r.engagement_rate,
    product_clicks: r.product_clicks,
    orders: r.orders,
    duration_band: r.duration_band,
    category: r.category,
  };
}

// ─── 数学工具 ──────────────────────────────────

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : sum(arr) / arr.length;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
