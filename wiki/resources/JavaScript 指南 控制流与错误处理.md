---
address: c-000114
type: source
title: "JavaScript 指南：控制流与错误处理"
created: 2026-08-14
updated: 2026-08-14
status: seed
source_type: webpage
date_published: "2025-12-05"
url: "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Control_flow_and_error_handling"
source_id: "src-da981b35bc255e101639"
sha256: "1e44a57824095e230a3125408b5ba051611ebb00d841dc7cad7b94ee29d51c22"
authority: official
independence_key: "mdn-js-guide-control-flow-error-handling"
review_state: active
key_claims:
  - "JavaScript 用块语句（由一对花括号界定）组合语句；用 var 声明的变量不是块级作用域而是函数/脚本作用域，块内 var x 会覆盖外层（输出 2，C/Java 输出 1）；用 let/const 消除该作用域穿透。"
  - "JavaScript 支持两种条件语句：if...else（含 else if 链，只执行第一个为 true 的分支）和 switch（匹配 case 标签，未命中找 default，省略 break 会贯穿下一个 case）。"
  - "假值只有 6 个：false、undefined、null、0、NaN、空字符串（""）；其余所有值（含所有对象）在条件语句中为 true；勿混淆原始布尔值与 Boolean 对象（new Boolean(false) 为 truthy）。"
  - "throw 可抛出任意表达式；推荐使用 Error 构造函数与 ECMAScript 异常/DOMException 类型来抛出自定义异常。"
  - "try...catch...finally：finally 无论是否抛出异常都会执行，可确保资源释放（如关闭文件）；finally 若返回一个值，会覆盖 try/catch 的返回值（包括覆盖 catch 内重新抛出的异常）。"
  - "嵌套 try...catch 中，内层 try 无对应 catch 时必须有一个 finally 块，且外层 catch 会被检查能否处理该异常。"
tags:
  - source
  - javascript
  - mdn
  - guide
---
# JavaScript 指南：控制流与错误处理

**来源**：MDN Web Docs — JavaScript 指南（中文版，2025-12-05）。

MDN JavaScript 指南的「控制流与错误处理」章节（中文版，2025-12）。块语句与 var 作用域穿透；条件语句（if...else / else if / switch）与假值列表；异常处理（throw / try...catch / finally / Error 对象 / 嵌套 try）。

## 内容结构

- 块语句（`{}`）与 var 的函数/脚本作用域（对比 C/Java 的块级作用域）
- 条件语句：`if...else`、`else if` 链、`switch` 与 `break` 贯穿语义
- 假值列表与 `Boolean` 对象陷阱
- 异常类型：ECMAScript 异常 / `DOMException`
- `throw` 语句：可抛出任意表达式
- `try...catch...finally`：finally 的执行保证与返回值覆盖规则
- 嵌套 `try...catch` 与 `Error` 对象（`name` / `message`）

## Related

- [[JavaScript 控制流与循环]] — 综合概念页（MDN JS Guide 第三、四章）
- [[wiki/projects/JavaScript指南/JavaScript指南|JavaScript 指南]] — JS Guide 学习项目
- [[wiki/projects/deepseek-harness/harness开发学习主线|DeepSeek Harness 开发学习主线]] — 语言补课阶段
