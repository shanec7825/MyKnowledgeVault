---
address: c-000014
type: concept
title: "Python 快速入门"
created: 2026-08-03
updated: 2026-08-03
status: developing
tags:
  - concept
  - python
  - programming-language
related:
  - "[[wiki/resources/resource/Learn Python in Y Minutes|Learn Python in Y Minutes]]"
  - "[[Python Syntax]]"
  - "[[pythonBasics]]"
sources:
  - "[[wiki/resources/resource/Learn Python in Y Minutes|Learn Python in Y Minutes]]"
complexity: beginner
domain: programming
aliases:
  - Python 速成
  - Python 快速上手
---

# Python 快速入门

本文基于 Learn X in Y Minutes 的《[[wiki/resources/resource/Learn Python in Y Minutes|Learn Python in Y Minutes]]》梳理一份可运行的 Python 3 速成路线：从数据类型与运算符，到集合、流程控制、函数、模块、面向对象与高级特性。词汇级语法规则（缩进、保留字、注释、字符串）见 [[Python Syntax]]。

> 速查：以下代码基于 Python 3；`print` 是函数，`input()` 返回字符串；Python 3.7+ 字典保持插入顺序。

## 1. 数据类型与运算符

- 基础类型：整数、浮点、字符串、布尔（`True`/`False`）、`None`。
- 除法 `/` 总是返回浮点：`35 / 5 == 7.0`；整除 `//` 向下取整：`-5 // 3 == -2`；模 `%` 结果符号与除数一致：`-7 % 3 == 2`。
- 幂运算 `**`；用括号控制优先级：`(1 + 3) * 2 == 8`。
- 布尔即整数：`True + True == 2`，`0 == False` 为真；`and`/`or` 返回操作数原值。
- 相等用 `==`，对象同一性用 `is`；比较 `None` 必须用 `is`。
- 字符串：单/双引号皆可，`+` 拼接；f-string（3.6+）`f"{name} is {len(name)}"`；也可用 `.format()` 与旧式 `%`。
- 假值：`None`、`0`、`""`、`[]`、`{}`、`()` 均为 `False`，其余为 `True`。

## 2. 变量与集合

- 变量无需声明，命名习惯 `snake_case`；三元表达式 `"yay" if cond else "nay"`。
- **列表 list**：`append`/`pop`/`insert`/`remove`/`index`；负索引 `li[-1]`；切片 `li[start:stop:step]`；`del`；`+`/`extend` 合并；`in`、`len()`；`li[:]` 单层浅拷贝。
- **元组 tuple**：不可变；单元素须加尾逗号 `(1,)`；支持解包与扩展解包 `a, *b, c = ...`；可用于交换变量。
- **字典 dict**：键必须为不可变（可哈希）类型；`keys()`/`values()` 为可迭代视图；`get(key, default)`、`setdefault`、`update`、`del`；3.7+ 按插入顺序。
- **集合 set**：元素必须不可变；`&` 交集、`|` 并集、`-` 差集、`^` 对称差；`<=`/`>=` 判断子集/超集。

## 3. 流程控制与迭代器

- `if`/`elif`/`else` 以缩进分块；`for ... in` 遍历；`range(lower, upper, step)`；`enumerate` 同时取索引与值；`while` 循环。
- 异常：`try/except/else/finally`；`raise` 抛异常；`pass` 空操作。
- `with` 语句管理资源（如文件自动关闭），可替代 `try/finally`。
- 可迭代对象与迭代器：`iter()` 生成迭代器、`next()` 逐步取值，耗尽抛 `StopIteration`。

## 4. 函数

- `def` 定义、`return` 返回；支持关键字参数。
- `*args` 收集多余位置参数为元组，`**kwargs` 收集关键字参数为字典；调用时 `*seq`/`**map` 展开。
- 函数是一等公民：可嵌套定义并返回（闭包，如 `create_adder`）；`lambda` 匿名函数；`map`/`filter` 高阶函数。
- 推导式：`[f(x) for x in xs if cond]`（列表）、`{x for x in ...}`（集合）、`{k: v for ...}`（字典）。
- 作用域：局部变量遮蔽全局变量，`global` 声明后可修改全局。

## 5. 模块

- 导入形式：`import math`、`from math import ceil, floor`、`import math as m`；`dir()` 查看成员。
- 本地同名文件优先于内建模块：文件夹内 `math.py` 会遮蔽内建 `math`。

## 6. 类与面向对象

- `class` 定义；`__init__` 构造；实例方法首参为 `self`；类属性由所有实例共享。
- `@classmethod` 接收类对象，`@staticmethod` 无绑定；`@property`/`@setter`/`@deleter` 控制属性访问。
- `if __name__ == '__main__':` 保护主程序入口（仅在作为主程序运行时执行）。
- 继承：子类覆盖父类方法与字段，`super()` 调用父类方法；`isinstance`/`type` 检查类型。
- 多重继承：`super()` 只返回 MRO 的下一个类，通常需显式调用各父类 `__init__`；`__mro__` 查看方法解析顺序。

## 7. 高级用法

- 生成器：`yield` 惰性求值，每次迭代只算一个值；生成器推导式 `(-x for x in xs)`。
- 装饰器：`@decorator` 包装函数并返回新函数；`functools.wraps` 保留被包装函数元信息。

## Related

- [[wiki/resources/resource/Learn Python in Y Minutes|Learn Python in Y Minutes]] — 本文来源页
- [[Python Syntax]] — 词汇级语法（缩进/保留字/注释/字符串）
- [[pythonBasics]] — Python 基础学习与练习项目
