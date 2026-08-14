#!/usr/bin/env python3
print("Hello, yy")

print("hello, {name}".format(name="yy"))

syntax = { "int":1, "function": 2, "control": 3}
 
#key为不可变类型：元组，整数，浮点，字符串
print(syntax["int"])

list(syntax.keys())


## 3.流程控制 &迭代器

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