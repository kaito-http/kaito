/**
 * An immutable variant of the native `Set` class where all mutating operations
 * return new instances instead of modifying the original set.
 *
 * @template T - The type of elements in the set
 *
 * @example
 * ```typescript
 * const set1 = new ImmutableSet(['a', 'b']);
 * const set2 = set1.add('c');
 *
 * console.log([...set1]); // ['a', 'b']
 * console.log([...set2]); // ['a', 'b', 'c']
 * ```
 */
export class ImmutableSet<T> {
	/**
	 * Internal Set instance used for storage
	 * @private
	 */
	private readonly set = new Set<T>();

	/**
	 * A shared empty immutable set instance. Using `never` type ensures
	 * it can be safely cast to ImmutableSet<T> for any T.
	 *
	 * @example
	 * ```typescript
	 * const emptyStrings = ImmutableSet.Empty as ImmutableSet<string>;
	 * const emptyNumbers = ImmutableSet.Empty as ImmutableSet<number>;
	 * ```
	 *
	 * You can also use this
	 */
	public static readonly Empty = new ImmutableSet<never>();

	/**
	 * Creates a new ImmutableSet instance, optionally from an iterable
	 *
	 * This is perfect for usage with `useState` as React calls the `.from()` function
	 * when initializing the state, but TypeScript lets us set the generic type
	 * inline.
	 *
	 * ```typescript
	 * const [set, setState] = useState(ImmutableSet.from<string>);
	 * ```
	 *
	 * @param iterable - Optional iterable of initial values
	 * @returns A new ImmutableSet instance
	 */
	public static from = <T>(iterable?: Iterable<T>) => new ImmutableSet(iterable);

	/**
	 * Creates a new ImmutableSet instance
	 *
	 * @param iterable - Optional iterable of initial values
	 *
	 * @example
	 * ```typescript
	 * const set1 = new ImmutableSet(['a', 'b', 'c']);
	 * const set2 = new ImmutableSet(new Set([1, 2, 3]));
	 * const empty = new ImmutableSet<string>();
	 * ```
	 */
	public constructor(iterable?: Iterable<T>) {
		this.set = new Set(iterable);
	}

	/**
	 * Internal helper method for creating new instances when performing
	 * mutations. This ensures immutability while allowing reuse of logic.
	 *
	 * @param fn - Function that performs the mutation on the cloned set
	 * @returns A new ImmutableSet instance with the mutation applied
	 * @private
	 */
	private mutate(fn: (set: Set<T>) => void) {
		const clone = new ImmutableSet(this.set);
		fn(clone.set);
		return clone;
	}

	/**
	 * Creates a new set with the specified value added
	 *
	 * @param value - The value to add
	 * @returns A new ImmutableSet containing the added value
	 *
	 * @example
	 * ```typescript
	 * const set1 = new ImmutableSet(['a', 'b']);
	 * const set2 = set1.add('c');
	 * console.log([...set2]); // ['a', 'b', 'c']
	 * console.log(set1 === set2); // false
	 * ```
	 */
	public add(value: T) {
		return this.mutate(set => {
			set.add(value);
		});
	}

	/**
	 * Creates a new empty set, discarding all current values
	 *
	 * @returns The empty ImmutableSet singleton instance
	 *
	 * @example
	 * ```typescript
	 * const set1 = new ImmutableSet(['a', 'b']);
	 * const set2 = set1.clear();
	 * console.log(set2.size); // 0
	 * console.log(set2 === ImmutableSet.Empty); // true
	 * ```
	 */
	public clear() {
		return ImmutableSet.Empty;
	}

	/**
	 * Creates a new set with the specified value removed
	 *
	 * @param value - The value to remove
	 * @returns A new ImmutableSet with the value removed
	 *
	 * @example
	 * ```typescript
	 * const set1 = new ImmutableSet(['a', 'b', 'c']);
	 * const set2 = set1.delete('b');
	 * console.log([...set2]); // ['a', 'c']
	 * console.log(set1.has('b')); // true
	 * ```
	 */
	public delete(value: T) {
		return this.mutate(set => {
			set.delete(value);
		});
	}

	/**
	 * Executes a callback for each value in the set
	 *
	 * @param callbackfn - Function to execute for each value
	 * @param thisArg - Value to use as `this` when executing the callback
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b', 'c']);
	 * const results: string[] = [];
	 * set.forEach(value => results.push(value.toUpperCase()));
	 * console.log(results); // ['A', 'B', 'C']
	 * ```
	 */
	public forEach(callbackfn: (value: T, value2: T) => void, thisArg?: unknown): void {
		return this.set.forEach(callbackfn, thisArg);
	}

	/**
	 * Toggles a value in the set, adding it if it doesn't exist or removing it if it does
	 *
	 * @param value - The value to toggle
	 * @returns A new ImmutableSet with the value toggled
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * const set2 = set.toggle('c');
	 * console.log([...set2]); // ['a', 'b', 'c']
	 * ```
	 *
	 * This is super helpful with React state management because the methods return a new instance
	 * and it means React knows the state has changed.
	 *
	 * ```tsx
	 * const [state, setState] = useState(ImmutableSet.from<string>)
	 * <button onClick={() => setState(old => old.toggle('c'))}>Toggle c</button>
	 * ```
	 */
	public toggle(value: T) {
		return this.has(value) ? this.delete(value) : this.add(value);
	}

	/**
	 * Checks if a value exists in the set
	 *
	 * @param value - The value to check
	 * @returns `true` if the value exists, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * console.log(set.has('a')); // true
	 * console.log(set.has('c')); // false
	 * ```
	 */
	public has(value: T): boolean {
		return this.set.has(value);
	}

	/**
	 * Returns an iterator of [value, value] pairs
	 *
	 * @returns An iterator containing pairs of values
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * for (const [value1, value2] of set.entries()) {
	 *   console.log(value1 === value2); // true
	 * }
	 * ```
	 */
	public entries(): SetIterator<[T, T]> {
		return this.set.entries();
	}

	/**
	 * Returns an iterator of values (identical to values())
	 *
	 * @returns An iterator containing the values
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * const keys = [...set.keys()];
	 * console.log(keys); // ['a', 'b']
	 * ```
	 */
	public keys(): SetIterator<T> {
		return this.set.keys();
	}

	/**
	 * Returns an iterator of values
	 *
	 * @returns An iterator containing the values
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * const values = [...set.values()];
	 * console.log(values); // ['a', 'b']
	 * ```
	 */
	public values(): SetIterator<T> {
		return this.set.values();
	}

	/**
	 * Implements the iterable protocol, allowing the set to be used with for...of loops
	 *
	 * @returns An iterator containing the values
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * for (const value of set) {
	 *   console.log(value); // 'a', then 'b'
	 * }
	 * ```
	 */
	[Symbol.iterator](): SetIterator<T> {
		return this.set[Symbol.iterator]();
	}

	/**
	 * Customizes the string tag for the ImmutableSet instance
	 * Used in Object.prototype.toString.call(immutableSet)
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet();
	 * console.log(Object.prototype.toString.call(set)); // '[object ImmutableSet]'
	 * ```
	 */
	public get [Symbol.toStringTag]() {
		return 'ImmutableSet';
	}

	/**
	 * Returns the number of values in the set
	 *
	 * @example
	 * ```typescript
	 * const set = new ImmutableSet(['a', 'b']);
	 * console.log(set.size); // 2
	 * ```
	 */
	public get size() {
		return this.set.size;
	}
}
