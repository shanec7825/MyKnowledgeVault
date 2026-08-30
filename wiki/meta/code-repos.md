---
type: meta
title: "代码与交付工作区映射"
created: 2026-08-28
updated: 2026-08-30
tags:
  - meta
  - code
  - delivery
---

# 代码与交付工作区映射

> **原则：代码与交付成果留在库外（`D:/Projects/<项目>/`），本库只存指针（project 的 `code:` 字段与下表）与认知产出。**
> 需要引用代码时贴关键片段并注明源文件相对路径，禁止整份拷贝进库。
> 每个项目的交付工作区统一结构：`README.md`（交付目标 / 清单 / 进度）+ `archive/`（过时版本）+ 成果文件。

## 活跃项目映射（16 个）

| 项目 | 交付工作区（D:/Projects） | 代码仓库 | 备注 |
| --- | --- | --- | --- |
| [[wiki/projects/Backend Introduction\|Backend Introduction]] | `Backend Introduction/` | — | `后端入门路线.md` 起草处 |
| [[wiki/projects/HTTP\|HTTP]] | `HTTP/` | — | 速查 / 判定表 / 缓存笔记 / 实操记录；`http输出笔记.md` 为个人笔记 |
| [[wiki/projects/API Styles\|API Styles]] | `API Styles/` | — | 选型决策树 + GraphQL / gRPC 对照 |
| [[wiki/projects/Relational Databases\|Relational Databases]] | `Relational Databases/` | 自建（psql 练习） | `exercises/` 三组 SQL + 选型对照表 |
| [[wiki/projects/pythonBasics\|pythonBasics]] | `pythonBasics/` | 自建 | `exercises/` 三组练习 + `scripts/` 既有脚本 |
| [[wiki/projects/JavaScript指南\|JavaScript指南]] | `JavaScript基础/` | 自建 | `exercises/` 20 计划（12 已解锁）；另有手写 HTML 练习 |
| [[wiki/projects/animo-cloud\|animo-cloud]] | `animo-cloud/` | `animodoll/animodoll-cloud/`（Kotlin/Ktor） | 链路默画 + 联调核查模板；仓库在 `animodoll` 仓库内 |
| [[wiki/projects/harness开发学习主线\|harness开发学习主线]] | `harness开发学习主线/` | `D:/deepseek-harness` | `阶段笔记/`；权威入口是仓库 `AGENTS.md` |
| [[wiki/projects/What is ML and its types\|What is ML and its types]] | `What is ML and its types/` | — | 机器学习类型对照表 |
| [[wiki/projects/minGPT教学方案\|minGPT教学方案]] | `minGPT教学方案/` | 库内 `.raw/repos/minGPT/`（Obsidian 忽略） | 最终小 GPT 交付在 `小GPT/`；阶段笔记在仓库 `notes/` |
| [[wiki/projects/学习方法的认知科学验证\|学习方法的认知科学验证]] | `学习方法的认知科学验证/` | — | `研究档案报告.md` 结论页草稿 |
| [[wiki/projects/类比于强化学习和深度学习的学习理论\|类比于强化学习和深度学习的学习理论]] | `类比于强化学习和深度学习的学习理论/` | — | 同上 |
| [[wiki/projects/认知表征与泛化\|认知表征与泛化]] | `认知表征与泛化/` | — | 同上 |
| [[wiki/projects/神经可塑性\|神经可塑性]] | `神经可塑性/` | — | 同上（含争议点清单） |
| [[wiki/projects/环境变化与认知\|环境变化与认知]] | `环境变化与认知/` | — | 同上（含环境优化建议） |
| [[wiki/projects/How To Do Great Work\|How To Do Great Work]] | `How To Do Great Work/` | — | 交付物已在 wiki（原文 / 要点 / 单词），D 区记进度 |

## 已归档项目的代码

| 项目 | 位置 | 完成于 |
| --- | --- | --- |
| [[wiki/archives/tasksTracker/Task Tracker CLI\|Task Tracker CLI]] | Python CLI（原仓库路径随归档） | 见归档页 |

## D:/Projects 待认领目录

> 「待认领」= 有实际内容但库里没有 project 页；需要时新建项目页并回填本表。扫描：2026-08-30。

| 目录 | 线索 | 状态 |
| --- | --- | --- |
| `Caching Proxy` | 仅 `.git`；roadmap.sh 项目想法已剪藏在 `inbox/后端与网络/` | 待认领（与 HTTP 项目缓存主题联动） |
| `Node.js/` | HTTP 事务笔记、http.js、server.js（2026-08-30 新建） | 待认领（疑属 JavaScript指南 / harness 补课产出） |
| `English Learning Teaching/` | 英语教学视频配音调研 + pipeline（2026-08-30 新建） | 待认领 |
| `informationFinding/` | Python + frontend 信息检索工具（2026-08-30 新建） | 待认领 |
| `Make$/` | 两份调研报告 md | 待认领（非代码） |
| `SocraticLearningPartner` / `SLP4` / `SLP3` / `新建文件夹` | SLP 系列多个版本 | 待认领（疑重复，先理版本再建页） |
| `Being of Me` | git 仓库 | 待认领 |
| `HealthMap` / `HotKeysMap` / `TextbookHelper` / `UniTracker` | 前端 / Python 小项目 | 待认领 |
| `voiceAgent` / `ai videos` / `vs-demo` / `中国风建筑建模` | 各类项目 | 待认领 |
| `贪吃蛇` / `贪吃蛇图形化` / `贪吃蛇图形化_new` | C / C++ 练习 | 待认领 |

## 认领流程

1. 在 `wiki/projects/` 新建项目页（frontmatter 填 `area` 与 `code: ["D:/Projects/<目录名>"]`）；
2. 在 `D:/Projects/<目录名>/` 建交付工作区：`README.md`（交付目标 / 交付物清单）+ `archive/`；
3. 回填本表状态列「已认领 → 链接」，并更新 OVERVIEW.md 领域地图与所属 area 页。

## 清理候选（动前先确认）

- `Learning-React`（空目录）、`SLP3`（仅空文件夹）— 确认无用后可删。
- `新建文件夹` — 与 `SLP4` 内容高度相似，建议确认后合并并改名。
