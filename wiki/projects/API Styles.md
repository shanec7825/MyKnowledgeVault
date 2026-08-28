---
address: c-000009
type: project
title: "API Styles"
created: 2026-08-02
updated: 2026-08-28
status: active
area: "后端"
domain: web-api
complexity: intermediate
goal: "梳理并对比主流 API 风格（REST / JSON:API 等），形成可复用的选型参考。"
prerequisites:
  - "[[wiki/projects/Backend Introduction|Backend Introduction]]"
sources:
  - "[[Web API Design Best Practices]]"
  - "[[JSON API Recommendations]]"
  - "[[JSON API Specification (v1.1)]]"
  - "[[OpenAPI Specification (v3.1)]]"
related:
  - "[[RESTful API Design]]"
  - "[[JSON API]]"
  - "[[JSON API Specification]]"
tags:
  - project
  - api-design
  - area/后端
---

# API Styles


## 前置
**前置项目**：[[Backend Introduction]]

**知识框架体系**：概念层（REST 资源模型、JSON:API 规范、OpenAPI、媒体类型与版本化策略）；技能层（设计 URI / 分页 / 过滤 / 关联、编写 OpenAPI 契约、按场景做风格选型）；工具层（OpenAPI 编辑器、JSON:API 服务端实现）。


## 目标产出
> 梳理并对比主流 API 风格（REST / JSON:API 等），形成可复用的选型参考。


**具体目标**：

- 梳理主流 API 风格：通用 REST 最佳实践、JSON:API 具体规范，以及后续补充（GraphQL、gRPC 等）。
- 提炼各风格的适用场景与优缺点，形成选型决策参考。

**交付物**：

- [ ] REST / JSON:API / OpenAPI 三页对照笔记（已有）
- [ ] GraphQL 与 gRPC 各一页对照笔记，并入对比维度表
- [ ] 《API 风格选型决策树》，可直接用于新项目选型

- [ ] -GraphQL 与 gRPC 各有一页对照笔记，并加入对比维度表
- [ ] -输出《API 风格选型决策树》，可直接用于新项目选型
- [ ] -项目内概念页与来源页互相链接，`wiki-lint` 无死链
- [ ] -全部完成后：`status: completed`，项目移入 `wiki/archives/`
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：把主流 Web API 风格放进同一组维度（数据格式 / 媒体类型 / 版本化 / 关联·分页·过滤）下对比，沉淀成可复用的设计与选型参考。

**关键难点**：

- 选型不是「哪个更好」而是「哪个更适合当前场景」，必须先明确使用场景再谈风格。
- 对比维度要统一，否则各说各话，对比表失去意义。
- GraphQL 的图查询与 gRPC 的 RPC 和 REST 是不同范式，不能硬塞进同一张表。


## 已覆盖的风格
- [[RESTful API Design]] — RESTful Web API 设计最佳实践（Azure 架构中心）
- [[JSON API]] — JSON:API 入门 + 官方建议
- [[JSON API Specification]] — JSON:API 基础规范 v1.1
- [[OpenAPI 规范]] — OpenAPI 规范核心架构（OAS 3.1，中文讲解）


## 对比维度（草稿）
| 风格       | 数据格式        | 媒体类型                       | 版本化                               | 关联 / 分页 / 过滤                          |
| -------- | ----------- | -------------------------- | --------------------------------- | ------------------------------------- |
| REST（通用） | JSON / XML  | `application/json` 等       | URI / query / header / media type | limit/offset、sort、fields、HATEOAS      |
| JSON:API | JSON        | `application/vnd.api+json` | 增量兼容（never remove）                | include、fields[TYPE]、sort、page、filter |
| OpenAPI  | JSON / YAML | any                        | URI / query / header / media type | $ref 复用、discriminator 多态、security 方案  |


## 待办
- [x] 补充 OpenAPI 风格对照
- [ ] 补充 GraphQL / gRPC 风格对照
- [ ] 制作风格选型决策树


## Related
- [[RESTful API Design]]
- [[JSON API]]
- [[JSON API Specification]]
- [[OpenAPI 规范]]


---


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
