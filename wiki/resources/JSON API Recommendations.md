---
address: c-000003
type: source
title: "JSON:API — Recommendations"
created: 2026-08-02
updated: 2026-08-02
status: seed
source_type: webpage
author: ""
date_published: ""
url: "https://jsonapi.org/recommendations/"
source_id: "src-2dd7698c435fc893adfc"
sha256: "8318e4b8c84f021e5fecc8e3bc608a56687646616ad52694fc1ceb80c40123bc"
authority: official
independence_key: "jsonapi-recommendations"
review_state: active
key_claims:
  - "JSON:API 成员名建议使用 camelCase 且仅含 ASCII 字母数字。"
  - "集合 URL 由资源类型构成，单个资源 URL 追加 ID。"
  - "关系 URL 追加 /relationships/{name}，相关资源 URL 追加 {name}。"
  - "filter 查询参数族保留给过滤策略使用。"
  - "异步操作建议 202/200/303 状态码配合 Content-Location 与 Location。"
tags:
  - source
  - jsonapi
  - api-design
---

# JSON:API — Recommendations

- **来源**：[https://jsonapi.org/recommendations/](https://jsonapi.org/recommendations/)
- **权威性**：official（JSON:API 官方推荐）
- **摄入文件**：`inbox/JSON_API — Recommendations.md`（英文原版）、`inbox/JSON_API — Recommendations 1.md`（中文翻译）
- **摄入日期**：2026-08-02

官方针对基础 JSON:API 规范范围之外、需要统一做法的领域给出建议，涵盖命名、URL 设计、过滤、链接、PATCH 降级、日期格式、异步处理与 Profiles。

## Related

- [[JSON API]] — 概念页（中文讲解）
