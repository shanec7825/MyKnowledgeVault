---
type: concept
title: "JSON:API 基础规范（v1.1）"
created: 2026-08-02
updated: 2026-08-02
status: developing
tags:
  - concept
  - jsonapi
  - api-design
related:
  - "[[JSON API]]"
complexity: advanced
domain: web-api
aliases:
  - JSON:API 规范
  - JSON:API format
---

# JSON:API Specification (v1.1)

本文梳理 JSON:API **v1.1 基础规范**（https://jsonapi.org/format/）的核心规定。规范使用 RFC 2119 关键词（MUST / SHOULD / MAY 等），并承诺"只增不减"（never remove, only add）的向后兼容策略。

## 总览

JSON:API 规定客户端如何请求资源的获取与修改、服务器如何响应。它要求使用 `application/vnd.api+json` 媒体类型，并支持用 **extensions**（扩展）与 **profiles**（配置）进行扩展。

## 媒体类型与内容协商

- 客户端与服务器**必须（MUST）**在 `Content-Type` 中使用 JSON:API 媒体类型传输负载。
- 媒体类型参数只允许 `ext`（扩展）与 `profile`（配置），二者的值都是空格分隔的 URI 列表。
- 服务器对带未知参数或未知 `ext` URI 的请求应返回 `415 Unsupported Media Type`；`Accept` 头无法满足时返回 `406 Not Acceptable`。
- 扩展定义规范语义，配置文件定义实现语义；二者都**不能**删除或削弱基础规范语义。

## 文档结构

JSON:API 文档的顶层是一个 JSON 对象，**必须**包含 `data`、`errors`、`meta` 或扩展成员之一，且 `data` 与 `errors` 不得共存。

可选顶层成员：`jsonapi`（服务器实现信息）、`links`（文档级链接）、`included`（复合文档中的关联资源）。

### 资源对象

资源对象**必须**包含 `type` 和 `id`；例外是客户端新建资源时可省略 `id`，此时可用 `lid` 在文档内做局部唯一标识。可选成员：`attributes`、`relationships`、`links`、`meta`。

- `attributes` 与 `relationships` 统称"字段（fields）"，与 `type`、`id` 共用命名空间（不能重名）。
- 指向其他资源的键（如 `author_id`）**不应**作为 attribute，而应使用 relationship。
- relationship 对象至少包含 `links`、`data`、`meta` 或扩展成员之一。
- 资源标识符对象（resource identifier object）只含 `type` + `id`（新建时用 `lid`），可带 `meta`。

### 复合文档（Compound Documents）

服务器可在响应中连带返回相关资源，即"复合文档"。所有 included 资源**必须**放在顶层 `included` 数组中，且**必须**与 primary data 存在直接或间接的关系链（"完整 linkage"）。同一 `type` + `id` 在文档中只能出现一次。

### 成员命名规则

成员名区分大小写。全局允许 `a-z`、`A-Z`、`0-9` 及 U+0080 以上字符；`-`、`_`、空格可用但不能出现在首尾。``+ , . [ ] ! " # $ % & ' ( ) * / : ; < = > ? @ \ ^ ` { | } ~`` 及控制字符等**保留字符禁止**使用。成员名可以 `@` 开头（@-Member，属于实现语义）。扩展新增成员名必须用 `命名空间:` 前缀。

## 获取数据（Fetching）

资源与关系通过 `GET` 请求获取：

- 成功的资源/关系获取返回 `200 OK`；集合用数组或空数组，单个资源用资源对象或 `null`。
- 请求不存在的单个资源返回 `404 Not Found`（除非对应 URL 本可能返回 `null`）。
- 关系数据通过 relationship URL（`self`）获取，返回资源 linkage。

### 查询参数（include / fields / sort / page / filter）

- **`include`**：逗号分隔、点号分隔的关系路径，如 `?include=comments.author`；服务器不支持时返回 `400 Bad Request`。
- **`fields[TYPE]`**（稀疏字段集）：按类型限制返回字段，如 `?fields[articles]=title,body`。
- **`sort`**：逗号分隔多字段，`-` 前缀表示降序，如 `?sort=-created,title`。
- **`page`**：`page` 查询参数族保留给分页；分页链接键为 `first` / `last` / `prev` / `next`。
- **`filter`**：`filter` 查询参数族保留给过滤；策略由服务器自定。

## 创建、更新、删除（CRUD）

- **创建**：`POST` 到集合 URL，请求体为单个资源对象；成功且服务器改动资源时返回 `201 Created`（含 `Location` 头），成功且未改动时可返回 `204 No Content`，接受异步处理返回 `202 Accepted`。客户端可提交 UUID 形式的自定义 `id`；`id` 已存在时返回 `409 Conflict`。
- **更新**：`PATCH` 到资源 URL，请求体含 `type` 与 `id`。缺失的 attribute / relationship 按"保持现值"解释，**不得**解释为 `null`。独立更新关系到关系 URL（to-one 用 `PATCH`，to-many 可用 `PATCH` / `POST` / `DELETE`）。
- **删除**：`DELETE` 到资源 URL，成功返回 `204 No Content` 或 `200 OK`。
- 任何请求**必须**整体成功或整体失败，不允许部分更新。

## 错误对象

错误对象在顶层 `errors` 数组中返回。每个错误对象可包含 `id`、`links`（`about` / `type`）、`status`、`code`、`title`、`detail`、`source`（`pointer` / `parameter` / `header`）、`meta`，且**必须**至少包含其中一个成员。

## Related

- [[JSON API]] — JSON:API 入门与官方建议（中文讲解）
- JSON API Recommendations — 官方建议原文
- JSON API Specification (v1.1) — 基础规范来源页
