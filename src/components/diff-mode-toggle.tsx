import type { LucideIcon } from "lucide-react";

/** Bottom toolbar switching between diff view modes (2-up, swipe, ...). */
export function DiffModeToggle<T extends string>({
    mode,
    modes,
    onModeChange,
}: {
    mode: T;
    modes: Array<{ icon: LucideIcon; label: string; value: T }>;
    onModeChange: (mode: T) => void;
}) {
    return (
        <div className="flex items-center justify-center gap-1 border-border border-t bg-surface-secondary px-4 py-1.5">
            {modes.map(({ icon: Icon, label, value }) => (
                <button
                    className={`cursor-pointer rounded px-2 py-1 font-medium text-xs transition-colors ${
                        mode === value
                            ? "bg-surface-selected text-gray-800 dark:text-zinc-200"
                            : "text-text-tertiary hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
                    }`}
                    key={value}
                    onClick={() => onModeChange(value)}
                    title={label}
                    type="button"
                >
                    <Icon className="h-3.5 w-3.5" />
                </button>
            ))}
        </div>
    );
}
