"use client";

import { Fragment } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import type { FooterAction } from "./markdown-editor";

interface EditorFooterProps {
    onCancel?: () => void;
    cancelLabel: string;
    disabled: boolean;
    footerActions?: FooterAction[];
    value: string;
}

export function EditorFooter({
    onCancel,
    cancelLabel,
    disabled,
    footerActions,
    value,
}: EditorFooterProps) {
    if (!footerActions && !onCancel) return null;
    return (
        <div className="flex items-center justify-between gap-2 border-border border-t bg-surface-secondary px-3 py-2">
            {onCancel ? (
                <button
                    className="cursor-pointer rounded-md border border-border px-4 py-1.5 font-medium text-sm text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={onCancel}
                    type="button"
                >
                    {cancelLabel}
                </button>
            ) : (
                <div />
            )}
            {footerActions && (
                <div className="flex items-center gap-2">
                    {footerActions.map((action) => {
                        const actionDisabled =
                            disabled ||
                            (typeof action.disabled === "function"
                                ? action.disabled(value)
                                : action.disabled);

                        const button = (
                            <button
                                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 py-1.5 font-medium text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    action.variant === "approve"
                                        ? "bg-state-open-solid text-state-solid-foreground enabled:hover:bg-state-open-solid/90"
                                        : action.variant === "danger"
                                          ? "bg-destructive text-destructive-foreground enabled:hover:bg-destructive-hover"
                                          : action.variant === "outline"
                                            ? "bg-surface-elevated text-text-label ring-1 ring-ring enabled:hover:bg-surface-tertiary"
                                            : "bg-surface-tertiary text-text-label enabled:hover:bg-surface-selected"
                                }`}
                                disabled={actionDisabled}
                                onClick={action.onClick}
                                type="button"
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        );

                        if (!action.tooltip) {
                            return (
                                <Fragment key={action.label}>{button}</Fragment>
                            );
                        }

                        return (
                            <Tooltip key={action.label}>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                        {button}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    {action.tooltip}
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
