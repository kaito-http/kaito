# Types

## `KaitoRequest`

This is the request object, not too dissimilar from express' `Request`.

Right now, there are not a lot of utility properties. You can access the underlying data with `req#raw`.
This is the raw `IncomingMessage` object.

You can also import the alias `KRQ` (which is the exact same type, inc. generics).

## `KaitoResponse`

This is the response object, however we plan to deprecate it once an "MVP" is working in favour of returning objects
and async methods.

Right now, you don't even have to use this type as the following is totally valid:

```typescript
@Controller("/")
class UserController {
  @Get("/")
  async getAllUsers() {
    return await db.users.find();
  }
}
```

You could even omit the `async/await` syntax here and simply return the promise that `db#users#find` would return. For example

```typescript
getAllUsers() {
  return db.users.find();
}
```

Finally, the raw response object (`ServerResponse`) is also available as `res#raw` - the same as the request object.

You can also import the alias `KRS` (which is the exact same type, inc. generics).

## `RequestHandler`

You shouldn't need to use this type too often, unless you are writing an interface that a class can implement.
We plan to ship some built in interfaces in the future that will allow to strongly type controllers, but for now,
`RequestHandler` is simply the method (or function) definition for a function that takes `req, res` and returns a
`Promise` or nothing. This type is not aliased.
