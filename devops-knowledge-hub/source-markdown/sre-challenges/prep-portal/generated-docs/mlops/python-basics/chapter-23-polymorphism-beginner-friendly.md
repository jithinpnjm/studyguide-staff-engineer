---
title: "Chapter 23 Polymorphism Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_23_polymorphism_beginner_friendly.ipynb"
slug: "/python-basics/chapter-23-polymorphism-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_23_polymorphism_beginner_friendly.ipynb</code></div>

# Chapter 23 — Polymorphism in Python

This notebook is more beginner-friendly than the lecture. It explains the same idea in smaller steps with more examples.

## Start here: the one-line meaning

**Polymorphism = same method name, different behavior depending on the object.**

If that one sentence makes sense, you already understand the core idea.


## 1. Chapter title

**Polymorphism in Python**

## 2. Concept explanation

Think of polymorphism as:
- one action
- many object types
- each object responds in its own way

You will see this chapter in three levels:

1. very simple `speak()` examples  
2. practical helper functions  
3. abstract base class examples


## A very small warm-up

Before looking at advanced code, compare this idea:

- Dog -> `speak()` -> `"Woof"`
- Cat -> `speak()` -> `"Meow"`

The method name stays the same.
The behavior changes based on the object.
That is polymorphism.

## Example 1: Basic polymorphism with Animal, Dog, and Cat

**What this teaches:** This is the core idea. The same method name `speak()` behaves differently for different objects.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class Animal:
    def speak(self):
        print("Animal makes a sound")

class Dog(Animal):
    def speak(self):
        print("Dog says woof")

class Cat(Animal):
    def speak(self):
        print("Cat says meow")

dog = Dog()
cat = Cat()

dog.speak()
cat.speak()
```

</div>

## Example 2: Same function, different objects

**What this teaches:** This is where polymorphism becomes useful. One function works with different object types.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Dog:
    def speak(self):
        print("Woof")

class Cat:
    def speak(self):
        print("Meow")

def make_it_speak(animal):
    animal.speak()

make_it_speak(Dog())
make_it_speak(Cat())
```

</div>

## Example 3: Looping through different objects

**What this teaches:** A loop can stay simple while each object responds differently.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class Dog:
    def speak(self):
        print("Woof")

class Cat:
    def speak(self):
        print("Meow")

class Cow:
    def speak(self):
        print("Moo")

animals = [Dog(), Cat(), Cow()]

for animal in animals:
    animal.speak()
```

</div>

## Example 4: Polymorphism with shapes

**What this teaches:** The method name is the same - `area()` - but each shape calculates it differently.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class Shape:
    def area(self):
        return 0

class Rectangle(Shape):
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def area(self):
        return self.length * self.width

class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14159 * self.radius * self.radius

rectangle = Rectangle(5, 3)
circle = Circle(4)

print(rectangle.area())
print(circle.area())
```

</div>

## Example 5: Same function works for many shapes

**What this teaches:** One helper function works for multiple shape classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class Rectangle:
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def area(self):
        return self.length * self.width

class Circle:
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14159 * self.radius * self.radius

def print_area(shape):
    print("Area:", shape.area())

print_area(Rectangle(4, 6))
print_area(Circle(3))
```

</div>

## Example 6: Parent class and overriding

**What this teaches:** This connects polymorphism to inheritance and overriding.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class Vehicle:
    def start_engine(self):
        print("Vehicle engine started")

class Car(Vehicle):
    def start_engine(self):
        print("Car engine starts with a key or button")

class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle engine starts differently")

car = Car()
bike = Motorcycle()

car.start_engine()
bike.start_engine()
```

</div>

## Example 7: Real-world employee example

**What this teaches:** This is a realistic software-team example of the same action with different forms.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class Employee:
    def work(self):
        print("Employee is working")

class Developer(Employee):
    def work(self):
        print("Developer is writing code")

class Designer(Employee):
    def work(self):
        print("Designer is creating UI designs")

employees = [Developer(), Designer()]

for emp in employees:
    emp.work()
```

</div>

## Example 8: Simple payment example

**What this teaches:** This shows why polymorphism is useful in real programs.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class Payment:
    def pay(self, amount):
        print("Processing payment")

class CreditCardPayment(Payment):
    def pay(self, amount):
        print(f"Paid {amount} using credit card")

class UPIPayment(Payment):
    def pay(self, amount):
        print(f"Paid {amount} using UPI")

def process_payment(method, amount):
    method.pay(amount)

process_payment(CreditCardPayment(), 500)
process_payment(UPIPayment(), 700)
```

