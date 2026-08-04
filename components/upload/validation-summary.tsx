"use client";

import { CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet } from "lucide-react";
import type { ValidationResult } from "@/types";

interface ValidationSummaryProps {
  result: ValidationResult;
}

export function ValidationSummary({ result }: ValidationSummaryProps) {
  const { fileName, totalRows, validRows, errorCount, warningCount } = result;

  return (
    <div className="space-y-4">
      {/* 文件信息 */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <div className="rounded-md bg-primary/10 p-2">
          <FileSpreadsheet className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{fileName}</p>
          <p className="text-sm text-muted-foreground">
            {totalRows} 条记录 · {validRows} 条可用
          </p>
        </div>
        {errorCount === 0 && warningCount === 0 && (
          <CheckCircle2 className="size-5 text-green-500 shrink-0" />
        )}
      </div>

      {/* 校验统计 */}
      <div className="grid grid-cols-3 gap-3">
        <StatBadge
          label="通过"
          count={validRows}
          variant="success"
        />
        <StatBadge
          label="警告"
          count={warningCount}
          variant="warning"
        />
        <StatBadge
          label="错误"
          count={errorCount}
          variant="error"
        />
      </div>
    </div>
  );
}

interface StatBadgeProps {
  label: string;
  count: number;
  variant: "success" | "warning" | "error";
}

function StatBadge({ label, count, variant }: StatBadgeProps) {
  const icons = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  };
  const colors = {
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  const Icon = icons[variant];

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${colors[variant]}`}
    >
      <Icon className="size-4" />
      <div>
        <p className="text-lg font-semibold">{count}</p>
        <p className="text-xs opacity-80">{label}</p>
      </div>
    </div>
  );
}
