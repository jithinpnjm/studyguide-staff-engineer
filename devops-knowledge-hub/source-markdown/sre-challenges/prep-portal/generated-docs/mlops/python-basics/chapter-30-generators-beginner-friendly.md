---
title: "Chapter 30 Generators Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_30_generators_beginner_friendly.ipynb"
slug: "/python-basics/chapter-30-generators-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_30_generators_beginner_friendly.ipynb</code></div>

# Chapter 30 — Generators in Python

This notebook follows the same beginner-friendly teaching style as the recent advanced chapters.

## Start here: one-line meaning

**A generator is a special kind of iterator that gives values one at a time using `yield`.**

## Tiny memory guide

- `yield` = give one value now  
- generator = values come step by step  
- lazy evaluation = values are produced only when needed  
- memory efficient = does not store everything at once  

## Before you begin

This chapter becomes much easier if you compare generators with lists.

A list stores all values at once.

A generator produces values one by one only when asked.

That is why generators are very useful for:
- large data
- efficient looping
- memory-saving programs

## Example 1: A normal function with return

**What this teaches:** A normal function returns once and then finishes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
def greet():
    return "Hello"

print(greet())
```

</div>

## Example 2: A simple generator with yield

**What this teaches:** A generator uses `yield` instead of returning everything at once.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
def simple_generator():
    yield 1
    yield 2
    yield 3

g = simple_generator()
print(g)
```

</div>

## Example 3: Iterating over a generator with a for loop

**What this teaches:** A generator can be used in a `for` loop just like other iterators.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
def simple_generator():
    yield 1
    yield 2
    yield 3

for value in simple_generator():
    print(value)
```

</div>

## Example 4: Using next() with a generator

**What this teaches:** Generators support `next()` because they are iterators.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
def simple_generator():
    yield 10
    yield 20
    yield 30

g = simple_generator()

print(next(g))
print(next(g))
print(next(g))
```

</div>

## Example 5: Squaring numbers with a generator

**What this teaches:** This matches the lecture idea: yield square values one by one.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
def square(n):
    for i in range(n):
        yield i * i

for value in square(5):
    print(value)
```

</div>

## Example 6: Creating the generator object first

**What this teaches:** A generator function does not run fully at once — it creates a generator object first.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
def square(n):
    for i in range(n):
        yield i * i

g = square(5)
print(g)
```

</div>

## Example 7: Manually reading generator values with next()

**What this teaches:** This shows step-by-step value generation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
def square(n):
    for i in range(n):
        yield i * i

g = square(4)

print(next(g))
print(next(g))
print(next(g))
print(next(g))
```

</div>

## Example 8: Multiple outputs in sequence

**What this teaches:** A generator can yield multiple values one after another.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
def values():
    yield "A"
    yield "B"
    yield "C"

for item in values():
    print(item)
```

</div>

## Example 9: Generator with user-friendly text

**What this teaches:** Generators are flexible and can produce any type of value, not only numbers.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
def messages():
    yield "Start"
    yield "Processing"
    yield "End"

for msg in messages():
    print(msg)
```

</div>

## Example 10: Comparing list vs generator idea

**What this teaches:** A list stores all results, but a generator produces results when needed.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
def squares_list(n):
    result = []
    for i in range(n):
        result.append(i * i)
    return result

def squares_generator(n):
    for i in range(n):
        yield i * i

print(squares_list(5))
print(squares_generator(5))
```

</div>

## Example 11: Handling StopIteration with a generator

**What this teaches:** Generators end just like iterators, so `StopIteration` can happen with `next()` too.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
def numbers():
    yield 1
    yield 2

g = numbers()

try:
    while True:
        print(next(g))
except StopIteration:
    print("Generator finished.")
```

</div>

## Example 12: Reading lines one by one from text data

**What this teaches:** This simulates the idea of reading data line by line instead of loading everything at once.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
def read_lines():
    lines = ["First line", "Second line", "Third line"]
    for line in lines:
        yield line

for line in read_lines():
    print(line)
```

</div>

## Example 13: Generator expression

**What this teaches:** Python also allows short generator expressions, similar to list comprehensions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
gen = (x * x for x in range(5))

for value in gen:
    print(value)
```

</div>

## Example 14: Why generators are memory-friendly

**What this teaches:** This example highlights the lazy nature of generators: values appear only when needed.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
def big_numbers():
    for i in range(1, 6):
        print(f"Producing {i}")
        yield i

g = big_numbers()

print(next(g))
print(next(g))
```

</div>

## Example 15: Full beginner-friendly generator demo

**What this teaches:** This combines the main ideas: `yield`, generator object, `for` loop, and `next()` thinking.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
def square(n):
    for i in range(n):
        yield i * i

g = square(6)

for value in g:
    print("Square:", value)
```

</div>

## 5. Common confusion cleared up

### Generator vs normal function

- normal function = returns once and ends
- generator = yields values one by one

### Generator vs iterator

A generator is a kind of iterator.

That means:
- it works with `next()`
- it works in `for` loops
- it ends with `StopIteration`

### What does lazy evaluation mean?

It means values are created only when needed, not all at once.

### One sentence to remember

> A generator produces values step by step instead of storing them all at once.

## 6. Common mistakes

- confusing `yield` with `return`
- expecting a generator object to show all values directly
- forgetting that a generator gets exhausted after use
- calling `next()` too many times without handling the end

## 7. Mentor tips / best practices

- first understand iterators, then generators
- think of `yield` as “pause here and give one value”
- use generators for large data or long sequences
- practice with small examples before file-reading examples
- compare list output with generator behavior to understand the difference

## 8. Practice tasks

1. Write a generator that yields numbers 1 to 5.
2. Write a generator that yields squares.
3. Use `next()` on a generator.
4. Use a `for` loop on a generator.
5. Write a generator that yields text messages.
6. Create a generator expression.
7. Simulate line-by-line reading using a generator.

## 9. Revision notes

- generators use `yield`
- generators are a type of iterator
- generators produce values one by one
- lazy evaluation improves memory efficiency
- generators work with `next()` and `for` loops
- generators are useful for large data and file reading
