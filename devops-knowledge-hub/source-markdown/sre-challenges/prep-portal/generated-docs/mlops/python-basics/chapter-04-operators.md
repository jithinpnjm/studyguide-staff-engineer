---
title: "Chapter 04 Operators"
description: "Generated from mlops/PYTHON/Basics/chapter_04_operators.ipynb"
slug: "/python-basics/chapter-04-operators"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_04_operators.ipynb</code></div>

# Chapter 4 — Operators

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What operators do
Operators perform actions on values. They are central to calculations, decisions, and data processing.

### Arithmetic operators
Use +, -, *, /, //, %, and ** for calculations.

### Comparison operators
Comparison operators return True or False.

### Logical operators
and requires both conditions, or requires at least one, and not reverses a boolean.

### String comparison
Python compares strings exactly and is case-sensitive.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Arithmetic example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
a = 10
b = 3
print(a + b)
print(a / b)
print(a // b)
print(a % b)
print(a ** b)
```

</div>

**What this example teaches:** It shows the main idea behind **arithmetic example** and gives you a runnable reference you can modify while practicing.

### Comparison example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
x = 10
y = 20
print(x == y)
print(x != y)
print(x < y)
```

</div>

**What this example teaches:** It shows the main idea behind **comparison example** and gives you a runnable reference you can modify while practicing.

### Logical example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
age = 20
print(age > 18 and age < 30)
print(age < 18 or age == 20)
print(not(age > 18))
```

</div>

**What this example teaches:** It shows the main idea behind **logical example** and gives you a runnable reference you can modify while practicing.

### String comparison
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
print("apple" == "apple")
print("apple" == "Apple")
```

</div>

**What this example teaches:** It shows the main idea behind **string comparison** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Using = instead of ==
- Forgetting to convert input before numeric operations
- Misunderstanding / versus //

## 5. Mentor tips / best practices

- Use parentheses to make complex logic easier to read.
- Print intermediate boolean checks while debugging conditions.
- Use % for divisibility, parity, and cycle-based problems.

## 6. Practice tasks with sample solutions

### Practice task 1
Find the remainder when 17 is divided by 5.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
print(17 % 5)
```

</div>

### Practice task 2
Check if a number is even.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
num = 14
print(num % 2 == 0)
```

</div>

### Practice task 3
Compare two numbers and print the larger one.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
a = 12
b = 20
print(a if a > b else b)
```

</div>

## 7. Revision notes

- Arithmetic operators calculate
- Comparison operators return booleans
- Logical operators combine conditions
- % is very useful for divisibility checks
