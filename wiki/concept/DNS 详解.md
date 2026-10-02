---
type: concept
title: "DNS 详解"
created: 2026-08-11
updated: 2026-08-11
status: developing
tags:
  - concept
  - dns
  - networking
  - backend
related:
  - "[[域名详解]]"
  - "[[互联网工作原理]]"
complexity: beginner
domain: backend
aliases:
  - DNS 是什么
  - Domain Name System 解读
  - 域名系统入门
  - DNS 解析原理
---

# DNS 详解

本文基于 cs.fyi 的《Everything You Need to Know About DNS》（2023-03）与 MDN 的《What is a Domain Name》（2025-06）梳理 DNS（域名系统）的核心机制，作为 [[Backend Introduction]] 项目的第五步：域名解析、记录类型、dig 工具与域名注册。

## 概述

> **总纲**：DNS（Domain Name System，域名系统）是**互联网的电话簿**——把人类可读的域名（如 `www.example.com`）映射为机器使用的 IP 地址（如 `192.0.2.1`），让我们无需记忆数字地址即可访问网站。

- DNS 是 [[互联网工作原理]] 中「把域名翻译成 IP 地址」的基础设施，依赖全球分布式服务器网络协同工作。
- DNS 不仅服务于 Web，邮件（MX）、即时通讯等互联网应用也依赖它。

## DNS 解析五步流程

一次完整的 DNS 解析按以下顺序逐级查询：

| 步骤 | 查询对象 | 角色 |
|------|----------|------|
| 1 | **本地缓存** | 浏览器缓存 / 操作系统 DNS 缓存 / hosts 文件；命中则直接返回，跳过后续步骤。 |
| 2 | **递归 DNS 服务器** | 通常由 ISP 或公共 DNS（如 `8.8.8.8`）提供；检查自身缓存，未命中则继续向上查询。 |
| 3 | **根 DNS 服务器** | DNS 层级顶端，不存网站 IP，而是存 TLD 服务器的 IP 地址（如 `.com` → `a.gtld-servers.net`）。 |
| 4 | **顶级域（TLD）DNS 服务器** | 负责特定顶级域（`.com`、`.org`、`.ai` 等），指向权威 DNS 服务器。 |
| 5 | **权威 DNS 服务器** | 实际存放 DNS 记录（如 A 记录）的地方；返回域名对应的 IP 地址。 |

> **流程总结**：浏览器输入域名 → 逐级检查缓存 → 递归解析器 → 根服务器 → TLD 服务器 → 权威服务器 → 返回 IP 地址 → 浏览器用 IP 连接目标服务器。

### 本地缓存的三个来源

1. **浏览器缓存**：之前访问过的网站 IP 可能被浏览器缓存。
2. **DNS 缓存**：操作系统根据 DNS 记录的 TTL（Time To Live，生存时间）缓存 IP。
3. **hosts 文件**：手动配置的域名-IP 映射。

## 域名结构

域名由多个部分（标签）组成，以点分隔，**从右向左读**：

```
www.example.com
│   │       │
│   │       └── TLD（顶级域）：.com
│   └────────── SLD（二级域）：example
└────────────── 子域（subdomain）：www
```

| 组件            | 说明                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **TLD**（顶级域）  | `.com`、`.org`、`.net` 为通用 TLD；`.us`、`.cn`、`.jp` 为国家/地区 TLD；`.gov`、`.edu` 为受限 TLD。最长 63 字符，通常 2-3 字符。ICANN 维护完整列表。 |
| **标签（Label）** | TLD 左侧的每个点分隔部分；大小写不敏感，1-63 字符，只能包含字母 A-Z、数字 0-9 和连字符 `-`（不能作为首尾字符）。                                              |
| **SLD**（二级域）  | TLD 左侧的第一个标签，通常代表组织/品牌名称。                                                                                        |
| **子域**        | SLD 左侧的任意级标签，如 `developer.mozilla.org` 中的 `developer`。                                                           |

## DNS 记录类型

| 记录类型 | 用途 | 示例 |
|----------|------|------|
| **A 记录** | 域名 → IPv4 地址 | `example.com → 93.184.216.34` |
| **AAAA 记录** | 域名 → IPv6 地址 | `example.com → 2606:2800:220:1:248:1893:25c8:1946` |
| **MX 记录** | 邮件交换服务器 | `example.com → mail.example.com` |
| **NS 记录** | 权威 DNS 服务器 | `example.com → ns1.example.com` |
| **CNAME 记录** | 域名别名（规范名） | `www.example.com → example.com` |
| **TXT 记录** | 文本信息（常用于 SPF/DKIM 验证） | `example.com → "v=spf1 ..."` |

