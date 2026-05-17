---
title: "Chapter 27 Custom Exceptions Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_27_custom_exceptions_beginner_friendly.ipynb"
slug: "/python-basics/chapter-27-custom-exceptions-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_27_custom_exceptions_beginner_friendly.ipynb</code></div>

# Chapter 27 — Custom Exceptions in Python

This notebook follows the same beginner-friendly teaching style as the recent advanced chapters.

## Start here: one-line meaning

**A custom exception is your own error type that you create for your program’s specific rules.**

## Tiny memory guide

- built-in exception = Python’s ready-made error  
- custom exception = your own program-specific error  
- `raise` = create/send an exception  
- `try/except` = catch and handle an exception  

## Before you begin

This chapter becomes much easier if you think like this:

Sometimes Python's built-in errors are not enough.

Your app may have its own rules, such as:

- age must be between 20 and 30
- marks must be between 0 and 100
- password must be strong enough
- username cannot be empty

For these situations, custom exceptions are very useful.

## Example 1: A very simple custom exception class

**What this teaches:** A custom exception is usually created by inheriting from Python’s `Exception` class.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
class MyCustomError(Exception):
    pass

print("Custom exception class created")
```

</div>

## Example 2: Raising a custom exception manually

**What this teaches:** The `raise` keyword is used to create and send an exception.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
class MyCustomError(Exception):
    pass

raise MyCustomError("Something custom went wrong")
```

</div>

## Example 3: Catching a custom exception with try-except

**What this teaches:** Custom exceptions can be handled just like built-in exceptions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
class MyCustomError(Exception):
    pass

try:
    raise MyCustomError("Something custom went wrong")
except MyCustomError as e:
    print("Caught custom exception:", e)
```

</div>

## Example 4: Exam form rule using a custom exception

**What this teaches:** This introduces the lecture-style idea: age must be within a valid range.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
class DOBException(Exception):
    pass

age = 18

if age < 20 or age > 30:
    raise DOBException("Age must be between 20 and 30 for this exam form.")
```

</div>

## Example 5: Handling the age rule safely

**What this teaches:** This is the same age rule, but now handled with `try/except`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
class DOBException(Exception):
    pass

age = 18

try:
    if age < 20 or age > 30:
        raise DOBException("Age must be between 20 and 30 for this exam form.")
    print("Form accepted")
except DOBException as e:
    print("Form error:", e)
```

</div>

## Example 6: A reusable age validation function

**What this teaches:** Putting the rule inside a function makes the code cleaner and reusable.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
class DOBException(Exception):
    pass

def validate_age(age):
    if age < 20 or age > 30:
        raise DOBException("Age must be between 20 and 30.")
    return "Valid age"

try:
    print(validate_age(25))
    print(validate_age(35))
except DOBException as e:
    print("Validation failed:", e)
```

</div>

## Example 7: User input converted to integer

**What this teaches:** This shows how custom exceptions often work together with normal input validation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
class DOBException(Exception):
    pass

age_input = "22"
age = int(age_input)

try:
    if age < 20 or age > 30:
        raise DOBException("Age must be between 20 and 30.")
    print("Age accepted")
except DOBException as e:
    print("Error:", e)
```

</div>

## Example 8: Handling ValueError and custom exception together

**What this teaches:** Real programs often need both built-in and custom exceptions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
class DOBException(Exception):
    pass

user_input = "abc"

try:
    age = int(user_input)
    if age < 20 or age > 30:
        raise DOBException("Age must be between 20 and 30.")
    print("Valid age")
except ValueError:
    print("Please enter a valid number.")
except DOBException as e:
    print("Custom age error:", e)
```

</div>

## Example 9: Custom exception with a more meaningful name

**What this teaches:** Good exception names make your program easier to understand.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
class InvalidAgeForExamError(Exception):
    pass

try:
    age = 31
    if age < 20 or age > 30:
        raise InvalidAgeForExamError("Candidate age is not valid for this exam.")
