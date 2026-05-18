---
title: "Intermediate"
sidebar_position: 2
---

# Python Intermediate

This guide covers chapters 21–36 of the python-basics curriculum: object-oriented programming, advanced OOP patterns, iterators, generators, decorators, NumPy, Pandas, and logging. It assumes solid familiarity with the Beginner guide.

---

## 1. OOP — Classes and Objects

**Object-Oriented Programming** models real things as objects that have data (attributes) and behavior (methods).

Mental model:
- **class** = blueprint
- **object** = one real thing made from the blueprint
- **attribute** = data stored on the object
- **method** = action the object can do
- `__init__` = runs at creation to set up initial data
- `self` = the current object (passed automatically to every method)

```python
class Car:
    def __init__(self, brand, model):
        self.brand = brand    # instance attribute
        self.model = model

    def describe(self):
        return f"{self.brand} {self.model}"

car1 = Car("Audi", "A4")
car2 = Car("BMW", "X5")
print(car1.describe())   # Audi A4
print(car2.describe())   # BMW X5
```

### Class variables vs instance variables

```python
class Employee:
    company = "TechCorp"         # class variable — shared by all instances

    def __init__(self, name, role="Intern"):
        self.name = name         # instance variable — unique per object
        self.role = role

    def show(self):
        return f"{self.name} ({self.role}) at {Employee.company}"

e1 = Employee("Sara")
e2 = Employee("Ali", "Manager")
print(e1.show())
print(e2.show())
print(Employee.company)   # access via class
```

### A complete bank account example

```python
class BankAccount:
    def __init__(self, holder, balance=0):
        self.holder = holder
        self.balance = balance

    def deposit(self, amount):
        if amount > 0:
            self.balance += amount
        else:
            print("Deposit must be positive")

    def withdraw(self, amount):
        if amount <= 0:
            print("Withdrawal must be positive")
        elif amount > self.balance:
            print("Insufficient balance")
        else:
            self.balance -= amount

    def check_balance(self):
        return f"{self.holder}: {self.balance}"

account = BankAccount("Meera", 1000)
account.deposit(200)
account.withdraw(300)
print(account.check_balance())   # Meera: 900
```

---

## 2. Inheritance

Inheritance lets a child class reuse and extend a parent class.

**Rule of thumb:** use inheritance when you can honestly say "a child is a more specific kind of parent" (Dog is-a Animal, Manager is-a Employee).

### Single inheritance

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name} is eating")

class Dog(Animal):
    def bark(self):
        print(f"{self.name} says woof!")

d = Dog("Bruno")
d.eat()    # inherited
d.bark()   # own method
```

### super() — calling the parent constructor

```python
class Car:
    def __init__(self, windows, engine_type):
        self.windows = windows
        self.engine_type = engine_type

    def drive(self):
        print("Driving")

class Tesla(Car):
    def __init__(self, windows, engine_type, battery_range, is_self_driving):
        super().__init__(windows, engine_type)   # reuse parent setup
        self.battery_range = battery_range
        self.is_self_driving = is_self_driving

    def show_details(self):
        print(
            f"Windows: {self.windows}, Engine: {self.engine_type}, "
            f"Range: {self.battery_range}, Self-driving: {self.is_self_driving}"
        )

tesla = Tesla(4, "Electric", "500km", True)
tesla.drive()
tesla.show_details()
```

### Method overriding

A child class replaces a parent method with its own version.

```python
class Animal:
    def speak(self):
        print("Animal sound")

class Dog(Animal):
    def speak(self):
        print("Woof")

class Cat(Animal):
    def speak(self):
        print("Meow")

for animal in [Dog(), Cat()]:
    animal.speak()
```

### Multiple inheritance

```python
class Animal:
    def eat(self):
        print("Eating")

class Pet:
    def play(self):
        print("Playing")

class Dog(Animal, Pet):
    pass

