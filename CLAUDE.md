# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
# Project Guidelines for Claude

## Core Philosophy
This is a **functional programming** project using JavaScript/TypeScript with a strong emphasis on immutability, composition, and point-free style. We follow functional programming principles strictly—no classes, no mutations, no side effects in pure functions.

## Technology Stack
- **Runtime**: Node.js (latest version)
- **Package Manager**: pnpm (NOT npm or yarn)
- **Module System**: ESM modules only (`"type": "module"` in package.json)
- **Build Tool**: ESBuild for TypeScript compilation
- **Testing**: Vitest or similar functional testing framework
- **Core Libraries**:
  - **Ramda** (`ramda`): Primary functional programming library

## Fundamental Principles

### 1. Functional Programming First
- **Prefer Functions Over Classes**: Avoid classes and OOP patterns. Use functions and data structures.
- **Pure Functions Where Possible**: Keep business logic and data transformations pure. Side effects are necessary for I/O, but isolate them at the edges of your program.
- **Immutability by Default**: Avoid mutating data. Return new data structures for transformations.
- **Composition Over Imperative**: Build complex behavior by composing simple functions.

### 2. Code Style

#### Function Syntax
```javascript
// ✅ ALWAYS use arrow functions
const processData = (data) => transform(data);

// ❌ NEVER use function keyword
function processData(data) { return transform(data); }
```

#### Imports
```javascript
// ✅ Named imports from Ramda
import { pipe, map, filter, reduce } from 'ramda';

// ✅ Node modules with node: protocol
import { readFile } from 'node:fs/promises';

// ❌ Default imports or whole module imports
import R from 'ramda'; // Avoid this
```

#### Data-Last Pattern
```javascript
// ✅ Ramda functions are data-last
const doubled = map(x => x * 2, [1, 2, 3]);

// ✅ This enables clean composition
const process = pipe(
  filter(isActive),
  map(transform),
  reduce(sum, 0)
);
```

### 3. Composition Patterns

#### Use `pipe` Over `compose`
```javascript
// ✅ PREFERRED: pipe (left-to-right, readable flow)
const processUsers = pipe(
  filter(isActive),
  map(capitalizeFields),
  sortBy(prop('name')),
  take(10)
);

// ⚠️ AVOID: compose (right-to-left, harder to read)
const processUsers = compose(
  take(10),
  sortBy(prop('name')),
  map(capitalizeFields),
  filter(isActive)
);
```

#### Point-Free Style
```javascript
// ✅ Point-free (no explicit data parameter)
const getActiveUserNames = pipe(
  filter(propEq('status', 'active')),
  pluck('name')
);

// ⚠️ Avoid unnecessary lambda wrapping
const getActiveUserNames = (users) => pipe(
  filter(propEq('status', 'active')),
  pluck('name')
)(users);
```

### 4. Common Patterns

#### Data Transformation
```javascript
import { pipe, map, filter, evolve, toUpper, toLower } from 'ramda';

// Transform object properties immutably
const normalizeUser = evolve({
  name: toUpper,
  email: toLower,
  age: parseInt
});

// Process collections
const processUsers = pipe(
  filter(isValid),
  map(normalizeUser),
  sortBy(prop('name'))
);
```

#### Predicates and Filtering
```javascript
import { propEq, propSatisfies, allPass, anyPass } from 'ramda';

// Simple predicates
const isActive = propEq('status', 'active');
const isAdult = propSatisfies(gte(18), 'age');

// Composite predicates
const isActiveAdult = allPass([isActive, isAdult]);
const isSpecialCase = anyPass([isAdmin, isOwner]);
```

## Common Ramda Functions Reference

### Essential Functions
- **Composition**: `pipe`, `compose`, `curry`
- **List Operations**: `map`, `filter`, `reduce`, `find`, `pluck`
- **Object Operations**: `prop`, `path`, `pick`, `omit`, `evolve`
- **Predicates**: `propEq`, `equals`, `gt`, `lt`, `isEmpty`
- **Logic**: `ifElse`, `when`, `unless`, `cond`, `either`, `both`
- **Data**: `groupBy`, `sortBy`, `uniq`, `partition`

### Date Operations (date-fns/fp)
```javascript
import { format, addDays, compareAsc } from 'date-fns/fp';

const formatDate = format('yyyy-MM-dd');
const addWeek = addDays(7);
```

## Anti-Patterns to Avoid

```javascript
// ❌ AVOID: Unnecessary mutation
array.push(item);
object.property = value;

// ❌ AVOID: Classes for business logic
class DataProcessor { }

// ❌ AVOID: Imperative loops for transformations
for (let i = 0; i < array.length; i++) { }

// ❌ AVOID: Imperative if/else for data transformation
if (condition) {
  result = transformA(data);
} else {
  result = transformB(data);
}

// ✅ PREFER: Functional alternatives for data transformation
const newArray = append(item, array);
const newObject = assoc('property', value, object);
const processed = map(transform, array);
const result = ifElse(condition, transformA, transformB)(data);

// ✅ BUT IT'S OK TO: Use imperative code for side effects
async function saveToFile(data) {
  try {
    await writeFile('output.json', JSON.stringify(data));
    console.log('File saved successfully');
  } catch (error) {
    console.error('Failed to save file:', error);
  }
}
```
