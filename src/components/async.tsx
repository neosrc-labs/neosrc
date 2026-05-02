import { Suspense, use } from 'react'

// Outer component that wraps in Suspense automatically
export function Async<T>({ promise, fallback, children }: {
	promise: Promise<T>
	fallback?: React.ReactNode
	children: (value: T) => React.ReactNode
}) {
	return (
		<Suspense fallback={fallback ?? <span>…</span>}>
			<AsyncValue promise={promise}>{children}</AsyncValue>
		</Suspense>
	)
}

// Inner component that "throws" the promise via use()
function AsyncValue<T>({ promise, children }: {
	promise: Promise<T>
	children: (value: T) => React.ReactNode
}) {
	const value = use(promise) // suspends here
	return <>{children(value)}</>
}
