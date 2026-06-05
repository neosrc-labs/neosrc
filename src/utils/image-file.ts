const IMAGE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "webp",
    "bmp",
    "ico",
    "avif",
    "tiff",
    "tif",
]);

export function isImageFile(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}
