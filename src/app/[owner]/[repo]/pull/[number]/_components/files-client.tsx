"use client";

import FileDiff from "~/components/FileDiff";
import { useFiles } from "~/hooks/files";
import { api } from "~/trpc/react";

interface FilesSectionProps {
	owner: string;
	repo: string;
	number: number;
	commitSha?: string;
}

export function FilesSection({
	owner,
	repo,
	number,
	commitSha,
}: FilesSectionProps) {
	const { files } = useFiles({ owner, repo, number, commitSha });

	const { data: allComments = [] } = api.reviewComments.list.useQuery(
		{ owner, repo, number },
		{ staleTime: 30_000 },
	);

	return files.map((file) => {
		const fileComments = allComments.filter((c) => c.path === file.filename);

		return (
			<FileDiff
				comments={fileComments}
				file={file}
				key={file.filename}
				number={number.toString()}
				owner={owner}
				repo={repo}
			/>
		);
	});
}
