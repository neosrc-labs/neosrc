export function isChangesPage(pathname: string): boolean {
    return (
        pathname?.includes("/pull/") &&
        (pathname.endsWith("/changes") || pathname.includes("/changes/"))
    );
}
