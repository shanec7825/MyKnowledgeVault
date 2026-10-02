---
type: project
title: HTTP
created: 2026-08-29
updated: 2026-08-30
status: active
area: 后端
domain: networking
complexity: intermediate
goal: 深挖 HTTP 协议骨架——报文、方法、状态码、缓存、连接管理、版本演进——形成可复用的协议速查与抓包调试能力。
prerequisites:
  - "[[Backend Introduction|Backend Introduction]]"
code:
  - D:/Projects/HTTP
related:
  - "[[HTTP 详解]]"
  - "[[HTTP3 核心概念]]"
  - "[[HTTP 详解|HTTP 概述]]"
tags:
  - project
  - http
  - networking
  - area/后端
---

# HTTP

> [!info] 代码位置
> 本项目无独立代码仓库，验证走现成工具（curl / 浏览器 DevTools）。代码类产出另见 [[wiki/meta/code-repos]]。

## 前置

**前置项目**：[[Backend Introduction|Backend Introduction]] —— 网络基础链路（互联网 → HTTP → HTTP/3 → 浏览器 → 渲染 → 域名 → DNS）已走通，本项目在其基础上纵向深挖 HTTP 这一层。

**知识框架体系**：

- **概念层** — 报文结构（请求行 / 状态行 / 标头 / 主体）、方法与状态码语义、[[HTTP 详解]]、无状态性与会话、缓存与新鲜度判定、连接管理与版本演进（[[HTTP3 核心概念]]）、代理与隧道。
- **技能层** — 用 curl 手工构造请求并解读响应；看懂 DevTools Network 面板的时序与缓存列；判断一次请求命中的是强缓存还是协商缓存；从状态码与标头反推 4xx / 5xx 的责任方。
- **工具层** — curl / HTTPie、浏览器 DevTools Network、（可选）Wireshark 抓包验证 HTTP/2 帧。

## 目标产出

> 深挖 HTTP 协议骨架——报文、方法、状态码、缓存、连接管理、版本演进——形成可复用的协议速查与抓包调试能力。

**交付工作区**：`D:/Projects/HTTP`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [ ] 《HTTP 报文速查》：请求 / 响应逐字段拆解 + 常用标头清单
- [ ] 《方法与状态码判定表》：常用方法 × 5 类状态码的语义、幂等性与适用场景
- [ ] 《缓存决策笔记》：强缓存与协商缓存的指令组合，以及「为什么页面没更新」的排查路径
- [ ] 版本演进脉络：HTTP/1.1 持久连接 → HTTP/2 帧与多路复用 → HTTP/3 over QUIC，并入 [[HTTP3 核心概念]]
- [ ] 实操验证记录：用 curl 跑通一组请求 / 缓存 / 重定向用例
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点

**核心内容**：把 HTTP 从「会发请求」推进到「能解释并预测协议行为」——给定一个请求，能说出它会被怎样缓存、经过哪些代理、为什么复用或新建连接、失败时错误在哪一侧。MDN《HTTP 概述》是本项目的第一份摄入来源。

**关键难点**：

- **无状态与会话的张力**：协议本身无状态，但业务要状态，Cookie / Token 都是叠在标头扩展机制上的补丁。难在理解「补丁为什么长这样」，而不是记住字段名。
- **缓存的正确性**：强缓存与协商缓存叠加时，真正难的是判断「这次为什么没更新」——要同时读请求指令、响应指令和中间代理行为，比背指令难一个量级。
- **抽象层错位**：HTTP/2 把报文封进帧之后语义没变，但报文从人类可读变成二进制，可观测性骤降，抓包验证的门槛被抬高。
- **代理的双重身份**：它既是性能手段（缓存、负载均衡），又是故障源（改写请求、缓存污染），出问题时不容易第一时间想到它。

