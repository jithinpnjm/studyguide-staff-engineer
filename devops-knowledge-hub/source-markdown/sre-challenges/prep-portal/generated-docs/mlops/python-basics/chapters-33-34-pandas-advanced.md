---
title: "Chapters 33 34 Pandas Advanced"
description: "Generated from mlops/PYTHON/Basics/chapters_33_34_pandas_advanced.ipynb"
slug: "/python-basics/chapters-33-34-pandas-advanced"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapters_33_34_pandas_advanced.ipynb</code></div>

# Chapters 33–34 — Pandas (Advanced Notebook)

This notebook combines:
- **Chapter 33:** Pandas introduction, Series, DataFrames, reading data
- **Chapter 34:** Data manipulation, missing values, grouping, merging, and EDA-style workflows

## Goals
You will practice:
- Series and DataFrames
- inspection and structure checks
- selection and indexing
- adding, updating, and dropping columns
- missing value handling
- grouping and aggregation
- merging and joining
- small real-world EDA workflows

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 2</div>

```python
import pandas as pd
import numpy as np

print("pandas version:", pd.__version__)
print("numpy version:", np.__version__)
```

<div className="notebook-output__label">Output</div>

```text
pandas version: 3.0.1
numpy version: 2.4.2
```

</div>

## 1. Series basics

**What this teaches:** A Series is a one-dimensional labeled data structure.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
s1 = pd.Series([10, 20, 30, 40])
print(s1)

print("-" * 40)

s2 = pd.Series({"math": 90, "science": 85, "english": 88})
print(s2)
```

<div className="notebook-output__label">Output</div>

```text
0    10
1    20
2    30
3    40
dtype: int64
----------------------------------------
math       90
science    85
english    88
dtype: int64
```

</div>

## 2. Series index and values

**What this teaches:** A Series stores both labels and values.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
s = pd.Series({"a": 100, "b": 200, "c": 300})
print("Index:", s.index)
print("Values:", s.values)
print("Access label b:", s["b"])
```

<div className="notebook-output__label">Output</div>

```text
Index: Index(['a', 'b', 'c'], dtype='str')
Values: [100 200 300]
Access label b: 200
```

</div>

## 3. DataFrame basics

**What this teaches:** A DataFrame is a 2D table-like structure.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
data = {
    "Name": ["Asha", "Ravi", "Meera", "John"],
    "Age": [22, 25, 21, 30],
    "Marks": [85, 90, 88, 76]
}

df = pd.DataFrame(data)
print(df)
```

<div className="notebook-output__label">Output</div>

```text
Name  Age  Marks
0   Asha   22     85
1   Ravi   25     90
2  Meera   21     88
3   John   30     76
```

</div>

## 4. Shape, columns, and index

**What this teaches:** Always inspect dataset structure first.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
print("Shape:", df.shape)
print("Columns:", df.columns.tolist())
print("Index:", df.index)
```

</div>

## 5. head() and tail()

**What this teaches:** These are core inspection tools in EDA.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
sales_df = pd.DataFrame({
    "Product": ["Laptop", "Phone", "Tablet", "Phone", "Laptop", "Tablet", "Phone"],
    "Region": ["North", "South", "East", "West", "North", "South", "East"],
    "Sales": [50000, 30000, 20000, 35000, 52000, 21000, 31000]
})

print("HEAD")
print(sales_df.head())

print("\nTAIL")
print(sales_df.tail())
```

</div>

## 6. describe()

**What this teaches:** `describe()` quickly summarizes numeric columns.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
print(sales_df.describe())
```

</div>

## 7. dtypes and datetime conversion

**What this teaches:** Type checking and conversion are foundational.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
employee_df = pd.DataFrame({
    "Name": ["Asha", "Ravi", "John"],
    "JoinDate": ["2024-01-10", "2023-08-15", "2022-11-20"],
    "Salary": [50000, 60000, 55000]
})

print("Before conversion:")
print(employee_df.dtypes)

employee_df["JoinDate"] = pd.to_datetime(employee_df["JoinDate"])

