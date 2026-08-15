// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { LucideIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { DiffModeToggle } from "./diff-mode-toggle";

function Icon() {
    return <span />;
}

describe("DiffModeToggle", () => {
    it("labels modes accessibly and reports selection", () => {
        const onModeChange = vi.fn();
        render(
            <DiffModeToggle
                mode="2up"
                modes={[
                    {
                        icon: Icon as unknown as LucideIcon,
                        label: "2-up",
                        value: "2up",
                    },
                    {
                        icon: Icon as unknown as LucideIcon,
                        label: "Swipe",
                        value: "swipe",
                    },
                ]}
                onModeChange={onModeChange}
            />,
        );
        expect(
            screen.getByRole("button", { name: "2-up" }),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Swipe" }));
        expect(onModeChange).toHaveBeenCalledWith("swipe");
    });
});
