---
type: concept
title: "HTTP 详解"
created: 2026-08-05
updated: 2026-08-29
status: developing
tags:
  - concept
  - http
  - networking
  - backend
related:
  - "[[互联网工作原理]]"
  - "[[HTTP3 核心概念]]"
  - "[[wiki/projects/HTTP|HTTP]]"
complexity: beginner
domain: backend
aliases:
  - HTTP 是什么
  - What is HTTP 解读
  - HTTP 协议入门
  - HTTP 请求与响应
  - HTTP 概述
  - HTTP 报文
---

# HTTP 详解

综合两份来源梳理 HTTP 协议的核心机制：Cloudflare《What is HTTP》给出词汇表层级的速览（请求与响应构成、方法与状态码、无状态与持久连接），MDN《HTTP 概述》给出协议骨架的完整轮廓（系统组成与代理、四项基本性质、HTTP 流、报文字段、能力视角）。两者在重叠部分一致，可互为交叉验证。

作为 [[wiki/projects/Backend Introduction|Backend Introduction]] 项目继 [[互联网工作原理]] 之后的第二步，也是 [[wiki/projects/HTTP|HTTP]] 项目（协议深挖主线）的概念底座。

## 概述

> **总纲**：HTTP（Hypertext Transfer Protocol，超文本传输协议）是**万维网的基础**，用超文本链接加载网页——客户端发请求，服务器回响应，一次典型 HTTP 流程即告完成。

- HTTP 是**应用层协议**：设计目标是让联网设备之间传输信息，运行在网络协议栈的更高层之上（底层依赖 TCP 等传输）。
- 客户端与服务端交换的是**一个个独立的消息**，而非数据流。
- 与 [[互联网工作原理]] 中的概念衔接：HTTP 即那里提到的"客户端（浏览器）与服务器（网站）之间传输数据"的协议。

## 系统组成

HTTP 是客户端—服务器协议，但真实链路里远不止两端。

- **客户端：用户代理** — 任何能代表用户行为的工具，以浏览器为主。**总是**由它首先发起请求，永远不会是服务端（后来才加入了一些模拟服务端发起消息的机制）。
  浏览器拿到 HTML 后解析文档，再发起多个请求取脚本、CSS、图片视频等子资源，最后整合呈现；之后页面内脚本还可以继续取资源并更新页面。网页是**超文本文档**——其中的链接被激活后指示用户代理去取新页面，浏览器把这一指示翻译成 HTTP 请求。
- **Web 服务器** — 负责**提供**客户端所请求的文档。它可以仅是一台机器，也可以是一组负载均衡的集群，或是按需完整/部分生成文档的软件（缓存、数据库服务、电商服务等）。借助 HTTP/1.1 的 `Host` 标头，多个服务实例甚至可以共用同一个 IP 地址。
- **代理** — 浏览器与服务器之间在**应用层**参与消息传递的实体（传输层/网络层/物理层的路由器、调制解调器等对 HTTP 而言是透明的）。代理可以透明转发，也可以在转发前改写请求，常见用途：
  - 缓存（公开的或私有的，如浏览器缓存）
  - 过滤（反病毒扫描、家长控制）
  - 负载均衡（让多个服务器分担请求）
  - 认证（控制对不同资源的访问）
  - 日志（存储历史信息）

> [!tip] 为什么要在意代理
> 它既是性能手段，也是故障源。请求被改写、缓存被污染这类问题，症状往往表现在客户端，根因却在中间的某个代理上。

## HTTP 的基本性质

| 性质 | 含义 | 备注 |
| --- | --- | --- |
| **简约** | 报文人类可读、易理解 | HTTP/2 把报文封进帧，这一性质被削弱 |
| **可扩展** | HTTP/1.0 引入的标头机制让新功能只需双方协商语义即可加入 | 协议几十年演进的根本原因 |
| **无状态，但并非无会话** | 同一连接中两个成功请求之间没有关系 | 靠 Cookie 补上有状态会话 |
| **依赖可靠连接** | 连接由传输层控制，**不属于 HTTP 范畴**；HTTP 只要求传输可靠、不丢消息 | 因此在 TCP 与 UDP 之间选择 TCP |

## HTTP 流

客户端与服务器（最终的或中间的代理）交互一次，过程表现为四步：

