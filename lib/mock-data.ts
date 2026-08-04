// CreatorLens Mock 数据
// 模拟上传、校验结果，供 Phase 2 前端演示使用

import type {
  Project,
  VideoRecord,
  ValidationResult,
  AnalysisStatus,
} from "@/types";

// ─── Mock 项目 ────────────────────────────────

export function createMockProject(overrides?: Partial<Project>): Project {
  const now = new Date().toISOString();
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "盈Go 便携榨汁杯 · 7 月素材复盘",
    category: "小家电/便携榨汁杯",
    productName: "盈Go 便携榨汁杯",
    priceBand: "50-99元",
    targetAudience: "上班族",
    analysisGoal: "找出高完播率视频的内容特征，优化下一轮拍摄方向",
    status: "data_imported",
    videoCount: 20,
    validVideoCount: 20,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Mock 视频记录（精简，用于预览） ──────────

export function createMockRecords(): VideoRecord[] {
  return [
    {
      video_id: "V001", category: "小家电/便携榨汁杯", views: 18200,
      likes: 950, comments: 84, favorites: 530, shares: 160,
      completion_rate: 0.43, avg_watch_time_seconds: 8.8, five_sec_retention: 0.78,
      product_clicks: 1183, orders: 97,
      title: "15秒搞定一杯草莓奶昔", duration_seconds: 15,
      engagement_rate: 0.095, product_click_rate: 0.065, conversion_rate: 0.082,
      duration_band: "11-20秒", data_quality_score: 1, record_status: "可分析",
    },
    {
      video_id: "V002", category: "小家电/便携榨汁杯", views: 12600,
      likes: 560, comments: 42, favorites: 270, shares: 85,
      completion_rate: 0.33, avg_watch_time_seconds: 9.2, five_sec_retention: 0.68,
      product_clicks: 567, orders: 43,
      title: "早上没时间做早餐？", duration_seconds: 18,
      engagement_rate: 0.076, product_click_rate: 0.045, conversion_rate: 0.076,
      duration_band: "11-20秒", data_quality_score: 1, record_status: "可分析",
    },
    {
      video_id: "V003", category: "小家电/便携榨汁杯", views: 15800,
      likes: 820, comments: 75, favorites: 460, shares: 140,
      completion_rate: 0.36, avg_watch_time_seconds: 8.5, five_sec_retention: 0.72,
      product_clicks: 1185, orders: 90,
      title: "宿舍党一元喝鲜榨果汁", duration_seconds: 16,
      engagement_rate: 0.095, product_click_rate: 0.075, conversion_rate: 0.076,
      duration_band: "11-20秒", data_quality_score: 1, record_status: "可分析",
    },
    {
      video_id: "V004", category: "小家电/便携榨汁杯", views: 22100,
      likes: 1210, comments: 105, favorites: 680, shares: 220,
      completion_rate: 0.45, avg_watch_time_seconds: 8.4, five_sec_retention: 0.81,
      product_clicks: 1437, orders: 120,
      title: "香蕉牛奶打出来顺滑到爆", duration_seconds: 14,
      engagement_rate: 0.100, product_click_rate: 0.065, conversion_rate: 0.084,
      duration_band: "11-20秒", data_quality_score: 1, record_status: "可分析",
    },
    {
      video_id: "V005", category: "小家电/便携榨汁杯", views: 7200,
      likes: 230, comments: 18, favorites: 80, shares: 20,
      completion_rate: 0.22, avg_watch_time_seconds: 7.5, five_sec_retention: 0.48,
      product_clicks: 158, orders: 10,
      title: "双叶刀头300ml大容量", duration_seconds: 26,
      engagement_rate: 0.048, product_click_rate: 0.022, conversion_rate: 0.063,
      duration_band: "21-30秒", data_quality_score: 1, record_status: "可分析",
    },
    // 预览用前 5 条即可，完整 20 条在 report mock 中使用
  ];
}

// ─── Mock 校验结果 ────────────────────────────

export function createMockValidationResult(
  projectId: string,
  fileName: string = "CreatorLens_Day1_演示数据.xlsx"
): ValidationResult {
  return {
    fileName,
    totalRows: 20,
    validRows: 20,
    errorCount: 0,
    warningCount: 0,
    records: createMockRecords(),
    issues: [],
  };
}

// 演示数据文件名
export const DEMO_FILE_NAME = "CreatorLens_Day1_演示数据.xlsx";

// ─── Mock 分析状态 ────────────────────────────

export function createMockAnalysisStatus(projectId: string): AnalysisStatus {
  return {
    projectId,
    currentNode: "insight_generation",
    nodes: [
      { node: "data_cleaning", label: "数据清洗", status: "completed" },
      { node: "feature_extraction", label: "内容标签提取", status: "completed" },
      { node: "metric_calculation", label: "指标计算", status: "completed" },
      { node: "knowledge_retrieval", label: "知识检索", status: "completed" },
      { node: "insight_generation", label: "洞察生成", status: "running" },
      { node: "experiment_brief_generation", label: "实验与 Brief 生成", status: "pending" },
    ],
  };
}
