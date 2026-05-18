---
title: "Beginner"
sidebar_position: 1
---

# Python Fundamentals — Beginner

This guide covers Python from first principles. Every section is drawn from the python-basics source chapters (01–20) plus SRE-context examples. Work through it linearly; later sections assume the earlier ones.

---

## 1. Python Mental Model: Syntax and Semantics

**Syntax** is the writing-rule layer. Python must be able to parse your code before it runs a single line. Break a syntax rule and Python stops immediately with a `SyntaxError`.

**Semantics** is the meaning layer. Code can be syntactically valid but still fail because the operation makes no sense at runtime (`TypeError`, `ValueError`, etc.).

```python
# Syntax error — missing closing parenthesis (commented so file is valid)
# print("Hello"

# Valid syntax, semantic error — cannot add int and str
x = 10
y = "20"
# print(x + y)         # TypeError
print(x + int(y))      # 30 — fix by converting first
```

### Comments and docstrings

```python
# Single-line comment — ignored by Python

def greet(name):
    """Return a welcome message for the given name."""
    return f"Welcome, {name}!"

print(greet("Asha"))
```

### Case sensitivity

`age`, `Age`, and `AGE` are three completely different names. Most `NameError` bugs come from wrong capitalization.

```python
name = "Alice"
Name = "Bob"
print(name)   # Alice
print(Name)   # Bob
```

### Indentation

Python uses four-space indentation instead of braces. Mixed tabs and spaces will raise `IndentationError`.

```python
if True:
    print("Inside block")
    print("Still inside")
print("Back outside")
```

### Dynamic typing

Python assigns a type to a value, not to a variable name. The same variable can hold values of different types at different moments.

```python
x = 10
print(type(x))    # <class 'int'>
x = "hello"
print(type(x))    # <class 'str'>
x = [1, 2, 3]
print(type(x))    # <class 'list'>
```

**Key mental model:** read the last line of a Python traceback first — it names the error type. Fix that, then work upward.

---

## 2. Variables

A variable is a named reference to a value. Python creates it the moment you assign something to it.

### Assignment and naming rules

- Start with a letter or underscore.
- Use letters, digits, underscores only.
- Cannot be a Python keyword (`if`, `for`, `class`, etc.).
- Convention: `lower_case_with_underscores` for variables and functions.

```python
age = 25
name = "Alice"
height = 1.72
total_price = 500
student_age = 18
print(age, name, height)
print(total_price, student_age)
```

### Checking and converting types

```python
a = 10
b = 3.14
c = "hello"
print(type(a), type(b), type(c))   # int  float  str

# input() always returns str — convert before arithmetic
user_age_text = "21"
user_age = int(user_age_text)
print(user_age + 1)   # 22
```

**Tip:** during debugging, print both the variable and `type(variable)` side by side.

---

## 3. Data Types

### Core built-in types

| Type | Example | Notes |
|------|---------|-------|
| `int` | `42`, `-7` | Whole numbers, unlimited precision |
| `float` | `3.14`, `-0.5` | IEEE-754 decimal |
| `str` | `"hello"` | Immutable sequence of Unicode characters |
| `bool` | `True`, `False` | Subclass of `int` |
| `None` | `None` | Singleton, represents "no value" |

```python
age = 25
price = 19.99
name = "Python"
is_student = True
nothing = None
print(type(age), type(price), type(name), type(is_student), type(nothing))
```

### Type conversion

```python
print(int("100"))      # 100
print(float("3.14"))   # 3.14
print(str(25))         # '25'
print(bool(1))         # True
print(bool(0))         # False
```

String arithmetic vs numeric arithmetic:

```python
a = "10"
b = "20"
print(a + b)               # '1020'  — string concatenation
print(int(a) + int(b))     # 30      — numeric addition
```

### Truth values (falsy vs truthy)

`0`, `0.0`, `""`, `[]`, `{}`, `set()`, `None` are all falsy. Everything else is truthy.

```python
print(bool(0))     # False
print(bool(1))     # True
print(bool(""))    # False
print(bool("Hi"))  # True
print(bool([]))    # False
```

### String formatting and methods

