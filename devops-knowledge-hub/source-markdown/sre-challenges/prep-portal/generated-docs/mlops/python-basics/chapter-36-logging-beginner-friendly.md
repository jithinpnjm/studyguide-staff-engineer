---
title: "Chapter 36 Logging Beginner Friendly"
description: "Generated from mlops/PYTHON/Basics/chapter_36_logging_beginner_friendly.ipynb"
slug: "/python-basics/chapter-36-logging-beginner-friendly"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Basics/chapter_36_logging_beginner_friendly.ipynb</code></div>

# Chapter 36 — Logging in Python (Beginner-Friendly, Practical Deep Dive)

This notebook combines the ideas from:
- basic logging
- logging levels
- logging to a file
- reusable logging configuration
- multiple loggers
- a small real-world logging example

## Start here: one-line meaning

**Logging means recording useful information about what your program is doing.**

## Tiny memory guide

- `DEBUG` = detailed internal info  
- `INFO` = normal progress info  
- `WARNING` = something unexpected but not fatal  
- `ERROR` = something went wrong  
- `CRITICAL` = serious failure  

## Why logging matters

Logging helps you:
- track program flow
- debug errors
- keep records of app activity
- understand what happened after a problem
- separate normal output from technical application events

## Important idea

`print()` is useful while learning.

But in real applications, **logging is better** because:
- it supports levels
- it can write to files
- it can include timestamps
- it is easier to manage in large applications

## 1. Import the logging module

**What this teaches:** Python has a built-in `logging` module, so no external installation is needed.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
import logging

print("logging module imported")
```

</div>

## 2. Basic logging setup

**What this teaches:** `basicConfig()` is the simplest way to start using logging.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
import logging

logging.basicConfig(level=logging.INFO)

logging.info("Application started")
logging.warning("This is a warning message")
logging.error("This is an error message")
```

</div>

## 3. Logging levels explained

**What this teaches:** Different levels are used for different kinds of events.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 7</div>

```python
import logging

logging.basicConfig(level=logging.DEBUG)

logging.debug("Debug: detailed internal message")
logging.info("Info: normal operation message")
logging.warning("Warning: unexpected but manageable issue")
logging.error("Error: something failed")
logging.critical("Critical: severe failure")
```

</div>

## 4. Why level matters

**What this teaches:** The configured level decides which messages are shown.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 9</div>

```python
import logging

logging.basicConfig(level=logging.WARNING)

logging.debug("This debug message will usually not appear")
logging.info("This info message will usually not appear")
logging.warning("This warning message appears")
logging.error("This error message appears")
```

</div>

## 5. Custom log format

**What this teaches:** You can include time, level, and message in each log entry.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logging.info("Custom format example")
logging.error("Something went wrong")
```

</div>

## 6. Add date formatting

**What this teaches:** You can control how the timestamp looks.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 13</div>

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logging.info("Date format example")
```

</div>

## 7. Log messages to a file

**What this teaches:** Logging to a file is one of the biggest advantages over `print()`.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 15</div>

```python
import logging

log_file = "/mnt/data/basic_logging_example.log"

logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    force=True
)

logging.debug("Debug message saved to file")
logging.info("Info message saved to file")
logging.error("Error message saved to file")

print(f"Log file written to: {log_file}")
```

</div>

## 8. Read the log file

**What this teaches:** Once logs are saved, you can inspect them later.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 17</div>

```python
with open("/mnt/data/basic_logging_example.log", "r", encoding="utf-8") as f:
    print(f.read())
```

</div>

## 9. Why reusable logging configuration is useful

**What this teaches:** In real projects, logging setup is often placed in one separate file and reused by many modules.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 19</div>

```python
logging_config_code = '''
import logging

def setup_logging():
    logging.basicConfig(
        filename="/mnt/data/reusable_app.log",
        level=logging.DEBUG,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True
    )
'''
print(logging_config_code)
```

</div>

## 10. Create a logger using getLogger()

**What this teaches:** A logger object gives you more control than using only the root logger.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(name)s - %(levelname)s - %(message)s",
    force=True
)

logger = logging.getLogger("my_app")

