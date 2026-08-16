---
type: meta
title: Wiki Log
status: evergreen
created: 2026-08-02
updated: 2026-08-13
tags:
  - meta
  - log
---

# Wiki Log

Newest completed operations appear first.

## 2026-08-13 — Autoresearch 学习方法的认知科学验证 (autoresearch-lm-20260813)

- 研究：日记 [[2026-08-13]] 的 5 条学习方法论断的认知科学验证——最优误差率（85% 法则 / 合意困难 / 最近发展区）、间隔与巩固（间隔效应 / 灾难性干扰 / 睡眠 / 运动）、工作记忆与遗忘（≈4 组块 / 存储-提取强度 / 知识封装 / 遗忘曲线）（公开网络，摘要级检索，12 来源）
- 创建：[[学习方法的认知科学验证]]（项目）+ [[适度困难与最优误差率]] / [[学习率与巩固：间隔·睡眠·运动]] / [[工作记忆、封装与遗忘]]（概念）+ 12 个来源页
- 关联：[[类比于强化学习和深度学习的学习理论]]（实证补充）、[[综合方法论：RL-DL 启发的认知提升框架]]、[[RL-DL 类比的边界条件：情境调节变量]]
- Ledgers: 新增 12 条 source 记录、23 条 claim 记录

## 2026-08-11 — Ingest PostgreSQL Tutorial (ingest-postgresql-20260811)

- Sources: [[PostgreSQL Tutorial]]（neon.com/postgresql/tutorial）
- Created: [[PostgreSQL 教程]]（概念）、[[PostgreSQL Tutorial]]（来源）
- 关联：建立 [[Relational Databases]] 项目页；[[Backend Introduction]] 数据库 TODO → 项目引用
- Ledgers: 新增 1 条 source 记录、10 条 claim 记录

## 2026-08-11 — Ingest MDN How browsers work (ingest-browser-render-20260811)

- Sources: [[Populating the page how browsers work]]（MDN Web Docs，2025-12）
- Created: [[浏览器渲染原理]]（概念）、[[Populating the page how browsers work]]（来源）
- 关联：[[Backend Introduction]] 项目页补充浏览器渲染管道（导航/DNS/TCP/TLS → 解析/DOM/CSSOM → 渲染/布局/绘制/合成 → 交互/TTI），标记 TODO 完成
- Ledgers: 新增 1 条 source 记录、11 条 claim 记录

## 2026-08-11 — Ingest DNS (ingest-dns-20260811)

- Sources: [[Everything You Need to Know About DNS]]（cs.fyi，2023-03）
- Created: [[DNS 详解]]（概念）、[[Everything You Need to Know About DNS]]（来源）
- 关联：[[Backend Introduction]] 项目页补充 DNS 概念页与来源页；交叉链接 [[域名详解]]、[[What is a Domain Name]]
- Ledgers: 新增 1 条 source 记录、8 条 claim 记录（DNS 系列）

## 2026-08-11 — Ingest What is a Domain Name (ingest-domain-name-20260811)

- Sources: [[What is a Domain Name]]（MDN Web Docs，2025-06）
- Created: [[域名详解]]（概念）、[[What is a Domain Name]]（来源）
- 关联：[[Backend Introduction]] 项目页补充域名与 DNS 入门知识，标记 TODO 完成
- Ledgers: 新增 1 条 source 记录、10 条 claim 记录

## 2026-08-08 — Repair provenance records (repair-provenance-20260808)

- 修复 Web 浏览器摄入（2026-08-07，未走引擎）遗留：来源 ID 规范化为 src-da88aea4c34ac810e0b4（页面 frontmatter / source ledger / claims 统一）
- 补记 Web 浏览器 6 条 claims（从页面 key_claims 还原）；OpenAPI 摄入（2026-08-07）补录 manifest sources + address_map
- Ledgers: source-ledger +1（Web 浏览器）、claim-ledger +6

