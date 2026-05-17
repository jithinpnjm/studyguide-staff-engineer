---
title: "Chapter 06 Loops"
description: "Generated from mlops/PYTHON/Basics/chapter_06_loops.ipynb"
slug: "/python-basics/chapter-06-loops"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_06_loops.ipynb</code></div>

# Chapter 6 — Loops

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### Why loops matter
Loops repeat code automatically. They are essential for counting, processing collections, searching, and automation.

### for loops
Use a for loop when you want to iterate over a sequence or values from range().

### Understanding range()
range(stop) starts at 0, range(start, stop) starts where you specify, and range(start, stop, step) controls the increment.

### while loops
A while loop runs as long as its condition remains True.

### Loop control statements
break stops the loop, continue skips to the next iteration, and pass is a placeholder.

### Nested loops
Nested loops are useful for grids, tables, patterns, and pairwise checks.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### for loop
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
for i in range(5):
    print(i)
```

</div>

**What this example teaches:** It shows the main idea behind **for loop** and gives you a runnable reference you can modify while practicing.

### while loop
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
i = 0
while i < 5:
    print(i)
    i += 1
```

</div>

**What this example teaches:** It shows the main idea behind **while loop** and gives you a runnable reference you can modify while practicing.

### break
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
for i in range(10):
    if i == 5:
        break
    print(i)
```

</div>

**What this example teaches:** It shows the main idea behind **break** and gives you a runnable reference you can modify while practicing.

### continue
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
for i in range(5):
    if i == 2:
        continue
    print(i)
```

</div>

**What this example teaches:** It shows the main idea behind **continue** and gives you a runnable reference you can modify while practicing.

### Nested loops
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
for i in range(3):
    for j in range(2):
        print(i, j)
```

</div>

**What this example teaches:** It shows the main idea behind **nested loops** and gives you a runnable reference you can modify while practicing.

### Sum of first n numbers
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
n = 5
total = 0
for i in range(1, n + 1):
    total += i
print(total)
```

</div>

**What this example teaches:** It shows the main idea behind **sum of first n numbers** and gives you a runnable reference you can modify while practicing.

### Prime numbers up to 30
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
for num in range(2, 31):
    is_prime = True
    for i in range(2, num):
        if num % i == 0:
            is_prime = False
            break
    if is_prime:
        print(num)
```

</div>

**What this example teaches:** It shows the main idea behind **prime numbers up to 30** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Forgetting to update the counter in a while loop
- Using the wrong range boundaries
- Putting too much logic into deeply nested loops

## 5. Mentor tips / best practices

- Start with a small range first when debugging loops.
- Print loop variables to understand the pattern.
- For while loops, always check how the condition will eventually become False.

## 6. Practice tasks with sample solutions

### Practice task 1
Print numbers 1 to 10.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 38</div>

```python
for i in range(1, 11):
    print(i)
```

</div>

### Practice task 2
Print even numbers from 1 to 20.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 40</div>

```python
for i in range(2, 21, 2):
    print(i)
```

</div>

### Practice task 3
Find the sum of the first 50 natural numbers.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 42</div>

```python
total = 0
for i in range(1, 51):
    total += i
print(total)
```

</div>

### Practice task 4
Print the multiplication table of 5.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 44</div>

```python
for i in range(1, 11):
    print(f"5 x {i} = {5 * i}")
```

</div>

## 7. Revision notes

- for = iterate over a sequence
- while = loop while condition stays True
- break stops a loop
- continue skips an iteration
- Nested loops handle more complex repetition
