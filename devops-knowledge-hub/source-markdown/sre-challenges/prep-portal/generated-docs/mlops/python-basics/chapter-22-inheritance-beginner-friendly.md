---
title: "Chapter 22 Inheritance Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_22_inheritance_beginner_friendly.ipynb"
slug: "/python-basics/chapter-22-inheritance-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_22_inheritance_beginner_friendly.ipynb</code></div>

# Chapter 22 — Inheritance in Python

This notebook is rewritten in the same slower, beginner-friendly teaching style as Chapter 23.

## Start here: one-line meaning

**Inheritance = a new class can reuse features of an existing class.**

## Tiny memory guide

- parent class = general version  
- child class = more specific version  
- `super()` = use parent setup  
- overriding = child replaces parent method  

## Before you begin

The easiest question for inheritance is:

> Is this new class a more specific kind of the old class?

Examples:

- Tesla is a kind of Car
- Dog is a kind of Animal
- Student is a kind of Person

## Example 1: The smallest inheritance example

**What this teaches:** A child class can be created from a parent class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class Car:
    pass

class Tesla(Car):
    pass

t = Tesla()
print(t)
```

</div>

## Example 2: Child class using parent method

**What this teaches:** The child class can directly use a method from the parent.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class Car:
    def drive(self):
        print("The car is driving")

class Tesla(Car):
    pass

t = Tesla()
t.drive()
```

</div>

## Example 3: Parent class with attributes

**What this teaches:** The parent class can store common data shared by child classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Car:
    def __init__(self, windows, engine_type):
        self.windows = windows
        self.engine_type = engine_type

car1 = Car(4, "Petrol")
print(car1.windows, car1.engine_type)
```

</div>

## Example 4: Child class with super()

**What this teaches:** The child reuses parent setup and then adds its own new attribute.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class Car:
    def __init__(self, windows, engine_type):
        self.windows = windows
        self.engine_type = engine_type

class Tesla(Car):
    def __init__(self, windows, engine_type, is_self_driving):
        super().__init__(windows, engine_type)
        self.is_self_driving = is_self_driving

tesla1 = Tesla(4, "Electric", True)
print(tesla1.windows, tesla1.engine_type, tesla1.is_self_driving)
```

</div>

## Example 5: Child class adds a new method

**What this teaches:** A child class can use parent behavior and also add extra behavior.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class Car:
    def drive(self):
        print("Driving the car")

class Tesla(Car):
    def auto_pilot(self):
        print("Tesla is using self-driving mode")

tesla = Tesla()
tesla.drive()
tesla.auto_pilot()
```

</div>

## Example 6: Method overriding

**What this teaches:** The child class can replace a parent method with its own version.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class Car:
    def drive(self):
        print("The car is driving normally")

class Tesla(Car):
    def drive(self):
        print("The Tesla is driving silently")

t = Tesla()
t.drive()
```

</div>

## Example 7: Animal and Dog example

**What this teaches:** A dog is a more specific kind of animal, so inheritance fits naturally here.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class Animal:
    def eat(self):
        print("Animal is eating")

class Dog(Animal):
    def bark(self):
        print("Dog is barking")

d = Dog()
d.eat()
d.bark()
```

</div>

## Example 8: Person and Student example

**What this teaches:** The child can inherit old attributes and also add new ones.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class Person:
    def __init__(self, name):
        self.name = name

class Student(Person):
    def __init__(self, name, marks):
        super().__init__(name)
        self.marks = marks

s = Student("Asha", 95)
print(s.name)
print(s.marks)
```

</div>

## Example 9: Parent method plus child method

**What this teaches:** The child can keep parent behavior and still define its own method.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class Vehicle:
    def start(self):
        print("Vehicle started")

class Bike(Vehicle):
    def ride(self):
        print("Bike is riding")

b = Bike()
b.start()
b.ride()
```

</div>

## Example 10: Multiple inheritance basic idea

**What this teaches:** One child class can inherit from more than one parent class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class Animal:
    def eat(self):
        print("Animal is eating")

class Pet:
    def play(self):
        print("Pet is playing")

class Dog(Animal, Pet):
    pass

d = Dog()
d.eat()
d.play()
```

</div>

## Example 11: Multiple inheritance with constructors

**What this teaches:** A child can receive data from both parent classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Pet:
    def __init__(self, owner):
        self.owner = owner

class Dog(Animal, Pet):
    def __init__(self, name, owner):
        Animal.__init__(self, name)
        Pet.__init__(self, owner)

dog1 = Dog("Bruno", "Ravi")
print(dog1.name)
print(dog1.owner)
```

</div>

## Example 12: Override a method in child class

**What this teaches:** This reinforces overriding with a tiny example.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
class Animal:
    def speak(self):
        print("Animal sound")

class Dog(Animal):
    def speak(self):
        print("Woof")

d = Dog()
d.speak()
```

</div>

## Example 13: Realistic employee example

**What this teaches:** A manager is a more specific kind of employee.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class Employee:
    def __init__(self, name):
        self.name = name

    def show(self):
        print(f"Employee: {self.name}")

class Manager(Employee):
    def __init__(self, name, department):
        super().__init__(name)
        self.department = department

    def show_manager(self):
        print(f"Manager: {self.name}, Department: {self.department}")

m = Manager("Ali", "Sales")
m.show()
m.show_manager()
```

</div>

## Example 14: Checking inheritance relationship

**What this teaches:** `isinstance()` helps you verify parent-child relationships.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class Animal:
    pass

class Dog(Animal):
    pass

d = Dog()
print(isinstance(d, Dog))
print(isinstance(d, Animal))
```

</div>

## Example 15: Tesla example with inherited and new features

**What this teaches:** This combines inherited data, parent methods, child attributes, and child-specific behavior.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class Car:
    def __init__(self, windows, engine_type):
        self.windows = windows
        self.engine_type = engine_type

    def drive(self):
        print("Driving the car")

class Tesla(Car):
    def __init__(self, windows, engine_type, battery_range, is_self_driving):
        super().__init__(windows, engine_type)
        self.battery_range = battery_range
        self.is_self_driving = is_self_driving

    def show_details(self):
        print(
            f"Windows: {self.windows}, Engine: {self.engine_type}, "
            f"Range: {self.battery_range}, Self-driving: {self.is_self_driving}"
        )

car = Tesla(4, "Electric", "500 km", True)
car.drive()
car.show_details()
```

</div>

## 5. Common confusion cleared up

### Inheritance vs overriding

- inheritance = child gets parent features
- overriding = child replaces a parent method

### When should inheritance be used?

Use it when this sentence sounds natural:

> A Tesla is a kind of Car.

### One more easy memory line

> parent = general, child = more specific

## 6. Common mistakes

- forgetting `super().__init__()`
- using inheritance for the wrong relationship
- jumping to multiple inheritance too quickly
- confusing parent methods and child methods

## 7. Mentor tips / best practices

- learn single inheritance first
- keep parent classes general
- keep child classes more specific
- use `super()` for cleaner code
- ask whether the relationship is a real “is-a” relationship

## 8. Practice tasks

1. Create a `Vehicle` class and `Car` child class.
2. Create an `Animal` class and `Dog` child class.
3. Override one method.
4. Use `super()` in a constructor.
5. Make one multiple inheritance example.

## 9. Revision notes

- parent class = base class
- child class = derived class
- inheritance reuses code
- `super()` helps call the parent setup
- overriding lets child classes change behavior
- inheritance works best for true “is-a” relationships
