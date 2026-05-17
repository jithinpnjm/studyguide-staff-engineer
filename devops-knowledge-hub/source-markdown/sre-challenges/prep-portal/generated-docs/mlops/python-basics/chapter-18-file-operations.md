---
title: "Chapter 18 File Operations"
description: "Generated from mlops/PYTHON/Basics/chapter_18_file_operations.ipynb"
slug: "/python-basics/chapter-18-file-operations"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_18_file_operations.ipynb</code></div>

# Chapter 18 - File Operations in Python (Text and Binary Files)

This notebook follows your study-guide structure and includes runnable examples.

## 1. Chapter title

**File Operations in Python (Text and Binary Files)**

## 2. Concept explanation

This chapter explains reading, writing, appending, binary file handling, `w+` mode, and `seek()`.

## Example 1: Read an entire text file

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
with open("sample.txt", "w") as file:
    file.write("Line one\nLine two\n")

with open("sample.txt", "r") as file:
    content = file.read()
    print(content)
```

</div>

## Example 2: Read a file line by line

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
with open("sample.txt", "r") as file:
    for line in file:
        print(line.strip())
```

</div>

## Example 3: Write to a file using w mode

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
with open("notes.txt", "w") as file:
    file.write("Python file handling is useful.\n")
    file.write("This file was created in write mode.\n")

with open("notes.txt", "r") as file:
    print(file.read())
```

</div>

## Example 4: Append content using a mode

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
with open("notes.txt", "a") as file:
    file.write("This line was appended later.\n")

with open("notes.txt", "r") as file:
    print(file.read())
```

</div>

## Example 5: Write multiple lines using writelines()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
lines = ["Line 1\n", "Line 2\n", "Line 3\n"]
with open("multi.txt", "w") as file:
    file.writelines(lines)

with open("multi.txt", "r") as file:
    print(file.read())
```

</div>

## Example 6: Count lines, words, and characters

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
with open("multi.txt", "r") as file:
    lines = file.readlines()

line_count = len(lines)
word_count = sum(len(line.split()) for line in lines)
char_count = sum(len(line) for line in lines)

print("Lines:", line_count)
print("Words:", word_count)
print("Characters:", char_count)
```

</div>

## Example 7: Copy content between files

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
with open("notes.txt", "r") as source:
    content = source.read()

with open("copy_notes.txt", "w") as target:
    target.write(content)

with open("copy_notes.txt", "r") as target:
    print(target.read())
```

</div>

## Example 8: Use w+ mode and seek()

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
with open("combined.txt", "w+") as file:
    file.write("Hello from w+ mode")
    file.seek(0)
    print(file.read())
```

</div>

## Example 9: Binary write and read

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
data = b"Python binary data"
with open("binary_file.bin", "wb") as file:
    file.write(data)

with open("binary_file.bin", "rb") as file:
    print(file.read())
```

</div>

## Common mistakes

- Using `w` when you meant `a`
- Forgetting `seek(0)` in `w+` mode
- Mixing strings and bytes
- Forgetting newlines in `write()` and `writelines()`

## Mentor tips

- Prefer `with open()`
- Test file content after each operation while learning
- Be extra careful with overwrite mode

## Practice tasks

1. Create and write a text file.
2. Append to the file.
3. Count lines, words, and characters.
4. Copy one file into another.
5. Write and read bytes in binary mode.
