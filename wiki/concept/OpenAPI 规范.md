---
type: concept
title: "OpenAPI 规范"
created: 2026-08-07
updated: 2026-08-07
status: developing
tags:
  - concept
  - openapi
  - api-design
  - specification
related:
  - "[[RESTful API Design]]"
  - "[[JSON API Specification]]"
  - "[[API Styles]]"
complexity: intermediate
domain: backend
aliases:
  - OpenAPI Specification
  - OAS
  - Swagger 规范
  - OpenAPI 3.1
---

# OpenAPI 规范

本文基于 OpenAPI Initiative 的《OpenAPI Specification (v3.1)》（OAS 3.1.1，2024-10）梳理 OpenAPI 规范的核心架构与对象模型，作为 [[API Styles]] 项目 OpenAPI 风格对照的基石。

## 概述

> **总纲**：OpenAPI Specification（OAS）定义了一种**标准的、语言无关的 HTTP API 接口描述格式**，让人类和计算机都能在不访问源码、文档或网络流量的情况下理解服务能力。一份正确编写的 OpenAPI Description 可供文档生成、客户端/服务端代码生成、测试工具等多种场景消费。

- **前身**：Swagger 2.0（2015 年捐赠给 OpenAPI Initiative，Linux 基金会旗下）。
- **当前版本**：3.1.1（2024-10），3.1.0 发布于 2021-02。3.0.x 仍广泛使用。
- **格式**：JSON 或 YAML，推荐 YAML 1.2（兼容 JSON Schema 规则子集）。
- **Schema 基础**：Schema Object 是 JSON Schema 2020-12 的**超集**。

## 规范结构：根对象

一份 OpenAPI Document 的根必须是 **OpenAPI Object**，其固定字段如下：

| 字段 | 类型 | 必需 | 说明 |
| --- | --- | --- | --- |
| `openapi` | string | **是** | 规范版本号，如 `"3.1.1"`，用于工具链识别 |
| `info` | Info Object | **是** | API 元数据（标题、版本、描述、许可证等） |
| `jsonSchemaDialect` | string | 否 | 默认 `$schema` 方言 URI，覆盖 JSON Schema 默认值 |
| `servers` | [Server Object] | 否 | 目标服务器连接信息，默认 `[{"url": "/"}]` |
| `paths` | Paths Object | 否 | API 路径与操作 |
| `webhooks` | Map[string, Path Item] | 否 | 入站 webhook 描述（OAS 3.1 新增） |
| `components` | Components Object | 否 | 集中管理的可复用对象 |
| `security` | [Security Requirement] | 否 | 全局安全方案声明，操作级可覆盖 |
| `tags` | [Tag Object] | 否 | 标签元数据列表，用于组织操作 |
| `externalDocs` | External Doc Object | 否 | 额外外部文档链接 |

### Info Object

提供 API 元数据。核心字段：

- **`title`**（必需）：API 标题
- **`version`**（必需）：API 版本（区别于 OAS 规范版本号）
- `summary`：简短摘要
- `description`：详细描述（支持 CommonMark）
- `termsOfService`：服务条款 URI
- `contact`：联系人信息（name / url / email）
- `license`：许可证（`name` + `identifier` 或 `url`，二者互斥，推荐 SPDX identifier）

### Server Object

描述目标服务器。支持变量模板 `{variable}` 替换：

- **`url`**（必需）：目标主机 URL，可为相对路径
- `description`：主机描述（CommonMark）
- `variables`：服务器变量映射（enum / default / description）

典型用法：为开发、预发、生产环境各定义一个 Server Object，或通过变量 `{username}.gigantic-server.com:{port}/{basePath}` 支持多租户。

## 路径与操作

### Paths Object → Path Item Object

路径到操作的映射，字段名以 `/` 开头，支持**路径模板**（`{param}`）：

- 具体路径优先于模板路径匹配
- 同级不同名模板路径视为重复（非法）：`/pets/{petId}` 与 `/pets/{name}`

Path Item Object 描述单一路径上的可用 HTTP 方法：GET / PUT / POST / DELETE / OPTIONS / HEAD / PATCH / TRACE。外加 `$ref`（外部引用）、`summary` / `description`、`servers`（路径级覆盖）、`parameters`（路径级参数，操作级可覆盖但不可移除）。

### Operation Object

描述单个 API 操作。核心字段：

