---
title: "Chapter 32 Numpy Intermediate"
description: "Generated from mlops/PYTHON/Basics/chapter_32_numpy_intermediate.ipynb"
slug: "/python-basics/chapter-32-numpy-intermediate"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_32_numpy_intermediate.ipynb</code></div>

# Chapter 32 — NumPy (Intermediate / Beginner-Friendly Deep Dive)

## What you will learn
- Why NumPy is faster than lists
- Array creation techniques
- Shape, reshape, and dimensions
- Vectorized operations (IMPORTANT)
- Broadcasting (core concept)
- Indexing & slicing (advanced)
- Boolean masking
- Aggregations (mean, std, axis)
- Real-world style examples

---

## Key Idea
NumPy = Fast + Memory Efficient + Vectorized

## 1. Create Arrays

Different ways to create arrays

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
import numpy as np

a = np.array([1,2,3])
b = np.arange(0,10,2)
c = np.linspace(0,1,5)

print(a)
print(b)
print(c)
```

</div>

## 2. Shape and Dimensions

Understanding structure

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
arr = np.array([[1,2,3],[4,5,6]])
print("Shape:", arr.shape)
print("Dimensions:", arr.ndim)
```

</div>

## 3. Reshape

Convert array shapes

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
arr = np.arange(1,9)
print(arr.reshape(2,4))
```

</div>

## 4. Vectorization (IMPORTANT)

No loops needed!

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
a = np.array([1,2,3])
print(a * 10)
print(a + 5)
```

</div>

## 5. Broadcasting

Different shape operations

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
a = np.array([1,2,3])
b = np.array([[10],[20]])

print(a + b)
```

</div>

## 6. Indexing Advanced

Access specific elements

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
arr = np.array([[1,2,3],[4,5,6]])

print(arr[0,1])
print(arr[:,1])
```

</div>

## 7. Boolean Masking

Filter data like SQL

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
arr = np.array([1,2,3,4,5])
print(arr[arr > 3])
```

</div>

## 8. Fancy Indexing

Select multiple indices

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
arr = np.array([10,20,30,40])
print(arr[[0,2]])
```

</div>

## 9. Aggregation Functions

Statistics

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
arr = np.array([[1,2,3],[4,5,6]])

print(np.mean(arr))
print(np.mean(arr, axis=0))
print(np.sum(arr, axis=1))
```

</div>

## 10. Matrix Operations

Linear algebra basics

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
a = np.array([[1,2],[3,4]])
b = np.array([[5,6],[7,8]])

print(np.dot(a,b))
```

</div>

## 11. Real-world Example

Marks analysis

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
marks = np.array([50,60,70,80,90])

print("Average:", np.mean(marks))
print("Top scorers:", marks[marks>75])
```

</div>

## Key Takeaways

- NumPy is FAST because of vectorization
- Broadcasting is very important concept
- Avoid loops when using NumPy
- Use boolean masking for filtering
- Axis = direction of operation

## Practice (Important)

1. Create 3x3 matrix
2. Find row-wise sum
3. Multiply matrix by 5
4. Filter values > 10
5. Try broadcasting with different shapes