d = Dog()
d.eat()
d.play()
```

### Method Resolution Order (MRO)

Python uses C3 linearization to determine which parent method is called. Inspect it with `ClassName.__mro__`.

```python
print(Dog.__mro__)
```

### isinstance and issubclass

```python
class Animal:
    pass

class Dog(Animal):
    pass

d = Dog()
print(isinstance(d, Dog))      # True
print(isinstance(d, Animal))   # True — also passes parent check
print(issubclass(Dog, Animal))  # True
```

---

## 3. Polymorphism

**Polymorphism** = same method name, different behavior depending on the object.

### Method overriding and shared interfaces

```python
class Shape:
    def area(self):
        return 0

class Rectangle(Shape):
    def __init__(self, length, width):
        self.length = length
        self.width = width

    def area(self):
        return self.length * self.width

class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14159 * self.radius ** 2

def print_area(shape):
    print("Area:", shape.area())

print_area(Rectangle(5, 3))   # Area: 15
print_area(Circle(4))          # Area: 50.26...
```

### Duck typing

Python does not require a shared parent class — only a matching interface.

```python
class Bird:
    def move(self):
        print("Flying")

class Fish:
    def move(self):
        print("Swimming")

class Car:
    def move(self):
        print("Driving")

for thing in [Bird(), Fish(), Car()]:
    thing.move()   # works for all — each has move()
```

**Key idea:** Python asks "can this object do what I need?" not "is it the right type?".

---

## 4. Encapsulation

Encapsulation keeps data safe inside a class and controls access through methods.

| Prefix | Name | Meaning |
|--------|------|---------|
| `name` | public | Accessible anywhere |
| `_name` | protected | Convention: internal use only |
| `__name` | private | Name-mangled — harder to access outside class |

```python
class Person:
    def __init__(self, name, salary, age):
        self.name = name          # public
        self._salary = salary     # protected
        self.__age = age          # private

    def get_age(self):
        return self.__age

    def set_age(self, new_age):
        if new_age > 0:
            self.__age = new_age
        else:
            print("Age must be positive")

p = Person("Ravi", 60000, 28)
print(p.name)        # accessible
print(p._salary)     # accessible but convention says don't
print(p.get_age())   # 28 — through getter
p.set_age(30)
print(p.get_age())   # 30
```

### @property and @setter — the Pythonic approach

`@property` lets you define getters and setters that look like plain attribute access.

```python
class Temperature:
    def __init__(self, celsius):
        self._celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("Temperature below absolute zero")
        self._celsius = value

    @property
    def fahrenheit(self):
        return self._celsius * 9/5 + 32

t = Temperature(25)
print(t.celsius)      # 25
print(t.fahrenheit)   # 77.0
t.celsius = 100
print(t.fahrenheit)   # 212.0
```

---

## 5. Abstraction (ABC)

Abstraction hides internal complexity behind a simple interface. The `abc` module lets you define abstract classes that enforce required methods in child classes.

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    def fuel_info(self):
        print("Vehicles need energy")

    @abstractmethod
    def start_engine(self):
        pass   # child MUST implement this

class Car(Vehicle):
    def start_engine(self):
        print("Car engine started")

class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle engine started")

# Vehicle()   # TypeError — cannot instantiate abstract class
car = Car()
car.fuel_info()
car.start_engine()
```

Practical shapes example:

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

class Rectangle(Shape):
    def __init__(self, l, w):
        self.l = l
        self.w = w

    def area(self):
        return self.l * self.w

class Circle(Shape):
    def __init__(self, r):
        self.r = r

    def area(self):
        return 3.14159 * self.r ** 2

for shape in [Rectangle(4, 5), Circle(3)]:
    print("Area:", shape.area())