## 2026-08-08 — Ingest What is Machine Learning (ingest-what-is-ml-20260808)

- Sources: [[What is Machine Learning]]（Dave Bergmann，IBM Think）
- Created: [[机器学习]]（概念）、[[What is ML and its types]]（项目）、[[What is Machine Learning]]（来源）
- 关联：[[pythonBasics]] 交叉链接（ML 库多基于 Python）
- Ledgers: 新增 1 条 source 记录、16 条 claim 记录

## 2026-08-08 — Archive Task Tracker CLI (archive-taskstracker-20260808)

- 归档：[[Task Tracker CLI]] 从 `wiki/projects/tasksTracker/` → `wiki/archives/tasksTracker/`（PARA 标准操作）
- Updated index（Projects → Archives）、log、hot cache

## 2026-08-08 — Finalize Task Tracker CLI (save-taskstracker-final-20260808)

- 项目完结：[[Task Tracker CLI]]（roadmap.sh 入门项目，Python CLI 待办工具）
- Updated [[Task Tracker CLI]]（补 type/project + status/completed frontmatter）、[[Task Tracker CLI 开发记录]]（剩余问题全部勾完、实测状态更新、status → mature）
- Updated index（Projects 区新增 [[Task Tracker CLI]]，加 ✅ 已完成标记）、log、hot cache

## 2026-08-07 — Save Task Tracker CLI 开发记录 (save-taskstracker-devlog-20260807)

- Created [[Task Tracker CLI 开发记录]]（session）— CLI 开发生记录：sys.argv / json / 文件模式等技术要点、初版 7 个 bug 的调试记录（已全部修复）与剩余 TODO（文件初始化、状态命名等）。
- 关联 [[Task Tracker CLI]]（roadmap.sh 项目规格）与 [[task-cli.py]]（脚本）。
- Updated index, log, hot cache。

## 2026-08-07 — Ingest OpenAPI Specification 3.1 (ingest-openapi-spec-20260807)

- Sources: [[OpenAPI Specification (v3.1)]]（OpenAPI Initiative，swagger.io，2021-02）
- Created: [[OpenAPI 规范]]（概念）、[[OpenAPI Specification (v3.1)]]（来源）
- 关联：[[API Styles]] 项目页补充 OpenAPI 风格对照，标记 TODO 完成
- Ledgers: 新增 1 条 source 记录、7 条 claim 记录

## 2026-08-07 — Ingest What is a Web Browser (ingest-web-browser-20260807)

- Sources: [[What is a Web Browser Definition, Types, and Features]]（Alex Mika，Ramotion Blog，2024-07）
- Created: [[Web 浏览器详解]]（概念）、[[What is a Web Browser Definition, Types, and Features]]（来源）
- 关联：[[Backend Introduction]] 项目页补充浏览器概念页与来源页链接，标记已摄入浏览器基础知识
- Ledgers: 新增 1 条 source 记录、6 条 claim 记录

## 2026-08-06 — Add 加工流畅性与建构水平 concept, link from noise mechanism (concept-disfluency-construal-20260806)

- Created [[加工流畅性与建构水平]]（概念）— 加工不流畅感→更高建构水平→抽象加工 的原理说明（建构水平理论 + 加工流畅性 + 倒 U 甜区解释）。
- Updated [[环境变化与认知]] → 机制句添加 wiki link 跳转原理页；[[Is Noise Always Bad Exploring the Effects of Ambient Noise on Creative Cognition]] → 机制假说行添加链接。
- Updated index, log, hot cache, 项目页概念清单。

## 2026-08-06 — Create 环境变化与认知 project page (project-env-cognition-20260806)

- Created [[环境变化与认知|环境变化与认知（项目）]] project page.
- Updated [[环境变化与认知]]（概念）→ 交叉链接到项目页；[[神经可塑性]] → 新增关联。
- Updated index, log, hot cache.

