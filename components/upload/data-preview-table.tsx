"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { VideoRecord } from "@/types";

interface DataPreviewTableProps {
  records: VideoRecord[];
  maxRows?: number;
}

// 预览列（精简，展示关键字段）
const PREVIEW_COLS = [
  { key: "video_id", label: "视频 ID", width: "w-20" },
  { key: "title", label: "标题", width: "min-w-40" },
  { key: "duration_seconds", label: "时长(秒)", width: "w-20" },
  { key: "views", label: "播放量", width: "w-24" },
  { key: "completion_rate", label: "完播率", width: "w-20" },
  { key: "engagement_rate", label: "互动率", width: "w-20" },
  { key: "record_status", label: "状态", width: "w-20" },
] as const;

export function DataPreviewTable({
  records,
  maxRows = 10,
}: DataPreviewTableProps) {
  const display = records.slice(0, maxRows);

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {PREVIEW_COLS.map((col) => (
                <TableHead key={col.key} className={`${col.width} whitespace-nowrap`}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.map((record) => (
              <TableRow key={record.video_id}>
                <TableCell className="font-mono text-xs">{record.video_id}</TableCell>
                <TableCell className="max-w-40 truncate">
                  {record.title ?? "-"}
                </TableCell>
                <TableCell>{record.duration_seconds ?? "-"}</TableCell>
                <TableCell>{record.views.toLocaleString()}</TableCell>
                <TableCell>
                  {record.completion_rate != null
                    ? `${(record.completion_rate * 100).toFixed(0)}%`
                    : "-"}
                </TableCell>
                <TableCell>
                  {record.engagement_rate != null
                    ? `${(record.engagement_rate * 100).toFixed(1)}%`
                    : "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={record.record_status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > maxRows && (
        <div className="border-t px-4 py-2 text-sm text-muted-foreground text-center">
          仅显示前 {maxRows} 条，共 {records.length} 条记录
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "可分析":
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
          可分析
        </Badge>
      );
    case "警告":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          警告
        </Badge>
      );
    default:
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
          不可用
        </Badge>
      );
  }
}
