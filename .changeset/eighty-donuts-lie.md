---
'@kaito-http/core': major
---

Rewrite entire public API and internals

- Created `init` function which provides `getContext` & `router` functions, rather than having to define them both individually
- Routers now have a response schema, which means we can generate documentation