```

---

## 6. Magic Methods (Dunder Methods)

Magic methods have double underscores on both sides. They let your objects integrate with Python's built-in operations.

### __str__ and __repr__

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __str__(self):
        # called by print() and str() — user-friendly
        return f"{self.name} ({self.age})"

    def __repr__(self):
        # called by repr() — debug-friendly, should look like constructor
        return f"Person(name={self.name!r}, age={self.age!r})"

p = Person("Sara", 26)
print(p)           # Sara (26)
print(repr(p))     # Person(name='Sara', age=26)

people = [Person("Alice", 21), Person("Bob", 25)]
print(people)      # uses __repr__ in lists
```

### __len__, __eq__, __lt__

```python
class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)

    def pop(self):
        return self._items.pop()

    def __len__(self):
        return len(self._items)

    def __eq__(self, other):
        return self._items == other._items

s = Stack()
s.push(1)
s.push(2)
print(len(s))   # 2
```

### __add__ and __mul__ (operator overloading)

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)    # Vector(4, 6)
print(v1 * 3)     # Vector(3, 6)
```

### Context manager — __enter__ and __exit__

```python
class ManagedFile:
    def __init__(self, filename, mode):
        self.filename = filename
        self.mode = mode

    def __enter__(self):
        self.file = open(self.filename, self.mode)
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()
        return False   # do not suppress exceptions

with ManagedFile("test.txt", "w") as f:
    f.write("Context manager example")
```

### __iter__ — making objects iterable

```python
class NumberRange:
    def __init__(self, start, end):
        self.current = start
        self.end = end

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.end:
            raise StopIteration
        val = self.current
        self.current += 1
        return val

for n in NumberRange(1, 5):
    print(n)   # 1 2 3 4
```

---

## 7. Custom Exceptions

Build a hierarchy to give callers fine-grained control over error handling.

```python
class AppError(Exception):
    """Base exception for this application."""
    pass

class ValidationError(AppError):
    """Raised when input fails validation."""
    pass

class DatabaseError(AppError):
    """Raised on database failures."""
    pass

class RecordNotFoundError(DatabaseError):
    """Raised when a record cannot be located."""
    def __init__(self, record_id):
        self.record_id = record_id
        super().__init__(f"Record {record_id} not found")

def find_user(user_id):
    if user_id <= 0:
        raise ValidationError("User ID must be positive")
    if user_id > 100:
        raise RecordNotFoundError(user_id)
    return {"id": user_id, "name": "Alice"}

try:
    user = find_user(999)
except RecordNotFoundError as e:
    print(f"Not found: {e.record_id}")
except ValidationError as e:
    print(f"Invalid input: {e}")
except AppError as e:
    print(f"App error: {e}")
```

---

## 8. Iterators

An **iterator** delivers one item at a time. A `for` loop secretly uses iterators.

```python
numbers = [1, 2, 3, 4, 5]
it = iter(numbers)    # create iterator
print(next(it))       # 1
print(next(it))       # 2
print(next(it))       # 3
```

What a `for` loop really does:

```python
it = iter(numbers)
try:
    while True:
        value = next(it)
        print("Got:", value)
except StopIteration:
    pass
```

Iterators work on strings, tuples, dicts too:

```python
text = "Python"
it = iter(text)
print(next(it), next(it), next(it))   # P y t

student = {"name": "Asha", "marks": 95}
it = iter(student)
print(next(it))   # name  (iterates over keys by default)
```

Once consumed, an iterator cannot be restarted:

```python
nums = [1, 2, 3]
it = iter(nums)
print(next(it))         # 1
remaining = list(it)    # [2, 3]
print(list(it))         # []  — exhausted
```

---

## 9. Generators

A **generator** is a special iterator that produces values on demand using `yield`. It pauses execution at each `yield` and resumes from that point on the next `next()` call.

```python
def simple_generator():
    yield 1
    yield 2
    yield 3

for value in simple_generator():
    print(value)   # 1  2  3

g = simple_generator()
print(next(g))   # 1
print(next(g))   # 2
```

### Generator vs list — memory comparison

```python
def squares_list(n):
    result = []
    for i in range(n):
        result.append(i * i)
    return result           # entire list in memory at once

def squares_gen(n):
    for i in range(n):
        yield i * i         # one value at a time