| 字段 | 说明 |
| --- | --- |
| `tags` | 逻辑分组标签 |
| `summary` / `description` | 操作摘要与详细说明 |
| `operationId` | 唯一标识（区分大小写，推荐编程命名规范） |
| `parameters` | 操作级参数（可覆盖路径级） |
| `requestBody` | 请求体（GET / HEAD / DELETE 语义不明确，应避免） |
| `responses` | 响应集合（**必须**包含至少一个响应码） |
| `callbacks` | 带外回调映射 |
| `deprecated` | 标记已弃用（默认 `false`） |
| `security` | 操作级安全方案覆盖（空数组可移除全局安全） |
| `servers` | 操作级服务器覆盖 |

### Responses Object

HTTP 状态码到 Response Object 的映射。支持：
- 具体状态码：`"200"`、`"404"`
- 范围通配：`"2XX"`、`"4XX"`（仅 1XX / 2XX / 3XX / 4XX / 5XX）
- `default`：未明确列出的所有响应

### Response Object

- **`description`**（必需）：响应描述
- `headers`：响应头定义
- `content`：响应体媒体类型映射
- `links`：设计时链接（指向其他操作的导航关系）

## 参数系统

### Parameter Object

参数由 `name` + `in`（位置）唯一标识。四种位置：

| `in` 值 | 说明 | 风格默认值 | 备注 |
| --- | --- | --- | --- |
| `path` | URL 路径参数 | `simple` | 必须 `required: true` |
| `query` | URL 查询参数 | `form` | 支持 `allowReserved` / `allowEmptyValue` |
| `header` | 请求头 | `simple` | 大小写不敏感；Accept / Content-Type / Authorization 被忽略 |
| `cookie` | Cookie 值 | `form` | 不推荐 `schema` 模式 |

参数序列化有两种模式：

1. **`schema` + `style`**：简单场景。`style` 控制 RFC6570 序列化方式，`explode` 控制数组/对象展开。
2. **`content`**：复杂场景。用 Media Type Object 定义媒体类型与 schema，推荐用于 header / cookie 参数。

### 序列化风格一览

| `style`          | RFC6570 等价 | 适用位置          | 示例（`color=blue`）      |        |
| ---------------- | ---------- | ------------- | --------------------- | ------ |
| `matrix`         | `;` 前缀     | path          | `;color=blue`         |        |
| `label`          | `.` 前缀     | path          | `.blue`               |        |
| `simple`         | 无运算符       | path, header  | `blue`                |        |
| `form`           | `?` 前缀     | query, cookie | `?color=blue`         |        |
| `spaceDelimited` | 无          | query         | `?color=blue%20black` |        |
| `pipeDelimited`  | 无          | query         | `?color=blue          | black` |
| `deepObject`     | 无          | query         | `?color[R]=100`       |        |

## Schema Object：JSON Schema 超集

Schema Object 是 OAS 规范的核心——定义所有输入输出数据类型。

### 与 JSON Schema 的关系

- **基础**：JSON Schema 2020-12 规范
- **OAS 扩展关键字**：`discriminator`、`xml`、`externalDocs`、`example`（已弃用，推荐 `examples`）
- **方言 URI**：`https://spec.openapis.org/oas/3.1/dialect/base`
- **兼容性**：Schema Object 可通过 `$schema` 切换到其他 JSON Schema 方言

### 常用 JSON Schema 关键字（OAS 上下文）

| 关键字 | 用途 |
| --- | --- |
| `type` | null / boolean / object / array / number / string / integer |
| `format` | OAS 额外定义 `int32`、`int64`、`float`、`double`、`password` |
| `properties` / `additionalProperties` | 对象属性定义与额外属性约束 |
| `required` | 必需属性列表 |
| `allOf` / `oneOf` / `anyOf` | 组合（allOf）、互斥（oneOf）、任一（anyOf） |
| `enum` / `const` | 枚举值 / 常量值 |
| `$ref` | URI 形式引用（内部 `#/components/schemas/...` 或外部文档） |
| `$dynamicRef` / `$dynamicAnchor` | 动态引用（支持泛型数据结构） |
| `contentMediaType` / `contentEncoding` | 二进制数据描述 |

### 多态：Discriminator Object

`discriminator` 与 `oneOf` / `anyOf` / `allOf` 配合，通过 `propertyName` 字段指定判别字段：

- **隐式映射**：判别字段的值 = schema 组件名
- **显式映射**：`mapping` 字段覆盖默认对应关系
- `discriminator` 不能改变验证结果——仅作为序列化 / 反序列化的"提示"

```yaml
MyResponseType:
  oneOf:
    - $ref: '#/components/schemas/Cat'
    - $ref: '#/components/schemas/Dog'
  discriminator:
    propertyName: petType
```

### 二进制数据

OAS 3.1 用 JSON Schema 关键字替代旧版 `format: binary` / `format: byte`：

