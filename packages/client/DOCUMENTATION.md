# Kaito Client: Your Type-Safe HTTP Companion

The `@kaito-http/client` package is a companion library for `@kaito-http/core`. It provides a type-safe way to interact with your Kaito-powered APIs. Think of it as a strongly typed, convenient wrapper around the standard `fetch` API. It makes it easier to make requests to your API with strong types and predictable results.

## Key Concepts

Here's a breakdown of the main idea behind `@kaito-http/client`:

*   **Type Safety:** The client is designed to infer the types of your API endpoints directly from your Kaito router definitions, providing type-safe requests and responses.
*   **Simplified Requests:** It abstracts away much of the boilerplate of using `fetch`, allowing you to focus on making the actual API calls.
*   **Error Handling:** It provides a standardized way to handle API errors, making it easier to manage responses.
*   **Automatic JSON Handling:** It automatically serializes request bodies to JSON and parses JSON responses.
*   **URL Construction:** Helps with building the final URL by merging base URLs with path variables

## Getting Started

1.  **Installation:**

    ```bash
    npm install @kaito-http/client
    ```

2.  **Basic Usage:**

    First, you'll need a Kaito server to use this client with. If you haven't created one, take a look at the previous documentation for `@kaito-http/core`.

    Then you can create a client for it.

    ```typescript
    import { createKaitoHTTPClient } from '@kaito-http/client';
    import { createUtilities, createKaitoHandler } from '@kaito-http/core';

    // Create a dummy router from the @kaito-http/core package
    const { router, getContext } = createUtilities(async () => ({}));
    const app = router()
        .get('/hello', async () => ({message: 'Hello!' }))
        .post('/users', async (req) => {
            console.log(req)
            return {message: 'New user created'};
        })
        .get('/users/:id', async ({ params }) => ({ message: `User ID: ${params.id}`}));


	// Create a server with the above router

	const server = createKaitoHandler({
		router: app,
		getContext,
		onError: async ({ error }) => {
			console.error('Error:', error);
			return { status: 500, message: 'Something went wrong' };
		},
	});

    // Create the client, matching the above server
    const client = createKaitoHTTPClient({
      base: 'http://localhost:8080',
    });

    async function main() {
        // Make a request using client.get with the inferred types

        const result = await client.get('/hello');
        console.log(result.message)
        // result is {message: string}
        // => Hello!

        const createdUser = await client.post('/users')
        console.log(createdUser.message)
        // createdUser is {message: string}
        // => New user created

        const userId = await client.get('/users/:id', {params: {id: "123"}})
        console.log(userId.message)
		// userId is {message: string}
        // => User ID: 123
    }

    main()
    ```

## Key Components Explained

### `createKaitoHTTPClient`

This function creates a new client for your Kaito API.

*   **`rootOptions`:** An object containing:
    *   **`base`:** The base URL of your API (e.g., `http://localhost:3000/api`).

#### Example: Creating a Client

```typescript
import { createKaitoHTTPClient } from '@kaito-http/client';

const client = createKaitoHTTPClient({
    base: 'https://api.example.com/v1',
});
```

### Request Methods

The client exposes methods for each HTTP method (`get`, `post`, `put`, `patch`, `delete`, `head`, and `options`):

*   **`client.get(path, options)`:** Makes a GET request to the specified path.
*   **`client.post(path, options)`, `client.put(path, options)`, `client.patch(path, options)`, `client.delete(path, options)`:** Similar to `client.get()`, but for the corresponding HTTP methods.
*   **`client.head(path, options)` and `client.options(path, options)`** are also available.

#### The `options` Parameter

The second argument of each method is an `options` object that can contain:

*   **`body`:** The request body (for `POST`, `PUT`, `PATCH` requests).
*   **`params`:**  The path parameters (e.g., `{ id: '123' }` for `/users/:id`).
*   **`query`:** Query parameters.
*   **`signal`:** An AbortSignal, allowing you to cancel the request.
    
    Only required keys need to be provided, all others can be omitted.

#### Example: Making Requests

```typescript
import { createKaitoHTTPClient } from '@kaito-http/client';

interface User {
  id: string;
  name: string;
}

const client = createKaitoHTTPClient({
  base: 'http://localhost:3000/api',
});

async function main() {
  // GET request
  const users = await client.get('/users');
  console.log(users);

  // POST request with a body
  const newUser = await client.post('/users', {
    body: { name: 'John Doe' },
  });

  console.log(newUser);

   // GET request with params
  const user = await client.get('/users/:id', {params: {id: '123'}});
	console.log(user)

  // GET request with query parameters
  const search = await client.get('/users', {query: {q: "john"}});
	console.log(search)
}
```

### Type Inference

The client uses the types from your Kaito router to infer the types of the request options and the response.

*   **Strongly Typed Requests:** You'll get type errors if you provide the wrong data for the request body or path parameters.
*   **Type-Safe Responses:** The client infers the return type based on the handler function from your Kaito route, so the result will always be correct.

#### Example: Type Inference

```typescript
import { createKaitoHTTPClient } from '@kaito-http/client';

const client = createKaitoHTTPClient<{
    '/hello': {GET: {run: () => Promise<{message: string}>}}
}>({
  base: 'http://localhost:3000/api',
});

async function main() {
    const result = await client.get('/hello')

    // result is inferred to be {message: string}

    // @ts-expect-error - shows a type error, `hello` is not a valid property
    console.log(result.hello)
}

```

### Error Handling

The client will throw a `KaitoClientHTTPError` if the API returns an unsuccessful response (i.e., if `response.ok` is false).  It's recommend to use `safe` wrapper to gracefully handle the errors returned from the client, but this is not required.

*   **`KaitoClientHTTPError`:** Contains information about the request, response, and error message from the server.
*   **`safe`:** A wrapper around the client request to handle errors gracefully.

#### Example: Error Handling

```typescript
import { createKaitoHTTPClient, KaitoClientHTTPError, safe } from '@kaito-http/client';

const client = createKaitoHTTPClient({
  base: 'http://localhost:3000/api',
});

async function main() {
  try {
    await client.get('/users/invalid');
  } catch (error) {
    if (error instanceof KaitoClientHTTPError) {
      console.error('API error:', error.message, error.response.status, error.body);
    } else {
      console.error('Other error:', error);
    }
  }


	// Same with the safe wrapper

	const result = await safe(client.get('/users/invalid'), 'There was a client error');

	if (!result.success) {
		console.error('API error:', result.message, result.error);
	} else {
		console.log('Success', result.data)
	}
}
```

## Key takeaways

*   **Type safety:** Never have to guess what the return types of your API calls are again, since it's inferred from your kaito routes.
*   **Simplified requests:** No more wrestling with `fetch` and JSON serialisation, or building URLs.
*   **Reliable error handling:** Consistent, type-safe errors and options for custom fallback messages.
*   **Easy integration:** Works seamlessly with your existing Kaito APIs.

## Next Steps

*   Experiment with different request types and options.
*   Explore more complex data structures with `parsable` in `@kaito-http/core`
*   Use `safe` to provide graceful error handling in your application.
*   Refer to the `@kaito-http/core` documentation for how to define Kaito APIs that work well with the client.

This guide should help you get started with the `@kaito-http/client` package. Have fun creating type-safe web applications!