print(squares_list(5))     # [0, 1, 4, 9, 16]
print(squares_gen(5))      # <generator object ...>  — lazy
```

### Practical generator — line-by-line reading

```python
def read_log_lines(filename):
    with open(filename) as f:
        for line in f:
            yield line.strip()   # one line at a time, never loads whole file

# for line in read_log_lines("app.log"):
#     if "ERROR" in line:
#         print(line)
```

### Generator expressions

```python
gen = (x * x for x in range(5))
for value in gen:
    print(value)   # 0 1 4 9 16

# Memory-efficient sum of large sequence
total = sum(x * x for x in range(10_000))
print(total)
```

### yield from

```python
def chain(*iterables):
    for it in iterables:
        yield from it

for item in chain([1, 2], [3, 4], [5]):
    print(item)   # 1 2 3 4 5
```

### send() — two-way communication with a generator

```python
def accumulator():
    total = 0
    while True:
        value = yield total
        if value is None:
            break
        total += value

gen = accumulator()
next(gen)            # prime the generator
print(gen.send(5))   # 5
print(gen.send(10))  # 15
print(gen.send(3))   # 18
```

---

## 10. Decorators

A **decorator** adds behavior to a function without changing the function's original code. Decorators are built on closures and the fact that functions are first-class objects.

### Building blocks

```python
# Functions are objects — can be stored and passed around
def welcome():
    return "Welcome!"

alias = welcome
print(alias())   # Welcome!

# Functions can be passed as arguments
def run(func):
    return func()

print(run(welcome))   # Welcome!
```

### Closures

```python
def outer(name):
    def inner():
        print(f"Hello, {name}")   # inner remembers 'name' from outer scope
    return inner

greet_asha = outer("Asha")
greet_asha()   # Hello, Asha
```

### Simple decorator

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print(f"Before {func.__name__}")
        result = func(*args, **kwargs)
        print(f"After {func.__name__}")
        return result
    return wrapper

@my_decorator
def say_hello(name):
    print(f"Hello, {name}!")

say_hello("Meera")
# Before say_hello
# Hello, Meera!
# After say_hello
```

The `@my_decorator` line is shorthand for `say_hello = my_decorator(say_hello)`.

### @functools.wraps — preserve function metadata

```python
import functools

def my_decorator(func):
    @functools.wraps(func)   # preserves __name__, __doc__, etc.
    def wrapper(*args, **kwargs):
        print("Decorator running")
        return func(*args, **kwargs)
    return wrapper

@my_decorator
def add(a, b):
    """Add two numbers."""
    return a + b

print(add.__name__)   # add  (not 'wrapper')
print(add.__doc__)    # Add two numbers.
```

### Decorator factory (decorator with arguments)

```python
import functools

def repeat(n):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(3)
def say_hi():
    print("Hi!")

say_hi()   # prints Hi! three times
```

### Practical decorators

```python
import time
import functools

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} ran in {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_sum(n):
    return sum(range(n))

slow_sum(1_000_000)
```

### Stacking decorators

```python
@timer
@my_decorator
def greet(name):
    print(f"Greetings, {name}!")

# Equivalent to: greet = timer(my_decorator(greet))
```

### Class-based decorator

```python
import functools

class CountCalls:
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        print(f"Call #{self.count}")
        return self.func(*args, **kwargs)

@CountCalls
def say_hello():
    print("Hello!")

say_hello()
say_hello()
print(say_hello.count)   # 2
```

---

## 11. NumPy

NumPy provides fast, vectorized operations on typed arrays. It is the foundation of the scientific Python ecosystem.

```python
import numpy as np
```

### Creating arrays

```python
a = np.array([1, 2, 3])
b = np.arange(0, 10, 2)          # [0 2 4 6 8]
c = np.linspace(0, 1, 5)         # [0. .25 .5 .75 1.]
zeros = np.zeros((3, 3))
ones = np.ones((2, 4))
identity = np.eye(3)
random = np.random.rand(3, 3)    # uniform [0, 1)
```

