---
title: "Chapter 31 Decorators Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_31_decorators_beginner_friendly.ipynb"
slug: "/python-basics/chapter-31-decorators-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_31_decorators_beginner_friendly.ipynb</code></div>

# Chapter 31 — Decorators in Python

This notebook follows the same beginner-friendly teaching style as the recent advanced chapters.

## Start here: one-line meaning

**A decorator is a way to add extra behavior to a function without changing the function’s original code.**

## Tiny memory guide

- functions are first-class objects  
- a function can be stored in a variable  
- a function can be passed into another function  
- a closure remembers outer variables  
- a decorator wraps another function  
- `@decorator_name` is shortcut syntax  

## Before you begin

Decorators feel advanced at first because they are built from smaller ideas.

This chapter becomes much easier if you learn it in this order:

1. functions as objects  
2. function copying  
3. nested functions  
4. closures  
5. decorator function  
6. `@` syntax  

If you understand these steps one by one, decorators become much easier.

## Example 1: Functions are first-class objects

**What this teaches:** In Python, functions can be stored in variables just like other values.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
def welcome():
    return "Welcome!"

say_hello = welcome

print(welcome())
print(say_hello())
```

</div>

## Example 2: Function copy still works after original name is deleted

**What this teaches:** This matches the lecture idea: the copied reference still points to the function object.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
def welcome():
    return "Welcome!"

another_name = welcome
del welcome

print(another_name())
```

</div>

## Example 3: Function passed as an argument

**What this teaches:** A function can be sent into another function, which is one of the foundations of decorators.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
def greet():
    return "Hello"

def show_message(func):
    print("Function says:", func())

show_message(greet)
```

</div>

## Example 4: Nested function

**What this teaches:** A function can be defined inside another function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
def outer():
    def inner():
        print("Inner function running")
    inner()

outer()
```

</div>

## Example 5: Closure basics

**What this teaches:** An inner function can remember variables from the outer function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
def outer():
    message = "Hello from outer"

    def inner():
        print(message)

    return inner

my_func = outer()
my_func()
```

</div>

## Example 6: Closure with returned function

**What this teaches:** This makes the closure idea even clearer: the inner function still remembers outer data later.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
def outer(name):
    def inner():
        print(f"Hello, {name}")
    return inner

greet_asha = outer("Asha")
greet_ravi = outer("Ravi")

greet_asha()
greet_ravi()
```

</div>

## Example 7: First decorator shape

**What this teaches:** A decorator usually takes a function, creates a wrapper, and returns that wrapper.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
def my_decorator(func):
    def wrapper():
        print("Before the function runs")
        func()
        print("After the function runs")
    return wrapper

def say_hello():
    print("Hello!")

decorated = my_decorator(say_hello)
decorated()
```

</div>

## Example 8: Using @ syntax

**What this teaches:** The `@` symbol is just a shorter, cleaner way to apply a decorator.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
def my_decorator(func):
    def wrapper():
        print("Before the function runs")
        func()
        print("After the function runs")
    return wrapper

@my_decorator
def say_hello():
    print("Hello!")

say_hello()
```

</div>

## Example 9: Decorator adds behavior without changing original code

**What this teaches:** This is the most important idea: the function stays clean, but the decorator adds extra behavior.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
def log_decorator(func):
    def wrapper():
        print("Function is starting...")
        func()
        print("Function has finished.")
    return wrapper

@log_decorator
def study():
    print("Studying Python")

study()
```

</div>

## Example 10: Decorator for a function with arguments

**What this teaches:** Real decorators often need to work with functions that accept arguments.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
def my_decorator(func):
    def wrapper(name):
        print("Before function")
        func(name)
        print("After function")
    return wrapper

@my_decorator
def greet(name):
    print(f"Hello, {name}")

greet("Meera")
```

</div>

## Example 11: Flexible decorator with *args and **kwargs

**What this teaches:** This is the common beginner-friendly pattern for decorators that should work with many functions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("Before function")
        result = func(*args, **kwargs)
        print("After function")
        return result
    return wrapper

@my_decorator
def add(a, b):
    return a + b

print(add(3, 4))
```

</div>

## Example 12: Decorator returning the original result

**What this teaches:** A good decorator often returns the result from the wrapped function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("Running function...")
        result = func(*args, **kwargs)
        return result
    return wrapper

@my_decorator
def multiply(a, b):
    return a * b

print(multiply(5, 6))
```

</div>

## Example 13: Custom decorator with its own argument

**What this teaches:** Decorators themselves can also take arguments.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
def repeat(n):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for _ in range(n):
                func(*args, **kwargs)
        return wrapper
    return decorator

@repeat(3)
def say_hi():
    print("Hi!")

say_hi()
```

</div>

## Example 14: Practical timing-style decorator

**What this teaches:** This shows how decorators are used in real projects to add reusable behavior like logging or timing.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
def simple_logger(func):
    def wrapper(*args, **kwargs):
        print(f"Calling function: {func.__name__}")
        result = func(*args, **kwargs)
        print(f"Finished function: {func.__name__}")
        return result
    return wrapper

@simple_logger
def square(n):
    return n * n

print(square(5))
```

</div>

## Example 15: Full beginner-friendly decorator demo

**What this teaches:** This combines the main decorator ideas: first-class functions, wrapper function, `@` syntax, arguments, and returned result.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
def decorator_example(func):
    def wrapper(*args, **kwargs):
        print("Decorator: before function")
        result = func(*args, **kwargs)
        print("Decorator: after function")
        return result
    return wrapper

@decorator_example
def welcome(name):
    return f"Welcome, {name}!"

print(welcome("John"))
```

</div>

## 5. Common confusion cleared up

### What is a decorator really doing?

A decorator usually:
1. takes a function
2. defines a wrapper function
3. adds extra behavior
4. returns the wrapper

### What does @decorator_name mean?

This:

```python
@my_decorator
def greet():
    print("Hello")
```

is basically a shortcut for:

```python
def greet():
    print("Hello")

greet = my_decorator(greet)
```

### Why are closures important here?

Because the wrapper function needs to remember the original function it is decorating.

That memory behavior comes from closures.

### One sentence to remember

> A decorator wraps a function to add extra behavior without changing the original function code.

## 6. Common mistakes

- not understanding function copying before learning decorators
- forgetting to return the wrapper function
- forgetting to call the original function inside the wrapper
- forgetting to return the original function’s result
- writing decorators that only work with zero-argument functions

## 7. Mentor tips / best practices

- learn decorators step by step, not all at once
- first understand first-class functions and closures
- then move to simple decorators
- use `*args` and `**kwargs` for flexible decorators
- keep beginner decorators small and readable
- think of decorators as reusable extra behavior

## 8. Practice tasks

1. Copy a function into another variable and call it.
2. Write a nested function example.
3. Write a closure that remembers a name.
4. Create a simple decorator that prints before and after a function.
5. Apply it using `@`.
6. Create a decorator that works with function arguments.
7. Create a decorator that repeats a function 2 or 3 times.

## 9. Revision notes

- functions are first-class objects in Python
- functions can be copied and passed as arguments
- closures remember outer variables
- decorators wrap functions
- `@decorator_name` is shortcut syntax
- decorators can add behavior without changing original code
- decorators can also accept arguments
