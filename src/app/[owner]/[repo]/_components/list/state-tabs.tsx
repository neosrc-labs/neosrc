"use client";

export function StateTabs({
    tabs,
    activeTab,
    stateCounts,
    onTabChange,
}: {
    tabs: readonly { key: string; label: string }[];
    activeTab: string;
    stateCounts?: Record<string, number>;
    onTabChange: (tab: string) => void;
}) {
    return (
        <div className="flex items-center">
            {tabs.map((tab) => {
                const count = stateCounts?.[tab.key];
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onTabChange(tab.key)}
                        aria-label={
                            count !== undefined
                                ? `${tab.label} (${count.toLocaleString()})`
                                : tab.label
                        }
                        className={`relative -mb-px cursor-pointer px-4 py-3 font-medium text-sm transition-colors ${
                            activeTab === tab.key
                                ? "border-blue-500 border-b-2 text-text-primary"
                                : "text-text-secondary hover:text-text-primary dark:hover:text-zinc-100"
                        }`}
                    >
                        {tab.label}
                        {count !== undefined && (
                            <span
                                aria-hidden="true"
                                className="ml-1.5 rounded-full bg-surface-selected px-1.5 py-0.5 text-xs tabular-nums"
                            >
                                {count.toLocaleString()}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
