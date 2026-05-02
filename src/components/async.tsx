"use client";

import { Suspense, use } from 'react'

// Outer component that wraps in Suspense automatically
export function Async<T>({ promise, fallback, children }: {
	promise: Promise<T>
	fallback?: React.ReactNode
	children: (value: T) => React.ReactNode
}) {
	return (
		<Suspense fallback={fallback ?? <span></span>}>
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

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface AsyncLinkProps extends Omit<React.ComponentProps<typeof Link>, 'href'> {
	href: string | Promise<string>
	pendingHref?: string  // fallback href while promise resolves
}

export function AsyncLink({ href, pendingHref = '#', children, ...props }: AsyncLinkProps) {
	const [resolvedHref, setResolvedHref] = useState<string>(
		typeof href === 'string' ? href : pendingHref
	)

	useEffect(() => {
		if (typeof href !== 'string') {
			console.log(typeof href)
			href.then(setResolvedHref)
		}
	}, [href])

	return (
		<Link href={resolvedHref} {...props}>
			{children}
		</Link>
	)
}