print("\nAfter conversion:")
print(employee_df.dtypes)
print(employee_df)
```

<div className="notebook-output__label">Output</div>

```text
Before conversion:
Name          str
JoinDate      str
Salary      int64
dtype: object

After conversion:
Name                   str
JoinDate    datetime64[us]
Salary               int64
dtype: object
   Name   JoinDate  Salary
0  Asha 2024-01-10   50000
1  Ravi 2023-08-15   60000
2  John 2022-11-20   55000
```

</div>

## 8. Column selection

**What this teaches:** One column returns a Series, multiple columns return a DataFrame.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
print(df["Name"])
print("\n")
print(df[["Name", "Marks"]])
```

</div>

## 9. iloc and at

**What this teaches:** `iloc` is position-based; `at` is for fast single-value label access.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
print("iloc row 0:")
print(df.iloc[0])

print("\nSlice with iloc:")
print(df.iloc[0:3, 0:2])

print("\nValue with at:")
print(df.at[1, "Marks"])
```

</div>

## 10. Add and update columns

**What this teaches:** Feature creation and updates are common in data prep.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
df2 = df.copy()
df2["Pass"] = df2["Marks"] >= 80
df2["Bonus"] = 5
df2["FinalMarks"] = df2["Marks"] + df2["Bonus"]
df2.at[0, "Marks"] = 95
print(df2)
```

<div className="notebook-output__label">Output</div>

```text
Name  Age  Marks   Pass  Bonus  FinalMarks
0   Asha   22     95   True      5          90
1   Ravi   25     90   True      5          95
2  Meera   21     88   True      5          93
3   John   30     76  False      5          81
```

</div>

## 11. Drop columns

**What this teaches:** `axis=1` means column operation.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
temp_df = df2.copy()
print("Before drop:")
print(temp_df)

temp_df = temp_df.drop("Bonus", axis=1)
print("\nAfter drop:")
print(temp_df)
```

</div>

## 12. Missing values: identify

**What this teaches:** Null checking is one of the first cleaning steps.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
missing_df = pd.DataFrame({
    "Name": ["Asha", "Ravi", None, "John"],
    "Age": [22, np.nan, 21, 30],
    "Marks": [85, 90, np.nan, 76]
})

print(missing_df)
print("\nNull mask:")
print(missing_df.isnull())
print("\nNull count:")
print(missing_df.isnull().sum())
```

<div className="notebook-output__label">Output</div>

```text
Name   Age  Marks
0  Asha  22.0   85.0
1  Ravi   NaN   90.0
2   NaN  21.0    NaN
3  John  30.0   76.0

Null mask:
    Name    Age  Marks
0  False  False  False
1  False   True  False
2   True  False   True
3  False  False  False

Null count:
Name     1
Age      1
Marks    1
dtype: int64
```

</div>

## 13. Fill missing values

**What this teaches:** `fillna()` can use constants or statistics like mean.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
filled_df = missing_df.copy()
filled_df["Name"] = filled_df["Name"].fillna("Unknown")
filled_df["Age"] = filled_df["Age"].fillna(filled_df["Age"].mean())
filled_df["Marks"] = filled_df["Marks"].fillna(filled_df["Marks"].mean())

print(filled_df)
```

<div className="notebook-output__label">Output</div>

```text
Name        Age      Marks
0     Asha  22.000000  85.000000
1     Ravi  24.333333  90.000000
2  Unknown  21.000000  83.666667
3     John  30.000000  76.000000
```

</div>

## 14. Drop missing rows

**What this teaches:** Sometimes dropping incomplete rows is the better choice.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
print(missing_df.dropna())
```

<div className="notebook-output__label">Output</div>

```text
Name   Age  Marks
0  Asha  22.0   85.0
3  John  30.0   76.0
```

</div>

## 15. Filtering and sorting

**What this teaches:** Boolean filtering and sorting are everyday pandas tasks.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
print(df[df["Marks"] > 80])

print("\nCombined filter:")
print(df[(df["Marks"] > 80) & (df["Age"] >= 22)])

print("\nSorted by marks descending:")
print(df.sort_values(by="Marks", ascending=False))
```

<div className="notebook-output__label">Output</div>

```text
Name  Age  Marks
0   Asha   22     85
1   Ravi   25     90
2  Meera   21     88

