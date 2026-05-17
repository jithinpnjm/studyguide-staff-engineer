---
title: "Chapter 05 Conditional Statements"
description: "Generated from mlops/PYTHON/Basics/chapter_05_conditional_statements.ipynb"
slug: "/python-basics/chapter-05-conditional-statements"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_05_conditional_statements.ipynb</code></div>

# Chapter 5 — Conditional Statements

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### Why conditionals matter
Programs often need to decide what to do next based on data. Conditionals create branching logic.

### The if statement
if runs a block only when its condition is True.

### The else statement
else provides the opposite branch when the if condition is False.

### The elif statement
elif lets you test multiple branches in order.

### Nested conditions
A condition can contain another condition for more detailed decisions.

### Practical example — leap year
Leap year logic is a classic example of layered conditional thinking.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### if example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
age = 20
if age >= 18:
    print("Eligible to vote")
```

</div>

**What this example teaches:** It shows the main idea behind **if example** and gives you a runnable reference you can modify while practicing.

### if/else example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
age = 15
if age >= 18:
    print("Eligible to vote")
else:
    print("Not eligible")
```

</div>

**What this example teaches:** It shows the main idea behind **if/else example** and gives you a runnable reference you can modify while practicing.

### if/elif/else example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
score = 75
if score >= 90:
    print("Grade A")
elif score >= 60:
    print("Grade B")
else:
    print("Grade C")
```

</div>

**What this example teaches:** It shows the main idea behind **if/elif/else example** and gives you a runnable reference you can modify while practicing.

### Nested condition
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
num = 8
if num > 0:
    if num % 2 == 0:
        print("Positive even")
    else:
        print("Positive odd")
else:
    print("Negative number")
```

</div>

**What this example teaches:** It shows the main idea behind **nested condition** and gives you a runnable reference you can modify while practicing.

### Leap year
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
year = 2024
if year % 4 == 0:
    if year % 100 == 0:
        if year % 400 == 0:
            print("Leap year")
        else:
            print("Not leap year")
    else:
        print("Leap year")
else:
    print("Not leap year")
```

</div>

**What this example teaches:** It shows the main idea behind **leap year** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Missing the colon after if, elif, or else
- Wrong indentation
- Placing broad conditions before specific ones

## 5. Mentor tips / best practices

- Read conditions from top to bottom and test representative values.
- Try edge cases such as 0, negative numbers, and exact boundary values.
- Break complex logic into smaller boolean variables for clarity.

## 6. Practice tasks with sample solutions

### Practice task 1
Print whether a number is positive, negative, or zero.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
num = -3
if num > 0:
    print("Positive")
elif num < 0:
    print("Negative")
else:
    print("Zero")
```

</div>

### Practice task 2
Check if a number is even or odd.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
num = 7
print("Even" if num % 2 == 0 else "Odd")
```

</div>

### Practice task 3
Build a simple ticket pricing system.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
age = 10
if age < 5:
    price = 0
elif age < 18:
    price = 5
else:
    price = 10
print(price)
```

</div>

## 7. Revision notes

- if checks a condition
- else handles the opposite path
- elif supports multiple branches
- Nested conditions allow more detailed decisions
