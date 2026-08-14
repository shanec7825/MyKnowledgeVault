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