```python
namespace = "prod"
pod = "api-7d9f"
print(f"Checking {namespace}/{pod}")       # f-string (Python 3.6+)

s = "  hello world  "
print(s.strip())            # 'hello world'
print(s.upper())            # '  HELLO WORLD  '
print("hello".replace("l", "L"))  # 'heLLo'
print("a,b,c".split(","))  # ['a', 'b', 'c']
print(",".join(["a","b","c"]))    # 'a,b,c'
print("hello world".startswith("hello"))  # True
```

---

## 4. Operators

### Arithmetic operators

```python
a = 10
b = 3
print(a + b)    # 13
print(a - b)    # 7
print(a * b)    # 30
print(a / b)    # 3.333...  (always float)
print(a // b)   # 3         (floor division)
print(a % b)    # 1         (modulo/remainder)
print(a ** b)   # 1000      (exponentiation)
```

### Comparison operators

```python
x, y = 10, 20
print(x == y)   # False
print(x != y)   # True
print(x < y)    # True
print(x <= y)   # True
print(x > y)    # False
print(x >= y)   # False
```

### Logical operators

```python
age = 20
print(age > 18 and age < 30)   # True
print(age < 18 or age == 20)   # True
print(not(age > 18))           # False
```

### Membership and identity operators

```python
fruits = ["apple", "banana"]
print("apple" in fruits)       # True
print("cherry" not in fruits)  # True

a = [1, 2, 3]
b = a
c = [1, 2, 3]
print(a is b)   # True  — same object
print(a is c)   # False — equal but different objects
```

### Assignment shortcuts

```python
count = 0
count += 1    # count = count + 1
count -= 1
count *= 2
count //= 2
```

**Common mistake:** using `=` (assignment) instead of `==` (comparison) inside a condition.

---

## 5. Control Flow

### if / elif / else

```python
score = 75
if score >= 90:
    print("Grade A")
elif score >= 60:
    print("Grade B")
else:
    print("Grade C")
```

Nested conditions:

```python
num = 8
if num > 0:
    if num % 2 == 0:
        print("Positive even")
    else:
        print("Positive odd")
else:
    print("Negative or zero")
```

Ternary (inline conditional expression):

```python
num = 7
label = "Even" if num % 2 == 0 else "Odd"
print(label)   # Odd
```

### for loops

```python
for i in range(5):
    print(i)          # 0 1 2 3 4

for i in range(2, 11, 2):
    print(i, end=" ") # 2 4 6 8 10
```

Iterating over a list:

```python
fruits = ["apple", "banana", "orange"]
for fruit in fruits:
    print(fruit)
```

Iterating with index using `enumerate`:

```python
for i, fruit in enumerate(fruits):
    print(i, fruit)
```

### while loops

```python
i = 0
while i < 5:
    print(i)
    i += 1
```

### break, continue, pass

```python
# break — exit the loop early
for i in range(10):
    if i == 5:
        break
    print(i)   # 0 1 2 3 4

# continue — skip this iteration
for i in range(5):
    if i == 2:
        continue
    print(i)   # 0 1 3 4

# pass — syntactic placeholder (empty block)
for i in range(3):
    pass   # nothing happens yet
```

### Nested loops

```python
for i in range(3):
    for j in range(2):
        print(i, j)
```

### List comprehensions

```python
squares = [x * x for x in range(6)]          # [0, 1, 4, 9, 16, 25]
evens = [x for x in range(10) if x % 2 == 0] # [0, 2, 4, 6, 8]
```

**Practical SRE example:**

```python
status = {"api-1": "Running", "api-2": "CrashLoopBackOff", "api-3": "Running"}
healthy = [pod for pod, s in status.items() if s == "Running"]
print(healthy)   # ['api-1', 'api-3']
```

---

## 6. Lists

Lists are ordered, mutable sequences. They are the most common Python collection.

```python
grades = [85, 90, 78, 92, 88]
print("Highest:", max(grades))
print("Lowest:", min(grades))
print("Average:", sum(grades) / len(grades))
```

### Creating and modifying lists

```python
tasks = []
tasks.append("Buy groceries")
tasks.append("Complete homework")
tasks.insert(1, "Exercise")      # insert at position 1
tasks.remove("Exercise")         # remove by value
last = tasks.pop()               # remove and return last item
print(tasks)
```

