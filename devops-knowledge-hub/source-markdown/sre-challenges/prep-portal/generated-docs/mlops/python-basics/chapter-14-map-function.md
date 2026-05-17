---
title: "Chapter 14 Map Function"
description: "Generated from mlops/PYTHON/Basics/chapter_14_map_function.ipynb"
slug: "/python-basics/chapter-14-map-function"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_14_map_function.ipynb</code></div>

# Chapter 14 — The map() Function in Python

This notebook follows your study guide format with explanations, examples, practice tasks, and sample solutions.

## 1. Chapter title

**The `map()` Function in Python**

---

## 2. Concept explanation

The `map()` function in Python is a powerful built-in tool used to apply a function to every item in an iterable such as a list, tuple, or other sequence-like object.

Its main purpose is **data transformation**.

Instead of writing a loop and manually creating a new list, `map()` lets you say:

> “Apply this function to every item.”

### Basic syntax

```python
map(function, iterable)
```

This means:

- take a function
- take an iterable
- apply the function to each item one by one
- return a `map` object containing the transformed values

### Simple idea

Suppose you have a list of numbers and you want the square of each number.

Without `map()`, you might write:

```python
numbers = [1, 2, 3, 4]
result = []

for num in numbers:
    result.append(num * num)

print(result)
```

With `map()`, the same transformation becomes much shorter:

```python
numbers = [1, 2, 3, 4]
result = map(lambda x: x * x, numbers)
print(list(result))
```

### Important note about Python 3

In Python 3, `map()` does **not** directly return a list.  
It returns a **map object**, which is an iterator.

That means you often convert it into a list:

```python
list(map(...))
```

### What kind of function can be used with `map()`?

You can use:

- a normal function made with `def`
- a lambda function
- a built-in function like `int`, `str.upper`, or `len`

This makes `map()` very flexible.

### Working with multiple iterables

`map()` can also work with more than one iterable.

Example:

```python
list1 = [1, 2, 3]
list2 = [10, 20, 30]

result = list(map(lambda a, b: a + b, list1, list2))
print(result)
```

Output:

```python
[11, 22, 33]
```

Here, `map()` takes one item from each iterable at the same position and passes them into the function.

### Processing complex data

`map()` is not limited to simple lists of numbers.  
It can also work with:

- strings
- tuples
- lists of dictionaries
- mixed structured data

This makes it useful in real-world programming where data often comes in structured forms.

### Lecture points preserved and expanded

From your lecture notes, the key ideas are:

- `map()` applies a specified function to all items in an iterable.
- It helps transform data without writing manual loops.
- It works with predefined functions.
- It also works very well with lambda functions.
- It can handle multiple iterables at once.
- It can transform strings, numbers, and more complex structures like dictionaries.
- It helps produce cleaner and more efficient code when used well.

---

## 3. Why it matters

The `map()` function matters because data transformation is one of the most common tasks in programming.

As Python topics become more advanced, you will often need to:

- clean data
- convert data types
- format values
- transform collections
- extract specific fields
- prepare data for analysis or display

`map()` teaches an important programming mindset:

**focus on what transformation you want, not only on how to loop**

This helps you write code that is:

- shorter
- more expressive
- often easier to reuse
- closer to functional-style programming

It also prepares you for working with:

- list comprehensions
- `filter()`
- `zip()`
- sorting keys
- data pipelines
- real-world data manipulation

---

## 4. Code examples

### Example 1: Using `map()` with a predefined function

```python
def square(n):
    return n * n

numbers = [1, 2, 3, 4, 5]
squared_numbers = list(map(square, numbers))
print(squared_numbers)
```

### Example 2: Using `map()` with a lambda function

```python
numbers = [1, 2, 3, 4, 5]
squared_numbers = list(map(lambda x: x * x, numbers))
print(squared_numbers)
```

### Example 3: Converting strings to integers

```python
string_numbers = ["1", "2", "3", "4", "5"]
int_numbers = list(map(int, string_numbers))
print(int_numbers)
```

### Example 4: Convert names to uppercase

```python
names = ["alice", "bob", "charlie"]
upper_names = list(map(str.upper, names))
print(upper_names)
```

### Example 5: Adding two lists element-wise

```python
list1 = [1, 2, 3]
list2 = [10, 20, 30]

added = list(map(lambda a, b: a + b, list1, list2))
print(added)
```

### Example 6: Multiply two lists element-wise

```python
list1 = [2, 4, 6]
list2 = [3, 5, 7]

products = list(map(lambda a, b: a * b, list1, list2))
print(products)
```

### Example 7: Get lengths of words

```python
words = ["python", "map", "function", "code"]
word_lengths = list(map(len, words))
print(word_lengths)
```

### Example 8: Extract names from a list of dictionaries

