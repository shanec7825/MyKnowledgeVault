---
address: c-000084
type: source
title: "The Eighty Five Percent Rule for Optimal Learning"
created: 2026-08-13
updated: 2026-08-13
status: active
tags:
  - source
  - optimal-error
  - learning-rate
  - computational
related:
  - "[[适度困难与最优误差率]]"
sources:
  - "[[学习方法的认知科学验证]]"
---

# The Eighty Five Percent Rule for Optimal Learning

- **论文**: Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). The Eighty Five Percent Rule for optimal learning. *Nature Communications*, 10, 4646.
- **URL**: https://doi.org/10.1038/s41467-019-12552-4（PMID 31690723，开放获取）
- **权威等级**: primary（同行评议原始论文）
- **检索日期**: 2026-08-13；**摄入日期**: 2026-08-13
- **独立性**: 最优训练误差率的计算/验证（独立于教育心理学传统）
- **证据状态**: 核心结果经神经网络与生物可塑性网络验证
- **检索方式**: 摘要级（Web 搜索），未抓取全文（网络策略阻断）

## 核心发现

对一类基于**梯度下降**的**二分类**学习算法，推导出训练时存在一个「甜区」：

- **最优误差率 ≈ 15.87%**（等价于最优训练正确率 ≈ 85%）——「85% 法则」。
- 太易（误差趋近 0）→ 梯度信号微弱、学习慢；太难 → 远离决策边界、学习慢。
- 在**人工神经网络**与**生物可塑性神经网络**两类模型上均得到验证。

## 边界（重要）

- 该数值在「二分类 + 梯度下降」设定下导出，**不是人类学习的普适常数**；任务类型与算法改变会移动最优误差率。
- 本文的价值在于支持「**存在一个非零的最优误差率**」这一质性命论，而非提供一个可套用的精确数字。

## 与 vault 的关联

为 [[适度困难与最优误差率]] 提供量化锚点，是日记「实际-模型误差要适中」的数学对应物。
