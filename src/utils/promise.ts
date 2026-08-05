// These const's are to avoid calling Promise.resolve() instead of a component.
// It can cause subtle, hard to debug issues since the can take a split second to resolve.

export const EMPTY_ARRAY_PROMISE = Promise.resolve([]);
export const NULL_PROMISE = Promise.resolve(null);
