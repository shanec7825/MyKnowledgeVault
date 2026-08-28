---
address: c-000069
type: source
title: "What is Machine Learning"
created: 2026-08-08
updated: 2026-08-08
status: seed
source_type: webpage
author: "Dave Bergmann"
date_published: ""
url: "https://www.ibm.com/think/topics/machine-learning"
source_id: "src-3707bb0501e7f8bcca4c"
sha256: "85edac8373dffb4bc91f43f86b9ecfee3744593ac16bf6a8073192c6e3a73546"
authority: secondary
independence_key: "ibm-think-what-is-machine-learning"
review_state: active
key_claims:
  - "机器学习是 AI 的子集：算法从训练数据中“学习”模式，进而对新数据做出准确推断，无需显式硬编码指令。"
  - "训练只是手段，泛化——把训练集上的表现转化为真实场景中的有用结果——是机器学习的根本目标。"
  - "所有机器学习都是 AI，但并非所有 AI 都是机器学习；if-then 规则系统（恒温器、专家系统）属于 AI 而非 ML。"
  - "“机器学习”一词常追溯至 Arthur L. Samuel 1959 年发表于 IBM Journal 的论文《Some Studies in Machine Learning Using the Game of Checkers》。"
  - "所有 ML 方法按训练目标可分为三大范式：监督学习、无监督学习、强化学习；混合训练流程常组合多种范式。"
  - "监督学习以最小化损失函数输出为数学目标，对照外部 ground truth（通常来自标注数据），用于分类与回归任务。"
  - "自监督学习从无标注数据中直接获得监督信号（如 autoencoder 重建误差、LLM 掩码词预测），是 LLM 的主要预训练方法。"
  - "半监督学习同时使用标注与未标注数据，用标注信息对未标注样本做假设以纳入监督工作流。"
  - "无监督学习从无标注数据中发现内在模式（聚类、关联、降维），不存在外部 ground truth，无需常规损失函数。"
  - "强化学习基于相互依赖的状态-动作-奖励元组训练，目标是最优化参数以最大化奖励；策略 π(s)→a；基于策略如 PPO，基于价值如 Q-learning。"
  - "神经网络是通用逼近器：理论上任何函数都存在能复现它的网络结构。"
  - "反向传播配合梯度下降使数百万至数十亿权重可被单独优化，因此深度学习需要大量数据与算力。"
  - "Transformer（2017 年首次提出）的注意力机制使其能选择性聚焦输入中最相关的部分，是 LLM 与生成式 AI 的基石。"
  - "CNN 通过卷积层提取特征（主要用于视觉）；RNN 以隐状态记忆处理序列数据。"
  - "Mamba（2023 年提出）基于状态空间模型变体，已成为 Transformer 的竞争架构，尤其用于 LLM。"
  - "MLOps 是构建、部署与维护 ML 模型的流水线实践，需监控模型漂移并实施模型治理。"
tags:
  - source
  - tutorial
  - machine-learning
  - ai
---

# What is Machine Learning

