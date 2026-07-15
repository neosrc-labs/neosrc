"use client";

import { ArrowLeftRight, Columns2, Layers } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type DiffMode = "2up" | "swipe" | "onion";

interface ImageDiffProps {
    oldUrl: string | null;
    newUrl: string | null;
}

function ImageWithFallback({
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
                className={`flex items-center justify-center bg-surface-tertiary text-sm text-text-tertiary ${className ?? ""}`}
            >
                Failed to load image
            </div>
        );
    }

    return (
        <img
            alt={alt}
            className={className}
            draggable={false}
            onError={() => setError(true)}
            src={src}
        />
    );
}

function TwoUpView({
    oldUrl,
    newUrl,
}: {
    oldUrl: string | null;
    newUrl: string | null;
}) {
    return (
        <div className="flex flex-col md:flex-row">
            {oldUrl ? (
                <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
                    <div className="border-border border-b bg-surface-secondary px-3 py-1.5 text-center font-medium text-red-600 text-xs uppercase tracking-wide dark:text-red-400">
                        Deleted
                    </div>
                    <div className="flex flex-1 items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                        <ImageWithFallback
                            alt="Deleted version"
                            className="max-h-[600px] max-w-full object-contain"
                            src={oldUrl}
                        />
                    </div>
                </div>
            ) : null}
            {newUrl ? (
                <div className="flex flex-1 flex-col">
                    <div className="border-border border-b bg-surface-secondary px-3 py-1.5 text-center font-medium text-green-600 text-xs uppercase tracking-wide dark:text-green-400">
                        Added
                    </div>
                    <div className="flex flex-1 items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                        <ImageWithFallback
                            alt="Added version"
                            className="max-h-[600px] max-w-full object-contain"
                            src={newUrl}
                        />
                    </div>
                </div>
            ) : null}
            {!oldUrl && !newUrl && (
                <div className="px-4 py-3 text-sm text-text-tertiary italic">
                    No image available
                </div>
            )}
        </div>
    );
}

