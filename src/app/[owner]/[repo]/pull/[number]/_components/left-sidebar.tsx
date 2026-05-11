import { Suspense } from "react";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import {
	LeftSidebarContentSection,
	SidebarActionButtons,
	SidebarNavMenu,
} from "./left-sidebar-client";

interface LeftSidebarProps {
	owner: string;
	repo: string;
	number: number;
	checksPromise: Promise<Array<CheckRun>> | null;
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
		<aside className="flex h-full flex-col border-gray-200 border-r bg-white px-4 py-6 pr-1 dark:border-zinc-800 dark:bg-zinc-950">
			<SidebarNavMenu number={number} owner={owner} repo={repo} />

			{/* Checks or File Tree Section */}
			<div className="min-h-0 flex-1 border-gray-200 border-t pt-4 pr-0 dark:border-zinc-800">
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

			<SidebarActionButtons
				number={number}
				owner={owner}
				pullRequestPromise={pullRequestPromise}
				repo={repo}
			/>
		</aside>
	);
}