| 场景 | `type` | `contentMediaType` | `contentEncoding` |
| --- | --- | --- | --- |
| 原始二进制 | *省略* | `image/png` | *省略* |
| 编码二进制 | `string` | `image/png` | `base64` / `base64url` |

## Components：可复用组件

Components Object 集中管理**十种**可复用组件，命名需匹配 `^[a-zA-Z0-9\.\-_]+$`：

| 组件键 | 类型 | 用途 |
| --- | --- | --- |
| `schemas` | Schema Object | 请求 / 响应体结构复用 |
| `responses` | Response Object | 常见响应复用（如 404、500） |
| `parameters` | Parameter Object | 常见参数复用（如分页参数） |
| `examples` | Example Object | 示例数据复用 |
| `requestBodies` | Request Body Object | 请求体复用 |
| `headers` | Header Object | 响应头复用 |
| `securitySchemes` | Security Scheme Object | 安全方案定义 |
| `links` | Link Object | 响应→操作的导航关系 |
| `callbacks` | Callback Object | 回调定义复用 |
| `pathItems` | Path Item Object | 路径项复用（OAS 3.1 新增） |

组件只有被显式引用时才会对 API 产生影响。

## 安全方案

### Security Scheme Object —— 五种类型

| `type` | 说明 | 关键字段 |
| --- | --- | --- |
| `apiKey` | API 密钥 | `name` + `in`（header / query / cookie） |
| `http` | HTTP 认证 | `scheme`（basic / bearer / digest 等）+ `bearerFormat` |
| `mutualTLS` | 双向 TLS（客户端证书） | — |
| `oauth2` | OAuth 2.0 | `flows`（四种流配置） |
| `openIdConnect` | OpenID Connect | `openIdConnectUrl`（Well-known URL） |

### OAuth 2.0 四种流

| 流 | 适用场景 | 推荐程度 |
| --- | --- | --- |
| `authorizationCode` | Web 应用 + PKCE | **首选** |
| `implicit` | 旧版 SPA | ⚠️ 即将弃用 |
| `password` | 高度信任客户端 | ❌ 不推荐 |
| `clientCredentials` | 服务间调用 | ✓ |

### 安全需求（Security Requirement Object）

将安全方案名称映射到所需 scope / role：
- 对象内多项 = **AND**（全部满足）
- 数组间多项 = **OR**（任一满足）
- 空对象 `{}` = 匿名访问

## 请求体与媒体类型

### Request Body Object

- **`content`**（必需）：媒体类型到 Media Type Object 的映射
- `description`：请求体描述
- `required`：是否必需（默认 `false`）

### Media Type Object

- `schema`：内容结构的 Schema Object
- `example` / `examples`：示例值（二者互斥，覆盖 schema 中的 example）
- `encoding`：属性级编码配置（仅用于 `multipart/form-data` 和 `application/x-www-form-urlencoded`）

### 文件上传

OAS 3.1 中文件上传用标准语义描述——特定媒体类型（`image/png`）或通用 `application/octet-stream`。多文件上传用 `multipart/form-data` + 数组 schema：

```yaml
requestBody:
  content:
    multipart/form-data:
      schema:
        properties:
          file:
            type: array
            items: {}
```

## 关键设计决策

### 多文档 OAD

OpenAPI Description 可由多个 JSON/YAML 文档组成：
- **入口文档**：解析起点，推荐命名为 `openapi.json` 或 `openapi.yaml`
- 通过 `$ref`、`operationRef`、Discriminator `mapping`（URI 形式）连接
- 隐式连接（Security Scheme 名称、`tags`、`operationId`）的解析为 **implementation-defined**

### URI vs URL

- **URI**（`$ref`、`externalDocs.url` 等）：作为**标识符**解析，可能与实际位置不同
- **URL**（`servers[].url` 等）：作为**位置**解析，支持相对引用

### 规范扩展

所有对象可通过 `x-` 前缀扩展自定义字段。`x-oai-` 和 `x-oas-` 保留给 OpenAPI Initiative。

### 富文本

`description` 字段支持 **CommonMark 0.27** Markdown。工具链必须至少支持该标准。

### 版本策略

- `major.minor.patch` 语义版本
- 工具链应**忽略 patch 版本**差异（3.1.0 与 3.1.1 等价）
- 小版本可能包含**非向后兼容**变更（当影响低、收益高时）

## Related

- OpenAPI Specification (v3.1) — 完整规范来源页
- [[RESTful API Design]] — RESTful API 通用设计最佳实践
- [[JSON API Specification]] — JSON:API 具体规范（不同于 OpenAPI 的通用性）
- [[API Styles]] — API 风格对比项目
- [[Backend Introduction]] — 后端入门路线
