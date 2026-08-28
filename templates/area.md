---
type: area
title: "{{title}}"
created: "{{date:YYYY-MM-DD}}"
updated: "{{date:YYYY-MM-DD}}"
status: active
tags:
  - area
related: []
---

# {{title}}

> 已完结项目与相关图示见同名页面 **`{{title}}.html`**（由 `scripts/gen-area-html.py` 生成，勿手工编辑）。
> 新建 area 后记得跑一次该脚本。

## 领域概览

**特征**：这个领域最突出的性质是什么（推进方式、难点、与其他领域的差异）。

**目标**：

> 聚焦**最核心、最长远**的那个目标——它要能回答「十年后我为什么还在乎这个领域」，用宏观视角写成一段，而不是列任务清单。具体任务交给「未知」和 project。

**范围**：子主题 A · 子主题 B · 子主题 C。

## 进展概览

### 已知

- **主题** — 已经掌握 / 已经做完的部分，一句话 + 支撑材料。

### 未知

- [ ] 还没学、还没弄明白的部分。

## 进行中的项目

> 自动生成：project 的 frontmatter `area: {{title}}` 即出现在此（DataviewJS，硬编码领域名）。勿手工维护。

```dataviewjs
const AREA = "{{title}}";
const rows = dv.pages('"wiki/projects"')
  .where(p => p.area === AREA && p.status !== "completed")
  .sort(p => p.updated, "desc")
  .map(p => [p.file.link, p.goal || "", p.status || "", p.updated || ""]);
dv.table(["项目", "交付主线", "状态", "更新"], rows);
```
