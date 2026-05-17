---
title: "Chapter 03 Data Types"
description: "Generated from mlops/PYTHON/Basics/chapter_03_data_types.ipynb"
slug: "/python-basics/chapter-03-data-types"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_03_data_types.ipynb</code></div>

# Chapter 3 — Data Types

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### Why data types matter
A data type tells Python what kind of value is stored, and that controls which operations are valid.

### Core built-in types
int stores whole numbers, float stores decimal numbers, str stores text, and bool stores True or False.

### Type conversion
Conversion is needed when program parts produce different kinds of values, especially with input().

### String vs number confusion
'10' + '20' joins text as '1020'. Converting to int gives numeric addition.

### Booleans and truth values
0, empty strings, and empty collections are usually False in conditions. Non-zero values and non-empty strings are usually True.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Core types
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
age = 25
price = 19.99
name = "Python"
is_student = True
print(type(age), type(price), type(name), type(is_student))
```

</div>

**What this example teaches:** It shows the main idea behind **core types** and gives you a runnable reference you can modify while practicing.

### Type conversion
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
print(int("100"))
print(float("3.14"))
print(str(25))
print(bool(1))
```

</div>

**What this example teaches:** It shows the main idea behind **type conversion** and gives you a runnable reference you can modify while practicing.

### String vs number
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
a = "10"
b = "20"
print(a + b)
print(int(a) + int(b))
```

</div>

**What this example teaches:** It shows the main idea behind **string vs number** and gives you a runnable reference you can modify while practicing.

### Truth values
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
print(bool(0))
print(bool(1))
print(bool(""))
print(bool("Hi"))
```

</div>

**What this example teaches:** It shows the main idea behind **truth values** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Mixing strings and integers without conversion
- Assuming input() gives a number automatically
- Not checking types when unexpected behavior appears

## 5. Mentor tips / best practices

- Whenever output looks strange, inspect the type first.
- Convert as close as possible to the source of the data.
- Be especially careful with text from files, forms, and input().

## 6. Practice tasks with sample solutions

### Practice task 1
Create one variable of each core type.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
age = 30
price = 99.5
name = "Lina"
active = True
print(age, price, name, active)
```

</div>

### Practice task 2
Convert '50' to an integer.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
value = int("50")
print(value, type(value))
```

</div>

### Practice task 3
Convert 12 to a string.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
text = str(12)
print(text, type(text))
```

</div>

## 7. Revision notes

- int = whole number
- float = decimal number
- str = text
- bool = logical value
- Type conversion is a core Python skill
