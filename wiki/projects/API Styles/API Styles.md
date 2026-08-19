---
address: c-000009
type: project
title: "API Styles"
created: 2026-08-02
updated: 2026-08-19
status: developing
tags:
  - project
  - api-design
related:
  - "[[RESTful API Design]]"
  - "[[JSON API]]"
  - "[[JSON API Specification]]"
sources:
  - "[[Web API Design Best Practices]]"
  - "[[JSON API Recommendations]]"
  - "[[JSON API Specification (v1.1)]]"
  - "[[OpenAPI Specification (v3.1)]]"
goal: "梳理并对比主流 API 风格（REST / JSON:API 等），形成可复用的选型参考。"
domain: web-api
complexity: intermediate
---

# API Styles

**项目**：对比、沉淀主流的 Web API 设计风格，形成统一的设计与选型参考。

## 目标

- 梳理主流 API 风格：通用 REST 最佳实践、JSON:API 具体规范，以及后续补充（GraphQL、gRPC 等）。
- 提炼各风格的适用场景与优缺点，形成选型决策参考。

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

## 完成标准

- [ ] GraphQL 与 gRPC 各有一页对照笔记，并加入对比维度表
- [ ] 输出《API 风格选型决策树》，可直接用于新项目选型
- [ ] 项目内概念页与来源页互相链接，`wiki-lint` 无死链
- [ ] 全部完成后：`status: completed`，项目移入 `wiki/archives/`

## Related

- [[RESTful API Design]]
- [[JSON API]]
- [[JSON API Specification]]
- [[OpenAPI 规范]]
