# OVERVIEW — 知识库入口地图

> **Agent 阅读顺序**：本文件 → 目标领域 `wiki/areas/<领域>.md` → 领域下的 project 页 → project 挂的双链概念页。
> 本文件是唯一的全局地图：读完它就知道该跳去哪，不需要扫描全库。规则见 [[CLAUDE.md]]。

## 库结构：三层 + 收件箱

| 层 | 位置 | 判定问题 | 状态 |
| --- | --- | --- | --- |
| **area 领域** | `wiki/areas/` | 我想长期在这个方向保持水准（无终点） | active / dormant / evergreen |
| **project 项目** | `wiki/projects/` | 我要交付什么、何时算完（有终点） | active / paused；完结移入 `wiki/archives/` |
| **resource 资源** | `wiki/resources/`：`concept/` 概念页 · `resource/` 精读原文 · `words/` 精读单词 | 消化后的知识 / 精读材料（无状态） | concept: developing / mature |
| **收件箱** | `inbox/` | 未消化的源文档（原文 / 剪藏），保留原文；按主题分子文件夹（`后端与网络/` `编程语言/` `人工智能/` `英语精读/`，分类不必执着，见 inbox/README）；英文精读原文例外，迁入 `wiki/resources/resource/` | — |
| **交付工作区** | `D:/Projects/<项目名>/`（库外） | 每个项目的交付成果与工作文件：`README.md`（交付目标 / 清单）+ `archive/`（旧版本）+ 成果；库内存指针（project `code:` 字段） | — |

层间关系**只用双链**：area 页列出领域下的项目，project 页在 frontmatter `related` 与正文 Related 里挂概念页，概念页反指项目；精读原文与单词页也反指所属 project。无 Dataview、无账本、无生成脚本。代码与交付成果的库外位置见 [[wiki/meta/code-repos]]。

其他：`wiki/CS本科学习手册.md`（独立指南）、`wiki/archives/`（已完结项目）、`calendar/`（日记）、`Excalidraw/`（图示源文件）。

## 领域地图

### 后端

> 以「请求 → 服务 → 数据」链路为主线：网络协议与 API 契约 → 服务端业务逻辑 → 数据存储。详见 [[wiki/areas/后端|后端]]。

| 项目 | 交付主线 | 主要概念页 |
| --- | --- | --- |
| [[wiki/projects/Backend Introduction\|Backend Introduction]] | 后端入门：网络 → HTTP → DNS → 服务器 → 数据库 → API 全链路 | [[互联网工作原理]]、[[HTTP 详解]]、[[DNS 详解]]、[[Web 浏览器详解]]、[[浏览器渲染原理]]、[[域名详解]] |
| [[wiki/projects/HTTP\|HTTP]] | 深挖协议骨架：报文 / 方法 / 状态码 / 缓存 / 连接 / 版本演进 | [[HTTP 详解]]、[[HTTP3 核心概念]] |
| [[wiki/projects/API Styles\|API Styles]] | 对比主流 API 风格，形成选型参考 | [[RESTful API Design]]、[[JSON API]]、[[JSON API Specification]]、[[OpenAPI 规范]] |
| [[wiki/projects/Relational Databases\|Relational Databases]] | PostgreSQL 为主线的SQL 与数据库设计 | [[PostgreSQL 教程]] |
| [[wiki/projects/pythonBasics\|pythonBasics]] | Python 基础：语法、控制流、数据结构与函数 | [[Python Syntax]]、[[Python 快速入门]] |
| [[wiki/projects/JavaScript指南\|JavaScript指南]] | MDN《JavaScript 指南》系统补齐语言核心 | [[JavaScript 控制流与循环]] |
| [[wiki/projects/animo-cloud\|animo-cloud]] | 真实仓库（Kotlin/Ktor）联调交付 | （附属文档见项目页） |
| [[wiki/projects/harness开发学习主线\|harness开发学习主线]] | DeepSeek Harness 开发，独立提交 PR | （依赖 pythonBasics / JavaScript指南） |

### 计算机基础

> CS 本科的「骨架课」群：数据结构与算法 · 计算机组成 · 操作系统 · 编译原理。网络已在「后端」领域推进，此处不重复。详见 [[wiki/areas/计算机基础|计算机基础]]。

