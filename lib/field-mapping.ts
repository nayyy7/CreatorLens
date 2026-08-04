// CreatorLens 字段映射
// 将 Excel/CSV 中的中英文混合表头统一映射到标准英文字段名

// 标准字段名 → 可能的中文/英文别名
const FIELD_ALIASES: Record<string, string[]> = {
  video_id: ["video_id", "视频id", "视频ID", "video id"],
  publish_date: ["publish_date", "发布日期", "发布时间", "发布日期 ", "date"],
  product_name: ["product_name", "商品名称", "产品名称", "商品名"],
  category: ["category", "品类", "商品品类", "类目", "商品类目"],
  price_band: ["price_band", "价格带", "价格区间", "价格段"],
  target_audience: ["target_audience", "目标人群", "目标用户", "受众"],
  title: ["title", "标题", "视频标题"],
  script_or_subtitle: ["script_or_subtitle", "脚本/字幕", "字幕", "脚本", "口播文案"],
  hook_text: ["hook_text", "hook文案", "hook文本", "Hook 文案", "hook_text(前3-5秒文案)"],
  duration_seconds: ["duration_seconds", "时长(秒)", "时长", "视频时长", "duration"],
  person_on_camera: ["person_on_camera", "人物出镜"],
  scene_demo: ["scene_demo", "使用场景"],
  product_closeup: ["product_closeup", "产品特写"],
  before_after: ["before_after", "前后对比"],
  views: ["views", "播放量", "播放数"],
  likes: ["likes", "点赞数", "点赞", "点赞量"],
  comments: ["comments", "评论数", "评论", "评论量"],
  favorites: ["favorites", "收藏数", "收藏", "收藏量"],
  shares: ["shares", "分享数", "分享", "分享量"],
  completion_rate: ["completion_rate", "完播率"],
  avg_watch_time_seconds: ["avg_watch_time_seconds", "平均播放时长(秒)", "平均观看时长"],
  five_sec_retention: ["five_sec_retention", "5秒留存", "5秒留存率"],
  product_clicks: ["product_clicks", "商品点击", "商品点击数", "商品点击次数"],
  orders: ["orders", "成交数", "订单数", "成交订单数"],
  notes: ["notes", "备注", "注释"],
  source_url: ["source_url", "视频链接", "来源链接", "source url"],
  engagement_rate: ["engagement_rate", "互动率"],
  product_click_rate: ["product_click_rate", "商品点击率"],
  conversion_rate: ["conversion_rate", "转化率"],
  duration_band: ["duration_band", "时长区间"],
  data_quality_score: ["data_quality_score", "数据质量分"],
  record_status: ["record_status", "记录状态"],
};

// 构建反向索引：别名 → 标准字段名
const aliasToField: Map<string, string> = new Map();

for (const [standardField, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) {
    aliasToField.set(alias.toLowerCase().trim(), standardField);
  }
}

/**
 * 将表头字段名映射到标准英文字段名
 * 处理空格、中英文混合、带星号标记等情况
 */
export function mapFieldName(raw: string): string | null {
  // 清理：去空格、去 * 标记、去 [系统] 标记
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\*$/, "");          // 去掉末尾 *
  cleaned = cleaned.replace(/\[系统\]/g, "");     // 去掉 [系统] 标记
  cleaned = cleaned.replace(/\[.*?\]/g, "");      // 去掉 [xxx] 标记
  cleaned = cleaned.trim();

  const key = cleaned.toLowerCase();

  // 先精确匹配
  if (aliasToField.has(key)) return aliasToField.get(key)!;

  // 模糊匹配：逐个别名比较
  for (const [aliasKey, field] of aliasToField.entries()) {
    if (key.includes(aliasKey) || aliasKey.includes(key)) {
      return field;
    }
  }

  // 直接匹配英文标准字段名（处理带 * 的情况）
  const standardFields = Object.keys(FIELD_ALIASES);
  for (const f of standardFields) {
    if (key === f || key.startsWith(f)) return f;
  }

  return null;
}

/**
 * 检查表头行是否包含核心字段
 */
export function hasCoreHeaders(headers: string[]): boolean {
  const mapped = headers.map(mapFieldName).filter(Boolean);
  const required = ["video_id", "category", "views"];
  return required.every((r) => mapped.includes(r));
}

/**
 * 获取核心表头缺失列表
 */
export function getMissingCoreHeaders(headers: string[]): string[] {
  const mapped = new Set(headers.map(mapFieldName).filter(Boolean));
  const required = ["video_id", "category", "views"];
  return required.filter((r) => !mapped.has(r));
}