Combined filter:
   Name  Age  Marks
0  Asha   22     85
1  Ravi   25     90

Sorted by marks descending:
    Name  Age  Marks
1   Ravi   25     90
2  Meera   21     88
0   Asha   22     85
3   John   30     76
```

</div>

## 16. Groupby basics

**What this teaches:** Groupby is central for aggregation and business summaries.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
sales = pd.DataFrame({
    "Product": ["Laptop", "Phone", "Laptop", "Tablet", "Phone", "Tablet", "Laptop", "Phone"],
    "Region": ["North", "North", "South", "South", "East", "East", "West", "West"],
    "Sales": [50000, 20000, 55000, 18000, 25000, 22000, 60000, 27000],
    "Units": [5, 10, 6, 8, 12, 9, 7, 11]
})

print(sales)
```

<div className="notebook-output__label">Output</div>

```text
Product Region  Sales  Units
0  Laptop  North  50000      5
1   Phone  North  20000     10
2  Laptop  South  55000      6
3  Tablet  South  18000      8
4   Phone   East  25000     12
5  Tablet   East  22000      9
6  Laptop   West  60000      7
7   Phone   West  27000     11
```

</div>

## 17. Groupby mean and sum

**What this teaches:** Category-level summaries are a major use case for pandas.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
print("Mean sales by product:")
print(sales.groupby("Product")["Units"].sum())

print("\nTotal sales by region:")
print(sales.groupby("Region")["Sales"].sum())
print(sales.groupby("Region")[["Units","Sales"]].sum())
```

<div className="notebook-output__label">Output</div>

```text
Mean sales by product:
Product
Laptop    18
Phone     33
Tablet    17
Name: Units, dtype: int64

Total sales by region:
Region
East     47000
North    70000
South    73000
West     87000
Name: Sales, dtype: int64
        Units  Sales
Region              
East       21  47000
North      15  70000
South      14  73000
West       18  87000
```

</div>

## 18. Multiple aggregations

**What this teaches:** You can calculate several statistics in one grouped summary.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 38</div>

```python
summary = sales.groupby("Product").agg({
    "Sales": ["mean", "sum", "max"],
    "Units": ["mean", "sum"]
})

print(summary)
```

</div>

## 19. Multi-column grouping and pivot table

**What this teaches:** More advanced summaries reveal deeper patterns.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 40</div>

```python
print("Grouped by Product and Region:")
print(sales.groupby(["Product", "Region"])["Sales"].sum())

print("\nPivot table:")
print(sales.pivot_table(values="Sales", index="Product", columns="Region", aggfunc="sum"))
```

</div>

## 20. Read CSV and inspect

**What this teaches:** `read_csv()` is one of the most important pandas functions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 42</div>

```python
csv_path = "/mnt/data/sample_students_pandas.csv"

sample_csv = pd.DataFrame({
    "Name": ["Asha", "Ravi", "Meera"],
    "Age": [22, 25, 21],
    "Marks": [85, 90, 88]
})
sample_csv.to_csv(csv_path, index=False)

read_df = pd.read_csv(csv_path)
print(read_df)
print("\nDescribe:")
print(read_df.describe())
```

</div>

## 21. Merge and join

**What this teaches:** Merging combines related datasets just like database joins.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 44</div>

```python
students = pd.DataFrame({
    "StudentID": [1, 2, 3, 4],
    "Name": ["Asha", "Ravi", "Meera", "John"]
})

marks = pd.DataFrame({
    "StudentID": [1, 2, 3, 5],
    "Marks": [85, 90, 88, 76]
})

print("Inner join:")
print(pd.merge(students, marks, on="StudentID", how="inner"))

print("\nLeft join:")
print(pd.merge(students, marks, on="StudentID", how="left"))

print("\nOuter join:")
print(pd.merge(students, marks, on="StudentID", how="outer"))
```

</div>

## 22. Merge with different key names

**What this teaches:** Sometimes the key columns do not have the same name.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 46</div>

```python
left_df = pd.DataFrame({
    "ID": [1, 2, 3],
    "City": ["Delhi", "Mumbai", "Chennai"]
})

