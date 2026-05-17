---
title: "Chapter 25 Abstraction Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_25_abstraction_beginner_friendly.ipynb"
slug: "/python-basics/chapter-25-abstraction-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_25_abstraction_beginner_friendly.ipynb</code></div>

# Chapter 25 — Abstraction in Python

This notebook follows the same beginner-friendly teaching style as Chapters 21, 22, 23, and 24.

## Start here: one-line meaning

**Abstraction = show the important part, hide the complicated part.**

## Tiny memory guide

- abstraction = simple outside, complex inside  
- abstract class = blueprint  
- abstract method = required method  
- child class = gives the actual implementation  

## Before you begin

Do not worry too much about the word “abstraction”.

The easiest way to understand it is through everyday life:

- washing machine
- mobile phone
- remote control
- car dashboard

You use the simple outside controls.
You do not need to know every hidden internal process.

## Example 1: A simple idea of abstraction

**What this teaches:** You use one simple method without seeing hidden internal details.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class WashingMachine:
    def start(self):
        print("Washing machine started")

machine = WashingMachine()
machine.start()
```

</div>

## Example 2: User sees simple action, not internal complexity

**What this teaches:** This repeats the same idea with a mobile phone example.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class MobilePhone:
    def make_call(self):
        print("Calling...")

phone = MobilePhone()
phone.make_call()
```

</div>

## Example 3: Importing abstract base class tools

**What this teaches:** Python uses the `abc` module for abstract base classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
from abc import ABC, abstractmethod
print("ABC imported successfully")
```

</div>

## Example 4: Creating an abstract class

**What this teaches:** An abstract class defines a rule or blueprint for child classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    @abstractmethod
    def start_engine(self):
        pass
```

</div>

## Example 5: Child class implementing abstract method

**What this teaches:** The child class provides the real implementation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    @abstractmethod
    def start_engine(self):
        pass

class Car(Vehicle):
    def start_engine(self):
        print("Car engine started")

car = Car()
car.start_engine()
```

</div>

## Example 6: Another child class with different implementation

**What this teaches:** Different child classes can implement the same required method differently.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    @abstractmethod
    def start_engine(self):
        pass

class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle engine started")

bike = Motorcycle()
bike.start_engine()
```

</div>

## Example 7: Same abstract parent, different child behavior

**What this teaches:** One rule in the parent can support many child behaviors.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    @abstractmethod
    def start_engine(self):
        pass

class Car(Vehicle):
    def start_engine(self):
        print("Car starts with a button")

class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle starts with a kick or switch")

vehicles = [Car(), Motorcycle()]

for v in vehicles:
    v.start_engine()
```

</div>

## Example 8: Abstract class with a normal method too

**What this teaches:** Abstract classes can have both normal methods and abstract methods.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    def fuel_info(self):
        print("Vehicles need energy to run")

    @abstractmethod
    def start_engine(self):
        pass

class Car(Vehicle):
    def start_engine(self):
        print("Car engine started")

car = Car()
car.fuel_info()
car.start_engine()
```

</div>

## Example 9: Shape abstraction

**What this teaches:** A shape can define a required `area()` method for all child classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

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

## Example 10: Circle with same abstract parent

**What this teaches:** Another child class can follow the same rule in its own way.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14159 * self.radius * self.radius

circle = Circle(3)
print(circle.area())
```

</div>

## Example 11: Function using abstract-style interface

**What this teaches:** One helper function works cleanly because all shape classes follow the same interface.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

class Rectangle(Shape):
    def __init__(self, l, w):
        self.l = l
        self.w = w

    def area(self):
        return self.l * self.w

class Circle(Shape):
    def __init__(self, r):
        self.r = r

    def area(self):
        return 3.14159 * self.r * self.r

def print_area(shape):
    print("Area:", shape.area())

print_area(Rectangle(4, 5))
print_area(Circle(3))
```

</div>

## Example 12: Payment abstraction example

**What this teaches:** This is a practical abstraction example from payment systems.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
from abc import ABC, abstractmethod

class PaymentMethod(ABC):
    @abstractmethod
    def pay(self, amount):
        pass

class CreditCard(PaymentMethod):
    def pay(self, amount):
        print(f"Paid {amount} using credit card")

class UPI(PaymentMethod):
    def pay(self, amount):
        print(f"Paid {amount} using UPI")

CreditCard().pay(500)
UPI().pay(700)
```

</div>

## Example 13: Report export abstraction

**What this teaches:** Abstraction helps different exporter classes follow the same action style.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
from abc import ABC, abstractmethod

class ReportExporter(ABC):
    @abstractmethod
    def export(self):
        pass

class PDFExporter(ReportExporter):
    def export(self):
        print("Exported as PDF")

class CSVExporter(ReportExporter):
    def export(self):
        print("Exported as CSV")

PDFExporter().export()
CSVExporter().export()
```

</div>

## Example 14: Notification abstraction

**What this teaches:** This is another realistic example where different systems share one interface.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
from abc import ABC, abstractmethod

class Notification(ABC):
    @abstractmethod
    def send(self, message):
        pass

class EmailNotification(Notification):
    def send(self, message):
        print(f"Email sent: {message}")

class SMSNotification(Notification):
    def send(self, message):
        print(f"SMS sent: {message}")

EmailNotification().send("Hello")
SMSNotification().send("Hello")
```

</div>

## Example 15: Full vehicle example

**What this teaches:** This combines normal methods, abstract methods, and multiple child classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    def show_type(self):
        print("This is a vehicle")

    @abstractmethod
    def start_engine(self):
        pass

class Car(Vehicle):
    def start_engine(self):
        print("Car engine starts with ignition button")

class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle engine starts with a switch")

car = Car()
bike = Motorcycle()

car.show_type()
car.start_engine()

bike.show_type()
bike.start_engine()
```

</div>

## 5. Common confusion cleared up

### Abstraction vs encapsulation

- abstraction = hide complexity
- encapsulation = protect data

### What is the real point of abstraction?

The real point is:

> keep the outside simple, even if the inside is complex

### The one sentence to remember

> Abstraction = show what the object should do, not every hidden internal detail.

## 6. Common mistakes

- confusing abstraction with encapsulation
- thinking abstraction is only about `ABC`
- forgetting to implement abstract methods in child classes
- trying to instantiate an abstract class directly

## 7. Mentor tips / best practices

- learn abstraction from real life examples first
- use one abstract method at first, not many
- compare parent and child classes side by side
- remember: abstraction is a design idea first, syntax second

## 8. Practice tasks

1. Build a simple real-life abstraction example.
2. Create an abstract `Vehicle` class.
3. Create `Car` and `Motorcycle` child classes.
4. Create an abstract `Shape` class.
5. Create `Rectangle` and `Circle`.
6. Create your own abstraction example from daily life.

## 9. Revision notes

- abstraction hides complexity
- abstract classes use `ABC`
- abstract methods use `@abstractmethod`
- child classes must implement required methods
- abstraction creates clean and consistent design
