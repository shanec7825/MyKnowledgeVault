---
type: source
address: c-000115
type: source
title: "JavaScript 指南：循环与迭代"
created: 2026-08-14
updated: 2026-08-14
status: seed
source_type: webpage
date_published: "2026-05-26"
url: "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Loops_and_iteration"
source_id: "src-1f2a37c17c1bbd74d09f"
sha256: "2145dcf7b8e17d1f2f31b6780eefb4dddeda0dcaf4a9110b81ee89f2c7a00d35"
authority: official
independence_key: "mdn-js-guide-loops-and-iteration"
review_state: active
key_claims:
  - "for 循环由 initialization/condition/afterthought 三部分构成，执行顺序为初始化→判条件→执行语句→更新→回判条件；condition 省略时视为 true。"
  - "do...while 先执行一次语句再检查条件，至少执行一次；while 先检查条件再执行，条件为 false 即停止。"
  - "无限循环是错误：应保证循环条件最终会变为 false，否则循环永不停止（如 while(true)）。"
  - "label 为循环/语句命名；break label 终止被标记语句（可一次跳出多层循环），continue label 跳到被标记循环继续执行。"
  - "无标签 break 终止当前 while/do-while/for/switch；无标签 continue 跳过本次迭代的剩余部分进入下一轮。"
  - "for...in 遍历对象所有可枚举属性（含自定义属性，不适合数组）；for...of 遍历可迭代对象（Array/Map/Set/arguments 等）的值。"
  - '数组应用传统 for 或 for...of 迭代；for...in 会额外包含自定义属性（如 arr.foo = "hello"）。'
tags:
  - source
  - javascript
  - mdn
  - guide
---
# JavaScript 指南：循环与迭代

**来源**：MDN Web Docs — JavaScript 指南（中文版，2026-05-26）。

MDN JavaScript 指南的「循环与迭代」章节（中文版，2026-05）。`for`、`do...while`、`while`、`label`、`break`、`continue`、`for...in`、`for...of` 全部迭代语句的语法、语义与示例。

## 内容结构

- `for` 循环：initialization / condition / afterthought 执行顺序
- `do...while`：先执行后判断（至少一次）
- `while`：先判断后执行；避免无限循环
- `label` 语句：标记循环，配合 `break label` / `continue label`
- `break` / `continue`：无标签 vs 带标签语义
- `for...in`：遍历可枚举属性（不适合数组）
- `for...of`：遍历可迭代对象的值（Array/Map/Set/arguments）
- 数组迭代：`for...in` vs `for...of` 对比（下标 vs 值）

## Related

- [[JavaScript 控制流与循环]] — 综合概念页（MDN JS Guide 第三、四章）
- [[wiki/projects/JavaScript指南|JavaScript 指南]] — JS Guide 学习项目
- [[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]] — 语言补课阶段
