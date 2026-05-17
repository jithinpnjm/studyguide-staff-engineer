---
title: "Chapter 16 Modules And Packages"
description: "Generated from mlops/PYTHON/Basics/chapter_16_modules_and_packages.ipynb"
slug: "/python-basics/chapter-16-modules-and-packages"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_16_modules_and_packages.ipynb</code></div>

# Chapter 16 — Modules and Packages in Python

This notebook follows your study-guide format with explanations, runnable examples, common mistakes, mentor tips, practice tasks, and revision notes.

## 1. Chapter title

**Modules and Packages in Python**

## 2. Concept explanation

Modules and packages help organize Python code into reusable parts.

- A **module** is a `.py` file.
- A **package** is a folder of related modules.
- `__init__.py` is commonly used to mark a package.
- Built-in modules like `math` are already available.
- Third-party packages like `numpy` can be installed separately.

## Example 1: Importing the math module

This shows how to use functions and constants from Python's built-in `math` module.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
import math

print(math.sqrt(36))
print(math.pi)
```

</div>

## Example 2: Import specific items

This shows selective import when you want only certain names.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
from math import sqrt, pi

print(sqrt(49))
print(pi)
```

</div>

## Example 3: Import with alias

Aliases make repeated module usage shorter.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
import math as m

print(m.sqrt(64))
print(m.floor(4.9))
```

</div>

## Example 4: Import NumPy with alias

This introduces a widely used third-party package and the common alias `np`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
import numpy as np

arr = np.array([1, 2, 3, 4, 5])
print(arr)
```

</div>

## Example 5: Simulated custom module usage

This demonstrates the kind of code you would place inside your own module.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
# calculator_tools.py
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b

print(add(3, 4))
print(multiply(5, 6))
```

</div>

## Example 6: Using dir() to inspect a module

This helps you explore what a module provides.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
import math
print(dir(math)[:10])
```

</div>

## Example 7: Using help() on a function

This teaches you how to learn directly from Python's built-in help system.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
import math
print(help(math.sqrt))
```

</div>

## Example 8: Example package structure

This gives a visual picture of how a package is structured.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
package_structure = """\nmy_package/\n    __init__.py\n    greetings.py\n"""\nprint(package_structure)
```

</div>
