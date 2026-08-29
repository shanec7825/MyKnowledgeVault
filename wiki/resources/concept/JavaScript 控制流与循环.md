---
type: concept
title: "JavaScript 控制流与循环"
created: 2026-08-14
updated: 2026-08-14
status: developing
tags:
  - concept
  - javascript
  - mdn
  - backend
related:
  - "[[wiki/projects/JavaScript指南|JavaScript 指南]]"
  - "[[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]]"
complexity: beginner
domain: backend
aliases:
  - JS 控制流
  - JS 循环
  - 条件语句
  - 异常处理
---
# JavaScript 控制流与循环

本文基于 MDN《JavaScript 指南》的「控制流与错误处理」与「循环与迭代」两章（中文版，2025-12 / 2026-05），梳理 JavaScript 的语句控制流、异常处理与迭代语句，作为 [[wiki/projects/JavaScript指南|JavaScript 指南]] 学习项目与 [[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] 中「JavaScript 核心」语言补课的一部分。

## 概述

> **总纲**：JavaScript 的语句控制由**块语句、条件语句（`if...else` / `switch`）、异常处理（`throw` / `try...catch...finally`）与迭代语句（`for` / `while` / `do...while` / `for...in` / `for...of`）** 组成。所有控制语句都以**块语句**（`{}`）组合多条语句。

## 块语句与作用域

- **块语句**：由一对花括号 `{ ... }` 界定，用于组合语句；最常用于控制流语句（`if`、`for`、`while`）。
- **`var` 不是块级作用域**：`var` 声明的变量是函数作用域或脚本作用域，块内 `var x = 2` 会覆盖外层（输出 `2`；C/Java 中输出 `1`）。
- **`let` / `const` 消除该作用域穿透**：块级作用域局部变量。

## 条件语句

| 语句 | 说明 |
|---|---|
| `if...else` | `condition` 为 true 执行 `statement1`，否则执行 `statement2`；可嵌套 |
| `else if` 链 | 按顺序测试多个条件，**只执行第一个为 true** 的分支 |
| `switch` | 求表达式值并与 `case` 标签匹配，未命中找 `default`；省略 `break` 会**贯穿**执行下一个 case |

- **假值（falsy）只有 6 个**：`false`、`undefined`、`null`、`0`、`NaN`、空字符串 `""`；其余所有值（**包括所有对象**）在条件中为 `true`。
- **`Boolean` 对象陷阱**：`new Boolean(false)` 是对象，`if (b)` 为 true，而 `b == true` 为 false——勿与原始布尔值混淆。
- **最佳实践**：嵌套 `if` 时总是使用块语句；最好不要把赋值（`x = y`）作为条件。

## 异常处理

- **`throw`**：可抛出任意表达式（字符串、数字、布尔、对象）；推荐用 `Error` 构造函数创建自定义异常，以利用 `name` / `message` 属性。
- **`try...catch`**：`try` 块中语句（或其调用的函数）抛出异常时控制**立即**转移到 `catch` 块；`catch` 标识符只存在于 `catch` 块存续期间。
- **`finally`**：无论是否抛异常都执行（即使没有 `catch`）；常用于释放资源（如关闭文件）。
  - **返回值覆盖规则**：`finally` 若 `return` 一个值，会覆盖 `try`/`catch` 的返回值，也会覆盖 `catch` 内重新抛出的异常。
- **嵌套 `try...catch`**：内层 `try` 无 `catch` 时必须有一个 `finally` 块；外层 `catch` 会被检查能否处理。
- **调试建议**：`catch` 块中用 `console.error()` 而非 `console.log()`。

## 循环与迭代

| 语句 | 语义 |
|---|---|
| `for (init; cond; after)` | 初始化→判条件→执行→更新→回判；`cond` 省略视为 true |
| `while (cond)` | 先判条件再执行；条件 false 停止 |
| `do { } while (cond)` | 先执行一次再判条件，**至少执行一次** |
| `label:` | 给循环/语句命名；`break label` 跳出被标记语句，`continue label` 跳到被标记循环 |
| `break` | 无标签：终止当前 `while`/`do-while`/`for`/`switch`；带标签：终止被标记语句 |
| `continue` | 无标签：跳过本次迭代剩余部分进入下一轮；带标签：应用到被标记循环 |
| `for...in` | 遍历对象**所有可枚举属性**（含自定义属性）——不适合数组 |
| `for...of` | 遍历**可迭代对象的值**（Array/Map/Set/arguments 等） |

- **数组迭代选择**：`for...in` 会返回数字下标之外的自定义属性（如 `arr.foo`），数组应优先用传统 `for` 或 `for...of`（`forEach` 也理想）。
- **无限循环**：必须保证条件最终为 false，否则循环永不停止（`while (true)` 慎用）。

## 与后端知识体系的衔接

- **[[wiki/projects/harness开发学习主线|DeepSeek Harness]]**：仓库主力语言 TypeScript（JS 超集）中，控制流（`if/switch/for/while`）与迭代（`for...of` 遍历数组/Map）是读代码的基础；`async/await` 之后补充。本页覆盖 MDN JS Guide 的语句控制部分。
- 与 JavaScript 语法与类型 对照：前序概念页覆盖声明与类型，本页覆盖语句与流程控制。

## 总结

- 块语句是组合单位；`var` 是函数/脚本作用域（非块级），`let`/`const` 才是块级。
- 条件：`if...else` / `else if` 链 / `switch`（勿忘 `break`）；假值只有 6 个。
- 异常：`throw` → `try...catch` → `finally`（无论是否抛异常都执行；`finally` return 覆盖一切）。
- 迭代：`for` / `while` / `do...while` / `label`+`break`/`continue` / `for...in`（属性）/ `for...of`（值）。

## Related

- JavaScript 指南：控制流与错误处理 — MDN JS Guide 第三章（中文）
- JavaScript 指南：循环与迭代 — MDN JS Guide 第四章（中文）
- [[wiki/projects/JavaScript指南|JavaScript 指南]] — JS Guide 学习项目
- [[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] — 语言补课阶段引用
