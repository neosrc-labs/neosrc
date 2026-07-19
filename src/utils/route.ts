export function isFilesPage(pathname: string): boolean {
    return (
        pathname?.includes("/pull/") &&
        (pathname.endsWith("/files") || pathname.includes("/files/"))
    );
}