## 2026-08-06 — Autoresearch 环境变化与认知 (autoresearch-env-20260806)

- 研究：环境变化对认知的影响——上下文依赖记忆 (d=0.28)、物理环境参数 (噪声/光照/温度/办公室)、自然与注意力恢复 (ART)、新奇与脑可塑性 (22 来源)
- 创建：[[环境变化与认知]]（概念）+ 12 个来源页
- 更新：[[神经可塑性]] 项目页、[[认知迁移能力]]（交叉链接）
- Ledgers: 新增 22 条 source、21 条 claim

## 2026-08-06 — Autoresearch 认知迁移能力 (autoresearch-transfer-20260806)

- 研究：认知迁移能力——表现分类（near/far、low-road/high-road）、理论演变（Thorndike/Judd → ACT-R → 结构映射 → PFL）、认知机制（自我解释 / 类比编码 / 提取练习 / 执行功能 / 睡眠）、提升方法（交错练习 d=1.34 / 提取练习 d=0.40 / 类比比较 + 视觉 / 元认知提示）（公开网络，28 来源）
- 创建：[[认知迁移能力]]（概念）+ 12 个来源页
- 更新：[[神经可塑性]] 项目页、[[神经可塑性 认知科学理论]]（交叉链接）
- Ledgers: 新增 28 条 source 记录、28 条 claim 记录

## 2026-08-05 — Autoresearch 神经可塑性 (autoresearch-neuroplasticity-20260805)

- 研究：神经可塑性——生物机制、认知科学理论、成人可塑性强弱、脑区与认知域差异（公开网络，36+ 来源，1 轮即达充分支持）
- 创建：[[神经可塑性]]（项目/研究档案）、[[神经可塑性 生物机制]]、[[神经可塑性 认知科学理论]]、[[成人脑可塑性]]、[[可塑性 脑区与认知域差异]]（概念）
- 来源页：[[Neurogenesis in the Adult Human Hippocampus]]（Eriksson 1998）、[[Human Hippocampal Neurogenesis Drops Sharply in Children]]（Sorrells 2018）、[[Human Hippocampal Neurogenesis Persists throughout Aging]]（Boldrini 2018）、[[Critical Period Plasticity in Local Cortical Circuits]]（Hensch 2005）、[[Putting Brain Training to the Test]]（Owen 2010）、[[Improving Fluid Intelligence with Training on Working Memory]]（Jaeggi 2008）、[[No Evidence of Intelligence Improvement after Working Memory Training]]（Redick 2013）、[[Cognitive Reserve]]（Stern 2009）、[[Navigation-related Structural Change in the Hippocampi of Taxi Drivers]]（Maguire 2000）、[[Effects of Cognitive Training Interventions with Older Adults]]（Ball 2002）
- Ledgers: 新增 37 条 source 记录、42 条 claim 记录（含 3 组并列矛盾：神经发生存在性、n-back 迁移、二语曲线形状）
- 原始捕获：37 个来源文本 → `.raw/captured/np-*.md`（逐字状态标注；事务引擎限制 autoresearch 写 `wiki/` 与 `.raw/`，原始层以 `.raw/captured/` 承接 inbox 职责）
- 索引/日志/热缓存/概览已更新

## 2026-08-05 — Ingest HTTP/3 From A To Z: Core Concepts (ingest-http3-20260805)

- Sources: [[HTTP3 From A To Z Core Concepts]]（Robin Marx，Smashing Magazine，2021-08）
- Created: [[HTTP3 核心概念]]（概念）、[[HTTP3 From A To Z Core Concepts]]（来源）
- 关联：[[Backend Introduction]] 项目页补充 HTTP/3 概念页与来源页链接
- Ledgers: 新增 1 条 source 记录、8 条 claim 记录

## 2026-08-05 — Ingest What is HTTP (ingest-http-20260805)