### Shape, dimensions, dtype

```python
arr = np.array([[1, 2, 3], [4, 5, 6]])
print("Shape:", arr.shape)    # (2, 3)
print("ndim:", arr.ndim)      # 2
print("dtype:", arr.dtype)    # int64
print("size:", arr.size)      # 6

float_arr = np.array([1.0, 2.0, 3.0], dtype=np.float32)
```

### Reshape

```python
arr = np.arange(1, 9)
print(arr.reshape(2, 4))      # 2 rows, 4 cols
print(arr.reshape(-1, 2))     # -1 infers the missing dimension
print(arr.flatten())          # always returns a copy
```

### Vectorization — no loops needed

```python
a = np.array([1, 2, 3])
print(a * 10)        # [10 20 30]
print(a + 5)         # [ 6  7  8]
print(a ** 2)        # [ 1  4  9]
print(np.sqrt(a))    # [1. 1.41 1.73]
```

NumPy operations happen in compiled C code — orders of magnitude faster than Python loops for large arrays.

### Broadcasting

Broadcasting lets arrays of different shapes operate together without explicit loops.

```python
a = np.array([1, 2, 3])            # shape (3,)
b = np.array([[10], [20]])         # shape (2, 1)
print(a + b)
# [[11 12 13]
#  [21 22 23]]
```

Rule: dimensions are aligned from the right. A dimension of size 1 is stretched to match.

### Indexing and slicing

```python
arr = np.array([[1, 2, 3], [4, 5, 6]])

print(arr[0, 1])       # 2  — row 0, col 1
print(arr[:, 1])       # [2, 5]  — all rows, col 1
print(arr[1, :])       # [4, 5, 6]  — row 1
print(arr[0:2, 1:3])   # [[2, 3], [5, 6]]
```

### Boolean masking — filter like SQL WHERE

```python
arr = np.array([1, 2, 3, 4, 5])
print(arr[arr > 3])         # [4 5]
print(arr[arr % 2 == 0])    # [2 4]

marks = np.array([50, 60, 70, 80, 90])
top_scorers = marks[marks > 75]
print("Top scorers:", top_scorers)   # [80 90]
```

### Fancy indexing

```python
arr = np.array([10, 20, 30, 40, 50])
print(arr[[0, 2, 4]])    # [10 30 50]
```

### Aggregation functions and axis

```python
arr = np.array([[1, 2, 3], [4, 5, 6]])
print(np.mean(arr))           # 3.5 — grand mean
print(np.mean(arr, axis=0))   # [2.5 3.5 4.5]  — column means
print(np.mean(arr, axis=1))   # [2. 5.]         — row means
print(np.sum(arr, axis=1))    # [6, 15]
print(np.max(arr))            # 6
print(np.min(arr))            # 1
print(np.std(arr))            # standard deviation
```

`axis=0` collapses rows (operates down columns). `axis=1` collapses columns (operates across rows).

### Linear algebra

```python
a = np.array([[1, 2], [3, 4]])
b = np.array([[5, 6], [7, 8]])
print(np.dot(a, b))       # matrix multiply
print(a.T)                # transpose
print(np.linalg.det(a))   # determinant
```

### Common NumPy patterns

```python
# Normalize to [0, 1]
arr = np.array([10.0, 20.0, 30.0, 40.0])
normalized = (arr - arr.min()) / (arr.max() - arr.min())

# Stack arrays
row1 = np.array([1, 2, 3])
row2 = np.array([4, 5, 6])
stacked = np.vstack([row1, row2])   # (2, 3)
hstacked = np.hstack([row1, row2])  # [1 2 3 4 5 6]

# Count elements satisfying a condition
arr = np.arange(10)
print(np.sum(arr > 5))   # 4
```

---

## 12. Pandas

Pandas provides two core structures: **Series** (1D) and **DataFrame** (2D table).

```python
import pandas as pd
import numpy as np
```

