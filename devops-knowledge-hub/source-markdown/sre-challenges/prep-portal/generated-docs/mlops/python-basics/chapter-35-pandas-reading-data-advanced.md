---
title: "Chapter 35 Pandas Reading Data Advanced"
description: "Generated from mlops/PYTHON/Basics/chapter_35_pandas_reading_data_advanced.ipynb"
slug: "/python-basics/chapter-35-pandas-reading-data-advanced"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_35_pandas_reading_data_advanced.ipynb</code></div>

# Chapter 35 — Reading Data with Pandas (Advanced Notebook)

This notebook focuses on reading data from multiple sources and converting it into pandas DataFrames.

## Topics covered
- JSON
- CSV
- HTML tables
- Excel
- Pickle
- export/import workflows
- quick analysis after loading data

## Why this matters
Real-world data rarely comes in only one format.
Pandas is powerful because it can read, clean, and export many file types.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 2</div>

```python
import pandas as pd
import numpy as np

print("pandas version:", pd.__version__)
```

</div>

## 1. Build a sample DataFrame

**What this teaches:** We create our own data first, so we can save and reload it in different formats.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 4</div>

```python
df = pd.DataFrame({
    "Name": ["Asha", "Ravi", "Meera"],
    "Age": [22, 25, 21],
    "Marks": [85, 90, 88]
})

print(df)
```

</div>

## 2. Convert DataFrame to JSON

**What this teaches:** `to_json()` converts a DataFrame into JSON text.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 6</div>

```python
print(df.to_json())
```

</div>

## 3. JSON orient parameter

**What this teaches:** The `orient` parameter changes JSON layout.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
print("records:")
print(df.to_json(orient="records"))

print("\ncolumns:")
print(df.to_json(orient="columns"))
```

</div>

## 4. Read JSON from a string

**What this teaches:** `pd.read_json()` can turn JSON into a DataFrame.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 10</div>

```python
json_data = df.to_json(orient="records")
json_df = pd.read_json(json_data)
print(json_df)
```

</div>

## 5. Save JSON file and read it back

**What this teaches:** JSON is common in APIs and structured data exchange.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 12</div>

```python
json_path = "/mnt/data/sample_data_ch35.json"
df.to_json(json_path, orient="records")

loaded_json = pd.read_json(json_path)
print(loaded_json)
```

</div>

## 6. Save DataFrame to CSV

**What this teaches:** CSV is one of the most common data formats in analysis work.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
csv_path = "/mnt/data/sample_data_ch35.csv"
df.to_csv(csv_path, index=False)
print(csv_path)
```

</div>

## 7. Read CSV with pd.read_csv()

**What this teaches:** `read_csv()` is one of pandas' most important functions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
csv_df = pd.read_csv("/mnt/data/sample_data_ch35.csv")
print(csv_df)
```

</div>

## 8. CSV without headers

**What this teaches:** You can control header handling while reading CSV files.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
manual_csv_path = "/mnt/data/manual_header_ch35.csv"

with open(manual_csv_path, "w", encoding="utf-8") as f:
    f.write("Asha,22,85\n")
    f.write("Ravi,25,90\n")
    f.write("Meera,21,88\n")

df_no_header = pd.read_csv(manual_csv_path, header=None)
print(df_no_header)

print("\nWith custom names:")
df_named = pd.read_csv(manual_csv_path, header=None, names=["Name", "Age", "Marks"])
print(df_named)
```

</div>

## 9. Save DataFrame to Excel

**What this teaches:** Pandas can write spreadsheet-friendly Excel files.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 20</div>

```python
excel_path = "/mnt/data/sample_data_ch35.xlsx"
df.to_excel(excel_path, index=False)
print(excel_path)
```

</div>

## 10. Read Excel with pd.read_excel()

**What this teaches:** Excel reading is common in business workflows.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 22</div>

```python
excel_df = pd.read_excel("/mnt/data/sample_data_ch35.xlsx")
print(excel_df)
```

</div>

## 11. Multiple Excel sheets

**What this teaches:** Real Excel files often contain more than one sheet.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
multi_excel = "/mnt/data/multi_sheet_ch35.xlsx"

with pd.ExcelWriter(multi_excel) as writer:
    df.to_excel(writer, sheet_name="Students", index=False)
    pd.DataFrame({
        "Product": ["Laptop", "Phone", "Tablet"],
        "Sales": [50000, 30000, 20000]
    }).to_excel(writer, sheet_name="Sales", index=False)

students_sheet = pd.read_excel(multi_excel, sheet_name="Students")
sales_sheet = pd.read_excel(multi_excel, sheet_name="Sales")

print("Students:")
print(students_sheet)

print("\nSales:")
print(sales_sheet)
```

</div>

## 12. Read HTML tables from a local HTML file

**What this teaches:** `pd.read_html()` can extract tables from HTML documents.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 26</div>

```python
html_path = "/mnt/data/sample_table_ch35.html"

