// CreatorLens 解析与校验测试
// 覆盖 Phase 3 全部 12 个测试场景

import { describe, it, expect } from "vitest";
import { parseFile } from "@/lib/parsers";
import { validateAllRows } from "@/lib/validators";
import { mapFieldName, hasCoreHeaders } from "@/lib/field-mapping";
import {
  normalizePercentage,
  calcEngagementRate,
  calcDurationBand,
  calcDataQualityScore,
  calcRecordStatus,
  isExcelDateSerial,
  excelDateToString,
} from "@/lib/derived-fields";
import * as XLSX from "xlsx";

// ─── 辅助函数 ────────────────────────────────

function makeCsvBuffer(headers: string[], ...rows: string[][]): Buffer {
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  return Buffer.from(lines.join("\n"), "utf-8");
}

function makeExcelBuffer(rows: string[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "演示数据");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function makeMultiSheetExcel(sheets: Record<string, string[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const VALID_CSV_CONTENT = [
  "video_id,publish_date,category,views,title,duration_seconds,likes,comments,favorites,shares,completion_rate",
  "V001,2026-07-20,小家电,18200,测试视频1,15,950,84,530,160,0.43",
  "V002,2026-07-21,小家电,12600,测试视频2,18,560,42,270,85,0.33",
  "V003,2026-07-22,小家电,15800,测试视频3,16,820,75,460,140,0.36",
  "V004,2026-07-23,小家电,22100,测试视频4,14,1210,105,680,220,0.45",
  "V005,2026-07-24,小家电,9800,测试视频5,19,410,38,190,65,0.31",
  "V006,2026-07-25,小家电,19500,测试视频6,17,1070,96,590,190,0.41",
  "V007,2026-07-26,小家电,11200,测试视频7,18,470,45,230,75,0.32",
  "V008,2026-07-27,小家电,10400,测试视频8,20,450,51,210,58,0.30",
  "V009,2026-07-28,小家电,17300,测试视频9,15,900,83,510,170,0.35",
  "V010,2026-07-29,小家电,7200,测试视频10,26,230,18,80,20,0.22",
];

function makeValidCsvBuffer(): Buffer {
  return Buffer.from(VALID_CSV_CONTENT.join("\n"), "utf-8");
}

// ─── 测试开始 ──────────────────────────────────

describe("字段映射 (field-mapping)", () => {
  it("标准英文字段名直接匹配", () => {
    expect(mapFieldName("video_id")).toBe("video_id");
    expect(mapFieldName("category")).toBe("category");
    expect(mapFieldName("views")).toBe("views");
  });

  it("带 * 标记的表头正确剥离", () => {
    expect(mapFieldName("video_id*")).toBe("video_id");
    expect(mapFieldName("category*")).toBe("category");
    expect(mapFieldName("views*")).toBe("views");
  });

  it("带 [系统] 标记的表头正确剥离", () => {
    expect(mapFieldName("engagement_rate[系统]")).toBe("engagement_rate");
  });

  it("中文表头正确映射", () => {
    expect(mapFieldName("播放量")).toBe("views");
    expect(mapFieldName("标题")).toBe("title");
    expect(mapFieldName("完播率")).toBe("completion_rate");
  });

  it("core headers 检测", () => {
    expect(hasCoreHeaders(["video_id", "category", "views", "title"])).toBe(true);
    expect(hasCoreHeaders(["标题", "播放量"])).toBe(false);
    expect(hasCoreHeaders(["video_id*", "category", "播放量"])).toBe(true);
  });
});

describe("派生字段计算 (derived-fields)", () => {
  it("互动率计算正确", () => {
    const rate = calcEngagementRate(950, 84, 530, 160, 18200);
    expect(rate).toBeCloseTo(0.0947, 3);
  });

  it("分母为0时互动率返回undefined", () => {
    const rate = calcEngagementRate(100, 50, 30, 20, 0);
    expect(rate).toBeUndefined();
  });

  it("时长区间判断正确", () => {
    expect(calcDurationBand(8)).toBe("≤10秒");
    expect(calcDurationBand(15)).toBe("11-20秒");
    expect(calcDurationBand(25)).toBe("21-30秒");
    expect(calcDurationBand(35)).toBe(">30秒");
    expect(calcDurationBand(undefined)).toBe("11-20秒");
  });

  it("数据质量分计算正确", () => {
    const full = calcDataQualityScore({
      video_id: "V001", category: "小家电", views: 18200,
      title: "测试", completion_rate: 0.43,
    });
    expect(full).toBe(1);

    const partial = calcDataQualityScore({
      video_id: "V002", category: "", views: 0,
      title: "", completion_rate: undefined,
    });
    expect(partial).toBe(0.2);
  });

  it("记录状态判定正确", () => {
    expect(calcRecordStatus(1, false)).toBe("可分析");
    expect(calcRecordStatus(0.8, false)).toBe("可分析");
    expect(calcRecordStatus(0.7, false)).toBe("警告");
    expect(calcRecordStatus(0.5, true)).toBe("不可用");
  });

  it("Excel日期序列号检测", () => {
    expect(isExcelDateSerial(46193)).toBe(true);
    expect(isExcelDateSerial(100)).toBe(false);
    expect(isExcelDateSerial(99999)).toBe(false);
  });

  it("Excel日期序列号转换", () => {
    // 46193 = 2026-07-20 (approx)
    const date = excelDateToString(46193);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("百分比归一化", () => {
  it("0—1 之间直接保留", () => {
    const { value, warnings } = normalizePercentage(0.43);
    expect(value).toBe(0.43);
    expect(warnings).toHaveLength(0);
  });

  it("43 自动除以100并生成警告", () => {
    const { value, warnings } = normalizePercentage(43);
    expect(value).toBe(0.43);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("0.43 字符串正常处理", () => {
    const { value, warnings } = normalizePercentage("0.43");
    expect(value).toBe(0.43);
    expect(warnings).toHaveLength(0);
  });

  it("150 超范围报错", () => {
    const { value, warnings } = normalizePercentage(150);
    expect(value).toBeUndefined();
    expect(warnings.some((w) => w.includes("超出"))).toBe(true);
  });

  it("负数报错", () => {
    const { value, warnings } = normalizePercentage(-5);
    expect(value).toBeUndefined();
    expect(warnings.some((w) => w.includes("超出"))).toBe(true);
  });
});

describe("CSV 解析", () => {
  it("合法 CSV 解析成功", () => {
    const buffer = makeValidCsvBuffer();
    const result = parseFile(buffer, "test.csv", buffer.length);
    expect(result.error).toBeUndefined();
    expect(result.blockingError).toBeUndefined();
    expect(result.rows.length).toBe(10);
    expect(result.rows[0]["video_id"]).toBe("V001");
  });

  it("缺少核心表头", () => {
    const buffer = makeCsvBuffer(
      ["标题", "播放量", "日期"],
      ["测试", "100", "2026-01-01"]
    );
    const result = parseFile(buffer, "bad.csv", buffer.length);
    // 无核心表头但CSV仍能解析，校验阶段会报 blocking error
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it("完全空白行不计入", () => {
    const buffer = Buffer.from(
      "video_id,category,views\nV001,test,100\n   \nV002,test,200\n",
      "utf-8"
    );
    const result = parseFile(buffer, "test.csv", buffer.length);
    expect(result.rows.length).toBe(2);
  });
});

describe("Excel 解析", () => {
  it("识别演示数据工作表并找到表头", () => {
    // 模拟官方 Excel 结构：标题行 + 描述行 + 表头行 + 数据行
    const rows = [
      ["CreatorLens 演示数据 — 合成测试数据"],
      ["黄色：用户输入字段"],
      ["video_id*", "publish_date", "category*", "views*", "title", "likes"],
      ["V001", "46193", "小家电/便携榨汁杯", "18200", "测试视频", "950"],
      ["V002", "46196", "小家电/便携榨汁杯", "12600", "测试视频2", "560"],
      ["V003", "46199", "小家电/便携榨汁杯", "15800", "测试视频3", "820"],
      ["V004", "46202", "小家电/便携榨汁杯", "22100", "测试视频4", "1210"],
      ["V005", "46205", "小家电/便携榨汁杯", "7200", "测试视频5", "230"],
      ["V006", "46208", "小家电/便携榨汁杯", "9800", "测试视频6", "410"],
      ["V007", "46211", "小家电/便携榨汁杯", "19500", "测试视频7", "1070"],
      ["V008", "46214", "小家电/便携榨汁杯", "11200", "测试视频8", "470"],
      ["V009", "46217", "小家电/便携榨汁杯", "10400", "测试视频9", "450"],
      ["V010", "46220", "小家电/便携榨汁杯", "17300", "测试视频10", "900"],
    ];
    const buffer = makeExcelBuffer(rows);
    const result = parseFile(buffer, "test.xlsx", buffer.length);

    expect(result.error).toBeUndefined();
    expect(result.sheetName).toBe("演示数据");
    expect(result.rows.length).toBe(10);
    // 注：解析返回的是原始表头键名（含 * 标记），字段映射在 validation 阶段完成
    expect(result.rows[0]["video_id*"]).toBe("V001");
  });

  it("多工作表时优先选择演示数据", () => {
    const buffer = makeMultiSheetExcel({
      Sheet1: [["A", "B"], ["1", "2"]],
      演示数据: [
        ["video_id", "category", "views"],
        ["V100", "test", "5000"],
      ],
    });
    const result = parseFile(buffer, "test.xlsx", buffer.length);
    expect(result.sheetName).toBe("演示数据");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]["video_id"]).toBe("V100");
  });
});

describe("逐行校验", () => {
  it("全部合法数据校验通过", () => {
    const buffer = makeValidCsvBuffer();
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    expect(validation.summary.totalRows).toBe(10);
    expect(validation.summary.validRows).toBe(10);
    expect(validation.summary.errorCount).toBe(0);
    expect(validation.canAnalyze).toBe(true);
    expect(validation.blockingErrors).toHaveLength(0);
  });

  it("单行字段错误不影响其他行", () => {
    const buffer = makeCsvBuffer(
      ["video_id", "category", "views", "completion_rate"],
      ["V001", "小家电", "18200", "0.43"],       // 正常
      ["V002", "小家电", "0", "0.33"],            // views=0 → error
      ["V003", "小家电", "15800", "0.36"],        // 正常
    );
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    expect(validation.summary.totalRows).toBe(3);
    expect(validation.summary.validRows).toBe(2);
    expect(validation.summary.errorCount).toBeGreaterThan(0);
  });

  it("有效数据少于10条时canAnalyze=false", () => {
    const rows = [
      ["video_id", "category", "views"],
      ["V001", "test", "100"],
      ["V002", "test", "200"],
    ];
    const buffer = makeCsvBuffer(rows[0], rows[1], rows[2]);
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    expect(validation.canAnalyze).toBe(false);
    expect(validation.blockingErrors.some((e) => e.includes("不足"))).toBe(true);
  });

  it("有效数据超过30条时canAnalyze=false", () => {
    const headers = ["video_id", "category", "views"];
    const dataRows: string[][] = [];
    for (let i = 1; i <= 31; i++) {
      dataRows.push([`V${String(i).padStart(3, "0")}`, "test", String(1000 + i)]);
    }
    const buffer = makeCsvBuffer(headers, ...dataRows);
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    expect(validation.canAnalyze).toBe(false);
    expect(validation.blockingErrors.some((e) => e.includes("超过"))).toBe(true);
  });

  it("重复video_id保留最后一条并生成警告", () => {
    const buffer = makeCsvBuffer(
      ["video_id", "category", "views", "title"],
      ["V001", "test", "100", "first"],
      ["V001", "test", "200", "last"],
    );
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    expect(validation.summary.duplicateIds).toContain("V001");
    expect(validation.warnings.some((w) => w.video_id === "V001" && w.field === "video_id")).toBe(true);
    // 有效记录去重后只有1条
    expect(validation.records.length).toBe(1);
    // 保留最后一条的title
    expect(validation.records[0].title).toBe("last");
  });

  it("空值百分比不自动补0", () => {
    const buffer = makeCsvBuffer(
      ["video_id", "category", "views", "completion_rate"],
      ["V001", "test", "100", ""],
    );
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    const record = validation.validRecords[0];
    expect(record.completion_rate).toBeUndefined();
  });

  it("文件类型错误被拒", () => {
    const buffer = Buffer.from("not a file", "utf-8");
    const result = parseFile(buffer, "test.pdf", buffer.length);
    expect(result.blockingError).toBeDefined();
    expect(result.error).toContain("不支持");
  });

  it("文件超过10MB被拒", () => {
    const result = parseFile(Buffer.alloc(0), "test.csv", 11 * 1024 * 1024);
    expect(result.blockingError).toBeDefined();
    expect(result.error).toContain("超过");
  });

  it("缺少核心表头时validation报blockingError", () => {
    // 用只有中文标题的CSV
    const buffer = makeCsvBuffer(
      ["标题", "播放量", "日期"],
      ["测试视频", "100", "2026-01-01"],
    );
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    expect(validation.canAnalyze).toBe(false);
    expect(validation.blockingErrors.some((e) => e.includes("核心表头"))).toBe(true);
  });
});

describe("系统派生字段重算", () => {
  it("不信任Excel中的公式缓存值", () => {
    // 提供一个错误的 engagement_rate 缓存值，验证被重算
    const buffer = makeCsvBuffer(
      ["video_id", "category", "views", "likes", "engagement_rate"],
      ["V001", "test", "18200", "950", "999"], // 错误的缓存值
    );
    const parsed = parseFile(buffer, "test.csv", buffer.length);
    const validation = validateAllRows(parsed.rows);

    const record = validation.validRecords[0];
    // 正确值：(950)/(18200) ≈ 0.0522
    expect(record.engagement_rate).toBeCloseTo(0.0522, 3);
    // 不应该是 999
    expect(record.engagement_rate).not.toBe(999);
  });
});
