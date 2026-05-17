---
title: "Chapter 29 Iterators Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_29_iterators_beginner_friendly.ipynb"
slug: "/python-basics/chapter-29-iterators-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_29_iterators_beginner_friendly.ipynb</code></div>

# Chapter 29 — Iterators in Python

This notebook follows the same beginner-friendly teaching style as the recent advanced chapters.

## Start here: one-line meaning

**An iterator is an object that gives you one item at a time when you ask for the next value.**

## Tiny memory guide

- `iter()` = make an iterator  
- `next()` = get the next value  
- lazy loading = values are used one by one  
- `StopIteration` = no more values left  

## Before you begin

This chapter becomes much easier if you think like this:

A normal list already has all items ready.

An iterator gives items step by step.

That step-by-step behavior is useful for:
- looping
- memory efficiency
- processing large data

## Example 1: Normal for loop with a list

**What this teaches:** A `for` loop already uses iteration, even if you do not see the iterator directly.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
numbers = [1, 2, 3, 4, 5, 6]

for num in numbers:
    print(num)
```

</div>

## Example 2: Creating an iterator with iter()

**What this teaches:** The `iter()` function converts an iterable like a list into an iterator.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
numbers = [1, 2, 3, 4, 5, 6]
it = iter(numbers)

print(it)
```

</div>

## Example 3: Getting values one by one with next()

**What this teaches:** The `next()` function asks the iterator for the next value.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
numbers = [1, 2, 3, 4, 5, 6]
it = iter(numbers)

print(next(it))
print(next(it))
print(next(it))
```

</div>

## Example 4: Continue calling next()

**What this teaches:** Each call moves the iterator forward one step.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
numbers = [1, 2, 3, 4]
it = iter(numbers)

print(next(it))
print(next(it))
print(next(it))
print(next(it))
```

</div>

## Example 5: What happens when the iterator ends

**What this teaches:** When there are no values left, Python raises `StopIteration`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
numbers = [1, 2]
it = iter(numbers)

print(next(it))
print(next(it))
# print(next(it))   # This would raise StopIteration
```

</div>

## Example 6: Handling StopIteration with try-except

**What this teaches:** A `try/except` block lets you handle the end of an iterator more gracefully.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
numbers = [1, 2]
it = iter(numbers)

try:
    while True:
        print(next(it))
except StopIteration:
    print("Iterator is exhausted.")
```

</div>

## Example 7: Iterator with a string

**What this teaches:** Iterators are not only for lists. Strings can also be turned into iterators.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
text = "Python"
it = iter(text)

print(next(it))
print(next(it))
print(next(it))
```

</div>

## Example 8: Iterator with a tuple

**What this teaches:** Tuples are also iterable, so they can create iterators too.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
data = (10, 20, 30)
it = iter(data)

print(next(it))
print(next(it))
print(next(it))
```

</div>

## Example 9: Using a for loop after understanding iterators

**What this teaches:** A `for` loop automatically keeps calling `next()` until `StopIteration` happens.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
numbers = [100, 200, 300]
it = iter(numbers)

for value in it:
    print(value)
```

</div>

## Example 10: Comparing list and iterator behavior

**What this teaches:** A list stores all values directly, while an iterator gives access step by step.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
numbers = [1, 2, 3]

print("List:", numbers)

it = iter(numbers)
print("Iterator:", it)
print("First item:", next(it))
```

</div>

## Example 11: An iterator gets consumed

**What this teaches:** Once an iterator gives away a value, it moves forward and does not go back automatically.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
numbers = [1, 2, 3]
it = iter(numbers)

print(next(it))
print(next(it))

for item in it:
    print(item)
```

</div>

## Example 12: Converting an iterator back to a list

**What this teaches:** You can collect remaining values from an iterator into a list.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
numbers = [1, 2, 3, 4]
it = iter(numbers)

print(next(it))
remaining = list(it)
print(remaining)
```

</div>

## Example 13: Iterator with dictionary keys

**What this teaches:** Dictionaries are also iterable. By default, they iterate over keys.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
student = {"name": "Asha", "marks": 95}
it = iter(student)

print(next(it))
print(next(it))
```

</div>

## Example 14: Manual iteration and graceful ending

**What this teaches:** This example shows step-by-step manual access and friendly error handling.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
values = [10, 20, 30]
it = iter(values)

try:
    print(next(it))
    print(next(it))
    print(next(it))
    print(next(it))
except StopIteration:
    print("No more elements left.")
```

</div>

## Example 15: Full beginner-friendly iterator demo

**What this teaches:** This combines the main ideas: `iter()`, `next()`, and safe handling of the end.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
numbers = [1, 2, 3, 4, 5, 6]
it = iter(numbers)

try:
    while True:
        value = next(it)
        print("Next value:", value)
except StopIteration:
    print("Finished reading all values from the iterator.")
```

</div>

## 5. Common confusion cleared up

### Iterable vs iterator

These two words are related, but not the same.

- **iterable** = something you can loop over, like a list or string
- **iterator** = the object that gives one value at a time

Example:
- list = iterable
- `iter(list)` = iterator

### What does a for loop really do?

A `for` loop secretly does this idea:
1. get an iterator using `iter()`
2. keep calling `next()`
3. stop when `StopIteration` happens

### One sentence to remember

> An iterator gives values one by one, not all at once.

## 6. Common mistakes

- confusing iterables with iterators
- calling `next()` too many times without handling `StopIteration`
- expecting an exhausted iterator to restart automatically
- forgetting that strings, tuples, and dictionaries are iterable too

## 7. Mentor tips / best practices

- first understand iteration with lists
- then practice `iter()` and `next()` manually
- use `try/except StopIteration` when manually calling `next()`
- remember that `for` loops already handle iterators for you
- think of iterators as step-by-step data access

## 8. Practice tasks

1. Create an iterator from a list.
2. Use `next()` three times.
3. Create an iterator from a string.
4. Handle `StopIteration` with try-except.
5. Convert the remaining part of an iterator into a list.
6. Create an iterator from a tuple.
7. Create an iterator from a dictionary.

## 9. Revision notes

- iterators give values one by one
- `iter()` creates an iterator
- `next()` gets the next value
- `StopIteration` means the iterator is finished
- iterators support memory-efficient access
- `for` loops use iterators internally
- lists, strings, tuples, and dictionaries can all be iterated
