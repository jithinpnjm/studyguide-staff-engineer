---
title: "Chapter 01 Python Syntax And Semantics"
description: "Generated from mlops/PYTHON/Basics/chapter_01_python_syntax_and_semantics.ipynb"
slug: "/python-basics/chapter-01-python-syntax-and-semantics"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_01_python_syntax_and_semantics.ipynb</code></div>

# Chapter 1 — Python Syntax and Semantics

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### What is syntax?
Syntax means the writing rules of Python. If the structure is wrong, Python stops before running the program. Typical syntax issues include missing parentheses, missing colons, and broken indentation.

### Why syntax matters
Syntax errors are usually the first kind of error beginners meet. Learning to read Python error messages carefully is part of becoming comfortable with programming.

### What is semantics?
Semantics refers to what the code means when Python executes it. Code can be written correctly but still fail because the operation does not make sense.

### Comments and documentation
Comments are ignored by Python but help humans understand the code. Single-line comments use #. Triple quotes are commonly used for docstrings and multi-line documentation.

### Case sensitivity
Python treats age and Age as different names. Many NameError issues happen because of wrong capitalization.

### Indentation
Python uses indentation instead of braces to define blocks. Use 4 spaces per indentation level.

### Dynamic typing preview
Python decides data types at runtime. The same variable can hold different kinds of values at different moments.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Valid vs invalid syntax
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
print("Hello, World!")

# Invalid example (commented so notebook still runs)
# print("Hello, World!"
```

</div>

**What this example teaches:** It shows the main idea behind **valid vs invalid syntax** and gives you a runnable reference you can modify while practicing.

### Semantics example
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
x = 10
y = "20"
print("Trying to add int and str directly causes an error.")
# print(x + y)
print(x + int(y))
```

</div>

**What this example teaches:** It shows the main idea behind **semantics example** and gives you a runnable reference you can modify while practicing.

### Comments and docstrings
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
# this is a comment
print("Learning Python")

def greet():
    """Return a welcome message."""
    return "Welcome!"

print(greet())
```

</div>

**What this example teaches:** It shows the main idea behind **comments and docstrings** and gives you a runnable reference you can modify while practicing.

### Case sensitivity
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
name = "Alice"
Name = "Bob"
print(name)
print(Name)
```

</div>

**What this example teaches:** It shows the main idea behind **case sensitivity** and gives you a runnable reference you can modify while practicing.

### Indentation
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
if True:
    print("Inside block")
```

</div>

**What this example teaches:** It shows the main idea behind **indentation** and gives you a runnable reference you can modify while practicing.

### Dynamic typing
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
x = 10
print(type(x))
x = "hello"
print(type(x))
```

</div>

**What this example teaches:** It shows the main idea behind **dynamic typing** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Missing punctuation such as a colon or closing bracket
- Mixing tabs and spaces in indentation
- Using the wrong variable name because of capitalization
- Trying operations that do not make semantic sense, such as adding int and str

## 5. Mentor tips / best practices

- Read the last line of a Python traceback first. It usually names the error type clearly.
- Keep indentation consistent. Configure your editor to insert 4 spaces.
- Comment out broken examples instead of deleting them, so you can learn from them.

## 6. Practice tasks with sample solutions

### Practice task 1
Print your name, age, and city.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
name = "Amina"
age = 20
city = "Berlin"
print(name, age, city)
```

</div>

### Practice task 2
Create one syntax error intentionally, then fix it.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 38</div>

```python
# Broken: print("Hello"
print("Hello")
```

</div>

### Practice task 3
Write an if block with correct indentation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 40</div>

```python
temperature = 25
if temperature > 20:
    print("Warm day")
```

</div>

## 7. Revision notes

- Syntax = code structure
- Semantics = code meaning during execution
- Python is case-sensitive
- Indentation is essential