1. **打开 TCP 连接** — 用来发送一条或多条请求并接收响应；可能新建、重用已有连接，或开多条。
2. **发送 HTTP 报文** — HTTP/2 之前人类可读；HTTP/2 中封进帧，原理相同。
   ```
   GET / HTTP/1.1
   ```
3. **读取服务端返回的报文**
   ```
   HTTP/1.1 200 OK
   Date: Sat, 09 Oct 2010 14:28:02 GMT
   Last-Modified: Tue, 01 Dec 2009 20:18:22 GMT
   <!DOCTYPE html>…（此处是所请求网页的 29769 字节）
   ```
4. **关闭连接，或为后续请求重用**。

启用 HTTP 流水线时后续请求可不必等待前一个响应全部接收，但流水线已被证明难以在现有网络中实现，HTTP/2 中由更健壮的**帧多路复用**取代。

## HTTP 报文

HTTP/1.1 及更早的报文是语义可读的；HTTP/2 中这些报文被嵌入**帧**这一新的二进制结构，以支持标头压缩与多路复用。关键在于：**语义不变**，客户端会重组出原始的 HTTP/1.1 请求，因此用 HTTP/1.1 格式理解 HTTP/2 报文依旧有效。

报文分**请求**与**响应**两种，各有其格式。

### 请求

一个 HTTP 请求是浏览器等客户端"索取信息"的方式。请求由以下元素组成：

1. **HTTP [方法](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Methods)** — 通常是一个动词（[`GET`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Methods/GET)、[`POST`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Methods/POST)）或一个名词（[`OPTIONS`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Methods/OPTIONS)、[`HEAD`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Methods/HEAD)），定义客户端要执行的动作。
2. **资源路径** — 去掉当前上下文中显而易见信息后的 URL：不含协议（`http://`）、域名（`developer.mozilla.org`）或 TCP 端口（`80`）。
3. **HTTP 协议版本号**（如 HTTP/1.1）。
4. **可选的[标头](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers)** — 向服务端表达附加信息。
5. **可选的请求体** — 如 `POST` 这样的方法，体内包含要发送的资源。

### 响应

客户端从服务器收到的响应报文包含：

1. **HTTP 协议版本号**。
2. **[状态码](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Status)** — 指明请求是否成功执行，以及不成功时的原因。
3. **状态信息** — 一段简短、不权威的状态码描述。
4. **HTTP 标头** — 与请求标头类似。
5. **可选的响应主体** — 包含被获取的资源。

对 GET 请求的成功响应，响应体通常包含所请求的信息——多数网页请求中是 HTML 数据，由浏览器翻译成页面。

## HTTP 方法

- HTTP 方法（method，又称 HTTP 动词）指示请求期望服务器执行的动作。
- 最常用的两个方法：
  - **GET**——期望服务器返回信息（通常是网页内容）。
  - **POST**——表示客户端在提交信息（如表单里的用户名与密码）。

## 请求头与响应头

- HTTP 头部是**键值对（key-value）形式的文本信息**，请求与响应都会携带。
- 请求头传达核心信息：客户端使用什么浏览器、请求什么数据等。
- 响应头传达：响应体的语言、数据格式等。
- 头部也是**协议可扩展性的载体**：只要客户端与服务端就新标头的语义达成一致，就能加入新功能。

## HTTP 状态码

- 状态码是 **3 位数字**，最常用于指示请求是否成功完成，分为 5 类：

| 分类 | 含义 | 常见示例 |
| --- | --- | --- |
| 1xx | 信息（informational） | — |
| 2xx | 成功 | `200 OK`（请求正确完成） |
| 3xx | 重定向（redirect） | — |
| 4xx | 客户端错误 | `404 NOT FOUND`（如 URL 拼错） |
| 5xx | 服务器错误 | — |

- 口诀：`2` 开头成功；`4` 开头是客户端的问题；`5` 开头是服务器端出了问题；`1`/`3` 开头分别是信息与重定向。

## HTTP 能控制什么

扩展性让 HTTP 逐步接管了更多 Web 功能与控制权：早期就能处理缓存与认证，直到 2010 年才加入放行**同源限制**的能力。以下是可被 HTTP 控制的常见特性。

