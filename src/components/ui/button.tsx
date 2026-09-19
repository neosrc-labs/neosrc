import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "~/utils/helpers";

const buttonVariants = cva(
    "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-lg border border-transparent bg-clip-padding font-medium text-sm outline-none transition-all focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-border aria-invalid:ring-3 aria-invalid:ring-danger-border/30 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-action text-action-foreground hover:bg-action-hover",
                outline:
                    "border-border bg-surface-elevated text-text-label hover:bg-surface-tertiary hover:text-text-primary aria-expanded:bg-surface-tertiary aria-expanded:text-text-primary",
                secondary:
                    "bg-surface-tertiary text-text-label hover:bg-surface-selected hover:text-text-primary aria-expanded:bg-surface-selected aria-expanded:text-text-primary",
                ghost: "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary aria-expanded:bg-surface-tertiary aria-expanded:text-text-primary",
                destructive:
                    "bg-danger-surface text-danger-text hover:bg-danger-border/30 focus-visible:border-danger-border focus-visible:ring-danger-border/30",
                link: "text-link underline-offset-4 hover:text-link-hover hover:underline",
            },
            size: {
                default:
                    "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),10px)] px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                icon: "size-8",
                "icon-xs":
                    "size-6 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
                "icon-sm":
                    "size-7 in-data-[slot=button-group]:rounded-lg rounded-[min(var(--radius-md),12px)]",
                "icon-lg": "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
