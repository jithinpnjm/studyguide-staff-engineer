---
title: "Chapter 19 File Paths Os Module"
description: "Generated from mlops/PYTHON/Basics/chapter_19_file_paths_os_module.ipynb"
slug: "/python-basics/chapter-19-file-paths-os-module"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_19_file_paths_os_module.ipynb</code></div>

# Chapter 19 — Working with File Paths Using the `os` Module

This notebook follows your study guide format and includes explanations, runnable examples, common mistakes, mentor tips, practice tasks, and revision notes.


## 1. Chapter title

**Working with File Paths Using the `os` Module**

## 2. Concept explanation

This chapter teaches how Python uses the `os` module to work with:
- directories
- files and folders
- relative and absolute paths
- existence checks
- file and directory type checks
- safe path building with `os.path.join()`

## Example 1: Import the os module

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
import os
print("OS module imported successfully")
```

</div>

## Example 2: Create a directory

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
import os

folder_name = "package"

if not os.path.exists(folder_name):
    os.mkdir(folder_name)
    print("Folder created")
else:
    print("Folder already exists")
```

</div>

## Example 3: List files and directories

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
import os
items = os.listdir(".")
print(items)
```

</div>

## Example 4: Join paths safely

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
import os

folder = "data"
filename = "report.txt"
full_path = os.path.join(folder, filename)
print(full_path)
```

</div>

## Example 5: Get an absolute path

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
import os

relative_path = "data/report.txt"
absolute_path = os.path.abspath(relative_path)
print("Relative path:", relative_path)
print("Absolute path:", absolute_path)
```

</div>

## Example 6: Check whether a path exists

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
import os

path = "data/report.txt"
if os.path.exists(path):
    print("Path exists")
else:
    print("Path does not exist")
```

</div>

## Example 7: Check whether a path is a file

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
import os

path = "sample.txt"
print(os.path.isfile(path))
```

</div>

## Example 8: Check whether a path is a directory

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
import os

path = "package"
print(os.path.isdir(path))
```

</div>

## Example 9: Create a file if it does not exist

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
import os

filename = "notes.txt"
if not os.path.exists(filename):
    with open(filename, "w") as file:
        file.write("This file was created because it did not exist.\n")
    print("File created")
else:
    print("File already exists")
```

</div>

## Example 10: Combine path checking with file creation

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
import os

folder = "project_data"
file_name = "info.txt"
if not os.path.exists(folder):
    os.mkdir(folder)

full_path = os.path.join(folder, file_name)
if not os.path.exists(full_path):
    with open(full_path, "w") as file:
        file.write("Project information file\n")

print(full_path)
```

</div>

## Example 11: Print the current working directory

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
import os
print(os.getcwd())
```

</div>

## Example 12: Compare relative and absolute paths

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
import os

path = "example.txt"
print("Relative:", path)
print("Absolute:", os.path.abspath(path))
```

</div>

## Example 13: Explore a folder step by step

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
import os

folder = "."
for item in os.listdir(folder):
    item_path = os.path.join(folder, item)
    if os.path.isdir(item_path):
        print(item, "-> Directory")
    elif os.path.isfile(item_path):
        print(item, "-> File")
```

</div>

## Example 14: Safer path building for nested folders

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
import os

path = os.path.join("project", "data", "raw", "file.csv")
print(path)
```

</div>


## 5. What these examples teach

- how to create directories safely
- how to inspect the current folder
- how to build paths in an operating-system-safe way
- how to compare relative and absolute paths
- how to check path existence
- how to identify files and directories
- how to create files only when needed

## 6. Common mistakes

- building paths manually with slashes
- assuming the current working directory
- creating folders that already exist
- confusing relative and absolute paths
- checking existence without checking path type

## 7. Mentor tips / best practices

- always prefer `os.path.join()`
- print `os.getcwd()` while debugging
- use `os.path.abspath()` when paths feel confusing
- keep file and folder checks explicit
- use clear variable names like `file_path` and `folder_path`

## 8. Practice tasks

1. Create a directory named `data_files`.
2. Print all items in the current folder.
3. Join `"reports"` and `"final.txt"` into one path.
4. Print the absolute path of `"notes.txt"`.
5. Check whether `"notes.txt"` exists.
6. Create a file only if it does not already exist.
7. Check whether `"data_files"` is a directory.
8. Check whether `"example.txt"` is a file.

## 9. Revision notes

- `os.mkdir()` creates directories
- `os.listdir()` lists folder contents
- `os.path.join()` builds safe paths
- `os.path.abspath()` gives full paths
- `os.path.exists()` checks presence
- `os.path.isfile()` checks files
- `os.path.isdir()` checks directories