| 项目 | 交付主线 | 主要概念页 |
| --- | --- | --- |
| [[wiki/projects/数据结构 Introduction\|数据结构 Introduction]] | 把「逻辑关系 + 物理存储 + 操作集合 + 效率权衡」落成可操作流程：知识星图 + 六问法 + 12 个真实问题 | [[数据结构分析框架]] |
| [[wiki/projects/线性表\|线性表]] | 实现并验证动态数组 SeqList：测试全绿 + 复杂度实测 + 选型判据 | [[线性表]]、[[顺序表]]、[[摊还分析]] |

### 人工智能

> 从机器学习定义与分类入门，落到亲手实现。详见 [[wiki/areas/人工智能|人工智能]]。

| 项目 | 交付主线 | 主要概念页 |
| --- | --- | --- |
| [[wiki/projects/What is ML and its types\|What is ML and its types]] | ML 定义、三大类型与深度学习架构入门 | [[机器学习]] |
| [[wiki/projects/minGPT教学方案\|minGPT教学方案]] | 逐行读懂 minGPT，从零写 150–250 行小 GPT | （见项目页） |

### 神经与认知科学

> 用认知科学验证学习方法，再把 RL/DL 概念映射为可操作的学习方法论。详见 [[wiki/areas/神经与认知科学|神经与认知科学]]。

| 项目 | 交付主线 | 主要概念页 |
| --- | --- | --- |
| [[wiki/projects/学习方法的认知科学验证\|学习方法的认知科学验证]] | 逐条验证学习方法论断，给出证据状态 | [[认知迁移能力]]、[[适度困难与最优误差率]]、[[学习率与巩固：间隔·睡眠·运动]] |
| [[wiki/projects/类比于强化学习和深度学习的学习理论\|类比于强化学习和深度学习的学习理论]] | RL/DL → 人类学习方法论的映射与实证校准 | [[机器学习]]、[[综合方法论：RL-DL 启发的认知提升框架]]、[[RL-DL 类比的边界条件：情境调节变量]] |
| [[wiki/projects/认知表征与泛化\|认知表征与泛化]] | 图式 / 具身表征 / 元认知 / 泛化表征 | [[图式与理解力]]、[[具身认知与概念隐喻]]、[[泛化表征的多种格式]]、[[元认知与迁移的可训练性]] |
| [[wiki/projects/神经可塑性\|神经可塑性]] | 可塑性的生物机制与脑区差异 | [[神经可塑性 生物机制]]、[[神经可塑性 认知科学理论]]、[[成人脑可塑性]]、[[可塑性 脑区与认知域差异]] |
| [[wiki/projects/环境变化与认知\|环境变化与认知]] | 物理环境对认知的多维影响 | [[wiki/resources/concept/环境变化与认知\|环境变化与认知]] |

### 英语学习

> 目标是能用英语交流、参与学术活动的综合能力（读 · 听 · 说 · 写）；精读材料与生词进 resources，消化产出用自己的话写成概念页。详见 [[wiki/areas/英语学习|英语学习]]。

| 项目 | 交付主线 | 主要概念页 |
| --- | --- | --- |
| [[wiki/projects/How To Do Great Work\|How To Do Great Work]] | 精读 Paul Graham《How to Do Great Work》，用自己的语言产出核心要点 + 精读词汇 | [[如何做出伟大工作]] |

## 工作流

- **读**：按本文件 → area → project → concept 的顺序跳转，双链即路径。
- **摄入**：源文档放 `inbox/`（保留原文，不删；按主题丢进子文件夹，拿不准就放根目录）；消化后**用自己的话**写成 `wiki/resources/concept/<主题>.md`，在相关 project 页挂双链。不复制原文、不建来源页副本。英文精读例外：原文入 `wiki/resources/resource/`，生词入 `wiki/resources/words/`，inbox 其余文件保持原位。
- **交付**：每个 project 在 `D:/Projects/<项目名>/` 有交付工作区——速查表 / 练习 / 报告草稿等交付成果放这里，过时版本移入其 `archive/`；project 页「交付物」全部勾选才算完成。映射总表见 [[wiki/meta/code-repos]]。
- **完结**：project 交付物全部完成后 `status: completed`，`git mv` 进 `wiki/archives/`，同时更新本文件的领域地图；库外工作区整体留档。