right_df = pd.DataFrame({
    "StudentID": [1, 2, 4],
    "Score": [80, 90, 70]
})

merged = pd.merge(left_df, right_df, left_on="ID", right_on="StudentID", how="left")
print(merged)
```

</div>

## 23. join() using index

**What this teaches:** `join()` is convenient when indexes align.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 48</div>

```python
df_left = pd.DataFrame({"A": [1, 2, 3]}, index=["x", "y", "z"])
df_right = pd.DataFrame({"B": [10, 20, 30]}, index=["x", "y", "z"])

print(df_left.join(df_right))
```

</div>

## 24. Small EDA workflow

**What this teaches:** Real work usually combines inspection, cleaning, and grouping.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 50</div>

```python
eda_df = pd.DataFrame({
    "Name": ["Asha", "Ravi", "Meera", "John", "Sara"],
    "Department": ["IT", "HR", "IT", "Finance", "HR"],
    "Salary": [50000, 45000, 60000, np.nan, 48000],
    "Experience": [2, 4, 5, 3, np.nan]
})

print("Raw data:")
print(eda_df)

print("\nMissing values:")
print(eda_df.isnull().sum())

eda_df["Salary"] = eda_df["Salary"].fillna(eda_df["Salary"].mean())
eda_df["Experience"] = eda_df["Experience"].fillna(eda_df["Experience"].mean())

print("\nAfter fill:")
print(eda_df)

print("\nAverage salary by department:")
print(eda_df.groupby("Department")["Salary"].mean())
```

</div>

## 25. Feature engineering and apply

**What this teaches:** Pandas is often used to create new useful columns.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 52</div>

```python
eda_df["SalaryPerYearOfExperience"] = eda_df["Salary"] / eda_df["Experience"]
eda_df["SalaryBand"] = eda_df["Salary"].apply(lambda x: "High" if x >= 50000 else "Medium")

print(eda_df)
```

</div>

## 26. Value counts, unique values, duplicates, rename

**What this teaches:** These are common data-cleaning helpers.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 54</div>

```python
print("Department counts:")
print(eda_df["Department"].value_counts())

print("\nUnique departments:")
print(eda_df["Department"].unique())

dup_df = pd.DataFrame({
    "Name": ["Asha", "Asha", "Ravi"],
    "Marks": [90, 90, 85]
})

print("\nDuplicates:")
print(dup_df.duplicated())

print("\nDrop duplicates:")
print(dup_df.drop_duplicates())

print("\nRenamed df:")
print(df.rename(columns={"Marks": "Score"}))
```

</div>

## 27. Final integrated example

**What this teaches:** This is a small end-to-end workflow combining merge, fillna, groupby, and describe.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 56</div>

```python
orders = pd.DataFrame({
    "OrderID": [101, 102, 103, 104],
    "CustomerID": [1, 2, 1, 3],
    "Amount": [2500, 1800, np.nan, 3200]
})

customers = pd.DataFrame({
    "CustomerID": [1, 2, 3],
    "CustomerName": ["Asha", "Ravi", "Meera"],
    "City": ["Delhi", "Mumbai", "Chennai"]
})

orders["Amount"] = orders["Amount"].fillna(orders["Amount"].mean())

merged = pd.merge(orders, customers, on="CustomerID", how="left")

print("Merged:")
print(merged)

print("\nTotal amount by customer:")
print(merged.groupby("CustomerName")["Amount"].sum())

print("\nDescribe amount:")
print(merged["Amount"].describe())
```

</div>

## Final takeaways

- **Series** = 1D labeled data
- **DataFrame** = 2D table
- `head()`, `tail()`, `describe()`, `dtypes` are essential inspection tools
- `isnull()`, `fillna()`, `dropna()` handle missing data
- `groupby()` powers aggregation
- `merge()` and `join()` combine tables
- pandas is central to EDA and feature engineering

## Practice tasks

1. Create a DataFrame from a dictionary
2. Use `head()`, `tail()`, and `describe()`
3. Add and drop a column
4. Create missing values and fill them
5. Group data by category
6. Merge two DataFrames
7. Build a mini EDA example
