---
address: c-000004
type: concept
title: "JSON:API"
created: 2026-08-02
updated: 2026-08-02
status: developing
tags:
  - concept
  - jsonapi
  - api-design
related:
  - "[[JSON API Recommendations]]"
  - "[[JSON API Specification]]"
  - "[[RESTful API Design]]"
sources:
  - "[[JSON API Recommendations]]"
complexity: intermediate
domain: web-api
aliases:
  - JSON API
  - jsonapi
---

# JSON:API

JSON:API 是一个用于构建 JSON 格式 API 的规范（specification），在 [jsonapi.org](https://jsonapi.org/) 维护，核心媒体类型为 `application/vnd.api+json`。它通过对文档结构、URL 设计、错误格式等做出约定，帮助客户端与服务器之间建立一致的接口。

## What is JSON:API?

JSON:API 规定了一种以“资源（resource）”为中心的文档格式：

- 每个资源是一个对象，包含 `type` 与 `id`（`type` 决定资源类型，`id` 唯一标识资源）。
- 资源的业务字段放在 `attributes` 对象中。
- 资源之间的关系放在 `relationships` 对象中。
- 相关链接放在 `links` 对象中。

规范约束的是文档的**结构**而非具体业务字段，因此把“如何组织数据”与“数据本身是什么”分离，让前后端可以独立演进。

## Core Document Structure

一个典型的 JSON:API 响应文档形如：

```json
{
  "data": {
    "type": "photos",
    "id": "1",
    "attributes": {
      "title": "Sunset",
      "width": 1200
    },
    "relationships": {
      "photographer": {
        "data": { "type": "people", "id": "9" }
      }
    },
    "links": {
      "self": "/photos/1"
    }
  }
}
```

顶层 `data` 可以是单个资源对象（单个结果）或资源对象数组（集合结果）。分页、相关资源等信息通过 `links` 提供。

## Naming Conventions

基础规范对成员（键）的命名有硬性限制；在基础限制之上，官方**建议**：

- 成员名**应该**使用驼峰命名法（`wordWordWord`）
- 成员名**应该**以 `a-z`（U+0061–U+007A）开头和结尾
- 成员名**应该**只包含 ASCII 字母数字（`a-z`、`A-Z`、`0-9`）

这些规则在混合不同来源的扩展配置（profiles）时尤其重要。

## URL Design

官方把整个 API 想象成一份“参考文档（reference document）”：资源按类型分组，每个资源按 ID 寻址。注意：参考文档里的集合是“集合（set）”，而传输文档里的集合是数组（因为顺序有意义）。

### Collection and Resource URLs

- 资源集合的 URL 由资源类型构成：`/photos`
- 单个资源的 URL 在集合 URL 后追加 ID：`/photos/1`

### Relationship and Related-Resource URLs

每个关系可以暴露两个 URL：

- **关系 URL（relationship URL）**：形如 `/photos/1/relationships/comments`，用于直接操作关系本身（例如从帖子中移除作者，而不删除 `people` 资源）。
- **相关资源 URL（related resource URL）**：形如 `/photos/1/comments`，获取时返回相关资源作为 primary data。

关系 URL 由 `/relationships/` + 关系名构成；相关资源 URL 由关系名直接追加构成。两者都不应作为资源自身的 `self` 链接。

## Filtering

基础规范对过滤策略保持中立，但**保留 `filter` 查询参数族**作为任何过滤策略的基础。官方建议将 `filter` 与关联名结合：

```
GET /comments?filter[post]=1 HTTP/1.1
GET /comments?filter[post]=1,2&filter[author]=12 HTTP/1.1
```

## Links in Responses

官方建议响应文档中尽可能包含：

- **顶层链接**：整个响应的 `self` 链接、分页链接。
- **资源级链接**：每个资源的 `self` 链接。
- **关系链接**：每个可用关系的 `self` 与 `related` 链接。

## Supporting Clients Without PATCH

部分客户端（如 IE8）不支持 `PATCH` 方法。建议服务器在客户端携带 `X-HTTP-Method-Override: PATCH` 请求头时，把 `POST` 当作 `PATCH` 处理。

## Date and Time Formatting

JSON:API 不强制日期时间格式，但建议服务器使用 **ISO 8601** 格式。

## Asynchronous Processing

当创建资源的操作耗时较长时，官方建议：

1. 请求返回 `202 Accepted`，并在 `Content-Location` 头给出任务链接。
2. 客户端轮询任务状态；未完成时返回 `200 OK`，可用 `Retry-After` 提示等待时间（`Retry-After: 0` 表示可立即重试）。
3. 任务完成时返回 `303 See Other`，并在 `Location` 头给出最终资源链接。

## Profiles

Profile（配置文件）允许文档发送者对其内容做出额外承诺，而不改变 JSON:API 规范的基本语义。例如，一个 profile 可以承诺“所有资源都带 `timestamps` 属性，且使用 ISO 8601 格式化”。

## Related

- [[JSON API Recommendations]] — 本次摄入的官方建议原文（英文原版 + 中文翻译）
- [[JSON API Specification]] — 基础规范（v1.1）中文讲解
- [[RESTful API Design]] — RESTful Web API 设计最佳实践
