---
title: "Chapter 13 Lambda Functions Map Filter"
description: "Generated from mlops/PYTHON/Basics/chapter_13_lambda_functions_map_filter.ipynb"
slug: "/python-basics/chapter-13-lambda-functions-map-filter"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_13_lambda_functions_map_filter.ipynb</code></div>

# Chapter 13 — Lambda Functions, `map()`, and `filter()`


## 1. Chapter title

**Lambda Functions, `map()`, and `filter()`**

## 2. Concept explanation

Lambda functions in Python are **small anonymous functions** created with the `lambda` keyword.

Anonymous means the function does not need a regular name like a normal function made with `def`.

The basic syntax is:

```python
lambda arguments: expression
```

A lambda function:

- can take **any number of arguments**
- must contain **only one expression**
- automatically returns the result of that expression
- is mainly used for **short, quick operations**

### Basic idea

A normal function:

```python
def square(x):
    return x * x
```

The lambda version:

```python
square = lambda x: x * x
```

Both do the same thing. The lambda version is just shorter.

### Important rule

A lambda function can contain only **one expression**, not a full block of code.

That means lambda is not the right choice for:

- multiple statements
- loops written as normal statements
- assignments like `x = x + 1`
- long multi-step logic

So lambda is best when the logic is short and readable.

### Why Python has lambda

Lambda functions are useful when:

- you need a function only once
- the task is very small
- you want compact inline code
- you are passing a function into another function

This is especially common with:

- `map()`
- `filter()`
- `sorted()`
- `max()`
- `min()`

### Lambda vs normal functions

Use a normal `def` function when:

- the logic is longer
- the function needs comments or documentation
- you want better readability
- you want to reuse it in many places
- the task has multiple steps

Use lambda when:

- the function is tiny
- the meaning is obvious
- it is being used inline for a one-time task

### Deeper understanding

A lambda function is still a real function object.

That means it can be:

- stored in a variable
- passed into another function
- called later like any other function

Example:

```python
add = lambda a, b: a + b
print(add(3, 4))
```

So lambda is not a special trick. It is simply another way to create a function.

### Lecture points preserved and expanded

From your notes, the key ideas are:

- Lambda functions are small anonymous functions.
- They are defined using the `lambda` keyword.
- They can take any number of arguments.
- They must contain only a single expression.
- They are useful for quick operations.
- Standard functions can often be converted into lambda functions.
- They support operations like checking even/odd or summing numbers.
- They work well with `map()` and `filter()`.
- They help make code concise and efficient when used properly.

## 3. Why it matters

Lambda functions matter because they help you understand an important Python idea:

**functions can be treated like values**

This is a big step into more advanced Python thinking.

Once you understand lambda properly, you begin to see that Python allows you to:

- store functions in variables
- pass functions into other functions
- transform data more elegantly
- write cleaner short operations

This matters in:

- list processing
- sorting
- filtering
- data transformation
- interview-style problems
- functional programming concepts

Lambda also helps you understand how Python handles small custom behavior without forcing you to define a full named function every time.

## 4. Code examples

### Example 1: Simple lambda function

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
square = lambda x: x * x
print(square(5))
```

</div>

### Example 2: Converting a normal function into lambda

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
def add_numbers(a, b):
    return a + b

add_lambda = lambda a, b: a + b

print(add_numbers(3, 7))
print(add_lambda(3, 7))
```

</div>

### Example 3: Even or odd check

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
is_even = lambda n: n % 2 == 0

print(is_even(10))
print(is_even(7))
```

</div>

### Example 4: Lambda with multiple arguments

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
total = lambda a, b, c: a + b + c
print(total(5, 10, 15))
```

</div>

### Example 5: Lambda returning text with a condition

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
check_number = lambda n: 'Even' if n % 2 == 0 else 'Odd'

print(check_number(8))
print(check_number(11))
```

</div>

### Example 6: Using lambda with map()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
numbers = [1, 2, 3, 4, 5]
squares = list(map(lambda x: x * x, numbers))
print(squares)
```

</div>

### Example 7: Using lambda with filter()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]
evans = list(filter(lambda x: x % 2 == 0, numbers))
print(evans)
```

</div>

### Example 8: Using lambda with sorted()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
students = [('Alice', 85), ('Bob', 72), ('Charlie', 91)]
sorted_by_marks = sorted(students, key=lambda student: student[1])
print(sorted_by_marks)
```

</div>

### Example 9: Sorting words by length

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
words = ['python', 'ai', 'code', 'developer']
sorted_words = sorted(words, key=lambda word: len(word))
print(sorted_words)
```

</div>

### Example 10: Practical filtering with dictionaries

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
products = [
    {'name': 'Laptop', 'price': 1200},
    {'name': 'Mouse', 'price': 25},
    {'name': 'Keyboard', 'price': 80}
]

expensive_products = list(filter(lambda item: item['price'] > 100, products))
print(expensive_products)
```

</div>

### Example 11: Converting names to uppercase

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
names = ['alice', 'bob', 'charlie']
upper_names = list(map(lambda name: name.upper(), names))
print(upper_names)
```

</div>

### Example 12: Combining filter() and map()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]

even_squares = list(
    map(lambda x: x * x,
        filter(lambda x: x % 2 == 0, numbers))
)

print(even_squares)
```

</div>


## 5. Explanation of code

### Example 1 explanation

This teaches the simplest lambda form: one input, one expression, one result.

### Example 2 explanation

