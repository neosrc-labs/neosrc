"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function Header() {
	const pathname = usePathname();
	const prMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

	const headerRef = useRef(null);

	useEffect(() => {
		const header = headerRef.current;
		if (!header) return;

		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				document.documentElement.style.setProperty(
					"--header-height",
					`${entry.contentRect.height}px`,
				);
			}
		});

		observer.observe(header);
		return () => observer.disconnect();
	}, []);

	return (
		<header
			className="sticky top-0 z-50 border-gray-200 border-b bg-white"
			ref={headerRef}
		>
			<div className="max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center">
					{prMatch && (
						<a
							className="font-medium text-gray-700 text-sm hover:text-gray-900"
							href={`https://github.com/${prMatch[1]}/${prMatch[2]}/pull/${prMatch[3]}`}
							rel="noopener noreferrer"
							target="_blank"
						>
							← Back to GitHub
						</a>
					)}
				</div>
			</div>
		</header>
	);
}
