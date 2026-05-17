---
title: "Chapter 15 Filter Function"
description: "Generated from mlops/PYTHON/Basics/chapter_15_filter_function.ipynb"
slug: "/python-basics/chapter-15-filter-function"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_15_filter_function.ipynb</code></div>

# Chapter 15 — The `filter()` Function in Python

This notebook follows your study guide format and includes explanations, examples, common mistakes, mentor tips, practice tasks, and revision notes.


## 1. Chapter title

**The `filter()` Function in Python**

## 2. Concept explanation

The `filter()` function creates an iterator from elements of an iterable that satisfy a condition.

Basic syntax:

```python
filter(function, iterable)
```

It is mainly used for selecting values that match a rule, such as:
- even numbers
- values greater than a target
- valid records in dictionaries
- non-empty items in text data

## Example 1: Filter even numbers using a normal function

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
def is_even(num):
    return num % 2 == 0

numbers = [1, 2, 3, 4, 5, 6, 7, 8]
even_numbers = list(filter(is_even, numbers))
print(even_numbers)
```

</div>

## Example 2: Filter even numbers using lambda

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]
even_numbers = list(filter(lambda x: x % 2 == 0, numbers))
print(even_numbers)
```

</div>

## Example 3: Filter numbers greater than five

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
numbers = [2, 4, 6, 8, 1, 3, 5, 7, 9]
greater_than_five = list(filter(lambda x: x > 5, numbers))
print(greater_than_five)
```

</div>

## Example 4: Filter numbers that are even and greater than five

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
result = list(filter(lambda x: x % 2 == 0 and x > 5, numbers))
print(result)
```

</div>

## Example 5: Filter names longer than four characters

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
names = ["Ali", "Rohan", "Sara", "Michael", "Zoya"]
long_names = list(filter(lambda name: len(name) > 4, names))
print(long_names)
```

</div>

## Example 6: Filter positive numbers

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
numbers = [-10, -3, 0, 4, 9, -1, 7]
positive_numbers = list(filter(lambda x: x > 0, numbers))
print(positive_numbers)
```

</div>

## Example 7: Filter truthy values

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
values = [0, 1, False, True, "", "Hello", None, [], [1, 2]]
truthy_values = list(filter(None, values))
print(truthy_values)
```

</div>

## Example 8: Filter data from a list of dictionaries

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
people = [
    {"name": "Aman", "age": 22},
    {"name": "Neha", "age": 28},
    {"name": "Ravi", "age": 31},
    {"name": "Sara", "age": 24}
]

older_than_25 = list(filter(lambda person: person["age"] > 25, people))
print(older_than_25)
```

</div>

## Example 9: Filter dictionary records using a named function

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
people = [
    {"name": "Aman", "age": 22},
    {"name": "Neha", "age": 28},
    {"name": "Ravi", "age": 31},
    {"name": "Sara", "age": 24}
]

def age_above_25(person):
    return person["age"] > 25

result = list(filter(age_above_25, people))
print(result)
```

</div>

## Example 10: Filter words starting with a vowel

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
words = ["apple", "banana", "orange", "grape", "umbrella", "kiwi"]
vowel_words = list(filter(lambda word: word[0].lower() in "aeiou", words))
print(vowel_words)
```

</div>

## Example 11: Remove empty strings from a list

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
items = ["Python", "", "Code", "", "Study", "Guide"]
clean_items = list(filter(lambda item: item != "", items))
print(clean_items)
```

</div>

## Example 12: Filter students with passing marks

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
students = [
    {"name": "Asha", "marks": 85},
    {"name": "Ravi", "marks": 38},
    {"name": "Sara", "marks": 74},
    {"name": "John", "marks": 29}
]

passed_students = list(filter(lambda student: student["marks"] >= 40, students))
print(passed_students)
```

</div>

## Example 13: Compare filter() with a loop

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]

evens_loop = []
for num in numbers:
    if num % 2 == 0:
        evens_loop.append(num)

evens_filter = list(filter(lambda x: x % 2 == 0, numbers))

print(evens_loop)
print(evens_filter)
```

</div>

## Example 14: Combine filter() and map()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]

even_squares = list(map(lambda x: x * x,
                         filter(lambda x: x % 2 == 0, numbers)))

print(even_squares)
```

</div>


## 5. What these examples teach

- Examples 1–2 show the core use of `filter()` with normal functions and lambda.
- Examples 3–4 show how to apply one condition or multiple conditions.
- Examples 5–7 show filtering text and truthy/falsy values.
- Examples 8–12 show practical filtering on structured data like dictionaries.
- Examples 13–14 compare `filter()` with loops and then combine it with `map()`.

## 6. Common mistakes

- Forgetting that `filter()` returns an iterator, not a list.
- Writing unclear conditions that do not obviously return `True` or `False`.
- Making lambda conditions too complex.
- Using missing dictionary keys.
- Reusing an already-consumed filter object.

## 7. Mentor tips / best practices

- Use `filter()` when the goal is selection.
- Use `map()` when the goal is transformation.
- Keep conditions readable.
- Prefer a named function when the logic deserves a clear name.
- Compare `filter()` with list comprehensions and choose the clearest version.

## 8. Practice tasks

1. Keep only odd numbers from a list.
2. Keep only numbers less than 10.
3. Keep only names longer than 5 letters.
4. Keep only positive even numbers.
5. Remove empty strings from a list.
6. Filter people older than 18 from a list of dictionaries.
7. Filter students scoring 50 or more.
8. Keep only words starting with `"p"`.

## 9. Revision notes

- `filter()` keeps only items that satisfy a condition.
- Syntax: `filter(function, iterable)`
- It returns an iterator in Python 3.
- `list()` is commonly used to view the results.
- It works well with lambda and named functions.
- It is very useful for data cleaning and record selection.
