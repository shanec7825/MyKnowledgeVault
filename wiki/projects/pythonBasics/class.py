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