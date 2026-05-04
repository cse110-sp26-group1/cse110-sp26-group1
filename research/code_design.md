# Code Design Practices and Team Coding Standard

## Code Design Practice

Code design practice is the disciplined process of planning, structuring, writing, reviewing, and improving code so that a software system is easy to understand and safe to change. It includes both high-level design decisions, such as how modules communicate, and low-level decisions, such as how functions, names, comments, errors, and tests are written.

Good code design does not mean designing every detail before coding. It also does not mean skipping design and hoping the code becomes organized later. A strong team uses little design up front, then improves the design continuously through implementation, review, testing, and refactoring.

In practical terms, code design practice asks questions like:

- What problem is this code responsible for solving?
- What should be separated into different modules, classes, or functions?
- What parts of the system are likely to change?
- How can this code be made easier for another developer to read?
- How can we test this behavior?
- How can we reduce unnecessary complexity?

---

## Importance

Poorly designed code slows down a project over time. Even if messy code works at first, it becomes harder to modify, debug, test, and extend. This creates technical debt: the team moves faster today but pays for it later through bugs, delays, and difficult maintenance.

Good code design provides several benefits:

| Benefit | Why It Matters |
|---|---|
| Readability | Developers can understand the code without guessing. |
| Maintainability | Bugs and changes can be handled without rewriting large areas. |
| Reusability | Useful parts of the system can be reused in other places. |
| Testability | Code can be verified through unit, integration, and acceptance tests. |
| Lower complexity | The system is easier to reason about and less likely to break unexpectedly. |
| Team consistency | Code written by different developers looks and behaves like one unified codebase. |

A useful way to think about clean code is this: code should look like it was written by someone who cared. It should be simple, direct, tested, and understandable by someone other than the original author.

---

## Core Principles of Good Code Design

### Keep Code Simple

The team should prefer simple, understandable solutions over clever or overly complex ones. A solution is not better because it uses advanced techniques. It is better when it solves the problem clearly and safely.

### Manage Complexity

The main purpose of design is to control complexity. Large systems should be divided into smaller parts with clear responsibilities.

Use separation of concerns:

- User interface code should not contain business rules.
- Business logic should not depend directly on database details.
- Utility functions should not know about application-specific workflows.
- Configuration should be separated from core logic.

### Use Loose Coupling

Modules, classes, and functions should depend on each other as little as possible. When one part of the system changes, unrelated parts should not break.

- A module should expose only what other parts of the system need and hide everything else.

### Aim for High Cohesion

A class, function, or module should have a focused purpose. Related behavior should stay together. Unrelated behavior should be separated.

- If a file or function is doing many unrelated things, split it.

### Design for Change

Assume requirements will change. Design should make common changes easy and safe.

Good ways to design for change include:

- Isolate external services behind interfaces or wrapper modules.
- Keep business rules separate from framework code.
- Avoid hardcoding values that are likely to change.
- Use tests to protect behavior during refactoring.

### Design for Testing

Code that is hard to test is often poorly designed. Testable code usually has smaller functions, clearer dependencies, and fewer hidden side effects.

- New production code should try to be written with automated testing in mind.

### Refactor Continuously

Design is not finished after the first plan. The team should improve the design as it learns more about the project.

- Try to use the **Boy Scout Rule** when you can: leave the code cleaner than you found it.

---

## Levels of Code Design

The team should think about design at five levels.

### System Design

This is the design of the whole application. It includes the main architecture, major technologies, deployment approach, and external integrations.

### Subsystem or Package Design

This level divides the system into major areas, such as authentication, database access, user interface, business rules, reporting, or API communication.

### Class or Component Design

This level decides what each class, component, or module is responsible for.

### Function or Method Design

This level focuses on what each function does, what inputs it accepts, what output it returns, and whether it has side effects.

### Internal Code Design

This level includes the actual lines of code: naming, formatting, control flow, comments, error handling, and tests.

---

## General Rules

- Code must be readable before it is considered complete.
- Code must be tested before it is merged.
- Code must follow the team's formatting and naming conventions.
- Code must avoid unnecessary complexity.
- Code must be reviewed by at least one other team member before merging.
- Code should be refactored when it becomes difficult to understand.
- Code should not contain unused, duplicated, or commented-out sections.

---

## Naming Conventions

Names should explain purpose. A reader should understand why a variable, function, class, or file exists without needing extra explanation.

### Variables

Use meaningful names.

```js
// Good
let totalPrice = itemPrice * quantity;

// Bad
let tp = ip * q;
```

### Functions

Function names should describe actions. Use verbs or verb phrases.

```js
// Good
calculateTotalPrice()
validateUserInput()
fetchOrderHistory()

// Bad
price()
input()
data()
```

So we all stick to a consistent formatting, let's stick to K&R style for brackets:

```js
if(condition){
    // code
}
function func(){
    // code 
}
```

### Classes and Components

Class and component names should be nouns or noun phrases.

```js
// Good
UserProfile
PaymentProcessor
OrderRepository

// Bad
Process
DataThing
ManagerStuff
```

### Constants

Use uppercase with underscores for true constants.

```js
const MAX_LOGIN_ATTEMPTS = 5;
const DEFAULT_PAGE_SIZE = 20;
```

### Boolean Values

Boolean names should sound true or false.

```js
// Good
isLoggedIn
hasPermission
canSubmitForm

// Bad
login
permission
submit
```

### Team Naming Rules

- Do not use single-letter names except for short loop counters.
- Do not use vague names like `data`, `info`, `stuff`, `thing`, or `temp` unless the meaning is obvious in a very small scope.
- Use one word per concept. For example, do not mix `get`, `fetch`, `retrieve`, and `load` unless the team defines different meanings for each.
- Avoid misleading names. A variable named `userList` should actually be a list of users.
- Avoid jokes, slang, and overly clever names.

---

## Formatting Standard

Formatting should make the structure of the code obvious.

### Indentation

- Use consistent indentation across the project.
- Recommended standard: **2 spaces** for JavaScript, TypeScript, HTML, CSS, and JSON; **4 spaces** for Python. (If the team prefers tabs instead, we can still do that, we just need to make sure we stay consistent.)
- Never mix tabs and spaces in the same project.

### Line Length

- Recommended maximum line length: **80 characters**.
- Break long expressions into multiple lines.

### Spacing

Use spaces to separate ideas clearly.

```js
// Good
const total = price + tax;

// Bad
const total=price+tax;
```

### File Organization

Each source file should follow this order when applicable:

- Imports or dependencies
- Constants
- Types, interfaces, or schemas
- Main class, component, or exported function
- Helper functions
- Exports

### Team Formatting Rules

- Use an automatic formatter when available.
- Do not manually reformat unrelated code in a pull request.
- Keep related code close together.
- Separate unrelated sections with blank lines.
- Avoid large files. If a file becomes difficult to navigate, split it by responsibility.

---

## Function and Method Standard

Functions should be small, focused, and easy to read.

### Function Rules

- A function should do one thing.
- A function should have a clear name.
- A function should avoid side effects unless the side effect is clear from the name.
- A function should prefer returning values instead of changing external state.
- A function should avoid long parameter lists.
- A function should not mix different levels of abstraction.

### Function Length

As a team guideline:

- Preferred function length: **5 to 25 lines**.
- If a function grows beyond **40 lines**, review whether it should be split.
- *Long functions are allowed when splitting them would make the code less clear.*

### Function Arguments

- Prefer 0 to 2 parameters.
- Use 3 parameters only when needed.
- Avoid more than 3 parameters; use an object or data structure instead.

```js
// Good
createUser({ name, email, role });

// Bad
createUser(name, email, role, age, status, department, location);
```

### Avoid Flag Arguments

A flag argument often means a function is doing more than one thing.

```js
// Bad
renderUser(user, true);

// Good
renderEditableUser(user);
renderReadOnlyUser(user);
```

---

## Class, Module, and Component Standard

Classes and modules should be small and responsible for one main concept.

### Class and Module Rules

- Each class or module should have one clear responsibility.
- Internal data should be hidden when possible.
- Public methods should form a small, clear interface.
- Classes should depend on abstractions or interfaces when practical.
- Avoid large "manager" or "god" classes that control too many responsibilities.

### Module Boundaries

Use boundaries to protect the project from external changes.

Examples:

- Wrap third-party API calls in a service module.
- Keep database-specific logic in repository or data-access modules.
- Keep validation logic separate from UI rendering.

---

## Commenting Standard

Comments should explain why code exists, not restate what the code already says.

### Good Uses of Comments

Use comments for:

- Explaining business rules that are not obvious.
- Explaining the reason behind an unusual decision.
- Warning about important consequences.
- Marking temporary work with a clear `TODO` and owner.
- Documenting public APIs when needed.

```js
// Good: explains why
// Payments are retried only twice because the provider may lock the account after repeated failures.
const MAX_PAYMENT_RETRIES = 2;
```

### Bad Uses of Comments

Avoid comments that repeat the code.

```js
// Bad: repeats what the code says
// Add one to count
count = count + 1;
```

### Team Comment Rules

- Do not leave commented-out code in the repository.
- Do not use comments to excuse unclear code. Improve the code first.
- Every `TODO` must include a reason and owner.

```js
// TODO(Jane): Replace mock payment provider after API credentials are approved.
```

---

## Error Handling Standard

Error handling should be clear and consistent. It should not hide the main logic of the program.

### Error Handling Rules

