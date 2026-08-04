// CreatorLens 文件解析器
// 服务端 CSV / Excel 解析，支持多工作表、表头扫描、跳过描述行

import * as XLSX from "xlsx";
import Papa from "papaparse";
import { EXCEL_SHEET_PRIORITY, HEADER_KEYWORDS, MAX_FILE_SIZE } from "@/lib/constants";

export interface ParseResult {
  rows: Record<string, string>[];
  sheetName?: string;
  error?: string;
  blockingError?: string;
}

/**
 * 解析上传文件（CSV 或 Excel）
 */
export function parseFile(
  buffer: Buffer,
  fileName: string,
  fileSize: number
): ParseResult {
  // 文件大小检查
  if (fileSize > MAX_FILE_SIZE) {
    return {
      rows: [],
      error: `文件大小 ${(fileSize / 1024 / 1024).toFixed(1)} MB 超过上限 10 MB`,
      blockingError: "文件过大",
    };
  }

  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "csv") {
    return parseCsv(buffer);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(buffer);
  }

  return {
    rows: [],
    error: `不支持的文件格式 .${ext}`,
    blockingError: "文件格式不支持",
  };
}

/**
 * 解析 CSV 文件
 */
function parseCsv(buffer: Buffer): ParseResult {
  const text = new TextDecoder("utf-8").decode(buffer);
  // 处理 BOM
  const cleanText = text.replace(/^﻿/, "");

  const parseResult = Papa.parse(cleanText, {
    header: false,
    skipEmptyLines: false,
  });

  if (parseResult.errors && parseResult.errors.length > 0 && parseResult.data.length === 0) {
    return {
      rows: [],
      error: `CSV 解析失败：${parseResult.errors[0].message}`,
      blockingError: "CSV 格式错误",
    };
  }

  const allData = parseResult.data as string[][];

  // 过滤完全空白行
  const allRows = allData.filter(
    (row) => row.some((cell) => String(cell).trim() !== "")
  );

  if (allRows.length < 2) {
    return {
      rows: [],
      error: "CSV 文件为空或仅包含表头",
      blockingError: "文件内容不足",
    };
  }

  // CSV 默认第一行为表头
  const headers = allRows[0].map((h) => String(h).trim());
  const dataRows = allRows.slice(1);

  return buildResult(headers, dataRows);
}

/**
 * 解析 Excel 文件
 */
function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });

  // 选择工作表
  let sheetName: string | undefined;
  let sheet: XLSX.WorkSheet | undefined;

  // 按优先级查找
  for (const priorityName of EXCEL_SHEET_PRIORITY) {
    const found = workbook.SheetNames.find(
      (n) => n.includes(priorityName) || priorityName.includes(n)
    );
    if (found) {
      sheetName = found;
      sheet = workbook.Sheets[found];
      break;
    }
  }

  // 如果没找到优先表，扫描所有表找到含核心字段的
  if (!sheet) {
    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
      for (const line of data.slice(0, 5)) {
        const cells = line.map((c) => String(c).trim().toLowerCase());
        if (
          HEADER_KEYWORDS.every((kw) =>
            cells.some((c) => c.includes(kw))
          )
        ) {
          sheetName = name;
          sheet = ws;
          break;
        }
      }
      if (sheet) break;
    }
  }

  if (!sheet) {
    return {
      rows: [],
      error: "未找到包含核心字段（video_id、category、views）的工作表",
      blockingError: "无法识别工作表",
    };
  }

  // 转换为数组（raw: false 获取格式化字符串）
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  // 过滤完全空白行
  const nonEmptyRows = rawData.filter((row) =>
    row.some((cell) => String(cell).trim() !== "")
  );

  if (nonEmptyRows.length < 2) {
    return {
      rows: [],
      sheetName,
      error: "工作表数据不足（少于 2 行）",
      blockingError: "数据不足",
    };
  }

  // 扫描表头行：找到同时包含 video_id、category、views 的行
  let headerIndex = -1;
  for (let i = 0; i < Math.min(nonEmptyRows.length, 10); i++) {
    const row = nonEmptyRows[i].map((c) => String(c).trim().toLowerCase());
    if (
      HEADER_KEYWORDS.every((kw) =>
        row.some((c) => c.includes(kw))
      )
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      rows: [],
      sheetName,
      error: "未找到包含 video_id、category、views 的表头行",
      blockingError: "缺少核心表头",
    };
  }

  const headers = nonEmptyRows[headerIndex].map((h) => String(h).trim());
  const dataRows = nonEmptyRows.slice(headerIndex + 1).map((row) =>
    row.map((c) => String(c))
  );

  return buildResult(headers, dataRows, sheetName);
}

/**
 * 将表头和数据行组装为标准记录数组
 */
function buildResult(
  headers: string[],
  dataRows: string[][],
  sheetName?: string
): ParseResult {
  // 过滤数据中的完全空白行
  const validDataRows = dataRows.filter((row) =>
    row.some((cell) => String(cell).trim() !== "")
  );

  const rows: Record<string, string>[] = [];
  for (const dataRow of validDataRows) {
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      const value = i < dataRow.length ? String(dataRow[i]).trim() : "";
      if (key) {
        record[key] = value;
      }
    }
    rows.push(record);
  }

  return { rows, sheetName };
}