html_content = '''
<html>
<body>
<table>
<tr><th>Name</th><th>Department</th><th>Salary</th></tr>
<tr><td>Asha</td><td>IT</td><td>50000</td></tr>
<tr><td>Ravi</td><td>HR</td><td>45000</td></tr>
<tr><td>Meera</td><td>Finance</td><td>55000</td></tr>
</table>
</body>
</html>
'''

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

tables = pd.read_html(html_path)
print("Tables found:", len(tables))
print(tables[0])
```

</div>

## 13. HTML parsing note

**What this teaches:** `read_html()` may need parser libraries like `lxml` or `BeautifulSoup`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 28</div>

```python
print("If read_html worked, parser support is available in this environment.")
```

</div>

## 14. Pickle basics

**What this teaches:** Pickle stores serialized Python objects and is useful for fast reloads.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 30</div>

```python
pickle_path = "/mnt/data/sample_pickle_ch35.pkl"
df.to_pickle(pickle_path)
print(pickle_path)
```

</div>

## 15. Read pickle with pandas

**What this teaches:** `read_pickle()` loads serialized pandas objects back into memory.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 32</div>

```python
pickle_df = pd.read_pickle("/mnt/data/sample_pickle_ch35.pkl")
print(pickle_df)
```

</div>

## 16. Compare file formats

**What this teaches:** Each format has typical strengths.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
comparison = pd.DataFrame({
    "Format": ["CSV", "JSON", "Excel", "HTML Table", "Pickle"],
    "Best Use": [
        "Flat tabular data",
        "Structured exchange / APIs",
        "Spreadsheet workflows",
        "Web table extraction",
        "Fast Python object storage"
    ]
})

print(comparison)
```

</div>

## 17. Export and reload workflow

**What this teaches:** A common pandas workflow is export -> store -> reload -> analyze.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 36</div>

```python
reload_csv = pd.read_csv("/mnt/data/sample_data_ch35.csv")
reload_json = pd.read_json("/mnt/data/sample_data_ch35.json")
reload_excel = pd.read_excel("/mnt/data/sample_data_ch35.xlsx")
reload_pickle = pd.read_pickle("/mnt/data/sample_pickle_ch35.pkl")

print("CSV:")
print(reload_csv)

print("\nJSON:")
print(reload_json)

print("\nExcel:")
print(reload_excel)

print("\nPickle:")
print(reload_pickle)
```

</div>

## 18. Quick statistics after reading

**What this teaches:** Reading data is usually followed immediately by inspection.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 38</div>

```python
loaded_df = pd.read_csv("/mnt/data/sample_data_ch35.csv")
print(loaded_df.describe())
```

</div>

## 19. Quick filtering after loading

**What this teaches:** Once data is loaded, selection and analysis start.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 40</div>

```python
loaded_df = pd.read_csv("/mnt/data/sample_data_ch35.csv")
print(loaded_df[loaded_df["Marks"] > 85])
```

</div>

## 20. Convert one format into another

**What this teaches:** Pandas often acts as a bridge between file types.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 42</div>

```python
bridge_df = pd.read_csv("/mnt/data/sample_data_ch35.csv")
bridge_json_path = "/mnt/data/bridge_output_ch35.json"
bridge_df.to_json(bridge_json_path, orient="records")

print(pd.read_json(bridge_json_path))
```

</div>

## 21. Final integrated example

**What this teaches:** This combines creation, export, reload, and simple analysis.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 44</div>

```python
final_df = pd.DataFrame({
    "Product": ["Laptop", "Phone", "Tablet", "Phone"],
    "Region": ["North", "South", "East", "West"],
    "Sales": [50000, 30000, 20000, 35000]
})

final_csv = "/mnt/data/final_sales_ch35.csv"
final_json = "/mnt/data/final_sales_ch35.json"
final_excel = "/mnt/data/final_sales_ch35.xlsx"
final_pickle = "/mnt/data/final_sales_ch35.pkl"

final_df.to_csv(final_csv, index=False)
final_df.to_json(final_json, orient="records")
final_df.to_excel(final_excel, index=False)
final_df.to_pickle(final_pickle)

loaded = pd.read_csv(final_csv)

print("Loaded final sales data:")
print(loaded)

print("\nTotal sales:", loaded["Sales"].sum())
print("Average sales:", loaded["Sales"].mean())
```

</div>

## Key takeaways

- `pd.read_json()` reads JSON data into a DataFrame
- `df.to_json()` converts a DataFrame to JSON
- `pd.read_csv()` and `df.to_csv()` are core pandas tools
- `pd.read_html()` can extract tables from HTML
- `pd.read_excel()` handles spreadsheet data
- `df.to_pickle()` and `pd.read_pickle()` support serialized storage
- pandas can move data between many formats easily

## Practice tasks

1. Create a DataFrame and save it as CSV
2. Save it as JSON
3. Save and read it as Excel
4. Save and read it as pickle
5. Create a local HTML table and read it with `read_html()`
6. Compare the same data loaded from multiple formats

## Mentor tip

Think in this order:
1. read
2. inspect
3. clean
4. transform
5. export
