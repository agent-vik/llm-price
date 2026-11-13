# 模型价格收集与更新协议

*本协议自包含，可被定时任务直接执行。操作对象是本项目仓库（`agent-vik/llm-price`）。*

## 0. 目的与边界

- 目的：从各模型**官方渠道**采集最新 API 定价，更新真相源 `data/prices.json`
- **硬边界：Agent 只更新 `data/prices.json` 中的价格与元数据，绝不增删 `data/models.json` 中的模型**。模型的增删、改名、排序是 Victor 的决策
- **新模型发现汇报**：若官方定价页出现现有模型的更新版本（如 GLM-5.3 → GLM-5.4），Agent 应在任务完成后的汇报中明确列出「检测到模型更新：XXX → YYY，建议添加」，但不自动写入 `models.json`。新增全新厂商/系列模型不在此列
- **模型版本代替规则**：同一厂商的同一产品线出现更新版本时（如 Gemini 3.8 Flash → Gemini 4 Hydrogen、Claude Opus 5 → Opus 5.5），**新版本代替旧版本**，旧版本从列表移除。只有**全新产品线**的模型才追加（如 GPT 5.6 系列之外新增 GPT 6 Astra 系列）
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

每条价格必须带可追溯元数据：`source_url`、`collected_at`、`fx_rate`、`selection_note`。可视化页面顶部仅汇总展示全站最新采集日期（`collected YYYY-MM-DD`），图表与表格不逐条展开采集日期与元数据。

## 5. 失败处理

- 找不到官方定价页：该模型价格不写入（保留旧值或留空），在汇报中明确说明
- 官方页无法访问（反爬/墙）：尝试官方文档的备用入口；仍失败则报告，**不用非官方数据顶替**
- 价格单位存疑（如按 1K tokens 计价）：换算成 1M tokens 口径并在 selection_note 说明
- **WAF 反爬拦截兜底**：当官方站对运行环境触发 WAF 滑块/拦截时，可用 **Wayback Machine 官方页快照**（`web.archive.org/cdx/search/cdx` 查最近 200 快照）核实价格——快照是官方页的原样存档，`source_url` 仍记官方地址，在汇报中注明快照日期。快照距当日 ≤7 天内可视为有效核验

## 6. 提交规范

- commit message：`data: refresh prices (YYYY-MM-DD)`
- 若本次还同步了 official_id/pricing_url：`data: refresh prices + sync model ids (YYYY-MM-DD)`

---

## 附录：采集经验

*目的：沉淀各官方源的稳定读取方式与常见坑，减少重复试错。*

### A. 官方来源索引

| 厂商 | 定价页 URL | 备注 |
|------|-----------|------|
| Google Gemini | https://aistudio.google.com/docs/pricing | `ai.google.dev/gemini-api/docs/pricing` 会 301 跳转至此；经代理 HTTP 请求可得完整 HTML（含全部定价数据），无需浏览器渲染 |
| OpenAI | https://developers.openai.com/api/docs/pricing | `platform.openai.com` 与直连常 403，经代理请求可得完整 HTML；定价数据在 `astro-island` 组件 props JSON（`rows` 数组）与渲染 `<table>` 内（列序：Model / Input / Output / Cached input / 30m write / 12h write） |
| Anthropic | https://platform.claude.com/docs/en/about-claude/pricing | `docs.anthropic.com` 重定向至此；部分地区/IP 受限，受阻时可通过官方博客公告与搜索交叉验证 |
| xAI | https://docs.x.ai/developers/models/grok-4.7 | 模型详情与搜索摘要均包含定价信息，按具体模型页核验 |
| MiniMax | https://platform.minimax.io/docs/guides/pricing-paygo | 服务端渲染，直接可读 |
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing | 服务端渲染，直接可读 |
| 字节/豆包 Seed | https://www.volcengine.com/docs/82379/1544106 | 服务端渲染或内嵌 JSON，直接可读（火山方舟模型价格） |
| 阿里 Qwen | https://www.alibabacloud.com/help/en/model-studio/model-pricing | 国际站直接 USD 报价，无需汇率换算；cache hit = input × 10%（见 context-cache 文档）。若国际站触发 WAF 滑块，按 §5 用 Wayback 快照兜底，或抓国内站 `help.aliyun.com/zh/model-studio/model-pricing`（CNY 口径，仅作交叉验证） |
| 智谱 GLM | https://docs.z.ai/guides/overview/pricing | Z.AI 国际站直接 USD 报价，无需汇率换算；国内 `bigmodel.cn` 同价但为 CNY 且需浏览器渲染 |
| Moonshot Kimi | https://platform.kimi.ai/docs/pricing/chat | 国际站直接 USD 报价，无需汇率换算；页面表格由 JS 组件注入，`.md` 导出仅含空壳表头，需解析渲染页或内嵌 `_jsx` 数据 |
| 腾讯 HY/混元 | https://cloud.tencent.com/document/product/1823/130055 | TokenHub 官方价格页，JS 渲染页面，需通过浏览器/浏览工具读取 |
| 小米 MiMo | https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go | 直接可读；同页含国内 CNY 与海外 USD 两套定价，按国际站惯例取海外 USD 价 |

