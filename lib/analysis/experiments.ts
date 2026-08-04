// CreatorLens A/B 实验建议生成
// 基于规则洞察，生成单变量测试方案

import type { RuleInsight } from "./insights";

export interface RuleExperiment {
  id: string;
  insightId: string;
  hypothesis: string;
  testVariable: string;
  controlVariables: string[];
  versionA: { hook: string; structure: string };
  versionB: { hook: string; structure: string };
  primaryMetric: string;
  secondaryMetrics: string[];
  minSamples: number;
  decisionRule: string;
  note: string;
}

/**
 * 基于洞察生成 A/B 实验建议（最多 2 组）
 */
export function generateExperiments(insights: RuleInsight[]): RuleExperiment[] {
  if (insights.length === 0) return [];

  const experiments: RuleExperiment[] = [];
  const templates = getExperimentTemplates();

  for (let i = 0; i < Math.min(insights.length, 2); i++) {
    const insight = insights[i];
    const template = templates.find((t) => insight.id.includes(t.matchKey));
    const exp = template
      ? template.build(insight, i)
      : genericExperiment(insight, i);
    experiments.push(exp);
  }

  return experiments;
}

function needNote(n: number): string {
  if (n <= 2) {
    return `建议实验，尚未执行。每版 ${n} 条属于探索性测试，不足以形成结论，仅供参考方向。不代表统计显著。`;
  }
  if (n <= 4) {
    return `建议实验，尚未执行。每版 ${n} 条仅可观察方向性差异，需更多样本才能形成初步结论。不代表统计显著。`;
  }
  return `建议实验，尚未执行。每版 ${n} 条可形成初步方向判断，建议持续积累以验证显著性。不代表统计显著。`;
}

interface ExperimentTemplate {
  matchKey: string;
  build: (insight: RuleInsight, index: number) => RuleExperiment;
}

function getExperimentTemplates(): ExperimentTemplate[] {
  return [
    {
      matchKey: "duration",
      build: (insight, i) => {
        const minSamples = 3;
        return {
          id: `exp_${Date.now()}_${i}`,
          insightId: insight.id,
          hypothesis: `采用"${insight.groupA.label}"时长区间的视频完播率高于"${insight.groupB.label}"区间`,
          testVariable: "视频时长",
          controlVariables: [
            "商品与卖点不变",
            "开场 Hook 类型不变",
            "发布时间段相近（同一天 ±2 小时）",
          ],
          versionA: {
            hook: "保持现有最佳 Hook",
            structure: `控制时长在 ${insight.groupA.label} 范围内，保持现有内容结构`,
          },
          versionB: {
            hook: "保持现有最佳 Hook",
            structure: `相同内容，延长或缩短至 ${insight.groupB.label} 作为对照`,
          },
          primaryMetric: "完播率",
          secondaryMetrics: ["5 秒留存率", "播放量"],
          minSamples,
          decisionRule:
            `A 版完播率中位数高于 B 版 ≥5%（相对提升）且方向在 ${minSamples} 条中一致时，可初步确认时长优化方向。累计每版 ≥5 条后可形成初步结论。`,
          note: needNote(minSamples),
        };
      },
    },
    {
      matchKey: "audience",
      build: (insight, i) => {
        const minSamples = 3;
        return {
          id: `exp_${Date.now()}_${i}`,
          insightId: insight.id,
          hypothesis: `视频面向"${insight.groupA.label}"人群设计后，播放和互动表现优于泛人群内容`,
          testVariable: "目标人群定位",
          controlVariables: [
            "商品与卖点不变",
            "视频时长不变",
            "发布时间段相近",
          ],
          versionA: {
            hook: `针对"${insight.groupA.label}"人群设计开场 Hook 和使用场景`,
            structure: "人群场景（3s）→ 卖点展示（5-8s）→ 效果证明（5-8s）→ CTA（3s）",
          },
          versionB: {
            hook: "通用开场，不限定特定人群",
            structure: "通用开场（3s）→ 卖点展示（5-8s）→ 效果证明（5-8s）→ CTA（3s）",
          },
          primaryMetric: "播放量",
          secondaryMetrics: ["互动率", "商品点击率"],
          minSamples,
          decisionRule:
            `A 版播放量中位数高于 B 版 ≥10%（相对提升）且方向在 ${minSamples} 条中一致时，可初步确认人群定位方向。`,
          note: needNote(minSamples),
        };
      },
    },
    {
      matchKey: "completion",
      build: (insight, i) => {
        const minSamples = 3;
        return {
          id: `exp_${Date.now()}_${i}`,
          insightId: insight.id,
          hypothesis: "优化前 3 秒开场方式可提升完播率",
          testVariable: "前 3 秒开场方式",
          controlVariables: [
            "商品与卖点不变",
            "视频时长不变",
            "发布时间段相近",
          ],
          versionA: {
            hook: "效果前置：直接展示成品效果或核心利益点",
            structure: "效果展示（3s）→ 卖点说明（5-7s）→ 使用场景（5-7s）→ CTA（3s）",
          },
          versionB: {
            hook: "痛点前置：先描述用户问题再给出解决方案",
            structure: "痛点描述（3s）→ 产品解决（5-7s）→ 效果证明（5-7s）→ CTA（3s）",
          },
          primaryMetric: "完播率",
          secondaryMetrics: ["5 秒留存率", "播放量"],
          minSamples,
          decisionRule:
            `A 版完播率中位数高于 B 版 ≥5%（相对提升）且 5 秒留存方向一致时，可初步确认开场方向。`,
          note: needNote(minSamples),
        };
      },
    },
    {
      matchKey: "price",
      build: (insight, i) => {
        const minSamples = 3;
        return {
          id: `exp_${Date.now()}_${i}`,
          insightId: insight.id,
          hypothesis: `突出"${insight.groupA.label}"价格带的核心卖点可提升商品点击率`,
          testVariable: "卖点表达中的价格定位",
          controlVariables: [
            "商品不变",
            "视频时长不变",
            "发布时间段相近",
          ],
          versionA: {
            hook: `突出 ${insight.groupA.label} 价格带的核心价值主张`,
            structure: "开场（3s）→ 核心卖点（5-7s）→ 价格/优惠（3s）→ 使用场景（5-7s）→ CTA（3s）",
          },
          versionB: {
            hook: "通用卖点，不强调价格信息",
            structure: "开场（3s）→ 通用卖点（5-7s）→ 使用场景（5-7s）→ CTA（3s）",
          },
          primaryMetric: "商品点击率",
          secondaryMetrics: ["转化率", "播放量"],
          minSamples,
          decisionRule:
            `A 版商品点击率高于 B 版 ≥5%（相对提升）且方向一致时，可初步确认价格卖点方向。`,
          note: needNote(minSamples),
        };
      },
    },
  ];
}

function genericExperiment(insight: RuleInsight, index: number): RuleExperiment {
  const minSamples = 3;
  return {
    id: `exp_${Date.now()}_${index}`,
    insightId: insight.id,
    hypothesis: `基于洞察"${insight.title}"进行单变量测试`,
    testVariable: "待根据洞察具体确定",
    controlVariables: ["商品与卖点不变", "发布时间段相近"],
    versionA: { hook: "方案 A：按洞察建议方向调整", structure: "保持现有主体结构" },
    versionB: { hook: "方案 B：保持现有做法", structure: "保持现有主体结构" },
    primaryMetric: "播放量",
    secondaryMetrics: ["互动率"],
    minSamples,
    decisionRule: `两版各至少 ${minSamples} 条，观察方向性差异。每版 ≥5 条后形成初步结论。`,
    note: needNote(minSamples),
  };
}
