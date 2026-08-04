// CreatorLens TypeScript 类型定义
// 与 PRD §11 数据模型和 Excel 字段字典对齐

/** 价格带枚举 */
export type PriceBand = "<49元" | "50-99元" | "100-199元" | "200-499元" | "≥500元";

/** 时长区间枚举 */
export type DurationBand = "≤10秒" | "11-20秒" | "21-30秒" | ">30秒";

/** 记录状态 */
export type RecordStatus = "可分析" | "警告" | "不可用";

/** Hook 类型 */
export type HookType =
  | "效果前置"
  | "痛点前置"
  | "价格利益"
  | "悬念提问"
  | "人群点名"
  | "参数介绍"
  | "故事场景"
  | "其他"
  | "未知";

/** 内容结构节点 */
export type ContentStructureNode =
  | "效果展示"
  | "痛点描述"
  | "人群/场景"
  | "产品介绍"
  | "卖点证明"
  | "价格优惠"
  | "社会证明"
  | "行动引导";

/** CTA 类型 */
export type CtaType =
  | "购买引导"
  | "优惠引导"
  | "评论互动"
  | "关注引导"
  | "私信引导"
  | "无 CTA"
  | "其他";

/** 置信度等级 */
export type ConfidenceLevel = "高" | "较高" | "中" | "低" | "仅展示";

/** 洞察来源类型 */
export type InsightSource = "rule" | "llm" | "hybrid";

// ─── 项目 ────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  category: string;
  productName?: string;
  priceBand?: PriceBand;
  targetAudience?: string;
  analysisGoal?: string;
  status: ProjectStatus;
  videoCount: number;
  validVideoCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus =
  | "draft"               // 已创建，未上传
  | "data_imported"       // 数据已导入，未分析
  | "analyzing"           // 分析中
  | "completed"           // 分析完成
  | "partial_failed";     // 部分失败

// ─── 视频记录（32 字段，与 Excel 模板对齐） ───

export interface VideoRecord {
  // 标识（用户字段）
  video_id: string;
  publish_date?: string;
  // 商品（用户字段）
  product_name?: string;
  category: string;
  price_band?: PriceBand;
  target_audience?: string;
  // 内容（用户字段）
  title?: string;
  script_or_subtitle?: string;
  hook_text?: string;
  duration_seconds?: number;
  // 人工标签（用户字段）
  person_on_camera?: boolean | null;
  scene_demo?: boolean | null;
  product_closeup?: boolean | null;
  before_after?: boolean | null;
  // 曝光（用户字段）
  views: number;
  // 互动（用户字段）
  likes?: number;
  comments?: number;
  favorites?: number;
  shares?: number;
  // 留存（用户字段）
  completion_rate?: number;       // 0-1 归一化后
  avg_watch_time_seconds?: number;
  five_sec_retention?: number;    // 0-1 归一化后
  // 交易（用户字段）
  product_clicks?: number;
  orders?: number;
  // 备注（用户字段）
  notes?: string;
  source_url?: string;
  // 系统派生字段
  engagement_rate: number;
  product_click_rate?: number;
  conversion_rate?: number;
  duration_band: DurationBand;
  data_quality_score: number;     // 0-1
  record_status: RecordStatus;
}

// ─── 内容标签（AI 提取） ──────────────────────

export interface ContentTag {
  video_id: string;
  hook_type: HookType;
  hook_evidence: string;
  selling_points: string[];
  content_structure: ContentStructureNode[];
  cta_type: CtaType;
  target_audience: string;
  confidence: number;
  confidence_level: ConfidenceLevel;
  uncertain_fields: string[];
  // 人工修正
  original_ai_tags?: Partial<ContentTag>;
  human_modified_at?: string;
}

// ─── 校验结果 ────────────────────────────────

export interface ValidationResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  records: VideoRecord[];
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  row: number;
  video_id?: string;
  field: string;
  originalValue?: string;
  type: "error" | "warning";
  message: string;
}

// ─── 报告 ────────────────────────────────────

export interface Report {
  projectId: string;
  generatedAt: string;
  overview: AccountOverview;
  insights: Insight[];
  experiments: Experiment[];
  briefs: CreativeBrief[];
  knowledgeRefs: KnowledgeRef[];
  /** 洞察来源标识 */
  insightSource: InsightSource;
  /** 分析快照（用于追溯） */
  analysisSnapshot?: AnalysisSnapshot;
}

