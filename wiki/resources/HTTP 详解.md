---
address: c-000021
type: concept
title: "HTTP 详解"
created: 2026-08-05
updated: 2026-08-05
status: developing
tags:
  - concept
  - http
  - networking
  - backend
related:
  - "[[wiki/resources/What is HTTP|What is HTTP]]"
  - "[[互联网工作原理]]"
sources:
  - "[[wiki/resources/What is HTTP|What is HTTP]]"
complexity: beginner
domain: backend
aliases:
  - HTTP 是什么
  - What is HTTP 解读
  - HTTP 协议入门
  - HTTP 请求与响应
---

# HTTP 详解

本文基于 Cloudflare Learning 的《[[wiki/resources/What is HTTP|What is HTTP]]》梳理 HTTP 协议的核心机制，作为 [[Backend Introduction]] 项目继 [[互联网工作原理]] 之后的第二步：请求与响应的构成、方法与状态码、无状态性与持久连接。

## 概述

> **总纲**：HTTP（Hypertext Transfer Protocol，超文本传输协议）是**万维网的基础**，用超文本链接加载网页——客户端发请求，服务器回响应，一次典型 HTTP 流程即告完成。

- HTTP 是**应用层协议**：设计目标是让联网设备之间传输信息，运行在网络协议栈的更高层之上（底层依赖 TCP 等传输）。
- 与 [[互联网工作原理]] 中的概念衔接：HTTP 即那里提到的"客户端（浏览器）与服务器（网站）之间传输数据"的协议。

## HTTP 请求

一个 HTTP 请求是浏览器等客户端"索取信息"的方式。典型请求包含：

1. **HTTP 版本类型**（如 HTTP/1.1）
2. **URL**（请求的资源地址）
3. **HTTP 方法**（期望服务器执行的动作）
4. **请求头**（携带附加信息的键值对）
5. **可选的请求体**（提交给服务器的数据）

## HTTP 方法

- HTTP 方法（method，又称 HTTP 动词）指示请求期望服务器执行的动作。
- 最常用的两个方法：
  - **GET**——期望服务器返回信息（通常是网页内容）。
  - **POST**——表示客户端在提交信息（如表单里的用户名与密码）。

## 请求头与响应头

- HTTP 头部是**键值对（key-value）形式的文本信息**，请求与响应都会携带。
- 请求头传达核心信息：客户端使用什么浏览器、请求什么数据等。
- 响应头传达：响应体的语言、数据格式等。

## HTTP 响应

客户端从服务器收到的是响应消息，典型响应包含：

1. **HTTP 状态码**（请求是否成功完成）
2. **响应头**
3. **可选的响应体**

对 GET 请求的成功响应，响应体通常包含请求的信息——多数网页请求中是 HTML 数据，由浏览器翻译成页面。

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

## 无状态与持久连接

- HTTP 是**无状态（stateless）协议**：每条命令独立运行，与其他命令无关。
- 原始规范中每个 HTTP 请求都新建并关闭一条 TCP 连接；**HTTP/1.1 及以上**支持**持久连接（keep-alive）**，多个请求复用同一条 TCP 连接，改善资源消耗。

## DDoS 与 L7（来源补充）

- 大量 HTTP 请求可用于对目标设备发起 DoS / DDoS 攻击，属于**应用层攻击（layer 7）**。

## 总结

- HTTP = 万维网基石的应用层协议：请求（版本/URL/方法/头/可选体）→ 响应（状态码/头/可选体）。
- 方法定动作（GET 取、POST 交）；状态码五类判结果（2xx 成、4xx 客户端错、5xx 服务端错）。
- 无状态 + 持久连接：HTTP/1.1 起多个请求复用一条 TCP 连接。

## Related

- [[wiki/resources/What is HTTP|What is HTTP]] — 本次摄入的原文（Cloudflare Learning）
- [[互联网工作原理]] — 网络基础概念页
- [[Backend Introduction]] — 后端入门项目页
