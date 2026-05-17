---
title: "Chapter 02 Variables"
description: "Generated from mlops/PYTHON/Basics/chapter_02_variables.ipynb"
slug: "/python-basics/chapter-02-variables"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_02_variables.ipynb</code></div>

# Chapter 2 — Variables

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What is a variable?
A variable is a named storage box for a value. Variables make programs easier to read and update.

### Assignment in Python
Variables are created when you assign a value. You do not need to declare a type first.

### Naming rules
A variable can start with a letter or underscore, can contain letters, numbers, and underscores, and cannot be a Python keyword.

### Good naming habits
Meaningful names reduce confusion. total_price is better than x.

### Dynamic typing
Python is dynamically typed. A variable can later point to a value of a different type.

### Checking variable types
Use type() while learning and debugging.

### User input
input() always returns a string. Convert it with int() or float() if you need numbers.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Basic variables
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
age = 25
name = "Alice"
height = 1.72
print(age, name, height)
```

</div>

**What this example teaches:** It shows the main idea behind **basic variables** and gives you a runnable reference you can modify while practicing.

### Naming habit
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
total_price = 500
student_age = 18
print(total_price, student_age)
```

</div>

**What this example teaches:** It shows the main idea behind **naming habit** and gives you a runnable reference you can modify while practicing.

### Dynamic typing
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
x = 10
print(type(x))
x = "Python"
print(type(x))
```

</div>

**What this example teaches:** It shows the main idea behind **dynamic typing** and gives you a runnable reference you can modify while practicing.

### Using type()
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
age = 25
print(type(age))
```

</div>

**What this example teaches:** It shows the main idea behind **using type()** and gives you a runnable reference you can modify while practicing.

### Input conversion
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
user_age_text = "21"  # simulate input()
user_age = int(user_age_text)
print(user_age + 1)
```

</div>

**What this example teaches:** It shows the main idea behind **input conversion** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Using a variable before defining it
- Forgetting that input() returns a string
- Choosing vague names that make debugging harder

## 5. Mentor tips / best practices

- Use names that describe purpose, not just type.
- During debugging, print both the variable and type(variable).
- Keep variable names lowercase_with_underscores for readability.

## 6. Practice tasks with sample solutions

### Practice task 1
Ask the user for their name and age, then greet them.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
name = "Sara"  # replace with input("Enter your name: ")
age = 22      # replace with int(input("Enter your age: "))
print(f"Hello {name}, you are {age} years old.")
```

</div>

### Practice task 2
Create a variable and later change it from int to string.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 35</div>

```python
value = 10
print(value, type(value))
value = "ten"
print(value, type(value))
```

</div>

### Practice task 3
Use type() on three different variables.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 37</div>

```python
a = 10
b = 3.14
c = "hello"
print(type(a), type(b), type(c))
```

</div>

## 7. Revision notes

- Variables store values
- Assignment creates variables
- input() returns strings by default
- Meaningful names improve code quality
