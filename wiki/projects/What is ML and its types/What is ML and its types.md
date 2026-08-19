---
address: c-000071
type: project
title: "What is ML and its types"
created: 2026-08-08
updated: 2026-08-19
status: developing
tags:
  - project
  - machine-learning
  - ai
related:
  - "[[机器学习]]"
  - "[[pythonBasics]]"
sources:
  - "[[What is Machine Learning]]"
goal: "机器学习入门：梳理机器学习的定义、三大类型（监督 / 无监督 / 强化）与深度学习架构，建立 AI 方向的知识起点。"
domain: machine-learning
complexity: beginner
---

# What is ML and its types

**项目**：机器学习入门——从 IBM Think 的综述文章起步，系统梳理"机器学习是什么"与其类型体系。

## 目标

- 建立机器学习的概念框架：定义、与 AI 的关系、工作原理、三大学习范式。
- 逐步深入各类型与架构：监督/无监督/强化学习、深度学习（CNN/RNN/Transformer/Mamba）。
- 与 [[pythonBasics]] 衔接（ML 库多基于 Python），为后续实践打基础。

## 内容

- [[机器学习]] — 机器学习概念页：定义、类型体系、深度学习架构、应用与 MLOps（中文讲解）
- [[wiki/resources/What is Machine Learning|What is Machine Learning]] — 来源页（IBM Think，Dave Bergmann）

## 待办

- [x] 摄入 IBM Think《What is machine learning?》综述
- [ ] 补充"机器学习类型详解"（machine-learning-types）对照表
- [ ] 监督学习专题：回归（线性/Lasso/Ridge）与分类（决策树/KNN/朴素贝叶斯/SVM）
- [ ] 无监督学习专题：聚类（K-means/层次聚类）、降维（PCA/t-SNE）
- [ ] 强化学习专题：PPO / Q-learning / RLHF
- [ ] 深度学习专题：CNN / RNN / Transformer 注意力机制 / Mamba
- [ ] 补充损失函数、梯度下降、过拟合与正则化基础

## 完成标准

- [ ] 三大学习范式与深度学习架构各有独立概念页
- [ ] 输出《机器学习类型对照表》（定义 / 代表算法 / 适用场景 / 与 Python 实践衔接）
- [ ] 与 [[wiki/projects/pythonBasics/pythonBasics|pythonBasics]] 形成可执行的上手路径
- [ ] `wiki-lint` 无死链
- [ ] 全部完成后：`status: completed`，项目移入 `wiki/archives/`