### Series

```python
s1 = pd.Series([10, 20, 30, 40])
print(s1)

s2 = pd.Series({"math": 90, "science": 85, "english": 88})
print(s2["math"])      # 90
print(s2.index)
print(s2.values)
```

### Creating DataFrames

```python
data = {
    "Name": ["Asha", "Ravi", "Meera", "John"],
    "Age": [22, 25, 21, 30],
    "Marks": [85, 90, 88, 76]
}
df = pd.DataFrame(data)
print(df)
print(df.shape)           # (4, 3)
print(df.columns.tolist())
print(df.dtypes)
```

### Inspection tools

```python
print(df.head(2))     # first 2 rows
print(df.tail(2))     # last 2 rows
print(df.describe())  # count, mean, std, min, quartiles, max
print(df.info())      # column types and null counts
```

### Column selection

```python
print(df["Name"])               # Series
print(df[["Name", "Marks"]])    # DataFrame with 2 columns
```

### loc and iloc

```python
print(df.loc[0])              # row with label 0
print(df.loc[0:2, "Name"])    # rows 0-2, Name column (label-based, inclusive)
print(df.iloc[0])             # first row (position-based)
print(df.iloc[0:3, 0:2])     # rows 0-2, cols 0-1 (position-based, exclusive end)
print(df.at[1, "Marks"])     # fast single-value label access
print(df.iat[1, 2])          # fast single-value position access
```

### Adding, updating, dropping columns

```python
df2 = df.copy()
df2["Pass"] = df2["Marks"] >= 80        # add boolean column
df2["Bonus"] = 5                         # add constant
df2["FinalMarks"] = df2["Marks"] + df2["Bonus"]
df2.at[0, "Marks"] = 95                 # update single cell

df2 = df2.drop("Bonus", axis=1)         # drop column
df2 = df2.drop(0, axis=0)               # drop row by label
df2 = df2.rename(columns={"Marks": "Score"})
```

### Filtering and sorting

```python
# Boolean filter
high_scorers = df[df["Marks"] > 80]
combined = df[(df["Marks"] > 80) & (df["Age"] >= 22)]

# Sorting
sorted_df = df.sort_values(by="Marks", ascending=False)
sorted_multi = df.sort_values(by=["Age", "Marks"], ascending=[True, False])
```

### Missing values

```python
missing_df = pd.DataFrame({
    "Name": ["Asha", "Ravi", None, "John"],
    "Age": [22, np.nan, 21, 30],
    "Marks": [85, 90, np.nan, 76]
})

print(missing_df.isnull().sum())     # count nulls per column
print(missing_df.isnull().any())     # which columns have nulls

# Fill with constant or statistic
filled = missing_df.copy()
filled["Name"] = filled["Name"].fillna("Unknown")
filled["Age"] = filled["Age"].fillna(filled["Age"].mean())
filled["Marks"] = filled["Marks"].fillna(filled["Marks"].median())

# Drop rows with any null
clean = missing_df.dropna()
```

### Type conversion

```python
employee_df = pd.DataFrame({
    "Name": ["Asha", "Ravi"],
    "JoinDate": ["2024-01-10", "2023-08-15"],
    "Salary": ["50000", "60000"]
})
employee_df["JoinDate"] = pd.to_datetime(employee_df["JoinDate"])
employee_df["Salary"] = employee_df["Salary"].astype(int)
print(employee_df.dtypes)
```

### Groupby and aggregation

```python
sales = pd.DataFrame({
    "Product": ["Laptop", "Phone", "Laptop", "Tablet", "Phone"],
    "Region": ["North", "South", "South", "East", "East"],
    "Sales": [50000, 20000, 55000, 18000, 25000],
    "Units": [5, 10, 6, 8, 12]
})

# Single aggregation
print(sales.groupby("Product")["Sales"].sum())
print(sales.groupby("Region")["Units"].mean())

# Multiple aggregations
summary = sales.groupby("Product").agg({
    "Sales": ["mean", "sum", "max"],
    "Units": ["mean", "sum"]
})
print(summary)

# Multi-column groupby
print(sales.groupby(["Product", "Region"])["Sales"].sum())
```