logger.debug("Debug from my_app")
logger.info("Info from my_app")
logger.warning("Warning from my_app")
```

</div>

## 11. Multiple loggers for different modules

**What this teaches:** Different parts of an application can have their own loggers.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 23</div>

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(name)s - %(levelname)s - %(message)s",
    force=True
)

logger_one = logging.getLogger("module_one")
logger_two = logging.getLogger("module_two")

logger_one.debug("Debug message from module one")
logger_one.info("Info message from module one")

logger_two.warning("Warning message from module two")
logger_two.error("Error message from module two")
```

</div>

## 12. Different levels for different loggers

**What this teaches:** Each logger can have its own logging level.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 25</div>

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(name)s - %(levelname)s - %(message)s",
    force=True
)

logger_one = logging.getLogger("module_one")
logger_two = logging.getLogger("module_two")

logger_one.setLevel(logging.DEBUG)
logger_two.setLevel(logging.WARNING)

logger_one.debug("module_one debug shown")
logger_one.info("module_one info shown")

logger_two.debug("module_two debug hidden")
logger_two.warning("module_two warning shown")
```

</div>

## 13. Avoiding confusion with one root logger

**What this teaches:** Named loggers make logs easier to understand in larger apps.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(name)s - %(levelname)s - %(message)s",
    force=True
)

auth_logger = logging.getLogger("auth")
payment_logger = logging.getLogger("payment")

auth_logger.info("User login successful")
payment_logger.info("Payment initiated")
```

</div>

## 14. FileHandler introduction

**What this teaches:** Handlers let you control where logs go. A FileHandler sends logs to a file.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
import logging

logger = logging.getLogger("handler_demo")
logger.setLevel(logging.DEBUG)
logger.handlers.clear()

file_handler = logging.FileHandler("/mnt/data/handler_demo.log")
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)

logger.addHandler(file_handler)

logger.info("This goes to the file through FileHandler")
logger.error("Another file log entry")

print("FileHandler log created.")
```

</div>

## 15. Read FileHandler output

**What this teaches:** A handler-based setup is common in real applications.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 31</div>

```python
with open("/mnt/data/handler_demo.log", "r", encoding="utf-8") as f:
    print(f.read())
```

</div>

## 16. Real-world style arithmetic app logger

**What this teaches:** This example begins a practical logging workflow inside a mini application.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
import logging

app_logger = logging.getLogger("arithmetic_app")
app_logger.setLevel(logging.DEBUG)
app_logger.handlers.clear()

file_handler = logging.FileHandler("/mnt/data/arithmetic_app.log")
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)
app_logger.addHandler(file_handler)

app_logger.info("Arithmetic app started")
print("Arithmetic app logger configured")
```

</div>

## 17. Addition with debug logs

**What this teaches:** Debug logs help track inputs and outputs in functions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 35</div>

```python
import logging

app_logger = logging.getLogger("arithmetic_app")

def add(a, b):
    app_logger.debug(f"Adding values: a={a}, b={b}")
    result = a + b
    app_logger.debug(f"Addition result: {result}")
    return result

print(add(5, 3))
```

</div>

## 18. Subtraction and multiplication logs

**What this teaches:** Logging can be added consistently across related functions.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 37</div>

```python
import logging

app_logger = logging.getLogger("arithmetic_app")

def subtract(a, b):
    app_logger.debug(f"Subtracting values: a={a}, b={b}")
    result = a - b
    app_logger.debug(f"Subtraction result: {result}")
    return result

def multiply(a, b):
    app_logger.debug(f"Multiplying values: a={a}, b={b}")
    result = a * b
    app_logger.debug(f"Multiplication result: {result}")
    return result

print(subtract(10, 4))
print(multiply(6, 7))
```

</div>

## 19. Division with exception handling

**What this teaches:** Logging is especially valuable when errors happen.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 39</div>

```python
import logging

app_logger = logging.getLogger("arithmetic_app")

def divide(a, b):
    app_logger.debug(f"Dividing values: a={a}, b={b}")
    try:
        result = a / b
        app_logger.debug(f"Division result: {result}")
        return result
    except ZeroDivisionError:
        app_logger.error("Attempted division by zero")
        return "Cannot divide by zero"

print(divide(10, 2))
print(divide(10, 0))
```

</div>

