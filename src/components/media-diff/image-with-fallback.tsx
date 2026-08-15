"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "~/lib/utils";

export function ImageWithFallback({
    src,
    alt,
    className,
}: {
    src: string;
    alt: string;
    className?: string;
}) {
    const [error, setError] = useState(false);
    if (error) {
        return (
            <div
                className={cn(
                    "flex items-center justify-center bg-surface-tertiary text-sm text-text-tertiary",
                    className,
                )}
            >
                Failed to load image
            </div>
        );
    }
    return (
        <Image
            alt={alt}
            className={className}
            draggable={false}
            onError={() => setError(true)}
            src={src}
            unoptimized
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "auto", height: "auto" }}
        />
    );
}