## dig 命令实战

`dig`（Domain Information Groper）是 Linux/macOS 上查询 DNS 的标准命令行工具。Windows 可通过 Chocolatey 安装：`choco install dig`。

### 基本查询

```bash
# 查 A 记录（IP 地址）
dig example.com A

# 简洁输出（仅 IP）
dig example.com +short

# 查 MX 记录（邮件服务器）
dig example.com MX

# 查 NS 记录（权威 DNS 服务器）
dig +short NS cs.fyi
```

### 追踪完整解析路径

```bash
# 从根服务器开始逐步追踪
dig example.com +trace

# 追踪 MX 记录以检查 DNS 传播
dig example.com MX +trace
```

### 查询特定 DNS 服务器

```bash
# 使用 Google Public DNS（8.8.8.8）
dig example.com A @8.8.8.8

# 使用 Cloudflare DNS（1.1.1.1）
dig example.com A @1.1.1.1
```

### 检查 DNSSEC

```bash
dig example.com +dnssec
```

> **DNSSEC**（DNS Security Extensions）是 DNS 的安全扩展，认证 DNS 数据来源并验证数据完整性，防止 DNS 数据在传输中被篡改。

## 常见 DNS 错误

| 错误                               | 含义                 |
| -------------------------------- | ------------------ |
| `DNS_PROBE_FINISHED_NXDOMAIN`    | 域名不存在（拼写错误或域名已过期）。 |
| `DNS_PROBE_FINISHED_NO_INTERNET` | 域名存在但 DNS 服务器不可达。  |
| `DNS_PROBE_FINISHED_BAD_CONFIG`  | DNS 服务器配置错误或不可达。   |

### 刷新 DNS 缓存

```bash
# Windows
ipconfig /flushdns

# macOS
dscacheutil -flushcache

# Linux (systemd-resolved)
systemd-resolve --flush-caches
```

## 域名注册

### 关键概念

- **不能「购买」域名**：你支付的是**一段时期的使用权**（通常 1 年），到期可续费。你永远不会拥有域名。
- **注册商（Registrar）**：管理域名注册的公司，使用域名注册局（Registry）来跟踪域名的技术与行政信息。
- **whois 查询**：检查域名是否已被注册。

```bash
whois example.com   # 查询域名注册信息
whois afunkydomainname.org  # 返回 NOT FOUND = 可注册
```

### DNS 传播

当注册商创建或更新域名信息时，变更需要传播到全球所有 DNS 服务器。每台 DNS 服务器会缓存信息一定时间（TTL），过期后才会向权威服务器查询更新。因此，域名变更可能需要几小时才能全球生效。

## 与后端知识体系的衔接

- DNS 是任何 Web 应用的第一跳：用户在浏览器中输入域名 → DNS 解析 → 获取服务器 IP → 建立 TCP 连接 → HTTP/HTTPS 通信（见 [[HTTP 详解]] 与 [[HTTP3 核心概念]]）。
- 理解 DNS 对于后端开发至关重要：配置域名、设置子域、管理 MX 记录（邮件服务）、排查网络问题都离不开 DNS 知识。
- DNS 也与 CDN、负载均衡（基于 DNS 的流量分发）、服务发现密切相关，是分布式系统的基础设施之一。

## 总结

- DNS = 互联网电话簿，域名 → IP 地址的分布式映射系统。
- 解析流程：本地缓存 → 递归 DNS → 根服务器 → TLD 服务器 → 权威服务器（五步链式查询）。
- 域名结构：`子域.SLD.TLD`，从右向左读，大小写不敏感。
- 实用工具：`dig`（查询 DNS 记录）、`whois`（查询域名注册信息）、刷新 DNS 缓存命令。
- 常见记录：A（IPv4）、AAAA（IPv6）、MX（邮件）、NS（权威服务器）、CNAME（别名）、TXT（文本）。
- DNSSEC 提供 DNS 数据来源认证与完整性保护。

## Related

- Everything You Need to Know About DNS — cs.fyi DNS 全面指南（2023-03）
- What is a Domain Name — MDN 域名详解（2025-06）
- [[域名详解]] — 域名概念页（中文综合讲解，含 MDN 来源摘要）
- [[互联网工作原理]] — 互联网基础原理（含 DNS 在协议栈中的位置）
- [[HTTP 详解]] — HTTP 协议（依赖 DNS 解析后建立连接）
- [[Backend Introduction]] — 后端入门项目页