```python
students = [
    {"name": "Asha", "marks": 85},
    {"name": "Ravi", "marks": 90},
    {"name": "Sara", "marks": 78}
]

student_names = list(map(lambda student: student["name"], students))
print(student_names)
```

### Example 9: Format prices from numeric data

```python
prices = [49.5, 99.99, 120, 15.75]
formatted_prices = list(map(lambda p: f"${p:.2f}", prices))
print(formatted_prices)
```

### Example 10: Strip spaces from strings

```python
raw_names = ["  Alice  ", " Bob", "Charlie  "]
clean_names = list(map(str.strip, raw_names))
print(clean_names)
```

### Example 11: Use a custom function with dictionaries

```python
products = [
    {"name": "Laptop", "price": 1200},
    {"name": "Mouse", "price": 25},
    {"name": "Keyboard", "price": 80}
]

def get_product_name(product):
    return product["name"]

product_names = list(map(get_product_name, products))
print(product_names)
```

### Example 12: Combine text from multiple iterables

```python
first_names = ["Ali", "Sara", "John"]
last_names = ["Khan", "Lee", "Smith"]

full_names = list(map(lambda f, l: f + " " + l, first_names, last_names))
print(full_names)
```

### Example 13: Comparing `map()` with a loop

```python
numbers = [1, 2, 3, 4]

# Using loop
result_loop = []
for num in numbers:
    result_loop.append(num ** 2)

# Using map
result_map = list(map(lambda x: x ** 2, numbers))

print(result_loop)
print(result_map)
```

### Example 14: `map()` with conditional logic

```python
numbers = [1, 2, 3, 4, 5, 6]
labels = list(map(lambda x: "Even" if x % 2 == 0 else "Odd", numbers))
print(labels)
```

---

## 5. Explanation of code

### Example 1 explanation

This teaches the most basic and readable form of `map()`: a normal function is applied to each number in the list.

### Example 2 explanation

This teaches the same transformation, but with lambda. It is shorter and often used for quick one-line operations.

### Example 3 explanation

This is a very practical use of `map()`. Data often comes as strings, especially from user input, files, or CSV data. `map(int, ...)` quickly converts all values to integers.

### Example 4 explanation

This shows that `map()` can use built-in methods directly. Here `str.upper` is applied to each name.

### Example 5 explanation

This introduces multiple iterables.  
At each step:

- one value comes from `list1`
- one value comes from `list2`
- the lambda adds them

### Example 6 explanation

This reinforces that `map()` can process two iterables together, not just one.

### Example 7 explanation

This teaches that `map()` works well with built-in functions like `len`.

### Example 8 explanation

This is a real-world data example. It extracts one field (`name`) from each dictionary in a list.

### Example 9 explanation

This teaches value formatting. `map()` is useful not only for mathematical changes, but also for presentation formatting.

### Example 10 explanation

This is practical for cleaning messy string data. `str.strip` removes spaces from the beginning and end of each string.

### Example 11 explanation

This shows that using a named function can improve readability when the transformation logic deserves a descriptive name.

### Example 12 explanation

This teaches combining matching elements from two iterables into one new result.

### Example 13 explanation

This helps you compare styles. `map()` can replace some loops, but not every loop is better when rewritten with `map()`.

### Example 14 explanation

This shows that `map()` can include conditional expressions to classify or label data.

---

## 6. Common mistakes

### 1. Forgetting to convert the `map` object into a list

```python
numbers = [1, 2, 3]
result = map(lambda x: x * 2, numbers)
print(result)
```

This prints something like:

```python
<map object at ...>
```

To see the transformed values:

```python
print(list(result))
```

### 2. Using a function with the wrong number of arguments

If you use multiple iterables, your function must accept the same number of inputs.

Wrong:

```python
list(map(lambda x: x * 2, [1, 2], [3, 4]))
```

This fails because the lambda takes one argument, but `map()` provides two.

### 3. Making the lambda too complicated

A long lambda expression becomes hard to read.  
In that case, a normal function is better.

### 4. Reusing an exhausted `map` object

A `map` object is an iterator. Once consumed, it cannot be reused in the same way.

```python
nums = map(lambda x: x * 2, [1, 2, 3])
print(list(nums))
print(list(nums))   # This will now be empty
```

### 5. Assuming `map()` always improves readability

Sometimes a list comprehension is clearer.

Example:

```python
[x * x for x in numbers]
```

may be easier to read than:

```python
list(map(lambda x: x * x, numbers))
```

### Debugging tips

- Convert the `map` result into a list to inspect it.
- Test the function separately before using it with `map()`.
- Check argument count carefully when using multiple iterables.
- Print the source data before transformation.
- If the transformation feels confusing, rewrite it as a loop first.

---