## 20. Read the arithmetic app log file

**What this teaches:** Logs become a history of application behavior.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 41</div>

```python
with open("/mnt/data/arithmetic_app.log", "r", encoding="utf-8") as f:
    print(f.read())
```

</div>

## 21. Console + file logging together

**What this teaches:** Real apps often log both to console and file using multiple handlers.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 43</div>

```python
import logging

logger = logging.getLogger("multi_handler_app")
logger.setLevel(logging.DEBUG)
logger.handlers.clear()

console_handler = logging.StreamHandler()
file_handler = logging.FileHandler("/mnt/data/multi_handler_app.log")

formatter = logging.Formatter("%(name)s - %(levelname)s - %(message)s")
console_handler.setFormatter(formatter)
file_handler.setFormatter(formatter)

logger.addHandler(console_handler)
logger.addHandler(file_handler)

logger.info("This goes to both console and file")
logger.warning("This warning also goes to both")
```

</div>

## 22. Logger names help organize large applications

**What this teaches:** In bigger projects, logger names usually match module or package names.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 45</div>

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(name)s - %(levelname)s - %(message)s",
    force=True
)

db_logger = logging.getLogger("app.database")
api_logger = logging.getLogger("app.api")
service_logger = logging.getLogger("app.service")

db_logger.info("Database connection opened")
api_logger.warning("API responded slowly")
service_logger.error("Service failed to complete task")
```

</div>

## 23. Common syntax mistake reminder

**What this teaches:** Logging constants are uppercase like `logging.DEBUG`, `logging.WARNING`, etc.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 47</div>

```python
import logging

print(logging.DEBUG)
print(logging.INFO)
print(logging.WARNING)
print(logging.ERROR)
print(logging.CRITICAL)
```

</div>

## 24. A reusable setup function

**What this teaches:** Wrapping logging setup inside a function makes reuse easier.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 49</div>

```python
import logging

def setup_app_logger(name, file_path):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()

    handler = logging.FileHandler(file_path)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    return logger

custom_logger = setup_app_logger("reusable_logger", "/mnt/data/reusable_logger.log")
custom_logger.info("Reusable logger works")

with open("/mnt/data/reusable_logger.log", "r", encoding="utf-8") as f:
    print(f.read())
```

</div>

## 25. Full beginner-friendly logging demo

**What this teaches:** This final example combines configuration, named logger, multiple levels, and exception handling.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 51</div>

```python
import logging

logger = logging.getLogger("final_demo")
logger.setLevel(logging.DEBUG)
logger.handlers.clear()

handler = logging.FileHandler("/mnt/data/final_demo.log")
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

def process_numbers(a, b):
    logger.info("Starting process_numbers")
    logger.debug(f"Received inputs: a={a}, b={b}")
    try:
        addition = a + b
        logger.debug(f"Addition result: {addition}")

        division = a / b
        logger.debug(f"Division result: {division}")

        logger.info("process_numbers completed successfully")
        return {"addition": addition, "division": division}
    except ZeroDivisionError:
        logger.error("Division by zero occurred")
        return {"error": "Cannot divide by zero"}

print(process_numbers(10, 2))
print(process_numbers(10, 0))

with open("/mnt/data/final_demo.log", "r", encoding="utf-8") as f:
    print(f.read())
```

</div>

## Key takeaways

- Logging is used to track events, warnings, errors, and program flow
- `logging.basicConfig()` is the simplest setup
- Logging levels include `DEBUG`, `INFO`, `WARNING`, `ERROR`, and `CRITICAL`
- You can customize log format with timestamps and levels
- Logs can be written to files for later review
- `getLogger()` helps organize logs by module or application area
- Different modules can use different named loggers
- Handlers like `FileHandler` control where logs are sent
- Logging is essential in real-world debugging and application monitoring

## Practice tasks

1. Create a basic logger with `basicConfig()`
2. Log one message at each level
3. Save logs to a file
4. Create two different named loggers
5. Give the two loggers different levels
6. Build a small arithmetic app with debug and error logs
7. Add exception logging for division by zero

## Mentor tip

Use this learning order:
1. basicConfig
2. levels
3. file logging
4. named loggers
5. handlers
6. real app logging

That order makes logging much easier to understand.
