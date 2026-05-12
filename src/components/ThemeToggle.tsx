"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

const themes = [
	{ key: "system", label: "System", icon: SystemIcon },
	{ key: "light", label: "Light", icon: SunIcon },
	{ key: "dark", label: "Dark", icon: MoonIcon },
] as const;

export function ThemeToggle() {
	const { theme, resolvedTheme, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [open]);

	const selected = themes.find((t) => t.key === theme) ?? themes[0];
	const resolved =
		resolvedTheme === "dark"
			? themes.find((t) => t.key === "dark")!
			: themes.find((t) => t.key === "light")!;
	const CurrentIcon = theme === "system" ? resolved.icon : selected.icon;

	return (
		<div className="relative" ref={menuRef}>
			<button
				className="flex cursor-pointer items-center justify-center rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				onClick={() => setOpen(!open)}
				type="button"
				title={mounted ? `Theme: ${selected.label}` : undefined}
			>
				{mounted ? (
					<CurrentIcon />
				) : (
					<span className="h-5 w-5 rounded bg-gray-200 dark:bg-zinc-700" />
				)}
			</button>

			{open && (
				<div className="absolute right-0 z-50 mt-1 min-w-32 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
					{themes.map(({ key, label, icon: Icon }) => (
						<button
							className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
								theme === key
									? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-gray-100"
									: "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
							}`}
							key={key}
							onClick={() => {
								setTheme(key);
								setOpen(false);
							}}
							type="button"
						>
							<Icon />
							{label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function SunIcon() {
	return (
		<svg
			className="h-5 w-5"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			viewBox="0 0 24 24"
		>
			<title>Light mode</title>
			<path
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg
			className="h-5 w-5"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			viewBox="0 0 24 24"
		>
			<title>Dark mode</title>
			<path
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function SystemIcon() {
	return (
		<svg
			className="h-5 w-5"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			viewBox="0 0 24 24"
		>
			<title>System theme</title>
			<path
				d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