- Handle errors close to where they can be understood.
- Provide useful error messages.
- Do not silently ignore errors.
- Do not expose sensitive information in user-facing error messages.
- Prefer exceptions or structured error objects over unclear return codes.
- Validate inputs at system boundaries.
- Log errors with enough context to debug them.

```js
// Good
if (!email.includes("@")) {
  throw new ValidationError("Email address is invalid.");
}
```

### Null and Undefined

- Do not return `null` unless it is an expected and documented result.
- Avoid passing `null` into functions.
- Prefer empty arrays, default objects, or explicit optional types where appropriate.

---

## Testing Standard

Code is not complete until it has appropriate tests.

### Required Test Types

| Test Type | Purpose |
|---|---|
| Unit tests | Test small functions, classes, or modules in isolation. |
| Integration tests | Test interaction between modules, databases, APIs, or services. |
| End-to-end tests | Test important user workflows. |

### Unit Test Rules

Tests should be:

- **Fast**: They should run quickly.
- **Independent**: One test should not depend on another test.
- **Repeatable**: Tests should give the same result every time.
- **Self-validating**: Tests should clearly pass or fail.
- **Timely**: Tests should be written close to the production code they test.

### Test Naming

Test names should describe expected behavior.

```js
// Good
it("returns an error when the email address is invalid", () => {})

// Bad
it("test email", () => {})
```

### Team Testing Rules

- Every new feature must include tests.
- Every bug fix should include a regression test when practical.
- Do not skip or delete failing tests without team agreement.
- Tests should be readable and maintained like production code.
- Pull requests should not be merged if required tests fail.

---

## Duplication Standard

Duplication makes code harder to change because the same idea must be updated in multiple places.

### Duplication Rules

- Do not copy and paste logic across files.
- Extract repeated logic into a shared function, class, or module.
- Do not over-abstract too early. Extract duplication when the repeated code clearly represents the same concept.
- Shared code must have a clear owner or location.

---

## Security and Data Handling Standard

Security should be part of code design, not an afterthought.

### Security Rules

- Never commit passwords, API keys, or tokens.
- Store secrets in environment variables or secret-management tools.
- Validate and sanitize external input.
- Use parameterized queries for database access.
- Do not log sensitive data such as passwords, tokens, or personal information.
- Apply least privilege when accessing files, databases, or services.
- Review dependencies before adding them.

---

## Version Control Standard

### Branching

Use short-lived feature branches.

Recommended branch names:

```txt
feature/user-login
fix/payment-validation
refactor/order-service
chore/update-dependencies
```

### Commit Messages

Use clear commit messages that explain the change.

Recommended format:

```txt
type: short description
```

Examples:

```txt
feat: add user login validation
fix: prevent duplicate order submission
refactor: split payment service responsibilities
```

### Pull Request Rules

Every pull request should include:

- A short summary of the change.
- A reason for the change.
- Screenshots or examples when user-facing behavior changes.
- Test results or explanation of testing done.
- Notes about risks, limitations, or follow-up work.

---

## Code Review Standard

Code review is a quality practice, not a criticism of the developer.

### Reviewers Should Check

- Is the code easy to understand?
- Does the code solve the correct problem?
- Are names meaningful?
- Are functions small and focused?
- Is there unnecessary duplication?
- Are errors handled clearly?
- Are tests included and useful?
- Does the code follow the team standard?
- Could the design be simpler?

### Authors Should

- Keep pull requests small when possible.
- Explain important design decisions.
- Respond professionally to feedback.
- Update code based on agreed review comments.

---

## Documentation Standard

Documentation should help future developers understand the project quickly.

Each project should include:

- `README.md` with setup instructions.
- Environment variable documentation.
- How to run tests.
- How to start the application locally.
- Basic architecture overview.
- API documentation if the project exposes endpoints.
- Known limitations or future improvements.

Documentation should be updated in the same pull request as the code change when behavior changes.

---

# Quick Checklist for Developers

Before submitting code, each developer should ask:

- Can another team member understand this code quickly?
- Does each function do one clear thing?
- Are names meaningful and consistent?
- Is there duplicate logic that should be extracted?
- Are errors handled properly?
- Are tests included?
- Did I remove debugging code, unused code, and commented-out code?
- Did I update documentation if needed?
- Did I leave the code cleaner than I found it?


---

# References

- Robert C. Martin, *Clean Code: A Handbook of Agile Software Craftsmanship*, Pearson, 2008/2009.
- Douglas Rocha, "Code Design Guidelines," Medium, February 20, 2024. https://medium.com/@douglas.rochedo/code-design-guidelines-dffb6548ab42
- GeeksforGeeks, "Coding Standards and Guidelines," last updated May 23, 2024. https://www.geeksforgeeks.org/software-engineering/coding-standards-and-guidelines/