// CreatorLens 数据校验
// 逐行容错校验、标准化、派生字段计算

import type { VideoRecord } from "@/types";
import type { ValidationIssue } from "@/lib/schemas";
import { mapFieldName } from "@/lib/field-mapping";
import {
  calcEngagementRate,
  calcProductClickRate,
  calcConversionRate,
  calcDurationBand,
  calcDataQualityScore,
  calcRecordStatus,
  normalizePercentage,
  excelDateToString,
  isExcelDateSerial,
} from "@/lib/derived-fields";
import {
  REQUIRED_FIELDS,
  CONTENT_FIELDS,
  PERCENTAGE_FIELDS,
  MIN_VALID_VIDEOS,
  MAX_VALID_VIDEOS,
} from "@/lib/constants";

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  duplicateIds: string[];
}

export interface ValidationOutput {
  records: VideoRecord[];
  validRecords: VideoRecord[];
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: ValidationSummary;
  blockingErrors: string[];
  canAnalyze: boolean;
}

/**
 * 验证所有行
 */
export function validateAllRows(
  rawRows: Record<string, string>[],
  _sheetName?: string  // eslint-disable-line @typescript-eslint/no-unused-vars
): ValidationOutput {
  // Step 1: 映射表头
  const headerMapping = buildHeaderMapping(rawRows);

  if (!hasCoreHeaders(headerMapping)) {
    const missing = getMissingCoreFields(headerMapping);
    return {
      records: [],
      validRecords: [],
      issues: [],
      errors: [],
      warnings: [],
      summary: {
        totalRows: rawRows.length,
        validRows: 0,
        errorCount: 0,
        warningCount: 0,
        duplicateIds: [],
      },
      blockingErrors: [`缺少核心表头字段：${missing.join("、")}`],
      canAnalyze: false,
    };
  }

  // Step 2: 逐行标准化和校验
  const allRecords: (VideoRecord | null)[] = [];
  const allIssues: ValidationIssue[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const result = validateRow(rawRow, headerMapping, i + 1);
    allRecords.push(result.record);
    allIssues.push(...result.issues);
  }

  // Step 3: 去重（保留最后一条）
  const seen = new Map<string, { index: number; record: VideoRecord }>();
  const duplicateIds: string[] = [];

  for (let i = 0; i < allRecords.length; i++) {
    const record = allRecords[i];
    if (!record) continue;
    const id = record.video_id;
    if (seen.has(id)) {
      duplicateIds.push(id);
    }
    seen.set(id, { index: i, record });
  }

  // 去重警告
  for (const dupId of duplicateIds) {
    allIssues.push({
      row: 0, // 标记为全局
      video_id: dupId,
      field: "video_id",
      type: "warning",
      message: `video_id "${dupId}" 重复，已保留最后一条`,
    });
  }

  // Step 4: 构建最终记录列表（去重后）
  const dedupedRecords = Array.from(seen.values()).map((v) => v.record);
  const errors = allIssues.filter((i) => i.type === "error");
  const warnings = allIssues.filter((i) => i.type === "warning");
  const errorIds = new Set(errors.map((e) => e.video_id).filter(Boolean));

  // 有效记录 = 去重后 - 有错误的记录
  const validRecords = dedupedRecords.filter((r) => !errorIds.has(r.video_id));

  // Step 5: 汇总
  const summary: ValidationSummary = {
    totalRows: rawRows.length,
    validRows: validRecords.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    duplicateIds,
  };

  const blockingErrors: string[] = [];
  if (validRecords.length < MIN_VALID_VIDEOS) {
    blockingErrors.push(
      `有效记录仅 ${validRecords.length} 条，不足最低要求 ${MIN_VALID_VIDEOS} 条，无法开始分析`
    );
  }
  if (validRecords.length > MAX_VALID_VIDEOS) {
    blockingErrors.push(
      `有效记录 ${validRecords.length} 条，超过上限 ${MAX_VALID_VIDEOS} 条，请分批上传`
    );
  }

  const canAnalyze = blockingErrors.length === 0;

  return {
    records: dedupedRecords,
    validRecords,
    issues: allIssues,
    errors,
    warnings,
    summary,
    blockingErrors,
    canAnalyze,
  };
}

