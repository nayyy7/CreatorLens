# CreatorLens

## 项目定位
抖音电商短视频 AI 复盘与创作优化工具。面向中小商家和电商内容运营人员，
通过上传历史视频数据（CSV/XLSX），分析内容特征与表现指标的关系，
输出数据证据化的洞察、A/B 测试方案和创作 Brief。

产品核心闭环：
上传历史视频数据 → AI 提取内容特征 → 统计表现差异 → 检索策略知识 → 生成证据化洞察 → 设计 A/B 实验 → 输出创作 Brief

## 技术栈
- **框架**: Next.js（版本以项目 `package.json` 中可正常构建的稳定版本为准，不得为匹配文档擅自升级或降级）+ TypeScript（严格模式，禁止 `any`）
- **样式**: Tailwind CSS + shadcn/ui
- **校验**: Zod（数据 Schema 与表单校验统一）
- **文件解析**: SheetJS/xlsx（Excel）+ Papa Parse（CSV），均在服务端 Route Handler 处理；仅支持 `.xlsx`、`.xls`、`.csv`，文件大小不超过 10 MB
- **图表**: Recharts
- **存储**: Day 2 使用服务端内存 Map（开发环境使用 `globalThis` 单例降低热更新丢失，服务重启后清空）；后续迁移 Supabase
- **部署**: Day 2 不部署；后续 Vercel + Supabase

## 当前阶段：Day 2（页面骨架与数据导入）
**必须实现**：
1. 项目脚手架和统一视觉风格
2. 首页/工作台（项目列表 + 空状态引导 + 示例数据入口）
3. 创建分析任务页面（项目信息表单）
4. Excel/CSV 拖拽上传
5. 一键载入演示数据（20 条合成便携榨汁杯数据）
6. 服务端文件解析 + Zod 校验
7. 校验结果展示（文件信息、有效记录数、错误/警告提示）
8. 数据预览表格（前 20 行）
9. 点击"开始分析"后进入报告页
10. 报告页使用 Mock 数据展示：账号概览、核心洞察、A/B 测试、创作 Brief、知识库引用
11. 所有页面覆盖空状态、加载态、成功态、错误态

**明确不做**：
- AI 标签提取（Day 3）
- 统计与概览真实计算（Day 4）
- RAG 知识检索（Day 5）
- 真实 LLM 调用、Supabase、登录、支付、线上部署
- 字段映射独立步骤页、内容标签确认页

## 路由设计
```
/                          → 首页/工作台
/projects/new              → 创建分析项目
/projects/[id]/import      → 上传 + 校验 + 数据预览
/reports/[id]              → 分析报告
```

## API 设计
```
POST   /api/projects                    创建项目
GET    /api/projects                     项目列表
GET    /api/projects/[id]                项目详情
POST   /api/projects/[id]/import         上传解析文件
GET    /api/projects/[id]/records        获取解析记录（分页）
POST   /api/projects/[id]/analyze        触发分析（Day 2 Mock）
GET    /api/reports/[id]                 获取报告（Day 2 Mock）
```

## 编码原则
1. **证据先于结论** — 每条洞察先展示指标差异、样本量与代表视频，再给建议；相关不等于因果
2. **代码负责计算，AI 负责表达** — 数值由代码计算，LLM 只做解释和生成
3. 所有 AI 标签必须附带证据片段和置信度
4. 页面必须覆盖空状态、加载态、成功态、错误态四种状态
5. 组件遵循 shadcn/ui 模式，使用 `cn()` 合并 className
6. TypeScript 严格模式，禁止 `any`
7. PRD 第 9.3 节最小样本规则：任一组 n < 3 不生成结论；n = 3-4 可信度低；n = 5-7 中；n ≥ 8 高且标注"相关性发现"

## 文件解析规则
### Excel 文件（.xlsx / .xls）
- CreatorLens 官方 Excel 可能包含多个工作表，优先读取名为"演示数据"或"输入模板"的工作表
- **不要默认第一行是表头**：自动扫描同时包含 `video_id`、`category`、`views` 的行作为表头行
- 跳过表头行之前的标题行、说明行和完全空白行
- 服务端必须重新计算所有系统派生字段（`engagement_rate`、`product_click_rate`、`conversion_rate`、`duration_band`、`data_quality_score`、`record_status`），不直接信任 Excel 中已有的公式或缓存值

### CSV 文件（.csv）
- 默认第一行为表头
- 跳过完全空白行
- 同样在服务端重新计算所有系统派生字段

