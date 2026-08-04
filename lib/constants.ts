// CreatorLens 常量定义
// 标签枚举、字段字典、数据规则阈值

import type {
  HookType,
  ContentStructureNode,
  CtaType,
  DurationBand,
  PriceBand,
  ConfidenceLevel,
} from "@/types";

// ─── Hook 类型枚举 ────────────────────────────

export const HOOK_TYPES: HookType[] = [
  "效果前置",
  "痛点前置",
  "价格利益",
  "悬念提问",
  "人群点名",
  "参数介绍",
  "故事场景",
  "其他",
  "未知",
];

// ─── 内容结构节点枚举 ────────────────────────

export const CONTENT_STRUCTURE_NODES: ContentStructureNode[] = [
  "效果展示",
  "痛点描述",
  "人群/场景",
  "产品介绍",
  "卖点证明",
  "价格优惠",
  "社会证明",
  "行动引导",
];

// ─── CTA 类型枚举 ────────────────────────────

export const CTA_TYPES: CtaType[] = [
  "购买引导",
  "优惠引导",
  "评论互动",
  "关注引导",
  "私信引导",
  "无 CTA",
  "其他",
];

// ─── 时长区间 ─────────────────────────────────

export const DURATION_BANDS: DurationBand[] = [
  "≤10秒",
  "11-20秒",
  "21-30秒",
  ">30秒",
];

// ─── 价格带 ──────────────────────────────────

export const PRICE_BANDS: PriceBand[] = [
  "<49元",
  "50-99元",
  "100-199元",
  "200-499元",
  "≥500元",
];

// ─── 置信度阈值 ──────────────────────────────

export const CONFIDENCE_THRESHOLDS: Record<ConfidenceLevel, { min: number; max: number }> = {
  "高": { min: 0.8, max: 1.0 },
  "较高": { min: 0.7, max: 0.79 },
  "中": { min: 0.6, max: 0.69 },
  "低": { min: 0, max: 0.59 },
  "仅展示": { min: 0, max: 0 },
};

// ─── 数据规则阈值 ─────────────────────────────

/** 最小有效视频数 */
export const MIN_VALID_VIDEOS = 10;
/** 最大有效视频数 */
export const MAX_VALID_VIDEOS = 30;
/** 最大文件大小 (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** 支持的 MIME 类型 */
export const SUPPORTED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
/** 支持的文件扩展名 */
export const SUPPORTED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

// ─── 必填字段（硬性） ─────────────────────────

export const REQUIRED_FIELDS = ["video_id", "category", "views"] as const;

// ─── 内容字段（至少一项非空） ────────────────

export const CONTENT_FIELDS = ["title", "script_or_subtitle", "hook_text"] as const;

// ─── 百分比字段（需归一化校验） ──────────────

export const PERCENTAGE_FIELDS = [
  "completion_rate",
  "five_sec_retention",
  "product_click_rate",
  "conversion_rate",
] as const;

// ─── Excel 工作表优先级 ───────────────────────

export const EXCEL_SHEET_PRIORITY = ["演示数据", "输入模板"];

// ─── 表头识别关键字 ──────────────────────────

export const HEADER_KEYWORDS = ["video_id", "category", "views"];

// ─── 系统派生字段 ────────────────────────────

export const DERIVED_FIELDS = [
  "engagement_rate",
  "product_click_rate",
  "conversion_rate",
  "duration_band",
  "data_quality_score",
  "record_status",
] as const;
