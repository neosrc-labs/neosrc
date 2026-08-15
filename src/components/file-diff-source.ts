import { isImageFile } from "~/utils/image-file";
import { isSvgFile } from "~/utils/svg-file";

export type FileDiffPresentation =
    | "hidden"
    | "svg"
    | "code"
    | "image"
    | "renamed"
    | "whitespace"
    | "binary";

export function buildRawContentUrls({
    filename,
    previousFilename,
    status,
    owner,
    repo,
    baseSha,
    headSha,
}: {
    filename: string;
    previousFilename?: string | null;
    status: string;
    owner: string;
    repo: string;
    baseSha?: string;
    headSha?: string;
}): { oldUrl: string | null; newUrl: string | null } {
    const oldFilename = previousFilename ?? filename;
    const params = (sha: string, path: string) =>
        `/api/raw?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(path)}`;
    return {
        oldUrl:
            status !== "added" && baseSha ? params(baseSha, oldFilename) : null,
        newUrl:
            status !== "removed" && headSha ? params(headSha, filename) : null,
    };
}

export function resolveFileDiffPresentation({
    filename,
    patch,
    status,
    performanceHidden,
    showPerformanceDiff,
    baseSha,
    additions,
    deletions,
}: {
    filename: string;
    patch?: string | null;
    status: string;
    performanceHidden: boolean;
    showPerformanceDiff: boolean;
    baseSha?: string;
    additions: number;
    deletions: number;
}): FileDiffPresentation {
    if (performanceHidden && !showPerformanceDiff) return "hidden";
    if (isSvgFile(filename) && patch) return "svg";
    if (patch) return "code";
    if (isImageFile(filename) && baseSha) return "image";
    if (status === "renamed") return "renamed";
    if (additions === 0 && deletions === 0) return "whitespace";
    return "binary";
}