### 通用限制
- 仅支持 `.xlsx`、`.xls`、`.csv` 三种格式
- 文件大小上限 10 MB，超限时返回明确错误提示

## 关键数据规则
### 百分比归一化（4 步规则）
1. 值在 0—1 之间（含边界）：直接保留
2. 值 > 1 且 ≤ 100：除以 100
3. 值 < 0 或 > 100：报错，标记该行该字段
4. 归一化后再次校验 0—1 范围，不合格的标记为错误

### 校验与门槛
- **逐行容错**：某一行错误不能导致整个文件解析失败；统一返回总行数、有效行数、错误行数、警告行数和行级问题列表
- video_id 去重：重复时保留最后一条，提示用户；按去重后的数量判断门槛
- 有效记录不足 **10 条**或超过 **30 条**：阻止分析（错误级）。去重后重新判定数量
- 播放量 ≤ 0：该行不可参与分析（错误级）
- 完播率/点击率 不在 0-1 范围：错误级（在百分比归一化之后校验）
- 脚本/字幕/标题全为空：警告级，无法提取内容标签
- 播放量仅作背景参考，不单独决定洞察优先级
- 缺失率 > 30% 或标签低置信度比例高：整体可信度下调一级

### 安全约束
- `source_url` 仅用于前端展示和用户回看原始视频，后端禁止主动访问或抓取该 URL

## 开发流程
每个阶段完成后必须依次运行以下命令，全部通过后方可暂停等待确认：
```bash
npm run lint      # ESLint 零报错
npm run build     # 构建成功，无报错
npm test          # 有测试时运行，全部通过
```
禁止在 lint 或 build 报错的情况下进入下一阶段。

## 标签字典（V1 固定枚举）
| 维度 | 枚举值 |
|------|--------|
| Hook 类型 | 效果前置、痛点前置、价格利益、悬念提问、人群点名、参数介绍、故事场景、其他、未知 |
| 内容结构节点 | 效果展示、痛点描述、人群/场景、产品介绍、卖点证明、价格优惠、社会证明、行动引导 |
| CTA 类型 | 购买引导、优惠引导、评论互动、关注引导、私信引导、无 CTA、其他 |
| 人物/画面 | 人物出镜、使用场景、产品特写、前后对比、字幕重点、未知 |
| 时长区间 | ≤10秒、11-20秒、21-30秒、>30秒 |

## 目录约定
```
creatorlens/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root Layout
│   ├── page.tsx                # 首页
│   ├── globals.css             # 全局样式 + CSS 变量
│   ├── projects/
│   │   ├── new/page.tsx        # 新建项目
│   │   └── [id]/
│   │       ├── upload/page.tsx # 上传 + 校验 + 预览
│   │       └── report/page.tsx # 报告页
│   └── api/projects/           # Route Handlers
├── components/
│   ├── ui/                     # shadcn/ui 组件
│   ├── layout/                 # Header、Sidebar 等布局组件
│   ├── home/                   # 首页组件
│   ├── project/                # 项目表单组件
│   ├── upload/                 # 上传、映射、校验、预览组件
│   └── report/                 # 报告各模块组件
├── lib/                        # 纯函数工具
│   ├── schemas.ts              # Zod Schema
│   ├── validators.ts           # 校验逻辑
│   ├── field-mapping.ts        # 字段自动映射
│   ├── parsers.ts              # CSV/XLSX 解析
│   ├── derived-fields.ts       # 系统派生字段计算
│   ├── store.ts                # 内存存储
│   ├── mock-data.ts            # Mock 演示数据
│   ├── mock-report.ts          # Mock 报告
│   ├── utils.ts                # 通用工具
│   └── constants.ts            # 常量、枚举
├── types/index.ts              # TypeScript 类型定义
└── public/                     # 静态资源
```

## 产品文案规则
产品对外文案不得提及 VFlow 或其他内部项目名称；涉及下游生成能力时，统一使用"视频生成模型""视频生成工具"等中性表述。

## 视觉规范
- 浅色背景 + 深蓝色主色（#1E3A5F 系）+ 紫色强调色（#7C3AED 系）
- 圆角卡片（--radius: 0.5rem），清晰的数据层级
- 专业可信但不沉重，适合非技术用户理解和面试演示
- 图表使用 Recharts，配色与主色系一致

## 演示数据声明
20 条合成数据（便携榨汁杯品类），仅用于产品测试与演示。所有文本、播放量及转化数据均为人工构造。
表述为"构建演示测试集"，不得表述为真实用户数据或行业结论。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
