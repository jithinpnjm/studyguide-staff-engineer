---
title: "Chapter 08 Sets"
description: "Generated from mlops/PYTHON/Basics/chapter_08_sets.ipynb"
slug: "/python-basics/chapter-08-sets"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_08_sets.ipynb</code></div>

# Chapter 8 — Sets

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What is a set?
A set stores unique values. Duplicate entries are removed automatically.

### Creating sets
Use curly braces for a non-empty set and set() for an empty one.

### Set methods
add(), remove(), discard(), pop(), and clear() are common set methods.

### Membership testing
The in keyword is especially useful with sets.

### Set operations
Sets support union, intersection, difference, and symmetric difference.

### Practical example — removing duplicates
A set is a quick way to remove duplicates from a list.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Unique values
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
numbers = {1, 2, 3, 3, 4}
print(numbers)
```

</div>

**What this example teaches:** It shows the main idea behind **unique values** and gives you a runnable reference you can modify while practicing.

### Creating sets
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
fruits = {"apple", "banana", "orange"}
empty_set = set()
print(fruits)
print(empty_set)
```

</div>

**What this example teaches:** It shows the main idea behind **creating sets** and gives you a runnable reference you can modify while practicing.

### Membership
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
fruits = {"apple", "banana"}
print("apple" in fruits)
```

</div>

**What this example teaches:** It shows the main idea behind **membership** and gives you a runnable reference you can modify while practicing.

### Set operations
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
a = {1, 2, 3}
b = {3, 4, 5}
print(a | b)
print(a & b)
print(a - b)
print(a ^ b)
```

</div>

**What this example teaches:** It shows the main idea behind **set operations** and gives you a runnable reference you can modify while practicing.

### Removing duplicates
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
nums = [1, 2, 2, 3, 3, 4]
unique_nums = set(nums)
print(unique_nums)
```

</div>

**What this example teaches:** It shows the main idea behind **removing duplicates** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Using {} and expecting an empty set
- Assuming the order of a set will stay fixed
- Trying to store unhashable values like lists inside a set

## 5. Mentor tips / best practices

- Use discard() when you want safe removal without errors.
- Convert back to list if you need indexing after deduplication.
- Sets are excellent for fast membership checks.

## 6. Practice tasks with sample solutions

### Practice task 1
Create two sets and find their union.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
a = {1, 2, 3}
b = {3, 4, 5}
print(a | b)
```

</div>

### Practice task 2
Find their intersection.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
a = {1, 2, 3}
b = {3, 4, 5}
print(a & b)
```

</div>

### Practice task 3
Remove duplicates from a list using a set.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
items = [1, 1, 2, 3, 3, 4]
print(list(set(items)))
```

</div>

## 7. Revision notes

- Sets store unique values
- They are great for duplicate removal
- Membership checking is fast
- Order is not guaranteed
