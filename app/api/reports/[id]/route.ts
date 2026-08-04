import { NextRequest, NextResponse } from "next/server";
import { getReport, getProject } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const report = getReport(id);
    if (!report) {
      return NextResponse.json(
        { success: false, error: "报告不存在或已过期，请重新分析" },
        { status: 404 }
      );
    }

    const project = getProject(id);

    return NextResponse.json({
      success: true,
      report,
      project: project
        ? {
            name: project.name,
            category: project.category,
            targetAudience: project.targetAudience,
            analysisGoal: project.analysisGoal,
          }
        : null,
    });
  } catch (err) {
    console.error("Report fetch error:", err);
    return NextResponse.json(
      { success: false, error: "获取报告失败" },
      { status: 500 }
    );
  }
}