### Indexing and slicing

```python
nums = [10, 20, 30, 40, 50]
print(nums[0])      # 10  (first)
print(nums[-1])     # 50  (last)
print(nums[1:3])    # [20, 30]
print(nums[::-1])   # [50, 40, 30, 20, 10]  (reversed)
```

### Useful list operations

```python
fruits = ["banana", "apple", "orange"]
fruits.sort()                # in-place ascending sort
print(fruits)                # ['apple', 'banana', 'orange']
fruits.reverse()             # in-place reverse
print(fruits.count("apple")) # 1
print(fruits.index("apple")) # position of first match
print(len(fruits))           # 3
```

Extend vs append:

```python
a = [1, 2]
a.append([3, 4])   # [[1, 2], [3, 4]] — adds one item (a list)
b = [1, 2]
b.extend([3, 4])   # [1, 2, 3, 4]    — merges items
```

---

## 7. Tuples

Tuples are ordered, **immutable** sequences. Use them for fixed records and returning multiple values.

```python
numbers = (1, 2, 3)
print(numbers[0])       # 1
print(numbers[1:3])     # (2, 3)

t1 = (1, 2)
t2 = (3, 4)
print(t1 + t2)          # (1, 2, 3, 4)
print(("Python",) * 3)  # ('Python', 'Python', 'Python')
```

### Tuple methods

```python
nums = (1, 2, 2, 3)
print(nums.count(2))    # 2
print(nums.index(3))    # 3
```

### Packing and unpacking

```python
person = ("Alice", 25, "Engineer")
name, age, profession = person
print(name)       # Alice
print(age)        # 25
print(profession) # Engineer

# Swap variables with tuple unpacking
a, b = 1, 2
a, b = b, a
print(a, b)  # 2 1
```

Returning multiple values from a function:

```python
def min_max(numbers):
    return min(numbers), max(numbers)

lo, hi = min_max([5, 3, 8, 1])
print(lo, hi)   # 1 8
```

**One-item tuple needs a trailing comma:**

```python
single = (42,)   # tuple
not_tuple = (42) # just int
```

---

## 8. Sets

Sets store **unique, unordered** values. They are the fastest collection for membership testing.

```python
numbers = {1, 2, 3, 3, 4}
print(numbers)              # {1, 2, 3, 4} — duplicate dropped

empty_set = set()           # NOT {} — that creates a dict
fruits = {"apple", "banana", "orange"}
```

### Set operations

```python
a = {1, 2, 3}
b = {3, 4, 5}
print(a | b)    # {1, 2, 3, 4, 5}  union
print(a & b)    # {3}               intersection
print(a - b)    # {1, 2}            difference
print(a ^ b)    # {1, 2, 4, 5}     symmetric difference
```

### Methods and membership

```python
fruits = {"apple", "banana"}
fruits.add("orange")
fruits.discard("grape")     # safe — no error if missing
print("apple" in fruits)    # True

# Deduplication pattern
nums = [1, 2, 2, 3, 3, 4]
unique_nums = list(set(nums))
print(unique_nums)
```

**SRE pattern — find missing pods:**

```python
expected = {"api-1", "api-2", "api-3"}
actual = {"api-1", "api-3"}
missing = expected - actual
print(missing)   # {'api-2'}
```

---

## 9. Dictionaries

Dictionaries store **key-value pairs**. Keys must be unique and hashable (usually strings or numbers).

```python
student = {"name": "Alice", "age": 21, "grade": "A"}
print(student["name"])                  # Alice
print(student.get("city", "Unknown"))   # Unknown — safe access
```

### Modifying dictionaries

```python
student["age"] = 22          # update
student["city"] = "Berlin"   # add new key
del student["grade"]         # remove key
print(student)
```

### Iterating

```python
for key, value in student.items():
    print(key, value)

for key in student.keys():
    print(key)

for value in student.values():
    print(value)
```

### Nested dictionaries

```python
students = {
    "s1": {"name": "Alice", "age": 21},
    "s2": {"name": "Bob", "age": 22}
}
print(students["s1"]["name"])   # Alice
```

### Dictionary comprehension

```python
squares = {x: x * x for x in range(5)}
print(squares)   # {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}
```

### Frequency counting

