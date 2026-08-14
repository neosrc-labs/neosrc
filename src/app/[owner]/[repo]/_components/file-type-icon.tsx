import Image from "next/image";

/** Material-style file/folder icon that falls back on load errors. */
export function FileTypeIcon({
    iconName,
    isDir,
}: {
    iconName: string;
    isDir: boolean;
}) {
    return (
        <Image
            alt=""
            className="h-4 w-4 shrink-0"
            src={`/material-icons/${iconName}.svg`}
            width={16}
            height={16}
            onError={(e) => {
                (e.target as HTMLImageElement).src = isDir
                    ? "/material-icons/folder.svg"
                    : "/material-icons/file.svg";
            }}
        />
    );
}