- **缓存** — 服务端能指示代理和客户端缓存哪些内容、缓存多久；客户端也能指示中间缓存代理忽略已存储的文档。
- **开放同源限制** — 浏览器默认强制不同网站之间严格分割，只有**同源**页面才能获取一个网页的全部信息；服务端可用标头减弱这种分离，让一个页面由不同来源的信息拼接而成（部分放开有安全代价）。
- **认证** — 一些页面仅对特定用户开放。基本认证可直接由 HTTP 提供，既可用 [`WWW-Authenticate`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/WWW-Authenticate) 等标头，也可用 HTTP cookie 设置特定会话。
- **代理与隧道** — 服务器或客户端常处于内网、隐藏真实 IP，HTTP 请求需通过代理越过网络屏障。并非所有代理都是 HTTP 代理，例如 SOCKS 运作在更底层；ftp 等其他协议也能被这些代理处理。
- **会话** — 用 HTTP Cookie 借服务端状态把不同请求联系起来，创建会话。这不只是电商购物车的需要，也让任何网站都能允许用户自由定制内容。

## 无状态、会话与连接

- HTTP 是**无状态（stateless）协议**：每条命令独立运行，与其他命令无关；在同一个连接中，两个执行成功的请求之间没有关系。
- 这带来一个问题：用户没法在同一个网站里连贯交互（比如电商购物车）。尽管 HTTP 根本上无状态，但借助 **HTTP Cookie**——它正是通过标头的扩展性加进协议工作流程的——每个请求之间就能创建会话，共享相同上下文与状态。
- **连接管理**：原始规范中每个 HTTP 请求都新建并关闭一条 TCP 连接；**HTTP/1.1 及以上**支持**持久连接（keep-alive）**，多个请求复用同一条 TCP 连接，改善资源消耗。
- 版本演进：HTTP/1.0 默认为每对请求/响应开一条独立 TCP 连接，连续请求时效率低；HTTP/1.1 引入**流水线**（已被证明难以实现）与**持久化连接**，可通过 [`Connection`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/Connection) 标头部分控制底层 TCP；HTTP/2 更进一步，在一条连接上复合多个消息，让连接始终活跃。
- 更远的实验：Google 的 [QUIC](https://zh.wikipedia.org/wiki/QUIC) 基于 UDP 构建更可靠的传输——这已落地为 HTTP/3，见 [[HTTP3 核心概念]]。

## 基于 HTTP 的 API

- **[Fetch API](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API)** — 基于 HTTP 的最常用 API，用于在 JavaScript 中发起 HTTP 请求，取代了 [`XMLHttpRequest`](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest)。
- **[Server-sent 事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events)** — 一种单向服务，允许服务端借助 HTTP 作为传输机制向客户端发送事件。客户端用 [`EventSource`](https://developer.mozilla.org/zh-CN/docs/Web/API/EventSource) 接口打开连接并创建事件处理器，浏览器自动把 HTTP 流里到达的消息转换成 [`Event`](https://developer.mozilla.org/zh-CN/docs/Web/API/Event) 对象，按类型分派给已注册的处理器。

## DDoS 与 L7（来源补充：Cloudflare）

- 大量 HTTP 请求可用于对目标设备发起 DoS / DDoS 攻击，属于**应用层攻击（layer 7）**。

## 总结

- HTTP = 万维网基石的应用层协议：请求（方法 / 路径 / 版本 / 头 / 可选体）→ 响应（版本 / 状态码 / 头 / 可选体）。
- **构成**：用户代理发起请求，服务器回响应，中间可有任意多个承担缓存、过滤、负载均衡、认证、日志的代理。
- **四项性质**：简约、可扩展（靠标头）、无状态但可用 Cookie 建会话、只依赖可靠传输而不管连接。
- 方法定动作（GET 取、POST 交）；状态码五类判结果（2xx 成、4xx 客户端错、5xx 服务端错）。
- 无状态 + 持久连接：HTTP/1.1 起多个请求复用一条 TCP 连接，HTTP/2 用帧在同一连接上多路复用。

## Related

- What is HTTP — 来源一（Cloudflare Learning，词汇表级速览）
- HTTP 概述 — 来源二（MDN，协议骨架总纲，2026-08-29 并入）
- [[HTTP3 核心概念]] — 承接"连接与版本演进"，HTTP/3 over QUIC
- [[互联网工作原理]] — 网络基础概念页
- [[wiki/projects/HTTP|HTTP]] — 以本篇为概念底座的协议深挖项目
- [[wiki/projects/Backend Introduction|Backend Introduction]] — 后端入门项目页
