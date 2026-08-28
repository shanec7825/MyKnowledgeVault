---
address: c-000076
type: source
title: "Populating the page: how browsers work"
created: 2026-08-11
updated: 2026-08-11
status: seed
source_type: webpage
author: "MDN Web Docs"
date_published: 2025-12-18
url: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work"
source_id: "src-efaff655c94e6a54"
sha256: "8be743edf12e15fc0dfc16d55bfbcf3c117d6b3a420a8599af845df0c15994c1"
authority: official
independence_key: "mdn-how-browsers-work"
review_state: active
key_claims:
  - "浏览器导航分三步：DNS 查找 → TCP 三次握手 → TLS 协商（HTTPS），共需 8 次往返才能发送请求。"
  - "关键渲染路径（Critical Rendering Path）分五步：构建 DOM → 构建 CSSOM → 合并为渲染树 → 布局（Layout）→ 绘制（Paint）。"
  - "预加载扫描器（preload scanner）在后台提前请求 CSS/JS/字体等高优先级资源，减少阻塞。"
  - "脚本（不带 async/defer）会阻塞 HTML 解析；CSS 不阻塞 HTML 解析但阻塞 JavaScript 执行。"
  - "TCP slow start 通过拥塞窗口（CWND）动态调整传输速率：ACK 到达则 CWND 翻倍，否则减半。"
  - "首包 14KB 是关键——浏览器收到首批数据后立即开始解析和渲染，应在此包内包含首屏所需的 HTML 与 CSS。"
  - "布局→绘制→合成三步构成渲染阶段；GPU 合成层（通过 opacity/transform/will-change 等触发）提升性能但消耗内存。"
  - "TTI (Time to Interactive) 是页面可交互的测量指标：首内容绘制后 50ms 内响应用户交互的时间点。"
  - "避免主线程被 JS 长时间占用——解析、编译、执行 JavaScript 期间主线程无法响应用户交互（滚动/点击）。"
tags:
  - source
  - web-browser
  - rendering
  - performance
  - backend
---

# Populating the page: how browsers work

- **来源**：[https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work)
- **权威性**：official（MDN 官方 Web 性能指南）
- **摄入文件**：`inbox/Populating the page how browsers work.md`
- **摄入日期**：2026-08-11

MDN Web Docs 的 Web 性能指南文章，详细阐述浏览器从导航到交互的完整工作流程：导航（DNS → TCP → TLS）→ 响应（TTFB、TCP slow start）→ 解析（DOM、CSSOM、预加载扫描器、JS 编译、AOM）→ 渲染（样式、布局、绘制、合成）→ 交互性（TTI）。

## Related

- [[浏览器渲染原理]] — 概念页（中文讲解）
- [[Web 浏览器详解]] — Web 浏览器基础知识（概念页）
- [[Backend Introduction]] — 后端入门项目
