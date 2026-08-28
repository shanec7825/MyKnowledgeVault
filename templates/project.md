---
type: project
title: "{{title}}"
created: "{{date:YYYY-MM-DD}}"
updated: "{{date:YYYY-MM-DD}}"
status: active
area: ""
domain:
complexity: beginner
goal: ""
prerequisites: []
code: []
sources: []
related: []
tags:
  - project
---

# {{title}}

> [!info] 代码位置
> `D:/projects/<仓库名>/`（代码不入库，此处只记路径）

## 前置

**前置项目**：（填 frontmatter `prerequisites`）

**知识框架体系**：完成此项目需要掌握的知识结构 —— 概念层 / 技能层 / 工具层，各列要点并链接到 `wiki/resources/concept/`。

## 目标产出

> 一句话目标（同步到 frontmatter `goal`）

**交付物**：

- [ ] 具体交付物 1
- [ ] 具体交付物 2
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点

**核心内容**：这个项目要解决什么、覆盖什么，一两句话说清，让人不读正文也知道项目在干嘛。

**关键难点**：

- 真正的坎在哪——写「为什么这里难」，不是抄目录。

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
