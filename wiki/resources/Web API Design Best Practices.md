---
address: c-000007
type: source
title: "Web API Design Best Practices — Azure Architecture Center"
created: 2026-08-02
updated: 2026-08-02
status: seed
source_type: webpage
author: ""
date_published: ""
url: "https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design"
source_id: "src-e9fef744a1c563d1a4e9"
sha256: "2bcc4abd7c010533f8748fce7e2ae49816afa42dd0171abe3ebbbf19458ff1c5"
authority: official
independence_key: "azure-api-design-best-practices"
review_state: active
key_claims:
  - "RESTful API 的 URI 应以名词表示资源，避免动词。"
  - "GET/POST/PUT/PATCH/DELETE 对应检索、创建、整体更新、局部更新、删除。"
  - "耗时操作应返回 202，并提供状态端点。"
  - "分页用 limit/offset，过滤、排序、字段投影各有参数。"
  - "HATEOAS 让响应携带导航所需超链接。"
  - "Richardson 成熟度模型定义 0-3 级。"
tags:
  - source
  - api-design
  - rest
---

# Web API Design Best Practices — Azure Architecture Center

- **来源**：[https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- **权威性**：official（Microsoft Azure 架构中心官方文档）
- **摄入文件**：`inbox/Web API Design Best Practices - Azure Architecture Center.md`
- **摄入日期**：2026-08-02

Microsoft Azure 架构中心关于 RESTful Web API 设计的最佳实践，涵盖 URI 设计、HTTP 方法、异步方法、分页与过滤、HATEOAS、版本化、多租户、分布式追踪、Richardson 成熟度模型与 OpenAPI。

## Related

- [[RESTful API Design]] — 概念页（中文讲解）
- [[JSON API]] — JSON:API（一种具体格式规范）