```python
numbers = [1, 2, 2, 3, 3, 3]
freq = {}
for num in numbers:
    freq[num] = freq.get(num, 0) + 1
print(freq)   # {1: 1, 2: 2, 3: 3}
```

**SRE pattern — pod status summary:**

```python
pods = ["api-1: Running", "api-2: Running", "api-3: CrashLoop"]
status_count = {}
for entry in pods:
    state = entry.split(": ")[1]
    status_count[state] = status_count.get(state, 0) + 1
print(status_count)   # {'Running': 2, 'CrashLoop': 1}
```

---

## 10. Functions

Functions let you write logic once and call it many times. They improve readability and reduce bugs.

```python
def greet(name="Guest"):
    """Return a welcome message."""
    return f"Hello, {name}!"

print(greet())          # Hello, Guest!
print(greet("Alice"))   # Hello, Alice!
print(greet.__doc__)    # Return a welcome message.
```

### Parameters and return values

```python
def multiply(a, b):
    return a * b

result = multiply(4, 5)
print(result)   # 20
```

Multiple return values (returned as a tuple):

```python
def calculate(a, b):
    return a + b, a * b

total, product = calculate(3, 4)
print(total, product)   # 7 12
```

### *args and **kwargs

```python
def add_numbers(*args):
    return sum(args)

print(add_numbers(1, 2, 3, 4))   # 10

def display_info(**kwargs):
    for key, value in kwargs.items():
        print(f"{key}: {value}")

display_info(name="Alice", age=21)
```

### Scope

Variables defined inside a function are local. Use `global` to refer to a module-level variable (use sparingly).

```python
count = 0

def increment():
    global count
    count += 1

increment()
print(count)   # 1
```

**Tips:**
- One function = one clear job.
- Name functions with verbs: `calculate_total`, `is_valid`, `parse_config`.
- Test with small sample inputs first.

---

## 11. Lambda, map, filter, zip, enumerate

### Lambda functions

Lambda creates a small anonymous function with one expression.

```python
square = lambda x: x * x
print(square(5))   # 25

add = lambda a, b: a + b
print(add(3, 7))   # 10

check_number = lambda n: "Even" if n % 2 == 0 else "Odd"
print(check_number(8))   # Even
```

### map() — transform every item

```python
numbers = [1, 2, 3, 4, 5]
squares = list(map(lambda x: x * x, numbers))
print(squares)   # [1, 4, 9, 16, 25]

names = ["alice", "bob", "charlie"]
upper_names = list(map(lambda n: n.upper(), names))
print(upper_names)   # ['ALICE', 'BOB', 'CHARLIE']
```

### filter() — keep items that pass a test

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]
evens = list(filter(lambda x: x % 2 == 0, numbers))
print(evens)   # [2, 4, 6, 8]
```

Combining filter and map:

```python
even_squares = list(
    map(lambda x: x * x,
        filter(lambda x: x % 2 == 0, range(1, 9)))
)
print(even_squares)   # [4, 16, 36, 64]
```

### sorted() with key

```python
students = [("Alice", 85), ("Bob", 72), ("Charlie", 91)]
sorted_by_marks = sorted(students, key=lambda s: s[1])
print(sorted_by_marks)   # [('Bob', 72), ('Alice', 85), ('Charlie', 91)]

words = ["python", "ai", "code", "developer"]
by_length = sorted(words, key=lambda w: len(w))
print(by_length)   # ['ai', 'code', 'python', 'developer']
```

### zip and enumerate

```python
names = ["Alice", "Bob"]
scores = [85, 90]
for name, score in zip(names, scores):
    print(f"{name}: {score}")

fruits = ["apple", "banana", "orange"]
for i, fruit in enumerate(fruits, start=1):
    print(i, fruit)
```

**When to use lambda vs def:** use lambda for short, obvious, one-use logic. Use `def` when the logic has multiple steps, needs comments, or will be reused.

---

## 12. Modules and Packages

A **module** is a `.py` file. A **package** is a folder containing modules, typically with an `__init__.py`.

### Import styles

```python
import math
print(math.sqrt(36))   # 6.0
print(math.pi)         # 3.14159...

from math import sqrt, pi
print(sqrt(49))        # 7.0

