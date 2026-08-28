---
type: meta
title: "Areas：长期关注的知识领域"
created: 2026-08-19
updated: 2026-08-28
tags:
  - meta
  - para
---

# Areas：长期关注的知识领域

在 PARA 中，`wiki/areas/` 放**没有结束条件的长期关注领域**，与 `wiki/projects/` 的区别是：

| | Projects | Areas |
|---|---|---|
| 例子 | 「两周内学完 MDN JS 核心并完成 20 个练习」 | 「JavaScript / 后端 / 认知科学」这类持续关注的主题 |
| 目标 | 有明确交付物和完成标准 | 只有方向，没有终点 |
| 状态 | `active → completed → archives` | 长期维护，定期修剪 |
| 文件 | `wiki/projects/` 下一个 project 一个 `.md` 平铺文件 | 一个领域一个 `.md`（现状）+ 一个同名 `.html`（成果） |

## 当前 Areas

| 领域 | 范围 | 现状页 | 成果页 |
|---|---|---|---|
| [[后端]] | 网络 / Web / 数据库 / 编程语言与协作开发 | `后端.md` | `后端.html` |
| [[人工智能]] | 机器学习入门与 minGPT 实践 | `人工智能.md` | `人工智能.html` |
| [[神经与认知科学]] | 认知科学 / 神经科学 / 学习方法论 | `神经与认知科学.md` | `神经与认知科学.html` |

## 一个领域两个文件

- **`.md` 管现在** —— 领域概览（特征 / 目标 / 范围）、进展概览（已知 / 未知）、进行中的项目。
- **`.html` 管成果** —— 已完结项目清单与相关图示，由 `python scripts/gen-area-html.py` 生成，勿手工编辑。

## 页面结构（严格照此，勿增删小节）

**Area 页**

1. `## 领域概览` — 特征 / 目标 / 范围
2. `## 进展概览` — `### 已知` + `### 未知`
3. `## 进行中的项目` — Dataview 自动

**Project 页**

1. `## 前置` — 前置项目 + 知识框架体系
2. `## 目标产出` — 一句话目标 + 交付物清单
3. `## 项目关键点` — 核心内容与关键难点
4. `## 自动关联` — 四个 Dataview，勿手工编辑

## 自动关联（勿手工维护）

| 关系 | 靠什么关联 | 出现在哪 |
|---|---|---|
| area → 进行中的 project | project 的 `area` = area 页文件名 | area 页「进行中的项目」 |
| project → 前置 / 后继 | project 的 `prerequisites` | project 页「自动关联」 |
| project → 概念与资源 | `sources` / `related` | project 页「自动关联」 |
| area → 已完结项目 | project 的 `area` + 位于 `archives/` | 同名 `.html` 成果页 |

代码仓库的对应关系见 [[wiki/meta/code-repos]]（project 的 `code` 字段自动生成）。

## 使用规则

1. **Projects 平铺**：`wiki/projects/` 下直接放 project 的 `.md` 文件，不再建子文件夹。一个项目一个文件；附属文档合并进项目文件作章节。
2. **新建 project 必须填 `area`**，否则它不会出现在任何 area 页里，等于消失。
3. 当某个 project 连续数周无进展、且不是「准备归档」时，降级为 area 或并入已有 area。
4. 领域性的知识页统一放 `wiki/resources/` 下按 `type` 分子目录：`resource/`（`type: source`）、`concept/`（`type: concept`）、`entity/`（`type: entity`）。
5. **Area 页不列概念、不列资源、不列已完结项目** —— 概念与资源靠 `resources/` 检索，已完结项目归 `.html` 成果页。
6. **代码不入库**：项目代码一律放 `D:/projects/<项目名>/`，在 project 的 `code` 字段登记路径。
7. 完成一个项目后：`status: completed` → 移入 `wiki/archives/` → 重跑 `scripts/gen-area-html.py`。
8. 新建 area 前先确认：这个主题是否已有 area 可归入。新建后复制 [[templates/area]]，无需改 Dataview 查询；再跑一次成果页脚本生成同名 `.html`。
