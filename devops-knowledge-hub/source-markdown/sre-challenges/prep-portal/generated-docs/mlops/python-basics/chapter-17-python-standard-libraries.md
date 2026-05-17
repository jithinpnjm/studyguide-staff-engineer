---
title: "Chapter 17 Python Standard Libraries"
description: "Generated from mlops/PYTHON/Basics/chapter_17_python_standard_libraries.ipynb"
slug: "/python-basics/chapter-17-python-standard-libraries"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_17_python_standard_libraries.ipynb</code></div>

# Chapter 17 — Python Standard Libraries

This notebook follows your study-guide format with explanations, runnable examples, common mistakes, mentor tips, practice tasks, and revision notes.

## 1. Chapter title

**Python Standard Libraries**

## 2. Concept explanation

Python's standard library gives you many useful modules without extra installation.

This chapter focuses on:
- `array`
- `math`
- `random`
- `os`
- `json`
- `csv`
- `datetime`
- `time`
- `re`

## Example 1: Using the array module

This introduces typed arrays.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
import array

numbers = array.array('i', [1, 2, 3, 4, 5])
print(numbers)
```

</div>

## Example 2: Using the math module

This shows common math operations.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
import math

print(math.sqrt(49))
print(math.pi)
print(math.factorial(5))
```

</div>

## Example 3: Using random

This shows random number generation and random selection.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
import random

print(random.randint(1, 10))
print(random.choice(['apple', 'banana', 'cherry']))
```

</div>

## Example 4: Shuffling a list

This shows in-place shuffling.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
import random

cards = ['A', 'K', 'Q', 'J']
random.shuffle(cards)
print(cards)
```

</div>

## Example 5: Using os

This helps you inspect the current working directory and files.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
import os

print(os.getcwd())
print(os.listdir('.')[:10])
```

</div>

## Example 6: JSON conversion

This shows serialization and deserialization.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
import json

student = {'name': 'Asha', 'age': 21, 'course': 'Python'}
json_data = json.dumps(student)
print(json_data)
print(json.loads(json_data))
```

</div>

## Example 7: CSV writing and reading

This demonstrates simple CSV output and input.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
import csv

rows = [['Name', 'Age'], ['Aman', 22], ['Sara', 24]]
with open('students_demo.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerows(rows)

with open('students_demo.csv', 'r') as file:
    reader = csv.reader(file)
    for row in reader:
        print(row)
```

</div>

## Example 8: Datetime and regex

This combines two useful standard library tools: dates and pattern matching.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
from datetime import datetime
import re

now = datetime.now()
print(now.year)
text = 'Room 4, Floor 12'
print(re.findall(r'\\d+', text))
```

</div>
