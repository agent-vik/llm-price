# LLM Price 备忘录

## 1. 目的

本文档记录 `agent-vik/llm-price` 项目的完整信息，为本项目的未来维护提供便利。

**重要提示：** 每次新增或修改功能后，请务必更新此备忘录，确保文档的准确性和时效性。

## 2. 项目概览

### 2.1 基本信息
- **GitHub**: https://github.com/agent-vik/llm-price
- **在线地址**: https://llm-price.victor42.work
- **定位**: 数据可视化项目——收集指定模型的官方 API 价格并可视化
- **核心原则**: 真相源 + 更新协议；价格由 Agent 定时自动更新

### 2.2 设计约束（与 Victor 确认）
- **价格维度**: 输入 / 输入缓存 / 输出 三项，统一规整为 **USD / 1M tokens**
- **模型列表**: 由 Victor 指定、顺序固定，Agent 不自行增删
- **价格来源**: Agent 去各官方渠道获取最新权威信息（官方文档 > 控制台定价页 > 官方博客），不用第三方聚合站
- **更新方式**: 《价格收集与更新协议》（`docs/update-protocol.md`）由定时任务自动触发 Agent 执行，更新真相源
- **汇率**: 每次采集用**当日最新 USD/CNY 汇率**换算 CNY 定价，并记录所用汇率
- **元数据**: 每条价格带来源 URL / 采集日期 / 汇率 / 选取说明；**采集日期不在可视化上展示**
- **模型身份**: 存 display name（可视化用）+ official API model ID（溯源更新用）
- **canonical 选取规则**: ① 上下文分阶梯 → 取最短档；② 有峰谷 → 取低谷价（峰谷是永久定价结构，不算促销）；③ 缓存输入价跟随主价同档同谷；④ **只记长期稳定价：判据是时效——官方永久/长期折扣采纳（取折后价），限时促销忽略（取促销前原价）**；应用规则时在 selection_note 记录依据
- **厂商名**: 字节跳动记为 **ByteDance**
- **部署**: victor42.work 子域名 `llm-price.victor42.work`（GitHub Pages 源站 + Cloudflare 橙云代理）

## 3. 数据模型

### 3.1 真相源：`data/prices.json`
可视化的唯一数据源。每个模型条目字段：
`input` / `cached_input` / `output`（USD/1M）+ `official_id` / `source_url` / `collected_at` / `fx_rate` / `selection_note`

### 3.2 模型配置：`data/models.json`
Victor 管理的模型列表（display / official_id / provider / pricing_url）。Agent 只可同步 `official_id` 与 `pricing_url` 两个字段，不可改名称与顺序。

### 3.3 更新协议：`docs/update-protocol.md`
自包含的采集与更新流程，供定时任务自动触发 Agent 执行。核心边界：**只更新价格，不增删模型**。附采集经验（官方来源索引、抓取技巧、定价页常见坑、汇率来源、执行节奏）。

## 4. 可视化前端

纯静态 HTML/CSS/JS，数据从真相源 JSON 动态渲染，无构建步骤。**所有图表内容 100% 数据驱动**：模型名、厂商、价格、坐标域刻度全部来自 JSON；改数据文件即改页面，无任何写死的价格或模型名（页面标题中的模型数量也由 JS 从数据读取并回填 `<title>`；HTML 中的 meta 数字在每次发布时与数据同步）。

页面结构自上而下：

1. **双向（蝴蝶）条形图**：模型名居中列，输入价条形向左、输出价条形向右，两侧各自对数刻度（坐标域按数据自动取整到十的幂）；缓存价不是独立条，作为实心段嵌在输入条内（同色、输入部分降低透明度）；条形旁数值标注，缓存价以括号跟在输入价后；按厂商分组显示；顶部有对数刻度警示条（防止观众按线性读图）
2. **Price Space 散点图**：双对数坐标，坐标域数据驱动自适应；每点一个模型、按厂商着色；拖尾线编码缓存折扣（尾巴从缓存价延伸到输入价，越长折扣越深，颜色语言与蝴蝶图一致）；虚线参考线 output=input；标签自动避让
3. **完整数据表**：三维价格 + 官方来源链接
4. **Methodology**：读图说明、正价规则、汇率换算口径、更新机制

移动端自适应：中轴收窄、条形数值隐藏（看表格）、散点标签隐藏。

## 5. 文件结构

```
llm-price/
├── data/
│   ├── models.json         # 模型列表（Victor 管理）
│   └── prices.json         # 真相源（价格表）
├── docs/update-protocol.md # 价格收集与更新协议（含采集经验附录）
├── assets/
│   ├── style.css           # 全站样式
│   ├── main.js             # 渲染逻辑（条形图 + 散点图 + 数据表）
│   ├── og-image.png        # 社交分享图（og:image）
│   └── gen-og.py           # OG 图生成脚本（数据从真相源读取，改数据后重跑）
├── index.html              # 页面骨架 + SEO 元数据（meta / OG / JSON-LD）
├── sitemap.xml             # SEO
├── robots.txt              # SEO
├── CNAME                   # GitHub Pages 自定义域名
├── LICENSE                 # MIT
├── notes.md                # 本文档
└── README.md               # 仓库说明
```

SEO 措施：完整 meta（description / keywords / author / robots）、Open Graph（含 og:image 分享图，`summary_large_image`）、Twitter Card、JSON-LD Dataset 结构化数据（含两份 JSON 数据的 DataDownload）、sitemap.xml + robots.txt、canonical URL。OG 图不含模型数量等易变信息。

## 6. 模型清单（17 个，顺序固定）

Gemini 3.1 Pro / Gemini 3.7 Flash / GPT 5.6 Sol / GPT 5.6 Terra / GPT 5.6 Luna / Claude 5 Fable / Claude 5 Opus / Claude 5 Sonnet / Grok 4.6 / Seed 2.1 / Qwen 3.8 Max / HY 3.0 / Deepseek V4 Pro / Deepseek V4 Flash / GLM 5.2 / Kimi K3 / Minimax M3

---

Created by [Victor42](https://victor42.work/) & [Vik](https://github.com/agent-vik/about-me)