function SwipeView({
    oldUrl,
    newUrl,
}: {
    oldUrl: string | null;
    newUrl: string | null;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    const updatePosition = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pos = ((clientX - rect.left) / rect.width) * 100;
        setPosition(Math.max(0, Math.min(100, pos)));
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            updatePosition(e.clientX);
        };
        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) {
                updatePosition(touch.clientX);
            }
        };
        const handleEnd = () => setIsDragging(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("touchmove", handleTouchMove);
        window.addEventListener("mouseup", handleEnd);
        window.addEventListener("touchend", handleEnd);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("mouseup", handleEnd);
            window.removeEventListener("touchend", handleEnd);
        };
    }, [isDragging, updatePosition]);

    if (!oldUrl || !newUrl) {
        return (
            <div className="flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                {oldUrl && (
                    <ImageWithFallback
                        alt="Old version"
                        className="max-h-[600px] max-w-full object-contain"
                        src={oldUrl}
                    />
                )}
                {newUrl && (
                    <ImageWithFallback
                        alt="New version"
                        className="max-h-[600px] max-w-full object-contain"
                        src={newUrl}
                    />
                )}
                {!oldUrl && !newUrl && (
                    <span className="text-sm text-text-tertiary">
                        No image available
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            className="relative select-none overflow-hidden bg-[#f0f0f0] dark:bg-zinc-900"
            onTouchStart={(e) => {
                setIsDragging(true);
                const touch = e.touches[0];
                if (touch) {
                    updatePosition(touch.clientX);
                }
            }}
            onMouseDown={(e) => {
                setIsDragging(true);
                updatePosition(e.clientX);
            }}
        >
            <div
                ref={containerRef}
                className="relative bg-[#f0f0f0] dark:bg-zinc-900"
            >
                <ImageWithFallback
                    alt="Old version"
                    className="block max-h-[600px] w-full object-contain"
                    src={oldUrl}
                />
                <div
                    className="absolute top-0 left-0 h-full overflow-hidden"
                    style={{ width: `${position}%` }}
                >
                    <img
                        alt="New version"
                        className="block max-h-[600px] w-full object-contain"
                        draggable={false}
                        src={newUrl}
                        style={{
                            width: `${(1 / (position / 100)) * 100}%`,
                            maxWidth: "none",
                        }}
                    />
                </div>
                <div
                    className="absolute top-0 h-full w-[3px] cursor-ew-resize bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]"
                    style={{
                        left: `${position}%`,
                        transform: "translateX(-1.5px)",
                    }}
                >
                    <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md">
                        <ArrowLeftRight className="h-4 w-4 text-text-secondary" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function OnionSkinView({
    oldUrl,
    newUrl,
}: {
    oldUrl: string | null;
    newUrl: string | null;
}) {
    const [opacity, setOpacity] = useState(50);

    if (!oldUrl || !newUrl) {
        return (
            <div className="flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                {oldUrl && (
                    <ImageWithFallback
                        alt="Old version"
                        className="max-h-[600px] max-w-full object-contain"
                        src={oldUrl}
                    />
                )}
                {newUrl && (
                    <ImageWithFallback
                        alt="New version"
                        className="max-h-[600px] max-w-full object-contain"
                        src={newUrl}
                    />
                )}
                {!oldUrl && !newUrl && (
                    <span className="text-sm text-text-tertiary">
                        No image available
                    </span>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="relative flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                <ImageWithFallback
                    alt="New version"
                    className="max-h-[600px] max-w-full object-contain"
                    src={newUrl}
                />
                <img
                    alt="Old version"
                    className="absolute top-1/2 left-1/2 max-h-[600px] max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
                    draggable={false}
                    src={oldUrl}
                    style={{ opacity: opacity / 100 }}
                />
            </div>
            <div className="flex items-center gap-3 border-border border-t bg-surface-secondary px-4 py-2">
                <span className="text-red-600 text-xs dark:text-red-400">
                    Deleted
                </span>
                <input
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-selected accent-gray-500 dark:accent-zinc-400"
                    max={100}
                    min={0}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    type="range"
                    value={opacity}
                />
                <span className="text-green-600 text-xs dark:text-green-400">
                    Added
                </span>
            </div>
        </div>
    );
}

export default function ImageDiff({ oldUrl, newUrl }: ImageDiffProps) {
    const [mode, setMode] = useState<DiffMode>("2up");

    const hasBoth = oldUrl !== null && newUrl !== null;

    const modes: Array<{
        icon: typeof Columns2;
        label: string;
        value: DiffMode;
    }> = [
        { icon: Columns2, label: "2-up", value: "2up" },
        { icon: ArrowLeftRight, label: "Swipe", value: "swipe" },
        { icon: Layers, label: "Onion skin", value: "onion" },
    ];

    return (
        <div>
            {!hasBoth && newUrl && (
                <div className="flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                    <ImageWithFallback
                        alt="Added version"
                        className="max-h-[600px] max-w-full object-contain"
                        src={newUrl}
                    />
                </div>
            )}
            {!hasBoth && oldUrl && (
                <div className="flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                    <ImageWithFallback
                        alt="Deleted version"
                        className="max-h-[600px] max-w-full object-contain"
                        src={oldUrl}
                    />
                </div>
            )}
            {hasBoth && mode === "2up" && (
                <TwoUpView newUrl={newUrl} oldUrl={oldUrl} />
            )}
            {hasBoth && mode === "swipe" && (
                <SwipeView newUrl={newUrl} oldUrl={oldUrl} />
            )}
            {hasBoth && mode === "onion" && (
                <OnionSkinView newUrl={newUrl} oldUrl={oldUrl} />
            )}
            {hasBoth && (
                <div className="flex items-center justify-center gap-1 border-border border-t bg-surface-secondary px-4 py-1.5">
                    {modes.map(({ icon: Icon, label, value }) => (
                        <button
                            className={`cursor-pointer rounded px-2 py-1 font-medium text-xs transition-colors ${
                                mode === value
                                    ? "bg-surface-selected text-gray-800 dark:text-zinc-200"
                                    : "text-text-tertiary hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
                            }`}
                            key={value}
                            onClick={() => setMode(value)}
                            title={label}
                            type="button"
                        >
                            <Icon className="h-3.5 w-3.5" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