/**
 * 单行校验
 */
function validateRow(
  rawRow: Record<string, string>,
  headerMapping: Map<string, string>,
  excelRow: number
): { record: VideoRecord | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  // 映射字段
  const mapped: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(rawRow)) {
    const standardKey = headerMapping.get(rawKey);
    if (standardKey) {
      mapped[standardKey] = rawValue;
    }
  }

  // 识别 video_id
  const rawVideoId = mapped["video_id"] || "";

  function addIssue(field: string, type: "error" | "warning", message: string) {
    issues.push({
      row: excelRow,
      video_id: rawVideoId || undefined,
      field,
      originalValue: mapped[field] || undefined,
      type,
      message,
    });
  }

  // ─── 必填字段校验 ──────────────────────────
  for (const field of REQUIRED_FIELDS) {
    const val = mapped[field];
    if (!val || val.trim() === "") {
      addIssue(field, "error", `${field} 为必填字段，缺少该字段该行无法参与分析`);
    }
  }

  // ─── 内容字段（至少一项非空） ─────────────
  const hasContent = CONTENT_FIELDS.some((f) => mapped[f] && mapped[f].trim() !== "");
  if (!hasContent) {
    addIssue("title", "warning", "标题、脚本/字幕、Hook 文案均为空，无法提取内容标签");
  }

  // 如果有硬性错误，跳过后续标准化
  const hasHardError = REQUIRED_FIELDS.some(
    (f) => !mapped[f] || mapped[f].trim() === ""
  );
  if (hasHardError) {
    return { record: null, issues };
  }

  // ─── 数值标准化 ────────────────────────────
  const numbers: Record<string, number | undefined> = {};

  const numericFields = [
    "duration_seconds", "views", "likes", "comments", "favorites", "shares",
    "avg_watch_time_seconds", "product_clicks", "orders",
  ];
  for (const field of numericFields) {
    const raw = mapped[field];
    if (raw == null || raw === "") {
      numbers[field] = undefined;
      continue;
    }
    const num = Number(raw);
    if (isNaN(num)) {
      addIssue(field, "warning", `"${raw}" 无法转换为数字，已忽略`);
      numbers[field] = undefined;
    } else {
      numbers[field] = num;
    }
  }

  // ─── 百分比字段 ────────────────────────────
  const percentages: Record<string, number | undefined> = {};
  for (const field of PERCENTAGE_FIELDS) {
    const raw = mapped[field];
    if (raw == null || raw === "") {
      percentages[field] = undefined;
      continue;
    }
    const { value, warnings } = normalizePercentage(raw);
    if (warnings.some((w) => w.includes("超出"))) {
      addIssue(field, "error", warnings.join("；"));
      percentages[field] = undefined;
    } else {
      for (const w of warnings) {
        addIssue(field, "warning", w);
      }
      percentages[field] = value;
    }
  }

  // ─── views 特殊校验 ────────────────────────
  const views = numbers["views"];
  if (views != null && views <= 0) {
    addIssue("views", "error", `播放量 ${views} 必须大于 0，该行不可参与分析`);
    return { record: null, issues };
  }

  // ─── 布尔字段 ──────────────────────────────
  function parseBool(raw: string): boolean | null {
    const lower = raw.trim().toLowerCase();
    if (["是", "yes", "true", "1", "y"].includes(lower)) return true;
    if (["否", "no", "false", "0", "n"].includes(lower)) return false;
    if (["未知", "unknown"].includes(lower)) return null;
    return null;
  }

  const person_on_camera = parseBool(mapped["person_on_camera"] || "");
  const scene_demo = parseBool(mapped["scene_demo"] || "");
  const product_closeup = parseBool(mapped["product_closeup"] || "");
  const before_after = parseBool(mapped["before_after"] || "");

  // ─── 日期标准化 ────────────────────────────
  let publish_date = mapped["publish_date"]?.trim();
  if (publish_date) {
    const numCheck = Number(publish_date);
    if (!isNaN(numCheck) && isExcelDateSerial(numCheck)) {
      publish_date = excelDateToString(numCheck);
      addIssue("publish_date", "warning", `日期序列号 ${numCheck} 已转换为 ${publish_date}`);
    }
    // 简单校验 YYYY-MM-DD 格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publish_date) && !/^\d{4}\/\d{2}\/\d{2}$/.test(publish_date)) {
      addIssue("publish_date", "warning", `日期 "${publish_date}" 格式不标准，建议使用 YYYY-MM-DD`);
    }
  }

  // ─── 时长标准化 ────────────────────────────
  const duration_seconds = numbers["duration_seconds"];
  if (duration_seconds != null && (duration_seconds < 1 || duration_seconds > 300)) {
    addIssue("duration_seconds", "warning", `视频时长 ${duration_seconds} 秒异常，已保留但可能影响分析`);
  }

  // ─── 系统派生字段（重算） ──────────────────
  const engagement_rate = calcEngagementRate(
    numbers["likes"], numbers["comments"],
    numbers["favorites"], numbers["shares"], views
  ) ?? 0;

  const product_click_rate = calcProductClickRate(
    numbers["product_clicks"], views
  );

  const conversion_rate = calcConversionRate(
    numbers["orders"], numbers["product_clicks"]
  );

  const duration_band = calcDurationBand(duration_seconds);

  const dataQualityFields = {
    video_id: rawVideoId,
    category: mapped["category"],
    views,
    title: mapped["title"],
    script_or_subtitle: mapped["script_or_subtitle"],
    hook_text: mapped["hook_text"],
    completion_rate: percentages["completion_rate"],
    five_sec_retention: percentages["five_sec_retention"],
  };
  const data_quality_score = calcDataQualityScore(dataQualityFields);
  const hasContentIssues = !hasContent || issues.length > 0;
  const record_status = calcRecordStatus(data_quality_score, hasContentIssues);

  // ─── 构建记录 ──────────────────────────────
  const record: VideoRecord = {
    video_id: rawVideoId,
    publish_date: publish_date || undefined,
    product_name: mapped["product_name"]?.trim() || undefined,
    category: mapped["category"]?.trim() || "",
    price_band: mapped["price_band"]?.trim() as VideoRecord["price_band"],
    target_audience: mapped["target_audience"]?.trim() || undefined,
    title: mapped["title"]?.trim() || undefined,
    script_or_subtitle: mapped["script_or_subtitle"]?.trim() || undefined,
    hook_text: mapped["hook_text"]?.trim() || undefined,
    duration_seconds,
    person_on_camera,
    scene_demo,
    product_closeup,
    before_after,
    views: views!,
    likes: numbers["likes"],
    comments: numbers["comments"],
    favorites: numbers["favorites"],
    shares: numbers["shares"],
    completion_rate: percentages["completion_rate"],
    avg_watch_time_seconds: numbers["avg_watch_time_seconds"],
    five_sec_retention: percentages["five_sec_retention"],
    product_clicks: numbers["product_clicks"],
    orders: numbers["orders"],
    notes: mapped["notes"]?.trim() || undefined,
    source_url: mapped["source_url"]?.trim() || undefined,
    // 系统派生
    engagement_rate,
    product_click_rate,
    conversion_rate,
    duration_band,
    data_quality_score,
    record_status,
  };

  return { record, issues };
}

/**
 * 构建表头映射
 */
function buildHeaderMapping(
  rawRows: Record<string, string>[]
): Map<string, string> {
  const mapping = new Map<string, string>();
  // 从所有行收集可能的表头键
  const allKeys = new Set<string>();
  for (const row of rawRows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }
  for (const key of allKeys) {
    const mapped = mapFieldName(key);
    if (mapped) {
      mapping.set(key, mapped);
    }
  }
  return mapping;
}

function hasCoreHeaders(mapping: Map<string, string>): boolean {
  const mapped = new Set(mapping.values());
  return REQUIRED_FIELDS.every((f) => mapped.has(f));
}

function getMissingCoreFields(mapping: Map<string, string>): string[] {
  const mapped = new Set(mapping.values());
  return REQUIRED_FIELDS.filter((f) => !mapped.has(f));
}
