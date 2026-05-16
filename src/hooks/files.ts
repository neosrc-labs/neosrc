import { useEffect, useState } from "react";
import type { PullRequestFile } from "~/server/github";

interface UseFilesParams {
	owner: string;
	repo: string;
	number: number;
	commitSha?: string;
}

// NOTE: Even if `isLoading` is `true` we may have a partially complete list of files already.
//       Depending on the UI element, we can either wait for the full list or display a partial list.
export function useFiles({ owner, repo, number, commitSha }: UseFilesParams) {
	const [files, setFiles] = useState<PullRequestFile[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const controller = new AbortController();
		setFiles([]);

		async function run() {
			try {
				setIsLoading(true);
				const res = await fetch(
					`/api/files?owner=${owner}&repo=${repo}&number=${number}` +
						(commitSha ? `&commitSha=${commitSha}` : ""),
					{ signal: controller.signal },
				);
				const reader = res.body?.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop()!;
					for (const line of lines.filter(Boolean)) {
						const data = JSON.parse(line);
						setFiles((prev) => [...prev, ...data]);
					}
				}
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				throw err;
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		}

		run();
		return () => controller.abort();
	}, [owner, repo, number, commitSha]);

	return { files, isLoading };
}
