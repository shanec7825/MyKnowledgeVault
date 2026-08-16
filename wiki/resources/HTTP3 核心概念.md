---
address: c-000023
type: concept
title: "HTTP/3 核心概念"
created: 2026-08-05
updated: 2026-08-05
status: developing
tags:
  - concept
  - http3
  - quic
  - networking
  - backend
related:
  - "[[wiki/resources/HTTP3 From A To Z Core Concepts|HTTP3 From A To Z Core Concepts]]"
  - "[[HTTP 详解]]"
sources:
  - "[[wiki/resources/HTTP3 From A To Z Core Concepts|HTTP3 From A To Z Core Concepts]]"
complexity: beginner
domain: backend
aliases:
  - HTTP/3 详解
  - HTTP3 详解
  - QUIC 与 HTTP/3
  - HTTP/3 核心概念
---

# HTTP/3 核心概念

本文基于 Robin Marx 的《[[wiki/resources/HTTP3 From A To Z Core Concepts|HTTP3 From A To Z Core Concepts]]》（Smashing Magazine，2021-08，系列 Part 1）梳理 HTTP/3 的核心概念，承接 [[HTTP 详解]]，作为 [[Backend Introduction]] 项目「版本演进」的一环。

## 概述

> **总纲**：HTTP/3 本质上是 **HTTP/2-over-QUIC**。我们真正需要的不是新 HTTP 版本，而是 TCP 的替代——一个"TCP/2"；HTTP/3 的亮点（更快建连、更少 HoL 阻塞、连接迁移）**全部来自 QUIC**。

- 作者的核心立场：常见宣传把 HTTP/3 说成性能革命，实际它是**温和而有用的演进**；预期应克制，部署与正确使用都不简单。
- 历史路径：先修 HTTP/1.1 得到 HTTP/2（2015 标准化）→ 再修 TCP 得到 QUIC → 微调 HTTP/2 使其跑在 QUIC 上，得名 HTTP/3（主要出于营销与清晰性）。
- 因此 **HTTP/1.1 → HTTP/2 的差异，远大于 HTTP/2 → HTTP/3 的差异**。

## 为什么需要 HTTP/3：TCP 的困境

- TCP 提供**可靠性与按序交付**，并公平限制每个用户的带宽占用——但它是上世纪的设计，两个问题显著：
  1. **握手开销**：建立连接要一次完整网络往返（RTT）；跨洲连接 RTT 可超 100ms。
  2. **单一字节流**：TCP 把连接内所有数据视为一个字节流——即使同时传输多个文件，一旦某个包丢失，其他文件也要等重传（**队头阻塞，head-of-line blocking**）。
- **TCP 几乎无法演进**：防火墙、负载均衡、路由器、代理等**中间盒（middlebox）** 各自携带 TCP 实现，难以更新且对未知扩展保守；新 TCP 扩展（如 TCP Fast Open、Multipath TCP）普及常需**数年甚至十余年**。结论：需要替代协议而非升级。

## QUIC 是什么

- QUIC 是**通用传输协议**（不止为 HTTP 设计：DNS、SSH、SMB、RTP 等都可跑在 QUIC 上）。
- **为什么跑在 UDP 上**：不是性能原因——而是 UDP 已被几乎所有网络设备支持，**便于部署**（若直接跑在 IP 上，又会重蹈"全员更新"的覆辙）。
- 在 UDP 之上，QUIC **重新实现了 TCP 的关键特性**：确认（acknowledgement）与重传保证可靠、仍然握手、流控与拥塞控制防止压垮网络——但实现方式更聪明、更高效（吸收 TCP 数十年部署经验 + 新特性）。
- **没有免费午餐**：HTTP/3 不是"换掉 TCP 就变快"，而是"重写了一个更先进的 TCP，叫 QUIC"。

## 四大根本变化

### 变化一：与 TLS 深度集成（没有 TLS 就没有 QUIC）

