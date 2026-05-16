import type * as React from "react";
import { cn } from "~/lib/utils";

interface LabelProps extends React.HTMLAttributes<HTMLElement> {
    color: string;
}

export function Label({ color, className, children }: LabelProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs",
                className,
            )}
            style={{
                backgroundColor: `#${color}20`,
                color: `#${color}`,
            }}
        >
            {children}
        </span>
    );
}
