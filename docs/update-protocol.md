# 模型价格收集与更新协议

*本协议自包含，可被定时任务直接执行。操作对象是本项目仓库（`agent-vik/llm-price`）。*

## 0. 目的与边界

- 目的：从各模型**官方渠道**采集最新 API 定价，更新真相源 `data/prices.json`
- **硬边界：Agent 只更新 `data/prices.json` 中的价格与元数据，绝不增删 `data/models.json` 中的模型**。模型的增删、改名、排序是 Victor 的决策
- 本协议由定时任务自动触发 Agent 执行

## 1. 执行流程

对 `data/models.json` 中的**每一个模型**，依次：

1. **定位官方定价页**：优先用配置里的 `pricing_url`（上次采集时留下的）；失效或为空时，通过搜索/官网找到官方定价页。来源优先级：官方文档 > 官方控制台定价页 > 官方博客公告。**禁止**使用第三方聚合站、评测文章、记忆中的旧价格
2. **确认模型身份**：在官方页上确认 `official_id`（官方 API 实际使用的模型 ID）。找不到对应模型 → 不写入价格，在结果里报告该模型
3. **采集三个价格**：输入 / 输入缓存（cached input）/ 输出。官方没有缓存输入价的，记 `null`，不猜
4. **应用 canonical 选取规则**（见第 2 节）
5. **换算为 USD / 1M tokens**（见第 3 节）
6. **写入真相源**：更新 `data/prices.json` 对应条目（input、cached_input、output、official_id、source_url、collected_at、fx_rate、selection_note）
7. 同步：若 `official_id` 或 `pricing_url` 有变化，同步更新 `data/models.json` 中该模型的这两个字段（仅这两个字段——名称与顺序不动）

全部模型处理完后：**git commit + push**，并向 Victor 汇报：更新了哪些模型、哪些模型未找到官方价格、汇率与采集日期。

## 2. canonical 价格选取规则

一个模型若有多档价格，按以下规则取**唯一**展示值：

1. **上下文长度分阶梯定价** → 取**最短上下文档**的价格
2. **存在峰谷定价** → 取**低谷（off-peak）价格**（峰谷是永久定价结构，不是促销）
3. 缓存输入价格若也分阶梯/峰谷，**跟随主价格同一档/同一谷**（除非官方另有独立阶梯）
4. **只记长期稳定价，忽略短期促销**：判据是**时效**而非划线与否——官方明确标注**永久/长期**的折扣是稳定价，**采纳**（取折后价）；限时促销、促销期特价**忽略**（取促销前的原价）。两者都在 selection_note 说明依据（如 `Permanent 50% off, adopted` / `promo until 2026-12-31, ignored`）

**凡应用了以上任一规则**，必须在 `selection_note` 记录依据（如 `off-peak`、`<=128K tier`）。模型只有一个价格则 `selection_note` 为 `null`。

## 3. 货币换算

- 目标单位：**USD / 1M tokens**
- 官方定价为 USD：直接使用，`fx_rate` 记 `null`
- 官方定价为 CNY：**用本次采集当日的最新 USD/CNY 汇率**换算（查询权威汇率来源），`fx_rate` 记录所用汇率值
- 换算公式：`USD价 = CNY价 / fx_rate`
- 保留 2 位小数

## 4. 数据新鲜度

每条价格必须带可追溯元数据：`source_url`、`collected_at`、`fx_rate`、`selection_note`。这些字段写入数据文件，但**可视化上不展示采集日期**。

## 5. 失败处理

- 找不到官方定价页：该模型价格不写入（保留旧值或留空），在汇报中明确说明
- 官方页无法访问（反爬/墙）：尝试官方文档的备用入口；仍失败则报告，**不用非官方数据顶替**
- 价格单位存疑（如按 1K tokens 计价）：换算成 1M tokens 口径并在 selection_note 说明

## 6. 提交规范

- commit message：`data: refresh prices (YYYY-MM-DD)`
- 若本次还同步了 official_id/pricing_url：`data: refresh prices + sync model ids (YYYY-MM-DD)`

---

## 附录：采集经验（首轮 2026-08-16 积累，每次采集前读一遍）

*目的：让下一次采集更快、更准。只记能少走弯路的信息。*

### A. 官方来源索引（直接访问，不再反复搜索）

