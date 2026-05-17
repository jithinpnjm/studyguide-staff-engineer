---
title: "Chapter 12 Practical Function Examples"
description: "Generated from mlops/PYTHON/Basics/chapter_12_practical_function_examples.ipynb"
slug: "/python-basics/chapter-12-practical-function-examples"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_12_practical_function_examples.ipynb</code></div>

# Chapter 12 — Practical Function Examples

Built from your booklet, expanded into a runnable study notebook with examples and practice solutions.

## 1. Concept explanation

### Why practical function examples matter
Concepts become stronger when you use them to solve real problems. These examples combine functions with strings, loops, dictionaries, conditions, and validation.

### Temperature conversion
A good example of parameters, conditions, and return values.

### Password strength checker
Checks multiple rules using boolean logic and string methods.

### Shopping cart total
Shows how functions work with a list of dictionaries and accumulation.

### Palindrome checker
Uses lowercase conversion and slicing.

### Recursion — factorial
A recursive function needs a base case and a recursive step.

### Word count function
Combines strings, dictionaries, and counting patterns.

### Email validation
Introduces regular expressions at a practical beginner level.

## 2. Why it matters
These ideas are foundational because they appear repeatedly in real Python code. Mastering them now makes later topics easier to understand.

## 3. Code examples

### Temperature conversion
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
def convert_temperature(temp, unit):
    if unit == "C":
        return (temp * 9/5) + 32
    elif unit == "F":
        return (temp - 32) * 5/9
    else:
        return "Invalid unit"

print(convert_temperature(25, "C"))
```

</div>

**What this example teaches:** It shows the main idea behind **temperature conversion** and gives you a runnable reference you can modify while practicing.

### Password checker
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
def check_password_strength(password):
    has_digit = any(char.isdigit() for char in password)
    has_upper = any(char.isupper() for char in password)
    has_lower = any(char.islower() for char in password)

    if len(password) >= 8 and has_digit and has_upper and has_lower:
        return True
    return False

print(check_password_strength("Python123"))
```

</div>

**What this example teaches:** It shows the main idea behind **password checker** and gives you a runnable reference you can modify while practicing.

### Shopping cart total
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
def calculate_total(cart):
    total = 0
    for item in cart:
        total += item["price"] * item["quantity"]
    return total

cart = [
    {"name": "Laptop", "price": 1000, "quantity": 1},
    {"name": "Mouse", "price": 25, "quantity": 2}
]
print(calculate_total(cart))
```

</div>

**What this example teaches:** It shows the main idea behind **shopping cart total** and gives you a runnable reference you can modify while practicing.

### Palindrome checker
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
def is_palindrome(text):
    text = text.lower()
    return text == text[::-1]

print(is_palindrome("level"))
```

</div>

**What this example teaches:** It shows the main idea behind **palindrome checker** and gives you a runnable reference you can modify while practicing.

### Factorial recursion
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
```

</div>

**What this example teaches:** It shows the main idea behind **factorial recursion** and gives you a runnable reference you can modify while practicing.

### Word count
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
def word_count(text):
    words = text.split()
    freq = {}
    for word in words:
        freq[word] = freq.get(word, 0) + 1
    return freq

text = "python is easy and python is powerful"
print(word_count(text))
```

</div>

**What this example teaches:** It shows the main idea behind **word count** and gives you a runnable reference you can modify while practicing.

### Email validation
This example demonstrates a key pattern from the chapter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
import re

def validate_email(email):
    pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return re.match(pattern, email) is not None

print(validate_email("test@example.com"))
```

</div>

**What this example teaches:** It shows the main idea behind **email validation** and gives you a runnable reference you can modify while practicing.

## 4. Common mistakes

- Forgetting edge cases such as invalid unit values
- Building validators that are too weak or too strict
- Using recursion without a base case

## 5. Mentor tips / best practices

- Real projects combine many small concepts together.
- Test practical functions with both valid and invalid inputs.
- Improve beginner solutions step by step instead of rewriting from scratch.

## 6. Practice tasks with sample solutions

### Practice task 1
Write a BMI calculator function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 40</div>

```python
def bmi(weight, height):
    return weight / (height ** 2)

print(round(bmi(70, 1.75), 2))
```

</div>

### Practice task 2
Improve the password checker to require a special character.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 42</div>

```python
import string

def strong_password(password):
    return (
        len(password) >= 8 and
        any(c.islower() for c in password) and
        any(c.isupper() for c in password) and
        any(c.isdigit() for c in password) and
        any(c in string.punctuation for c in password)
    )

print(strong_password("Py@thon123"))
```

</div>

### Practice task 3
Write a palindrome checker that ignores spaces.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 44</div>

```python
def clean_palindrome(text):
    text = text.replace(" ", "").lower()
    return text == text[::-1]

print(clean_palindrome("level level"))
```

</div>

### Practice task 4
Write a recursive Fibonacci function.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 46</div>

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(6))
```

</div>

### Practice task 5
Write a function that counts characters instead of words.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 48</div>

```python
def char_count(text):
    freq = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    return freq

print(char_count("hello"))
```

</div>

## 7. Revision notes

- Functions solve real problems
- They become powerful when combined with loops and conditions
- Recursion is important but must be designed carefully
- Counting with dictionaries is a high-value skill
