---
address: c-000112
type: source
title: "JavaScript 指南：语法与类型"
created: 2026-08-13
updated: 2026-08-13
status: seed
source_type: webpage
date_published: "2025-07-16"
url: "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Grammar_and_types"
source_id: "src-0efc5677250ec0c3ebda"
sha256: "1fb827233e25c7d1f670259ea5d44b53ae162828536d9d9a4790f06da1649d9b"
authority: official
independence_key: "mdn-js-guide-grammar-and-types"
review_state: active
key_claims:
  - "JavaScript 区分大小写并使用 Unicode 字符集；大部分语法借鉴自 Java、C 和 C++，并受 Awk、Perl 和 Python 影响。"
  - "语句用分号分隔；ECMAScript 规定语句末尾自动插入分号（ASI），但始终加分号被认为是最佳实践。"
  - "JavaScript 有三种变量声明：var（函数/全局作用域）、let（块级作用域局部变量）、const（块级作用域只读常量）；const 声明必须有初始化器。"
  - "var 声明的变量会被提升（仅提升声明与默认 undefined 初始化，不提升值赋值）；在 let/const 声明前访问块内变量总是抛 ReferenceError（暂时性死区）。"
  - "最新的 ECMAScript 标准定义了 8 种数据类型：Boolean、null、undefined、Number、BigInt、String、Symbol 七种基本类型，以及 Object。"
  - "JavaScript 是动态类型语言；使用 + 运算符时数字会转换为字符串，使用其他运算符时（如 -、*）不会。"
  - "数组字面量中连续逗号会留下空槽（empty slot），与 undefined 不同；遍历方法会跳过空槽但索引访问返回 undefined。"
tags:
  - source
  - javascript
  - mdn
  - guide
---
# JavaScript 指南：语法与类型

**来源**：MDN Web Docs — JavaScript 指南（中文版，2025-07-16）。

MDN JavaScript 指南的「语法与类型」章节（中文版，2025-07）。基础语法（区分大小写、Unicode、分号与 ASI）；注释（单行/多行/hashbang）；三种变量声明（var/let/const）与作用域（全局/模块/函数/块级）、变量提升、暂时性死区、常量；8 种数据类型（7 种基本类型 + Object）；动态类型与类型转换；数字与 + 运算符；parseInt/parseFloat；字面量（数组/布尔/数字/对象/RegExp/字符串、模板字面量与带标签模板）。

## 内容结构

- 基础语法（区分大小写、Unicode、分号与 ASI）
- 注释（单行 / 多行 / hashbang）
- 声明（var / let / const）与作用域（全局 / 模块 / 函数 / 块级）
- 变量提升与暂时性死区（TDZ）
- 常量与全局变量
- 8 种数据类型（7 基本类型 + Object）与动态类型转换
- 数字与 + 运算符、parseInt / parseFloat
- 字面量（数组 / 布尔 / 数字 / 对象 / RegExp / 字符串、模板与带标签模板）
- 字符串特殊字符与转义

## Related

- [[JavaScript 语法与类型]] — 综合概念页（MDN JS Guide 前两章）
- [[wiki/projects/deepseek-harness/harness开发学习主线|DeepSeek Harness 开发学习主线]] — 语言补课阶段
