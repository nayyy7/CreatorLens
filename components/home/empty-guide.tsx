"use client";

import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export function EmptyGuide() {
  const router = useRouter();
  const [loadingDemo, setLoadingDemo] = useState(false);

  async function handleLoadDemo() {
    setLoadingDemo(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "盈Go 便携榨汁杯 · 7 月素材复盘",
          category: "小家电/便携榨汁杯",
          priceBand: "50-99元",
          accountName: "上班族",
          analysisGoal: "找出高完播率视频的内容特征，优化下一轮拍摄方向",
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/projects/${data.project.id}/import`);
      }
    } catch {
      setLoadingDemo(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 rounded-full bg-muted p-4">
        <FileSpreadsheet className="size-10 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">
        欢迎使用 CreatorLens
      </h2>
      <p className="text-muted-foreground max-w-md mb-8">
        上传抖音商品短视频的历史表现数据，获取有数据证据的内容策略洞察、
        A/B 测试方案和下一轮创作 Brief。
      </p>
      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-lg">
        <Card className="text-left">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4 text-primary" />
              上传数据
            </CardTitle>
            <CardDescription>
              上传 CSV 或 Excel 文件，开始分析你的账号内容表现
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/projects/new">
              <Button size="sm" className="w-full">
                新建分析项目 <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="text-left">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-accent-foreground" />
              体验演示
            </CardTitle>
            <CardDescription>
              使用 20 条合成演示数据，无需上传即可体验完整分析流程
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleLoadDemo}
              disabled={loadingDemo}
            >
              {loadingDemo ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  加载中...
                </>
              ) : (
                <>
                  载入演示数据 <ArrowRight className="size-3.5 ml-1" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