</div>

## Example 9: Duck typing style polymorphism

**What this teaches:** Python can use polymorphism even when classes do not share the same parent, as long as they support the needed method.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class Bird:
    def move(self):
        print("Bird is flying")

class Fish:
    def move(self):
        print("Fish is swimming")

class Car:
    def move(self):
        print("Car is driving")

objects = [Bird(), Fish(), Car()]

for obj in objects:
    obj.move()
```

</div>

## Example 10: Abstract base class with abc

**What this teaches:** This is a stricter OOP style where the parent defines a required method.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    @abstractmethod
    def start_engine(self):
        pass

class Car(Vehicle):
    def start_engine(self):
        print("Car engine started")

class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle engine started")

car = Car()
bike = Motorcycle()

car.start_engine()
bike.start_engine()
```

</div>

## Example 11: Why abstract classes help

**What this teaches:** Abstract classes help enforce shared structure across related classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

class Rectangle(Shape):
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def area(self):
        return self.length * self.width

rect = Rectangle(5, 4)
print(rect.area())
```

</div>

## Example 12: A helper function with polymorphism

**What this teaches:** This version returns values instead of printing, which is often more useful in larger programs.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class Dog:
    def speak(self):
        return "Woof"

class Cat:
    def speak(self):
        return "Meow"

def get_sound(animal):
    return animal.speak()

print(get_sound(Dog()))
print(get_sound(Cat()))
```

</div>

## Example 13: Report export example

**What this teaches:** Another realistic example: same action name, different output format.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class PDFReport:
    def export(self):
        print("Exporting as PDF")

class ExcelReport:
    def export(self):
        print("Exporting as Excel")

class CSVReport:
    def export(self):
        print("Exporting as CSV")

reports = [PDFReport(), ExcelReport(), CSVReport()]

for report in reports:
    report.export()
```

</div>

## Example 14: Beginner-friendly comparison

**What this teaches:** This repeats the simplest form on purpose, because repetition helps the idea stick.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class Dog:
    def speak(self):
        print("Woof")

class Cat:
    def speak(self):
        print("Meow")

dog = Dog()
cat = Cat()

dog.speak()
cat.speak()
```

</div>

## Example 15: Full combined example

**What this teaches:** This combines abstraction, overriding, and a shared function into one complete example.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
from abc import ABC, abstractmethod

class Animal(ABC):
    @abstractmethod
    def speak(self):
        pass

class Dog(Animal):
    def speak(self):
        print("Dog says woof")

class Cat(Animal):
    def speak(self):
        print("Cat says meow")

class Cow(Animal):
    def speak(self):
        print("Cow says moo")

def animal_sound(animal):
    animal.speak()

animals = [Dog(), Cat(), Cow()]

for animal in animals:
    animal_sound(animal)
```

</div>


## 5. Common confusion cleared up

### Inheritance vs polymorphism

They are related, but not the same.

- **Inheritance** = one class gets features from another class
- **Polymorphism** = same method name can behave differently for different objects

### The easiest way to remember polymorphism

Use this memory line:

> **same method, different behavior**

### Why Chapter 21, 22, and 23 feel hard

That is normal because these chapters build on each other:

- Chapter 21 = classes and objects
- Chapter 22 = inheritance
- Chapter 23 = polymorphism

So if inheritance still feels new, polymorphism can feel abstract.
That does **not** mean you are bad at Python.
It just means you need more small examples and repetition.

## 6. Common mistakes

- using different method names in related classes
- mixing up overriding and inheritance
- jumping to abstract base classes too early
- trying to memorize the word instead of understanding the pattern

## 7. Mentor tips / best practices

- start with `Dog` and `Cat` style examples first
- say the idea in plain words before reading code
- test one class at a time
- then test one shared function
- only after that move to abstract base classes

## 8. Practice tasks

1. Make `Dog` and `Cat` classes with `speak()`.
2. Write one function that works for both.
3. Create `Rectangle` and `Circle` with `area()`.
4. Create `Car` and `Bike` with `start_engine()`.
5. Make your own example from daily life.

## 9. Revision notes

- polymorphism = one action, many forms
- same method name can behave differently
- overriding is a common way to achieve it
- one helper function can work with many object types
- abstract base classes can enforce required methods
