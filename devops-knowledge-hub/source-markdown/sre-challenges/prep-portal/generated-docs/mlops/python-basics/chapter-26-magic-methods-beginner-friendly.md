---
title: "Chapter 26 Magic Methods Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_26_magic_methods_beginner_friendly.ipynb"
slug: "/python-basics/chapter-26-magic-methods-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_26_magic_methods_beginner_friendly.ipynb</code></div>

# Chapter 26 — Magic Methods in Python

This notebook follows the same beginner-friendly teaching style as the recent advanced chapters.

## Start here: one-line meaning

**Magic methods let your custom objects work better with normal Python behavior.**

## Tiny memory guide

- `__init__` = build the object  
- `__str__` = show the object nicely  
- `__repr__` = show the object clearly for debugging  

## Before you begin

The word “magic” may sound advanced, but the idea is not too scary.

You already know one magic method:

- `__init__`

In this chapter, we build from that familiar starting point.

## Example 1: A class with only __init__

**What this teaches:** This revisits the constructor method, which is already a magic method.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

p = Person("Asha", 25)
print(p.name)
print(p.age)
```

</div>

## Example 2: Printing an object without __str__

**What this teaches:** Without `__str__`, Python shows the default object form, which is not very readable.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

p = Person("Ravi", 30)
print(p)
```

</div>

## Example 3: Adding __str__

**What this teaches:** `__str__` makes printed output much friendlier.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __str__(self):
        return f"Person(name={self.name}, age={self.age})"

p = Person("Ravi", 30)
print(p)
```

</div>

## Example 4: Using str() directly

**What this teaches:** `str(obj)` also uses the `__str__` method.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return f"Person: {self.name}"

p = Person("Meera")
print(str(p))
```

</div>

## Example 5: Adding __repr__

**What this teaches:** `__repr__` is more useful for debugging and inspection.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __repr__(self):
        return f"Person(name={self.name!r}, age={self.age!r})"

p = Person("Ali", 28)
print(repr(p))
```

</div>

## Example 6: Using both __str__ and __repr__

**What this teaches:** This is the key comparison: readable output vs debug-style output.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __str__(self):
        return f"{self.name} is {self.age} years old"

    def __repr__(self):
        return f"Person(name={self.name!r}, age={self.age!r})"

p = Person("Sara", 26)
print(p)
print(repr(p))
```

</div>

## Example 7: A Book class with __str__

**What this teaches:** Friendly object printing is useful in real classes too.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __str__(self):
        return f"'{self.title}' by {self.author}"

book = Book("Python Basics", "John")
print(book)
```

</div>

## Example 8: A Book class with __repr__

**What this teaches:** Debug-style output can be more explicit than user-friendly output.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __repr__(self):
        return f"Book(title={self.title!r}, author={self.author!r})"

book = Book("Python Basics", "John")
print(repr(book))
```

</div>

## Example 9: A Rectangle class with friendly printing

**What this teaches:** Geometric or data objects become easier to read with `__str__`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class Rectangle:
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def __str__(self):
        return f"Rectangle({self.length} x {self.width})"

r = Rectangle(5, 3)
print(r)
```

</div>

## Example 10: Debug-friendly rectangle

**What this teaches:** `__repr__` gives a clearer official object description.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class Rectangle:
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def __repr__(self):
        return f"Rectangle(length={self.length!r}, width={self.width!r})"

r = Rectangle(5, 3)
print(repr(r))
```

</div>

## Example 11: Why __str__ improves readability

**What this teaches:** This reminds you what printing looks like before adding `__str__`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks

s = Student("Asha", 95)
print(s)
```

</div>

## Example 12: Improved student output with __str__

**What this teaches:** Now the same class prints in a clearer way.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks

    def __str__(self):
        return f"Student {self.name} scored {self.marks}"

s = Student("Asha", 95)
print(s)
```

</div>

## Example 13: A simple bank account debug representation

**What this teaches:** `__repr__` is useful for object inspection in practical classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class BankAccount:
    def __init__(self, holder, balance):
        self.holder = holder
        self.balance = balance

    def __repr__(self):
        return f"BankAccount(holder={self.holder!r}, balance={self.balance!r})"

account = BankAccount("Ravi", 1500)
print(repr(account))
```

</div>

## Example 14: List of objects with __repr__

**What this teaches:** When objects appear inside a list, `__repr__` becomes especially important.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"

people = [Person("Asha"), Person("Ravi"), Person("Meera")]
print(people)
```

</div>

## Example 15: Small combined example

**What this teaches:** This combines the chapter’s main ideas in one place.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __str__(self):
        return f"{self.name} ({self.age})"

    def __repr__(self):
        return f"Person(name={self.name!r}, age={self.age!r})"

p = Person("John", 32)

print("Using print():", p)
print("Using str():", str(p))
print("Using repr():", repr(p))
```

</div>

## 5. Common confusion cleared up

### __str__ vs __repr__

- `__str__` = for users / readable output
- `__repr__` = for developers / debugging

### One sentence to remember

> Magic methods help your custom objects behave better with built-in Python features.

## 6. Common mistakes

- thinking `__init__` is the only magic method
- confusing `__str__` and `__repr__`
- forgetting to return a string
- bad indentation inside classes

## 7. Mentor tips / best practices

- learn `__init__`, `__str__`, and `__repr__` first
- keep object output simple and useful
- compare print output before and after adding `__str__`
- use `__repr__` for debugging-friendly clarity

## 8. Practice tasks

1. Create a class with `__init__`.
2. Print it before adding `__str__`.
3. Add `__str__`.
4. Add `__repr__`.
5. Try printing a list of custom objects.

## 9. Revision notes

- magic methods use double underscores
- `__init__` builds objects
- `__str__` improves friendly printing
- `__repr__` improves debug printing
- these methods make custom classes feel more natural in Python
