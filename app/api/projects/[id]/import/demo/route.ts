import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { parseFile } from "@/lib/parsers";
import { validateAllRows } from "@/lib/validators";
import { setRecords, setValidationResult, getProject } from "@/lib/store";
import type { ImportResponse } from "@/lib/schemas";
import type { VideoRecord } from "@/types";

const DEMO_FILE_PATH = join(
  process.cwd(),
  "docs",
  "CreatorLens_Day1_Data_Pack .xlsx"
);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = getProject(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "项目不存在" },
        { status: 404 }
      );
    }

    // 读取官方演示文件
    let buffer: Buffer;
    try {
      buffer = readFileSync(DEMO_FILE_PATH);
    } catch {
      return NextResponse.json(
        { success: false, error: "演示数据文件未找到，请检查 docs 目录" },
        { status: 500 }
      );
    }

    const fileName = "CreatorLens_Day1_演示数据.xlsx";

    // 解析
    const parseResult = parseFile(buffer, fileName, buffer.length);
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
      fileName,
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

    const response: ImportResponse = {
      success: true,
      file: {
        name: fileName,
        size: buffer.length,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
    console.error("Demo import error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "演示数据加载失败，请稍后重试",
        canAnalyze: false,
      },
      { status: 500 }
    );
  }
}

function recordToPreview(record: VideoRecord): Record<string, unknown> {
  const raw = record as unknown as Record<string, unknown>;
  const preview: Record<string, unknown> = {};
  const keyOrder = [
    "video_id", "title", "duration_seconds", "views",
    "completion_rate", "engagement_rate", "record_status",
    "category", "product_name",
  ];
  for (const key of keyOrder) {
    if (key in raw) {
      const val = raw[key];
      if (
        ["completion_rate", "engagement_rate"].includes(key) &&
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
