---
type: project
title: "JavaScript 指南"
created: 2026-08-14
updated: 2026-08-28
status: active
area: "后端"
domain: programming-language
complexity: beginner
goal: "按 MDN《JavaScript 指南》（中文版）系统补齐 JavaScript 语言核心，支撑 DeepSeek Harness 开发学习主线的语言补课阶段。"
prerequisites:
  - "[[wiki/projects/pythonBasics|pythonBasics]]"
code:
  - "D:/projects/JavaScript基础"
related:
  - "[[JavaScript 控制流与循环]]"
  - "[[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]]"
tags:
  - project
  - javascript
  - mdn
  - guide
  - learning-path
  - area/后端
---

# JavaScript 指南

## 前置
**前置项目**：[[pythonBasics]]

**知识框架体系**：概念层（JS 语法与类型、控制流、函数、对象/类、Promise、模块）；技能层（用 Node 写小脚本、在 MDN 中定位特性）；工具层（Node、浏览器控制台）。

## 目标产出
> 按 MDN《JavaScript 指南》（中文版）系统补齐 JavaScript 语言核心，支撑 DeepSeek Harness 开发学习主线的语言补课阶段。

**交付物**：

- [ ] MDN 指南核心章节的概念页（已 4 章，待补函数 / 对象 / 类 / Promise / 模块）
- [ ] 20 个 Node 小脚本练习
- [ ] 支撑 harness 主线阶段 1 验收通过

- [ ] -「待补章节」中的函数、对象、类、Promise、模块等核心主题均已摄入并有概念页
- [ ] -完成阶段 1 的「用 Node 写 20 个小脚本」练习，脚本保存在本项目目录
- [ ] -[[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] 阶段 1 验收通过
- [ ] -`wiki-lint` 无死链，来源页与概念页互相链接
- [ ] -全部完成后：`status: completed`，项目移入 `wiki/archives/`
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：按 MDN《JavaScript 指南》逐章摄入并沉淀概念页，为 harness 主线的「JavaScript 核心」补课提供导航。

**关键难点**：

- JS 的隐式类型转换和 this 绑定是最大的坑，靠记忆规则不如靠练习踩坑。
- Promise 和迭代器是后半段硬骨头，是从「会写」到「能读仓库」的分水岭。
- 只读不练等于没学——20 个脚本是硬性配套。

## 已摄入章节
| 章节           | 来源页                    | 概念页                   |     |
| ------------ | ---------------------- | --------------------- | --- |
| 第一章 介绍       | JavaScript 指南：介绍       | JavaScript 语法与类型      |     |
| 第二章 语法与类型    | JavaScript 指南：语法与类型    | avaScript 语法与类型       |     |
| 第三章 控制流与错误处理 | JavaScript 指南：控制流与错误处理 | [[JavaScript 控制流与循环]] |     |
| 第四章 循环与迭代    | JavaScript 指南：循环与迭代    | [[JavaScript 控制流与循环]] |     |

## 待补章节（后续）
函数、表达式与运算符、数字与日期、文本格式化、正则表达式、索引集合、带键的集合、使用对象、使用类、Promise、迭代器与生成器、模块。

## 衔接
- [[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] — 阶段 1「语言最小补课」引用本项目的概念页。
- 语言底座是 TypeScript（JS 超集）；语法补完后再进入异步编程与插件/DI 思想。

