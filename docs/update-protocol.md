# 模型价格收集与更新协议

*本协议自包含，可被定时任务直接执行。执行者是 Agent，操作对象是本项目仓库（`agent-vik/llm-price`）。*

## 0. 目的与边界

- 目的：从各模型**官方渠道**采集最新 API 定价，更新真相源 `data/prices.json`
- **硬边界：Agent 只更新 `data/prices.json` 中的价格与元数据，绝不增删 `config/models.json` 中的模型**。模型的增删、改名、排序是 Victor 的决策
- 本项目**不做自动更新机制**：本协议由 Victor 定期触发 Agent 手动执行

## 1. 执行流程

对 `config/models.json` 中的**每一个模型**，依次：

1. **定位官方定价页**：优先用配置里的 `pricing_url`（上次采集时留下的）；失效或为空时，通过搜索/官网找到官方定价页。来源优先级：官方文档 > 官方控制台定价页 > 官方博客公告。**禁止**使用第三方聚合站、评测文章、记忆中的旧价格
2. **确认模型身份**：在官方页上确认 `official_id`（官方 API 实际使用的模型 ID）。找不到对应模型 → 不写入价格，在结果里报告该模型
3. **采集三个价格**：输入 / 输入缓存（cached input）/ 输出。官方没有缓存输入价的，记 `null`，不猜
4. **应用 canonical 选取规则**（见第 2 节）
5. **换算为 USD / 1M tokens**（见第 3 节）
6. **写入真相源**：更新 `data/prices.json` 对应条目（input、cached_input、output、official_id、source_url、collected_at、fx_rate、selection_note）
7. 同步：若 `official_id` 或 `pricing_url` 有变化，同步更新 `config/models.json` 中该模型的这两个字段（仅这两个字段——名称与顺序不动）

全部模型处理完后：**git commit + push**，并向 Victor 汇报：更新了哪些模型、哪些模型未找到官方价格、汇率与采集日期。

## 2. canonical 价格选取规则

一个模型若有多档价格，按以下规则取**唯一**展示值：

1. **上下文长度分阶梯定价** → 取**最短上下文档**的价格
2. **存在峰谷定价** → 取**低谷（off-peak）价格**
3. 缓存输入价格若也分阶梯/峰谷，**跟随主价格同一档/同一谷**（除非官方另有独立阶梯）

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
