# CreatorLens 实施计划

> 基于 PRD V1.0 和 Day 1 数据包，采用 7 天逐步构建的 MVP 策略。

## 总体目标

7 天内完成可交互、可演示的全栈 MVP，用户可通过上传 CSV/XLSX 数据，
获得基于数据分析的内容策略洞察、A/B 测试方案和创作 Brief。

## 技术架构

- **框架**: Next.js 16 App Router + TypeScript
- **样式**: Tailwind CSS v4 + shadcn/ui (base-ui 原语)
- **校验**: Zod + react-hook-form
- **文件解析**: SheetJS/xlsx + Papa Parse
- **图表**: Recharts
- **存储**: Day 2 内存 Map → Supabase (Day 3+)
- **AI**: OpenAI API (Day 3+)
- **RAG**: 轻量向量检索 (Day 5)

## 阶段划分

### Day 1（已完成）
- [x] PRD 定稿
- [x] 20 条合成演示数据
- [x] 标签字典与字段字典
- [x] 人工金标评测集

### Day 2（进行中）— 页面骨架与数据导入
- [ ] Phase 1: 项目脚手架与统一视觉风格
- [ ] Phase 2: 首页 / 工作台
- [ ] Phase 3: 创建分析任务页
- [ ] Phase 4: 文件上传、解析、校验与预览
- [ ] Phase 5: 报告页（Mock 数据）
- [ ] Phase 6: 页面状态覆盖与收尾

路由：
- `/` — 首页/工作台
- `/projects/new` — 创建分析项目
- `/projects/[id]/upload` — 上传 + 校验 + 预览
- `/projects/[id]/report` — 分析报告

API：
- `POST /api/projects` — 创建项目
- `GET /api/projects` — 项目列表
- `GET /api/projects/[id]` — 项目详情
- `POST /api/projects/[id]/upload` — 上传解析
- `GET /api/projects/[id]/records` — 分页预览
- `POST /api/projects/[id]/analyze` — 触发分析
- `GET /api/projects/[id]/report` — 获取报告

### Day 3 — AI 标签提取
- Prompt Engineering（Few-shot + JSON Schema）
- 结构化标签提取 API
- 标签确认页（人工修正 + 置信度展示）
- 证据片段展示

### Day 4 — 统计与概览 ✅ 已完成
- [x] 指标计算（加权整体互动率、点击率、转化率；算术平均完播率）
- [x] 播放量中位数、Top 3、Bottom 3（含商品点击/订单）
- [x] 分组对比（时长区间、品类、价格带、发布月份、目标人群；展示全部有效分组）
- [x] 规则洞察（最多 3 条，优先可操作维度，携带真实统计与代表视频）
- [x] A/B 实验建议（单变量，最小样本量 ≥3，"不代表统计显著"）
- [x] 创作 Brief（目标用户区分当前人群与建议测试人群，各段时长之和 ≤ 推荐时长）
- [x] 知识库展示为"暂未接入"状态
- [x] 指标口径说明页（docs/analysis-metrics.md）
- [x] 完整测试覆盖（69 个用例）
- [x] 洞察-实验指标一致性校验
- [x] 时长分组完整性校验（20条全部归类）

### Day 5 — RAG 与洞察 ✅ 已完成
- [x] 43 条策略卡片（8 大维度全覆盖，来源均为真实可访问 URL）
- [x] 轻量标签匹配检索（品类 + 价格带 + 人群 + 弱项标签，5 维评分，Top 3）
- [x] LLM 证据化洞察生成（OpenAI 兼容 API，结构化 Prompt，JSON Schema 输出）
- [x] 事实一致性校验（ID 存在性、数值合法性、因果断言检测、知识引用一致性）
- [x] 完整降级链路（无 API key → 规则洞察；调用失败 → 降级；校验失败 → 丢弃）
- [x] 报告页升级（AI 辅助 Badge、策略解释区、知识来源展示）
- [x] 知识库区域改造（真实策略卡片 + 匹配原因 + 可点击来源）
- [x] 分析快照存储（检索输入、命中卡片、LLM 模型、校验结果）
- [x] 100 个测试用例全部通过（69 回归 + 31 新）

### Day 6 — 实验与 Brief
- A/B 实验方案生成
- 创作 Brief 生成
- 视频生成指令模板
- 复制功能

### Day 7 — 评测与包装
- 标签准确率评测
- 事实一致性校验
- 端到端演示脚本
- 修复与优化

## 验收标准

见 PRD §18，10 条端到端验收项（AC-01 至 AC-10）。

Day 2 重点验收：
- AC-01: 上传 10-30 条 CSV/XLSX，完成字段映射
- AC-02: 识别缺失必填、重复 ID、非法比率和无内容文本

## 风险与应对

| 风险 | 应对 |
|------|------|
| 样本量过小 | 最小样本门槛 + 可信度降级 |
| LLM 标签不稳定 | Few-shot + Schema + 证据 + 人工修正 |
| 一周范围过大 | P0 优先，非关键图表和导出延后 |
| 百分比格式混淆 | 自动检测：>1 则 ÷100 |