- 历史背景：TLS 原本是可选的独立层（所以有 HTTP / HTTPS 之分）；HTTP/2 理论上有明文模式（h2c）但浏览器都不支持。QUIC 把这股"默认加密"趋势推到极致。
- **QUIC 没有明文模式，永远全加密**：内嵌 TLS 1.3，并把传输握手与加密握手**合并为一个**，比 TLS-over-TCP 少一个 RTT（TLS 1.3 本身也把加密握手从两轮降到一轮）。
- 几乎**整个包（含传输层元数据）都被加密**，中间盒无法解读——安全更好、且演进只需更新端设备；代价：网络可能封锁 QUIC、单包加密开销更高（高吞吐场景）、部署高度集中在少数大厂（集中化是真担忧）。

### 变化二：多独立字节流（按流处理丢包）

- HTTP/1.1：每个文件一条 TCP 连接，浏览器并发限制约 **6–30 条**；文件多时成为瓶颈。
- HTTP/2：单条 TCP 连接**多路复用**多个流——但 TCP 层仍把它们当单一字节流；一旦丢包，**整个连接**被阻塞（TCP 级 HoL 阻塞），A、C 资源只能干等 B 的包。
- QUIC：传输层**天生感知多个独立字节流**，丢包检测与恢复按流进行——只阻塞受影响流，其余数据尽快交付。

### 变化三：连接 ID（CID）与连接迁移

- TCP 用 **4 元组**（客户端 IP + 客户端端口 + 服务器 IP + 服务器端口）标识连接；任一变化（如 Wi-Fi 切 4G 换 IP，"停车场问题"）连接即失效，需重握手、重传、重启进度。
- QUIC 引入**连接 ID（CID）**：4 元组变化时，两端只看 CID 即可认出是同一连接，**连接迁移**（connection migration）无需新握手。
- 隐私设计：若 CID 固定不变，攻击者可跨网跟踪用户位置——所以客户端与服务器协商**多个随机 CID 的公共列表**，换网时轮换使用，外部无法把新旧 CID 关联到同一连接。

### 变化四：帧机制与可演进性

- TCP 用固定大包头携带全部元数据（常浪费字节）；QUIC 用**短包头 + 各种帧（frame）** 携带附加信息：`ACK`（确认）、`NEW_CONNECTION_ID`（连接迁移）、`STREAM`（数据）、`DATAGRAM`（不加密可靠性的非可靠数据，草案扩展）等。
- 帧机制 + 默认全加密 → 演进只需更新端设备，且**定义新帧类型做扩展非常容易**；QUIC 应视为 v1，v2 已明确在规划中。
- 附加：QUIC 实现多在**用户态**（TCP 多在内核态），实验与部署变体更容易。

## 与 HTTP/2 的关系

- HTTP/2 与 QUIC 各自都有"多流"概念，叠放会冲突低效——所以 **HTTP/3 移除 HTTP 层的流逻辑，直接复用 QUIC 流**。副作用：server push、头部压缩、优先级等在 HTTP/3 中的实现方式都有变化（作者在 Part 2 展开）。

## 总结

- HTTP/3 = HTTP/2-over-QUIC；真正的功臣是 QUIC（"TCP/2"）。
- QUIC = 跑在 UDP 上的、深度加密的、感知多流与 CID 的现代 TCP 替代品。
- 性能收益真实但**有节制**：作者反复强调"更快的连接建立、更少的 HoL 阻塞"在多数页面上影响有限，对少数场景（丢包严重的弱网）可能关键。

## Related

- [[wiki/resources/HTTP3 From A To Z Core Concepts|HTTP3 From A To Z Core Concepts]] — 本次摄入的原文（Robin Marx，Smashing Magazine，2021-08）
- [[HTTP 详解]] — HTTP 协议基础（请求/响应、方法、状态码）
- [[Backend Introduction]] — 后端入门项目页
