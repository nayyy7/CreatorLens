import { NextRequest, NextResponse } from "next/server";
import { createProjectSchema } from "@/lib/schemas";
import { setProject, getAllProjects } from "@/lib/store";
import type { Project } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "请求参数校验失败",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: parsed.data.name,
      category: parsed.data.category,
      productName: parsed.data.accountName || undefined,
      targetAudience: parsed.data.priceBand || undefined,
      analysisGoal: parsed.data.analysisGoal || undefined,
      status: "draft",
      videoCount: 0,
      validVideoCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    setProject(project);

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "服务器内部错误，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const projects = getAllProjects();
    return NextResponse.json({ success: true, projects });
  } catch {
    return NextResponse.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
