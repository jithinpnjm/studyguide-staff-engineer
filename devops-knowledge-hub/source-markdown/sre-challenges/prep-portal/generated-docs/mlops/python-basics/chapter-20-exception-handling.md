---
title: "Chapter 20 Exception Handling"
description: "Generated from mlops/PYTHON/Basics/chapter_20_exception_handling.ipynb"
slug: "/python-basics/chapter-20-exception-handling"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_20_exception_handling.ipynb</code></div>

# Chapter 20 — Exception Handling in Python

This notebook follows your study guide format and includes explanations, runnable examples, common mistakes, mentor tips, practice tasks, and revision notes.


## 1. Chapter title

**Exception Handling in Python**

## 2. Concept explanation

This chapter teaches how to use:
- `try`
- `except`
- `else`
- `finally`

to manage errors without abruptly stopping your program.

## Example 1: Basic try and except

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
try:
    result = 10 / 0
    print(result)
except ZeroDivisionError:
    print("You cannot divide by zero.")
```

</div>

## Example 2: Handling ValueError

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
try:
    age = int("twenty")
    print(age)
except ValueError:
    print("Invalid number format.")
```

</div>

## Example 3: Handling file errors

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
try:
    with open("missing_file.txt", "r") as file:
        content = file.read()
except FileNotFoundError:
    print("The file was not found.")
```

</div>

## Example 4: Using else

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
try:
    number = int("12")
except Exception as ex:
    print("Conversion failed.")
    print(ex)
else:
    print("Conversion successful.")
    print("Number is:", number)
```

<div className="notebook-output__label">Output</div>

```text
Conversion successful.
Number is: 12
```

</div>

## Example 5: Using finally

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
try:
    result = 10 / 2
    print(result)
except ZeroDivisionError:
    print("Division error.")
finally:
    print("This block always runs.")
```

<div className="notebook-output__label">Output</div>

```text
5.0
This block always runs.
```

</div>

## Example 6: Multiple except blocks

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
try:
    value = int("hello")
    result = 10 / value
except ValueError:
    print("Please enter a valid integer.")
except ZeroDivisionError:
    print("Division by zero is not allowed.")
```

</div>

## Example 7: Catching all exceptions

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
try:
    data = {"name": "Asha"}
    print(data["age"])
except Exception as e:
    print("An unexpected error occurred:", e)
```

</div>

## Example 8: Handling NameError

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
try:
    print(total_amount)
except NameError:
    print("The variable is not defined.")
```

</div>

## Example 9: Safe user input conversion

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
user_input = "42"

try:
    number = int(user_input)
    print("You entered:", number)
except ValueError:
    print("Please enter a valid integer.")
```

</div>

## Example 10: File handling with finally

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
file = None

try:
    file = open("sample_exception.txt", "w")
    file.write("Testing exception handling.")
except Exception as e:
    print("Error:", e)
finally:
    if file:
        file.close()
        print("File closed safely.")
```

</div>

## Example 11: Using else and finally together

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
try:
    x = 10
    y = 5
    result = x / y
except ZeroDivisionError:
    print("Cannot divide by zero.")
else:
    print("Result:", result)
finally:
    print("Calculation complete.")
```

</div>

## Example 12: Checking list access

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
try:
    numbers = [1, 2, 3]
    print(numbers[5])
except IndexError:
    print("List index is out of range.")
```

</div>

## Example 13: Handling dictionary key errors

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
try:
    student = {"name": "Ravi"}
    print(student["marks"])
except KeyError:
    print("Key not found in dictionary.")
```

</div>

## Example 14: Simple validation function

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
def divide_numbers(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return "Cannot divide by zero."

print(divide_numbers(10, 2))
print(divide_numbers(10, 0))
```

</div>

## Example 15: Broad catch after specific catches

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
try:
    value = int("abc")
except ValueError:
    print("ValueError handled.")
except Exception as e:
    print("Other exception:", e)
```

</div>


## 5. What these examples teach

- how exceptions interrupt normal program flow
- how `try` and `except` work together
- how to use `else` for successful execution
- how to use `finally` for cleanup
- how to handle multiple exception types
- how to catch broad exceptions carefully
- how exception handling helps with files, input, lists, and dictionaries

## 6. Common mistakes

- using a broad `except` too early
- catching `Exception` before specific exceptions
- hiding useful error details
- using exceptions instead of normal checks
- forgetting cleanup tasks

## 7. Mentor tips / best practices

- prefer specific exceptions first
- use `else` for success-only logic
- use `finally` for cleanup
- print helpful messages
- test both success and failure cases

## 8. Practice tasks

1. Catch `ZeroDivisionError`.
2. Convert text to integer and catch `ValueError`.
3. Open a missing file and catch `FileNotFoundError`.
4. Use `else` in a working example.
5. Use `finally` to always print a message.
6. Handle `NameError`, `IndexError`, and `KeyError`.

## 9. Revision notes

- `try` contains risky code
- `except` handles errors
- `else` runs on success
- `finally` always runs
- exceptions should be handled clearly and specifically when possible