import math as m
print(m.floor(4.9))    # 4

from math import *     # imports everything — avoid in large projects
```

### Creating your own module

File `calculator.py`:

```python
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b
```

In another file:

```python
from calculator import add
print(add(3, 4))   # 7
```

### Package structure

```
my_package/
    __init__.py
    greetings.py
    math_tools.py
```

### Exploring modules

```python
import math
print(dir(math)[:10])    # list of names
print(help(math.sqrt))   # built-in help
```

### sys.path

```python
import sys
print(sys.path)   # list of directories Python searches for modules
```

---

## 13. Python Standard Library Highlights

The standard library ships with Python — no `pip install` needed.

### os and pathlib

```python
import os
print(os.getcwd())                     # current working directory
print(os.listdir(".")[:5])             # list directory contents
os.makedirs("data/raw", exist_ok=True) # create nested dirs safely

# Safe path building — works on Windows and Linux
path = os.path.join("data", "report.txt")
print(os.path.abspath(path))
print(os.path.exists(path))
print(os.path.isfile(path))
print(os.path.isdir("data"))
```

`pathlib` (modern, object-oriented):

```python
from pathlib import Path

p = Path("data") / "report.txt"
print(p.exists())
print(p.suffix)        # '.txt'
print(p.stem)          # 'report'
print(p.parent)        # data
```

### datetime

```python
from datetime import datetime, timedelta

now = datetime.now()
print(now.year, now.month, now.day)
print(now.strftime("%Y-%m-%d %H:%M:%S"))

tomorrow = now + timedelta(days=1)
print(tomorrow)
```

### json

```python
import json

data = {"name": "Asha", "age": 21, "active": True}
json_str = json.dumps(data, indent=2)   # dict → JSON string
print(json_str)

parsed = json.loads(json_str)           # JSON string → dict
print(parsed["name"])

# File I/O
with open("config.json", "w") as f:
    json.dump(data, f, indent=2)

with open("config.json", "r") as f:
    loaded = json.load(f)
```

### re (regular expressions)

```python
import re

text = "Room 4, Floor 12, Block B9"
numbers = re.findall(r"\d+", text)
print(numbers)   # ['4', '12', '9']

email = "user@example.com"
print(re.match(r"[\w.]+@[\w.]+", email))   # match object

clean = re.sub(r"\s+", " ", "too   many   spaces")
print(clean)   # 'too many spaces'
```

### collections

```python
from collections import Counter, defaultdict, deque

# Counter — frequency counting made easy
words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
count = Counter(words)
print(count.most_common(2))   # [('apple', 3), ('banana', 2)]

# defaultdict — dict with a default value factory
dd = defaultdict(list)
dd["fruits"].append("apple")
dd["fruits"].append("banana")
print(dict(dd))   # {'fruits': ['apple', 'banana']}

# deque — fast appends/pops at both ends
dq = deque([1, 2, 3])
dq.appendleft(0)
dq.append(4)
print(dq)   # deque([0, 1, 2, 3, 4])
```

### sys

```python
import sys
print(sys.version)
print(sys.platform)
sys.exit(0)   # exit script with code 0 (success)
```

---

## 14. File I/O

### Reading files

```python
# Write some content first
with open("sample.txt", "w") as f:
    f.write("Line one\nLine two\nLine three\n")

# Read entire file
with open("sample.txt", "r") as f:
    content = f.read()
    print(content)

# Read line by line (memory-efficient for large files)
with open("sample.txt", "r") as f:
    for line in f:
        print(line.strip())

# Read all lines into a list
with open("sample.txt", "r") as f:
    lines = f.readlines()
print(len(lines))   # 3
```

### Writing files

```python
# 'w' mode overwrites; 'a' mode appends
with open("notes.txt", "w") as f:
    f.write("Python file handling.\n")
    f.write("Second line.\n")

with open("notes.txt", "a") as f:
    f.write("Appended line.\n")

# Write multiple lines at once
lines = ["Line 1\n", "Line 2\n", "Line 3\n"]
with open("multi.txt", "w") as f:
    f.writelines(lines)