## 7. Mentor tips / best practices

- Use `map()` when the goal is a clear transformation of every item.
- Use a normal function when the transformation has meaningful logic or needs a descriptive name.
- Use lambda only when the expression stays short and readable.
- Remember that readability matters more than cleverness.
- For simple transformations, compare `map()` with list comprehensions and choose the clearer option.
- `map()` becomes especially useful in data cleaning and preprocessing tasks.

### Best-practice comparison

```python
numbers = [1, 2, 3, 4]

map_result = list(map(lambda x: x * x, numbers))
comp_result = [x * x for x in numbers]

print(map_result)
print(comp_result)
```

Both are correct.

### Which should you choose?

A common rule:

- choose `map()` when you are clearly applying an existing function
- choose a list comprehension when it reads more naturally

Example:

```python
list(map(str.upper, names))
```

is very readable.

But this:

```python
[x.upper() for x in names]
```

is also very readable.

So good Python style means choosing the one that makes the code easiest to understand.

### Mentor insight

Do not learn `map()` only as a shortcut.  
Learn it as a way of thinking about transformation.

When you say:

> “apply this function to all items”

you are thinking at a higher level than a manual loop.  
That shift is important in advanced Python.

---

## 8. Practice tasks

1. Use `map()` with a predefined function to cube numbers in a list.
2. Use `map()` with lambda to add 5 to each number.
3. Convert a list of string numbers into integers.
4. Convert a list of lowercase words into uppercase.
5. Use `map()` with two lists to subtract one list from another.
6. Extract `"name"` values from a list of dictionaries.
7. Use `map()` to find the length of each sentence in a list.
8. Format a list of marks like `"Score: 85"`, `"Score: 90"`.
9. Compare one `map()` solution with a loop solution.
10. Rewrite one `map()` example using list comprehension.

### Sample solutions

```python
def cube(x):
    return x ** 3

nums = [1, 2, 3, 4]
print(list(map(cube, nums)))
```

```python
nums = [10, 20, 30]
print(list(map(lambda x: x + 5, nums)))
```

```python
values = ["10", "25", "40"]
print(list(map(int, values)))
```

```python
words = ["python", "study", "guide"]
print(list(map(str.upper, words)))
```

```python
a = [20, 30, 40]
b = [1, 2, 3]
print(list(map(lambda x, y: x - y, a, b)))
```

```python
people = [
    {"name": "Aman", "age": 22},
    {"name": "Neha", "age": 21}
]

print(list(map(lambda person: person["name"], people)))
```

---

## 9. Revision notes

- `map()` applies a function to every item in an iterable.
- Basic syntax: `map(function, iterable)`
- It can also work with multiple iterables.
- In Python 3, `map()` returns a map object, not a list.
- Use `list()` to view the results.
- `map()` works with normal functions, lambda functions, and built-in functions.
- It is useful for transforming numbers, strings, and structured data.
- `map()` can make code cleaner when the goal is simple transformation.
- Do not force `map()` into situations where a loop or list comprehension is clearer.
- Strong Python coding means choosing the most readable form.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
def square(n):
    return n * n

numbers = [1, 2, 3, 4, 5]
squared_numbers = list(map(square, numbers))
print(squared_numbers)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
numbers = [1, 2, 3, 4, 5]
squared_numbers = list(map(lambda x: x * x, numbers))
print(squared_numbers)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
string_numbers = ["1", "2", "3", "4", "5"]
int_numbers = list(map(int, string_numbers))
print(int_numbers)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
names = ["alice", "bob", "charlie"]
upper_names = list(map(str.upper, names))
print(upper_names)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
list1 = [1, 2, 3]
list2 = [10, 20, 30]

added = list(map(lambda a, b: a + b, list1, list2))
print(added)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
students = [
    {"name": "Asha", "marks": 85},
    {"name": "Ravi", "marks": 90},
    {"name": "Sara", "marks": 78}
]

student_names = list(map(lambda student: student["name"], students))
print(student_names)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
numbers = [1, 2, 3, 4, 5, 6]
labels = list(map(lambda x: "Even" if x % 2 == 0 else "Odd", numbers))
print(labels)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
nums = [1, 2, 3, 4]
loop_result = []
for num in nums:
    loop_result.append(num ** 2)

map_result = list(map(lambda x: x ** 2, nums))
comp_result = [x ** 2 for x in nums]

print("Loop:", loop_result)
print("Map:", map_result)
print("Comprehension:", comp_result)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
def cube(x):
    return x ** 3

nums = [1, 2, 3, 4]
print(list(map(cube, nums)))
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
people = [
    {"name": "Aman", "age": 22},
    {"name": "Neha", "age": 21}
]

print(list(map(lambda person: person["name"], people)))
```

</div>
