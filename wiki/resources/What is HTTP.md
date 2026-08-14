---
address: c-000020
type: source
title: "What is HTTP?"
created: 2026-08-05
updated: 2026-08-05
status: seed
source_type: webpage
url: "https://www.cloudflare.com/learning/ddos/glossary/hypertext-transfer-protocol-http/"
source_id: "src-b83f0474abdd7c25a8c4"
sha256: "3e7eba4359f644fd8b7d8c48c68accba5a054840f723a261cca11d2508528a4c"
authority: official
independence_key: "cloudflare-http-glossary"
review_state: active
key_claims:
  - "HTTP 是应用层协议，基于超文本链接加载网页，是万维网的基础。"
  - "HTTP 请求包含：版本、URL、方法、请求头、可选请求体；响应包含：状态码、响应头、可选响应体。"
  - "状态码为 3 位数字，分 5 类：1xx 信息 / 2xx 成功 / 3xx 重定向 / 4xx 客户端错误 / 5xx 服务器错误。"
  - "HTTP 是无状态协议；HTTP/1.1 起持久连接允许多个请求复用同一 TCP 连接。"
  - "大量 HTTP 请求可构成应用层（L7）DDoS 攻击。"
tags:
  - source
  - tutorial
  - http
  - networking
---

# What is HTTP?

- **来源**：[Cloudflare Learning — Hypertext Transfer Protocol (HTTP)](https://www.cloudflare.com/learning/ddos/glossary/hypertext-transfer-protocol-http/)
- **权威性**：official（Cloudflare 学习中心官方词汇表，其业务即运营大规模 HTTP 基础设施）
- **摄入文件**：`inbox/What is HTTP.md`
- **摄入日期**：2026-08-05

Cloudflare Learning 关于 HTTP 的入门词汇条目：HTTP 作为应用层协议如何工作，请求与响应各由哪些部分组成，HTTP 方法与头部、状态码分类、无状态性与持久连接，以及 HTTP 与 L7 DDoS 攻击的关系。

## Related

- [[HTTP 详解]] — 概念页（中文综合讲解）
- [[互联网工作原理]] — 网络基础概念页（HTTP 为其中提到的应用层协议）
- [[Backend Introduction]] — 后端入门项目页
