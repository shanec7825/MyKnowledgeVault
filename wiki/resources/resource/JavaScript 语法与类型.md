---
type: source
address: c-000113
type: concept
title: "JavaScript 语法与类型"
created: 2026-08-13
updated: 2026-08-13
status: developing
tags:
  - concept
  - javascript
  - mdn
  - backend
related:
  - "[[wiki/resources/resource/JavaScript 指南 介绍|JavaScript 指南：介绍]]"
  - "[[wiki/resources/resource/JavaScript 指南 语法与类型|JavaScript 指南：语法与类型]]"
  - "[[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]]"
  - "[[Python Syntax|Python 语法]]"
sources:
  - "[[wiki/resources/resource/JavaScript 指南 介绍|JavaScript 指南：介绍]]"
  - "[[wiki/resources/resource/JavaScript 指南 语法与类型|JavaScript 指南：语法与类型]]"
complexity: beginner
domain: backend
aliases:
  - JavaScript 入门
  - JS 语法
  - JS 数据类型
  - ECMAScript 基础
---
# JavaScript 语法与类型

本文基于 MDN《JavaScript 指南》的「介绍」与「语法与类型」两章（中文版，2025-07），梳理 JavaScript 的核心语言知识，作为 [[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] 中「JavaScript 核心」语言补课的入门概念页。

## 概述

> **总纲**：JavaScript（JS）是一门**跨平台、面向对象的脚本语言**——在浏览器中控制 DOM 让网页可交互，在 Node.js 中作为服务器端语言运行。它**区分大小写**、**动态类型**、基于**原型继承**，其标准化版本称为 **ECMAScript**（ECMA-262）。

## JavaScript 是什么

- **跨平台脚本语言**：能在宿主环境（如浏览器）中连接并控制宿主对象，使网页可交互（动画、按钮、菜单等）。
- **对象标准库**：`Array`、`Date`、`Math` 等核心对象 + 运算符、控制结构等语言元素。
- **扩展方式**：
  - *客户端 JS*：通过控制浏览器及 **DOM** 扩展核心语言（响应鼠标点击、表单输入、页面导航）。
  - *服务器端 JS*：通过服务器相关对象扩展（数据库通信、文件操作），如 **Node.js**。

## JavaScript 与 Java 的区别

| JavaScript | Java |
|---|---|
| 面向对象，不区分对象类型；**原型继承**，可动态添加属性和方法 | 基于类，所有继承通过类层级实现；不能动态添加 |
| **动态类型**（松散类型），无需声明变量类型 | **静态类型**（强类型），必须声明 |
| 形式自由：无需声明类、方法，无需实现接口 | 基于类模型，要求紧耦合的对象层级 |

## JavaScript 与 ECMAScript

- **ECMAScript** 是 JavaScript 的标准化版本，规范文档位于 **ECMA-262**（ISO-16262）。
- ECMAScript 规范**不描述 DOM**——DOM 由 W3C/WHATWG 标准化。
- JavaScript 支持 ECMAScript 规范中的所有功能；JS 文档面向程序员，ECMAScript 文档面向实现者。

## 基础语法

- **区分大小写**，使用 **Unicode** 字符集（可用 `Früh` 作变量名，`früh` 与 `Früh` 不同）。
- **语句**用分号分隔；单行语句分号可省略，同行的多条语句必须分隔。
- **ASI**（自动分号插入）：ECMAScript 规定语句末尾自动补分号，但**始终加分号是最佳实践**。
- 源文本被扫描转换为 token、控制字符、行终止符、注释和空白字符序列。

### 注释

```js
// 单行注释
/* 多行注释 */
#!/usr/bin/env node  // hashbang 注释（指定 JS 引擎路径）
```

- 不能嵌套块注释；注释行为类似空白字符，执行时被忽略。

## 声明与作用域

### 三种声明方式

| 关键字 | 作用域 | 说明 |
|---|---|---|
| `var` | 函数/全局作用域 | 声明变量，可选初始化 |
| `let` | 块级作用域 | 块级局部变量，可选初始化 |
| `const` | 块级作用域 | 只读常量，**必须初始化** |

### 变量

- **标识符**规则：以字母、`_` 或 `$` 开头，后续可含数字；大部分 Unicode 字母可用。
- 未初始化变量为 `undefined`；`let x = 42` 等价于 `let x; x = 42`。
- 应始终声明后再使用；给未声明变量赋值会创建「未声明的全局」（严格模式下是错误）。

### 作用域

- **全局作用域**：脚本模式默认。
- **模块作用域**：模块模式中。
- **函数作用域**：由函数创建。
- **块级作用域**：`let`/`const` 声明的变量，限制在 `{}` 块内（`var` 不受块限制）。

### 变量提升（Hoisting）

- `var` 被提升：仅提升**声明和默认初始化（undefined）**，不提升值赋值。
- 函数声明**全部被提升**，可在声明前安全调用。
- `let`/`const`：声明前访问块内变量总是抛 `ReferenceError`（**暂时性死区** TDZ）。

### 全局变量与常量

- 全局变量是全局对象（浏览器中 `window`）的属性；可用 `globalThis` 在所有环境一致访问。
- `const` 阻止**重新赋值**但不阻止**修改**：对象属性、数组元素不受保护。

## 数据类型

最新的 ECMAScript 标准定义 **8 种数据类型**：

- **7 种基本类型（primitive）**：`Boolean`、`null`、`undefined`、`Number`、`BigInt`、`String`、`Symbol`
- **1 种对象类型**：`Object`（函数从技术上也是对象）

### 动态类型与转换

- JS 是**动态类型**语言：声明时无需指定类型，执行期间自动转换。
- `+` 运算符：数字会**转换为字符串**（`"37" + 7` → `"377"`）。
- 其他运算符（`-`、`*`）：不转换字符串（`"37" - 7` → `30`）。
- 字符串转数字：`parseInt()`（建议带进制参数）、`parseFloat()`、一元加 `+`。

## 字面量

| 类型 | 示例 | 要点 |
|---|---|---|
| **数组** | `["French Roast", "Colombian"]` | 连续逗号留**空槽**（与 undefined 不同）；尾后逗号被忽略 |
| **布尔** | `true` / `false` | 与 `Boolean` 对象不同 |
| **数字** | `0x1F`（16进制）、`0o17`（8进制）、`0b11`（2进制）、`3.1E+12` | 无符号；BigInt 加 `n` 后缀 |
| **对象** | `{ myCar: "Saturn" }` | 语句开头不能用 `{}`；非标识符属性名需引号 + `[]` 访问 |
| **RegExp** | `/ab+c/` | 正斜杠围成 |
| **字符串** | `"foo"`、`'bar'`、模板字面量 `` ` `` | 模板支持多行与插值 `${name}`；带标签模板可自定义解析 |

### 特殊字符

`\n`（换行）、`\t`（制表）、`\xXX`（两位十六进制）、`\uXXXX`（Unicode）、`\u{XXXXX}`（码位）等；反斜杠可转义引号与换行。

## 与后端知识体系的衔接

- **[[wiki/projects/harness开发学习主线|DeepSeek Harness]]**：仓库主力语言是 **TypeScript**（JS 的超集）——变量 `let/const`、对象、函数一等值、模块 ESM、`async/await` 都建立在 JS 语法之上；本概念页是「阶段 1 语言最小补课」的 JS 语法入口。
- 与 [[Python Syntax|Python 语法]] 对照：JS 无 int/float 之分、`const` 不可重新赋值、对象随处可扩展。

## 总结

- JavaScript = 跨平台、面向对象的脚本语言；区分大小写、动态类型、原型继承。
- 三种声明：`var`（函数作用域、提升）、`let`/`const`（块级作用域、TDZ）。
- 8 种数据类型：7 基本 + Object。
- 标准化：ECMAScript（ECMA-262），DOM 由 W3C/WHATWG 负责。

## Related

- [[wiki/resources/resource/JavaScript 指南 介绍|JavaScript 指南：介绍]] — MDN JS Guide 第一章（中文）
- [[wiki/resources/resource/JavaScript 指南 语法与类型|JavaScript 指南：语法与类型]] — MDN JS Guide 第二章（中文）
- [[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] — 语言补课阶段引用
