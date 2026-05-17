---
title: "Chapter 09 Tuples"
description: "Generated from mlops/PYTHON/Basics/chapter_09_tuples.ipynb"
slug: "/python-basics/chapter-09-tuples"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_09_tuples.ipynb</code></div>

# Chapter 9 — Tuples

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What is a tuple?
A tuple is an ordered collection like a list, but it is immutable.

### Why tuples matter
Tuples are useful for fixed records, returning multiple values from functions, and structured data that should not change.

### Accessing tuple elements
You can index and slice tuples just like lists.

### Tuple operations
Tuples can be concatenated and repeated.

### Tuple methods
count() and index() are the main built-in tuple methods.

### Packing and unpacking
Packing groups values into a tuple. Unpacking assigns them to variables in one step.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Basic tuple
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
numbers = (1, 2, 3)
print(numbers)
```

</div>

**What this example teaches:** It shows the main idea behind **basic tuple** and gives you a runnable reference you can modify while practicing.

### Accessing values
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
numbers = (10, 20, 30, 40)
print(numbers[0])
print(numbers[1:3])
```

</div>

**What this example teaches:** It shows the main idea behind **accessing values** and gives you a runnable reference you can modify while practicing.

### Tuple operations
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
t1 = (1, 2)
t2 = (3, 4)
print(t1 + t2)
print(("Python",) * 3)
```

</div>

**What this example teaches:** It shows the main idea behind **tuple operations** and gives you a runnable reference you can modify while practicing.

### Tuple methods
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
nums = (1, 2, 2, 3)
print(nums.count(2))
print(nums.index(3))
```

</div>

**What this example teaches:** It shows the main idea behind **tuple methods** and gives you a runnable reference you can modify while practicing.

### Packing and unpacking
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
person = ("Alice", 25, "Engineer")
name, age, profession = person
print(name)
print(age)
print(profession)
```

</div>

**What this example teaches:** It shows the main idea behind **packing and unpacking** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Trying to modify tuple elements
- Forgetting the comma in a one-item tuple

## 5. Mentor tips / best practices

- Use tuples for data that should stay fixed.
- Return multiple values from functions naturally using tuples.
- When unpacking, make sure the number of variables matches the tuple size.

## 6. Practice tasks with sample solutions

### Practice task 1
Create a tuple of 5 items.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
items = ("pen", "book", "bag", "bottle", "phone")
print(items)
```

</div>

### Practice task 2
Print the first and last item.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
items = ("pen", "book", "bag", "bottle", "phone")
print(items[0], items[-1])
```

</div>

### Practice task 3
Unpack a tuple into variables.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
person = ("Mia", 19, "Student")
name, age, role = person
print(name, age, role)
```

</div>

## 7. Revision notes

- Tuples are ordered
- Tuples are immutable
- Packing and unpacking are important Python patterns
