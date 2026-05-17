---
title: "Chapter 28 Operator Overloading Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_28_operator_overloading_beginner_friendly.ipynb"
slug: "/python-basics/chapter-28-operator-overloading-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_28_operator_overloading_beginner_friendly.ipynb</code></div>

# Chapter 28 — Operator Overloading in Python

This notebook follows the same beginner-friendly teaching style as the recent advanced chapters.

## Start here: one-line meaning

**Operator overloading means teaching Python operators like `+`, `-`, and `==` how to work with your own classes.**

## Tiny memory guide

- `+` uses `__add__`  
- `-` uses `__sub__`  
- `==` uses `__eq__`  
- `>` can use `__gt__`  
- `<` can use `__lt__`  
- `__repr__` helps show the object clearly  

## Before you begin

This chapter becomes much easier if you think like this:

Python already knows how `+` works for numbers:

- `2 + 3 = 5`

But if you make your own class, like a `Vector`, Python does **not** automatically know how to add two vector objects.

Operator overloading lets you define that behavior yourself.

## Example 1: A simple class without operator overloading

**What this teaches:** Without operator overloading, Python does not know how to use `+` with your custom objects.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

v1 = Vector(2, 3)
v2 = Vector(4, 5)

# print(v1 + v2)   # This would raise an error
print("Vector objects created")
```

</div>

## Example 2: Adding __repr__ for better display

**What this teaches:** Before overloading operators, it helps to make objects easier to read using `__repr__`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Vector(x={self.x}, y={self.y})"

v = Vector(2, 3)
print(v)
```

</div>

## Example 3: Overloading the + operator with __add__

**What this teaches:** The `__add__` method tells Python what `+` should mean for your custom class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __repr__(self):
        return f"Vector(x={self.x}, y={self.y})"

v1 = Vector(2, 3)
v2 = Vector(4, 5)

print(v1 + v2)
```

</div>

## Example 4: Overloading the - operator with __sub__

**What this teaches:** The `__sub__` method defines how subtraction should work.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y)

    def __repr__(self):
        return f"Vector(x={self.x}, y={self.y})"

v1 = Vector(10, 8)
v2 = Vector(3, 2)

print(v1 - v2)
```

</div>

## Example 5: Overloading equality with __eq__

**What this teaches:** The `__eq__` method lets Python compare two objects using `==`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

v1 = Vector(2, 3)
v2 = Vector(2, 3)
v3 = Vector(5, 6)

print(v1 == v2)
print(v1 == v3)
```

</div>

## Example 6: Full Vector class with +, -, and ==

**What this teaches:** This combines the most important operator overloading methods in one class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y)

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __repr__(self):
        return f"Vector(x={self.x}, y={self.y})"

v1 = Vector(2, 3)
v2 = Vector(4, 5)

print("Addition:", v1 + v2)
print("Subtraction:", v1 - v2)
print("Equality:", v1 == v2)
```

</div>

## Example 7: Greater than with __gt__

**What this teaches:** You can also overload comparison operators like `>`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class Box:
    def __init__(self, weight):
        self.weight = weight

    def __gt__(self, other):
        return self.weight > other.weight

b1 = Box(10)
b2 = Box(7)

print(b1 > b2)
```

</div>

## Example 8: Less than with __lt__

**What this teaches:** The `__lt__` method defines how `<` should work.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class Box:
    def __init__(self, weight):
        self.weight = weight

    def __lt__(self, other):
        return self.weight < other.weight

b1 = Box(4)
b2 = Box(9)

print(b1 < b2)
```

</div>

## Example 9: Adding two bank balances

**What this teaches:** Operator overloading can make custom classes feel more natural to use.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class Balance:
    def __init__(self, amount):
        self.amount = amount

    def __add__(self, other):
        return Balance(self.amount + other.amount)

    def __repr__(self):
        return f"Balance(amount={self.amount})"

b1 = Balance(1000)
b2 = Balance(2500)

print(b1 + b2)
```

</div>

## Example 10: A point class with equality and representation

**What this teaches:** Sometimes operator overloading is useful even without arithmetic.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __repr__(self):
        return f"Point(x={self.x}, y={self.y})"

p1 = Point(1, 2)
p2 = Point(1, 2)

print(p1)
print(p1 == p2)
```

</div>

## Example 11: A practical student marks comparison

**What this teaches:** Comparison overloading can be based on meaningful object data.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks

    def __gt__(self, other):
        return self.marks > other.marks

s1 = Student("Asha", 90)
s2 = Student("Ravi", 82)

print(s1 > s2)
```

</div>

## Example 12: Why __repr__ matters after overloading

**What this teaches:** When overloaded operations return new objects, `__repr__` makes results readable.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

v1 = Vector(1, 2)
v2 = Vector(3, 4)

result = v1 + v2
print(result)
```

</div>

## Example 13: Improved version with __repr__

**What this teaches:** The same result becomes much clearer after adding `__repr__`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __repr__(self):
        return f"Vector(x={self.x}, y={self.y})"

v1 = Vector(1, 2)
v2 = Vector(3, 4)

result = v1 + v2
print(result)
```

</div>

## Example 14: Overloading with a custom Product class

**What this teaches:** Operator overloading can be used outside math too, but it should still make sense.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class Product:
    def __init__(self, price):
        self.price = price

    def __add__(self, other):
        return Product(self.price + other.price)

    def __repr__(self):
        return f"Product(price={self.price})"

p1 = Product(500)
p2 = Product(700)

print(p1 + p2)
```

</div>

## Example 15: Full beginner-friendly vector demo

**What this teaches:** This is the chapter’s main example: a complete vector class with readable output and multiple overloaded operators.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y)

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __repr__(self):
        return f"Vector(x={self.x}, y={self.y})"

v1 = Vector(5, 7)
v2 = Vector(2, 3)
v3 = Vector(5, 7)

print("v1:", v1)
print("v2:", v2)
print("v1 + v2 =", v1 + v2)
print("v1 - v2 =", v1 - v2)
print("v1 == v2 ?", v1 == v2)
print("v1 == v3 ?", v1 == v3)
```

</div>

## 5. Common confusion cleared up

### Magic methods vs operator overloading

- magic methods = special methods with double underscores
- operator overloading = using those magic methods to define operator behavior

### What does + really do here?

When Python sees:

```python
obj1 + obj2
```

it really tries to call:

```python
obj1.__add__(obj2)
```

That is the hidden idea behind operator overloading.

### One sentence to remember

> Operator overloading means giving Python operators meaning for your own custom classes.

## 6. Common mistakes

- forgetting to return a new object
- forgetting to add `__repr__`, which makes results harder to understand
- overloading operators in ways that do not make logical sense
- confusing `__eq__` with assignment `=`

## 7. Mentor tips / best practices

- start with `__add__`, `__sub__`, and `__eq__`
- use operator overloading only when it makes real sense
- keep object output readable with `__repr__`
- test operators one at a time
- begin with small classes like `Vector` or `Point`

## 8. Practice tasks

1. Create a `Vector` class with `x` and `y`.
2. Add `__repr__`.
3. Add `__add__`.
4. Add `__sub__`.
5. Add `__eq__`.
6. Try `__gt__` or `__lt__` with another class.
7. Build one operator-overloading example of your own.

## 9. Revision notes

- operator overloading uses magic methods
- `__add__` defines `+`
- `__sub__` defines `-`
- `__eq__` defines `==`
- `__gt__` defines `>`
- `__lt__` defines `<`
- `__repr__` helps display results clearly
- operator overloading makes custom classes feel more natural in Python