- **来源**：[IBM Think — What is machine learning?](https://www.ibm.com/think/topics/machine-learning)（Dave Bergmann，IBM Think）
- **作者**：Dave Bergmann，Senior Staff Writer, AI Models, IBM Think
- **分类**：参考 / 教程（secondary authority）

## What is machine learning?

> **总纲**：Machine learning is the subset of artificial intelligence (AI) focused on algorithms that can "learn" the patterns of training data and, subsequently, make accurate *inferences* about new data. This pattern recognition ability enables machine learning models to make decisions or predictions without explicit, hard-coded instructions.

- ML 已成为 AI 领域的主流：它是大多数现代 AI 系统（预测、自动驾驶、LLM 与生成式 AI）的骨干。
- 核心前提：若模型在"与真实问题足够相似"的任务数据集上通过**模型训练**优化性能，它就能在最终使用场景的新数据上做出准确预测。
- 训练的最终目的是**泛化（generalization）**：把训练集上的强表现转化为真实场景中的有用结果。训练好的模型在新数据上做推断的过程称为 AI 推理（AI inference）。
- **术语溯源**："machine learning"一词常追溯至 Arthur L. Samuel 1959 年发表于 IBM Journal 的论文《Some Studies in Machine Learning Using the Game of Checkers》——"a computer can be programmed so that it will learn to play a better game of checkers than can be played by the person who wrote the program"。

### Machine learning vs. artificial intelligence

- 简言之：**所有机器学习都是 AI，但并非所有 AI 都是机器学习**。
- 最基础的 AI 系统是 if-then-else 规则（如恒温器：温度 <67 开暖气、>72 开空调）；复杂的规则系统如医学专家编写的决策树。这些"专家系统"的逻辑由数据科学家显式编程。
- 与专家系统不同，ML 模型的逻辑**不是显式编程而是从经验中习得**：垃圾邮件过滤只需选择算法 + 足够的样本数据集，模型在训练中隐式学会识别垃圾邮件。
- 任务越复杂规则型模型越脆弱：无法显式定义所有模式与变量。ML 因"从数据本身隐式学习"更灵活、可扩展、易用，成为 AI 的主导模式。

## How machine learning works

- 数据点的相关特征必须**数值化**，才能输入数学算法学习"输入 → 输出"的映射。
- 数据点通常表示为**向量**（向量嵌入），每个维度对应一个特征的数值。
- 手动选择数据中的哪些方面用于算法 = **特征选择**；把数据精炼到最有意义维度 = **特征提取**；二者同属**特征工程**。深度学习的显著区别：通常在原始数据上运行并自动化大部分特征工程，更可扩展但可解释性更低。
- **模型参数与优化**：以房价线性回归为例——Price = A×面积 + B×房间数 − C×房龄 + Base。A/B/C 是模型参数，ML 的目标就是找到让函数输出最准确的参数值（损失最小化）。

## Types of machine learning

所有 ML 方法按训练目标可分为三种范式；实际训练流程常**混合**多种范式（如 LLM 先经监督式预训练与微调，再用 RLHF 等强化技术继续微调），集成学习则聚合多算法输出。

### Supervised learning

- 预测给定输入的"正确"输出，对照外部 ground truth（通常来自标注数据）。典型任务：分类（离散值，如 SVM、朴素贝叶斯、逻辑回归）与回归（连续值，如线性回归、状态空间模型）。
- 数学目标：**最小化损失函数**的输出。损失函数度量模型输出与 ground truth 的偏差；优化算法（多数涉及求导）确定降低损失的参数调整。
- 现代术语用"监督信号（supervisory signals）"泛指任何 ground truth 来源。

### Self-supervised learning

- 监督信号直接来自**无标注数据**（autoencoder 以"最小化重建误差"为目标，用原输入自身作 ground truth；LLM 的掩码词预测）。
- 是 LLM 的主要预训练方法，常与迁移学习 / 基础模型 / 微调相关联。

### Semi-supervised learning

- 同时使用标注 + 未标注数据：用标注信息对未标注样本做假设，将其纳入监督工作流。

### Unsupervised learning

- 从无标注数据中发现内在模式（相似性、相关性、分组），无外部 ground truth，无需常规损失函数。三大功能：
  - **聚类**：按邻近/相似度分组（K-means、GMM、DBSCAN）；用于市场细分、欺诈检测。
  - **关联**：发现行为与条件间的相关性（如电商推荐引擎）。
  - **降维**：用更少特征表示数据点（autoencoder、PCA、LDA、t-SNE）；用于预处理、压缩、可视化。
- 训练挑战聚焦于数据预处理与超参数调优（如学习率、簇数量）。

### Reinforcement learning (RL)

- 通过试错整体训练，用于机器人、游戏、推理模型等解空间大且开放的任务。RL 文献中称 AI 系统为"agent（智能体）"。
- 基于相互依赖的**状态-动作-奖励**元组（而非独立的输入-输出对）；目标不是最小化误差而是**最大化奖励**。
- 组件：**状态空间**（决策相关全部信息）、**动作空间**（允许的决策；棋盘 = 合法走法，文本生成 = 词表）、**奖励信号**（正/负标量反馈，由规则、奖励函数或奖励模型决定）、**策略 π**（π(s)→a）。
- 基于策略的方法（如 PPO）直接学策略；基于价值的方法（如 Q-learning）学状态价值函数再选动作；actor-critic 混合两者。深度强化学习用神经网络表示策略。

## Deep learning

- 使用多层人工神经网络（"深"），而非传统 ML 的显式算法。得益于 GPU 与大数据，2000 年代末到 2010 年代初崛起为各 AI 子领域主流。
- 结构：互连的"神经元"层，每节点执行**非线性激活函数**，输出作为下一层输入。连接权重与偏置是待优化参数。
- **反向传播**计算每个节点对损失函数的贡献，配合**梯度下降**可单独优化数百万至数十亿权重。深度学习因此需要大量数据与算力。
- **通用逼近器**：理论上任何函数都存在能复现它的网络结构（论文引用：Kolmogorov 映射网络存在定理 1987；非多项式激活多层前馈网络 1992）。

### Convolutional neural networks (CNNs)

- 卷积层用加权"滤波器"提取数据特征，主要用于计算机视觉模型与图像数据，也有其他重要用途。

### Recurrent neural networks (RNNs)

- 循环处理序列：前一步输出作为下一步输入，形成内部"隐状态"记忆，从而理解上下文与顺序。

### Transformers

- 2017 年首次提出；独特的**注意力机制**使其能选择性聚焦序列中最相关的部分；是 LLM 与生成式 AI 的基石，在大多数 ML 子领域取得 SOTA。

### Mamba models

- 2023 年提出，基于状态空间模型（SSM）的变体，同样实现"选择性优先关注最相关信息"；已成为 Transformer 的竞争架构（尤其 LLM）。

## Machine learning use cases

- **计算机视觉**：图像/视频"看见"（图像分类、目标检测、图像分割、OCR）；医疗诊断、人脸识别、自动驾驶。
- **NLP**：文本/语音/语言任务（聊天机器人、语音识别、机器翻译、情感分析、文本生成、摘要、AI agents）。
- **时间序列分析**：异常检测、市场分析、预测。
- **图像生成**：扩散模型、VAE、GAN 生成原创图像。

## Machine learning operations (MLOps)

- **MLOps**：以流水线方式构建、部署、维护 ML 模型；包括数据策管与预处理、模型选择、训练后验证（防过拟合）、部署后监控**模型漂移**与推理效率，以及**模型治理**。

## Machine learning libraries

- 深度学习：PyTorch、TensorFlow、Keras、Hugging Face Transformers。
- 传统 ML：Pandas、Scikit-learn、XGBoost、Matplotlib、SciPy、NumPy。
- 多基于 Python 语言。