```

### File modes reference

| Mode | Meaning |
|------|---------|
| `r`  | Read (default) |
| `w`  | Write — creates or overwrites |
| `a`  | Append — creates or adds to end |
| `r+` | Read and write |
| `w+` | Write and read — creates or overwrites |
| `rb` / `wb` | Binary read/write |

### Binary files

```python
data = b"Python binary data"
with open("data.bin", "wb") as f:
    f.write(data)

with open("data.bin", "rb") as f:
    print(f.read())   # b'Python binary data'
```

### Counting statistics

```python
with open("sample.txt", "r") as f:
    lines = f.readlines()

line_count = len(lines)
word_count = sum(len(line.split()) for line in lines)
char_count = sum(len(line) for line in lines)
print(f"Lines: {line_count}, Words: {word_count}, Chars: {char_count}")
```

### Working with file paths (os module)

```python
import os

folder = "project_data"
if not os.path.exists(folder):
    os.mkdir(folder)

full_path = os.path.join(folder, "info.txt")
if not os.path.exists(full_path):
    with open(full_path, "w") as f:
        f.write("Project information\n")
print(full_path)

# Walk a directory tree
for item in os.listdir("."):
    item_path = os.path.join(".", item)
    kind = "dir" if os.path.isdir(item_path) else "file"
    print(f"{item} -> {kind}")
```

**Always use `with open(...)`.** It guarantees the file is closed even if an exception occurs.

---

## 15. Exception Handling

Exceptions allow programs to fail gracefully instead of crashing with an ugly traceback.

### try / except

```python
try:
    result = 10 / 0
except ZeroDivisionError:
    print("Cannot divide by zero.")

try:
    age = int("twenty")
except ValueError:
    print("Invalid number format.")

try:
    with open("missing.txt", "r") as f:
        content = f.read()
except FileNotFoundError:
    print("File not found.")
```

### Multiple except blocks

```python
try:
    value = int("hello")
    result = 10 / value
except ValueError:
    print("Please enter a valid integer.")
except ZeroDivisionError:
    print("Division by zero is not allowed.")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### else and finally

```python
try:
    number = int("12")
except ValueError:
    print("Conversion failed.")
else:
    # runs only if NO exception was raised
    print("Conversion succeeded:", number)
finally:
    # always runs, even if exception was raised
    print("This block always runs.")
```

### Common built-in exceptions

| Exception | Trigger |
|-----------|---------|
| `ValueError` | Wrong value for type (`int("abc")`) |
| `TypeError` | Wrong type for operation (`"a" + 1`) |
| `ZeroDivisionError` | Division by zero |
| `FileNotFoundError` | Opening non-existent file |
| `KeyError` | Missing dict key |
| `IndexError` | List index out of range |
| `NameError` | Undefined variable |
| `AttributeError` | Missing attribute/method |

### Raising exceptions

```python
def divide(a, b):
    if b == 0:
        raise ValueError("Denominator cannot be zero.")
    return a / b

try:
    print(divide(10, 0))
except ValueError as e:
    print(e)
```

### Safe wrappers

```python
def safe_int(text, default=0):
    try:
        return int(text)
    except ValueError:
        return default

print(safe_int("42"))    # 42
print(safe_int("bad"))   # 0
```

**Best practices:**
- Catch specific exceptions first, broad `Exception` last.
- Use `else` for success-only logic.
- Use `finally` for cleanup (closing files, releasing locks).
- Print or log useful messages — never silently swallow errors.

---

## Quick Reference: Common Patterns

```python
# Frequency count
from collections import Counter
counts = Counter(["a", "b", "a", "c", "b", "a"])
print(counts.most_common(2))   # [('a', 3), ('b', 2)]

# Safe dict access
d = {"x": 1}
print(d.get("y", 0))   # 0

# Deduplicate a list preserving order
seen = set()
unique = [x for x in [1, 2, 2, 3, 1] if not (x in seen or seen.add(x))]
print(unique)   # [1, 2, 3]

# Flatten a list of lists
nested = [[1, 2], [3, 4], [5]]
flat = [x for sublist in nested for x in sublist]
print(flat)   # [1, 2, 3, 4, 5]

# Read JSON config file
import json
with open("config.json") as f:
    config = json.load(f)

# Walk directories for files with an extension
import os
py_files = [f for f in os.listdir(".") if f.endswith(".py")]
```
