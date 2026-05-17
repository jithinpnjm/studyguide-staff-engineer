---
title: "Chapter 07 Practical Applications Of Lists"
description: "Generated from mlops/PYTHON/Basics/chapter_07_practical_applications_of_lists.ipynb"
slug: "/python-basics/chapter-07-practical-applications-of-lists"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_07_practical_applications_of_lists.ipynb</code></div>

# Chapter 7 — Practical Applications of Lists

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What is a list?
A list stores multiple values in one variable. Lists are ordered and mutable.

### To-do list example
Lists are perfect for task tracking because items can be added and removed.

### Student grades example
Lists work well with max(), min(), sum(), and len().

### Inventory example
Inventory changes over time, so a list is useful for a simple model.

### Feedback example
Lists can store text and support simple analysis patterns.

### Useful list methods
append(), remove(), pop(), sort(), reverse(), insert(), count(), and index() are worth mastering.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Basic list
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
fruits = ["apple", "banana", "orange"]
print(fruits)
```

</div>

**What this example teaches:** It shows the main idea behind **basic list** and gives you a runnable reference you can modify while practicing.

### To-do list
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
tasks = []
tasks.append("Buy groceries")
tasks.append("Complete homework")
tasks.append("Exercise")
print(tasks)
tasks.remove("Exercise")
print(tasks)
```

</div>

**What this example teaches:** It shows the main idea behind **to-do list** and gives you a runnable reference you can modify while practicing.

### Grades
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
grades = [85, 90, 78, 92, 88]
print("Highest:", max(grades))
print("Lowest:", min(grades))
print("Average:", sum(grades) / len(grades))
```

</div>

**What this example teaches:** It shows the main idea behind **grades** and gives you a runnable reference you can modify while practicing.

### Inventory
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
inventory = ["Laptop", "Mouse", "Keyboard"]
inventory.append("Monitor")
inventory.remove("Mouse")
print(inventory)
```

</div>

**What this example teaches:** It shows the main idea behind **inventory** and gives you a runnable reference you can modify while practicing.

### Feedback count
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
feedback = ["great service", "excellent product", "great experience"]
count_great = sum(1 for item in feedback if "great" in item)
print(count_great)
```

</div>

**What this example teaches:** It shows the main idea behind **feedback count** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Removing a value that is not present
- Using an index that is out of range
- Confusing append() with extend()

## 5. Mentor tips / best practices

- Use append() for one item and extend() for many items.
- Check len(my_list) before using risky indexes.
- Lists are mutable, so methods often change the original list in place.

## 6. Practice tasks with sample solutions

### Practice task 1
Create a shopping list and add three items.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
shopping = []
shopping.append("Milk")
shopping.append("Bread")
shopping.append("Eggs")
print(shopping)
```

</div>

### Practice task 2
Remove one item and print total number of items.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
shopping = ["Milk", "Bread", "Eggs"]
shopping.remove("Bread")
print(len(shopping))
```

</div>

### Practice task 3
Find max and min in a marks list.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
marks = [72, 81, 95, 67]
print(max(marks), min(marks))
```

</div>

## 7. Revision notes

- Lists store multiple values
- Lists are mutable
- append() and remove() are core tools
- Lists are one of the most common Python structures
