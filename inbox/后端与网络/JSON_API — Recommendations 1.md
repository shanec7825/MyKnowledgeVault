---
title: "JSON:API — Recommendations"
source: "https://jsonapi.org/recommendations/"
author:
published:
created: 2026-08-02
description:
tags:
  - "clippings"
---
---
title: "JSON:API — 建议"
source: "https://jsonapi.org/recommendations/"
author:
published:
created: 2026-08-02
description:
tags:
  - "clippings"
---

## 建议

本节包含对 JSON:API 实现的建议。这些建议旨在基础 JSON:API 规范范围之外的领域建立一定程度的统一性。

## 命名

规范对 JSON:API 文档中成员（即键）的命名方式施加了某些[硬性限制](http://jsonapi.org/format/#document-member-names)。为了进一步标准化成员名称（当混合使用由不同方编写的配置文件时，这一点尤为重要），还建议遵循以下规则：

- 成员名称**应该**使用驼峰命名法（即 `wordWordWord`）
- 成员名称**应该**以字符 “a-z”（U+0061 到 U+007A）开头和结尾
- 成员名称**应该**仅包含 ASCII 字母数字字符（即 “a-z”、“A-Z” 和 “0-9”）

## URL 设计

### 参考文档

在确定 API 的 URL 结构时，将其所有资源视为存在于一个单一的“参考文档”中会很有帮助，在该文档中，每个资源都可以通过唯一路径进行寻址。在此文档的顶层，资源按类型分组。在这些有类型的集合中，单个资源以 ID 为键。根据上述资源对象结构，单个资源内的属性和链接具有唯一的寻址方式。

参考文档的概念用于为资源及其关系确定合适的 URL。重要的是要理解，由于目标和约束不同，此参考文档在结构上与用于传输资源的文档略有不同。例如，参考文档中的集合表示为集合（sets），因为成员必须能通过 ID 寻址；而在传输文档中，集合表示为数组，因为顺序很重要。

### 资源集合的 URL

建议资源集合的 URL 由资源类型构成。

例如，类型为 `photos` 的资源集合将具有以下 URL：

```
/photos
```

### 单个资源的 URL

将资源集合视为以资源 ID 为键的集合。单个资源的 URL 可以通过将资源 ID 附加到集合 URL 来构成。

例如，ID 为 `"1"` 的照片将具有以下 URL：

```
/photos/1
```

### 关系 URL 和相关资源 URL

如基础规范中所述，每个关系可以暴露两个 URL：

- “关系 URL” - 关系本身的 URL，在关系的 `links` 对象中使用 `self` 键标识。此 URL 允许客户端直接操作关系。例如，它允许客户端从 `post` 中移除 `author`，而无需删除 `people` 资源本身。
- “相关资源 URL” - 相关资源的 URL，在关系的 `links` 对象中使用 `related` 键标识。获取时，它返回相关资源对象作为响应的主要数据。

建议通过将 `/relationships/` 和关系名称附加到资源 URL 来构成关系 URL。

例如，照片的 `comments` 关系将具有以下 URL：

```
/photos/1/relationships/comments
```

而照片的 `photographer` 关系将具有以下 URL：

```
/photos/1/relationships/photographer
```

建议通过将关系名称附加到资源 URL 来构成相关资源 URL。

例如，照片的 `comments` 的 URL 将为：

```
/photos/1/comments
```

而照片的 `photographer` 的 URL 将为：

```
/photos/1/photographer
```

因为这些 URL 代表关系中的资源，所以不应将它们用作资源本身的 `self` 链接。相反，在构成 `self` 链接时，仍应应用有关单个资源 URL 的建议。

## 过滤

基础规范对服务器支持的过滤策略保持中立。`filter` 查询参数族被保留用作任何过滤策略的基础。

建议希望支持基于关联对资源集合进行过滤的服务器，允许使用将 `filter` 与关联名称结合的查询参数。

例如，以下是请求与特定帖子关联的所有评论：

```
GET /comments?filter[post]=1 HTTP/1.1
```

多个过滤值可以在逗号分隔的列表中组合。例如：

```
GET /comments?filter[post]=1,2 HTTP/1.1
```

此外，可以将多个过滤器应用于单个请求：

```
GET /comments?filter[post]=1,2&filter[author]=12 HTTP/1.1
```

## 包含顶层、资源级别和关系链接

基础规范对于是否在资源响应中包含链接保持中立。但是，建议在响应文档中包含以下链接：

- **顶层链接**，如指向整个响应的 self 链接，以及相对分页链接（如果适用）。
- **资源级别链接**，如每个资源的 self 链接（如果资源是集合的一部分，则与顶层链接不同）。
- 资源的所有可用关系的**关系链接**。

例如，对评论集合的请求可能会引发以下响应：

```
GET /comments HTTP/1.1

{
  "data": [{
      "type": "comments",
      "id": "1",
      "attributes": {
          "text": "HATEOS are the thing!"
      },
      "links": {
          "self": "/comments/1"
      },
      "relationships": {
        "": {
          "links": {
            "self": "/comments/1/relationships/author",
            "related": "/comments/1/author"
          }
        },
        "articles": {
          "links": {
            "self": "/comments/1/relationships/articles",
            "related": "/comments/1/articles"
          }
        }
      }
  }],
  "links": {
      "self": "/comments"
  }
}
```

## 支持不支持 PATCH 的客户端

某些客户端（如 IE8）不支持 HTTP 的 `PATCH` 方法。建议希望支持这些客户端的 API 服务器在客户端包含 `X-HTTP-Method-Override: PATCH` 头时，将 `POST` 请求视为 `PATCH` 请求。这允许不支持 `PATCH` 的客户端只需添加该请求头即可让其更新请求得到执行。

## 格式化日期和时间字段

尽管 JSON:API 未指定日期和时间字段的格式，但建议服务器遵循 ISO 8601。[此 W3C NOTE](http://www.w3.org/TR/NOTE-datetime) 提供了推荐格式的概述。

## 异步处理

考虑这样一种情况：你需要创建一个资源，而该操作需要很长时间才能完成。

```
POST /photos HTTP/1.1
```

该请求**应该**返回 `202 Accepted` 状态，并在 `Content-Location` 头中包含一个链接。

```
HTTP/1.1 202 Accepted
Content-Type: application/vnd.api+json
Content-Location: https://example.com/photos/jobs/5234

{
  "data": {
    "type": "jobs",
    "id": "5234",
    "attributes": {
      "status": "Pending request, waiting other process"
    },
    "links": {
      "self": "/photos/jobs/5234"
    }
  }
}
```

为了检查作业进程的状态，客户端可以向之前给定的位置发送请求。

```
GET /photos/jobs/5234 HTTP/1.1
Accept: application/vnd.api+json
```

对于仍在等待中的作业请求，**应该**返回 `200 OK` 状态，因为服务器正在成功报告状态。作为可选项，服务器可以返回 `Retry-After` 头，以指导客户端在再次检查之前应等待多长时间。建议在 1 秒内重试可以通过 `Retry-After: 0` 来实现。

```
HTTP/1.1 200 OK
Content-Type: application/vnd.api+json
Retry-After: 10

{
  "data": {
    "type": "jobs",
    "id": "5234",
    "attributes": {
      "status": "Pending request, waiting other process"
    },
    "links": {
      "self": "/photos/jobs/5234"
    }
  }
}
```

当作业进程完成时，请求**应该**返回 `303 See other` 状态，并在 `Location` 头中包含一个链接。

```
HTTP/1.1 303 See other
Content-Type: application/vnd.api+json
Location: https://example.com/photos/4577
```

## 编写配置文件

配置文件是一种机制，文档发送者可以使用它来对其内容做出承诺，而无需添加或更改 JSON:API 规范的基本语义。例如，配置文件可以指示所有资源对象都将具有一个 `timestamps` 属性字段，并且 `timestamps` 对象的成员将使用 ISO 8601 日期时间格式进行格式化。

配置文件是这些承诺的独立规范。以下示例说明了如何编写上述配置文件：

```
# Timestamps profile

## Introduction

This page specifies a profile for the `application/vnd.api+json` media type,
as described in the [JSON:API specification](http://jsonapi.org/format/).

This profile allows every resource in a JSON:API document to represent
significant timestamps in a consistent way.

## Document Structure

Every resource object **MUST** include a `timestamps` member in its associated
`attributes` object. If this member is present, its value **MUST** be an object that
**MAY** contain at least one of the following members:

* `created`
* `updated`

The value of each member **MUST** comply with the variant of ISO 8601 used by
JavaScript's `JSON.stringify` method to format Javascript `Date` objects.
```