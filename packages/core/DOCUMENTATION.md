# Kaito Core: Your Friendly HTTP Framework

`kaito-core` is a lightweight and functional framework for building HTTP APIs with TypeScript. It emphasizes type safety and a simple, composable approach. Think of it as a toolbox for creating well-structured, easily maintainable web services.

## Core Concepts

Let's break down the key ideas behind `kaito-core`:

*   **Routers:**  The heart of `kaito-core` is the `Router`.  It's how you organize your API endpoints. You define routes with specific paths and HTTP methods (GET, POST, etc.).
*   **Routes:** A route is a specific endpoint (e.g., `/users`, `/products/:id`). Each route has a handler (a function) that processes the request and returns a response.
*   **Context:** Each request flows through a context, which can be anything your application needs.  This is where you'd put things like database connections, authentication information, and more.  Kaito makes it easy to transform this context as it passes through layers of your application.
*   **Parsables:** These are objects used to parse and validate data, like query parameters or request bodies.  They make sure you get the data in the format you expect.
*   **Server:**  The server brings it all together. You configure it with your router, how to build context for each request, and error handling.
*   **Error Handling:** `Kaito` lets you catch and handle errors gracefully, providing consistent JSON responses with helpful messages.

## Getting Started

1.  **Installation:**

    ```bash
    npm install @kaito-http/core
    ```

2.  **Basic Usage:**

    Here's the most basic example to get you going:
    ```ts
    import { createKaitoHandler, createUtilities } from '@kaito-http/core';

    // Create a context builder which returns a basic context
    const { router, getContext } = createUtilities(async () => {
        return {
            // Your context properties here
            foo: 'bar',
            time: Date.now()
        }
    });


    // Create a new router
    const app = router()
        .get('/', async ({ctx}) => {
          // ctx is what we defined in createUtilities
            return {
                hello: 'world',
                bar: ctx.foo,
                time: ctx.time
            }
        });


    // Create the server
    const server = createKaitoHandler({
        router: app,
        getContext,
        onError: async ({ error }) => {
            console.error('Error:', error);
            return { status: 500, message: 'Something went wrong' };
        },
    });


    // Make it runnable
    addEventListener('fetch', (event) => {
        event.respondWith(server(event.request));
    });
    ```

## Key Components Explained

### Router

The router is your app's roadmap. Here's how to use it:

*   **`Router.create()`:**  Creates a new router with an initial context.
*   **`.get(path, handler)`:** Defines a GET request handler for a path.
*   **`.post(path, handler)`, `.put(path, handler)`, `.patch(path, handler)`, `.delete(path, handler)`:** Similar to `.get()`, but for the corresponding HTTP methods.
*   **`.merge(prefix, otherRouter)`:** Mounts another router under a prefix (useful for nested APIs).
*   **`.through(transform)`:** Transforms the context as it passes through the router.
*   **`.freeze(serverConfig)`:** Creates the actual request handler function used by the server (usually not used by a user).

#### Example: Router with Multiple Routes

```ts
import { createUtilities } from '@kaito-http/core';

const {router} = createUtilities(async () => ({}));

const app = router()
  .get('/hello', async () => 'Hello!')
  .post('/users', async (req) => {
      console.log(req)
      return 'New user created';
  })
  .get('/users/:id', async ({ params }) => `User ID: ${params.id}`);

```

#### Example: Merging Routers

```ts
import { createUtilities } from '@kaito-http/core';
const {router} = createUtilities(async () => ({}));

const userRoutes = router()
  .get('/list', async () => 'List of users')
  .get('/:id', async ({ params }) => `User: ${params.id}`);

const app = router().merge('/users', userRoutes);
```

### Route Handlers

Route handlers are asynchronous functions that receive an argument containing:

*   **`ctx`:** Your context object.
*   **`body`:** The request body (parsed if a body schema is provided).
*   **`query`:** The parsed query parameters (if a schema is provided).
*   **`params`:**  The dynamic path parameters (e.g., `id` in `/users/:id`).

#### Example: Accessing Context and Parameters

```ts
import { createUtilities } from '@kaito-http/core';

const {router, getContext} = createUtilities(async () => ({userId: '123'}));


const app = router().get('/profile/:id', async ({ ctx, params }) => {
    console.log(ctx.userId);
    return `Profile for user ${params.id}`;
});
```

### Parsables

Parsables define how to parse and validate data:

*   **`parsable(parseFunction)`:** Creates a parsable object from a parse function.
*   You can define parse functions for strings, numbers, booleans, or more complex objects, using a validation library if necessary.

#### Example: Using Parsables

```ts
import { parsable, createUtilities } from '@kaito-http/core';
const {router} = createUtilities(async () => ({}));

const stringParser = parsable((value: unknown) => {
    if (typeof value !== 'string') {
        throw new Error('Not a string');
    }
  return {hello: value}
})

const app = router()
    .post('/example', {
        body: stringParser,
        query: {
            name: stringParser
        },
        run: async ({body, query}) => {
          console.log(body.hello, query.name.hello);
          return "ok"
        }
    });
```

### Server Configuration

The `createKaitoHandler` function creates a request handler based on your server config. You need to provide a router, a context function and error handler.  `before` and `after` hooks are also available.

*   **`getContext`:**  A function that gets the context for every request.
*   **`onError`:**  A function to handle any errors that occur during request processing.

#### Example: Server Configuration

```ts
import { createKaitoHandler, createUtilities } from '@kaito-http/core';

const {router, getContext} = createUtilities(async () => ({foo: 'bar'}));

const app = router().get('/test', async ({ctx}) => {
	return ctx.foo;
});

const server = createKaitoHandler({
    router: app,
    getContext,
    onError: async ({ error }) => {
        console.error('Error:', error);
        return { status: 500, message: 'Something went wrong' };
    },
});

addEventListener('fetch', (event) => {
	event.respondWith(server(event.request));
});
```

## Error Handling

`Kaito` provides a way to handle errors that may occur during your request processing:

*   **`KaitoError`:** Use this to throw custom errors.
*   The `onError` callback in `createServer` can catch thrown errors (including `KaitoError`).
*   You can customize error messages and HTTP status codes in the `onError` callback.

## Key takeaways

*   **Composability:**  Routers are composable, making it easy to organize your API into logical modules.
*   **Type Safety:**  `Kaito` uses TypeScript to ensure type safety and reduce runtime errors.
*   **Flexibility:**  You have full control over the context, data parsing, and error handling.
*   **Simplicity:** `Kaito` aims for a simple, functional, and unpretentious developer experience.

## Next Steps

*   Dive into the source code itself. It's well-commented and easy to follow.
*   Try creating more complex APIs using the various features.
*   Explore using validation libraries to enhance your parsables.
*   Check out the [documentation link](https://kaito.cloud) provided in the README for more detailed information.

This guide should provide a good start to using `kaito-core`. Don't hesitate to explore the source code and start building awesome APIs!  Happy coding!
