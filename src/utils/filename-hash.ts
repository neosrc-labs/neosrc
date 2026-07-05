export function filenameHash(filename: string): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x6c62272e;
    for (let i = 0; i < filename.length; i++) {
        const c = filename.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193);
        h2 = Math.imul(h2 ^ c, 0x01b3af2b);
    }
    const p1 = (h1 >>> 0).toString(16).padStart(8, "0");
    const p2 = (h2 >>> 0).toString(16).padStart(8, "0");
    return p1 + p2 + p1 + p2 + p1 + p2 + p1 + p2;
}
