import type { DatabaseSync, StoreOperations, StoreSync } from '@hesprs/sync-engine-sdk';

function createStore<T>(): StoreSync<T> {
	const map = new Map<string, T>();
	return {
		batch: (operations: Array<StoreOperations<T>>) => {
			const results: Array<{ key: string; value: T | undefined }> = [];
			for (const operation of operations)
				if (operation.type === 'get')
					results.push({ key: operation.key, value: map.get(operation.key) });
				else if (operation.type === 'set') map.set(operation.key, operation.value);
				else map.delete(operation.key);
			return results;
		},
		clear: () => map.clear(),
		delete: (key) => {
			map.delete(key);
		},
		entries: () => [...map.entries()],
		get: (key) => map.get(key),
		keys: () => [...map.keys()],
		set: (key, value) => {
			map.set(key, value);
		},
		values: () => [...map.values()],
	};
}

export default function openMemoryDB<
	D extends Record<string, unknown>,
	M extends Record<string, unknown>,
>(): DatabaseSync<D, M> {
	const stores = new Map<string, StoreSync>();
	const meta: Partial<M> = {};
	return {
		clearStores: () => stores.clear(),
		deleteStore: (name) => {
			stores.delete(name);
		},
		dispose: () => {},
		getMeta: (key) => meta[key],
		getStore: <K extends keyof D>(name: K) => {
			const storeName = String(name);
			let store = stores.get(storeName);
			if (!store) {
				store = createStore<D[K]>();
				stores.set(storeName, store);
			}
			return store as StoreSync<D[K]>;
		},
		getStoreNames: () => [...stores.keys()],
		setMeta: (key, value) => {
			meta[key] = value;
		},
	};
}