export interface AccountOverview {
  summary: {
    validVideoCount: number;
    dateRange: { start: string; end: string };
    missingFieldCount: number;
  };
  metrics: {
    medianViews: number;
    avgViews: number;
    totalViews: number;
    avgCompletionRate: number;
    avgEngagementRate: number;
    avgProductClickRate?: number;
    totalProductClicks?: number;
    overallConversionRate?: number;
    totalOrders?: number;
  };
  topVideos: RankedVideo[];
  bottomVideos: RankedVideo[];
  groupComparisons: GroupComparison[];
}

export interface RankedVideo {
  video_id: string;
  title?: string;
  views: number;
  completion_rate?: number;
  engagement_rate: number;
  product_clicks?: number;
  orders?: number;
  tags: string[];
}

export interface GroupComparison {
  dimension: string;
  groupA: { label: string; n: number; median: number };
  groupB: { label: string; n: number; median: number };
}

export interface Insight {
  id: string;
  title: string;
  claimType: "correlation";
  metric: string;
  metricLabel: string;
  groupA: { label: string; n: number; median: number };
  groupB: { label: string; n: number; median: number };
  absoluteDelta: number;
  relativeDelta: number | null;
  confidenceLevel: ConfidenceLevel;
  limitations: string[];
  knowledgeRefs: string[];
  recommendedAction: string;
  evidenceVideos: string[];
  source: string;
  supportingMetrics: string;
  facts: string;
  // ─── Phase 5: LLM 增强字段 ────────────────
  /** 是否由 AI 辅助生成 */
  aiAssisted?: boolean;
  /** 数据观察（LLM 生成） */
  observation?: string;
  /** 策略解释（LLM 生成，结合知识库） */
  explanation?: string;
  /** 知识卡片引用详情 */
  knowledgeCardRefs?: KnowledgeCardRef[];
}

/** 知识卡片引用（嵌入 Insight） */
export interface KnowledgeCardRef {
  id: string;
  title: string;
  source_title: string;
  source_url: string;
  match_reason?: string;
}

export interface Experiment {
  id: string;
  insightId: string;
  hypothesis: string;
  testVariable: string;
  controlVariables: string[];
  versionA: { hook: string; structure: string };
  versionB: { hook: string; structure: string };
  primaryMetric: string;
  secondaryMetrics: string[];
  minSamples: number;
  decisionRule: string;
  note?: string;
}

export interface CreativeBrief {
  id: string;
  experimentId: string;
  goal: string;
  productInfo: string;
  recommendedHook: string;
  contentStructure: string;
  controls: string[];
  generationPrompt: string;
  references: BriefReference[];
  note?: string;
}

export interface BriefReference {
  insightId: string;
  title: string;
  metric: string;
  sampleSize: number;
  confidenceLevel: string;
}

export interface KnowledgeRef {
  id: string;
  title: string;
  summary: string;
  source: string;
  applicableCategory: string;
  applicablePriceBand: string;
  // ─── Phase 5: 增强字段 ────────────────────
  /** 匹配原因 */
  matchReason?: string;
  /** 可点击来源 URL */
  sourceUrl?: string;
  /** 来源类型 */
  sourceType?: "platform_official" | "industry_report" | "public_research" | "best_practice";
}

// ─── Phase 5: 分析快照（可追溯） ──────────────

export interface AnalysisSnapshot {
  /** 快照 ID（= analysisId） */
  analysisId: string;
  /** Prompt 版本 */
  promptVersion: string;
  /** 生成时间 */
  generatedAt: string;
  /** 检索输入 */
  retrievalInput: {
    category?: string;
    price_band?: string;
    target_audience?: string;
    duration_band?: string;
    weaknesses?: string[];
  };
  /** 检索命中的策略卡片 ID */
  retrievedCardIds: string[];
  /** LLM 洞察数量（校验前） */
  llmInsightCount: number;
  /** 校验通过数量 */
  validatedInsightCount: number;
  /** LLM 模型 */
  llmModel?: string;
  /** 降级原因（如有） */
  fallbackReason?: string;
}

// ─── 分析状态 ────────────────────────────────

export interface AnalysisStatus {
  projectId: string;
  currentNode: AnalysisNode;
  nodes: NodeStatus[];
}

export type AnalysisNode =
  | "data_cleaning"
  | "feature_extraction"
  | "metric_calculation"
  | "knowledge_retrieval"
  | "insight_generation"
  | "experiment_brief_generation";

export interface NodeStatus {
  node: AnalysisNode;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}
