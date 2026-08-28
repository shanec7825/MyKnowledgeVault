---
address: c-000008
type: concept
title: "RESTful Web API 设计最佳实践"
created: 2026-08-02
updated: 2026-08-02
status: developing
tags:
  - concept
  - api-design
  - rest
related:
  - "[[JSON API]]"
  - "[[JSON API Specification]]"
  - "[[Web API Design Best Practices]]"
sources:
  - "[[Web API Design Best Practices]]"
complexity: intermediate
domain: web-api
aliases:
  - RESTful API 设计
---

# RESTful API 设计最佳实践

本文基于 Microsoft Azure 架构中心的《Web API Design Best Practices》，梳理 RESTful Web API 设计的核心原则与实践。RESTful API 采用 Representational State Transfer（REST）架构原则，实现客户端与服务的**无状态**、**松散耦合**接口，并基于标准 HTTP 协议在资源上执行操作。

## 核心设计概念（URI / 资源表示 / 统一接口 / 无状态）

- **URI（资源标识）**：API 围绕资源组织，每个资源用唯一 URI 标识，如 `https://api.contoso.com/orders/1`。
- **资源表示（Resource representation）**：资源按特定格式（JSON / XML 等）编码并随 HTTP 传输；客户端用 URI 请求，服务返回资源的表示。
- **统一接口（Uniform interface）**：使用标准 HTTP 动词（`GET`、`POST`、`PUT`、`PATCH`、`DELETE`）对资源执行操作，从而获得松散耦合。
- **无状态请求模型（Stateless）**：HTTP 请求相互独立、顺序无关；状态只存放在资源本身，每个请求应是原子操作，从而支持高可扩展性。
- **超媒体链接（Hypermedia links）**：资源表示中可包含超媒体链接，驱动客户端导航到相关资源与可用操作。

## 资源 URI 设计

- 用**名词**（资源）而不是**动词**（操作）命名 URI：用 `/orders` 而不是 `/create-order`；HTTP 方法本身已表达动作。
- 集合 URI 用**复数名词**，并组织成层级：`/customers`、`/customers/5`，便于路由与直觉理解。
- 考虑资源间关系（如 `/customers/5/orders`），但避免过深的层级（如 `/customers/1/orders/99/products`）；优先用响应体里的超媒体链接导航相关资源。
- 避免"啰嗦的 API"（chatty API）：不要暴露大量小资源导致客户端多次请求；可在合理范围内反规范化、合并数据，同时权衡带宽与延迟。
- 不要让 API **镜像数据库内部结构**；把 API 当作数据库之上的抽象层，必要时加映射层，避免扩大攻击面与数据泄露风险。

## HTTP 方法

| 方法 | 语义 | 典型成功状态码 |
| --- | --- | --- |
| GET | 检索资源表示 | 200 / 204 / 404 |
| POST | 创建资源或提交处理 | 201（带 Location）/ 200 / 204 / 400 / 405 |
| PUT | 整体替换，存在则更新、必要时创建 | 200 / 201 / 204 / 409 |
| PATCH | 局部更新 | 200 / 400 / 409 / 415 |
| DELETE | 删除资源 | 204 / 404 |

- PUT 用于单个资源（整体替换）；是否允许"PUT 创建"取决于客户端能否可靠地预分配 URI，否则用 POST 创建、PUT/PATCH 更新。
- 媒体类型（MIME）：常用 `application/json`；`Content-Type` 声明请求/响应表示格式，`Accept` 声明客户端可接受的格式；不匹配时分别返回 `415 Unsupported Media Type` 与 `406 Not Acceptable`。

### PATCH 格式（JSON Patch / Merge Patch）

PATCH 的补丁文档格式由媒体类型决定，两种主流 JSON 格式：

- **JSON merge patch**（`application/merge-patch+json`）：结构与原资源相同，只含要改/增的字段；字段设为 `null` 表示删除。实现简单，但不适合原资源本身允许显式 `null` 值的情形。
- **JSON patch**（`application/json-patch+json`）：以操作序列表达（add / remove / replace / copy / test），更灵活，但更复杂。

## 异步方法

当 POST / PUT / PATCH / DELETE 需要长时间处理时：

