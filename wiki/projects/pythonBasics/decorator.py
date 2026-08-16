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
        