### B. 采集策略（按优先级试）

1. **直接请求**：优先尝试 HTTP 直接抓取，服务端渲染与内嵌 JSON 页面可直接提取，成本最低
2. **Mintlify 文档的 `.md` 后缀**：`<页面 URL>.md` 可返回 markdown 原文；若表格数据由 JS 组件注入，`.md` 导出会为空壳 `<tbody />`，此时改用渲染提取或解析内嵌数据；`llms.txt` 可用于定位文档路径
3. **浏览器渲染 / 浏览工具**：JS 重度页面（如腾讯 TokenHub）通过浏览器渲染或浏览工具提取表格文本，每次只开一个页面，用完即关
4. **官方备用入口**：主站受限时优先切官方文档/开发者子站（如 `developers.openai.com/api/docs/pricing`）
5. **搜索辅助**：搜索结果里的 snippet 价格只能用来定位页面，写入真相源的必须是打开官方页确认后的数字；官方页完全不可达时，官方博客/新闻稿可作降级来源并在 `selection_note` 注明

### C. 定价页常见的坑

- **划线价 vs 生效价**：先判时效再决定取哪个。MiniMax 标注 ~~$0.60~~ $0.30 且写明 **Permanent 50% off**——永久折扣是稳定价，**取折后价 $0.30**（规则 4）。限时划线价则取未打折原价
- **限时首发/促销价**：如部分新发模型或活动页给出的限时特价（到期后恢复常规价），按规则 4 忽略，取到期后的常规正价并在 `selection_note` 说明
- **峰谷定价生效日**：DeepSeek 等页会写明峰谷规则与生效时间——注意区分当前生效价格与未生效预告价
- **上下文阶梯**：OpenAI（Short/Long context）、Qwen（不同模型不同分档）、Seed（输入长度分档）——按规则 1 取最短档
- **缓存价的位置各家不同**：OpenAI 同表 `Cached input` 列；Anthropic 为「Cache Hits & Refreshes」列（勿误取 Cache Writes）；Google/智谱/腾讯单列「缓存命中」；Kimi「输入价格（缓存命中）」；Qwen **不在主定价表内**，见 context-cache 文档（= 输入价 × 10%）
- **官方 ID 不一定在定价页**：Anthropic 定价页仅列展示名，不提供 API model ID——`official_id` 留空，不猜
- **同名不同价**：Seed 2.1 有 pro/turbo 两档，列表里的「Seed 2.1」对应旗舰 `pro` 档；拿不准时向 Victor 确认，不自行假设
- **Seed 2.1 缓存价不在主表**：火山方舟主定价页 `doubao-seed-2.1-pro` 行可能不直接展开缓存价，需核对上下文缓存文档或模型计费说明
- **推理类型分档（非上下文阶梯）**：小米 MiMo 定价表分「实时推理 / 批量推理」两档，批量价为实时的 50%——取**实时推理**档（批量为异步场景专用），并在 `selection_note` 注明

### D. 汇率

- 中国银行外汇牌价（`bankofchina.com/sourcedb/whpj`）中间价是可靠来源，页面直接给出当日数值
- 一次采集只用一个汇率（采集开始时的），全部 CNY 模型共用，写入各自的 `fx_rate`

### E. 执行节奏

- 全量模型按厂商分批采集（美系 USD 一批，中系 CNY 一批），确认无误后落盘 + commit
- 同厂商多模型（Claude 系、Gemini 系、Qwen 系等）共享一个定价页，打开一次集中核对
- 汇率先查：采集开始前先从中国银行获取 USD/CNY 中间价，所有 CNY 模型共用
- 临时文件清理：采集过程中产生的临时 JSON/HTML 文件在写入真相源后立即删除，不留在仓库目录中
