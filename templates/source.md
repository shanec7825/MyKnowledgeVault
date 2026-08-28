---
address: c-000000
type: source
title: "{{title}}"
created: "{{date:YYYY-MM-DD}}"
updated: "{{date:YYYY-MM-DD}}"
status: active
author: ""
year:
url: ""
level: primary
tags:
  - source
sources: []
related: []
---

# {{title}}

> 来源页：记录原文，摘录关键论断，**不整篇复制**。放 `wiki/resources/resource/`。
> `address` 从 `wiki/meta/ledgers/source-ledger.json` 领取下一个编号。

- **出处**：作者（年份）。标题。期刊/站点。
- **URL**：
- **权威等级**：primary（一手） / secondary（综述二手） / tertiary（科普）

## 关键论断

- （原文主张，标注页码或章节）

## 我的判断

- （这条来源支撑或推翻了什么；可信度如何）

## 支撑了哪些页面

```dataview
LIST
FROM "wiki/projects" OR "wiki/resources/concept" OR "wiki/areas"
WHERE contains(sources, this.file.link) OR contains(related, this.file.link)
```
