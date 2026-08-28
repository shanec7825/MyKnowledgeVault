---
address: c-000011
type: concept
title: "Python 基础语法"
created: 2026-08-02
updated: 2026-08-02
status: developing
tags:
  - concept
  - python
  - programming-language
related:
  - "[[Python Syntax Tutorial]]"
sources:
  - "[[Python Syntax Tutorial]]"
complexity: beginner
domain: programming
aliases:
  - Python 语法
  - Python Syntax
---

# Python 基础语法

本文基于 TutorialsPoint《Python - Syntax》梳理 Python 语言的基础语法规则：程序运行方式、标识符、保留字、缩进、多行语句、引号、注释与语句组。

> ⚠️ 注意：该教程部分示例来自 Python 2 时代（如无括号的 `print`、`raw_input`）。在 Python 3 中 `print` 是函数、用户输入用 `input()`，请以 Python 3 为准。

## 第一个 Python 程序

Python 程序可以两种方式运行：

- **交互式（Interactive）**：在命令行输入 `python3` 进入解释器，直接输入语句执行，提示符为 `>>>`。
- **脚本模式（Script）**：把代码写入 `.py` 文件，用 `python3 test.py` 运行；文件首行可加 shebang（如 `#!/usr/bin/python3`）并用 `chmod +x` 设为可执行后直接运行。

```python3
print("Hello, World!")
```

## 标识符（Identifiers）

标识符用于命名变量、函数、类、模块等对象：

- 以字母（`a-z`/`A-Z`）或下划线 `_` 开头，后跟零或多个字母、下划线、数字（`0-9`）。
- 不允许标点字符（如 `@`、`$`、`%`）。
- **区分大小写**：`Manpower` 与 `manpower` 是不同的标识符。
- 命名约定：
  - 类名以大写字母开头，其它标识符以小写开头。
  - 单个前导下划线（`_x`）表示"私有"标识符。
  - 两个前导下划线（`__x`）表示强私有标识符。
  - 首尾各两个下划线（`__x__`）是语言定义的特殊名称（如 `__init__`）。

## 保留字（Keywords）

下列是 Python 保留字（小写），**不能**用作常量、变量或其它标识符名：

`and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield`

## 缩进与代码块

Python **不使用花括号** `{}` 表示代码块，而是用**行缩进**（line indentation）表示，且被严格强制：

- 同一代码块内的所有语句必须缩进相同数量的空格。
- 缩进不一致会导致语法错误。

```python3
if True:
    print("True")
else:
    print("False")
```

连续缩进相同的行组成一个块；`if`/`else`/`for`/`while`/`def`/`class` 等复合语句都以冒号 `:` 结尾的头部开始。

## 多行语句

- 语句默认以换行结束；可用行继续符 `\` 表示续行。
- 在 `[]`、`{}`、`()` 括号内的语句**不需要**续行符，可自然换行。

```python3
total = item_one + \
        item_two + \
        item_three
days = ['Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday']
```

## 引号与字符串

Python 字符串可用单引号 `'...'`、双引号 `"..."` 或三引号（`'''...'''` 或 `"""..."""`）表示，只要起止引号类型一致即可。三引号用于跨多行的字符串。

## 注释（Comments）

- `#` 号（不在字符串字面量内）开始单行注释，注释到行尾结束，被解释器忽略。
- 多行连续 `#` 可做块注释；三引号字符串也可被当作多行注释（它们只是未赋值的字符串）。

```python3
# First comment
print("Hello, World!")  # Second comment
```

## 空行与分号

- 只含空白（可带注释）的**空行**会被 Python 完全忽略。
- 分号 `;` 允许在一行写多条语句，前提是这些语句都不开始新的代码块。

## 语句组（Suites）

一组构成单个代码块的语句称为 **suite**。复合语句（`if`、`while`、`def`、`class` 等）由"头部行"（以关键字开始、冒号 `:` 结尾）加随后的 suite 组成：

```python3
if expression:
    suite
elif expression:
    suite
else:
    suite
```

## Related

- [[Python Syntax Tutorial]] — 本文来源页
- [[CS本科学习手册]] — 综合学习笔记（可选）
