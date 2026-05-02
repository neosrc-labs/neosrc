import { Suspense } from "react";
import type { PullsGetResponseData } from "~/server/github";
import {
	LeftSidebarContentSection,
	SidebarNavMenu,
} from "./left-sidebar-client";

interface LeftSidebarProps {
	owner: string;
	repo: string;
	number: number;
	checksPromise: Promise<
		Array<{
			name: string;
			conclusion: string | null;
			status: string;
			html_url?: string;
		}>
	> | null;
	pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export default function LeftSidebar({
	owner,
	repo,
	number,
	checksPromise,
	pullRequestPromise,
}: LeftSidebarProps) {
	return (
		<aside className="flex h-full flex-col border-gray-200 border-r bg-white px-4 py-6 pr-1">
			<SidebarNavMenu number={number} owner={owner} repo={repo} />

			{/* Checks or File Tree Section */}
			<div className="min-h-0 flex-1 border-gray-200 border-t pt-4 pr-0">
				<Suspense>
					<LeftSidebarContentSection
						checksPromise={checksPromise}
						number={number}
						owner={owner}
						pullRequestPromise={pullRequestPromise}
						repo={repo}
					/>
				</Suspense>
			</div>

			<SidebarActionButtons />
		</aside>
	);
}

function SidebarActionButtons() {
	return (
		<div className="sticky bottom-0 z-10 space-y-2 border-gray-200 border-t bg-white pt-6 pr-4">
			<button
				className="w-full rounded-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:opacity-50"
				disabled
				type="button"
			>
				Approve
			</button>
			<button
				className="w-full rounded-md bg-[#cf222e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#b91c23] disabled:opacity-50"
				disabled
				type="button"
			>
				Request Changes
			</button>
			<button
				className="w-full rounded-md bg-[#8250df] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#6e40c9] disabled:opacity-50"
				disabled
				type="button"
			>
				Merge
			</button>
		</div>
	);
}
