import { NextRequest, NextResponse } from "next/server";
import { parseFile } from "@/lib/parsers";
import { validateAllRows } from "@/lib/validators";
import { setRecords, setValidationResult, getProject } from "@/lib/store";
import type { ImportResponse } from "@/lib/schemas";
import type { VideoRecord } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证项目存在
    const project = getProject(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "项目不存在" },
        { status: 404 }
      );
    }

    // 检查 Content-Type
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "请使用 multipart/form-data 上传文件" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "未找到上传文件" },
        { status: 400 }
      );
    }

    // 文件类型检查
    const fileName = file.name.toLowerCase();
    const validExts = [".csv", ".xlsx", ".xls"];
    const ext = "." + fileName.split(".").pop();
    if (!validExts.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `不支持的文件格式 ${ext}，请上传 .csv、.xlsx 或 .xls 文件`,
        },
        { status: 400 }
      );
    }

    // 读取文件
    const buffer = Buffer.from(await file.arrayBuffer());

    // 解析
    const parseResult = parseFile(buffer, file.name, file.size);
    if (parseResult.blockingError) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error || parseResult.blockingError,
          blockingErrors: [parseResult.blockingError],
          canAnalyze: false,
        },
        { status: 400 }
      );
    }

    // 校验
    const validation = validateAllRows(parseResult.rows, parseResult.sheetName);

    // 存储
    setRecords(id, validation.validRecords);
    setValidationResult(id, {
      fileName: file.name,
      totalRows: validation.summary.totalRows,
      validRows: validation.summary.validRows,
      errorCount: validation.summary.errorCount,
      warningCount: validation.summary.warningCount,
      records: validation.validRecords,
      issues: validation.issues,
    });

    // 更新项目状态
    project.status = "data_imported";
    project.videoCount = validation.summary.totalRows;
    project.validVideoCount = validation.summary.validRows;
    project.updatedAt = new Date().toISOString();

    // 构建响应
    const response: ImportResponse = {
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
      sheet: parseResult.sheetName,
      summary: validation.summary,
      previewRows: validation.validRecords.slice(0, 5).map(recordToPreview),
      rowErrors: validation.errors,
      rowWarnings: validation.warnings,
      blockingErrors: validation.blockingErrors,
      canAnalyze: validation.canAnalyze,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "文件处理失败，请检查文件格式后重试",
        canAnalyze: false,
      },
      { status: 500 }
    );
  }
}

/**
 * 将 VideoRecord 转换为预览用的普通对象
 */
function recordToPreview(record: VideoRecord): Record<string, unknown> {
  const preview: Record<string, unknown> = {};
  const raw = record as unknown as Record<string, unknown>;
  const keyOrder = [
    "video_id", "title", "duration_seconds", "views",
    "completion_rate", "engagement_rate", "record_status",
    "category", "product_name", "likes", "comments", "favorites", "shares",
    "product_clicks", "orders", "five_sec_retention", "avg_watch_time_seconds",
    "hook_text", "notes",
  ];
  for (const key of keyOrder) {
    if (key in raw) {
      const val = raw[key];
      // 百分比字段格式化为易读形式
      if (
        ["completion_rate", "engagement_rate", "five_sec_retention",
         "product_click_rate", "conversion_rate"].includes(key) &&
        typeof val === "number"
      ) {
        preview[key] = `${(val * 100).toFixed(1)}%`;
      } else {
        preview[key] = val;
      }
    }
  }
  return preview;
}