except InvalidAgeForExamError as e:
    print(e)
```

</div>

## Example 10: Adding a custom message in the exception class

**What this teaches:** A custom exception class can also define its own default message style.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
class DOBException(Exception):
    def __init__(self, message="Invalid age for exam form"):
        self.message = message
        super().__init__(self.message)

try:
    raise DOBException()
except DOBException as e:
    print(e)
```

</div>

## Example 11: Marks validation with a custom exception

**What this teaches:** Custom exceptions are not only for age — they are useful for any rule in your app.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
class MarksException(Exception):
    pass

marks = 120

try:
    if marks < 0 or marks > 100:
        raise MarksException("Marks must be between 0 and 100.")
    print("Marks accepted")
except MarksException as e:
    print("Marks error:", e)
```

</div>

## Example 12: Bank withdrawal with a custom exception

**What this teaches:** This is a practical example where business rules create custom exceptions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
class InsufficientBalanceError(Exception):
    pass

balance = 1000
withdraw_amount = 1500

try:
    if withdraw_amount > balance:
        raise InsufficientBalanceError("Insufficient balance for withdrawal.")
    print("Withdrawal successful")
except InsufficientBalanceError as e:
    print("Bank error:", e)
```

</div>

## Example 13: Password validation custom exception

**What this teaches:** Another real-world example: custom rules for password quality.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
class WeakPasswordError(Exception):
    pass

password = "abc"

try:
    if len(password) < 8:
        raise WeakPasswordError("Password must be at least 8 characters long.")
    print("Password accepted")
except WeakPasswordError as e:
    print("Password error:", e)
```

</div>

## Example 14: A full date-of-birth style flow

**What this teaches:** This is a beginner-friendly version of the lecture’s exam-form idea.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
class DOBException(Exception):
    pass

birth_year = 2008
current_year = 2026
age = current_year - birth_year

try:
    print("Calculated age:", age)
    if age < 20 or age > 30:
        raise DOBException("Applicant age must be between 20 and 30.")
    print("Application accepted")
except DOBException as e:
    print("Application rejected:", e)
```

</div>

## Example 15: Generic custom exception plus specific custom exception

**What this teaches:** You can build a more organized custom exception structure with parent and child exception classes.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
class AppError(Exception):
    pass

class DOBException(AppError):
    pass

try:
    age = 19
    if age < 20 or age > 30:
        raise DOBException("Age must be between 20 and 30.")
except DOBException as e:
    print("Specific error:", e)
except AppError as e:
    print("General app error:", e)
```

</div>

## 5. Common confusion cleared up

### Built-in exception vs custom exception

- built-in exception = already provided by Python
- custom exception = created by you for your program’s own rules

### When should you create a custom exception?

Create one when your program has a meaningful business rule, such as:

- invalid age for exam form
- invalid marks
- insufficient balance
- weak password

### One sentence to remember

> Custom exceptions make your program’s rules clearer and error messages more meaningful.

## 6. Common mistakes

- creating a custom exception when a built-in one would already be enough
- giving the exception a vague name
- forgetting to inherit from `Exception`
- raising exceptions without handling them when user-friendly handling is needed

## 7. Mentor tips / best practices

- give custom exceptions clear names like `DOBException` or `WeakPasswordError`
- use custom exceptions for real application rules
- combine them with `try/except` for better user experience
- keep validation code readable
- start simple before building large exception hierarchies

## 8. Practice tasks

1. Create your own simple custom exception.
2. Raise it manually.
3. Catch it with `try/except`.
4. Build an age validation rule.
5. Build a marks validation rule.
6. Build a password validation rule.
7. Create one custom exception for a bank account rule.

## 9. Revision notes

- custom exceptions are created by inheriting from `Exception`
- `raise` is used to trigger an exception
- `try/except` is used to catch and handle it
- custom exceptions are useful for program-specific rules
- they make code clearer and error messages more meaningful
