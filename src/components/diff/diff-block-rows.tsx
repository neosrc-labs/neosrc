export function getDiffGapSize(
    gap: { startLine: number; endLine: number } | undefined,
    fileLineCount: number | undefined,
): number {
    if (!gap) return 0;
    const endLine = gap.endLine === -1 ? (fileLineCount ?? -1) : gap.endLine;
    return endLine - gap.startLine + 1;
}
