---
title: "Chapter 10 Dictionaries"
description: "Generated from mlops/PYTHON/Basics/chapter_10_dictionaries.ipynb"
slug: "/python-basics/chapter-10-dictionaries"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_10_dictionaries.ipynb</code></div>

# Chapter 10 — Dictionaries

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What is a dictionary?
A dictionary stores key-value pairs. It is ideal for structured data looked up by name rather than index.

### Why dictionaries matter
Dictionaries model users, products, settings, counters, and many real-world records.

### Accessing values
Direct key access is straightforward. get() is safer when a key may not exist.

### Modifying dictionaries
Dictionaries are mutable: you can add, update, and delete items.

### Useful methods
keys(), values(), and items() are commonly used.

### Iteration pattern
Looping through .items() is one of the most important dictionary patterns.

### Nested dictionaries
A dictionary can store other dictionaries.

### Dictionary comprehension
This is a concise way to build dictionaries.

### Practical example — frequency count
Counting frequencies with get() is a very common coding pattern.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Basic dictionary
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
student = {"name": "Alice", "age": 21, "grade": "A"}
print(student)
```

</div>

**What this example teaches:** It shows the main idea behind **basic dictionary** and gives you a runnable reference you can modify while practicing.

### Accessing safely
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
student = {"name": "Alice", "age": 21, "grade": "A"}
print(student["name"])
print(student.get("city", "Not Found"))
```

</div>

**What this example teaches:** It shows the main idea behind **accessing safely** and gives you a runnable reference you can modify while practicing.

### Modify dictionary
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
student = {"name": "Alice", "age": 21, "grade": "A"}
student["age"] = 22
student["city"] = "Berlin"
del student["grade"]
print(student)
```

</div>

**What this example teaches:** It shows the main idea behind **modify dictionary** and gives you a runnable reference you can modify while practicing.

### Iterating items
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
student = {"name": "Alice", "age": 22, "city": "Berlin"}
for key, value in student.items():
    print(key, value)
```

</div>

**What this example teaches:** It shows the main idea behind **iterating items** and gives you a runnable reference you can modify while practicing.

### Nested dictionaries
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
students = {
    "student1": {"name": "Alice", "age": 21},
    "student2": {"name": "Bob", "age": 22}
}
print(students["student1"]["name"])
```

</div>

**What this example teaches:** It shows the main idea behind **nested dictionaries** and gives you a runnable reference you can modify while practicing.

### Dictionary comprehension
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
squares = {x: x * x for x in range(5)}
print(squares)
```

</div>

**What this example teaches:** It shows the main idea behind **dictionary comprehension** and gives you a runnable reference you can modify while practicing.

### Frequency count
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
numbers = [1, 2, 2, 3, 3, 3]
freq = {}
for num in numbers:
    freq[num] = freq.get(num, 0) + 1
print(freq)
```

</div>

**What this example teaches:** It shows the main idea behind **frequency count** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Using mutable values as keys
- Expecting missing keys to return a value automatically
- Forgetting that keys must be unique

## 5. Mentor tips / best practices

- Use get() when you are not sure a key exists.
- Use .items() when you need both key and value in a loop.
- Frequency-count problems are great dictionary practice.

## 6. Practice tasks with sample solutions

### Practice task 1
Create a dictionary for a book.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 41</div>

```python
book = {"title": "Python Basics", "author": "Sam", "pages": 240}
print(book)
```

</div>

### Practice task 2
Add one more field and print all keys.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 43</div>

```python
book = {"title": "Python Basics", "author": "Sam", "pages": 240}
book["year"] = 2026
print(book.keys())
```

</div>

### Practice task 3
Count frequency of letters in a word.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 45</div>

```python
word = "banana"
freq = {}
for ch in word:
    freq[ch] = freq.get(ch, 0) + 1
print(freq)
```

</div>

## 7. Revision notes

- Dictionaries use keys, not indexes
- Keys must be unique
- get() is often safer than direct access
- Dictionaries are excellent for counting and structured records
