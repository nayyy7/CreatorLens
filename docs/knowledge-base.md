# CreatorLens 策略知识库

> Phase 5 · 本地策略卡片，为 LLM 洞察和报告提供行业方法论参考

## 概述

策略知识库包含 43 条适用于抖音电商短视频的策略卡片，覆盖 8 个策略维度。所有卡片均基于真实可访问的平台官方资料和公开行业报告。

## 策略卡片结构

每条卡片包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识，格式 `SC-XXX` |
| `title` | string | 策略标题 |
| `strategy` | string | 策略详细描述（200-500 字） |
| `applicable_categories` | string[] | 适用品类 |
| `price_bands` | string[] | 适用价格带 |
| `target_audiences` | string[] | 适用目标人群 |
| `content_formats` | string[] | 适用内容形式（Hook 类型、结构等） |
| `problem_tags` | string[] | 可解决的弱项标签 |
| `limitations` | string | 策略适用限制 |
| `source_title` | string | 来源标题 |
| `source_url` | string | 可访问的 URL |
| `source_type` | string | 来源类型 |
| `accessed_at` | string | 访问日期 |

## 策略维度覆盖

| 维度 | 卡片数 | 范围 |
|------|--------|------|
| 开场 Hook | 6 | 效果前置、痛点前置、人群点名、悬念提问、价格利益、参数技术 |
| 商品卖点表达 | 6 | 场景化、对比验证、痛点方案、专家背书、三秒法则、情感化 |
| 内容结构 | 6 | 黄金四段式、5 秒钩子法则、3-5-5-3 节奏、信息密度递进、闭环结尾、字幕重点 |
| 时长与节奏 | 5 | 15-20 秒黄金时长、3 秒一切换、≤10 秒快节奏、21-30 秒深度、快慢交替 |
| 商品展示 | 5 | 第一视角、特写细节、多场景、对比展示、开箱试用 |
| 信任建立 | 5 | 零风险承诺、用户证言、检测报告、工艺透明、售后保障 |
| 行动引导 CTA | 5 | 明确行动指令、限时限量、互动引导、看后搜引导、购物车动画 |
| 点击与转化优化 | 5 | 价格锚点、高信息密度标题、黄金 30 分钟互动、标签优化、内容-货架联动 |

## 来源说明

所有策略卡片来源分为两类：

### 平台官方（platform_official）
- 抖音电商学习中心（school.jinritemai.com）— 官方课程和文档
- 巨量引擎（oceanengine.com）— 字节跳动官方营销平台
- 抖音创作者平台（creator.douyin.com）— 官方创作者工具和指南

### 行业报告（industry_report）
- 巨量引擎·趋势洞察（trendinsight.oceanengine.com）— 官方数据报告

### 来源验证

所有来源 URL 均为真实可访问的域名。具体课程/文章路径基于 2026 年 8 月公开可访问的页面。

## 使用方式

策略卡片在分析流程中通过 `retrieveCards()` 检索。检索输入包括品类、价格带、目标人群、时长区间和 Phase 4 发现的弱项。检索算法基于标签匹配 + 关键词相关性评分，最多返回 Top 3。

## 维护

- 新增卡片：在 `lib/knowledge/knowledge-base.ts` 中追加 `STRATEGY_CARDS` 数组
- 更新来源：修改对应卡片的 `source_url` 和 `accessed_at` 字段
- 删除卡片：从数组中移除，确保无其他模块引用该 ID
