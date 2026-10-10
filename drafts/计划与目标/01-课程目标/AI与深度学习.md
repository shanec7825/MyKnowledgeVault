---
type: course-goal
course: "AI与深度学习"
status: active
track_mode: reference
current_stage: 1
stage_count: 5
phase: "计算图与自动微分"
stage_status: unverified
verified_progress: false
created: 2026-10-08
updated: 2026-10-08
---
# AI与深度学习｜阶段目标

> [!info] 阶段不是截止日期
> 这里没有每日计划或固定学习时长。当前阶段 1 是**建议诊断起点**，不是判断之前课程已经完成多少；熟悉的阶段可以直接尝试验收。

## 长期目标
从反向传播、训练实验到小型语言模型独立复现。

## 已知学习情况
接触过 micrograd、Transformer、nanoGPT，独立实现待核实。

## 阶段拆分
### 阶段 1｜计算图与自动微分

**学习范围**：链式法则、反传、梯度累加、数值对拍

**阶段产出**：复现micrograd并验证梯度

**通过标准**：独立解释反向传播


### 阶段 2｜神经网络训练

**学习范围**：MLP、损失、优化器、泛化、验证

**阶段产出**：训练小模型并画曲线

**通过标准**：能排查基础训练异常


### 阶段 3｜注意力与Transformer

**学习范围**：QKV、位置编码、残差、归一化

**阶段产出**：实现最小注意力模块

**通过标准**：能理解张量形状与数据流


### 阶段 4｜小型语言模型

**学习范围**：tokenizer、数据、训练、推理、评估

**阶段产出**：建立小模型基线对照实验

**通过标准**：能解释输出变化和评测局限


### 阶段 5｜独立复现

**学习范围**：选题、基线、误差分析、实验复现

**阶段产出**：可重复的模型项目

**通过标准**：能区分改进、噪声和数据泄漏


## 阶段验收记录
- 目前正在检验的阶段：
- 自己独立完成的证据：
- 仍需确认的知识边界：

## 学习参考
- https://introtodeeplearning.com/index.html
- `计划与目标/02-学习任务` 中的旧任务可作为**可选练习**，不必按原日期执行。

## 如何更新
修改 YAML 的 `current_stage` 和 `phase` 来选择当前阶段。`stage_status` 可为 `unverified`（待验证）、`exploring`（进行中）、`verified`（独立通过）；`track_mode` 可为 `main`、`light`、`reference`。

[[00-学习总览|总览]]
