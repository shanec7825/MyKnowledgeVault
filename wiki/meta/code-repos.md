---
type: meta
title: "代码仓库映射"
created: 2026-08-28
updated: 2026-08-28
tags:
  - meta
  - code
---

# 代码仓库映射

> **原则：代码留在库外（`D:/projects/<项目名>/`），本库只存指针（project 的 `code:` 字段）与认知产出。**
> 需要引用代码时贴关键片段并注明源文件相对路径，禁止整份拷贝进库。

## 已关联代码的 project

> 自动生成：来自 `wiki/projects/` 中声明了 `code:` 的笔记。新增关联只需在 project 的 frontmatter 填 `code: ["D:/projects/xxx"]`。

```dataview
TABLE code AS 代码路径, area AS 领域, status AS 状态
FROM "wiki/projects"
WHERE code AND code[0]
SORT area ASC
```

## 已完结项目的代码

```dataview
TABLE code AS 代码路径, updated AS 完成于
FROM "wiki/archives"
WHERE code AND code[0]
SORT updated DESC
```

## D:/projects 目录清单

> 手工维护。扫描时间：2026-08-28。
> 「已认领」= 本库有对应 project 笔记；「待认领」= 有代码但库里没有笔记，需要时新建 project 页并填 `code`。

| 目录 | 线索 | 状态 |
|---|---|---|
| `animodoll-cloud` | Kotlin/Ktor 后端 | 已认领 → [[wiki/projects/animo-cloud]] |
| `animodoll` | 含 `animo-doll`、`animodoll-cloud` 子目录 | 已认领（同上） |
| `JavaScript基础` | HTML 练习文件 | 已认领 → [[wiki/projects/JavaScript指南]] |
| `minGPT`（库内 `.raw/repos/`） | 教学用 GPT 实现 | 已认领 → [[wiki/projects/minGPT教学方案]] |
| `SocraticLearningPartner` | 有 `CLAUDE.md`、`LICENSE`，完整项目 | 待认领 |
| `SLP4` | 有 `README.md`、`PROGRESS.md`、`backend/` | 待认领（疑为 SLP 第 4 版） |
| `SLP3` | 仅 `新建文件夹` | 待认领 |
| `新建文件夹` | 有 `PROGRESS.md`、`backend/` | 待认领（疑与 SLP4 重复，待确认） |
| `Being of Me` | git 仓库，有 `CHANGELOG.md`、`data/` | 待认领 |
| `Caching Proxy` | 仅 `.git` | 待认领 |
| `HealthMap` | 前端项目（HTML/CSS/JS） | 待认领 |
| `HotKeysMap` | Python（`run.py`）+ `core/`、`data/` | 待认领 |
| `Learning-React` | 空目录 | 待认领 |
| `Make$` | 调研报告 md | 待认领（非代码，可能是调研） |
| `TextbookHelper` | JS 前端 | 待认领 |
| `UniTracker` | `index.html.html`、`tem.c` | 待认领 |
| `voiceAgent` | git 仓库，`main/` | 待认领 |
| `ai videos` | `out/`、`source/`、`tools/` | 待认领 |
| `vs-demo` | C++（VS + easyx） | 待认领 |
| `中国风建筑建模` | Node 项目（`node_modules/`、`dist/`） | 待认领 |
| `贪吃蛇` | C 语言多个版本 | 待认领 |
| `贪吃蛇图形化` | C++（VS 工程） | 待认领 |
| `贪吃蛇图形化_new` | C++ + raylib | 待认领 |

## 认领流程

1. 在 `wiki/projects/` 用 [[templates/project]] 新建项目页；
2. frontmatter 填 `area`（归入哪个领域）与 `code: ["D:/projects/<目录名>"]`；
3. 回到上表把该目录状态改为「已认领 → 链接」。

## 清理候选

- `Learning-React`（空目录）、`SLP3`（仅空文件夹）— 确认无用后可删除。
- `新建文件夹` — 与 `SLP4` 内容高度相似，建议确认后合并并改名。
