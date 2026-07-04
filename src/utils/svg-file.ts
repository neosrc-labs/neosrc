export function isSvgFile(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext === "svg";
}
