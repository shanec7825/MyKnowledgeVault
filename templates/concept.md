---
type: concept
title: "{{title}}"
created: "{{date:YYYY-MM-DD}}"
updated: "{{date:YYYY-MM-DD}}"
status: developing
tags:
  - concept
sources: []
related: []
---

# {{title}}

> 概念页：用自己的话把一件事讲清楚，能脱离原文独立读懂。放 `wiki/resources/concept/`。

## 一句话定义

## 为什么需要它

## 核心内容

## 与其他概念的关系

## 出处

```dataview
LIST
FROM "wiki/resources/resource"
WHERE contains(related, this.file.link)
```

## 被谁引用

```dataview
LIST
FROM "wiki/projects" OR "wiki/areas" OR "wiki/resources/concept"
WHERE contains(related, this.file.link) OR contains(sources, this.file.link)
```