- 立即返回 `202 Accepted`，在 `Location` 头给出状态端点 URI。
- 客户端轮询状态端点：处理中返回 `200 OK`，响应可含 `status`、预计完成时间或取消链接。
- 若异步操作创建了新资源，完成后状态端点返回 `303 See Other`，`Location` 指向新资源。

## 分页与过滤

- **分页**：用 `limit`（条数）与 `offset`（起点）查询参数，提供有意义的默认值（如 `limit=25&offset=0`）。
- **过滤**：允许客户端用查询字符串施加条件，如 `GET /orders?minCost=100&status=shipped`。
- **排序**：`sort` 参数，如 `sort=price`。
- **字段投影**：`fields` 参数返回指定字段，如 `fields=ProductID,Quantity`；API 必须校验字段可访问性，防止暴露未公开字段。
- **大二进制资源**：支持 `Accept-Ranges` / `Range` 范围请求（响应 `206 Partial Content` 与 `Content-Range`），并考虑 `HEAD` 请求让客户端先探查元信息。

## HATEOAS

HATEOAS（Hypertext as the Engine of Application State）是 REST 的核心能力：**每个响应都应包含导航到相关资源所需的超链接，以及每个资源上可用操作的信息**。系统本质是一个有限状态机，响应携带从一个状态转移到另一个状态所需的全部信息。

例如订单表示中的 `links` 数组，每个链接含 `rel`（关系）、`href`（URI）、`action`（HTTP 方法）与 `types`（支持的媒体类型），并可随资源状态变化而变化。

## 版本化

API 会随业务需求演进；版本化让新旧客户端共存。常见方案各有取舍：

- **不版本化**：只做增量（新增字段），适用于内部 API；破坏性变更需升级为显式版本化。
- **URI 版本化**：如 `/v2/customers/3`，简单直观，但随版本增多变得笨重，且与 HATEOAS 冲突（所有链接都要带版本号）。
- **查询字符串版本化**：如 `?version=2`，语义上同一 URI，但解析依赖服务端代码，同样影响 HATEOAS。
- **自定义头版本化**：如 `Custom-Header: api-version=2`，请求需带对应头；HATEOAS 链接也要带该头。
- **媒体类型版本化**：如 `Accept: application/vnd.contoso.v1+json`，最适合 HATEOAS，因为链接可携带 MIME 类型；不匹配时返回 `406 Not Acceptable`。

## 多租户

多租户 API 被多个组织共享，设计时应明确**租户如何在请求中被识别**：

- **子域名/DNS 隔离**：如 `adventureworks.api.contoso.com`，依赖 DNS 与反向代理，支持自定义域。
- **请求头**：如 `X-Tenant-ID`、`Host` 或 JWT claims；需要 L7 网关，注意缓存碎片化与跨租户数据泄露风险。
- **URI 路径**：如 `/tenants/adventureworks/orders/3`，实现直观但削弱 RESTful 设计、路由更复杂。

## 分布式追踪

在分布式/微服务架构中，用 `Correlation-ID`、`X-Request-ID`、`X-Trace-ID` 等头传播追踪上下文，实现端到端可观测性，便于定位故障、监控延迟、绘制服务依赖。

## Richardson 成熟度模型（RMM）

Leonard Richardson 在 2008 年提出，定义 Web API 的四个成熟度级别：

- **Level 0**：单一 URI，所有操作都是 POST（如 SOAP）。
- **Level 1**：为每个资源提供独立 URI，但还未真正 RESTful。
- **Level 2**：用 HTTP 方法定义资源操作——大多数公开 API 大致处于此级。
- **Level 3**：使用超媒体（HATEOAS）——按 Fielding 的定义才是真正 RESTful。

## OpenAPI

OpenAPI Initiative 标准化 REST API 描述（前身是 Swagger，后更名 OpenAPI Specification，OAS）。采用 OpenAPI 时：

- OAS 带一组对 REST 设计有观点的指南，利于互操作，但要求设计符合规范。
- 提倡**契约优先（contract-first）**：先设计接口契约，再实现代码。
- 工具（如 Swagger）可从契约生成客户端库或文档。

## Related

- [[JSON API]] — 一种具体 JSON 数据格式规范（区别于通用 REST 设计）
- [[JSON API Specification]] — JSON:API 基础规范 v1.1
- [[Web API Design Best Practices]] — 本文来源页
