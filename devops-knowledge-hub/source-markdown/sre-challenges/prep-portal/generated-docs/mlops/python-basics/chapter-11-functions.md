---
title: "Chapter 11 Functions"
description: "Generated from mlops/PYTHON/Basics/chapter_11_functions.ipynb"
slug: "/python-basics/chapter-11-functions"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_11_functions.ipynb</code></div>

# Chapter 11 — Functions

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### Why functions matter
Functions let you write logic once and reuse it many times. They improve organization, readability, and maintainability.

### Defining a function
A function is created with def and runs when called.

### Parameters
Parameters allow a function to work with different inputs.

### Default parameters
Default values make functions flexible and easier to call.

### Return values
return sends data back from the function.

### Returning multiple values
Python packages multiple returned values as a tuple.

### Variable-length arguments
*args collects extra positional arguments and **kwargs collects extra keyword arguments.

### Docstrings
A docstring explains what a function does.

### Good function habits
Use clear names and keep one function focused on one job.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Simple function
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
def greet():
    print("Hello")

greet()
```

</div>

**What this example teaches:** It shows the main idea behind **simple function** and gives you a runnable reference you can modify while practicing.

### Function with parameter
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
def greet(name):
    print("Hello", name)

greet("Alice")
```

</div>

**What this example teaches:** It shows the main idea behind **function with parameter** and gives you a runnable reference you can modify while practicing.

### Default parameter
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
def greet(name="Guest"):
    print("Hello", name)

greet()
greet("John")
```

</div>

**What this example teaches:** It shows the main idea behind **default parameter** and gives you a runnable reference you can modify while practicing.

### Return value
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
def multiply(a, b):
    return a * b

result = multiply(4, 5)
print(result)
```

</div>

**What this example teaches:** It shows the main idea behind **return value** and gives you a runnable reference you can modify while practicing.

### Multiple return values
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
def calculate(a, b):
    return a + b, a * b

sum_val, prod_val = calculate(3, 4)
print(sum_val, prod_val)
```

</div>

**What this example teaches:** It shows the main idea behind **multiple return values** and gives you a runnable reference you can modify while practicing.

### *args
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
def add_numbers(*args):
    total = 0
    for num in args:
        total += num
    return total

print(add_numbers(1, 2, 3, 4))
```

</div>

**What this example teaches:** It shows the main idea behind ***args** and gives you a runnable reference you can modify while practicing.

### **kwargs
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
def display_info(**kwargs):
    for key, value in kwargs.items():
        print(key, value)

display_info(name="Alice", age=21)
```

</div>

**What this example teaches:** It shows the main idea behind ****kwargs** and gives you a runnable reference you can modify while practicing.

### Docstring
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
def square(n):
    """Return the square of a number."""
    return n * n

print(square(5))
print(square.__doc__)
```

</div>

**What this example teaches:** It shows the main idea behind **docstring** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Forgetting to return a value when the caller needs one
- Using too many responsibilities inside one function
- Confusing printing with returning

## 5. Mentor tips / best practices

- Write functions that do one clear job.
- Test functions with small sample inputs first.
- Choose descriptive names like calculate_total instead of do_it.

## 6. Practice tasks with sample solutions

### Practice task 1
Write a function to check even/odd.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 44</div>

```python
def is_even(num):
    return num % 2 == 0

print(is_even(8))
```

</div>

### Practice task 2
Write a square function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 46</div>

```python
def square(n):
    return n * n

print(square(6))
```

</div>

### Practice task 3
Write a function with a default parameter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 48</div>

```python
def greet(name="Guest"):
    return f"Hello {name}"

print(greet())
```

</div>

### Practice task 4
Write one using *args.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 50</div>

```python
def add_all(*args):
    return sum(args)

print(add_all(1, 2, 3, 4))
```

</div>

## 7. Revision notes

- Functions improve reuse
- Parameters receive input
- return sends output back
- *args and **kwargs make functions flexible
