---
address: c-000012
type: project
title: "pythonBasics"
created: 2026-08-02
updated: 2026-08-28
status: active
area: "后端"
domain: programming-language
complexity: beginner
goal: "通过练习掌握 Python 基础：语法、控制流、数据结构与函数。"
sources: []
related:
  - "[[Python Syntax]]"
  - "[[Python 快速入门]]"
tags:
  - project
  - python
  - area/后端
---

# pythonBasics


## 前置
**前置项目**：无

**知识框架体系**：概念层（语法、控制流、数据结构、函数、类、闭包/装饰器）；技能层（写可运行小脚本、读懂报错栈）；工具层（python 解释器、REPL）。


## 目标产出
> 通过练习掌握 Python 基础：语法、控制流、数据结构与函数。


**具体目标**：

- 用可运行的小脚本掌握 Python 基础：语法、控制流、数据结构、函数。
- 沉淀可复用的练习代码与学习笔记。

**交付物**：

- [ ] 控制流、数据结构、函数各一组可运行练习脚本并通过
- [ ] 每个主题一页用自己的话复述的概念笔记
- [ ] 练习代码合并附于本页（类、闭包、装饰器等已收录）

- [ ] -控制流 / 数据结构 / 函数各有可运行练习脚本并通过
- [ ] -每个主题有一页用自己的话复述的概念笔记
- [ ] -练习代码附于本页「附：练习代码」，复制后可直接 `python` 运行
- [ ] -全部完成后：`status: completed`，项目移入 `wiki/archives/`
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：用可运行的小脚本掌握 Python 基础，练习代码合并到本页，可复制直接运行。

**关键难点**：

- 闭包与装饰器是函数式部分的坎（作用域链加高阶函数）。
- 类方法、静态方法、实例方法的绑定差异容易混淆。
- 「看懂」和「能写」之间隔着大量练习，这个项目就是用来填这条沟的。


## 内容
- [[Python Syntax]] — Python 基础语法（概念页）
- [[Python 快速入门]] — Python 3 速成路线（概念页，含控制流/数据结构/函数/类）
- 练习代码：本页末尾「附：练习代码」，可复制运行


## 待办
- [ ] 补充控制流 / 数据结构 / 函数练习
- [ ] 摄入 Python 控制流、数据结构等概念页（已由 [[Python 快速入门]] 部分覆盖）


## Related
- [[Python Syntax]]
- [[Python 快速入门]]


## 附：练习代码
> 原 `wiki/projects/pythonBasics/` 下的练习脚本合并至此。

### class.py

```python
#类：

class Student:
    nation="China"
    
    @classmethod
    def changeNation(cls,new_nation):
        Student.nation=new_nation
        return Student.nation
    def __init__(self,name,age):
        self.name = name
        self.age = age
        
    def say_hi(self):
        print(f"Hello, my name is {self.name},I'm {self.age}")
        
    @staticmethod
    def is_pass(age):
        return  age>18
        
stu1 = Student("zaty",19)
stu2 = Student("shanec",19)

stu1.say_hi()

Student.changeNation("USA")
print(Student.nation)
print(Student.is_pass(stu1.age))

class Adult(Student):
    def is_light(self):
        print("hi~")


A = Adult("A",19)

A.is_light()
```

### closure.py

```python
def outer():
    x = 10
    y = 8
    def inner():
        print(x)
    return inner

f = outer()
print(f.__closure__)
leng = len(f.__closure__)
print (leng) 

```

### decorator.py

```python
def decorator(func):
    def wrapper():
        print("before")
        func()
        print("after")
    return wrapper

def hello():
    print("Hello")
    
hello = decorator(hello)
hello()

# 修饰器就是接受函数，返回函数的一个对象（也是函数）
#接受的这个函数还是会执行，返回的函数是在修饰器类定义的函数
#所以可以认为修饰器就是在接收的函数基础上，增加了新的功能
@decorator
def hi():
    print("hi")
    
hi()

#@就是省略了那一行赋值操作，本质就是将hi函数作为参数传入decorator函数中，返回的wrapper函数再赋值给hi函数

#参数

def decorator1(func):
    def wrapper(b,a):
        print("before")
        result = func(a,b)
        print("after")
        return result
    return wrapper

@decorator1
def add(a,b):
    return a + b

print(add(3, 5))


#修饰器带参数
def repeat(times):
    def decorator(func):
        def wrapper(*args, **kwargs):
            results = []
            for _ in range(times):
                results.append(func(*args, **kwargs))
            return results
        return wrapper
    return decorator

@repeat(7)
def greet(name):
    return f"Hi，{name}"

print(greet("小羽"))
        
```

### module.py

```python
#一个.py就是一个模块 | 工具箱 | 定义变量、方法、对象
import decorator as d
import sys
for p in sys.path():
    print(p)

```

### testPython.py

```python
#!/usr/bin/env python3
print("Hello, yy")

print("hello, {name}".format(name="yy"))

syntax = { "int":1, "function": 2, "control": 3}
 
#key为不可变类型：元组，整数，浮点，字符串
print(syntax["int"])

list(syntax.keys())


for animo in ["dog", "tiger", "lion"]:
    print("catch you {}".format(animo))


try:
    raise IndexError("this is an index error")
except IndexError as e:
    print("error: {}".format(e))
else :
    print("no error")
finally:
    print("finally block executed")
    
    
with open("myfile.txt", "w+") as f:
    for i in f:
        print(i)
        
        
        
contents = {"key1": "value1", "key2": "value2"}

with open("myfile.txt", "w+") as f:
    f.write(str(contents))
     
with open("myfile.txt", "r") as f:
    data = f.read()
print(data)

def add(a, b):
    print("x is {}, y is {}".format(a, b))
    return a + b

print("result is {}".format(add(807,825)))

def turnArgs(*args):
    return args
print("result is {}".format(turnArgs(1, 8, 7, 0)))

def createAdd(x):
    def Add(y):
        return x + y
    return Add

add_8 = createAdd(8)
print("result is {}".format(add_8(7)))

import math
dir(math)
```


---


## 自动关联
> 以下列表由 Dataview 自动生成，勿手工编辑。改关系请改 frontmatter 的 `sources` / `related` / `prerequisites`。

### 本项目引用的知识

```dataview
LIST WITHOUT ID R
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN (sources + related) AS R
SORT R ASC
```

### 引用本项目的资源

```dataview
LIST
FROM "wiki/resources"
WHERE contains(related, this.file.link) OR contains(sources, this.file.link)
SORT file.name ASC
```

### 前置项目

```dataview
LIST WITHOUT ID P
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN prerequisites AS P
```

### 后继项目

```dataview
LIST
FROM "wiki/projects"
WHERE contains(prerequisites, this.file.link)
```
