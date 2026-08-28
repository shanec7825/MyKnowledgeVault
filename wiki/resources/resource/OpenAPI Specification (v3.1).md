---
type: source
address: c-000067
type: source
title: "OpenAPI Specification — Version 3.1.0"
created: 2026-08-07
updated: 2026-08-07
status: seed
source_type: webpage
author: "OpenAPI Initiative"
date_published: "2021-02-15"
url: "https://swagger.io/specification/"
source_id: "src-9e417d18b8353afec34b"
sha256: "7ab245829075b099ce52b8b82eec4d83f9a9dfbbcbb52a98b171e663f7311931"
authority: official
independence_key: "openapi-spec-v3.1"
review_state: active
key_claims:
  - "OpenAPI 规范（OAS）定义标准的、语言无关的 HTTP API 接口描述，让人类和计算机都能理解服务能力而无需访问源码、文档或网络流量。"
  - "Schema Object 是 JSON Schema 2020-12 的超集，增加 discriminator、xml、externalDocs、example 四个 OAS 特有关键字。"
  - "OpenAPI Document 必须以 openapi 字段声明规范版本号，根对象为 OpenAPI Object。"
  - "五种安全方案类型：apiKey、http、mutualTLS、oauth2、openIdConnect。"
  - "参数支持四种位置（path/query/header/cookie），序列化基于 RFC6570，支持 matrix/label/simple/form/spaceDelimited/pipeDelimited/deepObject 七种风格。"
  - "Components 对象集中管理十种可复用组件：schemas/responses/parameters/examples/requestBodies/headers/securitySchemes/links/callbacks/pathItems。"
  - "版本号采用 major.minor.patch 语义，工具链应忽略 patch 版本差异。"
tags:
  - source
  - openapi
  - api-design
---