| 厂商 | 定价页 URL | 备注 |
|------|-----------|------|
| Google Gemini | https://ai.google.dev/gemini-api/docs/pricing | JS 渲染页面，普通 HTTP 请求只能拿到导航骨架，需要浏览器环境提取表格数据 |
| OpenAI | https://platform.openai.com/docs/pricing | 主站有反爬拦截；备用 https://developers.openai.com/api/docs/pricing 可直接获取完整价格表 |
| Anthropic | https://docs.anthropic.com/en/docs/about-claude/pricing | 有地区封锁（重定向到 claude.com）；可通过官方博客 + 搜索交叉验证获取价格 |
| xAI | https://docs.x.ai/developers/models/grok-4.6 | 搜索摘要即有价格信息，打开页面验证 |
| MiniMax | https://platform.minimax.io/docs/guides/pricing-paygo | 服务端渲染，直接可读 |
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing | 服务端渲染，直接可读 |
| 字节/豆包 Seed | https://www.volcengine.com/docs/82379/1544106 | 服务端渲染，直接可读（火山方舟模型价格） |
| 阿里 Qwen | https://help.aliyun.com/zh/model-studio/model-pricing | 服务端渲染，直接可读（国际站 alibabacloud.com 返空，用国内站） |
| 智谱 GLM | https://bigmodel.cn/pricing | JS 渲染页面，需要浏览器环境 |
| Moonshot Kimi | https://platform.moonshot.cn/docs/pricing/chat-k3 | Mintlify 文档，URL 加 `.md` 后缀可直接返回 markdown 原文（见 B-2） |
| 腾讯 HY/混元 | https://cloud.tencent.com/document/product/1823/130055（TokenHub 价格） | JS 渲染页面，需要浏览器环境；注意旧文档 product/1729/97731 已过期 |

### B. 采集策略（按优先级试）

1. **直接请求**：优先尝试直接获取页面内容（HTTP 请求等），服务端渲染的页面可以直接拿到定价数据，成本最低
2. **Mintlify 文档的 `.md` 后缀**：`<页面 URL>.md` 直接返回 markdown 原文，连定价表都在（含 JSX 组件里的数据行）——Kimi 平台文档靠这个解决
3. **浏览器渲染**：JS 重度页面（Gemini、智谱、腾讯等）需要浏览器环境才能获取完整内容。打开页面后提取表格/文本，用完即关。每次只开一个页面
4. **官方备用入口**：同一厂商可能有多个定价页。OpenAI 主站有反爬拦截时，`developers.openai.com/api/docs/pricing` 可直接访问且包含完整价格表
5. **搜索辅助**：搜索结果里的 snippet 价格只能用来定位页面，写进真相源的必须是自己打开官方页看到的数字。若官方页完全无法访问，官方博客/新闻稿中的定价公告可作为降级来源，但须在 selection_note 注明

### C. 定价页常见的坑（看到这些结构别慌）

- **划线价 vs 生效价**：先判时效再决定取哪个。MiniMax 标注 ~~$0.60~~ $0.30 且写明 **Permanent 50% off**——永久折扣是稳定价，**取折后价 $0.30**（规则 4）。若只是限时划线价，则取划线价
- **促销期价格**：Gemini 3.7 Flash 促销到 2026-12-31，之后翻倍——**限时**促销按规则 4 忽略，取促销结束后的正价
- **峰谷定价生效日**：DeepSeek 在页面里写明切换日期——注意区分「页面列的是新价还是旧价」
- **上下文阶梯**：OpenAI（Short/Long context）、Qwen（不同模型不同档）、Seed（输入长度分档）——按规则 1 取最短档
- **缓存价的位置各家不同**：OpenAI 同表 Cached input 列；Anthropic 的「Cache Hits & Refreshes」列（注意别取成 Cache Writes）；Google/智谱/腾讯 单列「缓存命中」；Kimi「输入价格（缓存命中）」；Qwen **不在定价表里**，要去 context-cache 文档查（= 输入价 × 10%）
- **官方 ID 不一定在定价页**：Anthropic 只有展示名（Claude Fable 5），没有 API model ID——official_id 留空，不猜
- **同名不同价**：Seed 2.1 有 pro/turbo 两档，列表里的「Seed 2.1」对应 pro（旗舰）；拿不准时向 Victor 确认，不自行假设
- **Seed 2.1 缓存价不在主表**：火山方舟主定价页 `doubao-seed-2.1-pro` 行的「缓存命中」列为空，需查阅上下文缓存文档确认是否有独立缓存定价
- **Claude 5 Sonnet 促销已转正价**：2026-06-30 发布时为 $2/$10 的 introductory pricing，部分页面已标记为 standard price。采集时以页面当前标注为准，selection_note 注明

### D. 汇率

- 中国银行外汇牌价（bankofchina.com/sourcedb/whpj）中间价是可靠来源，页面直接给出当日数值
- 一次采集只用一个汇率（采集开始时的），全部 CNY 模型共用，写入各自的 fx_rate

### E. 执行节奏

- 全量模型一轮约 40–60 分钟；建议按厂商分批（美系 USD 一批，中系 CNY 一批），每批落盘 + commit，避免中途失败丢进度
- Claude 系、Gemini 系同厂商多模型共享一个定价页，打开一次全部抄完
- 汇率先查：采集开始前先从中国银行获取 USD/CNY 中间价，所有 CNY 模型共用
- 临时文件清理：每次采集产生的 JSON/HTML 文件在写入真相源后立即删除，不要留在仓库目录中
