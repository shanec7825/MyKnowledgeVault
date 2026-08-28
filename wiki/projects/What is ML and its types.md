---
address: c-000071
type: project
title: "What is ML and its types"
created: 2026-08-08
updated: 2026-08-28
status: active
area: "人工智能"
domain: machine-learning
complexity: beginner
goal: "机器学习入门：梳理机器学习的定义、三大类型（监督 / 无监督 / 强化）与深度学习架构，建立 AI 方向的知识起点。"
sources:
  - "[[What is Machine Learning]]"
related:
  - "[[机器学习]]"
  - "[[pythonBasics]]"
tags:
  - project
  - machine-learning
  - ai
  - area/人工智能
---

# What is ML and its types


## 前置
**前置项目**：无

**知识框架体系**：概念层（ML 定义与 AI 的关系、监督/无监督/强化三范式、深度学习架构）；技能层（判断一个问题属于哪类 ML 任务、为后续实践做技术选型）；工具层（Python ML 库生态认知）。


## 目标产出
> 机器学习入门：梳理机器学习的定义、三大类型（监督 / 无监督 / 强化）与深度学习架构，建立 AI 方向的知识起点。


**具体目标**：

- 建立机器学习的概念框架：定义、与 AI 的关系、工作原理、三大学习范式。
- 逐步深入各类型与架构：监督/无监督/强化学习、深度学习（CNN/RNN/Transformer/Mamba）。
- 与 [[pythonBasics]] 衔接（ML 库多基于 Python），为后续实践打基础。

**交付物**：

- [ ] 三大学习范式与深度学习架构各一页概念页
- [ ] 《机器学习类型对照表》（定义 / 代表算法 / 适用场景）
- [ ] 与 pythonBasics 衔接的可执行上手路径

- [ ] -三大学习范式与深度学习架构各有独立概念页
- [ ] -输出《机器学习类型对照表》（定义 / 代表算法 / 适用场景 / 与 Python 实践衔接）
- [ ] -与 [[wiki/projects/pythonBasics|pythonBasics]] 形成可执行的上手路径
- [ ] -`wiki-lint` 无死链
- [ ] -全部完成后：`status: completed`，项目移入 `wiki/archives/`
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：从 IBM Think 综述起步，建立机器学习的类型体系（监督 / 无监督 / 强化 + CNN / RNN / Transformer / Mamba），作为 AI 方向的知识起点。

**关键难点**：

- 三大范式的边界不绝对，半监督、自监督横跨其间，别把它当成非黑即白。
- 架构要理解「为什么需要它」而不是背名字——CNN 为空间、RNN 为序列、Transformer 为长程依赖。
- 选型直觉要靠后续实践喂养，单靠综述建不起来。


## 内容
- [[机器学习]] — 机器学习概念页：定义、类型体系、深度学习架构、应用与 MLOps（中文讲解）
- [[wiki/resources/resource/What is Machine Learning|What is Machine Learning]] — 来源页（IBM Think，Dave Bergmann）


## 待办
- [x] 摄入 IBM Think《What is machine learning?》综述
- [ ] 补充"机器学习类型详解"（machine-learning-types）对照表
- [ ] 监督学习专题：回归（线性/Lasso/Ridge）与分类（决策树/KNN/朴素贝叶斯/SVM）
- [ ] 无监督学习专题：聚类（K-means/层次聚类）、降维（PCA/t-SNE）
- [ ] 强化学习专题：PPO / Q-learning / RLHF
- [ ] 深度学习专题：CNN / RNN / Transformer 注意力机制 / Mamba
- [ ] 补充损失函数、梯度下降、过拟合与正则化基础


## 自动关联
> 以下列表由 Dataview 自动生成，勿手工编辑。改关系请改 frontmatter 的 `sources` / `related` / `prerequisites`。

### 本项目引用的知识

```dataview
LIST WITHOUT ID R
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN (sources + related) AS R
SORT R ASC
```

### 引用本项目的资源

```dataview
LIST
FROM "wiki/resources"
WHERE contains(related, this.file.link) OR contains(sources, this.file.link)
SORT file.name ASC
```

### 前置项目

```dataview
LIST WITHOUT ID P
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN prerequisites AS P
```

### 后继项目

```dataview
LIST
FROM "wiki/projects"
WHERE contains(prerequisites, this.file.link)
```
