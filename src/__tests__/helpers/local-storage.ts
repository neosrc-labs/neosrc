// jsdom in this vitest setup exposes no working window.localStorage (Node's
// experimental localStorage is unavailable without --localstorage-file), so
// back it with an in-memory stand-in that behaves like a real Storage.
export function installLocalStorage(): Storage {
    let store = new Map<string, string>();
    const storage = {
        get length() {
            return store.size;
        },
        clear: () => {
            store = new Map();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, String(value));
        },
    } as Storage;
    Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: storage,
    });
    return storage;
}
