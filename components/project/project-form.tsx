"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

const projectFormSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100, "项目名称最多 100 字"),
  category: z.string().min(1, "商品品类不能为空").max(50, "商品品类最多 50 字"),
  accountName: z.string().max(50, "账号名称最多 50 字").optional(),
  analysisGoal: z.string().max(200, "分析目标最多 200 字").optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const defaultValues: ProjectFormValues = {
  name: "",
  category: "",
  accountName: "",
  analysisGoal: "",
};

export function ProjectForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  async function onSubmit(values: ProjectFormValues) {
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          category: values.category,
          accountName: values.accountName || undefined,
          analysisGoal: values.analysisGoal || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/projects/${data.project.id}/import`);
      }
      // 校验失败时不导航，让用户看到错误
    } catch {
      // 网络错误时不导航
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* 返回链接 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        返回工作台
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">新建分析项目</CardTitle>
          <CardDescription>
            填写项目信息，然后上传抖音商品短视频的历史表现数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 项目名称 */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      项目名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：盈Go 榨汁杯 · 7 月素材复盘"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 商品品类 */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      商品品类 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：小家电/便携榨汁杯"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      同一项目应包含同品类或相近商品的视频
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 价格带 */}
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>抖音账号名称</FormLabel>
                    <FormControl>
                      <Input placeholder="选填，用于报告标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 分析目标 */}
              <FormField
                control={form.control}
                name="analysisGoal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分析目标</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="选填，例如：找出高完播率视频的内容特征，优化下一轮拍摄方向"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 按钮组 */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Link href="/">
                  <Button variant="outline" type="button">
                    取消
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      创建项目并继续
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
