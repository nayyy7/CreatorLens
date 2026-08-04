"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function Dropzone({ onFileSelect, disabled = false }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [disabled, onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
      // 重置 input 以支持重复选择同一文件
      e.target.value = "";
    },
    [disabled, onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-muted p-3">
          {isDragging ? (
            <FileSpreadsheet className="size-8 text-primary" />
          ) : (
            <Upload className="size-8 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-medium">
            {isDragging ? "释放文件以上传" : "拖拽文件到此处"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            或点击下方按钮选择文件
          </p>
        </div>
        <label>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleChange}
            disabled={disabled}
            className="sr-only"
          />
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            <Upload className="size-3.5" />
            选择文件
          </span>
        </label>
      </div>
    </div>
  );
}

// 格式与大小提示
export function UploadHint() {
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <AlertCircle className="size-4 mt-0.5 shrink-0" />
      <div>
        <p>支持 .xlsx、.xls、.csv 格式，文件大小不超过 10 MB</p>
        <p className="mt-0.5">
          必须包含 video_id、category、views 列；至少 10 条有效记录
        </p>
      </div>
    </div>
  );
}
