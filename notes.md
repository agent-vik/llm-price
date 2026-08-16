# LLM Price 备忘录

## 1. 目的

本文档记录 `agent-vik/llm-price` 项目的完整信息，为本项目的未来维护提供便利。

**重要提示：** 每次新增或修改功能后，请务必更新此备忘录，确保文档的准确性和时效性。

## 2. 项目概览

### 2.1 基本信息
- **GitHub**: https://github.com/agent-vik/llm-price
- **在线地址**: https://llm-price.victor42.work（部署进行中）
- **定位**: 数据可视化项目——收集指定模型的官方 API 价格并可视化
- **核心原则**: 真相源 + 手动更新协议，项目内**无自动更新机制**

### 2.2 设计约束（与 Victor 确认）
- **价格维度**: 输入 / 输入缓存 / 输出 三项，统一规整为 **USD / 1M tokens**
- **模型列表**: 由 Victor 指定、顺序固定，Agent 不自行增删
- **价格来源**: Agent 手动去各官方渠道获取最新权威信息（官方文档 > 控制台定价页 > 官方博客），不用第三方聚合站
- **更新方式**: 项目只准备《价格收集与更新协议》（`docs/update-protocol.md`）；Victor 定期通过定时任务让 Agent 手动执行协议、更新真相源
- **汇率**: 每次采集用**当日最新 USD/CNY 汇率**换算 CNY 定价，并记录所用汇率
- **元数据**: 每条价格带来源 URL / 采集日期 / 汇率 / 选取说明；**采集日期不在可视化上展示**
- **模型身份**: 存 display name（可视化用）+ official API model ID（溯源更新用）
- **canonical 选取规则**: ① 上下文分阶梯 → 取最短档；② 有峰谷 → 取低谷价；缓存输入价跟随主价同档同谷；应用规则时在 selection_note 记录依据
- **部署**: victor42.work 子域名 `llm-price.victor42.work`

## 3. 数据模型

### 3.1 真相源：`data/prices.json`
可视化的唯一数据源。每个模型条目字段：
`input` / `cached_input` / `output`（USD/1M）+ `official_id` / `source_url` / `collected_at` / `fx_rate` / `selection_note`

### 3.2 模型配置：`config/models.json`
Victor 管理的模型列表（display / official_id / provider / pricing_url）。Agent 只可同步 `official_id` 与 `pricing_url` 两个字段，不可改名称与顺序。

### 3.3 更新协议：`docs/update-protocol.md`
自包含的采集与更新流程，供定时任务触发的 Agent 手动执行。核心边界：**只更新价格，不增删模型**。

## 4. 文件结构

```
llm-price/
├── config/models.json        # 模型列表（Victor 管理）
├── data/prices.json          # 真相源（价格表）
├── docs/update-protocol.md   # 价格收集与更新协议
├── index.html + assets/      # 数据可视化前端（待建）
├── notes.md                  # 本文档
└── README.md                 # 仓库说明
```

## 5. 当前状态（2026-08-16）

- [x] 仓库创建（agent-vik/llm-price）
- [x] 基础结构：config / data / docs / README / notes
- [x] 更新协议定稿（含 canonical 选取规则、汇率、边界、采集经验附录）
- [x] **第一轮价格采集**（16 个模型，官方来源，2026-08-16，汇率 BOC 6.7605）
- [x] 部署：llm-price.victor42.work 已上线（GitHub Pages + CF 橙云，占位页验证通过 HTTP 200）
- [ ] 可视化前端（形态已定：横向分组条形图、按指定顺序、对数刻度、附数据表）

## 6. 模型清单（初始 16 个，顺序固定）

Gemini 3.1 Pro / Gemini 3.7 Flash / GPT 5.6 Sol / GPT 5.6 Terra / GPT 5.6 Luna / Claude 5 Fable / Claude 5 Opus / Claude 5 Sonnet / Grok 4.6 / Seed 2.1 / Qwen 3.8 Max / HY 3.0 / Deepseek V4 Pro / GLM 5.2 / Kimi K3 / Minimax M3

---

Created by [Victor42](https://victor42.work/) & [Agent Vik](https://github.com/agent-vik)
