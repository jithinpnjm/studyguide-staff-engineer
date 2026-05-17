---
title: "Chapter 24 Encapsulation Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_24_encapsulation_beginner_friendly.ipynb"
slug: "/python-basics/chapter-24-encapsulation-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_24_encapsulation_beginner_friendly.ipynb</code></div>

# Chapter 24 — Encapsulation in Python

This notebook follows the same beginner-friendly teaching style as Chapters 21, 22, and 23.

## Start here: one-line meaning

**Encapsulation = keeping data safe inside a class and controlling how it is used.**

## Tiny memory guide

- public = open to all  
- protected = for internal/family use  
- private = strongly protected  
- getter = read safely  
- setter = change safely  

## Before you begin

Do not focus only on underscores first.

Focus on the main idea:

> the class should control its own important data

## Example 1: Public variable

**What this teaches:** Public data can be accessed from anywhere.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class Person:
    def __init__(self, name):
        self.name = name

p = Person("Asha")
print(p.name)
```

</div>

## Example 2: Protected variable

**What this teaches:** Protected variables use one underscore and are meant for internal use.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class Employee:
    def __init__(self, salary):
        self._salary = salary

emp = Employee(50000)
print(emp._salary)
```

</div>

## Example 3: Private variable

**What this teaches:** Private variables use two underscores and are meant to stay inside the class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Person:
    def __init__(self, age):
        self.__age = age

p = Person(25)
print("Private variable created")
```

</div>

## Example 4: Access private value with a getter

**What this teaches:** A getter method returns private data safely.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class Person:
    def __init__(self, age):
        self.__age = age

    def get_age(self):
        return self.__age

p = Person(25)
print(p.get_age())
```

</div>

## Example 5: Change private value with a setter

**What this teaches:** A setter method changes private data in a controlled way.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class Person:
    def __init__(self, age):
        self.__age = age

    def get_age(self):
        return self.__age

    def set_age(self, new_age):
        self.__age = new_age

p = Person(25)
p.set_age(30)
print(p.get_age())
```

</div>

## Example 6: Setter with validation

**What this teaches:** A setter becomes powerful when it blocks invalid values.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class Person:
    def __init__(self, age):
        self.__age = age

    def get_age(self):
        return self.__age

    def set_age(self, new_age):
        if new_age > 0:
            self.__age = new_age
        else:
            print("Age must be positive")

p = Person(25)
p.set_age(-5)
print(p.get_age())
p.set_age(40)
print(p.get_age())
```

</div>

## Example 7: Bank account with private balance

**What this teaches:** Private balance is a classic encapsulation example.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class BankAccount:
    def __init__(self, balance):
        self.__balance = balance

    def get_balance(self):
        return self.__balance

account = BankAccount(1000)
print(account.get_balance())
```

</div>

## Example 8: Deposit method protects the balance

**What this teaches:** Important values should change through methods, not random outside access.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class BankAccount:
    def __init__(self, balance):
        self.__balance = balance

    def deposit(self, amount):
        if amount > 0:
            self.__balance += amount
        else:
            print("Deposit amount must be positive")

    def get_balance(self):
        return self.__balance

account = BankAccount(1000)
account.deposit(500)
print(account.get_balance())
```

</div>

## Example 9: Withdraw method with validation

**What this teaches:** Encapsulation is strongest when methods enforce rules.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class BankAccount:
    def __init__(self, balance):
        self.__balance = balance

    def withdraw(self, amount):
        if amount <= 0:
            print("Withdrawal amount must be positive")
        elif amount > self.__balance:
            print("Insufficient balance")
        else:
            self.__balance -= amount

    def get_balance(self):
        return self.__balance

account = BankAccount(1000)
account.withdraw(300)
print(account.get_balance())
account.withdraw(900)
```

</div>

## Example 10: Public, protected, and private in one class

**What this teaches:** This compares all three access styles together.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class Person:
    def __init__(self, name, salary, age):
        self.name = name
        self._salary = salary
        self.__age = age

    def get_age(self):
        return self.__age

p = Person("Ravi", 60000, 28)
print(p.name)
print(p._salary)
print(p.get_age())
```

</div>

## Example 11: Protected variable in inheritance

**What this teaches:** Child classes can usually work with protected variables.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
class Employee:
    def __init__(self, salary):
        self._salary = salary

class Manager(Employee):
    def show_salary(self):
        print(self._salary)

m = Manager(70000)
m.show_salary()
```

</div>

## Example 12: Private variable in inheritance

**What this teaches:** Private variables do not behave like protected ones inside child classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
class Employee:
    def __init__(self, age):
        self.__age = age

class Manager(Employee):
    def try_show_age(self):
        print("Private variable cannot be accessed directly here")

m = Manager(35)
m.try_show_age()
```

</div>

## Example 13: Safer student marks example

**What this teaches:** Encapsulation helps protect valid data ranges like 0 to 100 marks.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class Student:
    def __init__(self, marks):
        self.__marks = marks

    def get_marks(self):
        return self.__marks

    def set_marks(self, value):
        if 0 <= value <= 100:
            self.__marks = value
        else:
            print("Marks must be between 0 and 100")

s = Student(85)
print(s.get_marks())
s.set_marks(120)
print(s.get_marks())
s.set_marks(92)
print(s.get_marks())
```

</div>

## Example 14: Why direct access can be risky

**What this teaches:** This shows the danger of public data with no protection.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class BankAccount:
    def __init__(self, balance):
        self.balance = balance

account = BankAccount(1000)
account.balance = -500
print(account.balance)
```

</div>

## Example 15: Better encapsulated version

**What this teaches:** This is the safer version, where the class controls balance updates.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class BankAccount:
    def __init__(self, balance):
        self.__balance = balance

    def get_balance(self):
        return self.__balance

    def set_balance(self, value):
        if value >= 0:
            self.__balance = value
        else:
            print("Balance cannot be negative")

account = BankAccount(1000)
account.set_balance(-500)
print(account.get_balance())
account.set_balance(1500)
print(account.get_balance())
```

</div>

## 5. Common confusion cleared up

### Encapsulation vs abstraction

- encapsulation = control and protect data
- abstraction = hide complexity

### Public vs protected vs private

- public = open
- protected = internal use
- private = strongly protected

### The one sentence to remember

> the class should control its own important data

## 6. Common mistakes

- memorizing underscores without understanding the purpose
- making important data fully public
- overusing getters and setters where they add no value
- confusing protected and private

## 7. Mentor tips / best practices

- protect important values like balance, marks, and salary
- use methods to enforce rules
- write setters when validation matters
- learn the idea first, then the syntax

## 8. Practice tasks

1. Create one public variable example.
2. Create one protected variable example.
3. Create one private variable example.
4. Add a getter.
5. Add a setter with validation.
6. Build a private-balance bank account.

## 9. Revision notes

- encapsulation protects data
- public, protected, and private have different access meanings
- getter reads safely
- setter updates safely
- encapsulation improves safety and maintainability