- Sources: [[What is HTTP]]（Cloudflare Learning，glossary）
- Created: [[HTTP 详解]]（概念）、[[What is HTTP]]（来源）
- Ledgers: 新增 1 条 source 记录、8 条 claim 记录

## 2026-08-05 — Ingest How does the Internet Work (ingest-internet-20260805)

- Sources: [[How does the Internet Work]]（cs.fyi，2023-02）
- Created: [[互联网工作原理]]（概念）、[[How does the Internet Work]]（来源）、[[Backend Introduction]]（项目）
- Ledgers: 新增 1 条 source 记录、8 条 claim 记录

## 2026-08-04 — Ingest How to Do Great Work (ingest-greatwork-20260804)

- Sources: [[How to Do Great Work]]（Paul Graham，paulgraham.com，2023-07）
- Created: [[如何做出伟大工作]]（概念）、[[How to Do Great Work]]（来源）
- Ledgers: 新增 1 条 source 记录、16 条 claim 记录

## 2026-08-03 — Ingest Learn Python in Y Minutes (ingest-learnxinyminutes-20260803)

- Sources: [[Learn Python in Y Minutes]]（learnxinyminutes.com，中文）
- Created: [[Python 快速入门]]（概念）、[[Learn Python in Y Minutes]]（来源）
- Ledgers: 新增 1 条 source 记录、18 条 claim 记录
- 关联：[[pythonBasics]] 项目页补充新概念页链接

## 2026-08-02 — Organize projects: add pythonBasics project page (project-python-basics-20260802)

- 统一两个项目为"每项目一个文件夹"结构：[[API Styles]]、[[pythonBasics]]。
- Created [[pythonBasics]] project page（PARA `wiki/projects/pythonBasics/`）。

## 2026-08-02 — Ingest Python syntax (ingest-python-syntax-20260802)

- Sources: [[Python Syntax Tutorial]]（TutorialsPoint）
- Created: [[Python Syntax]]（概念）、[[Python Syntax Tutorial]]（来源）
- Ledgers: 新增 1 条 source 记录、7 条 claim 记录

## 2026-08-02 — Create API Styles project (project-api-styles-20260802)

- Created [[API Styles]] project page（PARA `wiki/projects/`），组织 REST / JSON:API 风格对比。

## 2026-08-02 — Fix RESTful API Design alias ambiguity (fix-restful-alias-20260802)

- Removed the ambiguous alias `Web API design best practices` from [[RESTful API Design]] so `[[Web API Design Best Practices]]` resolves to the source page.

## 2026-08-02 — Ingest web API design best practices (ingest-webapidesign-20260802)

- Sources: [[Web API Design Best Practices]]（Azure Architecture Center）
- Created: [[RESTful API Design]]（概念）、[[Web API Design Best Practices]]（来源）
- Ledgers: 新增 1 条 source 记录、10 条 claim 记录
- 修复：JSON:API 规范源文件换行符变化（CRLF→LF），source 身份更新为 src-642854a6e0721e6b87b1

## 2026-08-02 — Ingest JSON:API base specification v1.1 (ingest-jsonapi-format-20260802)

- Sources: [[JSON API Specification (v1.1)]]（jsonapi.org/format/）
- Created: [[JSON API Specification]]（概念）、[[JSON API Specification (v1.1)]]（来源）
- Ledgers: 新增 1 条 source 记录、9 条 claim 记录

## 2026-08-02 — Relocate JSON:API pages to PARA resources (relocate-jsonapi-para-20260802)

- Moved [[JSON API]] and [[JSON API Recommendations]] to `wiki/resources/`（PARA）。
- Updated source / claim ledgers, hot cache.

## 2026-08-02 — Ingest JSON:API recommendations (ingest-jsonapi-20260802)

- Sources: [[JSON API Recommendations]]（英文原版 + 中文翻译）
- Created: [[JSON API]]（概念）、[[JSON API Recommendations]]（来源）
- Ledgers: 新增 2 条 source 记录、6 条 claim 记录
