---
address: c-000022
type: source
title: "HTTP/3 From A To Z: Core Concepts"
created: 2026-08-05
updated: 2026-08-05
status: seed
source_type: webpage
author: "Robin Marx"
date_published: "2021-08-09"
url: "https://www.smashingmagazine.com/2021/08/http3-core-concepts-part1/"
source_id: "src-7a0924d11f40c0a5e7ef"
sha256: "b6f2dd42b6c924de603f8d4e8c0d761e97873af6fd8e078bf96815ab7760ba2c"
authority: primary
independence_key: "robinmarx-http3-core-concepts"
review_state: active
key_claims:
  - "HTTP/3 本质是 HTTP/2-over-QUIC：真正需要的是'TCP/2'，HTTP/3 的亮点全部来自 QUIC。"
  - "TCP 因中间盒难以更新而几乎无法在互联网规模上演进，故需要替代传输协议。"
  - "QUIC 跑在 UDP 之上是为了部署便利而非性能；它在 UDP 上重实现了 TCP 的可靠性、握手与拥塞控制。"
  - "QUIC 四大根本变化：深度集成 TLS、多独立字节流、连接 ID（CID）、帧机制。"
  - "QUIC 无明文模式、默认全加密，合并握手省一个 RTT；按流处理丢包消除 TCP 级 HoL 阻塞。"
tags:
  - source
  - article
  - http3
  - quic
  - networking
---

# HTTP/3 From A To Z: Core Concepts

- **来源**：[Smashing Magazine — HTTP/3 From A To Z: Core Concepts](https://www.smashingmagazine.com/2021/08/http3-core-concepts-part1/)
- **作者**：Robin Marx（HTTP/2 与 HTTP/3 领域知名研究者）
- **权威性**：primary（作者本人的深度技术分析，属《HTTP/3 From A To Z》系列 Part 1）
- **摄入文件**：`inbox/HTTP3 From A To Z Core Concepts.md`
- **摄入日期**：2026-08-05

本文是《HTTP/3 From A To Z》系列的第一部分（2021-08），面向协议基础读者的 HTTP/3 核心概念长文：为什么需要 HTTP/3（TCP 的困境）、QUIC 是什么、QUIC 相比 TCP 的四大根本变化（TLS 深度集成 / 多独立字节流 / 连接 ID / 帧机制），并反复提醒对 HTTP/3 性能保持克制预期（常见宣传多为误导）。系列还有 Part 2（性能特性）与 Part 3（部署实践）。

## Related

- [[HTTP3 核心概念]] — 概念页（中文综合讲解）
- [[HTTP 详解]] — HTTP 协议基础概念页
- [[Backend Introduction]] — 后端入门项目页
