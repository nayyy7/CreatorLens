// CreatorLens Zod Schema 定义
// 用于 API 校验、表单验证和文件解析

import { z } from "zod";

// ─── 项目创建 ────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100),
  category: z.string().min(1, "商品品类不能为空").max(50),
  accountName: z.string().max(50).optional(),
  analysisGoal: z.string().max(200).optional(),
  priceBand: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ─── 解析后的原始记录（宽松，所有字段可选） ──

export const rawVideoRecordSchema = z.object({
  video_id: z.string().optional(),
  publish_date: z.string().optional(),
  product_name: z.string().optional(),
  category: z.string().optional(),
  price_band: z.string().optional(),
  target_audience: z.string().optional(),
  title: z.string().optional(),
  script_or_subtitle: z.string().optional(),
  hook_text: z.string().optional(),
  duration_seconds: z.union([z.string(), z.number()]).optional(),
  person_on_camera: z.union([z.string(), z.boolean()]).optional(),
  scene_demo: z.union([z.string(), z.boolean()]).optional(),
  product_closeup: z.union([z.string(), z.boolean()]).optional(),
  before_after: z.union([z.string(), z.boolean()]).optional(),
  views: z.union([z.string(), z.number()]).optional(),
  likes: z.union([z.string(), z.number()]).optional(),
  comments: z.union([z.string(), z.number()]).optional(),
  favorites: z.union([z.string(), z.number()]).optional(),
  shares: z.union([z.string(), z.number()]).optional(),
  completion_rate: z.union([z.string(), z.number()]).optional(),
  avg_watch_time_seconds: z.union([z.string(), z.number()]).optional(),
  five_sec_retention: z.union([z.string(), z.number()]).optional(),
  product_clicks: z.union([z.string(), z.number()]).optional(),
  orders: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
  source_url: z.string().optional(),
  // 系统派生字段（原始文件可能包含公式缓存值，需要重算）
  engagement_rate: z.union([z.string(), z.number()]).optional(),
  product_click_rate: z.union([z.string(), z.number()]).optional(),
  conversion_rate: z.union([z.string(), z.number()]).optional(),
  duration_band: z.string().optional(),
  data_quality_score: z.union([z.string(), z.number()]).optional(),
  record_status: z.string().optional(),
});

export type RawVideoRecord = z.infer<typeof rawVideoRecordSchema>;

// ─── 行级问题 ──────────────────────────────────

export const validationIssueSchema = z.object({
  row: z.number(),
  video_id: z.string().optional(),
  field: z.string(),
  originalValue: z.string().optional(),
  type: z.enum(["error", "warning"]),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

// ─── API 导入响应 ──────────────────────────────

export const importResponseSchema = z.object({
  success: z.boolean(),
  file: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
  }),
  sheet: z.string().optional(),
  summary: z.object({
    totalRows: z.number(),
    validRows: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
    duplicateIds: z.array(z.string()),
  }),
  previewRows: z.array(z.record(z.string(), z.unknown())),
  rowErrors: z.array(validationIssueSchema),
  rowWarnings: z.array(validationIssueSchema),
  blockingErrors: z.array(z.string()),
  canAnalyze: z.boolean(),
});

export type ImportResponse = z.infer<typeof importResponseSchema>;