### apply

```python
df2 = df.copy()
df2["Grade"] = df2["Marks"].apply(lambda x: "A" if x >= 90 else "B" if x >= 80 else "C")
print(df2)
```

### Merge and join

```python
students = pd.DataFrame({
    "StudentID": [1, 2, 3, 4],
    "Name": ["Asha", "Ravi", "Meera", "John"]
})

marks = pd.DataFrame({
    "StudentID": [1, 2, 3, 5],
    "Marks": [85, 90, 88, 76]
})

inner = pd.merge(students, marks, on="StudentID", how="inner")  # matching rows only
left  = pd.merge(students, marks, on="StudentID", how="left")   # all students
outer = pd.merge(students, marks, on="StudentID", how="outer")  # all rows

# Different key names
merged = pd.merge(students, marks, left_on="StudentID", right_on="StudentID", how="left")
```

### Pivot table

```python
pivot = sales.pivot_table(
    values="Sales",
    index="Product",
    columns="Region",
    aggfunc="sum",
    fill_value=0
)
print(pivot)
```

### Reading and writing data

```python
# CSV
df.to_csv("output.csv", index=False)
df_loaded = pd.read_csv("output.csv")

# JSON
json_str = df.to_json(orient="records")
df_json = pd.read_json(json_str)

# Excel (requires openpyxl)
# df.to_excel("output.xlsx", index=False)
# df_excel = pd.read_excel("output.xlsx")
```

### EDA mini workflow

```python
eda_df = pd.DataFrame({
    "Name": ["Asha", "Ravi", "Meera", "John", "Sara"],
    "Department": ["IT", "HR", "IT", "Finance", "HR"],
    "Salary": [50000, 45000, 60000, np.nan, 48000],
    "Experience": [2, 4, 5, 3, np.nan]
})

# 1. inspect
print(eda_df.info())
print(eda_df.describe())
print(eda_df.isnull().sum())

# 2. clean
eda_df["Salary"] = eda_df["Salary"].fillna(eda_df["Salary"].mean())
eda_df["Experience"] = eda_df["Experience"].fillna(eda_df["Experience"].median())

# 3. engineer features
eda_df["SalaryBand"] = eda_df["Salary"].apply(lambda x: "High" if x >= 50000 else "Medium")
eda_df["SalaryPerYear"] = eda_df["Salary"] / eda_df["Experience"]

# 4. aggregate
print(eda_df.groupby("Department")["Salary"].mean())

# 5. value counts and deduplication
print(eda_df["Department"].value_counts())
print(eda_df["Department"].unique())
print(eda_df.duplicated().sum())
```

### Method chaining

```python
result = (
    df
    .copy()
    .assign(Grade=lambda x: x["Marks"].apply(lambda m: "A" if m >= 88 else "B"))
    .query("Age >= 22")
    .sort_values("Marks", ascending=False)
    .reset_index(drop=True)
)
print(result)
```

---

## 13. Logging

The `logging` module is better than `print()` for production code: it adds levels, timestamps, and can write to files.

### Log levels (lowest to highest severity)

| Level | Value | Use for |
|-------|-------|---------|
| `DEBUG` | 10 | Detailed internal tracing |
| `INFO` | 20 | Normal progress milestones |
| `WARNING` | 30 | Unexpected but recoverable |
| `ERROR` | 40 | Something failed |
| `CRITICAL` | 50 | Severe failure, app may stop |

### Basic setup

```python
import logging

logging.basicConfig(level=logging.DEBUG)

logging.debug("Detailed internal message")
logging.info("Application started")
logging.warning("Unexpected but manageable issue")
logging.error("Something failed")
logging.critical("Severe failure")
```

Only messages at or above the configured level are shown.

