# OVERVIEW — 知识库入口地图

> **Agent 阅读顺序**：本文件 → 目标领域 `wiki/areas/<领域>.md` → 领域下的 project 页 → project 挂的双链概念页。
> 本文件是唯一的全局地图：读完它就知道该跳去哪，不需要扫描全库。规则见 [[CLAUDE.md]]。

## 库结构：三层 + 收件箱

| 层 | 位置 | 判定问题 | 状态 |
| --- | --- | --- | --- |
| **area 领域** | `wiki/areas/` | 我想长期在这个方向保持水准（无终点） | active / dormant / evergreen |
| **project 项目** | `wiki/projects/` | 我要交付什么、何时算完（有终点） | active / paused；完结移入 `wiki/archives/` |
| **resource 概念** | `wiki/resources/concept/` | 消化后的可复用知识（无状态） | developing / mature |
| **收件箱** | `inbox/` | 未消化的源文档（原文 / 剪藏），只进不出地保留原文 | — |

层间关系**只用双链**：area 页列出领域下的项目，project 页在 frontmatter `related` 与正文 Related 里挂概念页，概念页反指项目。无 Dataview、无账本、无生成脚本。

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

## 工作流

- **读**：按本文件 → area → project → concept 的顺序跳转，双链即路径。
- **摄入**：源文档放 `inbox/`（保留原文，不删）；消化后**用自己的话**写成 `wiki/resources/concept/<主题>.md`，在相关 project 页挂双链。不复制原文、不建来源页副本。
- **完结**：project 交付物全部完成后 `status: completed`，`git mv` 进 `wiki/archives/`，同时更新本文件的领域地图。
