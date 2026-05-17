---
title: "Chapter 21 Oop Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_21_oop_beginner_friendly.ipynb"
slug: "/python-basics/chapter-21-oop-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_21_oop_beginner_friendly.ipynb</code></div>

# Chapter 21 — Object-Oriented Programming (OOP) in Python

This notebook is rewritten in the same slower, beginner-friendly teaching style as Chapter 23.

## Start here: one-line meaning

**OOP = a way to organize code by modeling real things using classes and objects.**

## Tiny memory guide

- class = blueprint  
- object = real item made from blueprint  
- attribute = data  
- method = action  
- `__init__` = starting setup  
- `self` = current object  

## Before you begin

If OOP feels confusing, that is normal.

Do not try to memorize every word first.

Instead, remember this sentence:

> A class describes a thing, and an object is one real version of that thing.

## Example 1: The smallest possible class

**What this teaches:** A class can create an object even before it has data or methods.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class Car:
    pass

car1 = Car()
print(car1)
```

</div>

## Example 2: A class with two attributes

**What this teaches:** This shows how `__init__` stores starting values inside an object.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class Car:
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model

car1 = Car("Audi", "A4")
print(car1.brand)
print(car1.model)
```

</div>

## Example 3: Two objects from the same class

**What this teaches:** One class can create many objects with different values.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Car:
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model

car1 = Car("Audi", "A4")
car2 = Car("BMW", "X5")

print(car1.brand, car1.model)
print(car2.brand, car2.model)
```

</div>

## Example 4: A class with a method

**What this teaches:** Methods are actions that belong to the object.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        print(f"{self.name} says woof!")

dog1 = Dog("Bruno")
dog1.bark()
```

</div>

## Example 5: Understanding self slowly

**What this teaches:** `self` means the current object. It connects the method to this object's data.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks

    def show_details(self):
        print(f"Name: {self.name}")
        print(f"Marks: {self.marks}")

student1 = Student("Asha", 95)
student1.show_details()
```

</div>

## Example 6: Changing an attribute after object creation

**What this teaches:** Object data can change after creation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

dog1 = Dog("Max", 3)
print("Before:", dog1.age)

dog1.age = 4
print("After:", dog1.age)
```

</div>

## Example 7: A class with default values

**What this teaches:** Constructors can also use default values.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class Employee:
    def __init__(self, name, role="Intern"):
        self.name = name
        self.role = role

    def show(self):
        print(f"{self.name} - {self.role}")

e1 = Employee("Sara")
e2 = Employee("Ali", "Manager")

e1.show()
e2.show()
```

</div>

## Example 8: Product class

**What this teaches:** A class can model a real object from daily life or business.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def display(self):
        print(f"{self.name} costs {self.price}")

item = Product("Laptop", 75000)
item.display()
```

</div>

## Example 9: Rectangle class with returned value

**What this teaches:** Methods can return values instead of only printing.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class Rectangle:
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def area(self):
        return self.length * self.width

rect = Rectangle(5, 3)
print(rect.area())
```

</div>

## Example 10: Light switch example

**What this teaches:** Objects can keep state and methods can change that state.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class Light:
    def __init__(self, is_on=False):
        self.is_on = is_on

    def switch(self):
        self.is_on = not self.is_on
        print("Light on" if self.is_on else "Light off")

lamp = Light()
lamp.switch()
lamp.switch()
```

</div>

## Example 11: Simple bank account class

**What this teaches:** A class can store meaningful data like a person's account balance.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
class BankAccount:
    def __init__(self, holder, balance=0):
        self.holder = holder
        self.balance = balance

    def check_balance(self):
        print(f"{self.holder}'s balance is {self.balance}")

account = BankAccount("Ravi", 1000)
account.check_balance()
```

</div>

## Example 12: Deposit method

**What this teaches:** Methods can update object data.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
class BankAccount:
    def __init__(self, holder, balance=0):
        self.holder = holder
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        print(f"Deposited {amount}")
        print(f"New balance: {self.balance}")

account = BankAccount("Asha", 1000)
account.deposit(500)
```

</div>

## Example 13: Withdraw method

**What this teaches:** Methods can also include conditions and decisions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class BankAccount:
    def __init__(self, holder, balance=0):
        self.holder = holder
        self.balance = balance

    def withdraw(self, amount):
        if amount <= self.balance:
            self.balance -= amount
            print(f"Withdrawn {amount}")
            print(f"Remaining balance: {self.balance}")
        else:
            print("Insufficient balance")

account = BankAccount("Neha", 800)
account.withdraw(300)
account.withdraw(700)
```

</div>

## Example 14: A more complete bank account

**What this teaches:** This combines object data, methods, and basic validation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class BankAccount:
    def __init__(self, holder, balance=0):
        self.holder = holder
        self.balance = balance

    def deposit(self, amount):
        if amount > 0:
            self.balance += amount
        else:
            print("Deposit amount must be positive")

    def withdraw(self, amount):
        if amount <= 0:
            print("Withdrawal amount must be positive")
        elif amount > self.balance:
            print("Insufficient balance")
        else:
            self.balance -= amount

    def check_balance(self):
        print(f"{self.holder}'s balance: {self.balance}")

account = BankAccount("Meera", 1000)
account.deposit(200)
account.withdraw(300)
account.check_balance()
```

</div>

## Example 15: Multiple objects, one blueprint

**What this teaches:** This repeats the core OOP idea again: same class, many objects.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class Car:
    def __init__(self, brand, color):
        self.brand = brand
        self.color = color

    def show_info(self):
        print(f"Brand: {self.brand}, Color: {self.color}")

car1 = Car("Audi", "Black")
car2 = Car("BMW", "White")

car1.show_info()
car2.show_info()
```

</div>

## 5. Common confusion cleared up

### Class vs object

- class = design
- object = actual created thing

### Attribute vs method

- attribute = stored data
- method = action

### Why `self` feels strange

Because it is new.  
The easiest meaning is:

> `self` = this current object

### The one sentence to remember

> A class describes a thing, and an object is one real version of that thing.

## 6. Common mistakes

- forgetting `self`
- using `name` instead of `self.name`
- mixing class and object
- making one class do too many unrelated things

## 7. Mentor tips / best practices

- keep classes small
- model real things
- test one method at a time
- write tiny examples before larger ones
- ask: “what data does this object have?” and “what can it do?”

## 8. Practice tasks

1. Make a `Car` class.
2. Make two car objects.
3. Make a `Dog` class with `bark()`.
4. Make a `Student` class.
5. Make a `Rectangle` class.
6. Make a `BankAccount` class.

## 9. Revision notes

- class = blueprint
- object = instance
- attribute = data
- method = action
- `__init__` = setup
- `self` = current object
