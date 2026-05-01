"use client";

import FileDiff from "~/components/FileDiff";
import { useFiles } from "~/hooks/files";

interface FilesSectionProps {
	owner: string;
	repo: string;
	number: number;
	commitSha?: string;
}

export function FilesSection({ owner, repo, number, commitSha }: FilesSectionProps) {
	const { files } = useFiles({ owner, repo, number, commitSha });

	return (
		files.map((file) => (
			<FileDiff
				key={file.filename}
				file={file}
				number={number.toString()}
				owner={owner}
				repo={repo}
			/>
		))
	)
}
