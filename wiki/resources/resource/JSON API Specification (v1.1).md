---
address: c-000005
type: source
title: "JSON:API — Latest Specification (v1.1)"
created: 2026-08-02
updated: 2026-08-02
status: seed
source_type: webpage
author: ""
date_published: ""
url: "https://jsonapi.org/format/"
source_id: "src-642854a6e0721e6b87b1"
sha256: "002613f7a74521d0adf68363d5f3b8c7664718cb0aa12a931ae36a814a3ff310"
authority: official
independence_key: "jsonapi-spec-v1.1"
review_state: active
key_claims:
  - "JSON:API 要求使用 application/vnd.api+json 媒体类型。"
  - "文档顶层必须包含 data/errors/meta 之一，data 与 errors 不能共存。"
  - "资源对象必须包含 type 与 id（新建时可用 lid）。"
  - "include、fields[TYPE]、sort、page、filter 是规范查询参数。"
  - "创建用 POST、更新用 PATCH、删除用 DELETE。"
tags:
  - source
  - jsonapi
  - api-design
---

# JSON:API — Latest Specification (v1.1)

- **来源**：[https://jsonapi.org/format/](https://jsonapi.org/format/)
- **权威性**：official（JSON:API 官方规范）
- **摄入文件**：`inbox/JSONAPI — Latest Specification (v1.1).md`
- **摄入日期**：2026-08-02

这是 JSON:API 基础规范 v1.1（官方最新版），规定媒体类型、内容协商、文档结构、资源对象、成员命名、数据获取（include / fields / sort / page / filter）、CRUD、错误对象等核心语义。

## Related

- [[JSON API Specification]] — 概念页（中文讲解）
- [[JSON API]] — JSON:API 入门