This shows that lambda does not create a new kind of logic. It simply gives a shorter way to write a small function.

### Example 3 explanation

This teaches that lambda can return a boolean value. That is useful in conditions, checking rules, and filtering data.

### Example 4 explanation

This shows that lambda can take multiple arguments, not just one.

### Example 5 explanation

This introduces the conditional expression:

```python
value_if_true if condition else value_if_false
```

Because lambda allows only one expression, this style is often used inside it.

### Example 6 explanation

`map()` applies a function to every item in an iterable.

Here:

- each number is passed into the lambda
- the lambda squares it
- `map()` creates transformed results
- `list()` converts them into a visible list

So `[1, 2, 3, 4, 5]` becomes `[1, 4, 9, 16, 25]`.

### Example 7 explanation

`filter()` keeps only the items for which the lambda returns `True`.

Here the lambda checks whether each number is even. Only the even numbers remain.

### Example 8 explanation

This is one of the most useful real-world lambda patterns.

In `sorted(students, key=lambda student: student[1])`, the lambda tells Python to use the second value in each tuple for sorting.

### Example 9 explanation

This shows that lambda can define a custom sorting rule. Instead of alphabetical sorting, the words are sorted by length.

### Example 10 explanation

This is a practical example with dictionaries. It teaches that lambda is useful when selecting items from structured data.

### Example 11 explanation

This demonstrates transformation of string data using `map()`.

### Example 12 explanation

This creates a small data-processing pipeline:

- `filter()` keeps only even numbers
- `map()` squares those filtered numbers

This is powerful, but it should still stay readable.

## 6. Common mistakes

### 1. Trying to write multiple statements inside lambda

This is invalid:

```python
# Invalid
lambda x:
    y = x + 1
    return y
```

Why it fails:

- lambda allows only one expression

Use a normal function instead.

### 2. Making lambda too complex

This works, but becomes harder to read:

```python
result = lambda x: "A" if x > 90 else "B" if x > 75 else "C" if x > 60 else "D"
```

When a lambda becomes hard to read, switch to `def`.

### 3. Forgetting that `map()` and `filter()` return iterators

In Python 3:

```python
numbers = [1, 2, 3]
result = map(lambda x: x * x, numbers)
print(result)
```

This prints a map object, not the final list.

Use:

```python
print(list(result))
```

### 4. Using lambda where a normal function is clearer

Shorter code is not always better code.

### 5. Confusing `=` with `==`

Inside lambda conditions, comparisons still need `==`.

### 6. Misunderstanding `key=` in sorting

The `key` lambda does not compare two values directly. It tells Python what value to extract and use for sorting.

### Debugging tips

- Replace the lambda with a normal function temporarily.
- Test one input at a time.
- Print the intermediate output.
- Keep the expression small enough that you can mentally trace it.

## 7. Mentor tips / best practices

- Use lambda for **small, clear, one-purpose logic**.
- Prefer `def` when the logic has multiple steps.
- Readability is more important than saving one line.
- Lambda works especially well with `map()`, `filter()`, and `sorted()`.
- Do not force lambda into every situation.
- If you want comments, docstrings, or step-by-step debugging, use a normal function.

### Important best-practice comparison

```python
numbers = [1, 2, 3, 4]
squares_1 = list(map(lambda x: x * x, numbers))
squares_2 = [x * x for x in numbers]

print(squares_1)
print(squares_2)
```

Both are correct.

Many Python developers prefer the list comprehension version because it is often easier to read.

### Mentor view

Lambda is useful, but it should not become “clever code.”  
A good Python programmer writes code that is easy to understand later.

## 8. Practice tasks

1. Write a lambda function to cube a number.
2. Write a lambda function to check whether a number is positive.
3. Use `map()` with lambda to double all values in a list.
4. Use `filter()` with lambda to keep only numbers greater than 10.
5. Sort a list of tuples by the second value.
6. Convert a list of names to lowercase using `map()`.
7. Create a lambda that returns `"Adult"` if age is 18 or more, otherwise `"Minor"`.
8. Filter a list of words to keep only those with length greater than 4.
9. Build a list of product dictionaries and filter expensive ones.
10. Solve one problem using `map()` and then solve the same one using a list comprehension.

## 9. Revision notes

- Lambda functions are anonymous functions created with `lambda`.
- Syntax: `lambda arguments: expression`
- They can take many arguments but only one expression.
- They are useful for short inline logic.
- `map()` transforms items.
- `filter()` selects items based on a condition.
- `sorted(..., key=lambda ...)` is one of the most practical lambda patterns.
- In Python 3, `map()` and `filter()` return iterators, so `list()` is often used to view the results.
- Use lambda for short logic.
- Use `def` for more readable multi-step logic.
- Readability is more important than cleverness.

## Practice task sample solutions

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
cube = lambda x: x ** 3
print(cube(4))
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
is_positive = lambda x: x > 0
print(is_positive(-2))
print(is_positive(5))
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
nums = [1, 2, 3, 4]
doubled = list(map(lambda x: x * 2, nums))
print(doubled)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
nums = [4, 11, 18, 3, 25]
greater_than_ten = list(filter(lambda x: x > 10, nums))
print(greater_than_ten)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
pairs = [('a', 3), ('b', 1), ('c', 2)]
sorted_pairs = sorted(pairs, key=lambda item: item[1])
print(sorted_pairs)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 35</div>

```python
age_group = lambda age: 'Adult' if age >= 18 else 'Minor'
print(age_group(16))
print(age_group(21))
```

</div>