### Custom format with timestamps

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logging.info("Custom format example")
logging.error("Something went wrong")
```

### Logging to a file

```python
import logging

logging.basicConfig(
    filename="app.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    force=True   # override any prior basicConfig calls
)

logging.debug("Debug message saved to file")
logging.info("Info message saved to file")
logging.error("Error message saved to file")
```

### Named loggers with getLogger()

In real projects, each module gets its own logger. Use `logging.getLogger(__name__)` so the logger name matches the module path.

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger("my_app")
logger.debug("Debug from my_app")
logger.info("Info from my_app")
logger.warning("Warning from my_app")
```

Multiple loggers in one application:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(name)s - %(levelname)s - %(message)s",
    force=True
)

auth_logger = logging.getLogger("app.auth")
payment_logger = logging.getLogger("app.payment")
db_logger = logging.getLogger("app.database")

auth_logger.info("User login successful")
payment_logger.warning("Payment gateway slow")
db_logger.error("Connection pool exhausted")
```

### Handlers and formatters — fine-grained control

```python
import logging

logger = logging.getLogger("handler_demo")
logger.setLevel(logging.DEBUG)
logger.handlers.clear()    # avoid duplicate handlers in notebooks

# File handler
file_handler = logging.FileHandler("handler_demo.log")
file_handler.setLevel(logging.DEBUG)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.WARNING)

formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

logger.debug("Goes to file only")
logger.warning("Goes to both file and console")
logger.error("Goes to both")
```

### Log rotation

```python
import logging
from logging.handlers import RotatingFileHandler

logger = logging.getLogger("rotating_demo")
logger.setLevel(logging.DEBUG)
logger.handlers.clear()

handler = RotatingFileHandler(
    "rotating.log",
    maxBytes=1024 * 1024,   # 1 MB per file
    backupCount=5            # keep 5 old log files
)
handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
logger.addHandler(handler)

logger.info("Rotating log example")
```

### Reusable setup function

```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logger(name, log_file=None, level=logging.DEBUG):
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.handlers.clear()

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)

    if log_file:
        fh = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=3)
        fh.setFormatter(formatter)
        logger.addHandler(fh)

    return logger

app_log = setup_logger("my_app", "my_app.log")
app_log.info("Application started")
app_log.error("Something failed")
```

### Logging exceptions

```python
import logging

logger = logging.getLogger("exception_demo")
logging.basicConfig(level=logging.DEBUG, force=True)

def divide(a, b):
    logger.debug(f"divide called with a={a}, b={b}")
    try:
        result = a / b
        logger.debug(f"Result: {result}")
        return result
    except ZeroDivisionError:
        logger.error("Division by zero", exc_info=True)   # includes traceback
        return None

print(divide(10, 2))
print(divide(10, 0))
```

`exc_info=True` appends the full traceback to the log entry — essential for production debugging.

### Structured logging

```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage()
        }
        return json.dumps(log_entry)

logger = logging.getLogger("structured")
logger.setLevel(logging.DEBUG)
logger.handlers.clear()

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

logger.info("Order processed")
logger.warning("Latency spike detected")
```

---

## Quick Reference

```python
# OOP boilerplate
class MyClass:
    class_var = "shared"

    def __init__(self, x):
        self.x = x

    def __str__(self):
        return f"MyClass(x={self.x})"

    def __repr__(self):
        return f"MyClass(x={self.x!r})"

# Generator pipeline
def evens(n):
    return (x for x in range(n) if x % 2 == 0)

# Decorator with wraps
import functools
def log_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

# NumPy: filter and aggregate
import numpy as np
arr = np.arange(1, 11)
print(arr[arr > 5].mean())   # mean of values > 5

# Pandas: quick EDA chain
import pandas as pd
# df.describe().T  — transposed for wide DataFrames
# df.isnull().sum().sort_values(ascending=False)
# df.groupby("col").agg({"num_col": ["mean", "max"]})

# Logging: standard module setup
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)
```
